#!/bin/bash

# Setup script for Zigbee2MQTT and Mosquitto on Raspberry Pi 5
#set -e

#************************************************
# Check for Zigbee adapter
#************************************************

echo "🔍 Checking for Zigbee adapters..."
echo "Available serial devices:"

device_type=$(ls -la /dev/tty* | grep -E "(USB|ACM)")

if [ ! "$device_type" == "" ]; then
   echo "device found"
else
   echo "No USB/ACM devices found"
   exit 1
fi

#************************************************
#init
#************************************************

zb2mqtt_frontend_port=8100
timezone=$(cat /etc/timezone)
PROJECT_DIR="/home/$USER/zigbee2mqtt"

echo "🚀 Setting up Zigbee2MQTT and Mosquitto MQTT broker..."

#************************************************
# Update system
#************************************************

echo "📦 Updating system packages..."

sudo apt update && sudo apt upgrade -y

#************************************************
# Install Docker if not already installed
#************************************************

if ! command -v docker &> /dev/null; then
    echo "🐳 Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    echo "Installed docker"
fi

#************************************************
# Install Docker Compose if not already installed
#************************************************

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "🔧 Installing Docker Compose..."
    sudo apt install -y docker-compose-plugin
    echo "Installed docker-compose"
fi

#************************************************
# Create project directory
#************************************************

echo "📁 Creating project directory: $PROJECT_DIR"

mkdir -p $PROJECT_DIR
cd $PROJECT_DIR

#************************************************
# Create directory structure
#************************************************

echo "📂 Creating directory structure..."

mkdir -p mosquitto/{config,data,log}
mkdir -p zigbee2mqtt-data

#************************************************
# Set permissions
#************************************************

echo "🔐 Setting permissions..."

sudo chown -R $USER:$USER mosquitto/
chmod -R 755 mosquitto/
sudo chown -R $USER:$USER zigbee2mqtt-data/

#************************************************
# Create configuration files 
#************************************************

echo "Create the following files:"
echo "  - docker-compose.yml"
echo "  - mosquitto/config/mosquitto.conf"
echo "  - zigbee2mqtt-data/configuration.yaml"

#************************************************
# Create docker-compose.yml
#************************************************

cat  <<  EOF >  docker-compose.yml

version: '3.8'

services:
  mosquitto:
    image: eclipse-mosquitto:latest
    container_name: mosquitto
    restart: unless-stopped
    ports:
      - "1883:1883"
      - "9001:9001"
    volumes:
      - ./mosquitto/config:/mosquitto/config
      - ./mosquitto/data:/mosquitto/data
      - ./mosquitto/log:/mosquitto/log
    networks:
      - mqtt-network

  zigbee2mqtt:
    image: koenkk/zigbee2mqtt:latest
    container_name: zigbee2mqtt
    restart: unless-stopped
    depends_on:
      - mosquitto
    volumes:
      - ./zigbee2mqtt-data:/app/data
      - /run/udev:/run/udev:ro
    devices:
      # Replace with your Zigbee adapter device
      - /dev/ttyUSB0:/dev/ttyUSB0
    environment:
      - TZ=${timezone}
    ports:
      - "${zb2mqtt_frontend_port}:${zb2mqtt_frontend_port}"
    networks:
      - mqtt-network
    privileged: true

networks:
  mqtt-network:
    driver: bridge

volumes:
  mosquitto-data:
  zigbee2mqtt-data:

EOF

#************************************************
# Create mosquittp.conf 
#************************************************

cat << EOF >  ./mosquitto/config/mosquitto.conf

# Mosquitto configuration file

# Basic settings
persistence true
persistence_location /mosquitto/data/
log_dest file /mosquitto/log/mosquitto.log

# Network settings
listener 1883
protocol mqtt

# WebSocket listener (optional)
listener 9001
protocol websockets

# Security settings (for production, consider adding authentication)
allow_anonymous true

# Logging
log_type error
log_type warning
log_type notice
log_type information

# Connection settings
max_keepalive 65535
max_connections 1000

EOF

#************************************************
# Create configuration.yaml
#************************************************

cat << EOF >  ./zigbee2mqtt-data/configuration.yaml

# Zigbee2MQTT configuration

# MQTT settings
mqtt:
  base_topic: zigbee2mqtt
  server: mqtt://mosquitto:1883
  # For authentication (uncomment if needed)
  # user: your_username
  # password: your_password

# Serial settings (adjust for your Zigbee adapter)
serial:
  port: /dev/ttyUSB0  # Replace with your adapter's device path
  # Common alternatives:
  # port: /dev/ttyACM0  # For some USB adapters
  # port: /dev/serial/by-id/usb-Texas_Instruments_TI_CC2531_USB_CDC___0X00124B0014E7B197-if00

# Zigbee settings
zigbee:
  # Network key (CHANGE THIS for security)
  network_key: GENERATE
  # Pan ID (use random value or leave as is)
  pan_id: 0x1a62
  # Channel (11, 15, 20, or 25 are recommended)
  channel: 11

# Web interface
frontend:
  port: $zb2mqtt_frontend_port
  host: 0.0.0.0

# Enable device autodiscovery
device_options:
  legacy: false
  retain: true

# Advanced settings
advanced:
  # Log level (debug, info, warn, error)
  log_level: info
  # Network key will be shown in logs (set to false for security)
  log_sniffer: false

# Homeassistant integration (optional)
homeassistant: true

# Permit joining devices (set to false after initial setup)
permit_join: true

EOF


#************************************************
# Create service 
#************************************************

echo "⚡ Creating systemd service for auto-start with 1-minute delay..."

sudo tee /etc/systemd/system/zigbee2mqtt-startup.service > /dev/null << EOF
[Unit]
Description=Zigbee2MQTT and Mosquitto Docker Compose
After=docker.service network-online.target
Wants=docker.service network-online.target
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
User=$USER
WorkingDirectory=$PROJECT_DIR
# Wait 2 minutes before starting
ExecStartPre=/bin/sleep 60
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=300

[Install]
WantedBy=multi-user.target
EOF

#************************************************
# Enable the service
#************************************************

echo "🔄 Enabling startup service..."
sudo systemctl daemon-reload
sudo systemctl enable zigbee2mqtt-startup.service

echo ""
echo "📝 Remember to update the device path in docker-compose.yml and configuration.yaml"
echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Test the setup: cd $PROJECT_DIR && docker compose up -d"
echo "2. Access Zigbee2MQTT web interface at: http://localhost:$zb2mqtt_frontend_port"
echo "3. MQTT broker will be available at: localhost:1883"
echo "4. The services will auto-start on boot with a 1-minute delay"
echo ""
echo "🔧 Useful commands:"
echo "  Start services: docker compose up -d"
echo "  Stop services: docker compose down"
echo "  View logs: docker compose logs -f"
echo "  Check service status: sudo systemctl status zigbee2mqtt-startup.service"

