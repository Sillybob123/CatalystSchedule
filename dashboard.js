// ===============================
// Catalyst Tracker - Dashboard JS
// Full replacement (2025-08-28)
// ===============================

// ---- Firebase (must match auth.js) ----
const firebaseConfig = {
  apiKey: "AIzaSyBT6urJvPCtuYQ1c2iH77QTDfzE3yGw-Xk",
  authDomain: "catalystmonday.firebaseapp.com",
  projectId: "catalystmonday",
  storageBucket: "catalystmonday.appspot.com",
  messagingSenderId: "394311851220",
  appId: "1:394311851220:web:86e4939b7d5a085b46d75d"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

// ---- App State ----
let currentUser        = null;
let currentUserName    = null;
let currentUserRole    = null; // 'admin' | 'editor' | 'author'
let allProjects        = [];
let allEditors         = [];   // [{ id, name, role }]
let currentView        = 'interviews'; // 'interviews' | 'opeds' | 'my-assignments' | 'calendar'
let currentlyViewedProjectId = null;
let calendarDate = new Date();

// ---- Timelines (ordered checklists) ----
const projectTimelines = {
  "Interview": [
    "Topic Proposal Complete",
    "Interview Scheduled",
    "Interview Complete",
    "Article Writing Complete",
    "Review In Progress",
    "Review Complete",
    "Suggestions Reviewed"
  ],
  "Op-Ed": [
    "Topic Proposal Complete",
    "Article Writing Complete",
    "Review In Progress",
    "Review Complete",
    "Suggestions Reviewed"
  ]
};

// ---- Columns per board ----
const KANBAN_COLUMNS = {
  'interviews': ["Topic Proposal", "Interview Stage", "Writing Stage", "In Review", "Reviewing Suggestions", "Completed"],
  'opeds':      ["Topic Proposal", "Writing Stage", "In Review", "Reviewing Suggestions", "Completed"],
  'my-assignments': ["To Do", "In Progress", "In Review", "Done"]
};

// ======================
// Initialization / Auth
// ======================
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = 'index.html';
    return;
  }
  currentUser = user;

  try {
    const snap = await db.collection('users').doc(user.uid).get();
    if (!snap.exists) throw new Error("User profile not found.");
    const data = snap.data();
    currentUserName = data.name || user.email || "User";
    currentUserRole = data.role || "author";

    await fetchEditors();
    setupUI();
    setupNavAndListeners();
    subscribeProjects();

    document.getElementById('loader').style.display = 'none';
    document.getElementById('app-container').style.display = 'flex';
  } catch (err) {
    console.error(err);
    alert("There was a problem loading your profile. Try signing out and back in.");
  }
});

async function fetchEditors() {
  const qs = await db.collection('users').where('role', 'in', ['admin', 'editor']).get();
  allEditors = qs.docs.map(d => ({ id: d.id, ...d.data() }));
}

function setupUI() {
  document.getElementById('user-name').textContent = currentUserName || '';
  document.getElementById('user-role').textContent = currentUserRole || '';
  const avatar = document.getElementById('user-avatar');
  if (avatar) {
    avatar.style.backgroundColor = stringToColor(currentUserName || 'U');
    avatar.textContent = (currentUserName || 'U').charAt(0).toUpperCase();
  }
}

// ==================
// Navigation / Views
// ==================
function setupNavAndListeners() {
  // Sidebar nav
  document.getElementById('logout-button')?.addEventListener('click', () => auth.signOut());
  document.getElementById('nav-my-assignments')?.addEventListener('click', (e) => handleNavClick(e, 'my-assignments'));
  document.getElementById('nav-calendar')?.addEventListener('click', (e) => handleNavClick(e, 'calendar'));
  document.getElementById('nav-interviews')?.addEventListener('click', (e) => handleNavClick(e, 'interviews'));
  document.getElementById('nav-opeds')?.addEventListener('click', (e) => handleNavClick(e, 'opeds'));

  // Top buttons / forms
  document.getElementById('add-project-button')?.addEventListener('click', openProjectModal);
  document.getElementById('project-form')?.addEventListener('submit', handleProjectFormSubmit);
  document.getElementById('status-report-button')?.addEventListener('click', generateStatusReport);
  document.getElementById('add-comment-button')?.addEventListener('click', handleAddComment);
  document.getElementById('schedule-interview-button')?.addEventListener('click', handleScheduleInterview);
  document.getElementById('assign-editor-button')?.addEventListener('click', handleAssignEditor);
  document.getElementById('update-deadlines-button')?.addEventListener('click', handleUpdateDeadlines);
  document.getElementById('delete-project-button')?.addEventListener('click', handleDeleteProject);

  // Approve / Reject
  document.getElementById('approve-button')?.addEventListener('click', () => updateProposalStatus('approved'));
  document.getElementById('reject-button')?.addEventListener('click', () => updateProposalStatus('rejected'));

  // Calendar arrows
  document.getElementById('prev-month')?.addEventListener('click', () => changeMonth(-1));
  document.getElementById('next-month')?.addEventListener('click', () => changeMonth(1));

  // Modal close (overlay or ×)
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay') || e.target.classList.contains('close-button')) {
        closeAllModals();
      }
    });
  });
}

function handleNavClick(e, view) {
  e.preventDefault();
  currentView = view;
  // aria-current
  document.querySelectorAll('.nav-item').forEach(a => a.setAttribute('aria-current', 'false'));
  const mapping = {
    'my-assignments': '#nav-my-assignments',
    'calendar': '#nav-calendar',
    'interviews': '#nav-interviews',
    'opeds': '#nav-opeds'
  };
  const active = document.querySelector(mapping[view]);
  if (active) active.setAttribute('aria-current', 'true');

  renderCurrentView();
}

function renderCurrentView() {
  const board = document.getElementById('kanban-board-wrapper');
  const calendar = document.getElementById('calendar-wrapper');

  if (currentView === 'calendar') {
    if (board) board.style.display = 'none';
    if (calendar) calendar.style.display = 'block';
    renderCalendar();
  } else {
    if (calendar) calendar.style.display = 'none';
    if (board) board.style.display = 'block';
    renderKanbanBoard();
  }
}

// =========================
// Projects (Realtime sync)
// =========================
function subscribeProjects() {
  db.collection('projects').orderBy('deadline', 'desc').onSnapshot((snapshot) => {
    allProjects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderCurrentView();
    updateNavCounts();

    // if a details modal is open, refresh it
    if (currentlyViewedProjectId) {
      const p = allProjects.find(x => x.id === currentlyViewedProjectId);
      if (p) refreshDetailsModal(p);
      else closeAllModals();
    }
  });
}

function updateNavCounts() {
  const myCount = getMyAssignmentsCount();
  const link = document.querySelector('#nav-my-assignments span');
  if (link) link.textContent = `My Assignments (${myCount})`;
}

function getMyAssignmentsCount() {
  return allProjects.filter(p => {
    const t = p.timeline || {};
    const isAuthor = p.authorId === currentUser.uid;
    const isEditor = p.editorId === currentUser.uid;

    if (isEditor && t["Article Writing Complete"] && !t["Review Complete"]) return true;
    if (isAuthor) {
      if (t["Review Complete"] && !t["Suggestions Reviewed"]) return true;
      if (p.proposalStatus === 'approved' && !t["Article Writing Complete"]) return true;
      if (p.type === 'Interview' && p.proposalStatus === 'approved' && !t["Interview Complete"]) return true;
    }
    return false;
  }).length;
}

// Filter for the given board
function filterProjects() {
  switch (currentView) {
    case 'interviews':       return allProjects.filter(p => p.type === 'Interview');
    case 'opeds':            return allProjects.filter(p => p.type === 'Op-Ed');
    case 'my-assignments':   return allProjects.filter(p => {
      const t = p.timeline || {};
      const isAuthor = p.authorId === currentUser.uid;
      const isEditor = p.editorId === currentUser.uid;

      if (isEditor && t["Article Writing Complete"] && !t["Review Complete"]) return true;
      if (isAuthor) {
        if (t["Review Complete"] && !t["Suggestions Reviewed"]) return true;
        if (p.proposalStatus === 'approved' && !t["Article Writing Complete"]) return true;
        if (p.type === 'Interview' && p.proposalStatus === 'approved' && !t["Interview Complete"]) return true;
      }
      return false;
    });
    default: return allProjects;
  }
}

// ====================
// Kanban Board Render
// ====================
function renderKanbanBoard() {
  const projects = filterProjects();
  const board = document.getElementById('kanban-board');
  if (!board) return;

  board.innerHTML = '';
  const columns = KANBAN_COLUMNS[currentView] || KANBAN_COLUMNS['interviews'];
  board.style.gridTemplateColumns = `repeat(${columns.length}, 1fr)`;

  columns.forEach(title => {
    const col = document.createElement('div');
    col.className = 'kanban-column';
    const colProjects = projects.filter(p => getProjectColumn(p, currentView) === title);

    col.innerHTML = `
      <h3>
        <span class="column-title">${title}</span>
        <span class="tag count">${colProjects.length}</span>
      </h3>
      <div class="kanban-cards"></div>
    `;

    const holder = col.querySelector('.kanban-cards');
    colProjects.forEach(p => holder.appendChild(createProjectCard(p)));
    board.appendChild(col);
  });
}

// ==============================
// Column Routing (State Machine)
// ==============================
function getProjectColumn(project, view = 'interviews') {
  const t = project.timeline || {};

  // Final state everywhere
  if (t["Suggestions Reviewed"]) {
    return view === 'my-assignments' ? "Done" : "Completed";
  }

  // My Assignments view buckets (personalized)
  if (view === 'my-assignments') {
    const isAuthor = project.authorId === currentUser.uid;
    const isEditor = project.editorId === currentUser.uid;

    if (isEditor) {
      if (t["Article Writing Complete"] && !t["Review Complete"]) return "In Progress";
      if (t["Review Complete"] && !t["Suggestions Reviewed"]) return "Done";
    }

    if (isAuthor) {
      if (t["Review Complete"] && !t["Suggestions Reviewed"]) return "In Review";
      if (project.proposalStatus === 'approved' && !t["Article Writing Complete"]) return "In Progress";
      if (project.type === 'Interview' && project.proposalStatus === 'approved' && !t["Interview Complete"]) return "To Do";
    }

    return "To Do";
  }

  // Workflow boards (Interviews / Op-Eds)
  if (project.proposalStatus !== 'approved') return "Topic Proposal";

  if (project.type === 'Interview') {
    if (!t["Interview Complete"]) return "Interview Stage";
    if (t["Interview Complete"] && !t["Article Writing Complete"]) return "Writing Stage";
  } else {
    // Op-Ed
    if (!t["Article Writing Complete"]) return "Writing Stage";
  }

  // After writing complete:
  if (t["Article Writing Complete"]) {
    if (!project.editorId) return "Writing Stage";      // waiting for admin to assign editor
    if (!t["Review Complete"]) return "In Review";      // editor working (yellow)
    if (t["Review Complete"] && !t["Suggestions Reviewed"]) return "Reviewing Suggestions"; // waiting on author (blue)
  }

  return "Topic Proposal";
}

// ===================
// Kanban Cards (UI)
// ===================
function createProjectCard(project) {
  const card = document.createElement('div');
  card.className = 'kanban-card';
  card.dataset.id = project.id;

  const column = getProjectColumn(project, currentView);
  const t = project.timeline || {};

  // Color states
  if (column === "Interview Stage") {
    if (t["Interview Scheduled"]) card.classList.add('status-yellow'); // scheduled → yellow
  } else if (column === "Writing Stage" || column === "In Review") {
    card.classList.add('status-yellow');  // active work
  } else if (column === "Reviewing Suggestions") {
    card.classList.add('status-blue');    // waiting on author
  } else if (column === "Completed" || column === "Done") {
    card.classList.add('status-green');   // complete
  }

  // Progress bar
  const total = (projectTimelines[project.type] || []).length;
  const completed = Object.values(t).filter(Boolean).length;
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Deadline display
  let dueStr = '';
  let dueClass = '';
  if (project.deadline) {
    const deadline = new Date(project.deadline + 'T23:59:59');
    const days = (deadline - new Date()) / (1000 * 60 * 60 * 24);
    dueClass = (days < 0) ? 'overdue' : (days < 7 ? 'due-soon' : '');
    dueStr = deadline.toLocaleDateString();
  }

  card.innerHTML = `
    <h4 class="card-title">${project.title || '(Untitled)'}</h4>
    <div class="progress-bar-container"><div class="progress-bar" style="width:${progressPct}%"></div></div>
    <div class="card-footer">
      <div class="card-author">
        <div class="user-avatar" style="background-color:${stringToColor(project.authorName || 'A')}">${(project.authorName||'A').charAt(0)}</div>
        <span>${project.authorName || 'Unknown'}</span>
      </div>
      <div class="card-editor">
        <span class="card-deadline ${dueClass}">${dueStr}</span>
      </div>
    </div>
  `;
  card.addEventListener('click', () => openDetailsModal(project.id));
  return card;
}

// =================
// Calendar (view)
// =================
function renderCalendar() {
  const grid = document.getElementById('calendar-grid');
  const label = document.getElementById('month-year');
  if (!grid || !label) return;

  grid.innerHTML = '';
  const m = calendarDate.getMonth();
  const y = calendarDate.getFullYear();
  label.textContent = `${calendarDate.toLocaleString('default', { month: 'long' })} ${y}`;

  ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d => {
    grid.innerHTML += `<div class="calendar-day-name">${d}</div>`;
  });

  const firstDay = new Date(y, m, 1).getDay();
  for (let i = 0; i < firstDay; i++) grid.innerHTML += `<div></div>`;

  const numDays = new Date(y, m + 1, 0).getDate();
  for (let day = 1; day <= numDays; day++) {
    const cell = document.createElement('div');
    cell.className = 'calendar-day';
    cell.innerHTML = `<div class="day-number">${day}</div>`;

    const todaysProjects = allProjects.filter(p => {
      if (!p.deadline) return false;
      const d = new Date(p.deadline + 'T00:00:00');
      return d.getFullYear() === y && d.getMonth() === m && d.getDate() === day;
    });

    todaysProjects.forEach(p => {
      const t = p.timeline || {};
      const done = t["Suggestions Reviewed"];
      const pillClass = done ? 'pill-green' : 'pill-default';
      const el = document.createElement('div');
      el.className = `calendar-pill ${pillClass}`;
      el.textContent = p.title || '(Untitled)';
      el.addEventListener('click', () => openDetailsModal(p.id));
      cell.appendChild(el);
    });

    grid.appendChild(cell);
  }
}

function changeMonth(delta) {
  calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + delta, 1);
  renderCalendar();
}

// ========================
// Details Modal (actions)
// ========================
function openDetailsModal(projectId) {
  const project = allProjects.find(p => p.id === projectId);
  if (!project) return;
  currentlyViewedProjectId = projectId;
  refreshDetailsModal(project);
  document.getElementById('details-modal').style.display = 'flex';
}

function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
  currentlyViewedProjectId = null;
}

function refreshDetailsModal(project) {
  const isAuthor = currentUser.uid === project.authorId;
  const isEditor = currentUser.uid === project.editorId;
  const isAdmin  = currentUserRole === 'admin';

  const t = project.timeline || {};
  const statusEl = document.getElementById('details-status');

  document.getElementById('details-title').textContent = project.title || '(Untitled)';
  document.getElementById('details-author').textContent = project.authorName || 'Unknown';
  document.getElementById('details-editor').textContent = project.editorName || 'Not Assigned';
  statusEl.textContent = (project.proposalStatus !== 'approved') ? `Proposal: ${project.proposalStatus}` : getProjectColumn(project, currentView);
  document.getElementById('details-deadline').textContent = project.deadline
    ? new Date(project.deadline + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';
  document.getElementById('details-proposal').textContent = project.proposal || 'No proposal provided.';

  // Admin: approve/reject shown only when pending
  document.getElementById('admin-approval-section').style.display =
    (isAdmin && project.proposalStatus === 'pending') ? 'block' : 'none';

  // Editor assignment appears when writing is complete but no editor yet
  const needsEditor = !!t["Article Writing Complete"] && !project.editorId;
  const assignWrap = document.getElementById('editor-assign-section');
  if (assignWrap) assignWrap.style.display = needsEditor ? 'block' : 'none';

  const editorDropdown = document.getElementById('editor-dropdown');
  if (editorDropdown) {
    editorDropdown.innerHTML = `<option value="">Select editor...</option>` + 
      allEditors.map(e => `<option value="${e.id}">${e.name} (${e.role})</option>`).join('');
  }

  // Interview section (only for Interview type)
  const interviewSection = document.getElementById('interview-details-section');
  if (interviewSection) interviewSection.style.display = (project.type === 'Interview') ? 'block' : 'none';
  renderInterviewStatus(project);

  // Render checklist (with permissions)
  renderTimeline(project, isAuthor, isEditor, isAdmin);

  // Activity
  renderActivityFeed(project.activity || []);
}

function renderTimeline(project, isAuthor, isEditor, isAdmin) {
  const container = document.getElementById('details-timeline');
  if (!container) return;
  container.innerHTML = '';

  const t = project.timeline || {};
  const tasks = projectTimelines[project.type] || [];

  tasks.forEach(task => {
    let canEdit = false;

    if (task === "Topic Proposal Complete") {
      // always auto-set from admin approval only
      canEdit = false;
    } else if (
      task === "Interview Scheduled" ||
      task === "Interview Complete" ||
      task === "Article Writing Complete" ||
      task === "Suggestions Reviewed"
    ) {
      canEdit = isAuthor || isAdmin;
    } else if (task === "Review In Progress" || task === "Review Complete") {
      canEdit = isEditor || isAdmin;
    }

    const checked = !!t[task];
    const row = document.createElement('div');
    row.className = 'timeline-item';

    row.innerHTML = `
      <label class="checkbox-wrap">
        <input type="checkbox" ${checked ? 'checked' : ''} ${canEdit ? '' : 'disabled'}>
        <span>${task}</span>
      </label>
    `;

    const input = row.querySelector('input[type="checkbox"]');
    if (canEdit) {
      input.addEventListener('change', async (e) => {
        await updateTaskStatus(project.id, task, e.target.checked);
      });
    }

    container.appendChild(row);
  });
}

function renderInterviewStatus(project) {
  const el = document.getElementById('interview-status-display');
  if (!el) return;

  const ts = project.interviewDate?.seconds;
  if (ts) {
    el.innerHTML = `<strong>Scheduled for:</strong> ${new Date(ts * 1000).toLocaleString()}`;
  } else if (project.interviewDate instanceof Date) {
    el.innerHTML = `<strong>Scheduled for:</strong> ${project.interviewDate.toLocaleString()}`;
  } else {
    el.textContent = 'Not yet scheduled.';
  }
}

function renderActivityFeed(activity) {
  const feed = document.getElementById('details-activity-feed');
  if (!feed) return;
  feed.innerHTML = '';

  const items = [...activity];
  items.sort((a, b) => {
    const ta = a.timestamp?.seconds ? a.timestamp.seconds * 1000 : new Date(a.timestamp || 0).getTime();
    const tb = b.timestamp?.seconds ? b.timestamp.seconds * 1000 : new Date(b.timestamp || 0).getTime();
    return tb - ta;
  });

  items.forEach(item => {
    const when = item.timestamp?.seconds ? new Date(item.timestamp.seconds * 1000) : new Date(item.timestamp || Date.now());
    feed.innerHTML += `
      <div class="feed-item">
        <div class="user-avatar" style="background-color:${stringToColor(item.authorName || 'U')}">${(item.authorName||'U').charAt(0)}</div>
        <div class="feed-content">
          <p><span class="author">${item.authorName || 'User'}</span> ${item.text || ''}</p>
          <span class="timestamp">${when.toLocaleString()}</span>
        </div>
      </div>
    `;
  });
}

// ==================
// Actions / Writes
// ==================
async function addActivity(projectId, text) {
  const activity = { text, authorName: currentUserName || 'User', timestamp: new Date() };
  await db.collection('projects').doc(projectId).update({
    activity: firebase.firestore.FieldValue.arrayUnion(activity)
  });
}

async function updateTaskStatus(projectId, task, isCompleted) {
  await db.collection('projects').doc(projectId).update({ [`timeline.${task}`]: isCompleted });
  await addActivity(projectId, `${isCompleted ? 'completed' : 'un-completed'} the task: "${task}"`);
}

async function handleAddComment() {
  const input = document.getElementById('comment-input');
  if (!input || !currentlyViewedProjectId) return;
  const text = input.value.trim();
  if (!text) return;
  await addActivity(currentlyViewedProjectId, `commented: "${text}"`);
  input.value = '';
}

async function updateProposalStatus(newStatus) {
  if (!currentlyViewedProjectId || currentUserRole !== 'admin') return;
  await db.collection('projects').doc(currentlyViewedProjectId).update({
    proposalStatus: newStatus,
    'timeline.Topic Proposal Complete': newStatus === 'approved'
  });
  await addActivity(currentlyViewedProjectId, `${newStatus} the proposal.`);
}

async function handleScheduleInterview() {
  if (!currentlyViewedProjectId) return;
  const raw = document.getElementById('interview-date')?.value;
  if (!raw) return;
  const dt = new Date(raw);
  await db.collection('projects').doc(currentlyViewedProjectId).update({
    interviewDate: dt,
    'timeline.Interview Scheduled': true
  });
  await addActivity(currentlyViewedProjectId, `scheduled the interview for ${dt.toLocaleString()}`);
}

async function handleAssignEditor() {
  if (!currentlyViewedProjectId) return;
  const dropdown = document.getElementById('editor-dropdown');
  if (!dropdown) return;
  const editorId = dropdown.value;
  if (!editorId) return;

  const selected = allEditors.find(e => e.id === editorId);
  if (!selected) return;

  await db.collection('projects').doc(currentlyViewedProjectId).update({
    editorId: selected.id,
    editorName: selected.name
  });
  await addActivity(currentlyViewedProjectId, `assigned **${selected.name}** as the editor. Project moved to "In Review".`);
}

async function handleUpdateDeadlines() {
  if (!currentlyViewedProjectId) return;
  const project = allProjects.find(p => p.id === currentlyViewedProjectId);
  if (!project) return;

  const inputs = document.querySelectorAll('#details-deadlines-list input[type="date"]');
  const updated = { ...(project.deadlines || {}) };
  inputs.forEach(input => {
    const task = input.dataset.task;
    if (task) updated[task] = input.value || '';
  });

  await db.collection('projects').doc(currentlyViewedProjectId).update({ deadlines: updated });
  await addActivity(currentlyViewedProjectId, 'updated deadlines.');
}

async function handleDeleteProject() {
  if (!currentlyViewedProjectId) return;
  const project = allProjects.find(p => p.id === currentlyViewedProjectId);
  if (!project) return;
  if (!confirm(`Delete "${project.title}"? This cannot be undone.`)) return;

  await db.collection('projects').doc(project.id).delete();
  closeAllModals();
}

// =============================
// New Project (Add Modal/Form)
// =============================
function openProjectModal() {
  document.getElementById('project-form')?.reset();
  document.getElementById('project-modal').style.display = 'flex';
}

async function handleProjectFormSubmit(e) {
  e.preventDefault();
  const title    = document.getElementById('project-title')?.value.trim() || '(Untitled)';
  const type     = document.getElementById('project-type')?.value || 'Interview';
  const proposal = document.getElementById('project-proposal')?.value || '';
  const deadline = document.getElementById('project-deadline')?.value || '';

  const timeline = {};
  (projectTimelines[type] || []).forEach(t => timeline[t] = false);

  await db.collection('projects').add({
    title,
    type,                           // 'Interview' | 'Op-Ed'
    proposal,
    deadline,                       // YYYY-MM-DD
    authorId: currentUser.uid,
    authorName: currentUserName || 'User',
    editorId: null,
    editorName: null,
    proposalStatus: 'pending',      // 'pending' | 'approved' | 'rejected'
    timeline,
    activity: []
  });

  document.getElementById('project-modal').style.display = 'none';
}

// =================
// Status Reporting
// =================
function generateStatusReport() {
  const container = document.getElementById('report-content');
  if (!container) return;

  const now = new Date();
  const overdue = allProjects.filter(p => {
    if (!p.deadline) return false;
    const d = new Date(p.deadline + 'T23:59:59');
    return d < now && getProjectColumn(p, (p.type === 'Op-Ed' ? 'opeds' : 'interviews')) !== 'Completed';
  });

  const active = allProjects.filter(p => p.proposalStatus === 'approved' &&
    getProjectColumn(p, (p.type === 'Op-Ed' ? 'opeds' : 'interviews')) !== 'Completed');

  let html = '';

  html += `<div class="report-section"><h3><span class="emoji">⚠️</span> Overdue Projects (${overdue.length})</h3>`;
  if (overdue.length) {
    overdue.forEach(p => {
      html += `<div class="report-item overdue-item"><span class="item-title">${p.title}</span><span class="item-meta">by ${p.authorName} • due ${p.deadline || '—'}</span></div>`;
    });
  } else {
    html += `<p>None 🎉</p>`;
  }
  html += `</div>`;

  html += `<div class="report-section"><h3><span class="emoji">🚀</span> Active Projects (${active.length})</h3>`;
  active.forEach(p => {
    html += `<div class="report-item"><span class="item-title">${p.title}</span><span class="item-meta">(${p.type}) • ${getProjectColumn(p, (p.type==='Op-Ed'?'opeds':'interviews'))}</span></div>`;
  });
  html += `</div>`;

  // Simple breakdown by person (author)
  const byPerson = {};
  active.forEach(p => {
    const k = p.authorName || 'Unknown';
    byPerson[k] = (byPerson[k] || 0) + 1;
  });
  html += `<div class="report-section"><h3><span class="emoji">👥</span> Active Projects by Author</h3>`;
  Object.entries(byPerson).forEach(([name, count]) => {
    html += `<div class="report-item"><span class="item-title">${name}</span><span class="item-meta">${count}</span></div>`;
  });
  html += `</div>`;

  container.innerHTML = html;
  document.getElementById('report-modal').style.display = 'flex';
}

// =======
// Utils
// =======
function stringToColor(str) {
  if (!str) return '#ccc';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = '#';
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xff;
    color += ('00' + value.toString(16)).slice(-2);
  }
  return color;
}
