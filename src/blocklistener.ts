import { HFCClient, BlockEventCallBack, EventHubDisconnectCallBack } from './hfcutil/hfcclient'
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as debug from 'debug';
import * as log4js from 'log4js';
import * as WebSocket from 'ws';
import * as express from 'express';

var _LOGGER = log4js.getLogger('BlockListenerLogger');
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server })
export class MessageResponse {
    isSuccess: boolean = false
    message: string = ""
    result: any
    constructor(success: boolean, msg: string, result: any) {
        this.isSuccess = success
        this.message = msg
        this.result = result
    }
}
/**
 * Class thet works as a block event listener
 */
export class Blocklistener {
    //As of now listing to one of the endorser organization
    private client: HFCClient

    constructor(org: string) {
        let basePath = "../"
        let configPath = basePath + "network-config.json"
        let credentialStorePath = "~/credstore_bl"
        let userCredentialPath = basePath + "user-cred-config.json"
        _LOGGER.info("PATH NAME " + __dirname)
        _LOGGER.info(`Credential path : ${configPath}`)
        let networkConfigStr = fs.readFileSync(path.join(__dirname, configPath));
        let networkConfig = JSON.parse(Buffer.from(networkConfigStr).toString())['network-config']
        let orderers: object[] = networkConfig['orderer']

        _LOGGER.info(`Setting up the org ${org}`)
        this.initOrg(networkConfig[org], org, orderers, credentialStorePath, userCredentialPath)
        _LOGGER.info(`Setup complete for the org ${org}`)


    }
    /**
     * Initialzs an org
     * @param config  Configuration object
     * @param orgname Name of th organization , string
     * @param ordererConfig Array of orderer
     * @param credentialStorePath string
     * @param userCredentialPath string
     */
    private initOrg(config: any, orgname: string, ordererConfig: object[], credentialStorePath: string, userCredentialPath: string) {
        this.client = new HFCClient(orgname, config, ordererConfig, credentialStorePath, "", userCredentialPath, false)

    }
    /**
     * Start the block event lister client. On disconnection , it attepts to reconnect
     */
    public async run(): Promise<boolean> {

        let isSuccess = false;
        try {
            var init = await this.client.init()

            if (init) {
                isSuccess = await this.client.registerForBlockEvent((peerId: string, block: any): void => {
                    //Post this info in the webhook
                    broadCast(block)

                }, (peerId: string, err: Error): void => {
                    _LOGGER.warn("Disconnect . Reconnecting...")
                    this.run()
                })
            }
        } catch (exp) {
            _LOGGER.error("Unable to initilize. Exiting", exp)
            isSuccess = false
        }

        return new Promise<boolean>((resolve) => { resolve(isSuccess) });

    }
    /**
     * Handle an incoming message
     * @param message string
     * @param clientWs WebSocket
     */
    public handleWebClientMessages(message: string, clientWs: WebSocket): void {
        let outMessage: MessageResponse = null
        try {
            var inputMsg: any = JSON.parse(message)
            if (inputMsg["action"] != null) {
                var action: string = inputMsg["action"]
                switch (action) {

                }
                outMessage = new MessageResponse(true, "Excecution successful", new Date())
            } else {
                outMessage = new MessageResponse(false, "Invalid action sent", null)
            }
        } catch (exp) {
            _LOGGER.error("Invalid message format given")
            outMessage = new MessageResponse(false, "Invalid message sent", null)
        }
        clientWs.send(JSON.stringify(outMessage))
    }
}

/**
 * Broadcasts the block to the listers
 * @param block 
 */
function broadCast(block: any) {
    var outMsg: MessageResponse = new MessageResponse(true, "Block event broadcast", block)
    var json = JSON.stringify(outMsg)
    wss.clients
        .forEach(client => {
            try {
                if (client.isAlive == true) {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(json, (err) => {
                            if (err!=null){
                            _LOGGER.error("Error in sending WS payload(client send)", err)
                            }
                        });
                    }
                } else {
                    client.terminate()
                }
            } catch (exp) {
                _LOGGER.error("Error in sending WS payload", exp)
            }
        }
        );

}
function heartbeat() {
    this.isAlive = true;
}
function noop() { }
//Following lines are executed when this js file is invoked
var blockListener = new Blocklistener("custodian")
blockListener.run().then((ready) => {

    if (ready == true) {

        wss.on('connection', (ws: WebSocket) => {
            ws.isAlive = true;
            ws.on('pong', heartbeat);
            //connection is up, let's add a simple simple event
            ws.on('message', (message: string) => {
                //log the received message and send it back to the client
                _LOGGER.info('Received: %s', message);
                ws.isAlive = true
                blockListener.handleWebClientMessages(message, ws)
            });
            ws.on('error', () => _LOGGER.warn('Default error callback'));
            //send immediatly a feedback to the incoming connection    
            var resp = new MessageResponse(true, "Connection established", new Date())
            ws.send(JSON.stringify(resp));
        });
        server.listen(9000, '0.0.0.0');
        console.log('Server running at http://0.0.0.0:9000');
    } else {
        _LOGGER.warn("Initialization failure . Exiting")
        console.log('Failed to launch');
    }
})


