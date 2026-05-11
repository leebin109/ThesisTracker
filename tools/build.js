const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const outPath = path.join(projectRoot, 'terminal.html');

const blocks = [
  'tweaks-panel.jsx',
  'terminal-components.jsx',
  'terminal-data.jsx',
  'terminal-app.jsx'
];

for (const name of blocks) {
  const p = path.join(projectRoot, 'src', name);
  if (!fs.existsSync(p)) {
    console.error(`Missing source: ${p}`);
    process.exit(1);
  }
}

const head = `<!doctype html>
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
    <div id="boot-fallback" style="min-height:100vh;background:#07090b;color:#e5e7eb;display:none;place-items:center;padding:24px;font-family:'JetBrains Mono',ui-monospace,monospace;">
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
        var el = document.getElementById('boot-fallback');
        if (el) {
          el.style.display = 'grid';
          showBootIssue('React/Babel/CDN 로딩이 지연되고 있습니다. Ctrl+F5로 새로고침하거나, 계속 실패하면 RESET LOCAL DATA를 시도하세요.');
        }
      }, 8000);
    })();
  </script>
`;

const tail = `</body>\n</html>\n`;

let outHTML = head;

for (const name of blocks) {
  const p = path.join(projectRoot, 'src', name);
  let src = fs.readFileSync(p, 'utf8');
  src = src.replace(/[ \t\r\n]+$/, ''); // Trim end
  outHTML += `  <script type="text/babel" data-presets="react" data-source="${name}">\n`;
  outHTML += `  (() => {\n`;
  outHTML += src + '\n';
  outHTML += `  })();\n`;
  outHTML += `  </script>\n`;
}

outHTML += tail;

fs.writeFileSync(outPath, outHTML, 'utf8');

console.log(`Wrote ${outPath} (${Buffer.byteLength(outHTML, 'utf8')} bytes)`);
console.log(`Inlined: ${blocks.join(', ')}`);
