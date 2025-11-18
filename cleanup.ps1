# Project Cleanup Script for Deployment
# Removes test files, demo files, and temporary files

Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "CLEANING PROJECT FOR DEPLOYMENT" -ForegroundColor Green
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""

$totalFilesDeleted = 0
$totalSpaceSaved = 0

# Function to delete files
function Remove-Files {
    param(
        [string]$Pattern,
        [string]$Description
    )
    
    Write-Host "$Description..." -ForegroundColor Yellow
    $files = Get-ChildItem -Path . -Recurse -Filter $Pattern -ErrorAction SilentlyContinue
    
    if ($files) {
        foreach ($file in $files) {
            $size = $file.Length
            $sizeKB = [math]::Round($size/1024, 2)
            Write-Host "   Deleting: $($file.Name) ($sizeKB KB)" -ForegroundColor Red
            Remove-Item $file.FullName -Force
            $script:totalFilesDeleted++
            $script:totalSpaceSaved += $size
        }
    } else {
        Write-Host "   No files found" -ForegroundColor Gray
    }
}

# Function to delete specific files
function Remove-SpecificFiles {
    param(
        [string[]]$FileNames,
        [string]$Description
    )
    
    Write-Host "$Description..." -ForegroundColor Yellow
    foreach ($fileName in $FileNames) {
        $files = Get-ChildItem -Path . -Recurse -Filter $fileName -ErrorAction SilentlyContinue
        foreach ($file in $files) {
            $size = $file.Length
            $sizeKB = [math]::Round($size/1024, 2)
            Write-Host "   Deleting: $($file.FullName) ($sizeKB KB)" -ForegroundColor Red
            Remove-Item $file.FullName -Force
            $script:totalFilesDeleted++
            $script:totalSpaceSaved += $size
        }
    }
}

Write-Host ""
Write-Host "REMOVING TEST FILES" -ForegroundColor Cyan
Write-Host "--------------------------------------------------------------------------------"

# Remove all test files
Remove-Files "test_*.py" "Test Scripts"

Write-Host ""
Write-Host "REMOVING DEMO FILES" -ForegroundColor Cyan
Write-Host "--------------------------------------------------------------------------------"

# Remove demo files
Remove-Files "demo_*.py" "Demo Scripts"

Write-Host ""
Write-Host "REMOVING TEMPORARY FILES" -ForegroundColor Cyan
Write-Host "--------------------------------------------------------------------------------"

# Remove temp files
Remove-Files "temp_*.txt" "Temporary Text Files"
Remove-Files "*.bak" "Backup Files"
Remove-Files "*.tmp" "Temp Files"

Write-Host ""
Write-Host "REMOVING UTILITY SCRIPTS" -ForegroundColor Cyan
Write-Host "--------------------------------------------------------------------------------"

# Remove utility/debug scripts
Remove-SpecificFiles @(
    "remove_duplicate_routes.py",
    "remove_old_dashboard.py",
    "count_triple_quotes.py",
    "find_unclosed_string.py",
    "find_unclosed_triple.py",
    "inspect_triple_quotes.py",
    "check_models.py",
    "collapse_duplicates.py"
) "Utility and Debug Scripts"

Write-Host ""
Write-Host "REMOVING __pycache__ DIRECTORIES" -ForegroundColor Cyan
Write-Host "--------------------------------------------------------------------------------"

$pycacheDirs = Get-ChildItem -Path . -Recurse -Directory -Filter "__pycache__" -ErrorAction SilentlyContinue
if ($pycacheDirs) {
    foreach ($dir in $pycacheDirs) {
        $size = (Get-ChildItem $dir.FullName -Recurse | Measure-Object -Property Length -Sum).Sum
        $sizeMB = [math]::Round($size/1MB, 2)
        Write-Host "   Deleting: $($dir.FullName) ($sizeMB MB)" -ForegroundColor Red
        Remove-Item $dir.FullName -Recurse -Force
        $totalFilesDeleted++
        $totalSpaceSaved += $size
    }
} else {
    Write-Host "   No __pycache__ directories found" -ForegroundColor Gray
}

Write-Host ""
Write-Host "CLEANING .pyc FILES" -ForegroundColor Cyan
Write-Host "--------------------------------------------------------------------------------"

$pycFiles = Get-ChildItem -Path . -Recurse -Filter "*.pyc" -ErrorAction SilentlyContinue
if ($pycFiles) {
    foreach ($file in $pycFiles) {
        $size = $file.Length
        Write-Host "   Deleting: $($file.FullName)" -ForegroundColor Red
        Remove-Item $file.FullName -Force
        $totalFilesDeleted++
        $totalSpaceSaved += $size
    }
} else {
    Write-Host "   No .pyc files found" -ForegroundColor Gray
}

Write-Host ""
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "CLEANUP SUMMARY" -ForegroundColor Green
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""
$savedMB = [math]::Round($totalSpaceSaved/1MB, 2)
Write-Host "   Files Deleted: $totalFilesDeleted" -ForegroundColor Yellow
Write-Host "   Space Saved: $savedMB MB" -ForegroundColor Yellow
Write-Host ""
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "CLEANUP COMPLETE!" -ForegroundColor Green
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Your project is now ready for deployment!" -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "   1. Review remaining files" -ForegroundColor White
Write-Host "   2. Commit changes: git add . && git commit -m 'Clean project for deployment'" -ForegroundColor White
Write-Host "   3. Push to GitHub: git push origin main" -ForegroundColor White
Write-Host "   4. Deploy using: .\deploy.ps1 -Environment prod" -ForegroundColor White
Write-Host ""
