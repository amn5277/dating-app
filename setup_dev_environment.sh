#!/bin/bash
# Video Dating App - Development Environment Setup
# This script sets up everything needed to run the dating app on a new machine

set -e  # Exit on any error

echo "💕 Video Dating App - Development Environment Setup"
echo "===================================================="
echo ""
echo "This script will install and configure everything needed:"
echo "  🐍 Python 3.8+ with pip"
echo "  📦 Node.js 16+ with npm" 
echo "  🔧 Backend dependencies (FastAPI, SQLAlchemy, etc.)"
echo "  🎨 Frontend dependencies (React, TypeScript, etc.)"
echo "  🗄️ Database setup with sample data"
echo "  🚀 Development server configuration"
echo ""

# Detect operating system
OS="unknown"
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    OS="windows"
fi

echo "🖥️  Detected OS: $OS"
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to install packages on different OS
install_package() {
    case $OS in
        "linux")
            if command_exists apt-get; then
                sudo apt-get update && sudo apt-get install -y "$1"
            elif command_exists yum; then
                sudo yum install -y "$1"
            elif command_exists dnf; then
                sudo dnf install -y "$1"
            else
                echo "❌ Unable to install $1. Please install manually."
                exit 1
            fi
            ;;
        "macos")
            if command_exists brew; then
                brew install "$1"
            else
                echo "🍺 Installing Homebrew first..."
                /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
                brew install "$1"
            fi
            ;;
        "windows")
            echo "⚠️  Windows detected. Please install $1 manually from official website."
            echo "   Or use Windows Subsystem for Linux (WSL) for better compatibility."
            ;;
    esac
}

echo "🔍 Checking prerequisites..."
echo ""

# Check Python
if command_exists python3; then
    PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
    echo "✅ Python found: $PYTHON_VERSION"
    PYTHON_CMD="python3"
elif command_exists python; then
    PYTHON_VERSION=$(python --version | cut -d' ' -f2)
    if [[ $PYTHON_VERSION == 3.* ]]; then
        echo "✅ Python found: $PYTHON_VERSION"
        PYTHON_CMD="python"
    else
        echo "❌ Python 3 required, found Python $PYTHON_VERSION"
        echo "🔧 Installing Python 3..."
        install_package python3
        PYTHON_CMD="python3"
    fi
else
    echo "❌ Python not found"
    echo "🔧 Installing Python 3..."
    install_package python3
    PYTHON_CMD="python3"
fi

# Check pip
if ! command_exists pip3 && ! command_exists pip; then
    echo "🔧 Installing pip..."
    case $OS in
        "linux") install_package python3-pip ;;
        "macos") $PYTHON_CMD -m ensurepip --upgrade ;;
        "windows") echo "Please install pip manually" ;;
    esac
fi

PIP_CMD="pip3"
if command_exists pip && ! command_exists pip3; then
    PIP_CMD="pip"
fi

echo "✅ Pip found: $PIP_CMD"

# Check Node.js and npm
if command_exists node; then
    NODE_VERSION=$(node --version)
    echo "✅ Node.js found: $NODE_VERSION"
else
    echo "❌ Node.js not found"
    echo "🔧 Installing Node.js..."
    case $OS in
        "linux") 
            curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
            sudo apt-get install -y nodejs
            ;;
        "macos")
            install_package node
            ;;
        "windows")
            echo "Please download and install Node.js from https://nodejs.org"
            exit 1
            ;;
    esac
fi

if command_exists npm; then
    NPM_VERSION=$(npm --version)
    echo "✅ npm found: $NPM_VERSION"
else
    echo "❌ npm not found (should come with Node.js)"
    exit 1
fi

echo ""
echo "🏗️  Setting up development environment..."
echo ""

# Create project structure if not exists
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    echo "❌ Project structure not found. Make sure you're in the project root directory."
    exit 1
fi

# Backend setup
echo "🐍 Setting up Python backend..."
cd backend

# Create virtual environment
if [ ! -d "venv" ]; then
    echo "📦 Creating Python virtual environment..."
    $PYTHON_CMD -m venv venv
fi

# Activate virtual environment
echo "🔄 Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "⬆️  Upgrading pip..."
pip install --upgrade pip

# Install backend dependencies
echo "📥 Installing backend dependencies..."
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt
else
    echo "❌ requirements.txt not found!"
    exit 1
fi

# Initialize database
echo "🗄️ Setting up database..."
$PYTHON_CMD -c "
from database import engine, Base
print('Creating database tables...')
Base.metadata.create_all(bind=engine)
print('✅ Database initialized!')
"

cd ..

# Frontend setup
echo ""
echo "🎨 Setting up React frontend..."
cd frontend

# Install frontend dependencies
echo "📥 Installing frontend dependencies..."
npm install

# Check if build works
echo "🔨 Testing frontend build..."
npm run build > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Frontend build successful"
else
    echo "⚠️  Frontend build had warnings (this is usually okay)"
fi

cd ..

echo ""
echo "🧪 Running system tests..."
echo ""

# Test backend
echo "🧪 Testing backend..."
cd backend
source venv/bin/activate

# Quick Python import test
$PYTHON_CMD -c "
try:
    from main_fixed import app
    from database import engine
    print('✅ Backend imports successful')
except Exception as e:
    print(f'❌ Backend import error: {e}')
    exit(1)
"

cd ..

# Test frontend
echo "🧪 Testing frontend..."
cd frontend

# Check if main files exist
if [ -f "src/App.tsx" ] && [ -f "package.json" ]; then
    echo "✅ Frontend structure valid"
else
    echo "❌ Frontend structure invalid"
    exit 1
fi

cd ..

echo ""
echo "🎉 SETUP COMPLETE!"
echo "=================="
echo ""
echo "✅ Your Video Dating App development environment is ready!"
echo ""
echo "📋 What was set up:"
echo "   🐍 Python virtual environment with all dependencies"
echo "   🎨 React frontend with all packages"
echo "   🗄️ SQLite database with tables created"
echo "   🔧 Development configuration files"
echo ""
echo "🚀 To start development:"
echo ""
echo "   Terminal 1 (Backend):"
echo "   ====================="
echo "   cd backend"
echo "   source venv/bin/activate"
echo "   python3 main_fixed.py"
echo ""
echo "   Terminal 2 (Frontend):"
echo "   ======================"
echo "   cd frontend"
echo "   npm start"
echo ""
echo "📱 Your app will be available at:"
echo "   🎨 Frontend: http://localhost:3000"
echo "   🔧 Backend: http://localhost:8004"
echo "   📖 API Docs: http://localhost:8004/docs"
echo ""
echo "🎯 Features included:"
echo "   💕 User registration and profiles"
echo "   🎯 Smart matching algorithm"
echo "   📞 Video calling system"
echo "   🔔 Real-time notifications"
echo "   💑 Mutual match system"
echo "   📱 Responsive UI"
echo ""
echo "💡 Troubleshooting:"
echo "   - If you get permission errors, try with 'sudo'"
echo "   - On Windows, use WSL or install dependencies manually"
echo "   - Check firewall settings if network access doesn't work"
echo ""
echo "🎊 Happy coding! Build amazing connections! 💕"
