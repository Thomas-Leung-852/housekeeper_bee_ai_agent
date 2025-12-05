#!/bin/bash

working_dir=/home/$USER/redis

#************************************************
# Create redis directory
#************************************************

mkdir -p $working_dir
sudo chown -R $USER:$USER $working_dir
cd $working_dir

#************************************************
# Create dokcer compose
#************************************************

cat << EOF > ./docker-compose.yml
version: '3.8'
services:
  redis:
    image: redis:latest
    container_name: redis
    ports:
      - "6379:6379"
    volumes:
      - ./redis-data:/data
    restart: unless-stopped

volumes:
  redis-data:

EOF

#************************************************
#  start container
#************************************************

docker compose up -d

wait

#************************************************
# Create service
#************************************************

echo
echo "⚡ Creating systemd service for redis"

sudo tee /etc/systemd/system/redis-startup.service > /dev/null << EOF
[Unit]
Description=redis Docker Compose
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
sudo systemctl enable redis-startup.service


