<#
.SYNOPSIS
    Fetch the OpenDART corpCode list and emit a JSON map for ThesisTrack F12 dartCorpMap.

.DESCRIPTION
    Downloads https://opendart.fss.or.kr/api/corpCode.xml using the user's OpenDART API key,
    extracts the XML, filters listed companies (stock_code is set), and writes a JSON map
    keyed by 6-digit stock code:

        { "005930": { "corpCode": "00126380", "corpName": "삼성전자" }, ... }

    Paste the contents of the output file into the F12 Settings/Data panel's "DART corp map"
    JSON editor, or save the file as `dart-corp-codes.json` next to terminal.html for future
    auto-load support (when running in http mode).

.PARAMETER ApiKey
    OpenDART API key (get one at https://opendart.fss.or.kr/).

.PARAMETER OutFile
    Output path. Default: project root ./dart-corp-codes.json relative to this script.

.EXAMPLE
    .\tools\fetch-dart-corp-codes.ps1 -ApiKey "your_open_dart_key"

.NOTES
    Requires PowerShell 5.1+ (Windows default). No external modules needed.
    The downloaded XML contains all OpenDART companies (~800K rows). After filtering to
    listed-only it is typically ~3K rows / ~150KB JSON.
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$ApiKey,

    [string]$OutFile
)

$ErrorActionPreference = 'Stop'

# Resolve default output path next to project root (one level up from tools/)
if (-not $OutFile) {
    $projectRoot = Split-Path -Parent $PSScriptRoot
    $OutFile = Join-Path $projectRoot 'dart-corp-codes.json'
}

$tmpZip = Join-Path ([System.IO.Path]::GetTempPath()) ('opendart-corpcode-' + [guid]::NewGuid().ToString('N') + '.zip')
$tmpDir = Join-Path ([System.IO.Path]::GetTempPath()) ('opendart-corpcode-' + [guid]::NewGuid().ToString('N'))

try {
    $url = "https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=$ApiKey"
    Write-Host "[1/4] Downloading $url"
    Invoke-WebRequest -Uri $url -OutFile $tmpZip -UseBasicParsing

    # OpenDART returns JSON on auth failure, zip on success. Detect by reading first bytes.
    $head = [System.IO.File]::ReadAllBytes($tmpZip) | Select-Object -First 4
    $isZip = ($head.Count -ge 2 -and $head[0] -eq 0x50 -and $head[1] -eq 0x4B)
    if (-not $isZip) {
        $msg = [System.IO.File]::ReadAllText($tmpZip)
        throw "OpenDART did not return a zip. Response: $msg"
    }

    Write-Host "[2/4] Extracting"
    New-Item -ItemType Directory -Path $tmpDir | Out-Null
    Expand-Archive -Path $tmpZip -DestinationPath $tmpDir -Force

    $xmlPath = Get-ChildItem -Path $tmpDir -Filter '*.xml' | Select-Object -First 1 -ExpandProperty FullName
    if (-not $xmlPath) { throw "No XML found inside zip at $tmpDir" }

    Write-Host "[3/4] Parsing XML and filtering listed companies"
    [xml]$xml = Get-Content -Path $xmlPath -Encoding UTF8
    $listed = @{}
    $total = 0
    foreach ($node in $xml.result.list) {
        $total++
        $stock = ($node.stock_code | Out-String).Trim()
        if (-not $stock) { continue }
        # Pad to 6 digits to be safe (some entries may already be padded)
        $stock6 = $stock.PadLeft(6, '0')
        $listed[$stock6] = [ordered]@{
            corpCode = ($node.corp_code | Out-String).Trim()
            corpName = ($node.corp_name | Out-String).Trim()
        }
    }
    Write-Host "       Total companies: $total, listed kept: $($listed.Count)"

    Write-Host "[4/4] Writing $OutFile"
    # Sort keys for deterministic output
    $sorted = [ordered]@{}
    foreach ($k in ($listed.Keys | Sort-Object)) { $sorted[$k] = $listed[$k] }
    $json = $sorted | ConvertTo-Json -Depth 4

    # Write UTF-8 without BOM for safest cross-tool compatibility
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($OutFile, $json, $utf8NoBom)

    Write-Host ""
    Write-Host "Done. $($listed.Count) entries -> $OutFile"
    Write-Host "Next step: run start.bat/start.sh and reload http://localhost:8080/terminal.html."
    Write-Host "The app auto-loads dart-corp-codes.json in local HTTP mode. F12 still allows manual paste/edit."
}
finally {
    if (Test-Path $tmpZip) { Remove-Item $tmpZip -Force -ErrorAction SilentlyContinue }
    if (Test-Path $tmpDir) { Remove-Item $tmpDir -Recurse -Force -ErrorAction SilentlyContinue }
}
