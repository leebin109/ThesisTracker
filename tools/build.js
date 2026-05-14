const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const indexPath = path.join(projectRoot, 'index.html');
const terminalPath = path.join(projectRoot, 'terminal.html');

if (!fs.existsSync(indexPath)) {
  console.error(`Missing Vite entry: ${indexPath}`);
  process.exit(1);
}

const html = fs.readFileSync(indexPath, 'utf8');
fs.writeFileSync(terminalPath, html, 'utf8');

console.log(`Wrote ${terminalPath} (${Buffer.byteLength(html, 'utf8')} bytes)`);
console.log('terminal.html now mirrors the Vite entry. Use npm run build for production.');
