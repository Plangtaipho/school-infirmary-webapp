/**
 * dev/seed.js — ข้อมูลตัวอย่าง (ชื่อปลอมทั้งหมด) สำหรับทดสอบหน้าเว็บ
 */
const FIRST_M = ['ธนกร', 'ภูมิพัฒน์', 'กิตติพงษ์', 'ณัฐวุฒิ', 'ปิยะพงษ์', 'วรเมธ', 'อนุชา', 'ศุภชัย', 'ชยพล', 'ธีรภัทร'];
const FIRST_F = ['พิมพ์ชนก', 'ณัฐธิดา', 'กัญญารัตน์', 'ปวีณา', 'สุภาวดี', 'อรอุมา', 'ชนิดา', 'วริศรา', 'ธนพร', 'มณีรัตน์'];
const LAST = ['ศรีสุข', 'แก้วมณี', 'ทองดี', 'บุญมา', 'สายใจ', 'พรหมมา', 'จันทร์เพ็ญ', 'วงศ์ใหญ่', 'สมบูรณ์', 'ใจงาม'];

function seed(gas) {
  const students = [];
  let n = 0;
  ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'].forEach((grade, gi) => {
    for (let room = 1; room <= 2; room++) {
      for (let k = 0; k < 4; k++) {
        const male = (n + k) % 2 === 0;
        const junior = gi < 3;
        students.push({
          student_id: String(36001 + n),
          prefix: male ? (junior ? 'ด.ช.' : 'นาย') : (junior ? 'ด.ญ.' : 'นางสาว'),
          first_name: (male ? FIRST_M : FIRST_F)[n % 10],
          last_name: LAST[(n * 3) % 10],
          grade, room: String(room),
          drug_allergy: n % 13 === 2 ? 'พาราเซตามอล' : n % 17 === 5 ? 'เพนิซิลลิน' : '',
          chronic_disease: n % 11 === 3 ? 'หอบหืด' : n % 19 === 7 ? 'ภูมิแพ้อากาศ' : '',
          parent_phone: '08' + String(10000000 + n * 7919).slice(0, 8)
        });
        n++;
      }
    }
  });
  gas.apiImportStudents(students, false);

  const today = gas.todayText_();
  const [y, m, d] = today.split('-').map(Number);
  const symptoms = gas.DEFAULT_SETTINGS.symptom;
  const outcomes = ['กลับเข้าเรียน', 'กลับเข้าเรียน', 'กลับเข้าเรียน', 'ผู้ปกครองรับกลับบ้าน', 'ส่งต่อ รพ.สต.', 'ส่งต่อโรงพยาบาล'];
  let seedN = 7;
  const rnd = (k) => { seedN = (seedN * 9301 + 49297) % 233280; return Math.floor(seedN / 233280 * k); };
  for (let day = 1; day < d; day++) {
    const date = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dow = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
    if (dow === 0 || dow === 6) continue;
    const count = 1 + rnd(4);
    for (let i = 0; i < count; i++) {
      const s = students[rnd(students.length)];
      const sym = [symptoms[[0, 0, 1, 2, 2, 3, 5, 9, 10, 7][rnd(10)]]];
      const giveMed = rnd(3) > 0 && !s.drug_allergy;
      const hh = 8 + rnd(7);
      const outcome = outcomes[rnd(outcomes.length)];
      gas.apiSaveVisit({
        student_id: s.student_id, visit_date: date,
        time_in: `${String(hh).padStart(2, '0')}:${String(rnd(6) * 10).padStart(2, '0')}`,
        time_out: `${String(hh + 1).padStart(2, '0')}:00`,
        symptoms: sym, care_types: giveMed ? ['ให้นอนพัก', 'ให้ยา'] : ['ให้นอนพัก'],
        medicines: giveMed ? [{ medicine_name: sym[0] === 'ปวดท้อง' ? 'ยาธาตุน้ำขาว' : 'พาราเซตามอล 500 มก.', quantity: 1, unit: sym[0] === 'ปวดท้อง' ? 'ช้อนชา' : 'เม็ด' }] : [],
        outcome, referral_place: outcome === 'ส่งต่อ รพ.สต.' ? 'รพ.สต.บ้านหนองแวง' : outcome === 'ส่งต่อโรงพยาบาล' ? 'โรงพยาบาลจังหวัด' : ''
      });
    }
  }
  // วันนี้: 2 คนยังพักอยู่ 1 คนกลับเข้าเรียนแล้ว
  gas.apiSaveVisit({ student_id: '36005', visit_date: today, time_in: '08:20', time_out: '09:00', symptoms: ['ปวดท้อง'], care_types: ['ให้ยา'], medicines: [{ medicine_name: 'ยาธาตุน้ำขาว', quantity: 1, unit: 'ช้อนชา' }], outcome: 'กลับเข้าเรียน' });
  gas.apiSaveVisit({ student_id: '36012', visit_date: today, time_in: '09:05', symptoms: ['ไข้', 'ปวดศีรษะ'], symptom_note: 'ไข้ 38.2', care_types: ['ให้นอนพัก', 'เช็ดตัวลดไข้'] });
  gas.apiSaveVisit({ student_id: '36030', visit_date: today, time_in: '09:40', symptoms: ['เวียนศีรษะ'], care_types: ['ให้นอนพัก', 'วัดไข้/วัดความดัน'] });
}

module.exports = { seed };
