# Test Production Build Locally
# Run this before deploying to catch any build errors

Write-Host "🧪 Testing Production Build..." -ForegroundColor Cyan
Write-Host ""

# Test Frontend Build
Write-Host "📦 Building Frontend..." -ForegroundColor Yellow
cd frontend

if (Test-Path "dist") {
    Remove-Item -Recurse -Force dist
}

npm run build

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Frontend build successful!" -ForegroundColor Green
    Write-Host "   Output: frontend/dist/" -ForegroundColor Gray
} else {
    Write-Host "❌ Frontend build failed!" -ForegroundColor Red
    Write-Host "   Fix the errors above before deploying" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🔍 Frontend build size:" -ForegroundColor Yellow
$distSize = (Get-ChildItem -Path "dist" -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
Write-Host "   Total: $([math]::Round($distSize, 2)) MB" -ForegroundColor Gray

Write-Host ""
Write-Host "🚀 Testing production preview..." -ForegroundColor Yellow
Write-Host "   Opening preview at http://localhost:4173" -ForegroundColor Gray
Write-Host "   Press Ctrl+C to stop the preview" -ForegroundColor Gray
Write-Host ""

npm run preview
