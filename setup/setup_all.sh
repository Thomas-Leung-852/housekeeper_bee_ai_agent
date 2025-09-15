#!/bin/bash

clear

echo "Install Nodejs version 18 ..."

./00_install_nodejs.sh  
wait

echo "Setup zigbee2mqtt server"

./10_zigbee2mqtt_setup.sh
wait

echo "Setup ollama and AI models ..."
./20_ollama_setup.sh
wait

echo "Create auto-run and startup file ..."
./30_setup_ai_agent.sh
wait

echo ""
echo "Done - reboot to take effect!"
echo ""
read -n 1 -s -r -p "Press any key to reboot..."

sudo reboot



