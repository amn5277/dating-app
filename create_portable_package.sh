#!/bin/bash
# Create portable development package for Video Dating App

echo "📦 Creating Portable Video Dating App Package"
echo "=============================================="
echo ""

# Get current directory name for the zip file
PROJECT_DIR=$(basename "$(pwd)")
ZIP_NAME="VideoDateApp-Portable-$(date +%Y%m%d-%H%M%S).zip"

echo "📁 Project: $PROJECT_DIR"
echo "💾 Package: $ZIP_NAME"
echo ""

# Create temporary directory for clean packaging
TEMP_DIR="/tmp/videodate-package-$$"
mkdir -p "$TEMP_DIR"

echo "🔄 Copying project files..."

# Copy all files except excluded ones
rsync -av \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='backend/venv' \
  --exclude='backend/__pycache__' \
  --exclude='backend/*.pyc' \
  --exclude='frontend/build' \
  --exclude='frontend/dist' \
  --exclude='backend/dating_app.db' \
  --exclude='*.log' \
  --exclude='.DS_Store' \
  --exclude='*.swp' \
  --exclude='*.swo' \
  --exclude='.env.local' \
  --exclude='.env.development.local' \
  --exclude='.env.test.local' \
  --exclude='.env.production.local' \
  --exclude='npm-debug.log*' \
  --exclude='yarn-debug.log*' \
  --exclude='yarn-error.log*' \
  . "$TEMP_DIR/$PROJECT_DIR/"

# Create README for the new developer
cat > "$TEMP_DIR/$PROJECT_DIR/README_SETUP.md" << 'EOF'
# 💕 Video Dating App - Portable Development Package

## 🚀 Quick Setup (5 minutes)

This package contains everything you need to run the Video Dating App on any machine!

### 1️⃣ **Extract and Setup**
```bash
# Extract the ZIP file
unzip VideoDateApp-Portable-*.zip
cd VideoDateApp-Portable-*

# Run the automated setup (installs all dependencies)
./setup_dev_environment.sh
```

### 2️⃣ **Start Development Servers**

**Terminal 1 - Backend (FastAPI):**
```bash
cd backend
source venv/bin/activate
python3 main_fixed.py
```

**Terminal 2 - Frontend (React):**
```bash
cd frontend  
npm start
```

### 3️⃣ **Open Your App**
- 🎨 **Frontend**: http://localhost:3000
- 🔧 **Backend**: http://localhost:8004
- 📖 **API Docs**: http://localhost:8004/docs

---

## 🎯 **What's Included**

### **Complete Dating App Features:**
- 👤 **User Registration & Login**
- 🎯 **Profile Creation** with interests
- 💕 **Smart Matching Algorithm** (prioritizes active users)
- 📞 **1-minute Video Calls** for initial matches
- 💑 **Swipe Interface** for decisions
- 🎉 **Mutual Match System**
- 🔄 **Unlimited Video Calls** for mutual matches
- 🔔 **Real-time Call Notifications**
- 📊 **Call History Tracking**
- 📱 **Beautiful Responsive UI**

### **Technical Stack:**
- 🔧 **Backend**: FastAPI, SQLAlchemy, WebRTC, JWT Auth
- 🎨 **Frontend**: React, TypeScript, Tailwind CSS, Zustand
- 🗄️ **Database**: SQLite (dev) / PostgreSQL (production)
- 📡 **Real-time**: WebSocket notifications
- 🎥 **Video**: WebRTC peer-to-peer calls

---

## 🛠️ **Development Commands**

### **Backend:**
```bash
cd backend
source venv/bin/activate

# Start development server
python3 main_fixed.py

# Install new dependencies
pip install package-name
pip freeze > requirements.txt
```

### **Frontend:**
```bash
cd frontend

# Start development server
npm start

# Install new dependencies  
npm install package-name

# Build for production
npm run build
```

---

## 🚀 **Deployment (Optional)**

Deploy your app to the internet with HTTPS and camera access:

```bash
# Deploy everything (backend + frontend)
./deploy_all.sh

# Or deploy separately:
./deploy_backend.sh    # Railway (PostgreSQL included)
./deploy_frontend.sh   # Vercel
```

---

## 🐛 **Troubleshooting**

### **Common Issues:**

**Python not found:**
```bash
# Install Python 3.8+
# macOS: brew install python3
# Ubuntu: sudo apt install python3 python3-pip
# Windows: Download from python.org
```

**Node.js not found:**
```bash
# Install Node.js 16+
# macOS: brew install node
# Ubuntu: curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt install nodejs
# Windows: Download from nodejs.org
```

**Port already in use:**
```bash
# Kill processes on ports 3000 or 8004
sudo lsof -ti:3000 | xargs kill -9
sudo lsof -ti:8004 | xargs kill -9
```

**Permission denied:**
```bash
chmod +x setup_dev_environment.sh
chmod +x deploy_*.sh
```

---

## 📱 **Testing Your App**

### **Multi-Device Testing:**
1. **Register 2+ users** on different devices
2. **Create profiles** with interests  
3. **Find matches** between users
4. **Test video calls** (need HTTPS for camera on network IPs)
5. **Create mutual matches** by both users liking each other
6. **Test unlimited calling** between mutual matches
7. **Test real-time notifications** across devices

### **Network Access:**
- **Frontend**: http://YOUR_IP:3000 (replace YOUR_IP)
- **Backend**: http://YOUR_IP:8004
- **Camera Access**: Requires HTTPS (deploy for full testing)

---

## 🎉 **You're All Set!**

Your Video Dating App development environment is ready to go!

**Happy coding and building amazing connections!** 💕

---

**Need help?** Check the deployment guides or search online for specific error messages.
EOF

# Create a simple run script for convenience
cat > "$TEMP_DIR/$PROJECT_DIR/quick_start.sh" << 'EOF'
#!/bin/bash
# Quick start script for Video Dating App

echo "🚀 Starting Video Dating App..."
echo ""
echo "This will open two terminal windows:"
echo "  1. Backend server (FastAPI)"
echo "  2. Frontend server (React)"
echo ""

# Check if setup was run
if [ ! -d "backend/venv" ]; then
    echo "⚠️  Setup not detected. Running setup first..."
    ./setup_dev_environment.sh
fi

# Function to start backend
start_backend() {
    echo "🔧 Starting backend server..."
    cd backend
    source venv/bin/activate
    python3 main_fixed.py
}

# Function to start frontend
start_frontend() {
    sleep 3  # Wait for backend to start
    echo "🎨 Starting frontend server..."
    cd frontend
    npm start
}

# Start backend in background
start_backend &
BACKEND_PID=$!

# Start frontend
start_frontend &
FRONTEND_PID=$!

echo ""
echo "✅ Both servers starting..."
echo ""
echo "📱 Your app will be available at:"
echo "   🎨 Frontend: http://localhost:3000"
echo "   🔧 Backend:  http://localhost:8004"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for user to stop
wait $BACKEND_PID $FRONTEND_PID
EOF

chmod +x "$TEMP_DIR/$PROJECT_DIR/quick_start.sh"

# Create the ZIP file
echo "🗜️  Creating ZIP package..."
cd "$TEMP_DIR"
zip -r "$ZIP_NAME" "$PROJECT_DIR" > /dev/null

# Move ZIP to original directory
mv "$ZIP_NAME" "$OLDPWD/"

# Cleanup
rm -rf "$TEMP_DIR"

# Get ZIP file size
ZIP_SIZE=$(du -h "$ZIP_NAME" | cut -f1)

echo ""
echo "🎉 Package created successfully!"
echo "================================="
echo ""
echo "📦 File: $ZIP_NAME"
echo "📏 Size: $ZIP_SIZE"
echo ""
echo "📋 What's included:"
echo "   ✅ Complete source code"
echo "   ✅ Automated setup script"
echo "   ✅ Development configuration"
echo "   ✅ Deployment scripts"
echo "   ✅ Documentation"
echo "   ✅ Quick start scripts"
echo ""
echo "📤 To transfer to another laptop:"
echo "   1. Copy $ZIP_NAME to the new machine"
echo "   2. Extract: unzip $ZIP_NAME"
echo "   3. Setup: ./setup_dev_environment.sh"
echo "   4. Start: ./quick_start.sh"
echo ""
echo "🚀 The new machine will have the complete Video Dating App"
echo "   development environment ready in minutes!"
EOF
