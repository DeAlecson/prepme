/* ── Utils ── */
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

function escapeHTML(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  Object.assign(el.style, {
    position:'fixed', bottom:'24px', left:'50%', transform:'translateX(-50%)',
    background: type === 'error' ? 'var(--red-dim)' : type === 'success' ? 'var(--green-dim)' : 'var(--bg3)',
    border: `1px solid ${type === 'error' ? 'rgba(239,68,68,0.4)' : type === 'success' ? 'rgba(16,185,129,0.4)' : 'var(--border)'}`,
    color: type === 'error' ? 'var(--red)' : type === 'success' ? 'var(--green)' : 'var(--text)',
    padding:'10px 20px', borderRadius:'8px', fontSize:'13px', fontWeight:'500',
    zIndex:'9999', boxShadow:'var(--shadow-lg)', animation:'fadeUp 0.2s ease',
    maxWidth:'320px', textAlign:'center',
  });
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function readFileAsText(file) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = e => res(e.target.result);
    reader.onerror = rej;
    reader.readAsText(file);
  });
}

function readFileAsArrayBuffer(file) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = e => res(e.target.result);
    reader.onerror = rej;
    reader.readAsArrayBuffer(file);
  });
}

function autoGrow(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
}
