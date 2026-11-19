/**
 * dev/build-demo.js — สร้างไฟล์ HTML เดียวสำหรับนำเสนอลูกค้า (ไม่ใช้ในระบบจริง)
 * - รวม Index/Styles/App + โค้ด .gs + ตัวจำลอง Google Sheets ไว้ในไฟล์เดียว
 * - ข้อมูลทั้งหมดเป็นข้อมูลสมมติ อยู่ในหน่วยความจำของเบราว์เซอร์ (รีเฟรชแล้วรีเซ็ต)
 * - ฝังไลบรารี xlsx / html2pdf ไว้ในไฟล์ ใช้งานได้แม้ไม่มีอินเทอร์เน็ต (ยกเว้นฟอนต์)
 *
 * รัน: node dev/build-demo.js [output.html]
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const out = process.argv[2] || path.join(ROOT, 'demo', 'infirmary-demo.html');

const safe = (s) => s.replace(/<\/script/gi, '<\\/script');
const read = (p) => fs.readFileSync(p, 'utf8');

// ตัวจำลองชีตจาก tests/gas-mock.js (ส่วน class)
const mockSrc = read(path.join(ROOT, 'tests', 'gas-mock.js'));
const classes = mockSrc.slice(mockSrc.indexOf('class MockRange'), mockSrc.indexOf('function createGas'));
const seedSrc = read(path.join(__dirname, 'seed.js')).replace(/module\.exports[\s\S]*$/, '');
const gsSrc = fs.readdirSync(SRC).filter(f => f.endsWith('.gs')).sort().map(f => '// ---- ' + f + '\n' + read(path.join(SRC, f))).join('\n');

const runtime = `<script>
${classes}
var __ss = new MockSpreadsheet();
var SpreadsheetApp = { getActiveSpreadsheet: function () { return __ss; }, getUi: function () { return {}; } };
var LockService = { getScriptLock: function () { return { waitLock: function () {}, releaseLock: function () {} }; } };
var HtmlService = {};
var Utilities = { formatDate: function (d, tz, fmt) {
  var t = new Date(d.getTime() + 7 * 3600 * 1000);
  return fmt.replace('yyyy', t.getUTCFullYear()).replace('MM', pad(t.getUTCMonth() + 1)).replace('dd', pad(t.getUTCDate()))
    .replace('HH', pad(t.getUTCHours())).replace('mm', pad(t.getUTCMinutes())).replace('ss', pad(t.getUTCSeconds()));
} };
</script>
<script>
${safe(gsSrc)}
</script>
<script>
${safe(seedSrc)}
(function () {
  setupSheets();
  var rt = function (fn) { return function () { var a = JSON.parse(JSON.stringify([].slice.call(arguments))); return JSON.parse(JSON.stringify(fn.apply(null, a))); }; };
  seed({ apiImportStudents: rt(apiImportStudents), apiSaveVisit: rt(apiSaveVisit), todayText_: todayText_, DEFAULT_SETTINGS: DEFAULT_SETTINGS });
  // DEMO_SCHOOL=ชื่อปลอม ใช้ตอนทำภาพโฆษณา (ไม่ระบุชื่อโรงเรียนลูกค้า) — ไม่ใส่ = ใช้ชื่อเริ่มต้นใน Config.gs
  if (${JSON.stringify(process.env.DEMO_SCHOOL || '')}) updateRow_(SHEETS.SETTINGS, readTable_(SHEETS.SETTINGS).filter(function (r) { return r.list_type === 'school_name'; })[0]._row,
    { list_type: 'school_name', value: ${JSON.stringify(process.env.DEMO_SCHOOL || '')}, sort_order: '1' });
  var API = {};
  Object.getOwnPropertyNames(window).forEach(function (k) { if (/^api[A-Z]/.test(k) && typeof window[k] === 'function') API[k] = rt(window[k]); });
  function runner(ok, fail) {
    return new Proxy({}, { get: function (_, name) {
      if (name === 'withSuccessHandler') return function (f) { return runner(f, fail); };
      if (name === 'withFailureHandler') return function (f) { return runner(ok, f); };
      return function () {
        var args = [].slice.call(arguments);
        setTimeout(function () {
          try { var r = API[name].apply(null, args); ok && ok(r); } catch (e) { fail && fail(e); }
        }, 120);
      };
    } });
  }
  window.google = { script: { run: runner(null, null) } };
})();
</script>`;

const banner = `<style>@media print{.demo-banner{display:none!important}}</style><div class="demo-banner" style="background:#fff4d6;color:#7a4b00;font:14px/1.4 Sarabun,sans-serif;text-align:center;padding:6px 12px;border-bottom:1px solid #f0d58a">
โหมดสาธิต: ข้อมูลทั้งหมดเป็นข้อมูลสมมติ และจะรีเซ็ตเมื่อรีเฟรชหน้า</div>`;

let html = read(path.join(SRC, 'Index.html'));
html = html.replace('<title>ระบบบันทึกห้องพยาบาล</title>', '<title>ระบบบันทึกห้องพยาบาล (สาธิต)</title>');
html = html.replace(/<body([^>]*)>/, (m) => m + banner);
html = html.replace(/<\?!=\s*include\('(\w+)'\);?\s*\?>/g, (_, f) => read(path.join(SRC, f + '.html')));
html = html.replace(/<script src="https:\/\/cdnjs[^"]*xlsx[^"]*"[^>]*><\/script>/,
  () => '<script>' + safe(read(path.join(ROOT, 'node_modules/xlsx/dist/xlsx.full.min.js'))) + '</script>');
html = html.replace('<head>', () => '<head>\n<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' + runtime +
  '<script>' + safe(read(path.join(ROOT, 'node_modules/html2pdf.js/dist/html2pdf.bundle.min.js'))) + '</script>');
if (!html.includes('<head>')) throw new Error('no <head> in Index.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log('wrote', out, (html.length / 1024).toFixed(0) + ' KB');
