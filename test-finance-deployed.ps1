#!/usr/bin/env pwsh
# Test script to verify finance API endpoints after Railway deployment

$BaseURL = "https://attractive-kindness-rbe-serveurs.up.railway.app"

Write-Host "🔍 Testing Finance API endpoints..." -ForegroundColor Cyan
Write-Host ""

# Test 1: Diagnostic endpoint
Write-Host "1️⃣ Testing /api/finance/diagnostic" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$BaseURL/api/finance/diagnostic" -Method GET -ErrorAction Stop
    $data = $response.Content | ConvertFrom-Json
    Write-Host "✅ Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "   Database: $($data.database)"
    Write-Host "   Fields: $($data.fields_available | ConvertTo-Json -Compress)"
    $diagnosticOK = $true
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    $diagnosticOK = $false
}

Write-Host ""

# Test 2: GET scheduled operations
Write-Host "2️⃣ Testing GET /api/finance/scheduled-operations" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$BaseURL/api/finance/scheduled-operations" -Method GET -ErrorAction Stop
    $data = $response.Content | ConvertFrom-Json
    Write-Host "✅ Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "   Operations count: $($data.operations.Count)"
    $getOK = $true
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    $getOK = $false
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  Diagnostic: $(if($diagnosticOK) { '✅ PASS' } else { '❌ FAIL' })" -ForegroundColor $(if($diagnosticOK) { 'Green' } else { 'Red' })
Write-Host "  GET Operations: $(if($getOK) { '✅ PASS' } else { '❌ FAIL' })" -ForegroundColor $(if($getOK) { 'Green' } else { 'Red' })
Write-Host ""
