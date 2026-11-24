/**
 * tests/e2e.cjs — ทดสอบหน้าเว็บแบบ end-to-end ด้วย Playwright บน dev server
 * ใช้: (SEED=1 NOW=2026-11-19T02:40:00Z npm run dev) แล้ว  node tests/e2e.cjs [screenshotDir]
 * - ไลบรารี xlsx จาก CDN จะถูกแทนด้วยไฟล์ใน node_modules (เครื่องทดสอบอาจออกเน็ตไม่ได้)
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://localhost:8080';
const OUT = process.argv[2] || path.join(__dirname, '..', 'screenshots');
fs.mkdirSync(OUT, { recursive: true });
const XLSX_JS = fs.readFileSync(path.join(__dirname, '..', 'node_modules', 'xlsx', 'dist', 'xlsx.full.min.js'));
const HTML2PDF_JS = fs.readFileSync(path.join(__dirname, '..', 'node_modules', 'html2pdf.js', 'dist', 'html2pdf.bundle.min.js'));

const results = [];
function check(name, cond) {
  results.push({ name, ok: !!cond });
  console.log((cond ? 'PASS ' : 'FAIL ') + name);
}

async function newPage(browser, viewport) {
  const ctx = await browser.newContext({ acceptDownloads: true, viewport, deviceScaleFactor: 1, locale: 'th-TH', timezoneId: 'Asia/Bangkok' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_|net::/.test(m.text())) errors.push(m.text()); });
  await page.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/xlsx/, r => r.fulfill({ body: XLSX_JS, contentType: 'application/javascript' }));
  await page.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/html2pdf/, r => r.fulfill({ body: HTML2PDF_JS, contentType: 'application/javascript' }));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto(BASE);
  await page.waitForSelector('#view-home:not(.hidden) .stats', { timeout: 10000 });
  return { page, ctx, errors };
}

(async () => {
  const browser = await chromium.launch();

  /* ---------- มือถือ: ขั้นตอนหลักทั้งหมด ---------- */
  const { page, ctx, errors } = await newPage(browser, { width: 390, height: 844 });
  await page.screenshot({ path: path.join(OUT, 'mobile-01-home.png'), fullPage: true });
  check('หน้าวันนี้แสดงคนที่ยังอยู่ในห้อง 2 คน', (await page.locator('#view-home button:has-text("ออกจากห้อง")').count()) === 2);

  // บันทึกนักเรียนที่แพ้พาราเซตามอล (36002 ตามข้อมูลตัวอย่าง)
  await page.click('text=+ บันทึกนักเรียนที่มาใหม่');
  check('หน้าบันทึกแสดงปุ่มเลือกห้อง ม.1/1 ถึง ม.6/2 (12 ห้อง) + ครู/บุคลากร', (await page.locator('.class-chip').count()) === 13 && await page.locator('.class-chip >> nth=12').textContent() === 'ครู/บุคลากร');
  check('วันที่แสดงเป็นภาษาไทย พ.ศ.', /^\d{1,2} [ก-๙.]+ 25\d\d$/.test((await page.textContent('#view-record .th-date .th-shown')).trim()));
  check('เวลาเลือกเป็นชั่วโมง:นาที 24 ชม. (เวลาเข้า + เวลาออก)', (await page.locator('#view-record .th-hh').count()) === 2 && (await page.inputValue('#view-record .th-hh >> nth=1')) === '');
  await page.selectOption('#view-record .th-hh >> nth=0', '13');
  await page.selectOption('#view-record .th-mm >> nth=0', '45');
  await page.click('.class-chip:has-text("ม.1/1")');
  check('เลือกห้องแล้วแสดงรายชื่อเฉพาะห้องนั้น (4 คน)', (await page.locator('.name-btn').count()) === 4);
  await page.click('.name-btn:has-text("กิตติพงษ์")');
  check('แสดงแถบเตือนแพ้ยาเมื่อเลือกนักเรียน', await page.locator('.alert.danger:has-text("แพ้ยา")').isVisible());
  check('มีช่องอุณหภูมิ (°C) ในหน้าบันทึก', await page.locator('#tempInput').isVisible() && await page.locator('.temp-unit:has-text("°C")').isVisible());
  await page.click('.chip:has-text("ปวดศีรษะ")');
  await page.click('.sticky-actions .btn.primary');
  check('ไม่ใส่อุณหภูมิจะไม่บันทึก', await page.locator('.toast.error:has-text("กรุณาใส่อุณหภูมิร่างกาย")').isVisible());
  await page.fill('#tempInput', '385');
  await page.locator('#tempInput').blur();
  check('พิมพ์ 385 แปลงเป็น 38.5 และเตือนมีไข้', (await page.inputValue('#tempInput')) === '38.5' && await page.locator('.alert.warn:has-text("มีไข้ 38.5")').isVisible());
  await page.fill('#tempInput', '50');
  check('อุณหภูมินอกช่วง 30–45 แจ้งเตือน', await page.locator('.error-text:has-text("30–45")').isVisible());
  await page.fill('#tempInput', '37.8');
  await page.click('.chip:has-text("ให้ยา")');
  await page.selectOption('.med-name', 'ยาธาตุน้ำขาว');
  check('เลือกยาน้ำแล้วหน่วยเป็น "ช้อนชา" อัตโนมัติ', await page.locator('.med-item .chip.on:has-text("ช้อนชา"), .med-item .chip[aria-pressed=true]:has-text("ช้อนชา")').count() === 1);
  await page.selectOption('.med-name', 'พาราเซตามอล 500 มก.');
  check('เลือกยาเม็ดแล้วหน่วยเป็น "เม็ด"', await page.locator('.med-item .chip.on:has-text("เม็ด"), .med-item .chip[aria-pressed=true]:has-text("เม็ด")').count() === 1);
  await page.click('.step-btn[aria-label="เพิ่มจำนวน"]');
  check('ปุ่ม + เพิ่มจำนวนทีละครึ่ง', (await page.inputValue('.qty-input')) === '1.5');
  check('เตือนเมื่อเลือกยาที่แพ้', await page.locator('text=ระวัง! นักเรียนแพ้ยา').isVisible());
  await page.screenshot({ path: path.join(OUT, 'mobile-02-record-allergy.png'), fullPage: true });
  await page.click('.sticky-actions .btn.primary');
  check('ยืนยันอีกครั้งก่อนบันทึกยาที่แพ้', await page.locator('.modal:has-text("ยืนยันว่าจะบันทึก")').isVisible());
  await page.click('.modal button:has-text("ยกเลิก")');
  // เพิ่มยาชนิดใหม่ที่ไม่มีในรายการ แล้วใช้ยานั้นแทน
  await page.selectOption('.med-name', '__new__');
  await page.fill('#medNameInput', 'ยาแก้ไอน้ำดำ');
  await page.click('.modal .chip:has-text("ช้อนชา")');
  await page.click('.modal button:has-text("บันทึก")');
  await page.waitForSelector('.toast:has-text("เพิ่มยาแล้ว")');
  check('เพิ่มยาชนิดใหม่ได้ และเลือกให้ทันทีพร้อมหน่วย', (await page.inputValue('.med-name')) === 'ยาแก้ไอน้ำดำ' && await page.locator('.med-item .chip.on:has-text("ช้อนชา"), .med-item .chip[aria-pressed=true]:has-text("ช้อนชา")').count() === 1);
  await page.click('.chip:has-text("ให้นอนพัก")');
  await page.click('.sticky-actions .btn.primary');
  await page.waitForSelector('#view-home:not(.hidden) .stats');
  check('บันทึกแล้วกลับหน้าวันนี้และมีคนพักเพิ่มเป็น 3', (await page.locator('#view-home button:has-text("ออกจากห้อง")').count()) === 3);
  check('เวลาเข้าที่เลือก (13:45) ถูกบันทึกแบบ HH:mm', await page.locator('#view-home :text("เข้า 13:45")').first().isVisible());
  check('หน้าแรกแสดงอุณหภูมิของนักเรียน', await page.locator('#view-home .item:has-text("13:45"):has-text("37.8")').first().isVisible());
  check('หัวเว็บแสดงชื่อโรงเรียน', ((await page.textContent('#topSchool')) || '').includes('โรงเรียน'));
  // ยาใหม่ยังอยู่ในรายการเมื่อเปิดหน้าบันทึกใหม่
  await page.click('.nav button[data-view=record]');
  await page.click('.chip:has-text("ให้ยา")');
  check('ยาที่เพิ่มใหม่อยู่ในรายการยาถาวร', (await page.locator('.med-name option[value="ยาแก้ไอน้ำดำ"]').count()) === 1);
  await page.click('.nav button[data-view=home]');
  await page.waitForSelector('#view-home:not(.hidden) .stats');

  // ลงเวลาออก: ผู้ปกครองรับกลับ
  await page.locator('.item:has-text("ปวดศีรษะ")').first().locator('text=ออกจากห้อง').click().catch(async () => {
    await page.locator('text=ออกจากห้อง').first().click();
  });
  await page.click('.modal .chip:has-text("ผู้ปกครองรับกลับบ้าน")');
  check('แสดงเบอร์โทรผู้ปกครองและไม่มีช่องแจ้งผู้ปกครอง', await page.locator('.modal a[href^="tel:"]').isVisible() && (await page.locator('.modal input[type=checkbox]').count()) === 0);
  await page.screenshot({ path: path.join(OUT, 'mobile-03-checkout.png') });
  await page.click('.modal button:has-text("บันทึกเวลาออก")');
  await page.waitForSelector('.toast:has-text("บันทึกเวลาออกแล้ว")');
  await page.waitForTimeout(300);
  check('ลงเวลาออกแล้วเหลือคนพัก 2 คน', (await page.locator('#view-home button:has-text("ออกจากห้อง")').count()) === 2);
  // ออกจากห้องจากหน้ารายละเอียด (ประวัติ) ก็ลงเวลาอัตโนมัติ
  await page.click('.nav button[data-view=history]');
  await page.locator('#view-history .item:has-text("อยู่ในห้องพยาบาล")').first().click();
  await page.click('.modal button:text-is("ออกจากห้อง")');
  check('รายละเอียด → ออกจากห้อง เปิดหน้าลงเวลาออกพร้อมเวลาอัตโนมัติ', await page.locator('.modal .alert.ok:has-text("เวลาออก")').isVisible());
  await page.click('.modal .chip:has-text("กลับเข้าเรียน")');
  await page.click('.modal button:has-text("บันทึกเวลาออก")');
  await page.waitForSelector('.toast:has-text("บันทึกเวลาออกแล้ว")');
  await page.click('.nav button[data-view=home]');
  await page.waitForSelector('#view-home:not(.hidden) .stats');
  check('ลงเวลาออกจากหน้าประวัติแล้วเหลือคนพัก 1 คน', (await page.locator('#view-home button:has-text("ออกจากห้อง")').count()) === 1);

  // ครู/บุคลากร: เพิ่มชื่อใหม่จากหน้าบันทึก แล้วบันทึกการมาได้ทันที
  await page.click('.nav button[data-view=record]');
  await page.click('.class-chip:has-text("ครู/บุคลากร")');
  check('ครู/บุคลากร: แสดงรายชื่อ 2 คนจากข้อมูลตัวอย่าง', (await page.locator('.name-btn').count()) === 2);
  await page.click('button:has-text("+ เพิ่มชื่อครู/บุคลากร")');
  await page.fill('.modal .grid-3 input >> nth=0', 'นางสาว');
  await page.fill('.modal .grid-3 input >> nth=1', 'มาลี');
  await page.fill('.modal .grid-3 input >> nth=2', 'ทดสอบครู');
  await page.click('.modal button:has-text("บันทึก")');
  await page.waitForSelector('#view-record .student-card:has-text("มาลี")');
  check('ครู/บุคลากร: เพิ่มชื่อแล้วเลือกให้ทันที เลข T003', await page.locator('#view-record .student-card:has-text("ครู/บุคลากร · T003")').isVisible());
  await page.fill('#tempInput', '36.6');
  await page.click('.chip:has-text("ปวดศีรษะ")');
  await page.click('.sticky-actions .btn.primary');
  await page.waitForSelector('#view-home:not(.hidden) .stats');
  check('ครู/บุคลากร: บันทึกการมาห้องพยาบาลได้', await page.locator('#view-home .item:has-text("มาลี")').first().isVisible());
  await page.locator('#view-home .item:has-text("มาลี") button:has-text("ออกจากห้อง")').click();
  await page.click('.modal .chip:has-text("กลับเข้าเรียน")');
  await page.click('.modal button:has-text("บันทึกเวลาออก")');
  await page.waitForSelector('.toast:has-text("บันทึกเวลาออกแล้ว")');

  // ไม่เลือกนักเรียนแล้วกดบันทึก → แจ้งเตือน
  await page.click('.nav button[data-view=record]');
  await page.click('.sticky-actions .btn.primary');
  check('ตรวจข้อมูล: ไม่เลือกนักเรียนจะไม่บันทึก', await page.locator('.toast.error:has-text("กรุณาเลือกนักเรียน")').isVisible());

  // ประวัติ + รายละเอียด + แก้ไข
  await page.click('.nav button[data-view=history]');
  await page.waitForSelector('#view-history h2:has-text("พบ")');
  await page.screenshot({ path: path.join(OUT, 'mobile-04-history.png'), fullPage: false });
  await page.locator('#view-history .item').first().click();
  check('เปิดรายละเอียดรายการได้', await page.locator('.modal:has-text("เลขที่รายการ")').isVisible());
  check('ประวัติ: ช่องวันที่แสดงเป็นภาษาไทย', /25\d\d$/.test((await page.textContent('#view-history .th-date .th-shown')).trim()));
  await page.screenshot({ path: path.join(OUT, 'mobile-05-detail.png') });
  await page.click('.modal button:has-text("แก้ไข")');
  check('เปิดหน้าแก้ไขรายการได้', await page.locator('#view-record h2:has-text("แก้ไขรายการ")').isVisible());
  await page.fill('#view-record textarea', 'แก้ไขทดสอบ');
  await page.click('.sticky-actions .btn.primary');
  await page.waitForSelector('#view-history:not(.hidden) h2:has-text("พบ")');
  check('บันทึกการแก้ไขแล้วกลับหน้าประวัติ', true);

  // รายงาน
  await page.click('.nav button[data-view=report]');
  await page.waitForSelector('#view-report .bars');
  await page.screenshot({ path: path.join(OUT, 'mobile-06-report.png'), fullPage: true });
  check('รายงานแสดงกราฟอาการ', (await page.locator('#view-report .bar-row').count()) > 3);
  check('รายงาน: ไม่มีปุ่มพิมพ์รายงาน', (await page.locator('#view-report button:has-text("พิมพ์")').count()) === 0);
  check('รายงาน: หัวกราฟบอกหน่วย "คน" และ "ร้อยละ"', (await page.locator('#view-report .bar-head:has-text("คน")').count()) >= 4 && (await page.locator('#view-report .bar-head:has-text("ร้อยละ")').count()) >= 2);
  check('รายงาน: ตัวเลขสรุปมีหน่วย', (await page.locator('#view-report .stat .unit').count()) === 4);
  check('รายงาน: แยกกลุ่มครู/บุคลากร', await page.locator('#view-report .bar-row:has-text("ครู/บุคลากร")').isVisible());
  check('รายงาน: มีหัวข้ออุณหภูมิร่างกาย', await page.locator('#view-report h3:has-text("อุณหภูมิ")').isVisible());

  // นักเรียน: นำเข้า CSV
  await page.click('.nav button[data-view=students]');
  await page.click('text=นำเข้าจาก Excel');
  const csv = path.join(OUT, '..', 'import-sample.csv');
  fs.writeFileSync(csv, '﻿รายชื่อนักเรียน ปีการศึกษา 2569\n\nเลขประจำตัว,ชื่อ-สกุล,ชั้น,โรคประจำตัว\n37001,เด็กชาย ทดสอบ นำเข้า,ม.1/3,\n37002,เด็กหญิง ตัวอย่าง ไฟล์,ม.1/3,ลมชัก\n,ไม่มีเลข,ม.1/3,\n');
  await page.setInputFiles('.modal input[type=file]', csv);
  await page.waitForSelector('.modal :text("พร้อมนำเข้า 2 คน")');
  check('จับคอลัมน์อัตโนมัติ + แยกคำนำหน้า/ชั้น/ห้อง', await page.locator('.modal td:has-text("เด็กชาย ทดสอบ นำเข้า")').isVisible() && await page.locator('.modal td:has-text("ม.1/3")').first().isVisible());
  await page.screenshot({ path: path.join(OUT, 'mobile-07-import.png'), fullPage: false });
  await page.click('.modal button:has-text("นำเข้า")');
  await page.waitForSelector('.toast:has-text("เพิ่มใหม่ 2 คน")');
  check('นำเข้า CSV สำเร็จ 2 คน', true);

  // ไฟล์แบบโรงเรียนจริง: แยกแท็บละห้อง ("1 ทับ 1"), มีหัวกระดาษ 5 แถว, คำนำหน้าติดชื่อ, เลขประจำตัวขึ้นต้นด้วย 0
  const XLSX = require('xlsx');
  const wb = XLSX.utils.book_new();
  [['1 ทับ 1', ['09001', 'เด็กชายสมมติ  หนึ่ง'], ['09002', 'เด็กหญิงสมมติ สอง']], [' 5 ทับ2', ['09003', 'นายสมมติ  สาม']], ['6ทับ 1', ['09004', 'นางสาวสมมติ สี่']]]
    .forEach(([name, ...people]) => {
      const aoa = [['', 'โรงเรียนตัวอย่าง'], ['', 'รายชื่อนักเรียน ภาคเรียนที่ 2/2569'], ['', 'ครูที่ปรึกษา ...'], ['', ''], [], ['', 'ที่', 'เลขประจำตัว', 'ชื่อ - สกุล']]
        .concat(people.map((x, i) => ['', String(i + 1), x[0], x[1]]));
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      people.forEach((x, i) => { ws['C' + (7 + i)] = { t: 's', v: x[0] }; });
      XLSX.utils.book_append_sheet(wb, ws, name);
    });
  const xlsxPath = path.join(OUT, '..', 'import-multi.xlsx');
  XLSX.writeFile(wb, xlsxPath);
  await page.click('text=นำเข้าจาก Excel');
  await page.setInputFiles('.modal input[type=file]', xlsxPath);
  await page.waitForSelector('.modal :text("พร้อมนำเข้า 4 คน")');
  check('ไฟล์หลายแท็บ: อ่านชั้น/ห้องจากชื่อแท็บ', await page.locator('.modal td:has-text("ม.5/2")').first().isVisible() && await page.locator('.modal td:has-text("ม.6/1")').first().isVisible());
  check('ไฟล์หลายแท็บ: แยกคำนำหน้าที่ติดชื่อ + เก็บเลข 0 นำหน้า', await page.locator('.modal td:has-text("เด็กชาย สมมติ หนึ่ง")').isVisible() && await page.locator('.modal td:text-is("09001")').isVisible());
  await page.click('.modal button:has-text("นำเข้า")');
  await page.waitForSelector('.toast:has-text("เพิ่มใหม่ 4 คน")');
  check('นำเข้าไฟล์หลายแท็บสำเร็จ 4 คน', true);
  check('ไม่มี JavaScript error บนมือถือ', errors.length === 0);
  if (errors.length) console.log(errors);
  await ctx.close();

  /* ---------- แท็บเล็ต / คอม: ภาพหน้าจอ ---------- */
  for (const [name, vp] of [['tablet', { width: 820, height: 1180 }], ['desktop', { width: 1366, height: 900 }]]) {
    const p = await newPage(browser, vp);
    await p.page.screenshot({ path: path.join(OUT, name + '-01-home.png'), fullPage: true });
    await p.page.click('.nav button[data-view=record]');
    await p.page.click('.class-chip:has-text("ม.4/1")');
    await p.page.click('.name-btn >> nth=0');
    await p.page.fill('#tempInput', '36.7');
    await p.page.screenshot({ path: path.join(OUT, name + '-02-record.png'), fullPage: true });
    await p.page.click('.nav button[data-view=report]');
    await p.page.waitForSelector('#view-report .bars');
    await p.page.screenshot({ path: path.join(OUT, name + '-03-report.png'), fullPage: true });
    {
      const [dl] = await Promise.all([p.page.waitForEvent('download', { timeout: 60000 }), p.page.click('button:has-text("ส่งออก PDF")')]);
      const pdfPath = path.join(OUT, name + '-export.pdf');
      await dl.saveAs(pdfPath);
      const buf = fs.readFileSync(pdfPath);
      check(name + ': ส่งออก PDF ได้ไฟล์ ' + dl.suggestedFilename(), buf.slice(0, 4).toString() === '%PDF' && buf.length > 20000);
    }
    const overflow = await p.page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    check(name + ': ไม่มีการเลื่อนแนวนอน', !overflow);
    check(name + ': ไม่มี JavaScript error', p.errors.length === 0);
    await p.ctx.close();
  }

  await browser.close();
  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
