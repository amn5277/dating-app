#!/bin/bash
# Complete deployment script for the Dating App

echo "🚀 Dating App - Complete Deployment Script"
echo "==========================================="
echo ""
echo "This script will deploy your entire dating app:"
echo "  📍 Backend (FastAPI) → Railway"
echo "  📍 Frontend (React) → Vercel" 
echo "  📍 Database → PostgreSQL (Railway)"
echo ""

read -p "🤔 Ready to deploy? (y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deployment cancelled"
    exit 1
fi

echo ""
echo "🎯 Starting deployment process..."
echo ""

# Step 1: Deploy Backend
echo "📋 Step 1/2: Deploying Backend to Railway"
echo "===========================================" 
./deploy_backend.sh

if [ $? -ne 0 ]; then
    echo "❌ Backend deployment failed!"
    exit 1
fi

echo ""
echo "⏸️  Backend deployed! Now we need your Railway URL..."
echo ""
echo "🔍 Please check the Railway output above for your app URL"
echo "   It should look like: https://your-app-name.railway.app"
echo ""

# Get backend URL from user
read -p "📝 Enter your Railway backend URL: " BACKEND_URL

if [ -z "$BACKEND_URL" ]; then
    echo "❌ Backend URL is required!"
    exit 1
fi

echo ""
echo "📋 Step 2/2: Deploying Frontend to Vercel"
echo "=========================================="
./deploy_frontend.sh "$BACKEND_URL"

if [ $? -ne 0 ]; then
    echo "❌ Frontend deployment failed!"
    exit 1
fi

echo ""
echo "🎉 DEPLOYMENT COMPLETE!"
echo "======================"
echo ""
echo "✅ Your Dating App is now LIVE on the internet!"
echo ""
echo "📱 What you can now do:"
echo "   📹 Test video calls with camera access"
echo "   🔔 Real-time call notifications across devices"
echo "   💕 Unlimited mutual match video calls"
echo "   🌐 Share with friends for multi-device testing"
echo ""
echo "🔧 Deployment Summary:"
echo "   📡 Backend API: $BACKEND_URL"
echo "   🎨 Frontend: Check Vercel output above"
echo "   📖 API Documentation: $BACKEND_URL/docs" 
echo "   💾 Database: PostgreSQL on Railway"
echo ""
echo "🎊 Happy dating app testing! 💕"
