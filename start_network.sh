#!/bin/bash

echo "🌐 Starting VideoDate for Network Access"
echo "========================================"

# Function to get local IP
get_local_ip() {
    # Try different methods to get local IP
    local ip=""
    
    # Method 1: Try route to 8.8.8.8
    if command -v ip &> /dev/null; then
        ip=$(ip route get 8.8.8.8 2>/dev/null | grep -oP 'src \K[^ ]+' | head -1)
    fi
    
    # Method 2: Try ifconfig (Mac/Linux)
    if [ -z "$ip" ] && command -v ifconfig &> /dev/null; then
        ip=$(ifconfig | grep "inet " | grep -v "127.0.0.1" | awk '{print $2}' | head -1 | cut -d: -f2)
    fi
    
    # Method 3: Try hostname (fallback)
    if [ -z "$ip" ]; then
        ip=$(hostname -I 2>/dev/null | awk '{print $1}')
    fi
    
    echo "$ip"
}

LOCAL_IP=$(get_local_ip)

if [ -z "$LOCAL_IP" ]; then
    echo "❌ Could not determine local IP address"
    echo "Please find your IP manually with 'ifconfig' or 'ipconfig'"
    exit 1
fi

echo "🔍 Detected Network IP: $LOCAL_IP"
echo ""

# Kill existing processes on ports
echo "🧹 Cleaning up existing processes..."
pkill -f "python3.*main_fixed.py" 2>/dev/null || true
pkill -f "react-scripts" 2>/dev/null || true
sleep 2

echo "🖥️  Starting Backend Server..."
cd backend
source venv/bin/activate
python3 main_fixed.py > ../backend.log 2>&1 &
BACKEND_PID=$!
cd ..

echo "⏳ Waiting for backend to start..."
sleep 5

echo "📱 Starting Frontend Server..."
cd frontend
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
npm start > ../frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

echo "⏳ Waiting for frontend to start..."
sleep 8

echo ""
echo "🎉 VideoDate is now running on your network!"
echo "==========================================="
echo ""
echo "📍 Backend API:"
echo "   🔗 Local:   http://localhost:8004"
echo "   🌐 Network: http://$LOCAL_IP:8004"
echo "   📖 Docs:    http://$LOCAL_IP:8004/docs"
echo ""
echo "📍 Frontend App:"
echo "   🔗 Local:   http://localhost:3000"
echo "   🌐 Network: http://$LOCAL_IP:3000"
echo ""
echo "⚙️  Current API Configuration:"
echo "   📡 Backend URL: http://10.100.1.151:8004"
echo ""
echo "💡 Access from any device on your WiFi network using:"
echo "   📱 Frontend: http://$LOCAL_IP:3000"
echo "   🔧 API:      http://10.100.1.151:8004"
echo ""
echo "⚠️  WebSocket Note:"
echo "   If you see WebSocket connection errors in browser console,"
echo "   this is normal for network access and won't affect the app functionality."
echo "   The errors are from React's hot-reload feature trying to connect to localhost."
echo ""
echo "📋 Process IDs:"
echo "   Backend:  $BACKEND_PID"
echo "   Frontend: $FRONTEND_PID"
echo ""
echo "📄 Logs:"
echo "   Backend:  tail -f backend.log"
echo "   Frontend: tail -f frontend.log"
echo ""
echo "🛑 To stop servers:"
echo "   kill $BACKEND_PID $FRONTEND_PID"
echo ""
echo "✨ Enjoy your network-accessible video dating app!"
