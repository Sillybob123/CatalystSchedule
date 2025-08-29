// ===============================
// Catalyst Tracker - Enhanced Dashboard JS
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
let isEditing = false;
let editingField = null;

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

    // New listeners for editing and deadline features
    document.getElementById('request-deadline-change-button')?.addEventListener('click', handleRequestDeadlineChange);
    document.getElementById('approve-deadline-button')?.addEventListener('click', handleApproveDeadlineChange);
    document.getElementById('reject-deadline-button')?.addEventListener('click', handleRejectDeadlineChange);
    document.getElementById('edit-title-button')?.addEventListener('click', () => toggleEditMode('title'));
    document.getElementById('edit-proposal-button')?.addEventListener('click', () => toggleEditMode('proposal'));
    document.getElementById('save-edit-button')?.addEventListener('click', saveEdit);
    document.getElementById('cancel-edit-button')?.addEventListener('click', cancelEdit);

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
    
    // Use the final publication deadline for the card display
    const finalDeadline = project.deadlines ? project.deadlines.publication : project.deadline;
    const daysUntilDeadline = Math.ceil((new Date(finalDeadline) - new Date()) / (1000 * 60 * 60 * 24));
    const deadlineClass = daysUntilDeadline < 0 ? 'overdue' : daysUntilDeadline <= 3 ? 'due-soon' : '';
    
    // Add deadline request indicator if pending
    const deadlineRequestIndicator = project.deadlineRequest && project.deadlineRequest.status === 'pending' 
        ? '<div class="deadline-request-indicator">📅 Deadline Change Requested</div>' 
        : '';
    
    card.innerHTML = `
        <h4 class="card-title">${project.title}</h4>
        <div class="card-meta">
            <span class="card-type">${project.type}</span>
            <span class="card-status">${state.statusText}</span>
        </div>
        ${deadlineRequestIndicator}
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
                ${new Date(finalDeadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
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
    cancelEdit(); // Cancel any ongoing edits
}

function refreshDetailsModal(project) {
    const isAuthor = currentUser.uid === project.authorId;
    const isEditor = currentUser.uid === project.editorId;
    const isAdmin = currentUserRole === 'admin';
    const canEdit = isAuthor || isAdmin;
    
    // Basic project info with edit buttons
    const titleSection = canEdit ? 
        `<div class="editable-section">
            <div id="title-display">${project.title}</div>
            <button id="edit-title-button" class="btn-secondary" style="font-size: 11px; padding: 4px 8px;">Edit Title</button>
        </div>` : project.title;
    
    document.getElementById('details-title').innerHTML = titleSection;
    document.getElementById('details-author').textContent = project.authorName;
    document.getElementById('details-editor').textContent = project.editorName || 'Not Assigned';
    
    const state = getProjectState(project);
    document.getElementById('details-status').textContent = state.statusText;

    const finalDeadline = project.deadlines ? project.deadlines.publication : project.deadline;
    document.getElementById('details-publication-deadline').textContent = new Date(finalDeadline + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    
    // Proposal section with edit capability
    const proposalSection = canEdit ?
        `<div class="editable-section">
            <div id="proposal-display">${project.proposal || 'No proposal provided.'}</div>
            <button id="edit-proposal-button" class="btn-secondary" style="font-size: 11px; padding: 4px 8px; margin-top: 8px;">Edit Proposal</button>
        </div>` : project.proposal || 'No proposal provided.';
    
    document.getElementById('details-proposal').innerHTML = proposalSection;

    // Add edit event listeners if they exist
    if (canEdit) {
        document.getElementById('edit-title-button')?.addEventListener('click', () => toggleEditMode('title'));
        document.getElementById('edit-proposal-button')?.addEventListener('click', () => toggleEditMode('proposal'));
    }

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
    renderDeadlines(project, isAdmin);
    renderDeadlineRequest(project, isAuthor, isAdmin);
    renderActivityFeed(project.activity || []);
}

// =================
// Editing Functions
// =================
function toggleEditMode(field) {
    if (isEditing) return; // Prevent multiple edits at once
    
    isEditing = true;
    editingField = field;
    
    const project = allProjects.find(p => p.id === currentlyViewedProjectId);
    if (!project) return;
    
    let currentValue, displayElement, inputType;
    
    if (field === 'title') {
        currentValue = project.title;
        displayElement = document.getElementById('title-display');
        inputType = 'input';
    } else if (field === 'proposal') {
        currentValue = project.proposal || '';
        displayElement = document.getElementById('proposal-display');
        inputType = 'textarea';
    }
    
    // Create input element
    const inputElement = document.createElement(inputType);
    inputElement.value = currentValue;
    inputElement.className = 'edit-input';
    inputElement.style.width = '100%';
    inputElement.style.marginBottom = '8px';
    
    if (inputType === 'textarea') {
        inputElement.rows = 4;
    }
    
    // Create control buttons
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'edit-controls';
    controlsDiv.innerHTML = `
        <button id="save-edit-button" class="btn-primary">Save</button>
        <button id="cancel-edit-button" class="btn-secondary">Cancel</button>
    `;
    
    // Replace display with input
    displayElement.replaceWith(inputElement);
    inputElement.after(controlsDiv);
    inputElement.focus();
    
    // Add event listeners
    document.getElementById('save-edit-button').addEventListener('click', saveEdit);
    document.getElementById('cancel-edit-button').addEventListener('click', cancelEdit);
    
    // Handle Enter key (for input only)
    if (inputType === 'input') {
        inputElement.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') saveEdit();
        });
    }
    
    // Handle Escape key
    inputElement.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') cancelEdit();
    });
}

async function saveEdit() {
    if (!isEditing || !editingField || !currentlyViewedProjectId) return;
    
    const inputElement = document.querySelector('.edit-input');
    const newValue = inputElement.value.trim();
    
    if (!newValue) {
        alert('Value cannot be empty.');
        return;
    }
    
    try {
        const updateData = {};
        updateData[editingField] = newValue;
        
        await db.collection('projects').doc(currentlyViewedProjectId).update(updateData);
        await addActivity(currentlyViewedProjectId, `updated the ${editingField}.`);
        
        cancelEdit(); // This will refresh the display
        
    } catch (error) {
        console.error('[EDIT ERROR]', error);
        alert('Failed to save changes. Please try again.');
    }
}

function cancelEdit() {
    if (!isEditing) return;
    
    isEditing = false;
    editingField = null;
    
    // Find and remove edit elements
    const inputElement = document.querySelector('.edit-input');
    const controlsElement = document.querySelector('.edit-controls');
    
    if (inputElement) inputElement.remove();
    if (controlsElement) controlsElement.remove();
    
    // Refresh the modal
    const project = allProjects.find(p => p.id === currentlyViewedProjectId);
    if (project) {
        refreshDetailsModal(project);
    }
}

// =================
// Deadline Management
// =================
function renderDeadlineRequest(project, isAuthor, isAdmin) {
    const deadlinesSection = document.getElementById('deadlines-section');
    
    // Add deadline request section
    let deadlineRequestHTML = '';
    
    if (project.deadlineRequest) {
        const request = project.deadlineRequest;
        const statusClass = request.status;
        
        deadlineRequestHTML = `
            <div class="deadline-request ${statusClass}">
                <strong>Deadline Change Request:</strong><br>
                New deadline: ${new Date(request.newDeadline).toLocaleDateString()}<br>
                Reason: ${request.reason}<br>
                Status: <span style="text-transform: capitalize;">${request.status}</span>
                ${request.status === 'pending' && isAdmin ? `
                    <div style="margin-top: 8px;">
                        <button id="approve-deadline-button" class="btn-success" style="font-size: 11px; padding: 4px 8px; margin-right: 4px;">Approve</button>
                        <button id="reject-deadline-button" class="btn-danger" style="font-size: 11px; padding: 4px 8px;">Reject</button>
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    // Add request button for authors
    if (isAuthor && (!project.deadlineRequest || project.deadlineRequest.status !== 'pending')) {
        deadlineRequestHTML += `
            <button id="request-deadline-change-button" class="btn-secondary" style="width: 100%; margin-top: 8px; font-size: 12px;">
                Request Deadline Change
            </button>
        `;
    }
    
    // Insert before the existing deadlines list
    const existingRequest = deadlinesSection.querySelector('.deadline-request-section');
    if (existingRequest) {
        existingRequest.remove();
    }
    
    if (deadlineRequestHTML) {
        const requestDiv = document.createElement('div');
        requestDiv.className = 'deadline-request-section';
        requestDiv.innerHTML = deadlineRequestHTML;
        
        const deadlinesList = document.getElementById('details-deadlines-list');
        deadlinesList.before(requestDiv);
        
        // Add event listeners
        document.getElementById('request-deadline-change-button')?.addEventListener('click', handleRequestDeadlineChange);
        document.getElementById('approve-deadline-button')?.addEventListener('click', handleApproveDeadlineChange);
        document.getElementById('reject-deadline-button')?.addEventListener('click', handleRejectDeadlineChange);
    }
}

function handleRequestDeadlineChange() {
    const project = allProjects.find(p => p.id === currentlyViewedProjectId);
    if (!project) return;
    
    const newDeadline = prompt('Enter new deadline (YYYY-MM-DD):');
    if (!newDeadline) return;
    
    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(newDeadline)) {
        alert('Please enter date in YYYY-MM-DD format.');
        return;
    }
    
    const reason = prompt('Reason for deadline change:');
    if (!reason) return;
    
    const deadlineRequest = {
        newDeadline: newDeadline,
        reason: reason.trim(),
        status: 'pending',
        requestedBy: currentUserName,
        requestedAt: new Date()
    };
    
    db.collection('projects').doc(currentlyViewedProjectId).update({
        deadlineRequest: deadlineRequest
    }).then(() => {
        addActivity(currentlyViewedProjectId, `requested a deadline change to ${new Date(newDeadline).toLocaleDateString()}.`);
    }).catch((error) => {
        console.error('[DEADLINE REQUEST ERROR]', error);
        alert('Failed to submit deadline request. Please try again.');
    });
}

function handleApproveDeadlineChange() {
    const project = allProjects.find(p => p.id === currentlyViewedProjectId);
    if (!project || !project.deadlineRequest) return;
    
    const newDeadlines = { ...project.deadlines };
    newDeadlines.publication = project.deadlineRequest.newDeadline;
    
    const updatedRequest = { ...project.deadlineRequest };
    updatedRequest.status = 'approved';
    updatedRequest.approvedBy = currentUserName;
    updatedRequest.approvedAt = new Date();
    
    db.collection('projects').doc(currentlyViewedProjectId).update({
        deadlines: newDeadlines,
        deadlineRequest: updatedRequest
    }).then(() => {
        addActivity(currentlyViewedProjectId, `approved the deadline change to ${new Date(project.deadlineRequest.newDeadline).toLocaleDateString()}.`);
    }).catch((error) => {
        console.error('[DEADLINE APPROVAL ERROR]', error);
        alert('Failed to approve deadline change. Please try again.');
    });
}

function handleRejectDeadlineChange() {
    const project = allProjects.find(p => p.id === currentlyViewedProjectId);
    if (!project || !project.deadlineRequest) return;
    
    const reason = prompt('Reason for rejection (optional):') || 'No reason provided';
    
    const updatedRequest = { ...project.deadlineRequest };
    updatedRequest.status = 'rejected';
    updatedRequest.rejectedBy = currentUserName;
    updatedRequest.rejectedAt = new Date();
    updatedRequest.rejectionReason = reason;
    
    db.collection('projects').doc(currentlyViewedProjectId).update({
        deadlineRequest: updatedRequest
    }).then(() => {
        addActivity(currentlyViewedProjectId, `rejected the deadline change request. Reason: ${reason}`);
    }).catch((error) => {
        console.error('[DEADLINE REJECTION ERROR]', error);
        alert('Failed to reject deadline change. Please try again.');
    });
}

function renderTimeline(project, isAuthor, isEditor, isAdmin) {
    const timelineContainer = document.getElementById('details-timeline');
    timelineContainer.innerHTML = '';
    const timeline = project.timeline || {};
    
    // Define the correct order of tasks
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
        // If a task from the ordered list doesn't exist in the project's timeline, skip it
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

function renderDeadlines(project, isAdmin) {
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
     document.getElementById('update-deadlines-button').style.display = isAdmin ? 'block' : 'none';
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
        
    } catch (error) {
        console.error(`[EDITOR ERROR] Failed to assign editor:`, error);
        alert('Failed to assign editor. Please try again.');
    }
}

async function handleUpdateDeadlines() {
    if (!currentlyViewedProjectId) return;

    const currentProject = allProjects.find(p => p.id === currentlyViewedProjectId);
    if (!currentProject) return;

    const newDeadlines = {
        publication: currentProject.deadlines.publication,
    };
    
    let changes = [];
    const deadlineFields = ['contact', 'interview', 'draft', 'review', 'edits'];
    deadlineFields.forEach(field => {
        const input = document.getElementById(`deadline-${field}`);
        if (input) {
            const oldValue = currentProject.deadlines[field] || '';
            const newValue = input.value;
            if (oldValue !== newValue) {
                changes.push(`${field} deadline from ${oldValue || 'none'} to ${newValue}`);
            }
            newDeadlines[field] = newValue;
        }
    });

    if (changes.length > 0) {
        try {
            await db.collection('projects').doc(currentlyViewedProjectId).update({
                deadlines: newDeadlines
            });
            await addActivity(currentlyViewedProjectId, `updated deadlines: ${changes.join(', ')}.`);
            alert('Deadlines updated successfully!');
        } catch (error) {
            console.error('[DEADLINE UPDATE ERROR]', error);
            alert('Failed to update deadlines. Please try again.');
        }
    }
}

async function handleDeleteProject() {
    if (!currentlyViewedProjectId) return;
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
    reportContent.innerHTML = ''; // Clear previous report

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // 1. General Alerts
    const overdueProjects = allProjects.filter(p => {
        const finalDeadline = p.deadlines ? p.deadlines.publication : p.deadline;
        return new Date(finalDeadline) < now && getProjectState(p).column !== 'Completed';
    });

    const completedThisWeek = allProjects.filter(p => {
        const state = getProjectState(p);
        if (state.column !== 'Completed') return false;
        const completionActivity = (p.activity || []).find(a => a.text.includes('Suggestions Reviewed'));
        if (!completionActivity) return false;
        return completionActivity.timestamp.toDate() >= oneWeekAgo;
    });
    
    // Deadline requests needing attention
    const pendingDeadlineRequests = allProjects.filter(p => 
        p.deadlineRequest && p.deadlineRequest.status === 'pending'
    );
    
    let reportHTML = `<div class="report-container">`;

    reportHTML += `
        <div class="report-section">
            <h2><span class="emoji">🚨</span> Weekly Alerts</h2>
            ${overdueProjects.length > 0 ? 
                `<h3>Overdue Projects (${overdueProjects.length})</h3>` + overdueProjects.map(p => `
                    <div class="report-item overdue-item" data-id="${p.id}">
                        <span class="report-item-title">${p.title}</span>
                        <span class="report-item-meta">Due: ${new Date(p.deadlines.publication).toLocaleDateString()} | Author: ${p.authorName}</span>
                    </div>
                `).join('') : '<p>No overdue projects. Great job!</p>'}
                
            ${pendingDeadlineRequests.length > 0 ? 
                `<h3>Pending Deadline Requests (${pendingDeadlineRequests.length})</h3>` + pendingDeadlineRequests.map(p => `
                    <div class="report-item" data-id="${p.id}" style="background-color: #fffbeb; border-color: #f59e0b;">
                        <span class="report-item-title">${p.title}</span>
                        <span class="report-item-meta">Requested by: ${p.deadlineRequest.requestedBy} | New deadline: ${new Date(p.deadlineRequest.newDeadline).toLocaleDateString()}</span>
                        <div style="margin-top: 4px; font-size: 11px; color: #92400e;">Reason: ${p.deadlineRequest.reason}</div>
                    </div>
                `).join('') : ''}
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

    // 2. Per-member breakdown
    reportHTML += `<div class="report-section"><h2><span class="emoji">👥</span> Team Progress</h2></div>`;

    const teamMembers = allEditors.reduce((acc, user) => {
        acc[user.id] = { name: user.name, projects: [] };
        return acc;
    }, {});
    
    const authors = allProjects.reduce((acc, p) => {
        if (!acc[p.authorId]) {
            acc[p.authorId] = { name: p.authorName, projects: [] };
        }
        return acc;
    }, {});

    const allTeamMembers = {...teamMembers, ...authors};

    allProjects.forEach(p => {
        if (getProjectState(p).column === 'Completed') return; // Skip completed
        if (allTeamMembers[p.authorId]) {
            allTeamMembers[p.authorId].projects.push(p);
        }
        if (p.editorId && allTeamMembers[p.editorId]) {
             // Avoid duplicating project if user is both author and editor
            if (p.authorId !== p.editorId) {
                allTeamMembers[p.editorId].projects.push(p);
            }
        }
    });

    for (const memberId in allTeamMembers) {
        const member = allTeamMembers[memberId];
        if (member.projects.length === 0) continue;

        reportHTML += `<div class="report-user-section">
            <h3 class="report-user-header">${member.name}</h3>`;

        member.projects.forEach(p => {
            const state = getProjectState(p);
            const finalDeadline = p.deadlines ? p.deadlines.publication : p.deadline;
            const recentActivities = (p.activity || [])
                .filter(a => a.timestamp.toDate() >= oneWeekAgo)
                .map(a => `<li><span class="timestamp">${a.timestamp.toDate().toLocaleDateString()}</span> - ${a.text}</li>`)
                .join('');

            reportHTML += `
                <div class="report-item" data-id="${p.id}">
                    <div class="report-item-main">
                        <span class="report-item-title">${p.title}</span>
                        <span class="report-item-meta">
                            Status: <strong>${state.statusText}</strong> | Deadline: ${new Date(finalDeadline).toLocaleDateString()}
                        </span>
                    </div>
                    ${recentActivities ? `<ul class="report-activity-list">${recentActivities}</ul>` : ''}
                </div>
            `;
        });
        reportHTML += `</div>`;
    }

    reportHTML += '</div>'; // close report-container

    reportContent.innerHTML = reportHTML;

    // Add event listeners to make items clickable
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
}// ===============================
// Catalyst Tracker - Enhanced Dashboard JS
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
let isEditing = false;
let editingField = null;

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

    // New listeners for editing and deadline features
    document.getElementById('request-deadline-change-button')?.addEventListener('click', handleRequestDeadlineChange);
    document.getElementById('approve-deadline-button')?.addEventListener('click', handleApproveDeadlineChange);
    document.getElementById('reject-deadline-button')?.addEventListener('click', handleRejectDeadlineChange);
    document.getElementById('edit-title-button')?.addEventListener('click', () => toggleEditMode('title'));
    document.getElementById('edit-proposal-button')?.addEventListener('click', () => toggleEditMode('proposal'));
    document.getElementById('save-edit-button')?.addEventListener('click', saveEdit);
    document.getElementById('cancel-edit-button')?.addEventListener('click', cancelEdit);

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
    
    // Use the final publication deadline for the card display
    const finalDeadline = project.deadlines ? project.deadlines.publication : project.deadline;
    const daysUntilDeadline = Math.ceil((new Date(finalDeadline) - new Date()) / (1000 * 60 * 60 * 24));
    const deadlineClass = daysUntilDeadline < 0 ? 'overdue' : daysUntilDeadline <= 3 ? 'due-soon' : '';
    
    // Add deadline request indicator if pending
    const deadlineRequestIndicator = project.deadlineRequest && project.deadlineRequest.status === 'pending' 
        ? '<div class="deadline-request-indicator">📅 Deadline Change Requested</div>' 
        : '';
    
    card.innerHTML = `
        <h4 class="card-title">${project.title}</h4>
        <div class="card-meta">
            <span class="card-type">${project.type}</span>
            <span class="card-status">${state.statusText}</span>
        </div>
        ${deadlineRequestIndicator}
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
                ${new Date(finalDeadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
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
    cancelEdit(); // Cancel any ongoing edits
}

function refreshDetailsModal(project) {
    const isAuthor = currentUser.uid === project.authorId;
    const isEditor = currentUser.uid === project.editorId;
    const isAdmin = currentUserRole === 'admin';
    const canEdit = isAuthor || isAdmin;
    
    // Basic project info with edit buttons
    const titleSection = canEdit ? 
        `<div class="editable-section">
            <div id="title-display">${project.title}</div>
            <button id="edit-title-button" class="btn-secondary" style="font-size: 11px; padding: 4px 8px;">Edit Title</button>
        </div>` : project.title;
    
    document.getElementById('details-title').innerHTML = titleSection;
    document.getElementById('details-author').textContent = project.authorName;
    document.getElementById('details-editor').textContent = project.editorName || 'Not Assigned';
    
    const state = getProjectState(project);
    document.getElementById('details-status').textContent = state.statusText;

    const finalDeadline = project.deadlines ? project.deadlines.publication : project.deadline;
    document.getElementById('details-publication-deadline').textContent = new Date(finalDeadline + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    
    // Proposal section with edit capability
    const proposalSection = canEdit ?
        `<div class="editable-section">
            <div id="proposal-display">${project.proposal || 'No proposal provided.'}</div>
            <button id="edit-proposal-button" class="btn-secondary" style="font-size: 11px; padding: 4px 8px; margin-top: 8px;">Edit Proposal</button>
        </div>` : project.proposal || 'No proposal provided.';
    
    document.getElementById('details-proposal').innerHTML = proposalSection;

    // Add edit event listeners if they exist
    if (canEdit) {
        document.getElementById('edit-title-button')?.addEventListener('click', () => toggleEditMode('title'));
        document.getElementById('edit-proposal-button')?.addEventListener('click', () => toggleEditMode('proposal'));
    }

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
    renderDeadlines(project, isAdmin);
    renderDeadlineRequest(project, isAuthor, isAdmin);
    renderActivityFeed(project.activity || []);
}

// =================
// Editing Functions
// =================
function toggleEditMode(field) {
    if (isEditing) return; // Prevent multiple edits at once
    
    isEditing = true;
    editingField = field;
    
    const project = allProjects.find(p => p.id === currentlyViewedProjectId);
    if (!project) return;
    
    let currentValue, displayElement, inputType;
    
    if (field === 'title') {
        currentValue = project.title;
        displayElement = document.getElementById('title-display');
        inputType = 'input';
    } else if (field === 'proposal') {
        currentValue = project.proposal || '';
        displayElement = document.getElementById('proposal-display');
        inputType = 'textarea';
    }
    
    // Create input element
    const inputElement = document.createElement(inputType);
    inputElement.value = currentValue;
    inputElement.className = 'edit-input';
    inputElement.style.width = '100%';
    inputElement.style.marginBottom = '8px';
    
    if (inputType === 'textarea') {
        inputElement.rows = 4;
    }
    
    // Create control buttons
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'edit-controls';
    controlsDiv.innerHTML = `
        <button id="save-edit-button" class="btn-primary">Save</button>
        <button id="cancel-edit-button" class="btn-secondary">Cancel</button>
    `;
    
    // Replace display with input
    displayElement.replaceWith(inputElement);
    inputElement.after(controlsDiv);
    inputElement.focus();
    
    // Add event listeners
    document.getElementById('save-edit-button').addEventListener('click', saveEdit);
    document.getElementById('cancel-edit-button').addEventListener('click', cancelEdit);
    
    // Handle Enter key (for input only)
    if (inputType === 'input') {
        inputElement.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') saveEdit();
        });
    }
    
    // Handle Escape key
    inputElement.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') cancelEdit();
    });
}

async function saveEdit() {
    if (!isEditing || !editingField || !currentlyViewedProjectId) return;
    
    const inputElement = document.querySelector('.edit-input');
    const newValue = inputElement.value.trim();
    
    if (!newValue) {
        alert('Value cannot be empty.');
        return;
    }
    
    try {
        const updateData = {};
        updateData[editingField] = newValue;
        
        await db.collection('projects').doc(currentlyViewedProjectId).update(updateData);
        await addActivity(currentlyViewedProjectId, `updated the ${editingField}.`);
        
        cancelEdit(); // This will refresh the display
        
    } catch (error) {
        console.error('[EDIT ERROR]', error);
        alert('Failed to save changes. Please try again.');
    }
}

function cancelEdit() {
    if (!isEditing) return;
    
    isEditing = false;
    editingField = null;
    
    // Find and remove edit elements
    const inputElement = document.querySelector('.edit-input');
    const controlsElement = document.querySelector('.edit-controls');
    
    if (inputElement) inputElement.remove();
    if (controlsElement) controlsElement.remove();
    
    // Refresh the modal
    const project = allProjects.find(p => p.id === currentlyViewedProjectId);
    if (project) {
        refreshDetailsModal(project);
    }
}

// =================
// Deadline Management
// =================
function renderDeadlineRequest(project, isAuthor, isAdmin) {
    const deadlinesSection = document.getElementById('deadlines-section');
    
    // Add deadline request section
    let deadlineRequestHTML = '';
    
    if (project.deadlineRequest) {
        const request = project.deadlineRequest;
        const statusClass = request.status;
        
        deadlineRequestHTML = `
            <div class="deadline-request ${statusClass}">
                <strong>Deadline Change Request:</strong><br>
                New deadline: ${new Date(request.newDeadline).toLocaleDateString()}<br>
                Reason: ${request.reason}<br>
                Status: <span style="text-transform: capitalize;">${request.status}</span>
                ${request.status === 'pending' && isAdmin ? `
                    <div style="margin-top: 8px;">
                        <button id="approve-deadline-button" class="btn-success" style="font-size: 11px; padding: 4px 8px; margin-right: 4px;">Approve</button>
                        <button id="reject-deadline-button" class="btn-danger" style="font-size: 11px; padding: 4px 8px;">Reject</button>
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    // Add request button for authors
    if (isAuthor && (!project.deadlineRequest || project.deadlineRequest.status !== 'pending')) {
        deadlineRequestHTML += `
            <button id="request-deadline-change-button" class="btn-secondary" style="width: 100%; margin-top: 8px; font-size: 12px;">
                Request Deadline Change
            </button>
        `;
    }
    
    // Insert before the existing deadlines list
    const existingRequest = deadlinesSection.querySelector('.deadline-request-section');
    if (existingRequest) {
        existingRequest.remove();
    }
    
    if (deadlineRequestHTML) {
        const requestDiv = document.createElement('div');
        requestDiv.className = 'deadline-request-section';
        requestDiv.innerHTML = deadlineRequestHTML;
        
        const deadlinesList = document.getElementById('details-deadlines-list');
        deadlinesList.before(requestDiv);
        
        // Add event listeners
        document.getElementById('request-deadline-change-button')?.addEventListener('click', handleRequestDeadlineChange);
        document.getElementById('approve-deadline-button')?.addEventListener('click', handleApproveDeadlineChange);
        document.getElementById('reject-deadline-button')?.addEventListener('click', handleRejectDeadlineChange);
    }
}

function handleRequestDeadlineChange() {
    const project = allProjects.find(p => p.id === currentlyViewedProjectId);
    if (!project) return;
    
    const newDeadline = prompt('Enter new deadline (YYYY-MM-DD):');
    if (!newDeadline) return;
    
    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(newDeadline)) {
        alert('Please enter date in YYYY-MM-DD format.');
        return;
    }
    
    const reason = prompt('Reason for deadline change:');
    if (!reason) return;
    
    const deadlineRequest = {
        newDeadline: newDeadline,
        reason: reason.trim(),
        status: 'pending',
        requestedBy: currentUserName,
        requestedAt: new Date()
    };
    
    db.collection('projects').doc(currentlyViewedProjectId).update({
        deadlineRequest: deadlineRequest
    }).then(() => {
        addActivity(currentlyViewedProjectId, `requested a deadline change to ${new Date(newDeadline).toLocaleDateString()}.`);
    }).catch((error) => {
        console.error('[DEADLINE REQUEST ERROR]', error);
        alert('Failed to submit deadline request. Please try again.');
    });
}

function handleApproveDeadlineChange() {
    const project = allProjects.find(p => p.id === currentlyViewedProjectId);
    if (!project || !project.deadlineRequest) return;
    
    const newDeadlines = { ...project.deadlines };
    newDeadlines.publication = project.deadlineRequest.newDeadline;
    
    const updatedRequest = { ...project.deadlineRequest };
    updatedRequest.status = 'approved';
    updatedRequest.approvedBy = currentUserName;
    updatedRequest.approvedAt = new Date();
    
    db.collection('projects').doc(currentlyViewedProjectId).update({
        deadlines: newDeadlines,
        deadlineRequest: updatedRequest
    }).then(() => {
        addActivity(currentlyViewedProjectId, `approved the deadline change to ${new Date(project.deadlineRequest.newDeadline).toLocaleDateString()}.`);
    }).catch((error) => {
        console.error('[DEADLINE APPROVAL ERROR]', error);
        alert('Failed to approve deadline change. Please try again.');
    });
}

function handleRejectDeadlineChange() {
    const project = allProjects.find(p => p.id === currentlyViewedProjectId);
    if (!project || !project.deadlineRequest) return;
    
    const reason = prompt('Reason for rejection (optional):') || 'No reason provided';
    
    const updatedRequest = { ...project.deadlineRequest };
    updatedRequest.status = 'rejected';
    updatedRequest.rejectedBy = currentUserName;
    updatedRequest.rejectedAt = new Date();
    updatedRequest.rejectionReason = reason;
    
    db.collection('projects').doc(currentlyViewedProjectId).update({
        deadlineRequest: updatedRequest
    }).then(() => {
        addActivity(currentlyViewedProjectId, `rejected the deadline change request. Reason: ${reason}`);
    }).catch((error) => {
        console.error('[DEADLINE REJECTION ERROR]', error);
        alert('Failed to reject deadline change. Please try again.');
    });
}
