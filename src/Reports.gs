/**
 * Reports.gs
 * สรุปรายงานตามช่วงวันที่ (รายเดือน / รายภาคเรียน / กำหนดเอง)
 */

function countBy_(items, keyFn) {
  var map = {};
  items.forEach(function (it) {
    var keys = keyFn(it);
    (Array.isArray(keys) ? keys : [keys]).forEach(function (k) {
      if (!k) return;
      map[k] = (map[k] || 0) + 1;
    });
  });
  return Object.keys(map)
    .map(function (k) { return { label: k, count: map[k] }; })
    .sort(function (a, b) { return b.count - a.count || (a.label < b.label ? -1 : 1); });
}

function buildReport_(from, to) {
  if (!isDate_(from) || !isDate_(to)) throw appError_('ERR-REPORT-DATE', 'กรุณาเลือกช่วงวันที่ให้ถูกต้อง');
  if (from > to) throw appError_('ERR-REPORT-DATE', 'วันที่เริ่มต้องไม่หลังวันที่สิ้นสุด');
  var visits = queryVisits_({ from: from, to: to });

  var medMap = {};
  visits.forEach(function (v) {
    v.medicines.forEach(function (m) {
      var key = m.medicine_name + '|' + (m.unit || '');
      if (!medMap[key]) medMap[key] = { label: m.medicine_name, unit: m.unit || '', count: 0, quantity: 0 };
      medMap[key].count += 1;
      medMap[key].quantity += Number(m.quantity) || 0;
    });
  });
  var medicines = Object.keys(medMap).map(function (k) { return medMap[k]; })
    .sort(function (a, b) { return b.count - a.count; });

  var perStudent = {};
  visits.forEach(function (v) {
    var p = perStudent[v.student_id] = perStudent[v.student_id] ||
      { student_id: v.student_id, student_name: v.student_name, grade: v.grade, room: v.room, count: 0 };
    p.count++;
  });
  var frequent = Object.keys(perStudent).map(function (k) { return perStudent[k]; })
    .filter(function (p) { return p.count >= 3; })
    .sort(function (a, b) { return b.count - a.count; });

  var referrals = visits
    .filter(function (v) { return OUTCOME_NEEDS_PARENT.indexOf(v.outcome) !== -1; })
    .slice()
    .reverse()
    .map(function (v) {
      return {
        visit_date: v.visit_date, time_in: v.time_in, student_name: v.student_name,
        grade: v.grade, room: v.room, symptoms: v.symptoms.concat(v.symptom_note ? [v.symptom_note] : []).join(', '),
        outcome: v.outcome, referral_place: v.referral_place, temperature: v.temperature
      };
    });

  var byDate = countBy_(visits, function (v) { return v.visit_date; })
    .sort(function (a, b) { return a.label < b.label ? -1 : 1; });

  return {
    from: from,
    to: to,
    generatedAt: nowText_(),
    total: visits.length,
    uniqueStudents: Object.keys(perStudent).length,
    referredCount: visits.filter(function (v) { return OUTCOME_REFERRAL.indexOf(v.outcome) !== -1; }).length,
    sentHomeCount: visits.filter(function (v) { return v.outcome === 'ผู้ปกครองรับกลับบ้าน'; }).length,
    bySymptom: countBy_(visits, function (v) { return v.symptoms.length ? v.symptoms : ['อื่น ๆ (ระบุเอง)']; }),
    byGrade: countBy_(visits, function (v) { return v.grade || 'ไม่ระบุชั้น'; })
      .sort(function (a, b) { return a.label < b.label ? -1 : 1; }),
    byOutcome: countBy_(visits, function (v) { return v.outcome || 'ยังไม่ระบุ'; }),
    byCare: countBy_(visits, function (v) { return v.care_types; }),
    feverCount: visits.filter(function (v) { return v.temperature && Number(v.temperature) >= TEMP_FEVER; }).length,
    byTemperature: ['ปกติ (ต่ำกว่า ' + TEMP_FEVER + ')', 'มีไข้ (' + TEMP_FEVER + '–' + (TEMP_HIGH_FEVER - 0.1).toFixed(1) + ')',
      'ไข้สูง (' + TEMP_HIGH_FEVER + ' ขึ้นไป)', 'ไม่ได้วัด'].map(function (label, i) {
      return { label: label, count: visits.filter(function (v) { return tempBand_(v.temperature) === i; }).length };
    }).filter(function (x) { return x.count > 0; }),
    byDate: byDate,
    medicines: medicines,
    frequent: frequent,
    referrals: referrals
  };
}

/** 0 = ปกติ, 1 = มีไข้, 2 = ไข้สูง, 3 = ไม่ได้วัด */
function tempBand_(t) {
  if (!t || !isFinite(Number(t))) return 3;
  var n = Number(t);
  return n >= TEMP_HIGH_FEVER ? 2 : n >= TEMP_FEVER ? 1 : 0;
}

function apiReport(from, to) {
  return handle_('report', function () { return buildReport_(from, to); });
}
