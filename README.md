# ระบบบันทึกการเข้าใช้ห้องพยาบาลโรงเรียน

เว็บแอปให้ครูห้องพยาบาลบันทึกว่านักเรียนคนไหนมา เวลาไหน อาการอะไร ได้รับการดูแล/ยาอะไร และจัดการอย่างไร (กลับเข้าเรียน, ผู้ปกครองรับกลับ, ส่งต่อ รพ.สต./โรงพยาบาล) แทนการบันทึกบนกระดาษ พร้อมรายงานสรุปรายเดือน/รายภาคเรียนที่พิมพ์ได้

- **เทคโนโลยี:** Google Apps Script (HTML Service) + Google Sheets
- **ค่าใช้จ่ายรายเดือน:** 0 บาท (ใช้บัญชี Gmail ของครู)
- **ใช้งานได้บน:** มือถือ แท็บเล็ต คอมพิวเตอร์

## ฟีเจอร์ (MVP)

| หน้า | ทำอะไรได้ |
| --- | --- |
| วันนี้ | สรุปตัวเลขวันนี้, รายชื่อนักเรียนที่ยังพักอยู่ + ปุ่ม "ออกจากห้อง", รายการวันนี้ |
| บันทึก | ค้นนักเรียน → เตือนแพ้ยา/โรคประจำตัว → แตะเลือกอาการ การดูแล ยา ผลการจัดการ → บันทึก |
| ประวัติ | ค้นตามช่วงวัน ชื่อ ชั้น ผลการจัดการ, ดูรายละเอียด, แก้ไข, ยกเลิกรายการที่บันทึกผิด |
| รายงาน | สรุปตามอาการ ชั้น ผลการจัดการ การดูแล ยาที่ใช้ รายการส่งต่อ นักเรียนที่มาบ่อย + พิมพ์ A4 |
| นักเรียน | นำเข้ารายชื่อจาก Excel/CSV (จับคอลัมน์อัตโนมัติ), เพิ่ม/แก้ไขทีละคน รวมข้อมูลแพ้ยา โรคประจำตัว เบอร์ผู้ปกครอง |

## โครงสร้างโปรเจกต์

```
src/                    ← โค้ดที่อยู่ใน Apps Script จริง
  appsscript.json       manifest (timezone, สิทธิ์, ตั้งค่า web app)
  Config.gs             ชื่อชีต คอลัมน์ ตัวเลือกเริ่มต้น
  Db.gs                 อ่าน/เขียนชีต, ล็อก, กันสูตรแทรก, migration คอลัมน์
  Code.gs               doGet, setupSheets, handle_ (จัดการ error + ErrorLog), apiBootstrap
  Students.gs           apiImportStudents, apiSaveStudent
  Visits.gs             apiSaveVisit, apiCheckout, apiVoidVisit, apiListVisits, apiToday
  Reports.gs            apiReport
  Index.html            โครงหน้าเว็บ
  Styles.html           CSS (mobile-first + หน้าพิมพ์)
  App.html              JavaScript ฝั่งหน้าเว็บ
tests/
  gas-mock.js           จำลอง SpreadsheetApp/LockService/Utilities บน Node
  server.test.js        ทดสอบฝั่งเซิร์ฟเวอร์ (14 กรณี)
  e2e.cjs               ทดสอบหน้าเว็บด้วย Playwright (มือถือ/แท็บเล็ต/คอม)
dev/
  server.js, seed.js    เซิร์ฟเวอร์จำลอง + ข้อมูลตัวอย่าง (ชื่อปลอม)
docs/                   คู่มือติดตั้ง คู่มือครู คู่มืออัปเดต หนังสือยินยอม
```

## โครงสร้างข้อมูล (Google Sheets)

| ชีต | 1 แถว = | คีย์ |
| --- | --- | --- |
| `Students` | นักเรียน 1 คน | `student_id` (ไม่ลบ ใช้ `active = FALSE`) |
| `Visits` | การเข้าห้องพยาบาล 1 ครั้ง | `visit_id` เช่น `V-20261119-0001`, FK `student_id` |
| `VisitMedicines` | ยา 1 รายการในการเข้า 1 ครั้ง | FK `visit_id` |
| `Settings` | ตัวเลือก 1 รายการ | `list_type` = symptom / care / medicine / outcome / school_name |
| `ErrorLog` | ข้อผิดพลาด 1 ครั้ง (ไม่มีข้อมูลนักเรียน) | – |

ครูเพิ่ม/ลบ/เรียงตัวเลือกอาการ การดูแล ยา ได้เองในชีต `Settings` (แก้ `sort_order` เพื่อเรียง)

## พัฒนาและทดสอบบนเครื่อง

```bash
npm install                 # ติดตั้ง xlsx (ใช้เฉพาะตอนทดสอบ)
npm test                    # ทดสอบฝั่งเซิร์ฟเวอร์
SEED=1 npm run dev          # เปิด http://localhost:8080 พร้อมข้อมูลตัวอย่าง
node tests/e2e.cjs          # (เปิด dev server ไว้) ทดสอบหน้าเว็บ + เก็บภาพหน้าจอใน screenshots/
```

## ติดตั้งให้ลูกค้า / อัปเดต

- ติดตั้งครั้งแรก: [docs/SETUP_GUIDE.md](docs/SETUP_GUIDE.md)
- อัปเดตโค้ดหลังส่งมอบ: [docs/UPDATE_GUIDE.md](docs/UPDATE_GUIDE.md)
- คู่มือครู: [docs/TEACHER_GUIDE.md](docs/TEACHER_GUIDE.md)
- หนังสือยินยอมให้ผู้พัฒนาเข้าถึงข้อมูล (PDPA): [docs/CONSENT_TEMPLATE.md](docs/CONSENT_TEMPLATE.md)

## ความปลอดภัย

- Web app ตั้ง `executeAs: USER_DEPLOYING` และ `access: MYSELF` → เปิดได้เฉพาะบัญชีครูที่ deploy
- สิทธิ์ที่ขอ: `spreadsheets.currentonly` (เฉพาะไฟล์ชีตนี้) + `script.container.ui` (เมนูในชีต)
- ตรวจข้อมูลซ้ำฝั่งเซิร์ฟเวอร์ทุกครั้ง, จำกัดความยาวข้อความ
- หน้าเว็บใส่ข้อความด้วย `textContent` เท่านั้น (กัน XSS)
- ข้อความที่ขึ้นต้นด้วย `= + - @` ถูกเติม `'` ก่อนเขียนลงชีต (กันสูตรแทรก)
- `LockService` กันการเขียนชนกัน
- ErrorLog ไม่บันทึกชื่อหรืออาการนักเรียน
