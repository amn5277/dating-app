#!/bin/bash
# Deploy React frontend to Vercel

echo "⚡ Deploying Dating App Frontend to Vercel..."
echo ""

# Check if backend URL is provided
if [ -z "$1" ]; then
    echo "❌ Backend URL required!"
    echo ""
    echo "Usage: $0 <backend-url>"
    echo "Example: $0 https://your-app.railway.app"
    echo ""
    echo "💡 Deploy your backend first with './deploy_backend.sh'"
    exit 1
fi

BACKEND_URL=$1

# Remove trailing slash if present
BACKEND_URL=${BACKEND_URL%/}

echo "🔗 Backend URL: $BACKEND_URL"
echo ""

# Navigate to frontend directory  
cd "$(dirname "$0")/frontend"

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm i -g vercel
    echo "✅ Vercel CLI installed!"
    echo ""
fi

# Create production environment file
echo "📝 Creating production configuration..."
cat > .env.production << EOF
REACT_APP_API_URL=$BACKEND_URL
EOF

echo "✅ Production environment configured"
echo "   📡 API URL: $BACKEND_URL"
echo ""

# Build the app
echo "🔨 Building React app for production..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
else
    echo "❌ Build failed! Please fix errors and try again."
    exit 1
fi

echo ""
echo "🚀 Deploying to Vercel..."

# Deploy to Vercel
vercel --prod

echo ""
echo "🎉 Frontend deployment complete!"
echo ""
echo "📋 Your Dating App URLs:"
echo "   🎨 Frontend: Check Vercel output above"
echo "   🔧 Backend API: $BACKEND_URL"
echo "   📖 API Docs: $BACKEND_URL/docs"
echo ""
echo "✅ Features now available:"
echo "   📹 Camera access (HTTPS enabled)"
echo "   🔔 Real-time call notifications"
echo "   💕 Mutual match video calls"
echo "   📱 Multi-device testing"
echo ""
echo "🔍 Useful Vercel commands:"
echo "   vercel logs     - View deployment logs"
echo "   vercel ls       - List deployments"
echo "   vercel inspect  - Deployment details"
