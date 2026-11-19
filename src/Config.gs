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
    'referral_place', 'parent_notified', 'note', 'status', 'created_at', 'updated_at'
  ],
  VisitMedicines: ['visit_id', 'medicine_name', 'quantity', 'unit'],
  Settings: ['list_type', 'value', 'sort_order'],
  ErrorLog: ['timestamp', 'code', 'function_name', 'message']
};

// ชีตที่ต้องเก็บทุกคอลัมน์เป็นข้อความ (กัน Sheets แปลงวันที่/เลขศูนย์นำหน้าเอง)
var TEXT_SHEETS = ['Students', 'Visits', 'VisitMedicines', 'Settings'];

var LIST_TYPES = ['symptom', 'care', 'medicine', 'outcome'];

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
  outcome: ['กลับเข้าเรียน', 'ผู้ปกครองรับกลับบ้าน', 'ส่งต่อ รพ.สต.', 'ส่งต่อโรงพยาบาล', 'อื่น ๆ']
};
