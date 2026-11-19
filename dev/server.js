/**
 * dev/server.js — เซิร์ฟเวอร์จำลองสำหรับพัฒนา/ทดสอบหน้าเว็บบนเครื่อง (ไม่ใช้ในระบบจริง)
 * - ประกอบ Index.html แบบเดียวกับ HtmlService (แทน <?!= include('X'); ?>)
 * - จำลอง google.script.run ให้เรียกฟังก์ชัน .gs ผ่าน HTTP
 * - ใส่ข้อมูลตัวอย่าง (ชื่อปลอม) ถ้าตั้ง SEED=1
 *
 * รัน: npm run dev   แล้วเปิด http://localhost:8080
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { createGas } = require('../tests/gas-mock');
const { seed } = require('./seed');

const SRC = path.join(__dirname, '..', 'src');
const PORT = Number(process.env.PORT || 8080);
const gas = createGas(process.env.NOW ? { now: process.env.NOW } : {});
gas.setupSheets();
if (process.env.SEED === '1') seed(gas);

const SHIM = `<script>
  window.google = { script: { run: (function () {
    function runner(ok, fail) {
      return new Proxy({}, { get: function (_, name) {
        if (name === 'withSuccessHandler') return function (f) { return runner(f, fail); };
        if (name === 'withFailureHandler') return function (f) { return runner(ok, f); };
        return function () {
          var args = Array.prototype.slice.call(arguments);
          fetch('/rpc/' + name, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args) })
            .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(function (d) { ok && ok(d); })
            .catch(function (e) { fail && fail(e); });
        };
      } });
    }
    return runner(null, null);
  })() } };
</script>`;

function render() {
  let html = fs.readFileSync(path.join(SRC, 'Index.html'), 'utf8');
  html = html.replace(/<\?!=\s*include\('(\w+)'\);?\s*\?>/g, (_, f) => fs.readFileSync(path.join(SRC, f + '.html'), 'utf8'));
  return html.replace('<head>', '<head>' + SHIM);
}

http.createServer((req, res) => {
  if (req.method === 'POST' && req.url.startsWith('/rpc/')) {
    const name = req.url.slice(5);
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      if (!/^api\w+$/.test(name) || typeof gas[name] !== 'function') { res.writeHead(404); res.end(); return; }
      const out = gas[name](...JSON.parse(body || '[]'));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(out));
    });
    return;
  }
  if (req.url === '/' || req.url.startsWith('/?')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(render());
    return;
  }
  res.writeHead(404); res.end();
}).listen(PORT, () => console.log('dev server: http://localhost:' + PORT));
