#!/bin/bash

# Waoowaoo Engine - Docker Deployment Script
# Protocol 1.0.0 - Specialized Engine Airdrop

IMAGE_NAME="novelbox/waoowaoo"
TAG="latest"
PLATFORM="linux/amd64"

# VPS Target: Lisa Host
VPS_IP="154.44.3.173"
VPS_PORT="10126"
VPS_USER="root"
REMOTE_PATH="/root/apps/waoowaoo"

echo "------------------------------------------------"
echo "🚀 Starting Deployment for Waoowaoo Engine..."
echo "------------------------------------------------"

# 1. Check Docker
if ! docker info >/dev/null 2>&1; then
    echo "❌ Error: Docker is not running."
    exit 1
fi

# 2. Build Image
echo "📦 Building Waoowaoo Docker Image..."
# We use the existing Dockerfile in the project
docker build --platform $PLATFORM -t $IMAGE_NAME:$TAG .

if [ $? -eq 0 ]; then
    echo "✅ Build Successful. Pushing to Docker Hub..."
    docker push $IMAGE_NAME:$TAG
    
    if [ $? -eq 0 ]; then
        echo "------------------------------------------------"
        echo "📡 Airdrop to Lisa Host - $VPS_IP"
        echo "------------------------------------------------"
        
        # Ensure remote directory exists
        ssh -p $VPS_PORT $VPS_USER@$VPS_IP "mkdir -p $REMOTE_PATH"

        # Sync compose file and env
        scp -P $VPS_PORT docker-compose.vps.yml $VPS_USER@$VPS_IP:$REMOTE_PATH/docker-compose.yml
        scp -P $VPS_PORT .env $VPS_USER@$VPS_IP:$REMOTE_PATH/.env

        ssh -p $VPS_PORT $VPS_USER@$VPS_IP << EOF
            cd $REMOTE_PATH
            docker pull $IMAGE_NAME:$TAG
            docker compose down || true
            docker compose up -d
            docker image prune -f
            exit
EOF

        echo "------------------------------------------------"
        echo "✨ Deployment Complete!"
        echo "Engine: https://studio.novelboxai.com"
        echo "------------------------------------------------"
    else
        echo "❌ Error: Push failed."
    fi
else
    echo "❌ Error: Build failed."
fi
