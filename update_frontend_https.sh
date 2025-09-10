#!/bin/bash
# Update frontend API URLs to use HTTPS ngrok tunnel

echo "🔐 Frontend HTTPS URL Updater"
echo ""

# Check if ngrok URL is provided
if [ -z "$1" ]; then
    echo "❌ Please provide your ngrok HTTPS URL"
    echo "Usage: $0 https://abc123def.ngrok.io"
    echo ""
    echo "Example:"
    echo "  $0 https://abc123def.ngrok.io"
    echo ""
    echo "💡 Get your ngrok URL by running: ./start_https.sh"
    exit 1
fi

NGROK_URL=$1

# Validate URL format
if [[ ! $NGROK_URL == https://*.ngrok.io ]]; then
    echo "❌ Invalid URL format. Please use: https://xyz.ngrok.io"
    exit 1
fi

echo "🔄 Updating frontend API URLs to: $NGROK_URL"
echo ""

# Update api.ts
API_FILE="frontend/src/utils/api.ts"
if [ -f "$API_FILE" ]; then
    # Create backup
    cp "$API_FILE" "$API_FILE.backup"
    
    # Update the URL
    sed -i '' "s|const API_BASE_URL = process.env.REACT_APP_API_URL.*|const API_BASE_URL = process.env.REACT_APP_API_URL || '${NGROK_URL}';|g" "$API_FILE"
    
    echo "✅ Updated: $API_FILE"
else
    echo "❌ File not found: $API_FILE"
fi

# Update api-network.ts
API_NETWORK_FILE="frontend/src/utils/api-network.ts"
if [ -f "$API_NETWORK_FILE" ]; then
    # Create backup
    cp "$API_NETWORK_FILE" "$API_NETWORK_FILE.backup"
    
    # Update the URL
    sed -i '' "s|const API_BASE_URL = .*|const API_BASE_URL = '${NGROK_URL}';|g" "$API_NETWORK_FILE"
    
    echo "✅ Updated: $API_NETWORK_FILE"
else
    echo "❌ File not found: $API_NETWORK_FILE"
fi

echo ""
echo "🎉 Frontend updated successfully!"
echo ""
echo "📋 Next Steps:"
echo "1. Restart your React dev server: cd frontend && npm start"
echo "2. Access your app from any device on the network"
echo "3. Test video calls - camera access should now work! 📹"
echo ""
echo "🔄 Backend API is now: $NGROK_URL"
echo "📱 Frontend still accessible at: http://YOUR_IP:3000"
