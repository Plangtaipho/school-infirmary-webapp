/**
 * Db.gs
 * ตัวช่วยอ่าน/เขียน Google Sheets แบบ "ตาราง" (แถวแรกคือหัวคอลัมน์)
 */

function ss_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

/** คืนชีตตามชื่อ ถ้ายังไม่มีจะสร้างพร้อมหัวตาราง และเติมคอลัมน์ที่ขาดต่อท้าย */
function getSheet_(name) {
  var ss = ss_();
  var sheet = ss.getSheetByName(name);
  var cols = COLUMNS[name];
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (TEXT_SHEETS.indexOf(name) !== -1) {
      sheet.getRange(1, 1, sheet.getMaxRows(), cols.length).setNumberFormat('@');
    }
    sheet.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    return sheet;
  }
  ensureColumns_(sheet, cols);
  return sheet;
}

/** migration แบบง่าย: เติมคอลัมน์ที่ยังไม่มีต่อท้ายหัวตาราง โดยไม่แตะข้อมูลเดิม */
function ensureColumns_(sheet, cols) {
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var header = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  var missing = cols.filter(function (c) { return header.indexOf(c) === -1; });
  if (missing.length === 0) return;
  var start = header.filter(function (h) { return h !== ''; }).length + 1;
  sheet.getRange(1, start, 1, missing.length).setValues([missing]).setFontWeight('bold');
}

/** อ่านทั้งชีตเป็น array ของ object (ค่าทุกช่องเป็นข้อความตามที่แสดงในชีต) */
function readTable_(name) {
  var sheet = getSheet_(name);
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2) return [];
  var values = sheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();
  var header = values[0];
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var obj = { _row: i + 1 };
    var empty = true;
    for (var j = 0; j < header.length; j++) {
      if (!header[j]) continue;
      obj[header[j]] = values[i][j];
      if (values[i][j] !== '') empty = false;
    }
    if (!empty) rows.push(obj);
  }
  return rows;
}

/** แปลง object เป็นแถวตามลำดับหัวตารางจริงในชีต */
function toRow_(sheet, obj) {
  var header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  return header.map(function (h) {
    var v = obj[h];
    return v === undefined || v === null ? '' : safeCell_(v);
  });
}

function appendRows_(name, objs) {
  if (!objs.length) return;
  var sheet = getSheet_(name);
  var rows = objs.map(function (o) { return toRow_(sheet, o); });
  var start = sheet.getLastRow() + 1;
  var range = sheet.getRange(start, 1, rows.length, rows[0].length);
  if (TEXT_SHEETS.indexOf(name) !== -1) range.setNumberFormat('@');
  range.setValues(rows);
}

function updateRow_(name, rowNumber, obj) {
  var sheet = getSheet_(name);
  var row = toRow_(sheet, obj);
  var range = sheet.getRange(rowNumber, 1, 1, row.length);
  if (TEXT_SHEETS.indexOf(name) !== -1) range.setNumberFormat('@');
  range.setValues([row]);
}

/** ลบแถวตามหมายเลขแถว (เรียงจากล่างขึ้นบนเพื่อไม่ให้แถวเลื่อน) */
function deleteRows_(name, rowNumbers) {
  var sheet = getSheet_(name);
  rowNumbers.slice().sort(function (a, b) { return b - a; }).forEach(function (r) {
    sheet.deleteRow(r);
  });
}

/** กันสูตรแทรก (formula injection) และตัดช่องว่างหัวท้าย */
function safeCell_(v) {
  var s = String(v);
  if (/^[=+\-@]/.test(s)) return "'" + s;
  return s;
}

/** ทำงานภายใต้ล็อก กันการเขียนชนกันเมื่อกดบันทึกซ้ำหรือเปิดหลายแท็บ */
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function nowText_() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss');
}

function todayText_() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
}

function timeText_() {
  return Utilities.formatDate(new Date(), TZ, 'HH:mm');
}
