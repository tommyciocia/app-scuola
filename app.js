const storageKey = 'in-ordine-data-v2';
const initialData = {
  subjects: [
    { id: 'math', name: 'Matematica', color: 'purple', icon: '∑' },
    { id: 'italian', name: 'Italiano', color: 'orange', icon: 'A' },
    { id: 'english', name: 'Inglese', color: 'blue', icon: '⌁' },
    { id: 'history', name: 'Storia', color: 'green', icon: 'S' },
  ],
  tasks: [],
  grades: [],
  notes: [],
  goals: [{ id: 'goal-start', name: 'Aggiungere le prime 5 attività', target: 5, base: 0 }],
  note: '',
};

const storedData = JSON.parse(localStorage.getItem(storageKey));
const existingSubjects = storedData?.subjects || [];
const missingDefaultSubjects = initialData.subjects.filter((subject) => !existingSubjects.some((item) => item.id === subject.id));
const migratedNotes = storedData?.notes || (storedData?.note ? [{ id: 'legacy-note', text: storedData.note, date: new Date().toISOString().slice(0, 10) }] : []);
let data = storedData ? { ...initialData, ...storedData, subjects: [...existingSubjects, ...missingDefaultSubjects], grades: storedData.grades || [], notes: migratedNotes } : initialData;
let calendarDate = new Date();
let taskFilter = 'open';
let selectedCalendarDate = isoDate();
let calendarView = 'month';
let subjectFilter = 'all';
let typeFilter = 'all';
let editingSubjectId = null;
let editingNoteId = null;
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function save() { localStorage.setItem(storageKey, JSON.stringify(data)); }
function dayStart(value = new Date()) { const date = new Date(value); date.setHours(0, 0, 0, 0); return date; }
function isoDate(value = new Date()) { const date = dayStart(value); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function readableDate(dateString) { return new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' }).format(new Date(`${dateString}T12:00:00`)); }
function subjectById(id) { return data.subjects.find((subject) => subject.id === id); }
function taskStatus(task) { const today = dayStart(); const date = dayStart(`${task.date}T12:00:00`); if (date < today) return 'in ritardo'; if (date.getTime() === today.getTime()) return 'oggi'; return readableDate(task.date); }
function newId(prefix) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`; }
function escapeHtml(text) { const node = document.createElement('span'); node.textContent = text; return node.innerHTML; }

function renderSubjectOptions() {
  $('#taskSubject').innerHTML = data.subjects.map((subject) => `<option value="${subject.id}">${subject.name}</option>`).join('');
  $('#gradeSubject').innerHTML = data.subjects.map((subject) => `<option value="${subject.id}">${subject.name}</option>`).join('');
  $('#filterSubject').innerHTML = `<option value="all">Tutte le materie</option>${data.subjects.map((subject) => `<option value="${subject.id}">${subject.name}</option>`).join('')}`;
  $('#filterSubject').value = subjectFilter;
}

function average(grades) {
  if (!grades.length) return null;
  return grades.reduce((total, grade) => total + Number(grade.value), 0) / grades.length;
}

function gradeText(value) { return Number(value).toLocaleString('it-IT', { minimumFractionDigits: Number(value) % 1 ? 2 : 0, maximumFractionDigits: 2 }); }

function renderGrades() {
  const allAverage = average(data.grades);
  const today = dayStart(); const thirtyDaysAgo = new Date(today); thirtyDaysAgo.setDate(today.getDate() - 30); const ninetyDaysAgo = new Date(today); ninetyDaysAgo.setDate(today.getDate() - 90);
  const last30 = average(data.grades.filter((grade) => dayStart(`${grade.date}T12:00:00`) >= thirtyDaysAgo));
  const last90 = average(data.grades.filter((grade) => dayStart(`${grade.date}T12:00:00`) >= ninetyDaysAgo));
  $('#gradeSummary').innerHTML = `<article class="grade-summary-card"><p class="eyebrow">MEDIA GENERALE</p><b>${allAverage === null ? '—' : gradeText(allAverage)}</b><p>${data.grades.length ? `${data.grades.length} vot${data.grades.length === 1 ? 'o inserito' : 'i inseriti'}` : 'Aggiungi il primo voto per iniziare.'}</p></article><article class="grade-tip"><p class="eyebrow">MEDIE PER PERIODO</p><h2>Guarda l'andamento.</h2><p>Ultimi 30 giorni: <strong>${last30 === null ? '—' : gradeText(last30)}</strong><br>Ultimi 90 giorni: <strong>${last90 === null ? '—' : gradeText(last90)}</strong></p></article>`;
  $('#gradeSubjects').innerHTML = data.subjects.map((subject) => {
    const grades = data.grades.filter((grade) => grade.subjectId === subject.id).sort((a, b) => b.date.localeCompare(a.date));
    const subjectAverage = average(grades);
    const chips = grades.length ? `<div class="grade-list">${grades.map((grade) => `<span class="grade-chip"><strong>${gradeText(grade.value)}</strong><small>${readableDate(grade.date)}</small><button data-delete-grade="${grade.id}" aria-label="Elimina voto">×</button></span>`).join('')}</div>` : '<p class="no-grades">Nessun voto inserito per ora.</p>';
    return `<article class="grade-subject"><div class="grade-subject-header"><h3>${escapeHtml(subject.name)}</h3><div class="subject-average"><b>${subjectAverage === null ? '—' : gradeText(subjectAverage)}</b><small>media materia</small></div></div>${chips}</article>`;
  }).join('');
  $('#generalAverage').innerHTML = `<div><h2>Media generale</h2><p>La media di tutti i voti inseriti.</p></div><b>${allAverage === null ? '—' : gradeText(allAverage)}</b>`;
  const sortedGrades = [...data.grades].sort((a, b) => a.date.localeCompare(b.date)).slice(-18);
  const barColors = { purple: '#7b64d7', orange: '#e77d51', blue: '#3d77a2', green: '#397c69' };
  $('#gradeChart').innerHTML = sortedGrades.length ? sortedGrades.map((grade) => { const subject = subjectById(grade.subjectId); const height = Math.max(8, Number(grade.value) * 13); return `<div class="grade-bar-wrap" title="${subject?.name || 'Materia'}: ${gradeText(grade.value)}"><b>${gradeText(grade.value)}</b><i class="grade-bar" style="height:${height}px;background:${barColors[subject?.color] || '#7b64d7'}"></i><small>${readableDate(grade.date)}</small></div>`; }).join('') : '<p class="empty-chart">Aggiungi i primi voti per vedere l’andamento.</p>';
}
function taskRow(task) {
  const subject = subjectById(task.subjectId);
  const overdue = !task.done && task.date < isoDate();
  return `<article class="task-row ${task.done ? 'done' : ''} ${overdue ? 'overdue' : ''}"><button class="check ${task.done ? 'checked' : ''}" data-toggle-task="${task.id}" aria-label="Segna attività completata">${task.done ? '✓' : ''}</button><div class="task-copy"><span class="task-name">${escapeHtml(task.name)}</span><span class="task-meta">${subject ? subject.name : 'Senza materia'} · ${task.type}</span></div><span class="task-date">${taskStatus(task)}</span><button class="delete-task" data-delete-task="${task.id}" aria-label="Elimina attività">×</button></article>`;
}
function emptyTasks() { return $('#emptyTasks').content.cloneNode(true); }
function renderTasks(container, tasks) { container.innerHTML = ''; if (!tasks.length) { container.append(emptyTasks()); return; } container.innerHTML = tasks.map(taskRow).join(''); }

function renderToday() {
  const today = isoDate();
  const openTasks = data.tasks.filter((task) => !task.done);
  const todayTasks = openTasks.filter((task) => task.date === today);
  const due = openTasks.filter((task) => task.date <= today).length;
  const complete = data.tasks.filter((task) => task.done).length;
  const next = openTasks.sort((a, b) => a.date.localeCompare(b.date))[0];
  $('#todayLabel').textContent = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()).toUpperCase();
  $('#stats').innerHTML = `<article class="stat"><p class="eyebrow">DA FARE</p><b>${openTasks.length}</b><small>attività aperte</small></article><article class="stat"><p class="eyebrow">OGGI</p><b>${todayTasks.length}</b><small>in programma oggi</small></article><article class="stat"><p class="eyebrow">FATTE</p><b>${complete}</b><small>piccole vittorie</small></article>`;
  renderTasks($('#todayTasks'), todayTasks);
  $('#nextDeadline').innerHTML = next ? `<div class="card-title"><span>PROSSIMA SCADENZA</span><span class="date-chip">${readableDate(next.date)}</span></div><div class="deadline-number">${new Date(`${next.date}T12:00:00`).getDate()}</div><h3>${escapeHtml(next.name)}</h3><p>${subjectById(next.subjectId)?.name || ''} · ${next.type}${due ? ` · ${due} da sistemare oggi` : ''}</p>` : `<div class="card-title"><span>PROSSIMA SCADENZA</span><span class="date-chip">—</span></div><div class="deadline-number">—</div><h3>Nessuna scadenza vicina</h3><p>Aggiungi compiti e verifiche: appariranno qui.</p>`;
  const upcoming = openTasks.filter((task) => dayStart(`${task.date}T12:00:00`) >= dayStart()).slice(0, 3);
  $('#upcomingTasks').innerHTML = upcoming.length ? upcoming.map((task) => `<article class="upcoming-card"><span class="when">${taskStatus(task).toUpperCase()}</span><h3>${escapeHtml(task.name)}</h3><p>${subjectById(task.subjectId)?.name || ''} · ${task.type}</p></article>`).join('') : `<div class="empty-state"><span>✦</span><p>Ancora niente in calendario.</p><small>Ottimo momento per iniziare.</small></div>`;
}

function weekStart(dateString) {
  const date = dayStart(`${dateString}T12:00:00`); const distance = (date.getDay() + 6) % 7; date.setDate(date.getDate() - distance); return date;
}

function renderWeeklyAgenda() {
  const start = weekStart(selectedCalendarDate); const today = isoDate(); const days = [];
  for (let index = 0; index < 7; index += 1) { const date = new Date(start); date.setDate(start.getDate() + index); const key = isoDate(date); const dayTasks = data.tasks.filter((task) => task.date === key && !task.done); const dayNotes = data.notes.filter((note) => note.date === key); const taskItems = dayTasks.map((task) => `<span class="week-task">${escapeHtml(task.name)}</span>`).join(''); const noteItems = dayNotes.map((note) => `<span class="week-note">${escapeHtml(note.text)}</span>`).join(''); days.push(`<article class="week-day ${key === today ? 'today' : ''}" data-calendar-date="${key}"><strong>${new Intl.DateTimeFormat('it-IT', { weekday: 'short' }).format(date)}</strong><span>${date.getDate()}</span>${taskItems}${noteItems}</article>`); }
  $('#weeklyAgenda').innerHTML = days.join('');
}

function renderCalendar() {
  const isWeek = calendarView === 'week';
  $('#calendarDays').classList.toggle('hidden', isWeek); $('.calendar-weekdays').classList.toggle('hidden', isWeek); $('#weeklyAgenda').classList.toggle('active', isWeek);
  if (isWeek) { const start = weekStart(selectedCalendarDate); const end = new Date(start); end.setDate(start.getDate() + 6); $('#monthTitle').textContent = `${readableDate(isoDate(start))} – ${readableDate(isoDate(end))}`; renderWeeklyAgenda(); renderCalendarNotes(); return; }
  const year = calendarDate.getFullYear(); const month = calendarDate.getMonth();
  $('#monthTitle').textContent = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' }).format(calendarDate);
  const first = new Date(year, month, 1); const offset = (first.getDay() + 6) % 7; const total = new Date(year, month + 1, 0).getDate(); const previousTotal = new Date(year, month, 0).getDate(); const today = isoDate(); let cells = '';
  for (let index = 0; index < 42; index += 1) { let day; let cellDate; let outside = false; if (index < offset) { day = previousTotal - offset + index + 1; cellDate = new Date(year, month - 1, day); outside = true; } else if (index >= offset + total) { day = index - offset - total + 1; cellDate = new Date(year, month + 1, day); outside = true; } else { day = index - offset + 1; cellDate = new Date(year, month, day); } const key = isoDate(cellDate); const hasTask = data.tasks.some((task) => task.date === key && !task.done); const hasNote = data.notes.some((note) => note.date === key); const indicators = hasTask || hasNote ? `<span class="calendar-indicators">${hasTask ? '<i class="calendar-dot"></i>' : ''}${hasNote ? '<i class="calendar-dot note"></i>' : ''}</span>` : ''; cells += `<button type="button" class="calendar-day ${outside ? 'outside' : ''} ${key === today ? 'today' : ''} ${key === selectedCalendarDate ? 'selected' : ''}" data-calendar-date="${key}"><span>${day}</span>${indicators}</button>`; }
  $('#calendarDays').innerHTML = cells;
  renderCalendarNotes();
}

function renderCalendarNotes() {
  const notes = data.notes.filter((note) => note.date === selectedCalendarDate);
  $('#calendarNotesPreview').innerHTML = notes.length ? `<h3>Appunti del ${readableDate(selectedCalendarDate)}</h3>${notes.map((note) => `<p class="calendar-note-item">${escapeHtml(note.text)}</p>`).join('')}` : '';
}
function renderAgenda() {
  renderCalendar();
  const tasks = data.tasks.filter((task) => (taskFilter === 'all' || (taskFilter === 'done' ? task.done : !task.done)) && (subjectFilter === 'all' || task.subjectId === subjectFilter) && (typeFilter === 'all' || task.type === typeFilter)).sort((a, b) => a.date.localeCompare(b.date));
  renderTasks($('#allTasks'), tasks);
}
function renderSubjects() {
  const cards = data.subjects.map((subject) => { const subjectTasks = data.tasks.filter((task) => task.subjectId === subject.id); const done = subjectTasks.filter((task) => task.done).length; const percent = subjectTasks.length ? Math.round((done / subjectTasks.length) * 100) : 0; const isDefaultSubject = ['math', 'italian', 'english', 'history'].includes(subject.id); const removeButton = isDefaultSubject ? '' : `<button class="delete-subject" data-delete-subject="${subject.id}" aria-label="Elimina ${escapeHtml(subject.name)}">×</button>`; const actions = `<div class="subject-actions"><button class="edit-subject" data-edit-subject="${subject.id}" aria-label="Modifica ${escapeHtml(subject.name)}">✎</button>${removeButton}</div>`; return `<article class="subject ${subject.color}">${actions}<span class="subject-symbol">${subject.icon || subject.name[0].toUpperCase()}</span><h2>${escapeHtml(subject.name)}</h2><p>${subjectTasks.length ? `${subjectTasks.length} attività · ${done} completate` : 'Pronta per i tuoi appunti e compiti'}</p><div class="subject-footer"><span>${percent}% completato</span><div class="tiny-progress"><i style="width:${percent}%"></i></div></div></article>`; });
  $('#subjects').innerHTML = `${cards.join('')}<button class="add-subject" data-open="subjectDialog"><span>+</span>Aggiungi materia</button>`;
}

function renderNotesArchive() {
  const notes = [...data.notes].sort((a, b) => b.date.localeCompare(a.date));
  $('#notesArchive').innerHTML = notes.length ? notes.map((note) => `<article class="note-card"><small>${readableDate(note.date)}</small><p>${escapeHtml(note.text)}</p><div class="note-actions"><button data-edit-note="${note.id}" aria-label="Modifica appunto">✎</button><button data-delete-note="${note.id}" aria-label="Elimina appunto">×</button></div></article>`).join('') : '<div class="empty-state"><span>✦</span><p>Nessun appunto per ora.</p><small>Quelli veloci compariranno qui.</small></div>';
}
function renderProgress() {
  const total = data.tasks.length; const done = data.tasks.filter((task) => task.done).length; const percent = total ? Math.round((done / total) * 100) : 0;
  $('#progressOverview').innerHTML = `<article class="progress-number"><p class="eyebrow">ATTIVITÀ COMPLETATE</p><b>${done}</b><p>su ${total || 0} attività aggiunte</p></article><article class="weekly-progress"><p class="eyebrow">PANORAMICA</p><h2>Stai costruendo il tuo ritmo.</h2><div class="progress-bar"><i style="width:${percent}%"></i></div><p>${percent}% delle attività è completato.</p></article>`;
  $('#goals').innerHTML = data.goals.length ? data.goals.map((goal) => { const actual = Math.min(done - (goal.base || 0), goal.target); const percentage = Math.max(0, Math.min(100, Math.round((actual / goal.target) * 100))); return `<article class="goal"><div class="goal-top"><div><h3>${escapeHtml(goal.name)}</h3><small>${Math.max(0, actual)} di ${goal.target} passi</small></div><button class="delete-goal" data-delete-goal="${goal.id}" aria-label="Elimina obiettivo">×</button></div><div class="progress-bar"><i style="width:${percentage}%"></i></div></article>`; }).join('') : '<div class="empty-state"><span>✦</span><p>Nessun obiettivo per ora.</p><small>Creane uno semplice, poi cominciamo.</small></div>';
}
function renderAll() { renderSubjectOptions(); renderToday(); renderAgenda(); renderSubjects(); renderNotesArchive(); renderProgress(); renderGrades(); }
function openDialog(id) { if (id === 'taskDialog') { $('#taskDate').value = isoDate(); renderSubjectOptions(); } if (id === 'gradeDialog') { $('#gradeDate').value = isoDate(); renderSubjectOptions(); } $(`#${id}`).showModal(); }
function activatePage(page) { $$('.page').forEach((item) => item.classList.toggle('active', item.id === page)); $$('.sidebar nav a').forEach((item) => item.classList.toggle('active', item.dataset.page === page)); window.scrollTo({ top: 0, behavior: 'smooth' }); }

document.addEventListener('click', (event) => {
  const switchView = event.target.closest('[data-calendar-view]'); if (switchView) { calendarView = switchView.dataset.calendarView; $$('.view-switch').forEach((button) => button.classList.toggle('active', button === switchView)); renderCalendar(); return; }
  const opener = event.target.closest('[data-open]'); if (opener) { openDialog(opener.dataset.open); return; }
  const calendarDay = event.target.closest('[data-calendar-date]'); if (calendarDay) { selectedCalendarDate = calendarDay.dataset.calendarDate; renderCalendar(); return; }
  const nav = event.target.closest('[data-page]'); if (nav) { event.preventDefault(); activatePage(nav.dataset.page); return; }
  const pageGo = event.target.closest('[data-page-go]'); if (pageGo) { activatePage(pageGo.dataset.pageGo); return; }
  const toggle = event.target.closest('[data-toggle-task]'); if (toggle) { const task = data.tasks.find((item) => item.id === toggle.dataset.toggleTask); task.done = !task.done; save(); renderAll(); return; }
  const remove = event.target.closest('[data-delete-task]'); if (remove) { data.tasks = data.tasks.filter((task) => task.id !== remove.dataset.deleteTask); save(); renderAll(); return; }
  const editSubject = event.target.closest('[data-edit-subject]'); if (editSubject) { const subject = subjectById(editSubject.dataset.editSubject); editingSubjectId = subject.id; $('#editSubjectName').value = subject.name; $('#editSubjectColor').value = subject.color; $('#editSubjectDialog').showModal(); return; }
  const removeSubject = event.target.closest('[data-delete-subject]'); if (removeSubject) { const subject = subjectById(removeSubject.dataset.deleteSubject); if (subject && window.confirm(`Eliminare ${subject.name}? Verranno rimossi anche i suoi compiti e voti.`)) { data.subjects = data.subjects.filter((item) => item.id !== subject.id); data.tasks = data.tasks.filter((task) => task.subjectId !== subject.id); data.grades = data.grades.filter((grade) => grade.subjectId !== subject.id); save(); renderAll(); } return; }
  const editNote = event.target.closest('[data-edit-note]'); if (editNote) { const note = data.notes.find((item) => item.id === editNote.dataset.editNote); editingNoteId = note.id; $('#editNoteText').value = note.text; $('#noteDialog').showModal(); return; }
  const deleteNote = event.target.closest('[data-delete-note]'); if (deleteNote) { data.notes = data.notes.filter((note) => note.id !== deleteNote.dataset.deleteNote); save(); renderNotesArchive(); renderCalendar(); return; }
  const deleteGoal = event.target.closest('[data-delete-goal]'); if (deleteGoal) { data.goals = data.goals.filter((goal) => goal.id !== deleteGoal.dataset.deleteGoal); save(); renderProgress(); return; }
  const deleteGrade = event.target.closest('[data-delete-grade]'); if (deleteGrade) { data.grades = data.grades.filter((grade) => grade.id !== deleteGrade.dataset.deleteGrade); save(); renderGrades(); return; }
  const filter = event.target.closest('[data-filter]'); if (filter) { taskFilter = filter.dataset.filter; $$('.filter').forEach((button) => button.classList.toggle('active', button === filter)); renderAgenda(); }
});
$('#taskForm').addEventListener('submit', (event) => { event.preventDefault(); data.tasks.push({ id: newId('task'), name: $('#taskName').value.trim(), subjectId: $('#taskSubject').value, type: $('#taskType').value, date: $('#taskDate').value, done: false }); save(); $('#taskForm').reset(); $('#taskDialog').close(); renderAll(); });
$('#subjectForm').addEventListener('submit', (event) => { event.preventDefault(); const name = $('#subjectName').value.trim(); data.subjects.push({ id: newId('subject'), name, color: $('#subjectColor').value, icon: name[0].toUpperCase() }); save(); $('#subjectForm').reset(); $('#subjectDialog').close(); renderAll(); });
$('#editSubjectForm').addEventListener('submit', (event) => { event.preventDefault(); const subject = subjectById(editingSubjectId); if (subject) { subject.name = $('#editSubjectName').value.trim(); subject.color = $('#editSubjectColor').value; subject.icon = subject.name[0].toUpperCase(); save(); renderAll(); } $('#editSubjectDialog').close(); });
$('#goalForm').addEventListener('submit', (event) => { event.preventDefault(); data.goals.push({ id: newId('goal'), name: $('#goalName').value.trim(), target: Number($('#goalTarget').value), base: data.tasks.filter((task) => task.done).length }); save(); $('#goalForm').reset(); $('#goalDialog').close(); renderProgress(); });
$('#gradeForm').addEventListener('submit', (event) => { event.preventDefault(); data.grades.push({ id: newId('grade'), subjectId: $('#gradeSubject').value, value: Number($('#gradeValue').value), date: $('#gradeDate').value }); save(); $('#gradeForm').reset(); $('#gradeDialog').close(); renderGrades(); });
$('#noteForm').addEventListener('submit', (event) => { event.preventDefault(); const note = data.notes.find((item) => item.id === editingNoteId); if (note) { note.text = $('#editNoteText').value.trim(); save(); renderNotesArchive(); renderCalendar(); } $('#noteDialog').close(); });
$('#saveNote').addEventListener('click', () => { const text = $('#quickNote').value.trim(); if (!text) { $('#savedNote').textContent = 'Scrivi prima un appunto.'; return; } data.notes.push({ id: newId('note'), text, date: isoDate() }); save(); $('#quickNote').value = ''; $('#savedNote').textContent = 'Appunto salvato: lo trovi nell’Agenda di oggi con il pallino verde.'; renderNotesArchive(); renderCalendar(); });
$('#filterSubject').addEventListener('change', (event) => { subjectFilter = event.target.value; renderAgenda(); });
$('#filterType').addEventListener('change', (event) => { typeFilter = event.target.value; renderAgenda(); });
$('#previousMonth').addEventListener('click', () => { if (calendarView === 'week') { const date = new Date(`${selectedCalendarDate}T12:00:00`); date.setDate(date.getDate() - 7); selectedCalendarDate = isoDate(date); } else { calendarDate.setMonth(calendarDate.getMonth() - 1); } renderCalendar(); });
$('#nextMonth').addEventListener('click', () => { if (calendarView === 'week') { const date = new Date(`${selectedCalendarDate}T12:00:00`); date.setDate(date.getDate() + 7); selectedCalendarDate = isoDate(date); } else { calendarDate.setMonth(calendarDate.getMonth() + 1); } renderCalendar(); });
renderAll();
