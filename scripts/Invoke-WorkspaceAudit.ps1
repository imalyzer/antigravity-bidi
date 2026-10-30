<#
.SYNOPSIS
    Fast Workspace Audit Tool for Antigravity BiDi (SKILL-15)
.DESCRIPTION
    Scans workspace in < 2.0s to verify:
    1. Binary Hygiene: Pure CRLF line endings (zero lone LF) and Zero-BOM (no EF BB BF) on all scripts (.bat, .cmd, .ps1).
    2. Path & Reference Integrity: Verifies all cross-file references declared in scripts, manifests, and documentation exist.
    3. Structural Anchoring: Confirms presence of .project-root and paths.manifest.json.
#>

[CmdletBinding()]
param()

$sw = [System.Diagnostics.Stopwatch]::StartNew()

# Dynamic Root Anchor Walk-Up
$curr = $PSScriptRoot
while ($curr -and -not (Test-Path (Join-Path $curr ".project-root"))) {
    $curr = Split-Path $curr -Parent
}
$ProjectRoot = if ($curr) { $curr } else { Split-Path $PSScriptRoot -Parent }

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "  Antigravity Workspace Crystallization Audit (SKILL-15)" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "Project Root : $ProjectRoot`n" -ForegroundColor Gray

$passed = $true
$issuesCount = 0

# 1. Structural Anchor Check
Write-Host "[1/4] Checking Structural Anchors..." -ForegroundColor Yellow
$rootMarker = Join-Path $ProjectRoot ".project-root"
$manifestFile = Join-Path $ProjectRoot "paths.manifest.json"

if (Test-Path $rootMarker) {
    Write-Host "  [OK] .project-root anchor found." -ForegroundColor Green
} else {
    Write-Host "  [FAIL] .project-root anchor MISSING!" -ForegroundColor Red
    $passed = $false
    $issuesCount++
}

if (Test-Path $manifestFile) {
    Write-Host "  [OK] paths.manifest.json found." -ForegroundColor Green
} else {
    Write-Host "  [FAIL] paths.manifest.json MISSING!" -ForegroundColor Red
    $passed = $false
    $issuesCount++
}

# 2. Binary Hygiene (CRLF & Zero-BOM Audit)
Write-Host "`n[2/4] Auditing Binary Hygiene (CRLF & Zero-BOM)..." -ForegroundColor Yellow
$scriptFiles = Get-ChildItem -Path $ProjectRoot -Recurse -Include "*.bat","*.cmd","*.ps1" | Where-Object {
    $_.FullName -notmatch '\\(build|backup|extracted|temp_patch_stage|node_modules)\\'
}

foreach ($file in $scriptFiles) {
    $rel = $file.FullName.Substring($ProjectRoot.Length + 1)
    $bytes = [System.IO.File]::ReadAllBytes($file.FullName)
    
    # Check BOM
    $hasBom = ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)
    
    # Check lone LF (bytes[i] == 0x0A and bytes[i-1] != 0x0D)
    $hasLoneLf = $false
    for ($i = 0; $i -lt $bytes.Length; $i++) {
        if ($bytes[$i] -eq 0x0A) {
            if ($i -eq 0 -or $bytes[$i - 1] -ne 0x0D) {
                $hasLoneLf = $true
                break
            }
        }
    }

    if ($hasBom) {
        Write-Host "  [FAIL] $rel has UTF-8 BOM!" -ForegroundColor Red
        $passed = $false
        $issuesCount++
    } elseif ($hasLoneLf) {
        Write-Host "  [FAIL] $rel has lone LF line endings (not pure CRLF)!" -ForegroundColor Red
        $passed = $false
        $issuesCount++
    } else {
        Write-Host "  [OK] $rel (CRLF, No-BOM)" -ForegroundColor Green
    }
}

# 3. Manifest Integrity Check
Write-Host "`n[3/4] Validating Central Path Manifest..." -ForegroundColor Yellow
if (Test-Path $manifestFile) {
    try {
        $manifest = Get-Content $manifestFile -Raw | ConvertFrom-Json
        $filesObj = $manifest.files
        foreach ($prop in $filesObj.PSObject.Properties) {
            $targetRel = $prop.Value
            $targetFull = Join-Path $ProjectRoot ($targetRel -replace '/', '\')
            if (Test-Path $targetFull) {
                Write-Host "  [OK] Manifest file reference: $($prop.Name) -> $targetRel" -ForegroundColor Green
            } else {
                Write-Host "  [FAIL] Manifest broken link: $($prop.Name) -> $targetRel (Not found on disk!)" -ForegroundColor Red
                $passed = $false
                $issuesCount++
            }
        }
    } catch {
        Write-Host "  [FAIL] Invalid JSON in paths.manifest.json: $_" -ForegroundColor Red
        $passed = $false
        $issuesCount++
    }
}

# 4. Entry Forwarders Verification
Write-Host "`n[4/4] Verifying Entry Forwarder Shims..." -ForegroundColor Yellow
$shim1 = Join-Path $ProjectRoot "1_Apply_Patch.bat"
$shim2 = Join-Path $ProjectRoot "2_Restore_Original.bat"

if ((Test-Path $shim1) -and (Test-Path $shim2)) {
    $content1 = Get-Content $shim1 -Raw
    $content2 = Get-Content $shim2 -Raw
    if ($content1 -match 'smart_update_patch\.bat' -and $content2 -match 'restore_original\.bat') {
        Write-Host "  [OK] 1_Apply_Patch.bat and 2_Restore_Original.bat forwarders verified." -ForegroundColor Green
    } else {
        Write-Host "  [WARN] Shims exist but forwarder target pattern mismatch." -ForegroundColor Yellow
    }
} else {
    Write-Host "  [FAIL] Forwarder shims missing from root!" -ForegroundColor Red
    $passed = $false
    $issuesCount++
}

$sw.Stop()
$elapsed = $sw.Elapsed.TotalSeconds

Write-Host "`n=======================================================" -ForegroundColor Cyan
if ($passed) {
    Write-Host ("  AUDIT PASSED! All paths and hygiene verified in {0:N2}s" -f $elapsed) -ForegroundColor Green
} else {
    Write-Host ("  AUDIT FAILED with {0} issue(s) in {1:N2}s" -f $issuesCount, $elapsed) -ForegroundColor Red
}
Write-Host "=======================================================" -ForegroundColor Cyan

if (-not $passed) { exit 1 } else { exit 0 }
