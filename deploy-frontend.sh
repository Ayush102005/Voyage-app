#!/bin/bash
# Quick Deploy Script - Vercel Frontend

echo "🚀 Deploying Frontend to Vercel..."
echo ""

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "📦 Installing Vercel CLI..."
    npm install -g vercel
fi

cd frontend

echo "🔨 Building frontend..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    echo ""
    echo "🌐 Deploying to Vercel..."
    vercel --prod
else
    echo "❌ Build failed! Fix errors before deploying."
    exit 1
fi
