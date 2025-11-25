(function () {
  const storageKey = 'classroom-app-state';
  const defaultTeacher = { email: 'teacher@classroom.local', password: 'teach123' };
  const initialState = {
    teacherAccount: defaultTeacher,
    teacherSession: false,
    studentSession: null,
    classes: [],
    students: [],
    submissions: [],
    gradeRules: [
      { id: 'project', label: 'Project', maxPoints: 15 },
      { id: 'homework', label: 'Homework', maxPoints: 5 }
    ],
    resubmissionPolicy: { allow: true, strategy: 'latest' },
    archives: []
  };

  const selectors = (sel) => document.querySelector(sel);

  const state = loadState();

  function loadState() {
    try {
      const saved = localStorage.getItem(storageKey);
      if (!saved) return { ...initialState };
      const parsed = JSON.parse(saved);
      return { ...initialState, ...parsed };
    } catch (err) {
      console.warn('Unable to load saved state', err);
      return { ...initialState };
    }
  }

  function persist() {
    localStorage.setItem(storageKey, JSON.stringify(state));
    renderAll();
  }

  function uid(prefix = 'id') {
    return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function setText(el, text) {
    if (el) el.textContent = text;
  }

  function formatDate(value) {
    if (!value) return '—';
    const dt = new Date(value);
    return dt.toLocaleString();
  }

  function loadArchivesDropdown() {
    const select = selectors('#archiveSelect');
    if (!select) return;
    select.innerHTML = '<option value="">Select archived year / اختر سنة مؤرشفة</option>';
    state.archives.forEach((archive) => {
      const option = document.createElement('option');
      option.value = archive.id;
      option.textContent = `${archive.yearLabel} (${new Date(archive.archivedAt).getFullYear()})`;
      select.appendChild(option);
    });
  }

  function authenticateTeacher(email, password) {
    const errorBox = selectors('#teacherLoginError');
    if (!email || !password) {
      setText(errorBox, 'Enter email and password / أدخل البريد وكلمة المرور');
      return;
    }
    if (email === state.teacherAccount.email && password === state.teacherAccount.password) {
      state.teacherSession = true;
      setText(errorBox, '');
    } else {
      setText(errorBox, 'Invalid credentials / بيانات دخول غير صحيحة');
    }
    persist();
  }

  function logoutTeacher() {
    state.teacherSession = false;
    persist();
  }

  function addClass(form) {
    const name = form.className.value.trim();
    const section = form.classSection.value.trim();
    const year = form.classYear.value.trim();
    const error = selectors('#classError');

    if (!name || !section || !year) {
      setText(error, 'All fields required / جميع الحقول مطلوبة');
      return;
    }
    const entry = { id: uid('class'), name, section, year, createdAt: Date.now() };
    state.classes.push(entry);
    form.reset();
    setText(error, '');
    persist();
  }

  function renderClasses() {
    const container = selectors('#classList');
    if (!container) return;
    container.innerHTML = '';
    if (!state.classes.length) {
      container.innerHTML = '<p class="helper-text">No classes yet / لا توجد صفوف.</p>';
      return;
    }

    const table = document.createElement('table');
    table.className = 'table-lite';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Class / الصف</th>
          <th>Section / الشعبة</th>
          <th>Academic Year / السنة</th>
          <th>Actions / إجراءات</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    const tbody = table.querySelector('tbody');
    state.classes.forEach((cls) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${cls.name}</td>
        <td>${cls.section}</td>
        <td>${cls.year}</td>
        <td class="list-inline">
          <button class="flat" data-action="edit" data-id="${cls.id}">Edit / تعديل</button>
          <button class="danger flat" data-action="delete" data-id="${cls.id}">Delete / حذف</button>
        </td>
      `;
      tbody.appendChild(row);
    });

    table.addEventListener('click', (event) => {
      const btn = event.target.closest('button');
      if (!btn) return;
      const id = btn.getAttribute('data-id');
      if (btn.getAttribute('data-action') === 'delete') {
        state.classes = state.classes.filter((c) => c.id !== id);
        state.students = state.students.filter((s) => s.classId !== id);
        state.submissions = state.submissions.filter((s) => s.classId !== id);
        persist();
      }
      if (btn.getAttribute('data-action') === 'edit') {
        const cls = state.classes.find((c) => c.id === id);
        if (!cls) return;
        const form = selectors('#classForm');
        form.className.value = cls.name;
        form.classSection.value = cls.section;
        form.classYear.value = cls.year;
        form.setAttribute('data-edit', id);
        setText(selectors('#classError'), 'Editing entry / تعديل البيانات');
      }
    });

    container.appendChild(table);
  }

  function submitClassForm(event) {
    event.preventDefault();
    const form = event.target;
    const editing = form.getAttribute('data-edit');
    if (editing) {
      const target = state.classes.find((c) => c.id === editing);
      if (target) {
        target.name = form.className.value.trim();
        target.section = form.classSection.value.trim();
        target.year = form.classYear.value.trim();
        setText(selectors('#classError'), 'Updated / تم التحديث');
      }
      form.removeAttribute('data-edit');
      form.reset();
      persist();
      return;
    }
    addClass(form);
  }

  function addStudent(form) {
    const studentName = form.studentName.value.trim();
    const studentId = form.studentId.value.trim();
    const classId = form.studentClass.value;
    const error = selectors('#studentError');

    if (!studentName || !studentId || !classId) {
      setText(error, 'All fields required / جميع الحقول مطلوبة');
      return;
    }
    if (state.students.some((s) => s.studentId === studentId)) {
      setText(error, 'Student ID must be unique / المعرّف يجب أن يكون فريداً');
      return;
    }
    state.students.push({
      id: uid('student'),
      studentId,
      name: studentName,
      classId
    });
    form.reset();
    setText(error, '');
    persist();
  }

  function renderStudents() {
    const container = selectors('#studentList');
    if (!container) return;
    container.innerHTML = '';
    if (!state.students.length) {
      container.innerHTML = '<p class="helper-text">No students yet / لا يوجد طلاب.</p>';
      return;
    }
    const table = document.createElement('table');
    table.className = 'table-lite';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Name / الاسم</th>
          <th>ID</th>
          <th>Class / الصف</th>
          <th>Actions / إجراءات</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector('tbody');
    state.students.forEach((student) => {
      const cls = state.classes.find((c) => c.id === student.classId);
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${student.name}</td>
        <td class="badge">${student.studentId}</td>
        <td>${cls ? cls.name : '—'}</td>
        <td><button class="danger flat" data-id="${student.id}">Remove / حذف</button></td>
      `;
      tbody.appendChild(row);
    });

    table.addEventListener('click', (event) => {
      const btn = event.target.closest('button');
      if (!btn) return;
      const id = btn.getAttribute('data-id');
      state.students = state.students.filter((s) => s.id !== id);
      state.submissions = state.submissions.filter((sub) => sub.studentId !== id);
      if (state.studentSession?.id === id) state.studentSession = null;
      persist();
    });

    container.appendChild(table);
  }

  function populateClassOptions() {
    const select = selectors('#studentClass');
    if (!select) return;
    select.innerHTML = '<option value="">Select class / اختر الصف</option>';
    state.classes.forEach((cls) => {
      const option = document.createElement('option');
      option.value = cls.id;
      option.textContent = `${cls.name} (${cls.section})`;
      select.appendChild(option);
    });
    const classFilter = selectors('#queueFilterClass');
    if (classFilter) {
      classFilter.innerHTML = '<option value="">All / الكل</option>';
      state.classes.forEach((cls) => {
        const option = document.createElement('option');
        option.value = cls.id;
        option.textContent = cls.name;
        classFilter.appendChild(option);
      });
    }
  }

  function renderGradeRules() {
    const list = selectors('#gradeRuleList');
    if (!list) return;
    list.innerHTML = '';
    state.gradeRules.forEach((rule) => {
      const item = document.createElement('div');
      item.className = 'flex-between';
      item.innerHTML = `
        <div><strong>${rule.label}</strong> <span class="helper-text">(${rule.maxPoints} pts)</span></div>
        <div class="list-inline">
          <button class="flat" data-action="edit" data-id="${rule.id}">Edit / تعديل</button>
        </div>
      `;
      list.appendChild(item);
    });

    list.onclick = (event) => {
      const btn = event.target.closest('[data-action="edit"]');
      if (!btn) return;
      const id = btn.getAttribute('data-id');
      const rule = state.gradeRules.find((r) => r.id === id);
      const form = selectors('#ruleForm');
      if (rule && form) {
        form.ruleType.value = rule.id;
        form.ruleLabel.value = rule.label;
        form.rulePoints.value = rule.maxPoints;
      }
    };
  }

  function submitGradeRule(event) {
    event.preventDefault();
    const form = event.target;
    const label = form.ruleLabel.value.trim();
    const points = Number(form.rulePoints.value);
    const type = form.ruleType.value;
    const error = selectors('#ruleError');

    if (!label || !points || points <= 0) {
      setText(error, 'Provide label and points / أدخل الاسم والنقاط');
      return;
    }
    if (type === 'homework' && points > 5) {
      setText(error, 'Homework max is 5 points / الحد الأقصى للواجب 5 نقاط');
      return;
    }
    const existing = state.gradeRules.find((r) => r.id === type);
    if (existing) {
      existing.label = label;
      existing.maxPoints = points;
    } else {
      state.gradeRules.push({ id: type || uid('rule'), label, maxPoints: points });
    }
    form.reset();
    setText(error, '');
    persist();
  }

  function updateResubmission(event) {
    event.preventDefault();
    const allow = event.target.allowResubmission.checked;
    const strategy = event.target.strategy.value;
    state.resubmissionPolicy = { allow, strategy };
    persist();
  }

  function createAttemptFromUpload({ studentId, classId, assignmentName, assignmentType, file }) {
    const errorBox = selectors('#uploadError');
    const maxHomework = (state.gradeRules.find((r) => r.id === 'homework') || { maxPoints: 5 }).maxPoints;
    if (assignmentType === 'homework' && maxHomework > 5) {
      setText(errorBox, 'Homework capped at 5 points / الحد 5 نقاط');
      return null;
    }

    let submission = state.submissions.find((s) => s.studentId === studentId && s.classId === classId && s.assignmentName === assignmentName && s.assignmentType === assignmentType);
    if (!submission) {
      submission = {
        id: uid('submission'),
        studentId,
        classId,
        assignmentName,
        assignmentType,
        attempts: [],
        chosenAttemptId: null
      };
      state.submissions.push(submission);
    }

    const attempt = {
      attemptId: uid('attempt'),
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      fileData: file.data,
      submittedAt: Date.now(),
      status: 'submitted',
      feedback: '',
      score: null,
      underReviewAt: null,
      gradedAt: null,
      returnedAt: null
    };
    submission.attempts.push(attempt);
    submission.chosenAttemptId = chooseAttempt(submission);
    submission.status = 'submitted';
    persist();
    setText(errorBox, '');
    return attempt;
  }

  function chooseAttempt(submission) {
    const policy = state.resubmissionPolicy;
    if (!policy.allow) return submission.chosenAttemptId || (submission.attempts[0] || {}).attemptId;
    if (policy.strategy === 'first') return submission.attempts[0]?.attemptId;
    if (policy.strategy === 'highest') {
      const scored = submission.attempts.filter((a) => typeof a.score === 'number');
      if (scored.length) {
        return scored.reduce((best, current) => (current.score > best.score ? current : best), scored[0]).attemptId;
      }
    }
    if (policy.strategy === 'latest' || !policy.strategy) {
      return submission.attempts[submission.attempts.length - 1]?.attemptId;
    }
    return submission.chosenAttemptId;
  }

  function readFileData(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }

  async function handleStudentUpload(event) {
    event.preventDefault();
    const form = event.target;
    const student = state.studentSession;
    const error = selectors('#uploadError');
    if (!student) {
      setText(error, 'Log in as student / سجّل الدخول كطالب');
      return;
    }
    const assignmentName = form.assignmentName.value.trim();
    const assignmentType = form.assignmentType.value;
    const fileInput = form.uploadFile.files[0];

    if (!assignmentName || !assignmentType || !fileInput) {
      setText(error, 'Fill all fields and attach a file / أكمل الحقول وأرفق ملفاً');
      return;
    }
    if (fileInput.size > 10 * 1024 * 1024) {
      setText(error, 'File too large (10MB max) / حجم الملف كبير');
      return;
    }
    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowed.includes(fileInput.type)) {
      setText(error, 'Unsupported file type / نوع الملف غير مدعوم');
      return;
    }

    try {
      const data = await readFileData(fileInput);
      createAttemptFromUpload({
        studentId: student.id,
        classId: student.classId,
        assignmentName,
        assignmentType,
        file: { name: fileInput.name, type: fileInput.type, size: fileInput.size, data }
      });
      form.reset();
      persist();
    } catch (err) {
      setText(error, 'Upload failed / فشل الرفع');
      console.error(err);
    }
  }

  function renderSubmissions() {
    const container = selectors('#submissionQueue');
    if (!container) return;
    container.innerHTML = '';
    const classFilter = selectors('#queueFilterClass')?.value || '';
    const studentFilter = selectors('#queueFilterStudent')?.value.toLowerCase() || '';
    const statusFilter = selectors('#queueFilterStatus')?.value || '';
    const assignmentFilter = selectors('#queueFilterAssignment')?.value.toLowerCase() || '';

    let rows = [];
    state.submissions.forEach((submission) => {
      submission.attempts.forEach((attempt) => {
        rows.push({ submission, attempt });
      });
    });

    rows = rows.filter(({ submission, attempt }) => {
      const student = state.students.find((s) => s.id === submission.studentId);
      const clsMatch = !classFilter || submission.classId === classFilter;
      const studentMatch = !studentFilter || (student && student.name.toLowerCase().includes(studentFilter));
      const statusMatch = !statusFilter || attempt.status === statusFilter;
      const assignmentMatch = !assignmentFilter || submission.assignmentName.toLowerCase().includes(assignmentFilter);
      return clsMatch && studentMatch && statusMatch && assignmentMatch;
    });

    if (!rows.length) {
      container.innerHTML = '<p class="helper-text">No submissions in queue / لا توجد تسليمات.</p>';
      return;
    }

    const table = document.createElement('table');
    table.className = 'table-lite';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Select</th>
          <th>Student / الطالب</th>
          <th>Assignment / المهمة</th>
          <th>Status / الحالة</th>
          <th>Score / الدرجة</th>
          <th>Timestamps / الأوقات</th>
          <th>Actions / إجراءات</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector('tbody');
    rows.forEach(({ submission, attempt }) => {
      const student = state.students.find((s) => s.id === submission.studentId);
      const cls = state.classes.find((c) => c.id === submission.classId);
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><input type="checkbox" class="bulk-check" data-submission="${submission.id}" data-attempt="${attempt.attemptId}"></td>
        <td>${student ? student.name : '—'}<div class="helper-text">${cls ? cls.name : ''}</div></td>
        <td>${submission.assignmentName}<div class="tag">${submission.assignmentType}</div></td>
        <td><span class="status-chip status-${attempt.status.replace(' ', '-')}">${attempt.status}</span></td>
        <td>${attempt.score ?? '—'}</td>
        <td>
          <div class="helper-text">Submitted: ${formatDate(attempt.submittedAt)}</div>
          <div class="helper-text">Reviewed: ${formatDate(attempt.underReviewAt)}</div>
          <div class="helper-text">Graded: ${formatDate(attempt.gradedAt)}</div>
        </td>
        <td class="list-inline">
          <button class="flat" data-action="preview" data-submission="${submission.id}" data-attempt="${attempt.attemptId}">Preview / معاينة</button>
          <button class="secondary" data-action="review" data-submission="${submission.id}" data-attempt="${attempt.attemptId}">Mark Under Review</button>
          <button class="flat" data-action="grade" data-submission="${submission.id}" data-attempt="${attempt.attemptId}">Grade</button>
        </td>
      `;
      tbody.appendChild(row);
    });

    table.addEventListener('click', (event) => {
      const btn = event.target.closest('button');
      if (!btn) return;
      const submissionId = btn.getAttribute('data-submission');
      const attemptId = btn.getAttribute('data-attempt');
      if (btn.getAttribute('data-action') === 'preview') {
        showPreview(submissionId, attemptId);
      }
      if (btn.getAttribute('data-action') === 'review') {
        setAttemptStatus(submissionId, attemptId, 'under review');
      }
      if (btn.getAttribute('data-action') === 'grade') {
        openGradePrompt(submissionId, attemptId);
      }
    });

    container.appendChild(table);
  }

  function setAttemptStatus(submissionId, attemptId, status) {
    const submission = state.submissions.find((s) => s.id === submissionId);
    const attempt = submission?.attempts.find((a) => a.attemptId === attemptId);
    if (!attempt) return;
    attempt.status = status;
    if (status === 'under review') attempt.underReviewAt = Date.now();
    if (status === 'returned') attempt.returnedAt = Date.now();
    submission.status = status;
    submission.chosenAttemptId = chooseAttempt(submission);
    persist();
  }

  function openGradePrompt(submissionId, attemptId) {
    const scoreValue = prompt('Enter score / أدخل الدرجة');
    const score = Number(scoreValue);
    if (Number.isNaN(score)) return;
    const feedback = prompt('Feedback / ملاحظات') || '';
    gradeAttempt(submissionId, attemptId, score, feedback);
  }

  function gradeAttempt(submissionId, attemptId, score, feedback) {
    const submission = state.submissions.find((s) => s.id === submissionId);
    const attempt = submission?.attempts.find((a) => a.attemptId === attemptId);
    if (!attempt) return;
    const maxPoints = (state.gradeRules.find((r) => r.id === submission.assignmentType) || {}).maxPoints || 0;
    const cappedScore = submission.assignmentType === 'homework' && score > 5 ? 5 : Math.min(score, maxPoints || score);
    attempt.score = cappedScore;
    attempt.feedback = feedback;
    attempt.status = 'graded';
    attempt.gradedAt = Date.now();
    submission.status = 'graded';
    submission.chosenAttemptId = chooseAttempt(submission);
    persist();
  }

  function showPreview(submissionId, attemptId) {
    const target = state.submissions.find((s) => s.id === submissionId);
    const attempt = target?.attempts.find((a) => a.attemptId === attemptId);
    const container = selectors('#previewPane');
    if (!container || !attempt) return;
    container.innerHTML = `
      <div class="preview-box">
        <div class="flex-between">
          <div>
            <strong>${attempt.fileName}</strong>
            <div class="helper-text">${attempt.fileType} • ${(attempt.fileSize / 1024).toFixed(1)} KB</div>
          </div>
          <span class="status-chip status-${attempt.status.replace(' ', '-')}">${attempt.status}</span>
        </div>
        <div class="helper-text">Feedback / الملاحظات: ${attempt.feedback || '—'}</div>
        <div class="helper-text">Submitted: ${formatDate(attempt.submittedAt)}</div>
        <a href="${attempt.fileData}" target="_blank" rel="noopener" class="button flat">Open file / فتح الملف</a>
      </div>
    `;
  }

  function renderStudentFilters() {
    const filter = selectors('#queueFilterStudent');
    if (!filter) return;
    filter.innerHTML = '';
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'All / الكل';
    filter.appendChild(option);
    state.students.forEach((s) => {
      const item = document.createElement('option');
      item.value = s.name;
      item.textContent = s.name;
      filter.appendChild(item);
    });
  }

  function renderAnalytics() {
    const container = selectors('#analytics');
    if (!container) return;
    container.innerHTML = '';
    const analytics = computeAnalytics();
    const fragment = document.createDocumentFragment();

    analytics.classes.forEach((entry) => {
      const card = document.createElement('div');
      card.className = 'analytics-card';
      card.innerHTML = `
        <div class="flex-between">
          <div>
            <strong>${entry.className}</strong>
            <div class="helper-text">Average / المتوسط: ${entry.average.toFixed(2)}</div>
          </div>
          <div class="badge">${entry.submissionCount} submissions</div>
        </div>
        <div class="progress"><span style="width:${entry.averagePercent}%"></span></div>
        <div class="helper-text">Missing work / الأعمال الناقصة: ${entry.missing}</div>
      `;
      fragment.appendChild(card);
    });

    const studentBlock = document.createElement('div');
    studentBlock.className = 'card-shell';
    studentBlock.innerHTML = '<h3>Per Student / لكل طالب</h3>';
    const ul = document.createElement('ul');
    ul.className = 'list-inline';
    analytics.students.forEach((s) => {
      const item = document.createElement('li');
      item.className = 'tag';
      item.textContent = `${s.name}: avg ${s.average.toFixed(2)} (${s.completed}/${s.total})`;
      ul.appendChild(item);
    });
    studentBlock.appendChild(ul);
    fragment.appendChild(studentBlock);

    const printable = selectors('#printableReport');
    if (printable) {
      printable.innerHTML = `
        <h2>Class Performance / أداء الصف</h2>
        <p>Date / التاريخ: ${new Date().toLocaleDateString()}</p>
        <ul>
          ${analytics.classes
            .map(
              (c) => `<li>${c.className} — Avg ${c.average.toFixed(2)} • Missing ${c.missing} • Submissions ${c.submissionCount}</li>`
            )
            .join('')}
        </ul>
      `;
    }

    container.appendChild(fragment);
  }

  function computeAnalytics() {
    const classStats = state.classes.map((cls) => {
      const submissions = state.submissions.filter((s) => s.classId === cls.id);
      const attempts = submissions
        .map((s) => getCountedAttempt(s))
        .filter(Boolean);
      const scores = attempts.map((a) => a.score).filter((v) => typeof v === 'number');
      const average = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      const missing = submissions.filter((s) => !getCountedAttempt(s)?.score).length;
      return {
        classId: cls.id,
        className: cls.name,
        average,
        averagePercent: Math.min(100, (average / 100) * 100),
        missing,
        submissionCount: submissions.length
      };
    });

    const studentStats = state.students.map((student) => {
      const submissions = state.submissions.filter((s) => s.studentId === student.id);
      const attempts = submissions.map((s) => getCountedAttempt(s)).filter(Boolean);
      const scores = attempts.map((a) => a.score).filter((v) => typeof v === 'number');
      const average = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      const completed = attempts.filter((a) => typeof a.score === 'number').length;
      return { name: student.name, average, completed, total: submissions.length };
    });

    return { classes: classStats, students: studentStats };
  }

  function getCountedAttempt(submission) {
    if (!submission) return null;
    if (!submission.chosenAttemptId) submission.chosenAttemptId = chooseAttempt(submission);
    return submission.attempts.find((a) => a.attemptId === submission.chosenAttemptId) || submission.attempts[0];
  }

  function archiveYear() {
    const yearLabel = prompt('Enter year label / اكتب اسم السنة');
    if (!yearLabel) return;
    const snapshot = {
      id: uid('archive'),
      yearLabel,
      archivedAt: Date.now(),
      classes: state.classes,
      students: state.students,
      submissions: state.submissions,
      gradeRules: state.gradeRules,
      resubmissionPolicy: state.resubmissionPolicy
    };
    state.archives.push(snapshot);
    state.classes = [];
    state.students = [];
    state.submissions = [];
    persist();
    loadArchivesDropdown();
  }

  function restoreArchive() {
    const select = selectors('#archiveSelect');
    const id = select?.value;
    const chosen = state.archives.find((a) => a.id === id);
    if (!chosen) return;
    state.classes = chosen.classes;
    state.students = chosen.students;
    state.submissions = chosen.submissions;
    state.gradeRules = chosen.gradeRules;
    state.resubmissionPolicy = chosen.resubmissionPolicy;
    persist();
  }

  function renderArchivesList() {
    const container = selectors('#archiveList');
    if (!container) return;
    container.innerHTML = '';
    if (!state.archives.length) {
      container.innerHTML = '<p class="helper-text">No archives yet / لا يوجد أرشيف.</p>';
      return;
    }
    state.archives.forEach((archive) => {
      const item = document.createElement('div');
      item.className = 'preview-box';
      item.innerHTML = `
        <div class="flex-between">
          <div><strong>${archive.yearLabel}</strong><div class="helper-text">${new Date(archive.archivedAt).toLocaleDateString()}</div></div>
          <span class="badge">${archive.classes.length} classes</span>
        </div>
      `;
      container.appendChild(item);
    });
  }

  function studentLogin(event) {
    event.preventDefault();
    const form = event.target;
    const studentId = form.loginStudentId.value.trim();
    const error = selectors('#studentLoginError');
    const student = state.students.find((s) => s.studentId === studentId);
    if (!student) {
      setText(error, 'Student not found / الطالب غير موجود');
      return;
    }
    state.studentSession = student;
    setText(error, '');
    renderStudentWorkspace();
    persist();
  }

  function studentLogout() {
    state.studentSession = null;
    renderStudentWorkspace();
    persist();
  }

  function renderStudentWorkspace() {
    const portal = selectors('#studentWorkspace');
    const loginCard = selectors('#studentLoginCard');
    if (!portal || !loginCard) return;
    if (!state.studentSession) {
      portal.classList.add('hidden');
      loginCard.classList.remove('hidden');
      return;
    }
    loginCard.classList.add('hidden');
    portal.classList.remove('hidden');
    const student = state.studentSession;
    const cls = state.classes.find((c) => c.id === student.classId);
    setText(selectors('#studentName'), `${student.name} (${student.studentId})`);
    setText(selectors('#studentClass'), cls ? `${cls.name} • ${cls.section}` : '—');
    renderStudentSubmissions();
  }

  function renderStudentSubmissions() {
    const container = selectors('#studentSubmissionList');
    if (!container) return;
    container.innerHTML = '';
    const student = state.studentSession;
    if (!student) return;
    const submissions = state.submissions.filter((s) => s.studentId === student.id);
    if (!submissions.length) {
      container.innerHTML = '<p class="helper-text">No submissions yet / لا توجد تسليمات.</p>';
      return;
    }
    submissions.forEach((submission) => {
      const attemptList = document.createElement('div');
      attemptList.className = 'preview-box';
      const attemptsHtml = submission.attempts
        .map(
          (a, index) => `
            <div class="flex-between">
              <div>
                Attempt ${index + 1} • ${formatDate(a.submittedAt)}
                <div class="helper-text">Status: ${a.status} | Score: ${a.score ?? '—'}</div>
                <div class="helper-text">Feedback: ${a.feedback || '—'}</div>
              </div>
              <a href="${a.fileData}" class="badge" target="_blank">Preview</a>
            </div>
          `
        )
        .join('');
      attemptList.innerHTML = `
        <div class="flex-between">
          <div><strong>${submission.assignmentName}</strong> <span class="tag">${submission.assignmentType}</span></div>
          <span class="status-chip status-${submission.status.replace(' ', '-')}">${submission.status}</span>
        </div>
        ${attemptsHtml}
      `;
      container.appendChild(attemptList);
    });
  }

  function bulkReturn() {
    const checkboxes = document.querySelectorAll('.bulk-check:checked');
    checkboxes.forEach((box) => {
      const submissionId = box.getAttribute('data-submission');
      const attemptId = box.getAttribute('data-attempt');
      setAttemptStatus(submissionId, attemptId, 'returned');
    });
  }

  function bulkGrade() {
    const scoreValue = prompt('Score for selected / الدرجة للكل');
    const score = Number(scoreValue);
    if (Number.isNaN(score)) return;
    const feedback = prompt('Feedback for selected / ملاحظات موحدة') || '';
    const checkboxes = document.querySelectorAll('.bulk-check:checked');
    checkboxes.forEach((box) => {
      const submissionId = box.getAttribute('data-submission');
      const attemptId = box.getAttribute('data-attempt');
      gradeAttempt(submissionId, attemptId, score, feedback);
    });
  }

  function generateReport() {
    window.print();
  }

  function attachListeners() {
    const classForm = selectors('#classForm');
    classForm?.addEventListener('submit', submitClassForm);

    const studentForm = selectors('#studentForm');
    studentForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      addStudent(e.target);
    });

    const ruleForm = selectors('#ruleForm');
    ruleForm?.addEventListener('submit', submitGradeRule);

    const resubmissionForm = selectors('#resubmissionForm');
    resubmissionForm?.addEventListener('submit', updateResubmission);

    const uploadForm = selectors('#uploadForm');
    uploadForm?.addEventListener('submit', handleStudentUpload);

    const teacherLoginForm = selectors('#teacherLoginForm');
    teacherLoginForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      authenticateTeacher(e.target.teacherEmail.value.trim(), e.target.teacherPassword.value.trim());
    });

    const teacherLogout = selectors('#teacherLogout');
    teacherLogout?.addEventListener('click', logoutTeacher);

    const studentLoginForm = selectors('#studentLoginForm');
    studentLoginForm?.addEventListener('submit', studentLogin);
    selectors('#studentLogout')?.addEventListener('click', (e) => {
      e.preventDefault();
      studentLogout();
    });

    const filterInputs = document.querySelectorAll('[data-queue-filter]');
    filterInputs.forEach((input) => input.addEventListener('input', renderSubmissions));

    selectors('#bulkReturn')?.addEventListener('click', bulkReturn);
    selectors('#bulkGrade')?.addEventListener('click', bulkGrade);
    selectors('#archiveYearBtn')?.addEventListener('click', archiveYear);
    selectors('#restoreArchiveBtn')?.addEventListener('click', restoreArchive);
    selectors('#generateReportBtn')?.addEventListener('click', generateReport);
  }

  function renderAuthState() {
    const teacherOnly = document.querySelectorAll('[data-teacher-only]');
    teacherOnly.forEach((section) => {
      if (state.teacherSession) {
        section.classList.remove('hidden');
      } else {
        section.classList.add('hidden');
      }
    });
    const loginCard = selectors('#teacherLoginCard');
    if (loginCard) {
      if (state.teacherSession) loginCard.classList.add('hidden');
      else loginCard.classList.remove('hidden');
    }
  }

  function syncForms() {
    const resubmissionForm = selectors('#resubmissionForm');
    if (resubmissionForm) {
      resubmissionForm.allowResubmission.checked = !!state.resubmissionPolicy.allow;
      resubmissionForm.strategy.value = state.resubmissionPolicy.strategy;
    }
    const ruleForm = selectors('#ruleForm');
    if (ruleForm && !ruleForm.ruleLabel.value) {
      ruleForm.ruleType.value = 'project';
    }
  }

  function renderAll() {
    renderAuthState();
    renderClasses();
    populateClassOptions();
    renderStudents();
    renderGradeRules();
    renderStudentFilters();
    renderSubmissions();
    renderAnalytics();
    renderStudentWorkspace();
    renderArchivesList();
    loadArchivesDropdown();
    syncForms();
  }

  document.addEventListener('DOMContentLoaded', () => {
    attachListeners();
    renderAll();
  });
})();
