# DeskLoom Release Script
# Usage: .\scripts\release.ps1 -Version "0.6.1" -Notes "Your release notes"

param(
    [Parameter(Mandatory=$true)]
    [string]$Version,

    [Parameter(Mandatory=$true)]
    [string]$Notes,

    [string]$PrivateKeyPath = "./deskloom.key",
    [string]$PrivateKeyPassword = $(Read-Host "Enter signing key password" -AsSecureString)
)

# Convert secure string password to plain text
$ptr = [System.Runtime.InteropServices.Marshal]::SecureStringToCoTaskMemUnicode($PrivateKeyPassword)
$password = [System.Runtime.InteropServices.Marshal]::PtrToStringUni($ptr)

Write-Host "🔨 DeskLoom Release: $Version" -ForegroundColor Cyan

# 1. Build with signing
Write-Host "`n1️⃣  Building with signing..." -ForegroundColor Yellow
$env:TAURI_SIGNING_PRIVATE_KEY_PATH = $PrivateKeyPath
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = $password

pnpm tauri build 2>&1 | Select-String -Pattern "Finished|Error" -Context 1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed" -ForegroundColor Red
    exit 1
}

# 2. Sign executable
$exePath = "src-tauri\target\release\bundle\nsis\DeskLoom_${Version}_x64-setup.exe"
$sigPath = "$exePath.sig"

Write-Host "`n2️⃣  Signing executable..." -ForegroundColor Yellow
$signOutput = pnpm tauri signer sign "$exePath" 2>&1
if (-not (Test-Path $sigPath)) {
    Write-Host "❌ Signing failed" -ForegroundColor Red
    exit 1
}

# Extract signature from output
$signatureMatch = $signOutput -match 'Public signature: (.+)'
if ($signatureMatch) {
    $signature = $Matches[1]
} else {
    Write-Host "❌ Could not extract signature" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Signed: $sigPath" -ForegroundColor Green

# 3. Create latest.json
Write-Host "`n3️⃣  Creating latest.json..." -ForegroundColor Yellow

$latestJson = @{
    version = "v$Version"
    notes = $Notes
    pub_date = [DateTime]::UtcNow.ToString("O")
    platforms = @{
        "windows-x86_64" = @{
            signature = $signature
            url = "https://github.com/suptaass/deskloom/releases/download/v$Version/DeskLoom_${Version}_x64-setup.exe"
        }
    }
} | ConvertTo-Json -Depth 5

$latestJson | Out-File -FilePath "latest.json" -Encoding UTF8 -NoNewline
Write-Host "✓ Created: latest.json" -ForegroundColor Green

# 4. Create GitHub Release (manual)
Write-Host "`n4️⃣  Next: Create GitHub Release" -ForegroundColor Yellow
Write-Host @"
Upload these files to GitHub:
  https://github.com/suptaass/deskloom/releases/new?tag=v$Version

Files:
  ✓ $exePath
  ✓ $sigPath
  ✓ latest.json

Release Title: v$Version
Release Notes: $Notes

Then publish!
"@ -ForegroundColor Cyan

Write-Host "`n✅ Release ready!" -ForegroundColor Green
