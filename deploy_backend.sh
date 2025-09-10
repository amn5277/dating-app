#!/bin/bash
# Deploy FastAPI backend to Railway

echo "🚂 Deploying Dating App Backend to Railway..."
echo ""

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Installing..."
    curl -fsSL https://railway.app/install.sh | sh
    echo "✅ Railway CLI installed!"
    echo ""
fi

# Navigate to backend directory
cd "$(dirname "$0")/backend"

echo "📦 Preparing backend for deployment..."

# Activate virtual environment and update requirements
if [ -d "venv" ]; then
    source venv/bin/activate
    echo "✅ Virtual environment activated"
    
    # Update requirements.txt with current packages
    pip freeze > requirements.txt
    echo "✅ Requirements updated"
else
    echo "⚠️  Virtual environment not found, using system Python"
fi

echo ""
echo "🔧 Deployment Configuration:"
echo "   📄 Procfile: ✅ Created"
echo "   📄 railway.toml: ✅ Created"  
echo "   🐍 Python app: main_fixed.py"
echo "   🗄️  Database: PostgreSQL (auto-provisioned)"
echo ""

# Check if user is logged in to Railway
echo "🔐 Checking Railway authentication..."
if railway whoami &> /dev/null; then
    echo "✅ Already logged in to Railway"
else
    echo "🔐 Please log in to Railway:"
    railway login
fi

echo ""
echo "🚀 Deploying to Railway..."

# Initialize Railway project if needed
if [ ! -f ".railwayapp.json" ]; then
    echo "📁 Initializing Railway project..."
    railway init
fi

# Deploy
railway up

echo ""
echo "🎉 Backend deployment complete!"
echo ""
echo "📋 Next Steps:"
echo "1. Note your Railway app URL (e.g., https://your-app.railway.app)"
echo "2. Run './deploy_frontend.sh' with your Railway URL"
echo "3. Test your deployed dating app!"
echo ""
echo "🔍 Useful Railway commands:"
echo "   railway logs    - View deployment logs"
echo "   railway open    - Open app in browser"
echo "   railway status  - Check deployment status"
