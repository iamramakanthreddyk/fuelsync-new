# Clean Test Runner
# Stops all node processes and runs tests with fresh database

Write-Host "`n=== FuelSync Clean Test Runner ===" -ForegroundColor Cyan
Write-Host "Stopping all Node processes..." -ForegroundColor Yellow

# Stop all node processes
Get-Process | Where-Object {$_.ProcessName -like "*node*"} | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

Write-Host "Cleaning database files..." -ForegroundColor Yellow
Remove-Item "data\*.db*" -Force -ErrorAction SilentlyContinue

Write-Host "`nRunning tests...`n" -ForegroundColor Green

# Run the requested test
if ($args.Count -gt 0) {
    $testFile = $args[0]
    Write-Host "Running: $testFile" -ForegroundColor Cyan
    npx jest "tests/integration/$testFile" --verbose --detectOpenHandles
} else {
    Write-Host "Usage: .\run-tests-clean.ps1 <test-file>" -ForegroundColor Red
    Write-Host "Example: .\run-tests-clean.ps1 admin-journey.test.js" -ForegroundColor Yellow
}
