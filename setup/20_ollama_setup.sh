#!/bin/bash

working_dir=~/ollama

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
# Create ollama directory
#************************************************

mkdir -p $working_dir
cd $working_dir

cat << EOF > ./docker-compose.yml
version: '3.8'
services:
  ollama:
    image: ollama/ollama
    container_name: ollama
    ports:
      - "11434:11434"
    volumes:
      - ollama:/root/.ollama
    restart: unless-stopped

volumes:
  ollama:

EOF

#************************************************
#  start container
#************************************************

docker compose up -d

wait


docker exec -it ollama ollama serve

wait


#************************************************
# download ollama models
#************************************************

# Pull the models

echo ""
echo "Download tinyllama model"
docker exec -it ollama ollama pull tinyllama

echo "Download llama3.2 model"
docker exec -it ollama ollama pull llama3.2

echo "Download qwen3:1.7b model"
docker exec -it ollama ollama pull qwen3:1.7b

#************************************************
# test model
#************************************************

# Start an interactive chat session
# docker exec -it ollama ollama run tinyllama

echo
echo "Running a test. It will take a few minutes. Please Wait!"


# Using curl to send a prompt
curl http://localhost:11434/api/chat -d '{
  "model": "tinyllama",
  "messages": [
    {
      "role": "user",
      "content": "Why is the ocean salty?"
    }
  ],
  "stream": false
}'


#************************************************
# Create service
#************************************************

echo
echo "⚡ Creating systemd service for ollama"

sudo tee /etc/systemd/system/ollama-startup.service > /dev/null << EOF
[Unit]
Description=ollama Docker Compose
After=docker.service network-online.target
Wants=docker.service network-online.target
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
User=$USER
WorkingDirectory=$working_dir
# Wait 30 before starting
ExecStartPre=/bin/sleep 30
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
sudo systemctl enable ollama-startup.service




