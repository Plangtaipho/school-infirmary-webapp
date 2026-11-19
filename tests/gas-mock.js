/**
 * gas-mock.js
 * จำลอง Google Apps Script (SpreadsheetApp, LockService, Utilities) แบบในหน่วยความจำ
 * เพื่อรันโค้ด .gs บน Node.js สำหรับทดสอบ (ไม่ได้ใช้ในระบบจริง)
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

class MockRange {
  constructor(sheet, r, c, nr, nc) { Object.assign(this, { sheet, r, c, nr, nc }); }
  getValues() { return this._read(false); }
  getDisplayValues() { return this._read(true); }
  _read(display) {
    const out = [];
    for (let i = 0; i < this.nr; i++) {
      const row = [];
      for (let j = 0; j < this.nc; j++) {
        let v = (this.sheet.data[this.r - 1 + i] || [])[this.c - 1 + j];
        v = v === undefined ? '' : v;
        if (display && typeof v === 'string' && v.startsWith("'")) v = v.slice(1);
        row.push(display ? String(v) : v);
      }
      out.push(row);
    }
    return out;
  }
  setValues(values) {
    if (values.length !== this.nr || values[0].length !== this.nc) {
      throw new Error(`setValues size mismatch: ${values.length}x${values[0].length} vs ${this.nr}x${this.nc}`);
    }
    for (let i = 0; i < this.nr; i++) {
      const rowIdx = this.r - 1 + i;
      while (this.sheet.data.length <= rowIdx) this.sheet.data.push([]);
      for (let j = 0; j < this.nc; j++) {
        const v = values[i][j];
        if (typeof v === 'string' && v.startsWith('=')) throw new Error('formula written to sheet: ' + v);
        this.sheet.data[rowIdx][this.c - 1 + j] = v;
      }
    }
    return this;
  }
  setNumberFormat() { return this; }
  setFontWeight() { return this; }
  setFontColor() { return this; }
  setBackground() { return this; }
  setNotes(n) { this.sheet.notes = n; return this; }
}

class MockSheet {
  constructor(name) { this.name = name; this.data = []; }
  getName() { return this.name; }
  getRange(r, c, nr = 1, nc = 1) { return new MockRange(this, r, c, nr, nc); }
  getMaxRows() { return 1000; }
  _trim() {
    while (this.data.length && this.data[this.data.length - 1].every(v => v === '' || v === undefined)) this.data.pop();
  }
  getLastRow() { this._trim(); return this.data.length; }
  getLastColumn() {
    return this.data.reduce((m, row) => {
      let last = 0;
      row.forEach((v, i) => { if (v !== '' && v !== undefined) last = i + 1; });
      return Math.max(m, last);
    }, 0);
  }
  setFrozenRows() {}
  setTabColor() {}
  setColumnWidth() {}
  deleteRow(r) { this.data.splice(r - 1, 1); }
}

class MockSpreadsheet {
  constructor() { this.sheets = [new MockSheet('Sheet1')]; }
  getSheetByName(n) { return this.sheets.find(s => s.name === n) || null; }
  insertSheet(n) { const s = new MockSheet(n); this.sheets.push(s); return s; }
  getSheets() { return this.sheets; }
  deleteSheet(s) { this.sheets = this.sheets.filter(x => x !== s); }
}

function pad(n) { return String(n).padStart(2, '0'); }

function createGas(opts = {}) {
  const ss = new MockSpreadsheet();
  const clock = { now: opts.now ? new Date(opts.now) : new Date() };
  const RealDate = Date;
  class FakeDate extends RealDate {
    constructor(...a) { if (a.length === 0) super(clock.now.getTime()); else super(...a); }
    static now() { return clock.now.getTime(); }
  }
  const ctx = {
    console,
    Date: FakeDate,
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, getUi: () => ({}) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: {
      // รองรับเฉพาะรูปแบบที่ระบบใช้ และคำนวณเวลาไทย (UTC+7)
      formatDate(d, tz, fmt) {
        const t = new RealDate(d.getTime() + 7 * 3600 * 1000);
        return fmt
          .replace('yyyy', t.getUTCFullYear())
          .replace('MM', pad(t.getUTCMonth() + 1))
          .replace('dd', pad(t.getUTCDate()))
          .replace('HH', pad(t.getUTCHours()))
          .replace('mm', pad(t.getUTCMinutes()))
          .replace('ss', pad(t.getUTCSeconds()));
      }
    },
    HtmlService: {}
  };
  vm.createContext(ctx);
  const srcDir = path.join(__dirname, '..', 'src');
  fs.readdirSync(srcDir).filter(f => f.endsWith('.gs')).sort().forEach(f => {
    vm.runInContext(fs.readFileSync(path.join(srcDir, f), 'utf8'), ctx, { filename: f });
  });
  // จำลองการส่งข้อมูลผ่าน google.script.run (serialize เป็น JSON)
  Object.keys(ctx).filter(k => k.startsWith('api')).forEach(k => {
    const fn = ctx[k];
    ctx[k] = (...args) => JSON.parse(JSON.stringify(fn(...JSON.parse(JSON.stringify(args)))));
  });
  ctx.__ss = ss;
  ctx.__setNow = (iso) => { clock.now = new RealDate(iso); };
  return ctx;
}

module.exports = { createGas };
