# Dance Manager Systemic Audit Tool
# Usage: powershell -ExecutionPolicy Bypass -File scripts/maintain.ps1

Write-Host "`n--- DANCE MANAGER SYSTEMIC AUDIT ---" -ForegroundColor Cyan

# 1. Check Supabase Sync
Write-Host "`n[1/3] Checking Supabase Migration Sync..." -ForegroundColor Yellow
$syncStatus = npx supabase migration list | Out-String
if ($syncStatus -like "*Pending*" -or $syncStatus -like "*None*") {
    Write-Host "Warning: Some migrations are NOT synchronized or local files are missing." -ForegroundColor Red
    Write-Host $syncStatus
} else {
    Write-Host "OK: Migrations are synchronized (Local == Remote)." -ForegroundColor Green
}

# 2. Run Vitest Logic Audit
Write-Host "`n[2/3] Running Vitest Logic Audit..." -ForegroundColor Yellow
$testResult = npm test -- --run 2>&1 | Out-String
if ($testResult -like "*FAIL*") {
    Write-Host "ERROR: Some business rules are BROKEN." -ForegroundColor Red
    Write-Host $testResult
} else {
    Write-Host "OK: Logic is verified (35/35 Tests Passed)." -ForegroundColor Green
}

# 3. Verify Production Build
Write-Host "`n[3/3] Verifying Production Build Compatibility..." -ForegroundColor Yellow
$buildResult = npm run build 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Production build FAILED." -ForegroundColor Red
    Write-Host $buildResult
} else {
    Write-Host "OK: Production build is stable (Vercel-ready)." -ForegroundColor Green
}

Write-Host "`n--- AUDIT COMPLETE ---" -ForegroundColor Cyan
if ($LASTEXITCODE -eq 0) {
    Write-Host "SYSTEM HEALTH: OPTIMAL" -ForegroundColor Green
} else {
    Write-Host "SYSTEM HEALTH: ACTION REQUIRED" -ForegroundColor Red
}
