#!/bin/bash
# Start HTTPS tunnel for video calling

echo "🔐 Starting HTTPS tunnel for video dating app..."
echo ""

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrok is not installed. Please install it first:"
    echo "   brew install ngrok"
    echo "   OR download from: https://ngrok.com/download"
    exit 1
fi

# Get the local IP for reference
LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -n1)

echo "📡 Backend server should be running on: http://${LOCAL_IP}:8004"
echo "🔐 Creating HTTPS tunnel..."
echo ""

# Start ngrok tunnel
echo "🌐 Starting ngrok HTTPS tunnel to port 8004..."
echo "⚡ This will give you a secure HTTPS URL for camera access!"
echo ""

ngrok http 8004
