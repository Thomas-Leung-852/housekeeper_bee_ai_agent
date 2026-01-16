#!/bin/bash

# Check if Node.js is installed and if it's version 24

if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    if [[ "$NODE_VERSION" == v24.* ]]; then
        echo "Node.js version 24 is already installed: $NODE_VERSION"
        exit 1
    else
        echo "Node.js is installed, but it's not version 24. Current version: $NODE_VERSION"
        echo "Proceeding with installation of Node.js 24."
    fi
else
    echo "Node.js is not installed. Proceeding with installation of Node.js 24."
fi

# Install Node.js 24 using NodeSource
echo "Installing Node.js 24..."

# Update package lists and install curl if not present
sudo apt update
sudo apt install -y curl

# Add NodeSource Node.js 24.x repository
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -

# Install Node.js
sudo apt install -y nodejs

# Verify installation
if command -v node &> /dev/null; then
    echo "Node.js 24 installed successfully. Version: $(node --version)"
else
    echo "Failed to install Node.js 24."
    exit 1
fi


