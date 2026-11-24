/**
 * ทดสอบฟังก์ชันฝั่งเซิร์ฟเวอร์ (Apps Script) ด้วย Node test runner
 * รัน: npm test
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createGas } = require('./gas-mock');

// 2026-11-19 09:15 เวลาไทย
const NOW = '2026-11-19T02:15:00Z';

function setup() {
  const g = createGas({ now: NOW });
  g.setupSheets();
  const r = g.apiImportStudents([
    { student_id: '10001', prefix: 'ด.ช.', first_name: 'สมชาย', last_name: 'ใจดี', grade: 'ม.1', room: '1' },
    { student_id: '10002', prefix: 'ด.ญ.', first_name: 'สมหญิง', last_name: 'รักเรียน', grade: 'ม.1', room: '2', drug_allergy: 'พาราเซตามอล' },
    { student_id: '10003.0', prefix: 'นาย', first_name: 'มานะ', last_name: 'ขยัน', grade: 'ม.4', room: '1', chronic_disease: 'หอบหืด' }
  ], false);
  assert.equal(r.ok, true, JSON.stringify(r));
  return g;
}

function visit(g, extra = {}) {
  return g.apiSaveVisit(Object.assign({
    student_id: '10001', visit_date: '2026-11-19', time_in: '09:00',
    symptoms: ['ปวดศีรษะ'], care_types: ['ให้นอนพัก', 'ให้ยา'],
    medicines: [{ medicine_name: 'พาราเซตามอล 500 มก.', quantity: 1, unit: 'เม็ด' }]
  }, extra));
}

test('setupSheets สร้างชีตครบและเติมตัวเลือกเริ่มต้น โดยรันซ้ำแล้วไม่ซ้ำ', () => {
  const g = createGas({ now: NOW });
  g.setupSheets();
  g.setupSheets();
  const names = g.__ss.getSheets().map(s => s.getName()).sort();
  assert.deepEqual(names, ['ErrorLog', 'Settings', 'Students', 'VisitMedicines', 'Visits']);
  assert.equal(g.__ss.getSheetByName('Visits').notes[0][0], 'เลขที่รายการ');
  assert.equal(g.formatAllSheets(), true);
  const b = g.apiBootstrap();
  assert.equal(b.ok, true);
  assert.equal(b.data.settings.symptom[0], 'ปวดศีรษะ');
  assert.equal(b.data.settings.outcome.length, 5);
  assert.equal(g.__ss.getSheetByName('Settings').getLastRow() - 1,
    Object.values(g.DEFAULT_SETTINGS).reduce((n, a) => n + a.length, 0) + 1);
  assert.equal(b.data.schoolName, 'โรงเรียนหนองสวรรค์วิทยาคาร');
});

test('นำเข้านักเรียน: ตัด .0 จากเลขประจำตัว และอัปเดตโดยไม่ลบข้อมูลสุขภาพเดิม', () => {
  const g = setup();
  let s = g.apiBootstrap().data.students;
  assert.equal(s.length, 3);
  assert.equal(s[2].student_id, '10003');
  const r = g.apiImportStudents([
    { student_id: '10002', first_name: 'สมหญิง', last_name: 'รักเรียน', grade: 'ม.2', room: '2' },
    { student_id: '', first_name: 'ไม่มีเลข' },
    { student_id: '10002', first_name: 'ซ้ำในไฟล์' }
  ], true);
  assert.equal(r.ok, true);
  assert.deepEqual([r.data.added, r.data.updated, r.data.skipped, r.data.deactivated], [0, 1, 2, 2]);
  s = r.data.students;
  assert.equal(s.length, 1);
  assert.equal(s[0].grade, 'ม.2');
  assert.equal(s[0].drug_allergy, 'พาราเซตามอล');
  assert.equal(s[0].prefix, 'ด.ญ.');
});

test('นำเข้าไฟล์ว่างได้ข้อความแจ้งเตือนที่อ่านเข้าใจ', () => {
  const g = setup();
  const r = g.apiImportStudents([], false);
  assert.equal(r.ok, false);
  assert.equal(r.code, 'ERR-IMPORT-EMPTY');
});

test('บันทึกการเข้า: สร้างเลขที่รายการ, เก็บชั้น/ห้อง ณ วันที่มา, เก็บยา', () => {
  const g = setup();
  const r1 = visit(g);
  assert.equal(r1.ok, true, JSON.stringify(r1));
  assert.equal(r1.data.visit_id, 'V-20261119-0001');
  assert.equal(r1.data.student_name, 'ด.ช. สมชาย ใจดี');
  assert.equal(r1.data.grade, 'ม.1');
  assert.deepEqual(r1.data.care_types, ['ให้นอนพัก', 'ให้ยา']);
  assert.equal(r1.data.medicines[0].quantity, '1');
  const r2 = visit(g, { student_id: '10002' });
  assert.equal(r2.data.visit_id, 'V-20261119-0002');
});

test('บันทึกการเข้า: ตรวจข้อมูลไม่ครบ/ไม่ถูกต้อง', () => {
  const g = setup();
  assert.equal(visit(g, { student_id: '99999' }).code, 'ERR-VISIT-STUDENT');
  assert.equal(visit(g, { symptoms: [], symptom_note: '' }).code, 'ERR-VISIT-SYMPTOM');
  assert.equal(visit(g, { time_in: '25:00' }).code, 'ERR-VISIT-TIME');
  assert.equal(visit(g, { time_out: '08:00' }).code, 'ERR-VISIT-TIME');
  assert.equal(visit(g, { visit_date: '19/11/2026' }).code, 'ERR-VISIT-DATE');
  // อาการพิมพ์เองอย่างเดียวก็ได้
  assert.equal(visit(g, { symptoms: [], symptom_note: 'ถูกผึ้งต่อย' }).ok, true);
});

test('กันสูตรแทรก: ข้อความที่ขึ้นต้นด้วย = ไม่ถูกเขียนเป็นสูตร', () => {
  const g = setup();
  const r = visit(g, { note: '=HYPERLINK("http://x")' });
  assert.equal(r.ok, true);
  assert.equal(r.data.note, '=HYPERLINK("http://x")');
  const raw = g.__ss.getSheetByName('Visits').data[1];
  assert.ok(raw.includes('\'=HYPERLINK("http://x")'));
});

test('แก้ไขรายการ: แทนที่รายการยาเดิม และคงเลขที่รายการ', () => {
  const g = setup();
  const id = visit(g).data.visit_id;
  const r = visit(g, {
    visit_id: id, medicines: [{ medicine_name: 'ยาดม', quantity: 1, unit: 'หลอด' }, { medicine_name: 'ยาหม่อง', quantity: 1, unit: 'ครั้ง' }]
  });
  assert.equal(r.ok, true);
  assert.equal(r.data.visit_id, id);
  assert.deepEqual(r.data.medicines.map(m => m.medicine_name), ['ยาดม', 'ยาหม่อง']);
  assert.equal(g.__ss.getSheetByName('VisitMedicines').getLastRow(), 3);
  assert.equal(visit(g, { visit_id: 'V-NOPE' }).code, 'ERR-VISIT-NOTFOUND');
});

test('ลงเวลาออก และหน้าหลักแสดงคนที่ยังอยู่ในห้อง', () => {
  const g = setup();
  const a = visit(g).data.visit_id;
  visit(g, { student_id: '10003', time_in: '09:10' });
  let t = g.apiToday().data;
  assert.equal(t.count, 2);
  assert.equal(t.inRoom.length, 2);
  g.__setNow('2026-11-19T03:05:00Z'); // 10:05
  const c = g.apiCheckout(a, 'ผู้ปกครองรับกลับบ้าน', '');
  assert.equal(c.ok, true);
  assert.equal(c.data.time_out, '10:05');
  assert.equal(c.data.parent_notified, undefined);
  t = g.apiToday().data;
  assert.equal(t.inRoom.length, 1);
  assert.equal(t.sentHome, 1);
});

test('ยกเลิกรายการ: ไม่แสดงในค้นหาและรายงาน แต่ยังอยู่ในชีต', () => {
  const g = setup();
  const id = visit(g).data.visit_id;
  visit(g, { student_id: '10002' });
  assert.equal(g.apiVoidVisit(id).ok, true);
  assert.equal(g.apiListVisits({}).data.total, 1);
  assert.equal(g.apiListVisits({ includeVoid: true }).data.total, 2);
  assert.equal(g.apiReport('2026-11-01', '2026-11-30').data.total, 1);
});

test('ค้นหาตามช่วงวัน/ชื่อ/ชั้น/ผลการจัดการ', () => {
  const g = setup();
  visit(g, { visit_date: '2026-11-01' });
  visit(g, { student_id: '10002', outcome: 'ส่งต่อโรงพยาบาล' });
  visit(g, { student_id: '10003', visit_date: '2026-10-15' });
  assert.equal(g.apiListVisits({ from: '2026-11-01', to: '2026-11-30' }).data.total, 2);
  assert.equal(g.apiListVisits({ q: 'สมหญิง' }).data.total, 1);
  assert.equal(g.apiListVisits({ q: '10003' }).data.total, 1);
  assert.equal(g.apiListVisits({ grade: 'ม.1' }).data.total, 2);
  assert.equal(g.apiListVisits({ outcome: 'ส่งต่อโรงพยาบาล' }).data.total, 1);
  const list = g.apiListVisits({}).data.visits;
  assert.deepEqual(list.map(v => v.visit_date), ['2026-11-19', '2026-11-01', '2026-10-15']);
});

test('รายงาน: นับตามอาการ ชั้น ผลการจัดการ ยา และนักเรียนที่มาบ่อย', () => {
  const g = setup();
  for (let i = 0; i < 3; i++) visit(g, { time_in: String(8 + i).padStart(2, '0') + ':00', symptoms: ['ปวดศีรษะ', 'ไข้'], outcome: 'กลับเข้าเรียน' });
  visit(g, { student_id: '10002', symptoms: ['ปวดท้อง'], outcome: 'ส่งต่อ รพ.สต.', referral_place: 'รพ.สต.บ้านนา', medicines: [] });
  visit(g, { student_id: '10003', visit_date: '2026-12-01' });
  const r = g.apiReport('2026-11-01', '2026-11-30');
  assert.equal(r.ok, true);
  const d = r.data;
  assert.equal(d.total, 4);
  assert.equal(d.uniqueStudents, 2);
  assert.equal(d.referredCount, 1);
  assert.deepEqual(d.bySymptom[0], { label: 'ปวดศีรษะ', count: 3 });
  assert.deepEqual(d.byGrade, [{ label: 'ม.1', count: 4 }]);
  assert.equal(d.medicines[0].quantity, 3);
  assert.equal(d.frequent[0].count, 3);
  assert.equal(d.referrals[0].referral_place, 'รพ.สต.บ้านนา');
  assert.equal(g.apiReport('2026-12-01', '2026-11-01').code, 'ERR-REPORT-DATE');
});

test('ข้อผิดพลาดที่ไม่คาดคิดถูกบันทึกใน ErrorLog โดยไม่มีข้อมูลนักเรียน และคืนข้อความทั่วไป', () => {
  const g = setup();
  const r = g.handle_('boom', () => { throw new Error('internal detail'); });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'ERR-BOOM');
  assert.ok(!r.message.includes('internal'));
  assert.equal(g.__ss.getSheetByName('ErrorLog').getLastRow(), 2);
});

test('เพิ่ม/แก้ไขนักเรียนทีละคน และกันเลขประจำตัวซ้ำ', () => {
  const g = setup();
  const r = g.apiSaveStudent({ isNew: true, student_id: '10004', first_name: 'ปิติ', grade: 'ป.6', room: '1' });
  assert.equal(r.ok, true);
  assert.equal(r.data.students.length, 4);
  assert.equal(g.apiSaveStudent({ isNew: true, student_id: '10004', first_name: 'x' }).code, 'ERR-STUDENT-DUP');
  const e = g.apiSaveStudent({ student_id: '10004', first_name: 'ปิติ', drug_allergy: 'เพนิซิลลิน', parent_phone: '0812345678' });
  assert.equal(e.data.student.drug_allergy, 'เพนิซิลลิน');
  assert.equal(e.data.student.parent_phone, '0812345678');
});

test('migration: ชีตเก่าที่ไม่มีคอลัมน์ใหม่จะถูกเติมต่อท้ายโดยข้อมูลเดิมไม่เลื่อน', () => {
  const g = createGas({ now: NOW });
  const sh = g.__ss.insertSheet('Students');
  sh.getRange(1, 1, 2, 3).setValues([['student_id', 'prefix', 'first_name'], ['1', 'นาย', 'ก']]);
  g.setupSheets();
  const header = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0];
  assert.deepEqual(header.slice(0, 4), ['student_id', 'prefix', 'first_name', 'last_name']);
  assert.equal(g.apiBootstrap().data.students[0].first_name, 'ก');
});

test('อุณหภูมิ: เก็บเป็นทศนิยม 1 ตำแหน่ง, ตรวจช่วง, และรายงานแยกมีไข้/ไข้สูง', () => {
  const g = setup();
  assert.equal(visit(g, { temperature: '37,8' }).data.temperature, '37.8');
  assert.equal(visit(g, { temperature: 375 }).data.temperature, '37.5');
  assert.equal(visit(g, { temperature: '39.2' }).data.temperature, '39.2');
  assert.equal(visit(g, { temperature: '36.6' }).data.temperature, '36.6');
  assert.equal(visit(g, {}).data.temperature, '');
  assert.equal(visit(g, { temperature: '25' }).code, 'ERR-VISIT-TEMP');
  assert.equal(visit(g, { temperature: 'สูง' }).code, 'ERR-VISIT-TEMP');
  const rep = g.apiReport('2026-11-01', '2026-11-30').data;
  assert.equal(rep.feverCount, 3);
  const band = Object.fromEntries(rep.byTemperature.map(x => [x.label.split(' ')[0], x.count]));
  assert.deepEqual(band, { 'ปกติ': 1, 'มีไข้': 2, 'ไข้สูง': 1, 'ไม่ได้วัด': 1 });
});

test('รายการยา: มีหน่วยเริ่มต้น, เพิ่มยาใหม่, แก้หน่วย, เอาออกจากรายการ', () => {
  const g = setup();
  const b = g.apiBootstrap().data;
  assert.equal(b.medicineUnits['ยาหม่อง'], 'ครั้ง (ทา/ดม)');
  assert.ok(b.settings.unit.includes('ช้อนชา'));
  let r = g.apiSaveMedicine('ยาแก้ไอน้ำดำ', 'ช้อนชา');
  assert.equal(r.ok, true);
  assert.equal(r.data.medicineUnits['ยาแก้ไอน้ำดำ'], 'ช้อนชา');
  assert.equal(r.data.settings.medicine.at(-1), 'ยาแก้ไอน้ำดำ');
  r = g.apiSaveMedicine('ยาแก้ไอน้ำดำ', 'ซีซี');
  assert.equal(r.data.medicineUnits['ยาแก้ไอน้ำดำ'], 'ซีซี');
  assert.equal(r.data.settings.medicine.filter(m => m === 'ยาแก้ไอน้ำดำ').length, 1);
  assert.equal(g.apiSaveMedicine('  ', 'เม็ด').code, 'ERR-MED-NAME');
  r = g.apiRemoveMedicine('ยาแก้ไอน้ำดำ');
  assert.equal(r.data.settings.medicine.includes('ยาแก้ไอน้ำดำ'), false);
});

test('migration: ชีต Settings เดิม (ไม่มีหน่วยยา) ได้รายการหน่วยและหน่วยเริ่มต้นของยา', () => {
  const g = createGas({ now: NOW });
  g.setupSheets();
  const sh = g.__ss.getSheetByName('Settings');
  // จำลองชีตรุ่นก่อน: ไม่มีคอลัมน์ unit และไม่มีแถว unit
  sh.data = sh.data.filter((r, i) => i === 0 || r[0] !== 'unit').map(r => r.slice(0, 3));
  g.setupIfNeeded_();
  const b = g.apiBootstrap().data;
  assert.equal(b.settings.unit.length, g.DEFAULT_SETTINGS.unit.length);
  assert.equal(b.medicineUnits['ผงเกลือแร่ (ORS)'], 'ซอง');
});

test('ชั้นที่พิมพ์เป็นตัวเลขถูกแปลงเป็น ม.x', () => {
  const g = createGas({ now: NOW });
  g.setupSheets();
  ['1', 'ม1', 'ม. 2', 'มัธยมศึกษาปีที่ 3', 'ม.4'].forEach((x, i) => assert.equal(g.normGrade_(x), ['ม.1', 'ม.1', 'ม.2', 'ม.3', 'ม.4'][i]));
  assert.equal(g.normGrade_('ป.6'), 'ป.6');
  g.apiSaveStudent({ isNew: true, student_id: '20001', first_name: 'ทดสอบ', grade: '5', room: '1' });
  const s = g.readTable_(g.SHEETS.STUDENTS).find(r => r.student_id === '20001');
  assert.equal(s.grade, 'ม.5');
});

test('ครู/บุคลากร: ได้เลข T001, T002 อัตโนมัติ และไม่ถูกปิดเมื่อนำเข้ารายชื่อนักเรียนใหม่', () => {
  const g = createGas({ now: NOW });
  g.setupSheets();
  g.apiImportStudents([{ student_id: '10001', first_name: 'สมชาย', grade: 'ม.1', room: '1' }], false);
  const a = g.apiSaveStudent({ isNew: true, prefix: 'นาง', first_name: 'สมศรี', last_name: 'ใจดี', grade: 'ครู/บุคลากร', room: '2' });
  assert.equal(a.ok, true);
  assert.equal(a.data.student.student_id, 'T001');
  assert.equal(a.data.student.room, '');
  const b = g.apiSaveStudent({ isNew: true, first_name: 'ประเสริฐ', grade: 'บุคลากร' });
  assert.equal(b.data.student.student_id, 'T002');
  assert.equal(b.data.student.grade, 'ครู/บุคลากร');
  // นักเรียนยังต้องมีเลขประจำตัว
  assert.equal(g.apiSaveStudent({ isNew: true, first_name: 'ไม่มีเลข', grade: 'ม.2' }).ok, false);
  // นำเข้าไฟล์นักเรียนแบบปิดคนที่ไม่อยู่ในไฟล์ ครูต้องยังอยู่
  const r = g.apiImportStudents([{ student_id: '10002', first_name: 'ใหม่', grade: 'ม.1', room: '1' }], true);
  const ids = r.data.students.map(s => s.student_id).sort();
  assert.deepEqual(ids, ['10002', 'T001', 'T002']);
  // บันทึกการมาห้องพยาบาลของครูได้ และรายงานแยกกลุ่ม ครู/บุคลากร
  assert.equal(g.apiSaveVisit({ student_id: 'T001', visit_date: '2026-11-19', time_in: '10:00', temperature: '37.0', symptoms: ['ปวดศีรษะ'] }).ok, true);
  const rep = g.apiReport('2026-11-01', '2026-11-30').data;
  assert.equal(rep.byGrade.find(x => x.label === 'ครู/บุคลากร').count, 1);
});
