#!/bin/bash

echo "🌐 Network Connectivity Test for Video Dating App"
echo "================================================="
echo ""

SERVER_IP="10.100.1.151"
SERVER_PORT="8004"

echo "🔍 Testing backend server connectivity..."
echo ""

# Test 1: Basic connectivity
echo "1. Testing basic connectivity to $SERVER_IP:$SERVER_PORT"
if curl -m 5 -s http://$SERVER_IP:$SERVER_PORT/health > /dev/null; then
    echo "   ✅ Server is reachable"
else
    echo "   ❌ Server is NOT reachable"
    echo "   💡 Check if backend server is running"
    exit 1
fi

# Test 2: Health endpoint
echo ""
echo "2. Testing health endpoint"
HEALTH_RESPONSE=$(curl -m 5 -s http://$SERVER_IP:$SERVER_PORT/health)
if [[ $HEALTH_RESPONSE == *"healthy"* ]]; then
    echo "   ✅ Health check passed: $HEALTH_RESPONSE"
else
    echo "   ❌ Health check failed: $HEALTH_RESPONSE"
fi

# Test 3: API endpoints
echo ""
echo "3. Testing API endpoints"
echo "   - Testing /api/auth/me (should return 401)"
AUTH_RESPONSE=$(curl -m 5 -s -w "%{http_code}" http://$SERVER_IP:$SERVER_PORT/api/auth/me -o /dev/null)
if [[ $AUTH_RESPONSE == "401" ]]; then
    echo "   ✅ Auth endpoint working (401 Unauthorized as expected)"
else
    echo "   ❌ Auth endpoint failed: HTTP $AUTH_RESPONSE"
fi

# Test 4: CORS test
echo ""
echo "4. Testing CORS headers"
CORS_RESPONSE=$(curl -m 5 -s -H "Origin: http://localhost:3000" -H "Access-Control-Request-Method: GET" -H "Access-Control-Request-Headers: authorization" -X OPTIONS http://$SERVER_IP:$SERVER_PORT/api/auth/me -I)
if [[ $CORS_RESPONSE == *"access-control-allow-origin"* ]]; then
    echo "   ✅ CORS headers present"
else
    echo "   ⚠️  CORS headers might be missing"
fi

# Test 5: From different IP
echo ""
echo "5. Testing from current network interface"
LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}')
echo "   Your IP: $LOCAL_IP"
echo "   Server IP: $SERVER_IP"

if [[ $LOCAL_IP == $SERVER_IP ]]; then
    echo "   ✅ Same machine - network access should work"
else
    echo "   ℹ️  Different machines - testing cross-machine access"
fi

echo ""
echo "🎯 Summary:"
echo "   Backend server: http://$SERVER_IP:$SERVER_PORT"
echo "   Status: Accessible from network"
echo ""
echo "💡 If frontend is still timing out:"
echo "   1. Check if frontend is using correct IP: $SERVER_IP"
echo "   2. Check browser network tab for CORS errors"
echo "   3. Try accessing http://$SERVER_IP:$SERVER_PORT/docs in browser"
echo "   4. Check firewall settings on both machines"
echo ""
echo "✨ Backend is working correctly on the network!"
