// NOTE: This firebaseConfig should be identical to the one in auth.js
const firebaseConfig = {
    apiKey: "AIzaSyBT6urJvPCtuYQ1c2iH77QTDfzE3yGw-Xk",
    authDomain: "catalystmonday.firebaseapp.com",
    projectId: "catalystmonday",
    storageBucket: "catalystmonday.appspot.com",
    messagingSenderId: "394311851220",
    appId: "1:394311851220:web:86e4939b7d5a085b46d75d"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

// --- STATE MANAGEMENT ---
let currentUser = null, currentUserName = null, currentUserRole = null;
let allProjects = [], allEditors = [];
let currentlyViewedProjectId = null, activityUnsubscribe = null;
let currentView = 'interviews'; // Default view
let calendarDate = new Date();

// --- CONSTANTS ---
const projectTimelines = {
    "Interview": ["Topic Proposal Complete", "Interview Scheduled", "Interview Complete", "Article Writing Complete", "Suggestions Reviewed"],
    "Op-Ed": ["Topic Proposal Complete", "Article Writing Complete", "Suggestions Reviewed"]
};

const KANBAN_COLUMNS = {
    'interviews': ["Topic Proposal", "Interview Stage", "Writing Stage", "Reviewing Suggestions", "Completed"],
    'opeds': ["Topic Proposal", "Writing Stage", "Reviewing Suggestions", "Completed"],
    'my-assignments': ["To Do", "In Progress", "In Review", "Done"]
};

// --- INITIALIZATION ---
auth.onAuthStateChanged(async user => {
    if (user) {
        currentUser = user;
        try {
            const userDoc = await db.collection('users').doc(user.uid).get();
            if (!userDoc.exists) throw new Error("User profile not found in Firestore.");
            
            const userData = userDoc.data();
            currentUserName = userData.name;
            currentUserRole = userData.role;

            await fetchEditors();
            setupUI();
            setupNavAndListeners();
            fetchAndRenderProjects();

            document.getElementById('loader').style.display = 'none';
            document.getElementById('app-container').style.display = 'flex';
        } catch (error) {
            handleAuthError(error.message);
        }
    } else {
        window.location.href = 'index.html';
    }
});

async function fetchEditors() {
    const editorsSnapshot = await db.collection('users').where('role', 'in', ['admin', 'editor']).get();
    allEditors = editorsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

function setupUI() {
    document.getElementById('user-name').textContent = currentUserName;
    document.getElementById('user-role').textContent = currentUserRole;
    document.getElementById('user-avatar').textContent = currentUserName.charAt(0);
    document.getElementById('user-avatar').style.backgroundColor = stringToColor(currentUserName);
    if (currentUserRole === 'admin') {
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'flex');
    }
}

function handleAuthError(message) {
    const loader = document.getElementById('loader');
    loader.innerHTML = `<div style="text-align: center; color: var(--text-secondary); padding: 20px;">
        <h2>Error</h2><p>${message}</p><p>Please contact an administrator.</p>
        <button id="error-logout-button" class="btn-primary" style="margin-top: 15px;">Logout</button>
    </div>`;
    document.getElementById('error-logout-button').addEventListener('click', () => auth.signOut());
}

// --- NAVIGATION & VIEWS ---
function setupNavAndListeners() {
    document.querySelectorAll('.nav-item').forEach(link => link.addEventListener('click', e => handleNavClick(e, link.id)));
    document.getElementById('add-project-button').addEventListener('click', openProjectModal);
    document.getElementById('project-form').addEventListener('submit', handleProjectFormSubmit);
    document.getElementById('status-report-button').addEventListener('click', generateStatusReport);
    document.getElementById('add-comment-button').addEventListener('click', handleAddComment);
    document.getElementById('schedule-interview-button').addEventListener('click', handleScheduleInterview);
    document.getElementById('assign-editor-button').addEventListener('click', handleAssignEditor);
    document.getElementById('update-deadline-button').addEventListener('click', handleUpdateDeadline);
    document.getElementById('delete-project-button').addEventListener('click', handleDeleteProject);
    document.getElementById('prev-month').addEventListener('click', () => changeMonth(-1));
    document.getElementById('next-month').addEventListener('click', () => changeMonth(1));
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', e => {
            if (e.target.classList.contains('modal-overlay') || e.target.classList.contains('close-button')) {
                closeAllModals();
            }
        });
    });
    ['approve-button', 'reject-button'].forEach(id => document.getElementById(id).addEventListener('click', () => updateProposalStatus(id.split('-')[0])));
}

function handleNavClick(e, linkId) {
    e.preventDefault();
    document.querySelectorAll('.nav-item').forEach(l => l.classList.remove('active'));
    document.getElementById(linkId).classList.add('active');
    
    const viewMappings = {
        'nav-my-assignments': { view: 'my-assignments', title: 'My Assignments' },
        'nav-interviews': { view: 'interviews', title: 'Catalyst in the Capital' },
        'nav-opeds': { view: 'opeds', title: 'Op-Eds' },
        'nav-calendar': { view: 'calendar', title: 'Deadlines Calendar' }
    };
    
    const { view, title } = viewMappings[linkId];
    currentView = view;
    document.getElementById('board-title').textContent = title;

    const boardView = document.getElementById('board-view');
    const calendarView = document.getElementById('calendar-view');
    if (currentView === 'calendar') {
        boardView.style.display = 'none';
        calendarView.style.display = 'block';
        renderCalendar();
    } else {
        boardView.style.display = 'block';
        calendarView.style.display = 'none';
        renderKanbanBoard();
    }
}

// --- DATA FETCHING & RENDERING ---
function fetchAndRenderProjects() {
    db.collection('projects').orderBy("deadline", "desc").onSnapshot(snapshot => {
        allProjects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (currentView === 'calendar') {
            renderCalendar();
        } else {
            renderKanbanBoard();
        }
    });
}

function filterProjects() {
    switch(currentView) {
        case 'interviews': return allProjects.filter(p => p.type === 'Interview');
        case 'opeds': return allProjects.filter(p => p.type === 'Op-Ed');
        case 'my-assignments': return allProjects.filter(p => p.authorId === currentUser.uid || p.editorId === currentUser.uid);
        default: return allProjects;
    }
}

// --- KANBAN BOARD ---
function renderKanbanBoard() {
    const projectsToRender = filterProjects();
    const board = document.getElementById('kanban-board');
    board.innerHTML = '';
    
    const columns = KANBAN_COLUMNS[currentView] || KANBAN_COLUMNS['interviews'];
    board.style.gridTemplateColumns = `repeat(${columns.length}, 1fr)`;

    columns.forEach(columnTitle => {
        const columnProjects = projectsToRender.filter(p => getProjectColumn(p) === columnTitle);
        const columnEl = document.createElement('div');
        columnEl.className = 'kanban-column';
        columnEl.innerHTML = `<h3><span class="column-title">${columnTitle}</span><span class="task-count">${columnProjects.length}</span></h3><div class="kanban-cards"></div>`;
        columnProjects.forEach(project => {
            columnEl.querySelector('.kanban-cards').appendChild(createProjectCard(project));
        });
        board.appendChild(columnEl);
    });
}

function getProjectColumn(project) {
    if (project.proposalStatus !== 'approved') return "Topic Proposal";
    
    const completedTasks = Object.keys(project.timeline).filter(task => project.timeline[task]);
    const totalTasks = Object.keys(project.timeline).length;

    if (completedTasks.length === totalTasks) return "Completed";

    if (currentView === 'my-assignments') {
        if (project.editorId === currentUser.uid) return "In Review";
        if (completedTasks.length > 0) return "In Progress";
        return "To Do";
    }
    
    if (project.type === 'Interview') {
        if (completedTasks.includes("Suggestions Reviewed")) return "Completed";
        if (completedTasks.includes("Article Writing Complete")) return "Reviewing Suggestions";
        if (completedTasks.includes("Interview Complete")) return "Writing Stage";
        if (completedTasks.includes("Topic Proposal Complete")) return "Interview Stage";
    } else { // Op-Ed
        if (completedTasks.includes("Suggestions Reviewed")) return "Completed";
        if (completedTasks.includes("Article Writing Complete")) return "Reviewing Suggestions";
        if (completedTasks.includes("Topic Proposal Complete")) return "Writing Stage";
    }
    return "Topic Proposal";
}

function createProjectCard(project) {
    const card = document.createElement('div');
    card.className = 'kanban-card';
    card.dataset.id = project.id;
    
    const deadline = new Date(project.deadline + 'T23:59:59');
    const daysUntilDue = (deadline - new Date()) / (1000 * 60 * 60 * 24);
    let deadlineClass = daysUntilDue < 0 ? 'overdue' : (daysUntilDue < 7 ? 'due-soon' : '');

    const totalTasks = Object.keys(project.timeline).length;
    const completedTasks = Object.values(project.timeline).filter(Boolean).length;
    const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    
    card.innerHTML = `
        <h4 class="card-title">${project.title}</h4>
        <div class="progress-bar-container"><div class="progress-bar" style="width: ${progress}%;"></div></div>
        <div class="card-footer">
            <div class="card-author">
                <div class="user-avatar" style="background-color: ${stringToColor(project.authorName)}">${project.authorName.charAt(0)}</div>
                <span>${project.authorName}</span>
            </div>
            <div class="card-editor">
                <span class="card-deadline ${deadlineClass}">${deadline.toLocaleDateString()}</span>
            </div>
        </div>`;
    card.addEventListener('click', () => openDetailsModal(project.id));
    return card;
}

// --- CALENDAR VIEW ---
function renderCalendar() {
    const calendarGrid = document.getElementById('calendar-grid');
    const monthYear = document.getElementById('month-year');
    calendarGrid.innerHTML = '';
    
    const month = calendarDate.getMonth();
    const year = calendarDate.getFullYear();
    monthYear.textContent = `${calendarDate.toLocaleString('default', { month: 'long' })} ${year}`;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(day => {
        calendarGrid.innerHTML += `<div class="calendar-day-name">${day}</div>`;
    });

    for (let i = 0; i < firstDay; i++) {
        calendarGrid.innerHTML += `<div></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day';
        dayEl.innerHTML = `<div class="day-number">${day}</div>`;
        
        const dayProjects = allProjects.filter(p => {
            const d = new Date(p.deadline + 'T00:00:00');
            return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
        });
        
        dayProjects.forEach(p => {
            const eventEl = document.createElement('div');
            eventEl.className = 'calendar-event';
            if (new Date(p.deadline) < new Date()) eventEl.classList.add('overdue');
            eventEl.textContent = p.title;
            eventEl.addEventListener('click', () => openDetailsModal(p.id));
            dayEl.appendChild(eventEl);
        });
        calendarGrid.appendChild(dayEl);
    }
}

function changeMonth(offset) {
    calendarDate.setMonth(calendarDate.getMonth() + offset);
    renderCalendar();
}

// --- MODALS & FORMS ---
function openProjectModal() {
    document.getElementById('project-form').reset();
    document.getElementById('modal-title').textContent = 'Propose New Article';
    document.getElementById('project-modal').style.display = 'flex';
}

async function handleProjectFormSubmit(e) {
    e.preventDefault();
    const type = document.getElementById('project-type').value;
    const newProject = {
        title: document.getElementById('project-title').value, type,
        proposal: document.getElementById('project-proposal').value,
        deadline: document.getElementById('project-deadline').value,
        authorId: currentUser.uid, authorName: currentUserName,
        editorId: null, editorName: null,
        proposalStatus: 'pending', status: 'Proposed',
        interviewDate: null,
        timeline: projectTimelines[type].reduce((acc, task) => ({...acc, [task]: false }), {}),
        activity: [{ text: 'created the project.', authorName: currentUserName, timestamp: new Date() }]
    };
    try {
        await db.collection('projects').add(newProject);
        closeAllModals();
    } catch (error) { console.error("Error saving project:", error); }
}

function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(modal => modal.style.display = 'none');
    if (activityUnsubscribe) activityUnsubscribe();
    currentlyViewedProjectId = null;
}

function openDetailsModal(projectId) {
    const project = allProjects.find(p => p.id === projectId);
    if (!project) return;
    currentlyViewedProjectId = projectId;
    
    document.getElementById('details-title').textContent = project.title;
    document.getElementById('details-author').textContent = project.authorName;
    document.getElementById('details-editor').textContent = project.editorName || 'Not Assigned';
    document.getElementById('details-status').textContent = project.proposalStatus !== 'approved' ? `Proposal: ${project.proposalStatus}` : getProjectColumn(project);
    document.getElementById('details-deadline').textContent = new Date(project.deadline + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    document.getElementById('details-proposal').textContent = project.proposal || 'No proposal provided.';

    const isAdmin = currentUserRole === 'admin';
    const isAuthor = currentUser.uid === project.authorId;
    document.getElementById('admin-approval-section').style.display = isAdmin && project.proposalStatus === 'pending' ? 'block' : 'none';
    document.getElementById('delete-section').style.display = isAuthor || isAdmin ? 'block' : 'none';
    document.getElementById('assign-editor-section').style.display = isAdmin ? 'flex' : 'none';
    document.getElementById('interview-details-section').style.display = project.type === 'Interview' ? 'block' : 'none';

    populateEditorDropdown(project.editorId);
    renderTimeline(project);
    renderDeadlineHistory(project);
    renderInterviewStatus(project);
    
    if (activityUnsubscribe) activityUnsubscribe();
    activityUnsubscribe = db.collection('projects').doc(projectId).onSnapshot(doc => {
        if (doc.exists) renderActivityFeed(doc.data().activity || []);
    });
    
    document.getElementById('details-modal').style.display = 'flex';
}

function populateEditorDropdown(currentEditorId) {
    const dropdown = document.getElementById('editor-dropdown');
    dropdown.innerHTML = '<option value="">Assign an Editor</option>';
    allEditors.forEach(editor => {
        const option = document.createElement('option');
        option.value = editor.id;
        option.textContent = editor.name;
        if (editor.id === currentEditorId) option.selected = true;
        dropdown.appendChild(option);
    });
}

function renderTimeline(project) {
    const timelineContainer = document.getElementById('details-timeline');
    timelineContainer.innerHTML = '';
    Object.entries(project.timeline).forEach(([task, completed]) => {
        const isEditable = currentUser.uid === project.authorId || currentUserRole === 'admin';
        const taskEl = document.createElement('div');
        taskEl.className = 'task';
        taskEl.innerHTML = `<input type="checkbox" id="task-${task.replace(/\s+/g, '-')}" ${completed ? 'checked' : ''} ${!isEditable ? 'disabled' : ''}><label for="task-${task.replace(/\s+/g, '-')}">${task}</label>`;
        taskEl.querySelector('input').addEventListener('change', (e) => updateTaskStatus(project.id, task, e.target.checked));
        timelineContainer.appendChild(taskEl);
    });
}

function renderDeadlineHistory(project) {
    const historyContainer = document.getElementById('deadline-history');
    historyContainer.innerHTML = project.originalDeadline ? `<p><strong>Original:</strong> ${project.originalDeadline}</p>` : '';
    project.deadlineHistory?.forEach(entry => {
        historyContainer.innerHTML += `<p><strong>${entry.newDeadline}:</strong> ${entry.reason}</p>`;
    });
}

function renderInterviewStatus(project) {
    const statusDisplay = document.getElementById('interview-status-display');
    if (project.interviewDate?.seconds) {
        statusDisplay.innerHTML = `<strong>Scheduled for:</strong> ${new Date(project.interviewDate.seconds * 1000).toLocaleString()}`;
    } else {
        statusDisplay.innerHTML = 'Not yet scheduled.';
    }
}

function renderActivityFeed(activity) {
    const activityFeed = document.getElementById('details-activity-feed');
    activityFeed.innerHTML = '';
    if (!activity) return;
    activity.sort((a, b) => b.timestamp.seconds - a.timestamp.seconds).forEach(item => {
        activityFeed.innerHTML += `<div class="feed-item">
            <div class="user-avatar" style="background-color: ${stringToColor(item.authorName)}">${item.authorName.charAt(0)}</div>
            <div class="feed-content">
                <p><span class="author">${item.authorName}</span> ${item.text}</p>
                <span class="timestamp">${new Date(item.timestamp.seconds * 1000).toLocaleString()}</span>
            </div>
        </div>`;
    });
}

// --- ACTIONS & UPDATES ---
async function addActivity(projectId, text) {
    const activity = { text, authorName: currentUserName, timestamp: new Date() };
    await db.collection('projects').doc(projectId).update({ activity: firebase.firestore.FieldValue.arrayUnion(activity) });
}

async function updateTaskStatus(projectId, task, isCompleted) {
    await db.collection('projects').doc(projectId).update({ [`timeline.${task}`]: isCompleted });
    addActivity(projectId, `${isCompleted ? 'completed' : 'un-completed'} the task: "${task}"`);
}

async function handleAddComment() {
    const commentInput = document.getElementById('comment-input');
    if (commentInput.value.trim() && currentlyViewedProjectId) {
        await addActivity(currentlyViewedProjectId, `commented: "${commentInput.value.trim()}"`);
        commentInput.value = '';
    }
}

async function updateProposalStatus(newStatus) {
    if (!currentlyViewedProjectId || currentUserRole !== 'admin') return;
    try {
        await db.collection('projects').doc(currentlyViewedProjectId).update({
            proposalStatus: newStatus,
            'timeline.Topic Proposal Complete': newStatus === 'approved'
        });
        await addActivity(currentlyViewedProjectId, `set the proposal status to **${newStatus}**.`);
        closeAllModals();
    } catch (error) { console.error("Error updating status:", error); }
}

async function handleScheduleInterview() {
    const dateInput = document.getElementById('interview-date').value;
    if (!dateInput || !currentlyViewedProjectId) return;
    const interviewDate = new Date(dateInput);
    await db.collection('projects').doc(currentlyViewedProjectId).update({ 
        interviewDate: interviewDate,
        'timeline.Interview Scheduled': true
    });
    addActivity(currentlyViewedProjectId, `scheduled the interview for ${interviewDate.toLocaleString()}`);
}

async function handleAssignEditor() {
    const dropdown = document.getElementById('editor-dropdown');
    const editorId = dropdown.value;
    if (!editorId) return; // No editor selected
    const selectedEditor = allEditors.find(e => e.id === editorId);
    if (!selectedEditor || !currentlyViewedProjectId) return;
    await db.collection('projects').doc(currentlyViewedProjectId).update({
        editorId: editorId,
        editorName: selectedEditor.name
    });
    addActivity(currentlyViewedProjectId, `assigned **${selectedEditor.name}** as the editor.`);
}

async function handleUpdateDeadline() {
    const newDeadline = document.getElementById('new-deadline-input').value;
    const reason = document.getElementById('deadline-reason-input').value;
    if (!currentlyViewedProjectId || !newDeadline || !reason) {
        alert("A new deadline and reason are required.");
        return;
    }
    const project = allProjects.find(p => p.id === currentlyViewedProjectId);
    await db.collection('projects').doc(currentlyViewedProjectId).update({
        deadline: newDeadline,
        originalDeadline: project.originalDeadline || project.deadline,
        deadlineHistory: firebase.firestore.FieldValue.arrayUnion({ newDeadline, reason })
    });
    addActivity(currentlyViewedProjectId, `changed the deadline to **${newDeadline}** for reason: "${reason}"`);
    closeAllModals();
}

async function handleDeleteProject() {
    if (!currentlyViewedProjectId) return;
    if (confirm("Are you sure you want to permanently delete this project? This action cannot be undone.")) {
        try {
            await db.collection('projects').doc(currentlyViewedProjectId).delete();
            closeAllModals();
        } catch (error) { console.error("Error deleting project:", error); }
    }
}

// --- STATUS REPORT ---
function generateStatusReport() {
    const reportContent = document.getElementById('report-content');
    const now = new Date();
    const overdueProjects = allProjects.filter(p => new Date(p.deadline) < now && getProjectColumn(p) !== 'Completed');
    const activeProjects = allProjects.filter(p => getProjectColumn(p) !== 'Completed' && p.proposalStatus === 'approved');

    let reportHTML = `<div class="report-section"><h3><span class="emoji">⚠️</span> Overdue Projects (${overdueProjects.length})</h3>`;
    if (overdueProjects.length > 0) {
        overdueProjects.forEach(p => {
            reportHTML += `<div class="report-item overdue-item"><span class="report-item-title">${p.title}</span> <span class="report-item-meta">by ${p.authorName} - Due ${p.deadline}</span></div>`;
        });
    } else { reportHTML += `<p>No overdue projects. Great job, team!</p>`; }
    reportHTML += `</div>`;

    reportHTML += `<div class="report-section"><h3><span class="emoji">🚀</span> Active Projects by Person</h3>`;
    const teamMembers = [...new Map(allProjects.map(p => [p.authorId, {name: p.authorName, id: p.authorId}])).values()];
    teamMembers.forEach(person => {
        const projects = activeProjects.filter(p => p.authorId === person.id);
        if (projects.length > 0) {
            reportHTML += `<h4>${person.name} (${projects.length})</h4>`;
            projects.forEach(p => {
                reportHTML += `<div class="report-item"><span class="report-item-title">${p.title}</span> <span class="report-item-meta">${getProjectColumn(p)} - Due ${p.deadline}</span></div>`;
            });
        }
    });
    reportHTML += `</div>`;

    reportContent.innerHTML = reportHTML;
    document.getElementById('report-modal').style.display = 'flex';
}

// --- UTILITY ---
function stringToColor(str) {
    if (!str) return '#cccccc';
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    let color = '#';
    for (let i = 0; i < 3; i++) {
        let value = (hash >> (i * 8)) & 0xFF;
        color += ('00' + value.toString(16)).substr(-2);
    }
    return color;
}
