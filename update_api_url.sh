#!/bin/bash
# Script to update API URL for the other laptop

echo "🔧 Dating App - Update API URL for Other Laptop"
echo "==============================================="
echo ""

# Function to get current IP
get_current_ip() {
    if command -v hostname >/dev/null 2>&1; then
        # Try hostname command first (works on most systems)
        IP=$(hostname -I 2>/dev/null | awk '{print $1}')
        if [ -n "$IP" ] && [ "$IP" != "127.0.0.1" ]; then
            echo "$IP"
            return
        fi
    fi
    
    # Try ifconfig as backup
    if command -v ifconfig >/dev/null 2>&1; then
        IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}' | cut -d':' -f2)
        if [ -n "$IP" ]; then
            echo "$IP"
            return
        fi
    fi
    
    # Try ip command as another backup
    if command -v ip >/dev/null 2>&1; then
        IP=$(ip route get 1.1.1.1 | awk '{print $7}' | head -1)
        if [ -n "$IP" ] && [ "$IP" != "127.0.0.1" ]; then
            echo "$IP"
            return
        fi
    fi
    
    echo ""
}

# Get user input for IP address
echo "Current directory: $(pwd)"
echo ""

if [ -f "frontend/src/utils/api.ts" ]; then
    echo "✅ Found frontend files in current directory"
else
    echo "❌ Cannot find frontend files. Make sure you're in the project root directory."
    echo "   Expected to find: frontend/src/utils/api.ts"
    exit 1
fi

echo ""
echo "📡 Network Detection:"

# Try to auto-detect current machine's IP
CURRENT_IP=$(get_current_ip)
if [ -n "$CURRENT_IP" ]; then
    echo "🔍 Auto-detected IP address: $CURRENT_IP"
    echo ""
    read -p "Use this IP address? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        NEW_IP="$CURRENT_IP"
    fi
fi

# If no auto-detection or user said no, ask manually
if [ -z "$NEW_IP" ]; then
    echo ""
    echo "Please enter the IP address of the laptop running the backend:"
    echo "(This is usually shown when you start the backend server)"
    echo "Example: 10.101.83.3, 192.168.1.100, etc."
    echo ""
    read -p "Backend IP address: " NEW_IP
fi

if [ -z "$NEW_IP" ]; then
    echo "❌ No IP address provided. Exiting."
    exit 1
fi

# Validate IP format (basic check)
if ! [[ $NEW_IP =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "❌ Invalid IP address format: $NEW_IP"
    echo "   Please use format like: 192.168.1.100"
    exit 1
fi

NEW_URL="http://$NEW_IP:8004"
echo ""
echo "📝 Updating API URLs to: $NEW_URL"
echo ""

# Update api.ts
if [ -f "frontend/src/utils/api.ts" ]; then
    # Create backup
    cp frontend/src/utils/api.ts frontend/src/utils/api.ts.backup
    
    # Update the API_BASE_URL
    sed -i.tmp "s|const API_BASE_URL = process.env.REACT_APP_API_URL || '.*'|const API_BASE_URL = process.env.REACT_APP_API_URL || '$NEW_URL'|" frontend/src/utils/api.ts
    rm frontend/src/utils/api.ts.tmp 2>/dev/null || true
    
    echo "✅ Updated frontend/src/utils/api.ts"
else
    echo "❌ Could not find frontend/src/utils/api.ts"
fi

# Update api-network.ts if it exists
if [ -f "frontend/src/utils/api-network.ts" ]; then
    # Create backup
    cp frontend/src/utils/api-network.ts frontend/src/utils/api-network.ts.backup
    
    # Update the API_BASE_URL
    sed -i.tmp "s|const API_BASE_URL = '.*'|const API_BASE_URL = '$NEW_URL'|" frontend/src/utils/api-network.ts
    rm frontend/src/utils/api-network.ts.tmp 2>/dev/null || true
    
    echo "✅ Updated frontend/src/utils/api-network.ts"
fi

echo ""
echo "🧪 Testing connection to $NEW_URL..."

# Test the connection
if command -v curl >/dev/null 2>&1; then
    if curl -s --connect-timeout 5 "$NEW_URL/health" >/dev/null; then
        echo "✅ Connection test successful!"
    else
        echo "⚠️  Connection test failed - but URLs have been updated"
        echo "   Make sure the backend is running on $NEW_IP:8004"
    fi
else
    echo "ℹ️  Curl not available - cannot test connection"
fi

echo ""
echo "🎉 API URLs updated successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Restart the frontend development server:"
echo "   cd frontend && npm start"
echo ""
echo "2. Open your dating app and check if notifications work"
echo ""
echo "3. If it still doesn't work, try:"
echo "   • Make sure both laptops are on the same WiFi"
echo "   • Check if backend is running: python3 main_fixed.py"  
echo "   • Run the test file: open test_notifications.html"
echo ""
echo "💡 Backup files created with .backup extension if you need to revert"
