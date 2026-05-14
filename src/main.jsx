import React from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import './styles.css';

window.React = React;
window.ReactDOM = { createRoot };
window.supabase = { createClient };

async function boot() {
  await import('./tweaks-panel.jsx');
  await import('./terminal-components.jsx');
  await import('./terminal-data.jsx');
  await import('./terminal-app.jsx');
}

boot().catch((err) => {
  console.error('ThesisTrack boot failed', err);
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `
      <div class="boot-error">
        <div class="boot-error__panel">
          <div class="boot-error__eyebrow">THESISTRACK BOOT</div>
          <div class="boot-error__title">Application failed to load.</div>
          <pre class="boot-error__message">${String(err?.message || err)}</pre>
        </div>
      </div>
    `;
  }
});
