#!/bin/bash
export NOW=$(date +"%s")
#echo "Time "$NOW
export STARTING_POINT=`pwd`
echo "Removing the crypto config"
rm -rf ./dist/crypto-config
dir ./dist/crypto-config/
echo "Copying the crypto config"
cp -r /home/projects/blok-docs-network/crypto-config ./dist/
tree -A ./dist/crypto-config/ -L 3
echo "Running tsc"
tsc -v 
tsc
./start.sh

