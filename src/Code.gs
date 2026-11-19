/**
 * Code.gs
 * จุดเริ่มต้นของเว็บแอป + ฟังก์ชันที่หน้าเว็บเรียกผ่าน google.script.run
 *
 * ทุกฟังก์ชันที่หน้าเว็บเรียกได้ขึ้นต้นด้วย api และห่อด้วย handle_()
 * เพื่อคืนผลรูปแบบเดียวกัน: { ok: true, data } หรือ { ok: false, code, message }
 * ฟังก์ชันที่ลงท้ายด้วย _ เป็นฟังก์ชันภายใน หน้าเว็บเรียกไม่ได้
 */

function doGet() {
  setupIfNeeded_();
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle(APP_NAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

/** ใช้ในเทมเพลต HTML เพื่อแทรกไฟล์ Styles / App */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/** เมนูใน Google Sheets สำหรับครู/ผู้ดูแล */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('ห้องพยาบาล')
    .addItem('ตั้งค่าชีตเริ่มต้น', 'setupSheets')
    .addItem('จัดรูปแบบแท็บใหม่', 'formatAllSheets')
    .addToUi();
}

/** สร้างชีตทั้งหมดและเติมตัวเลือกเริ่มต้น (รันซ้ำได้ ไม่ทับข้อมูลเดิม) */
function setupSheets() {
  return withLock_(function () {
    Object.keys(SHEETS).forEach(function (k) { getSheet_(SHEETS[k]); });
    var existing = readTable_(SHEETS.SETTINGS);
    if (existing.length === 0) {
      var rows = [];
      LIST_TYPES.forEach(function (type) {
        DEFAULT_SETTINGS[type].forEach(function (value, i) {
          rows.push({ list_type: type, value: value, sort_order: String(i + 1) });
        });
      });
      rows.push({ list_type: 'school_name', value: 'โรงเรียน', sort_order: '1' });
      appendRows_(SHEETS.SETTINGS, rows);
    }
    var first = ss_().getSheetByName('Sheet1') || ss_().getSheetByName('ชีต1');
    if (first && first.getLastRow() === 0 && ss_().getSheets().length > 1) {
      ss_().deleteSheet(first);
    }
    return true;
  });
}

/** จัดรูปแบบทุกแท็บใหม่ (ไม่แตะข้อมูล) */
function formatAllSheets() {
  Object.keys(SHEETS).forEach(function (k) { formatSheet_(getSheet_(SHEETS[k]), SHEETS[k]); });
  return true;
}

function setupIfNeeded_() {
  if (!ss_().getSheetByName(SHEETS.SETTINGS)) setupSheets();
}

/** ห่อทุก API: จับ error, บันทึก ErrorLog (ไม่มีข้อมูลนักเรียน), คืนข้อความที่ผู้ใช้อ่านเข้าใจ */
function handle_(fnName, fn) {
  try {
    return { ok: true, data: fn() };
  } catch (e) {
    var code = e && e.appCode ? e.appCode : 'ERR-' + fnName.toUpperCase();
    var userMsg = e && e.appCode ? e.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่ หากยังไม่ได้ให้แคปหน้าจอนี้ส่งผู้ดูแลระบบ';
    try {
      appendRows_(SHEETS.ERROR_LOG, [{
        timestamp: nowText_(), code: code, function_name: fnName,
        message: String(e && e.appCode ? e.message : (e && e.stack) || e).slice(0, 500)
      }]);
    } catch (ignore) { /* ถ้าเขียน log ไม่ได้ก็ไม่ให้กระทบผู้ใช้ */ }
    return { ok: false, code: code, message: userMsg };
  }
}

/** error ที่ตั้งใจโยน (เช่น ข้อมูลไม่ครบ) จะแสดงข้อความนี้ให้ผู้ใช้เห็นตรง ๆ */
function appError_(code, message) {
  var e = new Error(message);
  e.appCode = code;
  return e;
}

/** ข้อมูลตั้งต้นที่หน้าเว็บโหลดครั้งเดียวตอนเปิด */
function apiBootstrap() {
  return handle_('bootstrap', function () {
    return {
      appName: APP_NAME,
      today: todayText_(),
      settings: getSettings_(),
      schoolName: getSchoolName_(),
      students: listStudents_(),
      outcomeNeedsParent: OUTCOME_NEEDS_PARENT,
      outcomeReferral: OUTCOME_REFERRAL
    };
  });
}

function getSettings_() {
  var rows = readTable_(SHEETS.SETTINGS);
  var out = {};
  LIST_TYPES.forEach(function (t) { out[t] = []; });
  rows.sort(function (a, b) { return Number(a.sort_order || 0) - Number(b.sort_order || 0); });
  rows.forEach(function (r) {
    if (out[r.list_type] && r.value) out[r.list_type].push(r.value);
  });
  return out;
}

/** ชื่อโรงเรียนสำหรับหัวรายงาน (แก้ได้ในชีต Settings แถว list_type = school_name) */
function getSchoolName_() {
  var row = readTable_(SHEETS.SETTINGS).filter(function (r) { return r.list_type === 'school_name'; })[0];
  return row && row.value ? row.value : '';
}
