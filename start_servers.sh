#!/bin/bash

echo "🚀 Starting Video Dating App Servers..."

# Kill existing processes
echo "Stopping existing servers..."
pkill -f "python3.*main.py" 2>/dev/null
pkill -f "react-scripts" 2>/dev/null

# Wait a bit
sleep 2

echo "📱 Starting Frontend..."
cd frontend
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
BROWSER=none npm start > /dev/null 2>&1 &
FRONTEND_PID=$!
cd ..

echo "🖥️  Starting Backend..."
cd backend
source venv/bin/activate
python3 main.py > backend.log 2>&1 &
BACKEND_PID=$!
cd ..

echo ""
echo "✅ Servers started!"
echo "Frontend PID: $FRONTEND_PID"
echo "Backend PID: $BACKEND_PID"
echo ""
echo "🌐 Open your browser:"
echo "Frontend: http://localhost:3000"
echo "Backend API: http://localhost:8000/docs"
echo ""
echo "📋 To view logs:"
echo "Backend: tail -f backend/backend.log"
echo ""
echo "🛑 To stop servers:"
echo "kill $FRONTEND_PID $BACKEND_PID"
