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
          rows.push({ list_type: type, value: value, sort_order: String(i + 1),
            unit: type === 'medicine' ? (DEFAULT_MEDICINE_UNITS[value] || '') : '' });
        });
      });
      rows.push({ list_type: 'school_name', value: DEFAULT_SCHOOL_NAME, sort_order: '1' });
      appendRows_(SHEETS.SETTINGS, rows);
    } else {
      migrateSettings_(existing);
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
  if (!ss_().getSheetByName(SHEETS.SETTINGS)) { setupSheets(); return; }
  var rows = readTable_(SHEETS.SETTINGS);
  if (!rows.some(function (r) { return r.list_type === 'unit'; })) setupSheets();
}

/** ชีตที่ติดตั้งก่อนมีหน่วยยา: เติมรายการหน่วย และหน่วยเริ่มต้นของยาที่มีอยู่ (ไม่ทับค่าที่ครูแก้ไว้) */
function migrateSettings_(rows) {
  if (!rows.some(function (r) { return r.list_type === 'unit'; })) {
    appendRows_(SHEETS.SETTINGS, DEFAULT_SETTINGS.unit.map(function (u, i) {
      return { list_type: 'unit', value: u, sort_order: String(i + 1), unit: '' };
    }));
  }
  rows.forEach(function (r) {
    if (r.list_type === 'medicine' && !r.unit && DEFAULT_MEDICINE_UNITS[r.value]) {
      r.unit = DEFAULT_MEDICINE_UNITS[r.value];
      updateRow_(SHEETS.SETTINGS, r._row, r);
    }
  });
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
      medicineUnits: getMedicineUnits_(),
      tempFever: TEMP_FEVER,
      tempHighFever: TEMP_HIGH_FEVER,
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

/** หน่วยเริ่มต้นของยาแต่ละตัว { ชื่อยา: หน่วย } */
function getMedicineUnits_() {
  var out = {};
  readTable_(SHEETS.SETTINGS).forEach(function (r) {
    if (r.list_type === 'medicine' && r.value) out[r.value] = r.unit || '';
  });
  return out;
}

/** เพิ่มชนิดยาใหม่ หรือแก้หน่วยเริ่มต้นของยาที่มีอยู่ */
function apiSaveMedicine(name, unit) {
  return handle_('saveMedicine', function () {
    name = cleanText_(name, 100);
    unit = cleanText_(unit, 30);
    if (!name) throw appError_('ERR-MED-NAME', 'กรุณาพิมพ์ชื่อยา');
    return withLock_(function () {
      var rows = readTable_(SHEETS.SETTINGS).filter(function (r) { return r.list_type === 'medicine'; });
      var found = rows.filter(function (r) { return r.value === name; })[0];
      if (found) {
        found.unit = unit;
        updateRow_(SHEETS.SETTINGS, found._row, found);
      } else {
        var maxOrder = rows.reduce(function (m, r) { return Math.max(m, Number(r.sort_order) || 0); }, 0);
        appendRows_(SHEETS.SETTINGS, [{ list_type: 'medicine', value: name, sort_order: String(maxOrder + 1), unit: unit }]);
      }
      return { settings: getSettings_(), medicineUnits: getMedicineUnits_() };
    });
  });
}

/** เอายาออกจากรายการให้เลือก (ประวัติการให้ยาเดิมยังอยู่ครบ) */
function apiRemoveMedicine(name) {
  return handle_('removeMedicine', function () {
    name = cleanText_(name, 100);
    return withLock_(function () {
      var rows = readTable_(SHEETS.SETTINGS).filter(function (r) { return r.list_type === 'medicine' && r.value === name; });
      if (!rows.length) throw appError_('ERR-MED-NOTFOUND', 'ไม่พบยานี้ในรายการ');
      deleteRows_(SHEETS.SETTINGS, rows.map(function (r) { return r._row; }));
      return { settings: getSettings_(), medicineUnits: getMedicineUnits_() };
    });
  });
}

/** ชื่อโรงเรียนสำหรับหัวรายงาน (แก้ได้ในชีต Settings แถว list_type = school_name) */
function getSchoolName_() {
  var row = readTable_(SHEETS.SETTINGS).filter(function (r) { return r.list_type === 'school_name'; })[0];
  return row && row.value ? row.value : '';
}
