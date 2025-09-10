#!/bin/bash

echo "🎥 Video Call HTTPS Setup"
echo "========================"
echo ""
echo "🔍 Diagnosing video call initialization issue..."
echo ""

# Check if ngrok is installed
if command -v ngrok >/dev/null 2>&1; then
    echo "✅ ngrok is installed"
else
    echo "❌ ngrok not found"
    echo "📦 Please install ngrok from: https://ngrok.com/download"
    echo ""
    echo "🍎 On macOS: brew install ngrok"
    echo "🐧 On Linux: snap install ngrok"
    echo "🪟 On Windows: Download from ngrok.com"
    exit 1
fi

# Kill any existing ngrok processes
pkill -f ngrok

echo ""
echo "🚀 Starting HTTPS tunnel for backend..."
echo "📍 Backend should be running on port 8004"
echo ""

# Start ngrok in background and capture the URL
ngrok http 8004 --log=stdout > ngrok.log &
NGROK_PID=$!

# Wait for ngrok to start up
sleep 3

# Extract the HTTPS URL
HTTPS_URL=$(curl -s localhost:4040/api/tunnels | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    tunnels = data.get('tunnels', [])
    for tunnel in tunnels:
        if tunnel['proto'] == 'https':
            print(tunnel['public_url'])
            break
except:
    pass
")

if [ -z "$HTTPS_URL" ]; then
    echo "❌ Failed to get ngrok HTTPS URL"
    echo "🔧 Please check if ngrok started correctly"
    kill $NGROK_PID 2>/dev/null
    exit 1
fi

echo "✅ HTTPS tunnel created: $HTTPS_URL"
echo ""

# Update frontend API URL
echo "🔧 Updating frontend API configuration..."

# Update api.ts
sed -i.bak "s|const API_BASE_URL = process.env.REACT_APP_API_URL.*|const API_BASE_URL = process.env.REACT_APP_API_URL || '$HTTPS_URL';|" frontend/src/utils/api.ts

# Update api-network.ts if it exists
if [ -f frontend/src/utils/api-network.ts ]; then
    sed -i.bak "s|const API_BASE_URL = process.env.REACT_APP_API_URL.*|const API_BASE_URL = process.env.REACT_APP_API_URL || '$HTTPS_URL';|" frontend/src/utils/api-network.ts
fi

echo "✅ Frontend API URL updated to: $HTTPS_URL"
echo ""
echo "🎉 HTTPS setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. 🔄 Restart your frontend: cd frontend && npm start"
echo "2. 🌐 Access your app via HTTPS URL"
echo "3. 🎥 Try the video call feature - camera should work now!"
echo ""
echo "🔗 Backend HTTPS URL: $HTTPS_URL"
echo "🔗 Frontend will be at: http://localhost:3000"
echo ""
echo "⚠️  Keep this terminal open to maintain the HTTPS tunnel"
echo "🛑 To stop: Press Ctrl+C or run: pkill -f ngrok"

# Keep the script running
echo ""
echo "🔄 Tunnel is running... Press Ctrl+C to stop"
wait $NGROK_PID
