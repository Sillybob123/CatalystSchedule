// ===============================
// Catalyst Tracker - FIXED Dashboard JS
// ===============================

// ---- Firebase Configuration ----
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
const db = firebase.firestore();

// ---- App State ----
let currentUser = null, currentUserName = null, currentUserRole = null;
let allProjects = [], allEditors = [];
let currentlyViewedProjectId = null;
let currentView = 'interviews';
let calendarDate = new Date();

// ======================
//  Initialization
// ======================
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
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
        subscribeToProjects();

        document.getElementById('loader').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
    } catch (error) {
        console.error("Initialization Error:", error);
        alert("Could not load your profile. Please try again.");
    }
});

async function fetchEditors() {
    const editorsSnapshot = await db.collection('users').where('role', 'in', ['admin', 'editor']).get();
    allEditors = editorsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

function setupUI() {
    document.getElementById('user-name').textContent = currentUserName;
    document.getElementById('user-role').textContent = currentUserRole;
    const avatar = document.getElementById('user-avatar');
    avatar.textContent = currentUserName.charAt(0).toUpperCase();
    avatar.style.backgroundColor = stringToColor(currentUserName);
    if (currentUserRole === 'admin') {
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'flex');
    }
}

// ==================
//  Event Listeners
// ==================
function setupNavAndListeners() {
    document.getElementById('logout-button').addEventListener('click', () => auth.signOut());
    document.querySelectorAll('.nav-item').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            const view = link.id.replace('nav-', '');
            handleNavClick(view);
        });
    });

    // Modal and form listeners
    document.getElementById('add-project-button').addEventListener('click', openProjectModal);
    document.getElementById('project-form').addEventListener('submit', handleProjectFormSubmit);
    document.getElementById('status-report-button').addEventListener('click', generateStatusReport);
    document.getElementById('add-comment-button').addEventListener('click', handleAddComment);
    document.getElementById('schedule-interview-button').addEventListener('click', handleScheduleInterview);
    document.getElementById('assign-editor-button').addEventListener('click', handleAssignEditor);
    document.getElementById('update-deadlines-button').addEventListener('click', handleUpdateDeadlines);
    document.getElementById('delete-project-button').addEventListener('click', handleDeleteProject);
    document.getElementById('approve-button').addEventListener('click', () => approveProposal(currentlyViewedProjectId));
    document.getElementById('reject-button').addEventListener('click', () => updateProposalStatus('rejected'));
    document.getElementById('prev-month').addEventListener('click', () => changeMonth(-1));
    document.getElementById('next-month').addEventListener('click', () => changeMonth(1));

    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', e => {
            if (e.target.classList.contains('modal-overlay') || e.target.classList.contains('close-button')) {
                closeAllModals();
            }
        });
    });
}

// ==================
//  View Management
// ==================
function handleNavClick(view) {
    currentView = view;
    document.querySelectorAll('.nav-item').forEach(l => {
        l.setAttribute('aria-current', 'false');
        l.classList.remove('active');
    });
    const activeLink = document.getElementById(`nav-${view}`);
    activeLink.classList.add('active');
    activeLink.setAttribute('aria-current', 'page');
    
    const viewTitles = {
        'my-assignments': 'My Assignments',
        'interviews': 'Catalyst in the Capital',
        'opeds': 'Op-Eds',
        'calendar': 'Deadlines Calendar'
    };
    document.getElementById('board-title').textContent = viewTitles[view];
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
        calendarView.style.display = 'none'; // Fixed: Hide calendar on non-calendar views
        renderKanbanBoard(filterProjects());
    }
}


// ==================
//  Data Handling
// ==================
function subscribeToProjects() {
    console.log("[FIREBASE] Setting up projects subscription...");
    
    db.collection('projects').orderBy("deadline", "desc").onSnapshot(snapshot => {
        console.log("[FIREBASE] Projects updated, processing...");
        
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
    }, error => {
        console.error("[FIREBASE ERROR] Projects subscription failed:", error);
    });
}

function updateNavCounts() {
    const myAssignmentsCount = allProjects.filter(p => {
        return p.authorId === currentUser.uid || p.editorId === currentUser.uid;
    }).length;
    
    const navLink = document.querySelector('#nav-my-assignments span');
    if (navLink) {
        navLink.textContent = `My Assignments (${myAssignmentsCount})`;
    }
}

// ==================
//  Kanban Board
// ==================
function renderKanbanBoard(projects) {
    console.log(`[RENDER] Rendering ${projects.length} projects`);
    const board = document.getElementById('kanban-board');
    board.innerHTML = '';
    
    // Get columns based on current view
    const columns = getColumnsForView(currentView);
    board.style.gridTemplateColumns = `repeat(${columns.length}, 1fr)`;
    
    // Create column structure
    columns.forEach(columnTitle => {
        const columnProjects = projects.filter(project => {
            const state = getProjectState(project);
            return state.column === columnTitle;
        });
        
        console.log(`[COLUMN] "${columnTitle}" has ${columnProjects.length} projects`);

        const columnEl = document.createElement('div');
        columnEl.className = 'kanban-column';
        columnEl.innerHTML = `
            <h3>
                <span class="column-title">${columnTitle}</span>
                <span class="task-count">${columnProjects.length}</span>
            </h3>
            <div class="kanban-cards"></div>
        `;
        
        const cardsContainer = columnEl.querySelector('.kanban-cards');
        columnProjects.forEach(project => {
            cardsContainer.appendChild(createProjectCard(project));
        });
        
        board.appendChild(columnEl);
    });
}

function filterProjects() {
    switch (currentView) {
        case 'interviews':
            return allProjects.filter(p => p.type === 'Interview');
        case 'opeds':
            return allProjects.filter(p => p.type === 'Op-Ed');
        case 'my-assignments':
            return allProjects.filter(p => p.authorId === currentUser.uid || p.editorId === currentUser.uid);
        default:
            return [];
    }
}

function createProjectCard(project) {
    const state = getProjectState(project);
    const card = document.createElement('div');
    
    // Apply color class based on state
    card.className = `kanban-card status-${state.color}`;
    card.dataset.id = project.id;
    
    const progress = calculateProgress(project.timeline);
    const daysUntilDeadline = Math.ceil((new Date(project.deadline) - new Date()) / (1000 * 60 * 60 * 24));
    const deadlineClass = daysUntilDeadline < 0 ? 'overdue' : daysUntilDeadline <= 3 ? 'due-soon' : '';
    
    card.innerHTML = `
        <h4 class="card-title">${project.title}</h4>
        <div class="card-meta">
            <span class="card-type">${project.type}</span>
            <span class="card-status">${state.statusText}</span>
        </div>
        <div class="progress-bar-container">
            <div class="progress-bar" style="width: ${progress}%"></div>
        </div>
        <div class="card-footer">
            <div class="card-author">
                <div class="user-avatar" style="background: ${stringToColor(project.authorName)}">
                    ${project.authorName.charAt(0)}
                </div>
                <span>${project.authorName}</span>
            </div>
            <div class="card-deadline ${deadlineClass}">
                ${new Date(project.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
        </div>
    `;
    
    card.addEventListener('click', () => openDetailsModal(project.id));
    return card;
}

// =================
// Calendar
// =================
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
            if (!p.deadline) return false;
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

// =================
// Modals
// =================
function openProjectModal() {
    document.getElementById('project-form').reset();
    document.getElementById('modal-title').textContent = 'Propose New Article';
    document.getElementById('project-modal').style.display = 'flex';
}

function openDetailsModal(projectId) {
    const project = allProjects.find(p => p.id === projectId);
    if (!project) return;
    currentlyViewedProjectId = projectId;
    refreshDetailsModal(project);
    document.getElementById('details-modal').style.display = 'flex';
}

function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(modal => modal.style.display = 'none');
    currentlyViewedProjectId = null;
}

function refreshDetailsModal(project) {
    const isAuthor = currentUser.uid === project.authorId;
    const isEditor = currentUser.uid === project.editorId;
    const isAdmin = currentUserRole === 'admin';
    
    document.getElementById('details-title').textContent = project.title;
    document.getElementById('details-author').textContent = project.authorName;
    document.getElementById('details-editor').textContent = project.editorName || 'Not Assigned';
    
    const state = getProjectState(project);
    document.getElementById('details-status').textContent = state.statusText;

    document.getElementById('details-deadline').textContent = new Date(project.deadline + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    document.getElementById('details-proposal').textContent = project.proposal || 'No proposal provided.';

    document.getElementById('admin-approval-section').style.display = isAdmin && project.proposalStatus === 'pending' ? 'block' : 'none';
    
    const needsEditor = project.timeline && project.timeline["Article Writing Complete"] && !project.editorId;
    document.getElementById('assign-editor-section').style.display = isAdmin && needsEditor ? 'flex' : 'none';
    
    const interviewSection = document.getElementById('interview-details-section');
    if (project.type === 'Interview') {
        interviewSection.style.display = 'block';
        renderInterviewStatus(project);
        const canSchedule = isAuthor || isAdmin;
        interviewSection.querySelector('#interview-date').disabled = !canSchedule;
        interviewSection.querySelector('#schedule-interview-button').disabled = !canSchedule;
    } else {
        interviewSection.style.display = 'none';
    }

    populateEditorDropdown(project.editorId);
    renderTimeline(project, isAuthor, isEditor, isAdmin);
    renderActivityFeed(project.activity || []);
}

function renderTimeline(project, isAuthor, isEditor, isAdmin) {
    const timelineContainer = document.getElementById('details-timeline');
    timelineContainer.innerHTML = '';
    const timeline = project.timeline || {};
    const timelineTasks = Object.keys(timeline);

    console.log(`[TIMELINE] Rendering timeline for ${project.title}:`, timeline);

    timelineTasks.forEach(task => {
        let canEditTask = false;
        const authorTasks = ["Interview Scheduled", "Interview Complete", "Article Writing Complete", "Suggestions Reviewed"];
        const editorTasks = ["Review In Progress", "Review Complete"];

        if (authorTasks.includes(task)) canEditTask = isAuthor || isAdmin;
        if (editorTasks.includes(task)) canEditTask = isEditor || isAdmin;

        const completed = timeline[task];
        const taskEl = document.createElement('div');
        taskEl.className = 'task';
        const taskId = `task-${task.replace(/\s+/g, '-')}`;
        taskEl.innerHTML = `
            <input type="checkbox" id="${taskId}" ${completed ? 'checked' : ''} ${!canEditTask ? 'disabled' : ''}>
            <label for="${taskId}">${task}</label>
        `;
        
        if (canEditTask) {
            taskEl.querySelector('input').addEventListener('change', async (e) => {
                console.log(`[CHECKBOX] ${task} changed to ${e.target.checked}`);
                await updateTaskStatus(project.id, task, e.target.checked);
            });
        }
        
        timelineContainer.appendChild(taskEl);
    });
}

function renderInterviewStatus(project) {
    const statusDisplay = document.getElementById('interview-status-display');
    const ts = project.interviewDate?.seconds;
    if (ts) {
        statusDisplay.innerHTML = `<strong>Scheduled for:</strong> ${new Date(ts * 1000).toLocaleString()}`;
    } else {
        statusDisplay.innerHTML = 'Not yet scheduled.';
    }
}

function renderActivityFeed(activity) {
    const activityFeed = document.getElementById('details-activity-feed');
    activityFeed.innerHTML = '';
    if (!activity || !Array.isArray(activity)) return;
    
    [...activity].sort((a, b) => b.timestamp.seconds - a.timestamp.seconds).forEach(item => {
        activityFeed.innerHTML += `<div class="feed-item">
            <div class="user-avatar" style="background-color: ${stringToColor(item.authorName)}">${item.authorName.charAt(0)}</div>
            <div class="feed-content">
                <p><span class="author">${item.authorName}</span> ${item.text}</p>
                <span class="timestamp">${new Date(item.timestamp.seconds * 1000).toLocaleString()}</span>
            </div>
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

// =================
// Actions
// =================
async function handleProjectFormSubmit(e) {
    e.preventDefault();
    const type = document.getElementById('project-type').value;
    const timeline = {};
    const tasks = type === "Interview" 
        ? ["Topic Proposal Complete", "Interview Scheduled", "Interview Complete", "Article Writing Complete", "Review In Progress", "Review Complete", "Suggestions Reviewed"] 
        : ["Topic Proposal Complete", "Article Writing Complete", "Review In Progress", "Review Complete", "Suggestions Reviewed"];
    
    tasks.forEach(task => timeline[task] = false);

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
        activity: [{ text: 'created the project.', authorName: currentUserName, timestamp: new Date() }]
    };
    
    try {
        await db.collection('projects').add(newProject);
        console.log("[PROJECT] Successfully created new project:", newProject.title);
        closeAllModals();
    } catch (error) {
        console.error("[PROJECT ERROR] Failed to create project:", error);
        alert('Failed to create project. Please try again.');
    }
}

async function addActivity(projectId, text) {
    const activity = { text, authorName: currentUserName, timestamp: new Date() };
    try {
        await db.collection('projects').doc(projectId).update({ 
            activity: firebase.firestore.FieldValue.arrayUnion(activity) 
        });
        console.log(`[ACTIVITY] Added: ${text}`);
    } catch (error) {
        console.error(`[ACTIVITY ERROR] Failed to add activity:`, error);
    }
}

async function updateTaskStatus(projectId, taskName, isCompleted) {
    console.log(`[TASK UPDATE] ${taskName} -> ${isCompleted ? 'completed' : 'uncompleted'}`);
    
    const updates = {
        [`timeline.${taskName}`]: isCompleted
    };
    
    // Handle automatic state transitions
    if (isCompleted) {
        switch (taskName) {
            case "Topic Proposal Complete":
                // This is set automatically when admin approves
                break;
                
            case "Interview Scheduled":
                // Card should turn yellow and stay in Interview Stage
                break;
                
            case "Interview Complete":
                // Move to Writing Stage
                break;
                
            case "Article Writing Complete":
                // Trigger editor assignment flow
                break;
                
            case "Review Complete":
                // Move to Reviewing Suggestions
                break;
                
            case "Suggestions Reviewed":
                // Move to Completed
                break;
        }
    }
    
    try {
        await db.collection('projects').doc(projectId).update(updates);
        
        // Add activity log
        const activity = {
            text: `${isCompleted ? 'completed' : 'un-completed'} the task: "${taskName}"`,
            authorName: currentUserName,
            timestamp: new Date()
        };
        
        await db.collection('projects').doc(projectId).update({
            activity: window.firebase.firestore.FieldValue.arrayUnion(activity)
        });
        
        console.log(`[TASK UPDATE] Successfully updated ${taskName} for project ${projectId}`);
        
    } catch (error) {
        console.error('[TASK UPDATE ERROR]', error);
        alert('Failed to update task. Please try again.');
    }
}

async function handleAddComment() {
    const commentInput = document.getElementById('comment-input');
    if (commentInput.value.trim() && currentlyViewedProjectId) {
        await addActivity(currentlyViewedProjectId, `commented: "${commentInput.value.trim()}"`);
        commentInput.value = '';
    }
}

async function approveProposal(projectId) {
    if (!projectId) return;
    try {
        await db.collection('projects').doc(projectId).update({
            proposalStatus: 'approved',
            'timeline.Topic Proposal Complete': true // Automatically check this
        });
        
        await addActivity(projectId, 'approved the proposal.');
        console.log('[APPROVAL] Proposal approved and Topic Proposal Complete checked');
        
    } catch (error) {
        console.error('[APPROVAL ERROR]', error);
        alert('Failed to approve proposal. Please try again.');
    }
}

async function updateProposalStatus(newStatus) {
    if (!currentlyViewedProjectId || newStatus !== 'rejected') return;
    try {
        await db.collection('projects').doc(currentlyViewedProjectId).update({
            proposalStatus: newStatus
        });
        await addActivity(currentlyViewedProjectId, `rejected the proposal.`);
        console.log(`[REJECTION] Successfully rejected proposal for project ${currentlyViewedProjectId}`);
    } catch (error) {
        console.error(`[REJECTION ERROR] Failed to reject proposal:`, error);
        alert(`Failed to reject proposal. Please try again.`);
    }
}


async function handleScheduleInterview() {
    const dateInput = document.getElementById('interview-date').value;
    if (!dateInput || !currentlyViewedProjectId) return;
    
    try {
        const interviewDate = new Date(dateInput);
        await db.collection('projects').doc(currentlyViewedProjectId).update({ 
            interviewDate: interviewDate,
            'timeline.Interview Scheduled': true
        });
        
        await addActivity(currentlyViewedProjectId, `scheduled the interview for ${interviewDate.toLocaleString()}`);
        console.log(`[INTERVIEW] Successfully scheduled interview for ${interviewDate.toLocaleString()}`);
        
    } catch (error) {
        console.error(`[INTERVIEW ERROR] Failed to schedule interview:`, error);
        alert('Failed to schedule interview. Please try again.');
    }
}

async function handleAssignEditor() {
    const dropdown = document.getElementById('editor-dropdown');
    const editorId = dropdown.value;
    if (!editorId) return;
    
    const selectedEditor = allEditors.find(e => e.id === editorId);
    if (!selectedEditor || !currentlyViewedProjectId) return;
    
    try {
        await db.collection('projects').doc(currentlyViewedProjectId).update({
            editorId: editorId,
            editorName: selectedEditor.name
        });
        
        await addActivity(currentlyViewedProjectId, `assigned **${selectedEditor.name}** as the editor.`);
        console.log(`[EDITOR] Successfully assigned ${selectedEditor.name} as editor`);
        
    } catch (error) {
        console.error(`[EDITOR ERROR] Failed to assign editor:`, error);
        alert('Failed to assign editor. Please try again.');
    }
}

async function handleUpdateDeadlines() { 
    console.log("[DEADLINES] Update deadlines functionality not yet implemented");
}

async function handleDeleteProject() {
    if (!currentlyViewedProjectId) return;
    if (confirm("Are you sure you want to permanently delete this project? This action cannot be undone.")) {
        try {
            await db.collection('projects').doc(currentlyViewedProjectId).delete();
            console.log(`[DELETE] Successfully deleted project ${currentlyViewedProjectId}`);
            closeAllModals();
        } catch (error) {
            console.error(`[DELETE ERROR] Failed to delete project:`, error);
            alert('Failed to delete project. Please try again.');
        }
    }
}

function generateStatusReport() {
    const reportModal = document.getElementById('report-modal');
    const reportContent = document.getElementById('report-content');
    reportContent.innerHTML = ''; // Clear previous report

    // --- Overdue Projects Section ---
    const overdueProjects = allProjects.filter(p => {
        const deadline = new Date(p.deadline + 'T23:59:59');
        return deadline < new Date() && getProjectState(p).column !== 'Completed';
    });

    let reportHTML = `
        <div class="report-section">
            <h3><span class="emoji">🚨</span> Overdue Projects (${overdueProjects.length})</h3>
            ${overdueProjects.length > 0 ? overdueProjects.map(p => `
                <div class="report-item overdue-item" data-id="${p.id}">
                    <span class="report-item-title">${p.title}</span>
                    <span class="report-item-meta">Due: ${new Date(p.deadline + 'T00:00:00').toLocaleDateString()} | Author: ${p.authorName}</span>
                </div>
            `).join('') : '<p>No overdue projects. Great job!</p>'}
        </div>
    `;

    // --- In Review Section ---
    const inReviewProjects = allProjects.filter(p => {
        const state = getProjectState(p);
        return state.column === 'In Review' || state.column === 'Reviewing Suggestions';
    });

    reportHTML += `
        <div class="report-section">
            <h3><span class="emoji">🧐</span> In Review (${inReviewProjects.length})</h3>
            ${inReviewProjects.length > 0 ? inReviewProjects.map(p => `
                <div class="report-item" data-id="${p.id}">
                    <span class="report-item-title">${p.title}</span>
                    <span class="report-item-meta">${getProjectState(p).statusText} | Editor: ${p.editorName || 'N/A'}</span>
                </div>
            `).join('') : '<p>No projects are currently in review.</p>'}
        </div>
    `;

    // --- Upcoming Deadlines Section ---
    const upcomingProjects = allProjects.filter(p => {
        const deadline = new Date(p.deadline + 'T23:59:59');
        const now = new Date();
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(now.getDate() + 7);
        return deadline > now && deadline <= sevenDaysFromNow && getProjectState(p).column !== 'Completed';
    }).sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

    reportHTML += `
        <div class="report-section">
            <h3><span class="emoji">🗓️</span> Upcoming Deadlines (Next 7 Days) (${upcomingProjects.length})</h3>
            ${upcomingProjects.length > 0 ? upcomingProjects.map(p => `
                <div class="report-item" data-id="${p.id}">
                    <span class="report-item-title">${p.title}</span>
                    <span class="report-item-meta">Due: ${new Date(p.deadline + 'T00:00:00').toLocaleDateString()} | Status: ${getProjectState(p).statusText}</span>
                </div>
            `).join('') : '<p>No deadlines in the next 7 days.</p>'}
        </div>
    `;

    reportContent.innerHTML = reportHTML;

    // Add event listeners to the new report items
    reportContent.querySelectorAll('.report-item').forEach(item => {
        item.style.cursor = 'pointer';
        item.addEventListener('click', () => {
            closeAllModals();
            openDetailsModal(item.dataset.id);
        });
    });

    // Show the modal
    reportModal.style.display = 'flex';
}

// =================
// Utils
// =================
function stringToColor(str) {
    if (!str) return '#cccccc';
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    let color = '#';
    for (let i = 0; i < 3; i++) {
        let value = (hash >> (i * 8)) & 0xFF;
        color += ('00' + value.toString(16)).substr(-2);
    }
    return color;
}

function calculateProgress(timeline) {
    if (!timeline) return 0;
    const totalTasks = Object.keys(timeline).length;
    const completedTasks = Object.values(timeline).filter(Boolean).length;
    return totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
}
}
