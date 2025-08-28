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
let currentlyViewedProjectId = null;
let currentView = 'interviews'; // Default view
let calendarDate = new Date();

// --- CONSTANTS ---
// Updated timeline to follow logical order
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

const KANBAN_COLUMNS = {
    'interviews': ["Topic Proposal", "Interview Stage", "Writing Stage", "In Review", "Reviewing Suggestions", "Completed"],
    'opeds': ["Topic Proposal", "Writing Stage", "In Review", "Reviewing Suggestions", "Completed"],
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
    document.getElementById('logout-button').addEventListener('click', () => auth.signOut());
    document.querySelectorAll('.nav-item').forEach(link => link.addEventListener('click', e => handleNavClick(e, link.id)));
    document.getElementById('add-project-button').addEventListener('click', openProjectModal);
    document.getElementById('project-form').addEventListener('submit', handleProjectFormSubmit);
    document.getElementById('status-report-button').addEventListener('click', generateStatusReport);
    document.getElementById('add-comment-button').addEventListener('click', handleAddComment);
    document.getElementById('schedule-interview-button').addEventListener('click', handleScheduleInterview);
    document.getElementById('assign-editor-button').addEventListener('click', handleAssignEditor);
    document.getElementById('update-deadlines-button').addEventListener('click', handleUpdateDeadlines);
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
    renderCurrentView();
}

function renderCurrentView() {
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
        renderCurrentView();
        updateNavCounts();

        if (currentlyViewedProjectId) {
            const project = allProjects.find(p => p.id === currentlyViewedProjectId);
            if (project) {
                refreshDetailsModal(project);
            } else {
                closeAllModals();
            }
        }
    });
}

function updateNavCounts() {
    const myAssignmentsCount = getMyAssignmentsCount();
    const navLink = document.querySelector('#nav-my-assignments span');
    if (navLink) {
        navLink.textContent = `My Assignments (${myAssignmentsCount})`;
    }
}

function getMyAssignmentsCount() {
    return allProjects.filter(p => {
        const isAuthor = p.authorId === currentUser.uid;
        const isEditor = p.editorId === currentUser.uid;
        const timeline = p.timeline || {};

        if (isAuthor) {
            // Author tasks: waiting for review completion, or approved but not written
            if (timeline["Review Complete"] && !timeline["Suggestions Reviewed"]) return true;
            if (p.proposalStatus === 'approved' && !timeline["Article Writing Complete"]) return true;
        }

        if (isEditor) {
            // Editor tasks: assigned and article ready for review
            if (timeline["Article Writing Complete"] && !timeline["Review Complete"]) return true;
        }

        return false;
    }).length;
}

function filterProjects() {
    switch(currentView) {
        case 'interviews': return allProjects.filter(p => p.type === 'Interview');
        case 'opeds': return allProjects.filter(p => p.type === 'Op-Ed');
        case 'my-assignments':
            return allProjects.filter(p => {
                const isAuthor = p.authorId === currentUser.uid;
                const isEditor = p.editorId === currentUser.uid;
                const timeline = p.timeline || {};

                if (isAuthor) {
                    if (timeline["Review Complete"] && !timeline["Suggestions Reviewed"]) return true;
                    if (p.proposalStatus === 'approved' && !timeline["Article Writing Complete"]) return true;
                }

                if (isEditor) {
                    if (timeline["Article Writing Complete"] && !timeline["Review Complete"]) return true;
                }

                return false;
            });
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
        const columnProjects = projectsToRender.filter(p => getProjectColumn(p, currentView) === columnTitle);
        const columnEl = document.createElement('div');
        columnEl.className = 'kanban-column';
        columnEl.innerHTML = `<h3><span class="column-title">${columnTitle}</span><span class="task-count">${columnProjects.length}</span></h3><div class="kanban-cards"></div>`;
        columnProjects.forEach(project => {
            columnEl.querySelector('.kanban-cards').appendChild(createProjectCard(project));
        });
        board.appendChild(columnEl);
    });
}

function getProjectColumn(project, view = 'interviews') {
    const timeline = project.timeline || {};

    // Final state: Completed
    if (timeline["Suggestions Reviewed"]) {
        return view === 'my-assignments' ? "Done" : "Completed";
    }

    // "My Assignments" view has its own simplified logic
    if (view === 'my-assignments') {
        const isAuthor = project.authorId === currentUser.uid;
        const isEditor = project.editorId === currentUser.uid;

        if (isEditor && timeline["Article Writing Complete"] && !timeline["Review Complete"]) {
            return "In Review"; // Editor's main task
        }
        if (isAuthor) {
            if (timeline["Review Complete"] && !timeline["Suggestions Reviewed"]) return "In Review"; // Author reviewing suggestions
            if (project.proposalStatus === 'approved' && !timeline["Article Writing Complete"]) return "In Progress";
        }
        return "To Do"; // Default for anything else in this view
    }

    // Main Workflow Logic (for 'interviews' and 'opeds')
    if (project.proposalStatus !== 'approved') {
        return "Topic Proposal";
    }

    if (timeline["Review Complete"]) {
        return "Reviewing Suggestions";
    }

    if (timeline["Article Writing Complete"]) {
        return project.editorId ? "In Review" : "Reviewing Suggestions"; // Moves to "In Review" ONLY after an editor is assigned.
    }

    if (project.type === 'Interview') {
        if (timeline["Interview Complete"]) {
            return "Writing Stage";
        }
        if (timeline["Topic Proposal Complete"]) {
            return "Interview Stage";
        }
    } else { // Op-Ed Logic
        if (timeline["Topic Proposal Complete"]) {
            return "Writing Stage";
        }
    }

    // Default catch-all
    return "Topic Proposal";
}


function createProjectCard(project) {
    const card = document.createElement('div');
    card.className = 'kanban-card';
    card.dataset.id = project.id;

    const column = getProjectColumn(project, currentView);
    const timeline = project.timeline || {};

    // Color coding based on status and progress
    if (column === "Interview Stage" && timeline["Interview Scheduled"] && !timeline["Interview Complete"]) {
        card.classList.add('status-yellow');
    } else if (column === "Writing Stage" || column === "In Review") {
        card.classList.add('status-yellow');
    } else if (column === "Reviewing Suggestions") {
        card.classList.add('status-blue');
    } else if (column === "Completed" || column === "Done") {
        card.classList.add('status-green');
    }

    const deadline = new Date(project.deadline + 'T23:59:59');
    const daysUntilDue = (deadline - new Date()) / (1000 * 60 * 60 * 24);
    let deadlineClass = daysUntilDue < 0 ? 'overdue' : (daysUntilDue < 7 ? 'due-soon' : '');

    const totalTasks = projectTimelines[project.type] ? projectTimelines[project.type].length : 0;
    const completedTasks = timeline ? Object.values(timeline).filter(Boolean).length : 0;
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

    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(day => {
        calendarGrid.innerHTML += `<div class="calendar-day-name">${day}</div>`;
    });

    const firstDay = new Date(year, month, 1).getDay();
    for (let i = 0; i < firstDay; i++) {
        calendarGrid.innerHTML += `<div></div>`;
    }

    const daysInMonth = new Date(year, month + 1, 0).getDate();
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
    const timeline = projectTimelines[type].reduce((acc, task) => ({...acc, [task]: false }), {});

    const newProject = {
        title: document.getElementById('project-title').value,
        type,
        proposal: document.getElementById('project-proposal').value,
        deadline: document.getElementById('project-deadline').value,
        authorId: currentUser.uid,
        authorName: currentUserName,
        editorId: null,
        editorName: null,
        proposalStatus: 'pending',
        timeline: timeline,
        deadlines: {},
        activity: [{ text: 'created the project.', authorName: currentUserName, timestamp: new Date() }]
    };
    try {
        await db.collection('projects').add(newProject);
        closeAllModals();
    } catch (error) {
        console.error("Error saving project:", error);
    }
}

function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(modal => modal.style.display = 'none');
    currentlyViewedProjectId = null;
}

function openDetailsModal(projectId) {
    const project = allProjects.find(p => p.id === projectId);
    if (!project) return;
    currentlyViewedProjectId = projectId;
    refreshDetailsModal(project);
    document.getElementById('details-modal').style.display = 'flex';
}

function refreshDetailsModal(project) {
    const isAuthor = currentUser.uid === project.authorId;
    const isEditor = currentUser.uid === project.editorId;
    const isAdmin = currentUserRole === 'admin';

    document.getElementById('details-title').textContent = project.title;
    document.getElementById('details-author').textContent = project.authorName;
    document.getElementById('details-editor').textContent = project.editorName || 'Not Assigned';
    document.getElementById('details-status').textContent = project.proposalStatus !== 'approved' ? `Proposal: ${project.proposalStatus}` : getProjectColumn(project, currentView);
    document.getElementById('details-deadline').textContent = new Date(project.deadline + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    document.getElementById('details-proposal').textContent = project.proposal || 'No proposal provided.';

    document.getElementById('admin-approval-section').style.display = isAdmin && project.proposalStatus === 'pending' ? 'block' : 'none';

    // Show editor assignment when article is complete and no editor assigned
    const needsEditor = project.timeline && project.timeline["Article Writing Complete"] && !project.editorId;
    document.getElementById('assign-editor-section').style.display = isAdmin && needsEditor ? 'flex' : 'none';

    const interviewSection = document.getElementById('interview-details-section');
    if (project.type === 'Interview' && project.proposalStatus === 'approved') {
        interviewSection.style.display = 'block';
        interviewSection.querySelector('#interview-date').disabled = !isAdmin && !isAuthor;
        interviewSection.querySelector('#schedule-interview-button').disabled = !isAdmin && !isAuthor;
    } else {
        interviewSection.style.display = 'none';
    }

    populateEditorDropdown(project.editorId);
    renderTimeline(project, isAuthor, isEditor, isAdmin);
    renderDeadlines(project, isAuthor, isEditor, isAdmin);
    renderInterviewStatus(project);
    renderActivityFeed(project.activity || []);
}

function renderDeadlines(project, isAuthor, isEditor, isAdmin) {
    const container = document.getElementById('details-deadlines-list');
    container.innerHTML = '';

    const writerDeadlines = project.type === "Interview"
        ? ["Interview Contact", "Interview Scheduled", "Interview Complete", "Article Writing Complete", "Suggestions Reviewed"]
        : ["Article Writing Complete", "Suggestions Reviewed"];
    const editorDeadlines = ["Review In Progress", "Review Complete"];

    let deadlinesToShow = [];

    if (isAuthor || isAdmin) {
        deadlinesToShow = [...writerDeadlines];
    }
    if (isEditor || isAdmin) {
        deadlinesToShow = [...new Set([...deadlinesToShow, ...editorDeadlines])];
    }

    deadlinesToShow.forEach(task => {
        const val = project.deadlines?.[task] || '';
        let disabled = true;

        if ((writerDeadlines.includes(task) && (isAuthor || isAdmin)) ||
            (editorDeadlines.includes(task) && (isEditor || isAdmin))) {
            disabled = false;
        }

        const deadlineLabels = {
            "Interview Contact": "Email Professor for Interview",
            "Interview Scheduled": "Interview Date",
            "Interview Complete": "Interview Complete By",
            "Article Writing Complete": "Article Writing Complete By",
            "Review In Progress": "Review In Progress By",
            "Review Complete": "Review Complete By",
            "Suggestions Reviewed": "Review Suggestions By"
        };

        const label = deadlineLabels[task] || task;

        container.innerHTML += `
            <div class="form-group">
                <label for="deadline-${task.replace(/\s+/g, '-')}">${label}</label>
                <input type="date" id="deadline-${task.replace(/\s+/g, '-')}" value="${val}" ${disabled ? 'disabled' : ''}>
            </div>`;
    });
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

function renderTimeline(project, isAuthor, isEditor, isAdmin) {
    const timelineContainer = document.getElementById('details-timeline');
    timelineContainer.innerHTML = '';
    const timelineTasks = projectTimelines[project.type] || [];

    timelineTasks.forEach(task => {
        let canEditTask = false;

        if (task === "Topic Proposal Complete") {
            canEditTask = false; // Only changed by admin approval
        } else if (task === "Review In Progress" || task === "Review Complete") {
            canEditTask = isEditor || isAdmin; // Only editors can check review tasks
        } else {
            canEditTask = isAuthor || isAdmin; // Authors can check their tasks
        }

        const completed = project.timeline[task];
        const taskEl = document.createElement('div');
        taskEl.className = 'task';
        const taskId = `task-${task.replace(/\s+/g, '-')}`;
        taskEl.innerHTML = `<input type="checkbox" id="${taskId}" ${completed ? 'checked' : ''} ${!canEditTask ? 'disabled' : ''}><label for="${taskId}">${task}</label>`;

        if (canEditTask) {
            taskEl.querySelector('input').addEventListener('change', async (e) => {
                await updateTaskStatus(project.id, task, e.target.checked);
            });
        }

        timelineContainer.appendChild(taskEl);
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
    const updateData = { [`timeline.${task}`]: isCompleted };

    await db.collection('projects').doc(projectId).update(updateData);
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
        const updateData = {
            proposalStatus: newStatus,
            'timeline.Topic Proposal Complete': newStatus === 'approved'
        };

        await db.collection('projects').doc(currentlyViewedProjectId).update(updateData);
        await addActivity(currentlyViewedProjectId, `${newStatus} the proposal.`);
    } catch (error) {
        console.error("Error updating status:", error);
    }
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
    if (!editorId) return;
    const selectedEditor = allEditors.find(e => e.id === editorId);
    if (!selectedEditor || !currentlyViewedProjectId) return;
    await db.collection('projects').doc(currentlyViewedProjectId).update({
        editorId: editorId,
        editorName: selectedEditor.name
    });
    addActivity(currentlyViewedProjectId, `assigned **${selectedEditor.name}** as the editor.`);
}

async function handleUpdateDeadlines() {
    if (!currentlyViewedProjectId) return;
    const deadlineInputs = document.querySelectorAll('#details-deadlines-list input[type="date"]');
    const project = allProjects.find(p => p.id === currentlyViewedProjectId);
    const newDeadlines = project.deadlines || {};

    deadlineInputs.forEach(input => {
        const taskKey = input.id.replace('deadline-', '').replace(/-/g, ' ');
        if(input.value) {
            newDeadlines[taskKey] = input.value;
        } else {
            delete newDeadlines[taskKey];
        }
    });

    try {
        await db.collection('projects').doc(currentlyViewedProjectId).update({
            deadlines: newDeadlines
        });
        addActivity(currentlyViewedProjectId, `updated the task deadlines.`);
    } catch (error) {
        console.error("Error updating deadlines:", error);
    }
}

async function handleDeleteProject() {
    if (!currentlyViewedProjectId) return;
    if (confirm("Are you sure you want to permanently delete this project? This action cannot be undone.")) {
        try {
            await db.collection('projects').doc(currentlyViewedProjectId).delete();
            closeAllModals();
        } catch (error) {
            console.error("Error deleting project:", error);
        }
    }
}

// --- STATUS REPORT ---
function generateStatusReport() {
    const reportContent = document.getElementById('report-content');
    const now = new Date();
    const overdueProjects = allProjects.filter(p => new Date(p.deadline) < now && getProjectColumn(p, 'interviews') !== 'Completed');
    const activeProjects = allProjects.filter(p => getProjectColumn(p, 'interviews') !== 'Completed' && p.proposalStatus === 'approved');

    let reportHTML = `<div class="report-section"><h3><span class="emoji">⚠️</span> Overdue Projects (${overdueProjects.length})</h3>`;
    if (overdueProjects.length > 0) {
        overdueProjects.forEach(p => {
            reportHTML += `<div class="report-item overdue-item"><span class="report-item-title">${p.title}</span> <span class="report-item-meta">by ${p.authorName} - Due ${p.deadline}</span></div>`;
        });
    } else {
        reportHTML += `<p>No overdue projects. Great job, team!</p>`;
    }
    reportHTML += `</div>`;

    reportHTML += `<div class="report-section"><h3><span class="emoji">🚀</span> Active Projects by Person</h3>`;
    const teamMembers = [...new Map(allProjects.map(p => [p.authorId, {name: p.authorName, id: p.authorId}])).values()];
    teamMembers.forEach(person => {
        const projects = activeProjects.filter(p => p.authorId === person.id);
        if (projects.length > 0) {
            reportHTML += `<h4>${person.name} (${projects.length})</h4>`;
            projects.forEach(p => {
                reportHTML += `<div class="report-item"><span class="report-item-title">${p.title}</span> <span class="report-item-meta">${getProjectColumn(p, 'interviews')} - Due ${p.deadline}</span></div>`;
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
