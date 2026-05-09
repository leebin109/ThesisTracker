<#
.SYNOPSIS
    Inline 4 JSX files into terminal.html with IIFE wrappers.

.DESCRIPTION
    Reads tweaks-panel.jsx, terminal-components.jsx, terminal-data.jsx, terminal-app.jsx
    from the project root, wraps each in an IIFE inside a <script type="text/babel"> tag,
    and writes a fresh terminal.html. The order is fixed:

        tweaks-panel -> terminal-components -> terminal-data -> terminal-app

    Run this after editing any of the 4 JSX files. terminal.html should not be edited
    by hand because it gets overwritten on every build.

.EXAMPLE
    .\tools\build-terminal-html.ps1
#>

[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$out = Join-Path $projectRoot 'terminal.html'

$blocks = @(
    'tweaks-panel.jsx',
    'terminal-components.jsx',
    'terminal-data.jsx',
    'terminal-app.jsx'
)

# Verify all sources exist before doing any work
foreach ($name in $blocks) {
    $p = Join-Path $projectRoot $name
    if (-not (Test-Path $p)) { throw "Missing source: $p" }
}

$head = @'
<!doctype html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ThesisTrack Terminal</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      background: #07090b;
      color: #e5e7eb;
      font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
      font-feature-settings: 'liga' 0, 'calt' 0;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      min-height: 100vh;
    }
    #root { height: 100vh; display: flex; flex-direction: column; }
    ::selection { background: rgba(255, 149, 0, 0.35); color: #fff; }
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: #0d1116; }
    ::-webkit-scrollbar-thumb { background: #1f2937; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #374151; }
  </style>
  <script src="https://unpkg.com/react@18.3.1/umd/react.development.js" crossorigin="anonymous"></script>
  <script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js" crossorigin="anonymous"></script>
  <script src="https://unpkg.com/@babel/standalone@7.29.0/babel.min.js" crossorigin="anonymous"></script>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js" crossorigin="anonymous"></script>
</head>
<body>
  <div id="root">
    <div id="boot-fallback" style="min-height:100vh;background:#07090b;color:#e5e7eb;display:grid;place-items:center;padding:24px;font-family:'JetBrains Mono',ui-monospace,monospace;">
      <div style="width:min(720px,100%);border:1px solid #1f2937;background:#0d1116;padding:22px;">
        <div style="color:#FF9500;font-size:11px;letter-spacing:.14em;font-weight:800;margin-bottom:10px;">THESISTRACK BOOT</div>
        <div style="font-size:20px;font-weight:800;margin-bottom:8px;">앱을 불러오는 중입니다.</div>
        <div id="boot-fallback-msg" style="color:#9ca3af;font-size:12px;line-height:1.6;margin-bottom:14px;">
          화면이 계속 멈춰 있으면 React/Babel CDN 로딩 또는 저장된 로컬 데이터 문제일 수 있습니다.
        </div>
        <button onclick="try{localStorage.removeItem('tt-terminal-v1')}catch(e){} location.reload()" style="background:transparent;color:#ef4444;border:1px solid #ef4444;padding:8px 12px;font:11px 'JetBrains Mono',monospace;letter-spacing:.08em;cursor:pointer;">
          RESET LOCAL DATA
        </button>
      </div>
    </div>
  </div>
  <script>
    (function () {
      function showBootIssue(message) {
        var el = document.getElementById('boot-fallback');
        var msg = document.getElementById('boot-fallback-msg');
        if (!el || !msg) return;
        msg.textContent = message || '앱 로딩 중 오류가 발생했습니다.';
      }
      window.addEventListener('error', function (event) {
        showBootIssue(event && event.message ? event.message : '스크립트 로딩 중 오류가 발생했습니다.');
      });
      window.addEventListener('unhandledrejection', function (event) {
        var reason = event && event.reason;
        showBootIssue(reason && reason.message ? reason.message : '비동기 로딩 중 오류가 발생했습니다.');
      });
      setTimeout(function () {
        if (document.getElementById('boot-fallback')) {
          showBootIssue('React/Babel/CDN 로딩이 지연되고 있습니다. Ctrl+F5로 새로고침하거나, 계속 실패하면 RESET LOCAL DATA를 시도하세요.');
        }
      }, 8000);
    })();
  </script>
'@

$tail = @'
</body>
</html>
'@

$sb = [System.Text.StringBuilder]::new()
[void]$sb.AppendLine($head)

foreach ($name in $blocks) {
    $p = Join-Path $projectRoot $name
    $src = [System.IO.File]::ReadAllText($p)
    # Trim trailing whitespace but keep internal formatting
    $src = $src.TrimEnd("`r","`n"," ","`t")
    [void]$sb.AppendLine("  <script type=`"text/babel`" data-presets=`"react`" data-source=`"$name`">")
    [void]$sb.AppendLine('  (() => {')
    [void]$sb.AppendLine($src)
    [void]$sb.AppendLine('  })();')
    [void]$sb.AppendLine('  </script>')
}

[void]$sb.Append($tail)

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($out, $sb.ToString(), $utf8NoBom)

$bytes = (Get-Item $out).Length
$lines = ($sb.ToString() -split "`n").Count
Write-Host "Wrote $out ($bytes bytes, $lines lines)"
Write-Host "Inlined: $($blocks -join ', ')"
