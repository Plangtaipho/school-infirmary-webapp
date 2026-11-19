/**
 * Students.gs
 * รายชื่อนักเรียน + ข้อมูลสุขภาพประจำตัว (โรคประจำตัว, แพ้ยา)
 */

var MAX_TEXT = 500;

function listStudents_() {
  return readTable_(SHEETS.STUDENTS)
    .filter(function (s) { return s.active !== 'FALSE'; })
    .map(publicStudent_);
}

function publicStudent_(s) {
  return {
    student_id: s.student_id,
    prefix: s.prefix || '',
    first_name: s.first_name || '',
    last_name: s.last_name || '',
    grade: s.grade || '',
    room: s.room || '',
    chronic_disease: s.chronic_disease || '',
    drug_allergy: s.drug_allergy || '',
    parent_phone: s.parent_phone || ''
  };
}

function cleanText_(v, max) {
  if (v === undefined || v === null) return '';
  return String(v).replace(/\s+/g, ' ').trim().slice(0, max || MAX_TEXT);
}

function cleanStudentId_(v) {
  var id = cleanText_(v, 20).replace(/\s/g, '');
  // Excel มักแปลงเลขประจำตัวเป็นตัวเลข เช่น 12345.0
  id = id.replace(/\.0+$/, '');
  return id;
}

/**
 * นำเข้ารายชื่อนักเรียน (upsert ตาม student_id)
 * - นักเรียนใหม่: เพิ่มแถว
 * - นักเรียนเดิม: อัปเดตชื่อ/ชั้น/ห้อง แต่ไม่ลบข้อมูลสุขภาพเดิมถ้าไฟล์ไม่มีค่า
 * - deactivateMissing: นักเรียนที่ไม่อยู่ในไฟล์จะถูกตั้ง active = FALSE (ไม่ลบประวัติ)
 */
function apiImportStudents(rows, deactivateMissing) {
  return handle_('importStudents', function () {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw appError_('ERR-IMPORT-EMPTY', 'ไม่พบรายชื่อนักเรียนในไฟล์');
    }
    if (rows.length > 5000) {
      throw appError_('ERR-IMPORT-SIZE', 'ไฟล์มีรายชื่อเกิน 5,000 คน กรุณาแบ่งนำเข้า');
    }
    return withLock_(function () {
      var existing = readTable_(SHEETS.STUDENTS);
      var byId = {};
      existing.forEach(function (s) { byId[s.student_id] = s; });
      var seen = {};
      var toAppend = [];
      var updated = 0, added = 0, skipped = 0, deactivated = 0;
      var now = nowText_();

      rows.forEach(function (r) {
        var id = cleanStudentId_(r.student_id);
        var first = cleanText_(r.first_name, 100);
        if (!id || !first || seen[id]) { skipped++; return; }
        seen[id] = true;
        var rec = {
          student_id: id,
          prefix: cleanText_(r.prefix, 30),
          first_name: first,
          last_name: cleanText_(r.last_name, 100),
          grade: cleanText_(r.grade, 30),
          room: cleanText_(r.room, 10),
          chronic_disease: cleanText_(r.chronic_disease),
          drug_allergy: cleanText_(r.drug_allergy),
          parent_phone: cleanText_(r.parent_phone, 50),
          active: 'TRUE',
          updated_at: now
        };
        var old = byId[id];
        if (old) {
          ['chronic_disease', 'drug_allergy', 'parent_phone', 'prefix', 'last_name'].forEach(function (k) {
            if (!rec[k]) rec[k] = old[k] || '';
          });
          updateRow_(SHEETS.STUDENTS, old._row, rec);
          updated++;
        } else {
          toAppend.push(rec);
          added++;
        }
      });
      appendRows_(SHEETS.STUDENTS, toAppend);

      if (deactivateMissing) {
        existing.forEach(function (s) {
          if (!seen[s.student_id] && s.active !== 'FALSE') {
            s.active = 'FALSE';
            s.updated_at = now;
            updateRow_(SHEETS.STUDENTS, s._row, s);
            deactivated++;
          }
        });
      }
      return {
        added: added, updated: updated, skipped: skipped, deactivated: deactivated,
        students: listStudents_()
      };
    });
  });
}

/** เพิ่มหรือแก้ไขนักเรียนทีละคน (รวมข้อมูลสุขภาพ) */
function apiSaveStudent(input) {
  return handle_('saveStudent', function () {
    var id = cleanStudentId_(input && input.student_id);
    var first = cleanText_(input && input.first_name, 100);
    if (!id) throw appError_('ERR-STUDENT-ID', 'กรุณากรอกเลขประจำตัวนักเรียน');
    if (!first) throw appError_('ERR-STUDENT-NAME', 'กรุณากรอกชื่อนักเรียน');
    return withLock_(function () {
      var existing = readTable_(SHEETS.STUDENTS);
      var old = existing.filter(function (s) { return s.student_id === id; })[0];
      var rec = {
        student_id: id,
        prefix: cleanText_(input.prefix, 30),
        first_name: first,
        last_name: cleanText_(input.last_name, 100),
        grade: cleanText_(input.grade, 30),
        room: cleanText_(input.room, 10),
        chronic_disease: cleanText_(input.chronic_disease),
        drug_allergy: cleanText_(input.drug_allergy),
        parent_phone: cleanText_(input.parent_phone, 50),
        active: input.active === false ? 'FALSE' : 'TRUE',
        updated_at: nowText_()
      };
      if (old) {
        if (input.isNew) throw appError_('ERR-STUDENT-DUP', 'เลขประจำตัว ' + id + ' มีอยู่แล้ว');
        updateRow_(SHEETS.STUDENTS, old._row, rec);
      } else {
        appendRows_(SHEETS.STUDENTS, [rec]);
      }
      return { student: publicStudent_(rec), students: listStudents_() };
    });
  });
}
