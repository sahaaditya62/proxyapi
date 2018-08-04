#!/bin/bash
tsc
echo "Killing on the old process if any"
kill -9 `cat spidlistener.txt`
echo "Starting the block listener server"
nohup node  dist/sblocklistener.js  >sblocklistener.log 2>&1 &
echo $! > spidlistener.txt
echo "Waiting for process to launch"
sleep 2
echo `cat sblocklistener.log`
