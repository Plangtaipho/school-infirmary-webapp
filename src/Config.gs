/**
 * Config.gs
 * ค่าคงที่ของระบบ: ชื่อชีต, คอลัมน์, และค่าตัวเลือกเริ่มต้น
 */

var APP_NAME = 'ระบบบันทึกห้องพยาบาล';
var TZ = 'Asia/Bangkok';

var SHEETS = {
  STUDENTS: 'Students',
  VISITS: 'Visits',
  VISIT_MEDICINES: 'VisitMedicines',
  SETTINGS: 'Settings',
  ERROR_LOG: 'ErrorLog'
};

// ลำดับคอลัมน์ของแต่ละชีต (แถวที่ 1 คือหัวตาราง)
// เพิ่มคอลัมน์ใหม่ต่อท้ายเท่านั้น เพื่อไม่ให้ข้อมูลเดิมเลื่อน
var COLUMNS = {
  Students: [
    'student_id', 'prefix', 'first_name', 'last_name', 'grade', 'room',
    'chronic_disease', 'drug_allergy', 'parent_phone', 'active', 'updated_at'
  ],
  Visits: [
    'visit_id', 'visit_date', 'time_in', 'time_out', 'student_id', 'student_name',
    'grade', 'room', 'symptoms', 'symptom_note', 'care_types', 'outcome',
    'referral_place', 'note', 'status', 'created_at', 'updated_at', 'temperature'
  ],
  VisitMedicines: ['visit_id', 'medicine_name', 'quantity', 'unit'],
  Settings: ['list_type', 'value', 'sort_order', 'unit'],
  ErrorLog: ['timestamp', 'code', 'function_name', 'message']
};

// ชีตที่ต้องเก็บทุกคอลัมน์เป็นข้อความ (กัน Sheets แปลงวันที่/เลขศูนย์นำหน้าเอง)
var TEXT_SHEETS = ['Students', 'Visits', 'VisitMedicines', 'Settings'];

// คำอธิบายภาษาไทยของแต่ละคอลัมน์ (แสดงเป็นโน้ตบนหัวตาราง ให้ครูเปิดดูชีตแล้วเข้าใจ)
var HEADER_NOTES = {
  student_id: 'เลขประจำตัวนักเรียน (ห้ามซ้ำ)', prefix: 'คำนำหน้า', first_name: 'ชื่อ', last_name: 'นามสกุล',
  grade: 'ชั้น เช่น ม.1', room: 'ห้อง', chronic_disease: 'โรคประจำตัว', drug_allergy: 'ยาที่แพ้',
  parent_phone: 'เบอร์โทรผู้ปกครอง', active: 'TRUE = ยังเรียนอยู่, FALSE = จบ/ย้ายออก (ซ่อนจากหน้าเว็บ)',
  updated_at: 'แก้ไขล่าสุดเมื่อ', visit_id: 'เลขที่รายการ', visit_date: 'วันที่มา (ปี ค.ศ.-เดือน-วัน)',
  time_in: 'เวลาเข้า', time_out: 'เวลาออก (ว่าง = ยังอยู่ในห้องพยาบาล)', student_name: 'ชื่อนักเรียน ณ วันที่มา',
  symptoms: 'อาการที่เลือก', symptom_note: 'อาการอื่น/รายละเอียด', care_types: 'การดูแล',
  outcome: 'ผลการจัดการ', referral_place: 'สถานที่ส่งต่อ', note: 'หมายเหตุ',
  status: 'ปกติ / ยกเลิก (รายการที่ยกเลิกไม่นับในรายงาน)', created_at: 'บันทึกเมื่อ',
  medicine_name: 'ชื่อยา', quantity: 'จำนวน', unit: 'หน่วย (ในแท็บ Settings = หน่วยเริ่มต้นของยานั้น)',
  temperature: 'อุณหภูมิร่างกาย (องศาเซลเซียส)',
  list_type: 'ประเภทตัวเลือก: symptom=อาการ, care=การดูแล, medicine=ยา, unit=หน่วยยา, outcome=ผลการจัดการ, school_name=ชื่อโรงเรียน',
  value: 'ข้อความที่แสดงในหน้าเว็บ (เพิ่ม/แก้/ลบแถวได้)', sort_order: 'ลำดับการแสดง (เลขน้อยขึ้นก่อน)',
  timestamp: 'เวลาที่เกิดข้อผิดพลาด', code: 'รหัสข้อผิดพลาด', function_name: 'ฟังก์ชัน', message: 'รายละเอียดสำหรับผู้ดูแลระบบ'
};

// สีแท็บและความกว้างคอลัมน์ (พิกเซล)
var SHEET_STYLE = {
  Students: { tab: '#2463a8', widths: { student_id: 110, first_name: 130, last_name: 140, chronic_disease: 180, drug_allergy: 180, parent_phone: 130, updated_at: 150 } },
  Visits: { tab: '#0f7b6c', widths: { visit_id: 150, visit_date: 100, student_name: 200, symptoms: 220, symptom_note: 200, care_types: 200, outcome: 160, referral_place: 180, note: 200, created_at: 150, updated_at: 150 } },
  VisitMedicines: { tab: '#7a5cc2', widths: { visit_id: 150, medicine_name: 220 } },
  Settings: { tab: '#a86400', widths: { list_type: 120, value: 260 } },
  ErrorLog: { tab: '#9aa5a3', widths: { timestamp: 150, code: 160, function_name: 140, message: 420 } }
};

var LIST_TYPES = ['symptom', 'care', 'medicine', 'unit', 'outcome'];

var DEFAULT_SCHOOL_NAME = 'โรงเรียนหนองสวรรค์วิทยาคาร';

// อุณหภูมิ: ช่วงที่รับได้ และเกณฑ์มีไข้ (องศาเซลเซียส)
var TEMP_MIN = 30;
var TEMP_MAX = 45;
var TEMP_FEVER = 37.5;
var TEMP_HIGH_FEVER = 39;

// ผลการจัดการที่นับว่าเป็น "ส่งต่อ" หรือ "กลับบ้าน" (ใช้ในรายงานและการถามแจ้งผู้ปกครอง)
var OUTCOME_NEEDS_PARENT = ['ผู้ปกครองรับกลับบ้าน', 'ส่งต่อ รพ.สต.', 'ส่งต่อโรงพยาบาล'];
var OUTCOME_REFERRAL = ['ส่งต่อ รพ.สต.', 'ส่งต่อโรงพยาบาล'];

var DEFAULT_SETTINGS = {
  symptom: [
    'ปวดศีรษะ', 'ไข้', 'ปวดท้อง', 'ท้องเสีย', 'คลื่นไส้/อาเจียน', 'เวียนศีรษะ',
    'เป็นลม', 'ไอ/เจ็บคอ', 'น้ำมูก', 'ปวดประจำเดือน', 'บาดแผล', 'ฟกช้ำ/เคล็ดขัดยอก',
    'ผื่นคัน/แพ้', 'ปวดฟัน', 'ตาแดง/ระคายเคืองตา', 'หอบ/หายใจลำบาก'
  ],
  care: ['ให้นอนพัก', 'ให้ยา', 'ทำแผล', 'ประคบเย็น', 'ประคบร้อน', 'เช็ดตัวลดไข้', 'วัดไข้/วัดความดัน', 'ให้คำแนะนำ'],
  medicine: [
    'พาราเซตามอล 500 มก.', 'พาราเซตามอลน้ำ (เด็ก)', 'ยาธาตุน้ำขาว', 'ผงเกลือแร่ (ORS)',
    'ยาแก้แพ้ คลอร์เฟนิรามีน', 'ยาหม่อง', 'ยาดม', 'เบตาดีน', 'แอลกอฮอล์ล้างแผล', 'คาลาไมน์'
  ],
  unit: ['เม็ด', 'ช้อนชา', 'ซีซี', 'ซอง', 'ครั้ง (ทา/ดม)', 'แผ่น'],
  outcome: ['กลับเข้าเรียน', 'ผู้ปกครองรับกลับบ้าน', 'ส่งต่อ รพ.สต.', 'ส่งต่อโรงพยาบาล', 'อื่น ๆ']
};

// หน่วยเริ่มต้นของยาแต่ละตัว (เลือกยาแล้วระบบเลือกหน่วยให้ ครูเปลี่ยนได้)
var DEFAULT_MEDICINE_UNITS = {
  'พาราเซตามอล 500 มก.': 'เม็ด', 'พาราเซตามอลน้ำ (เด็ก)': 'ช้อนชา', 'ยาธาตุน้ำขาว': 'ช้อนชา',
  'ผงเกลือแร่ (ORS)': 'ซอง', 'ยาแก้แพ้ คลอร์เฟนิรามีน': 'เม็ด', 'ยาหม่อง': 'ครั้ง (ทา/ดม)',
  'ยาดม': 'ครั้ง (ทา/ดม)', 'เบตาดีน': 'ครั้ง (ทา/ดม)', 'แอลกอฮอล์ล้างแผล': 'ครั้ง (ทา/ดม)', 'คาลาไมน์': 'ครั้ง (ทา/ดม)'
};
