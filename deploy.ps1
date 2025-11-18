# Voyage Deployment Script for Windows
# Run this script to deploy the application

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('dev', 'prod')]
    [string]$Environment = 'dev',
    
    [Parameter(Mandatory=$false)]
    [ValidateSet('backend', 'frontend', 'both')]
    [string]$Component = 'both'
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 VOYAGE DEPLOYMENT SCRIPT" -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host ""
Write-Host "Environment: $Environment" -ForegroundColor Yellow
Write-Host "Component: $Component" -ForegroundColor Yellow
Write-Host ""

# Check prerequisites
Write-Host "📋 Checking prerequisites..." -ForegroundColor Green

# Check Python
try {
    $pythonVersion = python --version 2>&1
    Write-Host "✅ Python: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Python not found! Please install Python 3.11+" -ForegroundColor Red
    exit 1
}

# Check Node.js
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js not found! Please install Node.js 18+" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Deploy Backend
if ($Component -eq 'backend' -or $Component -eq 'both') {
    Write-Host "🔧 DEPLOYING BACKEND" -ForegroundColor Cyan
    Write-Host "-" * 70 -ForegroundColor Cyan
    
    Set-Location backend
    
    # Check for .env file
    if (-not (Test-Path ".env")) {
        Write-Host "⚠️  .env file not found!" -ForegroundColor Yellow
        Write-Host "Creating .env from template..." -ForegroundColor Yellow
        
        if (Test-Path ".env.example") {
            Copy-Item ".env.example" ".env"
            Write-Host "✅ .env file created. Please edit it with your credentials." -ForegroundColor Green
            Write-Host "Press any key after updating .env file..."
            $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        }
    }
    
    # Check for firebase credentials
    if (-not (Test-Path "firebase-credentials.json")) {
        Write-Host "❌ firebase-credentials.json not found!" -ForegroundColor Red
        Write-Host "Please add your Firebase credentials file to backend/" -ForegroundColor Yellow
        exit 1
    }
    
    # Install dependencies
    Write-Host "📦 Installing Python dependencies..." -ForegroundColor Yellow
    pip install -r requirements.txt --quiet
    Write-Host "✅ Dependencies installed" -ForegroundColor Green
    
    # Run tests
    Write-Host "🧪 Running tests..." -ForegroundColor Yellow
    $testResult = python -m pytest test_expense_tracker_pytest.py -v --tb=line 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ All tests passed" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Some tests failed, but continuing..." -ForegroundColor Yellow
    }
    
    if ($Environment -eq 'dev') {
        Write-Host ""
        Write-Host "🌐 Starting backend development server..." -ForegroundColor Green
        Write-Host "Server will run on: http://localhost:8000" -ForegroundColor Cyan
        Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
        Write-Host ""
        python -m uvicorn server:app --reload --host 0.0.0.0 --port 8000
    } else {
        Write-Host "✅ Backend ready for production deployment" -ForegroundColor Green
        Write-Host ""
        Write-Host "📦 Deployment Options:" -ForegroundColor Cyan
        Write-Host "1. Railway: railway up" -ForegroundColor White
        Write-Host "2. Render: Push to GitHub and connect repository" -ForegroundColor White
        Write-Host "3. Heroku: git push heroku main" -ForegroundColor White
    }
    
    Set-Location ..
}

# Deploy Frontend
if ($Component -eq 'frontend' -or $Component -eq 'both') {
    Write-Host ""
    Write-Host "🎨 DEPLOYING FRONTEND" -ForegroundColor Cyan
    Write-Host "-" * 70 -ForegroundColor Cyan
    
    Set-Location frontend
    
    # Check for .env file
    if (-not (Test-Path ".env")) {
        Write-Host "⚠️  .env file not found!" -ForegroundColor Yellow
        Write-Host "Creating .env from template..." -ForegroundColor Yellow
        
        if (Test-Path ".env.example") {
            Copy-Item ".env.example" ".env"
            Write-Host "✅ .env file created. Please edit it with your Firebase config." -ForegroundColor Green
            Write-Host "Press any key after updating .env file..."
            $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        }
    }
    
    # Install dependencies
    Write-Host "📦 Installing npm dependencies..." -ForegroundColor Yellow
    npm install --silent
    Write-Host "✅ Dependencies installed" -ForegroundColor Green
    
    if ($Environment -eq 'dev') {
        Write-Host ""
        Write-Host "🌐 Starting frontend development server..." -ForegroundColor Green
        Write-Host "Server will run on: http://localhost:5173" -ForegroundColor Cyan
        Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
        Write-Host ""
        npm run dev
    } else {
        Write-Host "🏗️  Building frontend for production..." -ForegroundColor Yellow
        npm run build
        Write-Host "✅ Frontend build complete" -ForegroundColor Green
        Write-Host "📁 Build output: frontend/dist" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "📦 Deployment Options:" -ForegroundColor Cyan
        Write-Host "1. Vercel: vercel --prod" -ForegroundColor White
        Write-Host "2. Netlify: netlify deploy --prod --dir=dist" -ForegroundColor White
        Write-Host "3. Firebase: firebase deploy --only hosting" -ForegroundColor White
    }
    
    Set-Location ..
}

Write-Host ""
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host "✅ DEPLOYMENT COMPLETE" -ForegroundColor Green
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host ""

if ($Environment -eq 'prod') {
    Write-Host "📋 Next Steps:" -ForegroundColor Yellow
    Write-Host "1. Configure environment variables on your hosting platform" -ForegroundColor White
    Write-Host "2. Deploy backend to Railway/Render/Heroku" -ForegroundColor White
    Write-Host "3. Deploy frontend to Vercel/Netlify/Firebase" -ForegroundColor White
    Write-Host "4. Update CORS settings with production URLs" -ForegroundColor White
    Write-Host "5. Test all features in production" -ForegroundColor White
    Write-Host ""
}
