#!/bin/bash
tsc
echo "Killing on the old process if any"
kill -9 `cat pidlistener.txt`
echo "Starting the block listener server"
nohup node  dist/blocklistener.js  >blocklistener.log 2>&1 &
echo $! > pidlistener.txt
echo "Waiting for process to launch"
sleep 2
echo `cat blocklistener.log`
