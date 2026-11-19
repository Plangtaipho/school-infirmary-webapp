/**
 * Visits.gs
 * บันทึกการเข้าใช้ห้องพยาบาล: เพิ่ม, แก้ไข, ลงเวลาออก, ยกเลิกรายการ, ค้นหา
 */

var STATUS_ACTIVE = 'ปกติ';
var STATUS_VOID = 'ยกเลิก';
var LIST_SEP = ', ';

function isDate_(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s); }
function isTime_(s) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(s); }

function cleanList_(arr, max) {
  if (!Array.isArray(arr)) return [];
  var out = [];
  arr.forEach(function (v) {
    var t = cleanText_(v, 100).replace(/,/g, ' ');
    if (t && out.indexOf(t) === -1) out.push(t);
  });
  return out.slice(0, max || 30);
}

function cleanMedicines_(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, 20).map(function (m) {
    var qty = Number(m && m.quantity);
    return {
      medicine_name: cleanText_(m && m.medicine_name, 100),
      quantity: isFinite(qty) && qty > 0 ? String(Math.min(qty, 1000)) : '',
      unit: cleanText_(m && m.unit, 20)
    };
  }).filter(function (m) { return m.medicine_name; });
}

/** สร้างเลขที่รายการ V-yyyyMMdd-NNNN (ต้องเรียกภายใต้ล็อก) */
function nextVisitId_(visits, dateText) {
  var prefix = 'V-' + dateText.replace(/-/g, '') + '-';
  var max = 0;
  visits.forEach(function (v) {
    if (v.visit_id && v.visit_id.indexOf(prefix) === 0) {
      var n = Number(v.visit_id.slice(prefix.length));
      if (n > max) max = n;
    }
  });
  return prefix + ('000' + (max + 1)).slice(-4);
}

function validateVisit_(input, student) {
  if (!student) throw appError_('ERR-VISIT-STUDENT', 'ไม่พบนักเรียนคนนี้ในรายชื่อ');
  if (!isDate_(input.visit_date)) throw appError_('ERR-VISIT-DATE', 'วันที่ไม่ถูกต้อง');
  if (!isTime_(input.time_in)) throw appError_('ERR-VISIT-TIME', 'เวลาเข้าไม่ถูกต้อง');
  if (input.time_out && !isTime_(input.time_out)) throw appError_('ERR-VISIT-TIME', 'เวลาออกไม่ถูกต้อง');
  if (input.time_out && input.time_out < input.time_in) {
    throw appError_('ERR-VISIT-TIME', 'เวลาออกต้องไม่ก่อนเวลาเข้า');
  }
  if (input.symptoms.length === 0 && !input.symptom_note) {
    throw appError_('ERR-VISIT-SYMPTOM', 'กรุณาเลือกหรือระบุอาการอย่างน้อย 1 อย่าง');
  }
}

function normalizeVisitInput_(input) {
  input = input || {};
  return {
    student_id: cleanStudentId_(input.student_id),
    visit_date: cleanText_(input.visit_date, 10),
    time_in: cleanText_(input.time_in, 5),
    time_out: cleanText_(input.time_out, 5),
    symptoms: cleanList_(input.symptoms),
    symptom_note: cleanText_(input.symptom_note),
    care_types: cleanList_(input.care_types),
    medicines: cleanMedicines_(input.medicines),
    outcome: cleanText_(input.outcome, 50),
    referral_place: cleanText_(input.referral_place, 200),
    parent_notified: input.parent_notified ? 'TRUE' : 'FALSE',
    note: cleanText_(input.note)
  };
}

/** เพิ่มรายการใหม่ (ไม่มี visit_id) หรือแก้ไขรายการเดิม (มี visit_id) */
function apiSaveVisit(rawInput) {
  return handle_('saveVisit', function () {
    var input = normalizeVisitInput_(rawInput);
    var editId = cleanText_(rawInput && rawInput.visit_id, 20);
    return withLock_(function () {
      var students = readTable_(SHEETS.STUDENTS);
      var student = students.filter(function (s) { return s.student_id === input.student_id; })[0];
      validateVisit_(input, student);

      var visits = readTable_(SHEETS.VISITS);
      var now = nowText_();
      var rec = {
        visit_date: input.visit_date,
        time_in: input.time_in,
        time_out: input.time_out,
        student_id: student.student_id,
        student_name: [student.prefix, student.first_name, student.last_name].join(' ').replace(/\s+/g, ' ').trim(),
        grade: student.grade,
        room: student.room,
        symptoms: input.symptoms.join(LIST_SEP),
        symptom_note: input.symptom_note,
        care_types: input.care_types.join(LIST_SEP),
        outcome: input.outcome,
        referral_place: input.referral_place,
        parent_notified: input.parent_notified,
        note: input.note,
        status: STATUS_ACTIVE,
        updated_at: now
      };

      if (editId) {
        var old = visits.filter(function (v) { return v.visit_id === editId; })[0];
        if (!old) throw appError_('ERR-VISIT-NOTFOUND', 'ไม่พบรายการที่ต้องการแก้ไข');
        rec.visit_id = old.visit_id;
        rec.created_at = old.created_at;
        rec.status = old.status || STATUS_ACTIVE;
        // ถ้าแก้ไขรายการเก่า ให้คงชั้น/ห้อง ณ วันที่มา (นักเรียนอาจเลื่อนชั้นแล้ว)
        if (old.student_id === rec.student_id) {
          rec.grade = old.grade;
          rec.room = old.room;
        }
        updateRow_(SHEETS.VISITS, old._row, rec);
        var oldMeds = readTable_(SHEETS.VISIT_MEDICINES)
          .filter(function (m) { return m.visit_id === editId; })
          .map(function (m) { return m._row; });
        deleteRows_(SHEETS.VISIT_MEDICINES, oldMeds);
      } else {
        rec.visit_id = nextVisitId_(visits, input.visit_date);
        rec.created_at = now;
        appendRows_(SHEETS.VISITS, [rec]);
      }
      appendRows_(SHEETS.VISIT_MEDICINES, input.medicines.map(function (m) {
        return { visit_id: rec.visit_id, medicine_name: m.medicine_name, quantity: m.quantity, unit: m.unit };
      }));
      return getVisit_(rec.visit_id);
    });
  });
}

/** ลงเวลาออกจากห้องพยาบาล พร้อมผลการจัดการ */
function apiCheckout(visitId, outcome, referralPlace, parentNotified) {
  return handle_('checkout', function () {
    return withLock_(function () {
      var id = cleanText_(visitId, 20);
      var v = readTable_(SHEETS.VISITS).filter(function (x) { return x.visit_id === id; })[0];
      if (!v) throw appError_('ERR-VISIT-NOTFOUND', 'ไม่พบรายการนี้');
      var t = timeText_();
      v.time_out = t < v.time_in ? v.time_in : t;
      if (outcome) v.outcome = cleanText_(outcome, 50);
      if (referralPlace !== undefined && referralPlace !== null && referralPlace !== '') {
        v.referral_place = cleanText_(referralPlace, 200);
      }
      if (parentNotified !== undefined && parentNotified !== null) {
        v.parent_notified = parentNotified ? 'TRUE' : 'FALSE';
      }
      v.updated_at = nowText_();
      updateRow_(SHEETS.VISITS, v._row, v);
      return getVisit_(id);
    });
  });
}

/** ยกเลิกรายการที่บันทึกผิด (ไม่ลบจริง เพื่อให้ตรวจสอบย้อนหลังได้) */
function apiVoidVisit(visitId) {
  return handle_('voidVisit', function () {
    return withLock_(function () {
      var id = cleanText_(visitId, 20);
      var v = readTable_(SHEETS.VISITS).filter(function (x) { return x.visit_id === id; })[0];
      if (!v) throw appError_('ERR-VISIT-NOTFOUND', 'ไม่พบรายการนี้');
      v.status = STATUS_VOID;
      v.updated_at = nowText_();
      updateRow_(SHEETS.VISITS, v._row, v);
      return true;
    });
  });
}

function medicinesByVisit_() {
  var map = {};
  readTable_(SHEETS.VISIT_MEDICINES).forEach(function (m) {
    (map[m.visit_id] = map[m.visit_id] || []).push({
      medicine_name: m.medicine_name, quantity: m.quantity, unit: m.unit
    });
  });
  return map;
}

function publicVisit_(v, meds) {
  return {
    visit_id: v.visit_id,
    visit_date: v.visit_date,
    time_in: v.time_in,
    time_out: v.time_out || '',
    student_id: v.student_id,
    student_name: v.student_name,
    grade: v.grade,
    room: v.room,
    symptoms: v.symptoms ? v.symptoms.split(LIST_SEP) : [],
    symptom_note: v.symptom_note || '',
    care_types: v.care_types ? v.care_types.split(LIST_SEP) : [],
    medicines: meds || [],
    outcome: v.outcome || '',
    referral_place: v.referral_place || '',
    parent_notified: v.parent_notified === 'TRUE',
    note: v.note || '',
    status: v.status || STATUS_ACTIVE
  };
}

function getVisit_(id) {
  var v = readTable_(SHEETS.VISITS).filter(function (x) { return x.visit_id === id; })[0];
  return v ? publicVisit_(v, medicinesByVisit_()[id]) : null;
}

/**
 * ค้นหารายการ
 * filter: { from, to, q, grade, outcome, student_id, includeVoid }
 * คืนสูงสุด 500 รายการล่าสุด
 */
function queryVisits_(filter) {
  filter = filter || {};
  var from = isDate_(filter.from) ? filter.from : '';
  var to = isDate_(filter.to) ? filter.to : '';
  var q = cleanText_(filter.q, 100).toLowerCase();
  var meds = medicinesByVisit_();
  return readTable_(SHEETS.VISITS)
    .filter(function (v) {
      if (!filter.includeVoid && v.status === STATUS_VOID) return false;
      if (from && v.visit_date < from) return false;
      if (to && v.visit_date > to) return false;
      if (filter.grade && v.grade !== filter.grade) return false;
      if (filter.outcome && v.outcome !== filter.outcome) return false;
      if (filter.student_id && v.student_id !== filter.student_id) return false;
      if (q) {
        var hay = (v.student_id + ' ' + v.student_name + ' ' + v.symptoms + ' ' + v.symptom_note).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    })
    .sort(function (a, b) {
      var ka = a.visit_date + a.time_in + a.visit_id;
      var kb = b.visit_date + b.time_in + b.visit_id;
      return ka < kb ? 1 : ka > kb ? -1 : 0;
    })
    .map(function (v) { return publicVisit_(v, meds[v.visit_id]); });
}

function apiListVisits(filter) {
  return handle_('listVisits', function () {
    var all = queryVisits_(filter);
    return { total: all.length, visits: all.slice(0, 500) };
  });
}

/** ข้อมูลหน้าหลัก: รายการวันนี้ + คนที่ยังอยู่ในห้องพยาบาล */
function apiToday() {
  return handle_('today', function () {
    var today = todayText_();
    var visits = queryVisits_({ from: today, to: today });
    var waiting = queryVisits_({}).filter(function (v) { return !v.time_out; });
    return {
      today: today,
      visits: visits,
      inRoom: waiting,
      count: visits.length,
      referred: visits.filter(function (v) { return OUTCOME_REFERRAL.indexOf(v.outcome) !== -1; }).length,
      sentHome: visits.filter(function (v) { return v.outcome === 'ผู้ปกครองรับกลับบ้าน'; }).length
    };
  });
}
