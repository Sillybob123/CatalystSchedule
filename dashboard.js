// ===============================
// Catalyst Tracker - Complete Working Dashboard JS
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

// Initialize Firebase with error handling
try {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
        console.log("[FIREBASE] Firebase initialized successfully");
    }
} catch (initError) {
    console.error("[FIREBASE] Firebase initialization failed:", initError);
    alert("Failed to connect to the database. Please refresh the page and try again.");
}

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
        console.log("[INIT] User authenticated:", user.uid);
        
        // Try to get user document
        const userDoc = await db.collection('users').doc(user.uid).get();
        
        if (!userDoc.exists) {
            console.warn("[INIT] User document not found, creating default profile");
            
            const defaultUserData = {
                name: user.displayName || user.email.split('@')[0],
                email: user.email,
                role: 'writer',
                createdAt: new Date()
            };
            
            await db.collection('users').doc(user.uid).set(defaultUserData);
            currentUserName = defaultUserData.name;
            currentUserRole = defaultUserData.role;
        } else {
            const userData = userDoc.data();
            currentUserName = userData.name || user.displayName || user.email.split('@')[0];
            currentUserRole = userData.role || 'writer';
        }

        await fetchEditors();
        setupUI();
        setupNavAndListeners();
        subscribeToProjects();

        document.getElementById('loader').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
        
        console.log("[INIT] Initialization completed successfully");
        
    } catch (error) {
        console.error("Initialization Error:", error);
        alert("Could not load your profile. Please refresh the page and try again.");
    }
});

async function fetchEditors() {
    try {
        console.log("[INIT] Fetching editors...");
        const editorsSnapshot = await db.collection('users').where('role', 'in', ['admin', 'editor']).get();
        allEditors = editorsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("[INIT] Found", allEditors.length, "editors");
    } catch (error) {
        console.error("Error fetching editors:", error);
        allEditors = [];
    }
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
    // Navigation listeners
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
    
    // Check if status report button exists before adding listener
    const statusReportBtn = document.getElementById('status-report-button');
    if (statusReportBtn) {
        statusReportBtn.addEventListener('click', generateStatusReport);
    }
    
    document.getElementById('add-comment-button').addEventListener('click', handleAddComment);
    document.getElementById('assign-editor-button').addEventListener('click', handleAssignEditor);
    document.getElementById('delete-project-button').addEventListener('click', handleDeleteProject);
    document.getElementById('approve-button').addEventListener('click', () => approveProposal(currentlyViewedProjectId));
    document.getElementById('reject-button').addEventListener('click', () => updateProposalStatus('rejected'));
    document.getElementById('prev-month').addEventListener('click', () => changeMonth(-1));
    document.getElementById('next-month').addEventListener('click', () => changeMonth(1));

    // Proposal editing listeners
    const editProposalBtn = document.getElementById('edit-proposal-button');
    const saveProposalBtn = document.getElementById('save-proposal-button');
    const cancelProposalBtn = document.getElementById('cancel-proposal-button');

    if (editProposalBtn) editProposalBtn.addEventListener('click', enableProposalEditing);
    if (saveProposalBtn) saveProposalBtn.addEventListener('click', handleSaveProposal);
    if (cancelProposalBtn) cancelProposalBtn.addEventListener('click', disableProposalEditing);

    // Deadline management listeners
    const requestDeadlineBtn = document.getElementById('request-deadline-button');
    const setDeadlinesBtn = document.getElementById('set-deadlines-button');
    const requestDeadlineChangeBtn = document.getElementById('request-deadline-change-button');

    if (requestDeadlineBtn) requestDeadlineBtn.addEventListener('click', handleRequestDeadlineChange);
    if (setDeadlinesBtn) setDeadlinesBtn.addEventListener('click', handleSetDeadlines);
    if (requestDeadlineChangeBtn) requestDeadlineChangeBtn.addEventListener('click', handleRequestDeadlineChange);

    // Modal close listeners
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
    if (activeLink) {
        activeLink.classList.add('active');
        activeLink.setAttribute('aria-current', 'page');
    }
    
    const viewTitles = {
        'my-assignments': 'My Assignments',
        'interviews': 'Catalyst in the Capital',
        'opeds': 'Op-Eds',
        'calendar': 'Deadlines Calendar'
    };
    document.getElementById('board-title').textContent = viewTitles[view] || view;
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
        renderKanbanBoard(filterProjects());
    }
}

// ==================
//  Data Handling
// ==================
function subscribeToProjects() {
    console.log("[FIREBASE] Setting up projects subscription...");
    
    db.collection('projects').onSnapshot(snapshot => {
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
    
    const columns = getColumnsForView(currentView);
    
    columns.forEach(columnTitle => {
        const columnProjects = projects.filter(project => {
            const state = getProjectState(project);
            return state.column === columnTitle;
        });
        
        console.log(`[COLUMN] "${columnTitle}" has ${columnProjects.length} projects`);

        const columnEl = document.createElement('div');
        columnEl.className = 'kanban-column';
        
        columnEl.innerHTML = `
            <div class="column-header">
                <div class="column-title">
                    <span class="column-title-text">${columnTitle}</span>
                    <span class="task-count">${columnProjects.length}</span>
                </div>
            </div>
            <div class="column-content">
                <div class="kanban-cards"></div>
            </div>
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
    
    card.className = `kanban-card status-${state.color}`;
    card.dataset.id = project.id;
    
    const progress = calculateProgress(project.timeline);
    
    const finalDeadline = project.deadlines ? project.deadlines.publication : project.deadline;
    const daysUntilDeadline = finalDeadline ? Math.ceil((new Date(finalDeadline) - new Date()) / (1000 * 60 * 60 * 24)) : 0;
    const deadlineClass = daysUntilDeadline < 0 ? 'overdue' : daysUntilDeadline <= 3 ? 'due-soon' : '';
    
    const deadlineRequestIndicator = (project.deadlineRequest && project.deadlineRequest.status === 'pending') || 
                                   (project.deadlineChangeRequest && project.deadlineChangeRequest.status === 'pending') ? 
        '<span class="deadline-request-indicator">📅</span>' : '';
    
    card.innerHTML = `
        <h4 class="card-title">${project.title} ${deadlineRequestIndicator}</h4>
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
                ${finalDeadline ? new Date(finalDeadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No deadline'}
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
            const finalDeadline = p.deadlines ? p.deadlines.publication : p.deadline;
            if (!finalDeadline) return false;
            const d = new Date(finalDeadline + 'T00:00:00');
            return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
        });
        
        dayProjects.forEach(p => {
            const eventEl = document.createElement('div');
            eventEl.className = 'calendar-event';
            const finalDeadline = p.deadlines ? p.deadlines.publication : p.deadline;
            if (new Date(finalDeadline) < new Date()) eventEl.classList.add('overdue');
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
    disableProposalEditing();
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

    const finalDeadline = project.deadlines ? project.deadlines.publication : project.deadline;
    if (finalDeadline) {
        document.getElementById('details-publication-deadline').textContent = 
            new Date(finalDeadline + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } else {
        document.getElementById('details-publication-deadline').textContent = 'Not set';
    }
    
    // Set up proposal display/editing
    const proposalElement = document.getElementById('details-proposal');
    proposalElement.textContent = project.proposal || 'No proposal provided.';
    
    const canEditProposal = isAuthor || isAdmin;
    const editBtn = document.getElementById('edit-proposal-button');
    if (editBtn) editBtn.style.display = canEditProposal ? 'inline-block' : 'none';

    // Admin approval section
    const approvalSection = document.getElementById('admin-approval-section');
    if (approvalSection) {
        approvalSection.style.display = isAdmin && project.proposalStatus === 'pending' ? 'block' : 'none';
    }
    
    // Editor assignment
    const needsEditor = project.timeline && project.timeline["Article Writing Complete"] && !project.editorId;
    const assignSection = document.getElementById('assign-editor-section');
    if (assignSection) {
        assignSection.style.display = isAdmin && needsEditor ? 'flex' : 'none';
    }
    
    populateEditorDropdown(project.editorId);
    renderTimeline(project, isAuthor, isEditor, isAdmin);
    renderDeadlines(project, isAuthor, isEditor, isAdmin);
    renderDeadlineRequestSection(project, isAuthor, isAdmin);
    renderActivityFeed(project.activity || []);
    
    // Show delete button for project authors or admins
    const deleteButton = document.getElementById('delete-project-button');
    if (deleteButton) {
        deleteButton.style.display = (isAuthor || isAdmin) ? 'block' : 'none';
    }
}

// Deadline request section rendering
function renderDeadlineRequestSection(project, isAuthor, isAdmin) {
    const deadlineSection = document.getElementById('deadline-request-section');
    if (!deadlineSection) return;
    
    const hasRequest = project.deadlineRequest || project.deadlineChangeRequest;
    
    if (hasRequest) {
        const request = project.deadlineRequest || project.deadlineChangeRequest;
        
        if (request.status === 'pending') {
            let requestHTML = `
                <h4>Pending Deadline Request</h4>
                <p><strong>Requested by:</strong> ${request.requestedBy}</p>
                <p><strong>Reason:</strong> ${request.reason}</p>
            `;
            
            if (project.deadlineRequest) {
                const requestDate = new Date(request.requestedDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
                requestHTML += `<p><strong>New deadline:</strong> ${requestDate}</p>`;
            } else if (project.deadlineChangeRequest) {
                requestHTML += `<p><strong>Requested changes:</strong> ${Object.keys(request.requestedDeadlines || {}).join(', ')}</p>`;
            }
            
            if (isAdmin) {
                requestHTML += `
                    <div class="button-group" style="margin-top: 12px;">
                        <button onclick="handleApproveDeadlineRequest()" class="btn-success">Approve</button>
                        <button onclick="handleRejectDeadlineRequest()" class="btn-danger">Reject</button>
                    </div>
                `;
            } else {
                requestHTML += '<p style="font-style: italic; color: var(--warning-color);">Awaiting admin approval...</p>';
            }
            
            deadlineSection.innerHTML = requestHTML;
            deadlineSection.style.display = 'block';
        } else {
            deadlineSection.style.display = 'none';
        }
    } else {
        deadlineSection.style.display = 'none';
    }
}

// Proposal editing functions
function enableProposalEditing() {
    const project = allProjects.find(p => p.id === currentlyViewedProjectId);
    if (!project) return;
    
    const titleElement = document.getElementById('details-title');
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.id = 'edit-title-input';
    titleInput.value = project.title;
    titleInput.className = 'edit-title-input';
    titleElement.replaceWith(titleInput);
    
    const proposalElement = document.getElementById('details-proposal');
    const proposalTextarea = document.createElement('textarea');
    proposalTextarea.id = 'edit-proposal-textarea';
    proposalTextarea.value = project.proposal || '';
    proposalTextarea.className = 'edit-proposal-textarea';
    proposalTextarea.rows = 6;
    proposalElement.replaceWith(proposalTextarea);
    
    const editBtn = document.getElementById('edit-proposal-button');
    const saveBtn = document.getElementById('save-proposal-button');
    const cancelBtn = document.getElementById('cancel-proposal-button');
    
    if (editBtn) editBtn.style.display = 'none';
    if (saveBtn) saveBtn.style.display = 'inline-block';
    if (cancelBtn) cancelBtn.style.display = 'inline-block';
}

function disableProposalEditing() {
    const project = allProjects.find(p => p.id === currentlyViewedProjectId);
    if (!project) return;
    
    const titleInput = document.getElementById('edit-title-input');
    if (titleInput) {
        const titleElement = document.createElement('h2');
        titleElement.id = 'details-title';
        titleElement.textContent = project.title;
        titleInput.replaceWith(titleElement);
    }
    
    const proposalTextarea = document.getElementById('edit-proposal-textarea');
    if (proposalTextarea) {
        const proposalElement = document.createElement('p');
        proposalElement.id = 'details-proposal';
        proposalElement.textContent = project.proposal || 'No proposal provided.';
        proposalTextarea.replaceWith(proposalElement);
    }
    
    const isAuthor = currentUser.uid === project.authorId;
    const isAdmin = currentUserRole === 'admin';
    const canEditProposal = isAuthor || isAdmin;
    
    const editBtn = document.getElementById('edit-proposal-button');
    const saveBtn = document.getElementById('save-proposal-button');
    const cancelBtn = document.getElementById('cancel-proposal-button');
    
    if (editBtn) editBtn.style.display = canEditProposal ? 'inline-block' : 'none';
    if (saveBtn) saveBtn.style.display = 'none';
    if (cancelBtn) cancelBtn.style.display = 'none';
}

async function handleSaveProposal() {
    if (!currentlyViewedProjectId) return;
    
    const titleInput = document.getElementById('edit-title-input');
    const proposalTextarea = document.getElementById('edit-proposal-textarea');
    
    if (!titleInput || !proposalTextarea) return;
    
    const newTitle = titleInput.value.trim();
    const newProposal = proposalTextarea.value.trim();
    
    if (!newTitle) {
        alert('Title cannot be empty.');
        return;
    }
    
    try {
        await db.collection('projects').doc(currentlyViewedProjectId).update({
            title: newTitle,
            proposal: newProposal
        });
        
        await addActivity(currentlyViewedProjectId, 'updated the project title and proposal.');
        
    } catch (error) {
        console.error('[PROPOSAL UPDATE ERROR]', error);
        alert('Failed to update proposal. Please try again.');
    }
}

// Timeline rendering
function renderTimeline(project, isAuthor, isEditor, isAdmin) {
    const timelineContainer = document.getElementById('details-timeline');
    timelineContainer.innerHTML = '';
    const timeline = project.timeline || {};
    
    const orderedTasks = [
        "Topic Proposal Complete",
        "Interview Scheduled",
        "Interview Complete",
        "Article Writing Complete",
        "Review In Progress",
        "Review Complete",
        "Suggestions Reviewed"
    ];

    orderedTasks.forEach(task => {
        if (timeline[task] === undefined) return;

        let canEditTask = false;
        const authorTasks = ["Interview Scheduled", "Interview Complete", "Article Writing Complete", "Suggestions Reviewed"];
        const editorTasks = ["Review In Progress", "Review Complete"];

        if (isAdmin) {
            canEditTask = true;
        } else if (isAuthor && authorTasks.includes(task)) {
            canEditTask = true;
        } else if (isEditor && editorTasks.includes(task)) {
            canEditTask = true;
        }

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
                await updateTaskStatus(project.id, task, e.target.checked);
            });
        }
        
        timelineContainer.appendChild(taskEl);
    });
}

// Deadline rendering
function renderDeadlines(project, isAuthor, isEditor, isAdmin) {
    const deadlinesList = document.getElementById('details-deadlines-list');
    deadlinesList.innerHTML = '';
    const deadlines = project.deadlines || {};

    const deadlineFields = [
        { key: 'contact', label: 'Contact Professor' },
        { key: 'interview', label: 'Conduct Interview' },
        { key: 'draft', label: 'Write Draft' },
        { key: 'review', label: 'Editor Review' },
        { key: 'edits', label: 'Review Edits' }
    ];

    deadlineFields.forEach(field => {
        if (project.type === 'Op-Ed' && (field.key === 'contact' || field.key === 'interview')) {
            return;
        }

        const value = deadlines[field.key] || '';
        const deadlineItem = document.createElement('div');
        deadlineItem.className = 'deadline-item';
        deadlineItem.innerHTML = `
            <label for="deadline-${field.key}">${field.label}</label>
            <input type="date" id="deadline-${field.key}" value="${value}" ${!isAdmin ? 'disabled' : ''}>
        `;
        deadlinesList.appendChild(deadlineItem);
    });
    
    const setButton = document.getElementById('set-deadlines-button');
    if (setButton) {
        setButton.style.display = isAdmin ? 'block' : 'none';
    }
    
    const requestButton = document.getElementById('request-deadline-change-button');
    if (requestButton) {
        const hasRequest = project.deadlineRequest || project.deadlineChangeRequest;
        const isPending = hasRequest && hasRequest.status === 'pending';
        requestButton.style.display = (isAuthor || isEditor) && !isPending ? 'inline-block' : 'none';
    }
}

function populateEditorDropdown(currentEditorId) {
    const dropdown = document.getElementById('editor-dropdown');
    if (!dropdown) return;
    
    dropdown.innerHTML = '<option value="">Assign an Editor</option>';
    allEditors.forEach(editor => {
        const option = document.createElement('option');
        option.value = editor.id;
        option.textContent = editor.name;
        if (editor.id === currentEditorId) option.selected = true;
        dropdown.appendChild(option);
    });
}

function renderActivityFeed(activity) {
    const activityFeed = document.getElementById('details-activity-feed');
    if (!activityFeed) return;
    
    activityFeed.innerHTML = '';
    if (!activity || !Array.isArray(activity)) {
        activityFeed.innerHTML = '<p>No activity yet.</p>';
        return;
    }
    
    [...activity].sort((a, b) => {
        const aTime = a.timestamp?.seconds || 0;
        const bTime = b.timestamp?.seconds || 0;
        return bTime - aTime;
    }).forEach(item => {
        const timestamp = item.timestamp?.seconds ? 
            new Date(item.timestamp.seconds * 1000).toLocaleString() : 
            'Unknown time';
        
        activityFeed.innerHTML += `
            <div class="feed-item">
                <div class="user-avatar" style="background-color: ${stringToColor(item.authorName)}">
                    ${item.authorName.charAt(0)}
                </div>
                <div class="feed-content">
                    <p><span class="author">${item.authorName}</span> ${item.text}</p>
                    <span class="timestamp">${timestamp}</span>
                </div>
            </div>
        `;
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
        deadlines: {
            publication: document.getElementById('project-deadline').value,
            contact: '',
            interview: '',
            draft: '',
            review: '',
            edits: ''
        },
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
    } catch (error) {
        console.error(`[ACTIVITY ERROR] Failed to add activity:`, error);
    }
}

async function updateTaskStatus(projectId, taskName, isCompleted) {
    const updates = {
        [`timeline.${taskName}`]: isCompleted
    };
    
    try {
        await db.collection('projects').doc(projectId).update(updates);
        
        const activityText = `${isCompleted ? 'completed' : 'un-completed'} the task: "${taskName}"`;
        await addActivity(projectId, activityText);
        
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
            'timeline.Topic Proposal Complete': true
        });
        
        await addActivity(projectId, 'approved the proposal.');
        
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
    } catch (error) {
        console.error(`[REJECTION ERROR] Failed to reject proposal:`, error);
        alert(`Failed to reject proposal. Please try again.`);
    }
}

async function handleAssignEditor() {
    const dropdown = document.getElementById('editor-dropdown');
    if (!dropdown) return;
    
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
        
    } catch (error) {
        console.error(`[EDITOR ERROR] Failed to assign editor:`, error);
        alert('Failed to assign editor. Please try again.');
    }
}

async function handleSetDeadlines() {
    if (!currentlyViewedProjectId) return;

    const currentProject = allProjects.find(p => p.id === currentlyViewedProjectId);
    if (!currentProject) return;

    const newDeadlines = {
        publication: currentProject.deadlines?.publication || '',
    };
    
    let changes = [];
    const deadlineFields = ['contact', 'interview', 'draft', 'review', 'edits'];
    deadlineFields.forEach(field => {
        const input = document.getElementById(`deadline-${field}`);
        if (input && input.value) {
            const oldValue = currentProject.deadlines?.[field] || '';
            const newValue = input.value;
            if (oldValue !== newValue) {
                changes.push(`${field} deadline to ${newValue}`);
            }
            newDeadlines[field] = newValue;
        }
    });

    if (changes.length > 0) {
        try {
            await db.collection('projects').doc(currentlyViewedProjectId).update({
                deadlines: newDeadlines
            });
            await addActivity(currentlyViewedProjectId, `set deadlines: ${changes.join(', ')}.`);
            alert('Deadlines set successfully!');
        } catch (error) {
            console.error('[DEADLINE SET ERROR]', error);
            alert('Failed to set deadlines. Please try again.');
        }
    }
}

async function handleRequestDeadlineChange() {
    if (!currentlyViewedProjectId) return;
    
    const reason = prompt('Please provide a reason for the deadline change request:');
    if (!reason || !reason.trim()) return;
    
    const newDate = prompt('Enter the new deadline (YYYY-MM-DD format):');
    if (!newDate || !isValidDate(newDate)) {
        alert('Please enter a valid date in YYYY-MM-DD format.');
        return;
    }
    
    try {
        await db.collection('projects').doc(currentlyViewedProjectId).update({
            deadlineRequest: {
                requestedBy: currentUserName,
                requestedDate: newDate,
                reason: reason.trim(),
                status: 'pending',
                requestedAt: new Date()
            }
        });
        
        await addActivity(currentlyViewedProjectId, `requested a deadline change to ${new Date(newDate).toLocaleDateString()}. Reason: ${reason.trim()}`);
        
    } catch (error) {
        console.error('[DEADLINE REQUEST ERROR]', error);
        alert('Failed to submit deadline request. Please try again.');
    }
}

// Global functions for deadline request handling
window.handleApproveDeadlineRequest = async function() {
    if (!currentlyViewedProjectId) return;
    
    const project = allProjects.find(p => p.id === currentlyViewedProjectId);
    if (!project) return;
    
    const request = project.deadlineRequest || project.deadlineChangeRequest;
    if (!request) return;
    
    try {
        if (project.deadlineRequest) {
            const newDeadlines = {
                ...project.deadlines,
                publication: request.requestedDate
            };
            
            await db.collection('projects').doc(currentlyViewedProjectId).update({
                deadlines: newDeadlines,
                'deadlineRequest.status': 'approved',
                'deadlineRequest.approvedBy': currentUserName,
                'deadlineRequest.approvedAt': new Date()
            });
            
            await addActivity(currentlyViewedProjectId, `approved the deadline change request. New deadline: ${new Date(request.requestedDate).toLocaleDateString()}`);
        } else if (project.deadlineChangeRequest) {
            const newDeadlines = {
                ...project.deadlines,
                ...request.requestedDeadlines
            };
            
            await db.collection('projects').doc(currentlyViewedProjectId).update({
                deadlines: newDeadlines,
                'deadlineChangeRequest.status': 'approved',
                'deadlineChangeRequest.approvedBy': currentUserName,
                'deadlineChangeRequest.approvedAt': new Date()
            });
            
            const changedFields = Object.keys(request.requestedDeadlines).join(', ');
            await addActivity(currentlyViewedProjectId, `approved deadline changes for: ${changedFields}`);
        }
        
    } catch (error) {
        console.error('[DEADLINE APPROVAL ERROR]', error);
        alert('Failed to approve deadline request. Please try again.');
    }
};

window.handleRejectDeadlineRequest = async function() {
    if (!currentlyViewedProjectId) return;
    
    const reason = prompt('Please provide a reason for rejecting this deadline request (optional):');
    
    const project = allProjects.find(p => p.id === currentlyViewedProjectId);
    if (!project) return;
    
    try {
        if (project.deadlineRequest) {
            const updates = {
                'deadlineRequest.status': 'rejected',
                'deadlineRequest.rejectedBy': currentUserName,
                'deadlineRequest.rejectedAt': new Date()
            };
            
            if (reason && reason.trim()) {
                updates['deadlineRequest.rejectionReason'] = reason.trim();
            }
            
            await db.collection('projects').doc(currentlyViewedProjectId).update(updates);
        } else if (project.deadlineChangeRequest) {
            const updates = {
                'deadlineChangeRequest.status': 'rejected',
                'deadlineChangeRequest.rejectedBy': currentUserName,
                'deadlineChangeRequest.rejectedAt': new Date()
            };
            
            if (reason && reason.trim()) {
                updates['deadlineChangeRequest.rejectionReason'] = reason.trim();
            }
            
            await db.collection('projects').doc(currentlyViewedProjectId).update(updates);
        }
        
        const activityText = reason ? 
            `rejected the deadline change request. Reason: ${reason.trim()}` :
            'rejected the deadline change request.';
        
        await addActivity(currentlyViewedProjectId, activityText);
        
    } catch (error) {
        console.error('[DEADLINE REJECTION ERROR]', error);
        alert('Failed to reject deadline request. Please try again.');
    }
};

async function handleDeleteProject() {
    if (!currentlyViewedProjectId) return;
    
    const project = allProjects.find(p => p.id === currentlyViewedProjectId);
    if (!project) return;
    
    const isAuthor = currentUser.uid === project.authorId;
    const isAdmin = currentUserRole === 'admin';
    
    if (!isAuthor && !isAdmin) {
        alert('You can only delete your own projects.');
        return;
    }
    
    if (confirm("Are you sure you want to permanently delete this project? This action cannot be undone.")) {
        try {
            await db.collection('projects').doc(currentlyViewedProjectId).delete();
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
    if (!reportModal || !reportContent) return;
    
    reportContent.innerHTML = '';

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const overdueProjects = allProjects.filter(p => {
        const finalDeadline = p.deadlines ? p.deadlines.publication : p.deadline;
        if (!finalDeadline) return false;
        return new Date(finalDeadline) < now && getProjectState(p).column !== 'Completed';
    });

    const pendingDeadlineRequests = allProjects.filter(p => 
        (p.deadlineRequest && p.deadlineRequest.status === 'pending') ||
        (p.deadlineChangeRequest && p.deadlineChangeRequest.status === 'pending')
    );

    const completedThisWeek = allProjects.filter(p => {
        const state = getProjectState(p);
        if (state.column !== 'Completed') return false;
        const completionActivity = (p.activity || []).find(a => 
            a.text.includes('Suggestions Reviewed') || a.text.includes('completed')
        );
        if (!completionActivity || !completionActivity.timestamp) return false;
        
        const activityDate = completionActivity.timestamp.seconds ? 
            new Date(completionActivity.timestamp.seconds * 1000) : 
            new Date(completionActivity.timestamp);
        
        return activityDate >= oneWeekAgo;
    });
    
    let reportHTML = `<div class="report-container">`;

    reportHTML += `
        <div class="report-section">
            <h2><span class="emoji">🚨</span> Weekly Alerts</h2>
            ${overdueProjects.length > 0 ? 
                `<h3>Overdue Projects (${overdueProjects.length})</h3>` + overdueProjects.map(p => {
                    const finalDeadline = p.deadlines ? p.deadlines.publication : p.deadline;
                    return `
                        <div class="report-item overdue-item" data-id="${p.id}">
                            <span class="report-item-title">${p.title}</span>
                            <span class="report-item-meta">Due: ${new Date(finalDeadline).toLocaleDateString()} | Author: ${p.authorName}</span>
                        </div>
                    `;
                }).join('') : '<p>No overdue projects. Great job!</p>'}
                
            ${pendingDeadlineRequests.length > 0 ? 
                `<h3>Pending Deadline Requests (${pendingDeadlineRequests.length})</h3>` + pendingDeadlineRequests.map(p => {
                    const request = p.deadlineRequest || p.deadlineChangeRequest;
                    return `
                        <div class="report-item deadline-request-item" data-id="${p.id}">
                            <span class="report-item-title">${p.title}</span>
                            <span class="report-item-meta">Requested by: ${request.requestedBy}</span>
                        </div>
                    `;
                }).join('') : ''}
        </div>`;

    reportHTML += `
        <div class="report-section">
            <h2><span class="emoji">🎉</span> Recently Completed (Last 7 Days)</h2>
            ${completedThisWeek.length > 0 ? completedThisWeek.map(p => `
                 <div class="report-item" data-id="${p.id}">
                    <span class="report-item-title">${p.title}</span>
                    <span class="report-item-meta">Author: ${p.authorName}</span>
                </div>
            `).join('') : '<p>No projects completed in the last week.</p>'}
        </div>
    `;

    reportHTML += '</div>';

    reportContent.innerHTML = reportHTML;

    reportContent.querySelectorAll('.report-item').forEach(item => {
        item.style.cursor = 'pointer';
        item.addEventListener('click', () => {
            closeAllModals();
            openDetailsModal(item.dataset.id);
        });
    });

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

function isValidDate(dateString) {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date) && dateString.match(/^\d{4}-\d{2}-\d{2}$/);
}
