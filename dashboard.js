// ===============================
// Catalyst Tracker - Enhanced Dashboard JS with Deadline Management
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

// Test Firebase connection
async function testFirebaseConnection() {
    try {
        console.log("[FIREBASE] Testing connection...");
        
        // Simple connection test
        const testDoc = await db.collection('_test').limit(1).get();
        console.log("[FIREBASE] Connection test successful");
        return true;
    } catch (error) {
        console.error("[FIREBASE] Connection test failed:", error);
        return false;
    }
}

// ---- App State ----
let currentUser = null, currentUserName = null, currentUserRole = null;
let allProjects = [], allEditors = [];
let currentlyViewedProjectId = null;
let currentView = 'interviews';
let calendarDate = new Date();

// ======================
//  Initialization with Better Error Handling
// ======================
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    currentUser = user;

    try {
        console.log("[INIT] User authenticated:", user.uid);
        
        // Test Firebase connection first
        const connectionWorks = await testFirebaseConnection();
        if (!connectionWorks) {
            console.warn("[INIT] Firebase connection test failed, proceeding with limited functionality");
        }
        
        // Set basic user info immediately from auth object
        currentUserName = user.displayName || user.email.split('@')[0] || 'User';
        currentUserRole = 'writer'; // Default role
        
        // Try to get user document with timeout
        let userDoc = null;
        if (connectionWorks) {
            try {
                console.log("[INIT] Attempting to fetch user profile...");
                
                // Add a timeout to prevent hanging
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Profile fetch timeout')), 10000)
                );
                
                const fetchPromise = db.collection('users').doc(user.uid).get();
                userDoc = await Promise.race([fetchPromise, timeoutPromise]);
                
                console.log("[INIT] User document fetched successfully");
            } catch (docError) {
                console.warn("[INIT] Could not fetch user document:", docError.message);
                // Continue with default values - don't fail here
            }
        }
        
        if (userDoc && userDoc.exists) {
            const userData = userDoc.data();
            currentUserName = userData.name || currentUserName;
            currentUserRole = userData.role || 'writer';
            console.log("[INIT] Loaded existing user profile:", userData);
        } else {
            console.log("[INIT] Using default user profile - will create document in background");
            
            // Try to create user document in background (don't wait for it)
            if (connectionWorks) {
                setTimeout(async () => {
                    try {
                        const defaultUserData = {
                            name: currentUserName,
                            email: user.email,
                            role: 'writer',
                            createdAt: new Date()
                        };
                        await db.collection('users').doc(user.uid).set(defaultUserData, { merge: true });
                        console.log("[BACKGROUND] Created user profile:", defaultUserData);
                    } catch (bgError) {
                        console.warn("[BACKGROUND] Failed to create user profile:", bgError);
                    }
                }, 1000);
            }
        }

        // Continue initialization with fallback values
        console.log("[INIT] Proceeding with user:", currentUserName, currentUserRole);
        
        // Fetch editors with error handling
        if (connectionWorks) {
            try {
                await fetchEditors();
            } catch (editorError) {
                console.warn("[INIT] Could not fetch editors:", editorError.message);
                allEditors = []; // Continue with empty editors array
            }
        } else {
            allEditors = [];
        }
        
        setupUI();
        setupNavAndListeners();
        
        // Subscribe to projects with error handling
        if (connectionWorks) {
            try {
                subscribeToProjects();
            } catch (projectError) {
                console.warn("[INIT] Could not subscribe to projects:", projectError.message);
                allProjects = [];
                renderCurrentView();
            }
        } else {
            allProjects = [];
            renderCurrentView();
        }

        document.getElementById('loader').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
        
        if (!connectionWorks) {
            setTimeout(() => {
                alert("Warning: Connection to database is limited. Some features may not work properly. Please refresh the page to try again.");
            }, 1000);
        }
        
        console.log("[INIT] Initialization completed successfully");
        
    } catch (error) {
        console.error("Initialization Error:", error);
        
        // More detailed error handling with better fallbacks
        let errorMessage = "There was an issue loading the app. ";
        let shouldSignOut = false;
        
        if (error.code === 'permission-denied') {
            errorMessage += "You don't have permission to access this resource. Please contact an administrator.";
            shouldSignOut = true;
        } else if (error.code === 'unavailable') {
            errorMessage += "The service is currently unavailable. Please try again later.";
        } else if (error.message.includes('network')) {
            errorMessage += "Please check your internet connection and try again.";
        } else if (error.message.includes('timeout')) {
            errorMessage += "The request timed out. Please check your connection and try again.";
        } else {
            errorMessage += "Please refresh the page and try again.";
        }
        
        // Show error but try to continue with minimal functionality
        console.error("[INIT] Showing error message:", errorMessage);
        
        // Try to at least show the UI with basic info
        try {
            currentUserName = user.displayName || user.email.split('@')[0] || 'User';
            currentUserRole = 'writer';
            allEditors = [];
            allProjects = [];
            setupUI();
            setupNavAndListeners();
            renderCurrentView();
            
            document.getElementById('loader').style.display = 'none';
            document.getElementById('app-container').style.display = 'flex';
            
            // Show warning instead of blocking error
            setTimeout(() => {
                alert("Warning: " + errorMessage + " The app is running in limited mode.");
            }, 500);
            
        } catch (fallbackError) {
            console.error("[INIT] Complete fallback failed:", fallbackError);
            alert(errorMessage);
            
            if (shouldSignOut) {
                try {
                    await auth.signOut();
                } catch (signOutError) {
                    console.error("Error signing out:", signOutError);
                    window.location.href = 'index.html';
                }
            }
        }
    }
});

async function fetchEditors() {
    try {
        console.log("[INIT] Fetching editors...");
        
        // Add timeout for editors fetch
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Editors fetch timeout')), 8000)
        );
        
        const fetchPromise = db.collection('users').where('role', 'in', ['admin', 'editor']).get();
        const editorsSnapshot = await Promise.race([fetchPromise, timeoutPromise]);
        
        allEditors = editorsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("[INIT] Found", allEditors.length, "editors");
    } catch (error) {
        console.error("Error fetching editors:", error);
        // Continue with empty editors array - this shouldn't crash the app
        allEditors = [];
        console.log("[INIT] Continuing with empty editors array");
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
    document.getElementById('assign-editor-button').addEventListener('click', handleAssignEditor);
    document.getElementById('set-deadlines-button').addEventListener('click', handleSetDeadlines);
    document.getElementById('request-deadline-change-button').addEventListener('click', handleRequestDeadlineChange);
    document.getElementById('delete-project-button').addEventListener('click', handleDeleteProject);
    document.getElementById('approve-button').addEventListener('click', () => approveProposal(currentlyViewedProjectId));
    document.getElementById('reject-button').addEventListener('click', () => updateProposalStatus('rejected'));
    document.getElementById('prev-month').addEventListener('click', () => changeMonth(-1));
    document.getElementById('next-month').addEventListener('click', () => changeMonth(1));

    // NEW: Deadline request and proposal editing listeners (with null checks)
    const requestDeadlineBtn = document.getElementById('request-deadline-button');
    const approveDeadlineBtn = document.getElementById('approve-deadline-button');
    const rejectDeadlineBtn = document.getElementById('reject-deadline-button');
    const editProposalBtn = document.getElementById('edit-proposal-button');
    const saveProposalBtn = document.getElementById('save-proposal-button');
    const cancelProposalBtn = document.getElementById('cancel-proposal-button');

    if (requestDeadlineBtn) requestDeadlineBtn.addEventListener('click', handleRequestDeadlineChangeModal);
    if (approveDeadlineBtn) approveDeadlineBtn.addEventListener('click', handleApproveDeadlineRequest);
    if (rejectDeadlineBtn) rejectDeadlineBtn.addEventListener('click', handleRejectDeadlineRequest);
    if (editProposalBtn) editProposalBtn.addEventListener('click', enableProposalEditing);
    if (saveProposalBtn) saveProposalBtn.addEventListener('click', handleSaveProposal);
    if (cancelProposalBtn) cancelProposalBtn.addEventListener('click', disableProposalEditing);

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
    
    try {
        const unsubscribe = db.collection('projects').onSnapshot(snapshot => {
            try {
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
            } catch (processingError) {
                console.error("[FIREBASE] Error processing project updates:", processingError);
                // Continue with existing data rather than crashing
            }
        }, error => {
            console.error("[FIREBASE ERROR] Projects subscription failed:", error);
            
            // Don't crash the app - show a warning and retry
            console.log("[FIREBASE] Attempting to reconnect in 5 seconds...");
            setTimeout(() => {
                try {
                    subscribeToProjects();
                } catch (retryError) {
                    console.error("[FIREBASE] Retry failed:", retryError);
                }
            }, 5000);
        });
        
        // Store unsubscribe function for cleanup if needed
        window.projectsUnsubscribe = unsubscribe;
        
    } catch (subscriptionError) {
        console.error("[FIREBASE] Failed to set up subscription:", subscriptionError);
        // Try to load projects once as fallback
        loadProjectsOnce();
    }
}

// Fallback function to load projects once if subscription fails
async function loadProjectsOnce() {
    try {
        console.log("[FIREBASE] Loading projects once as fallback...");
        const snapshot = await db.collection('projects').get();
        allProjects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderCurrentView();
        updateNavCounts();
        console.log("[FIREBASE] Loaded", allProjects.length, "projects");
    } catch (error) {
        console.error("[FIREBASE] Failed to load projects:", error);
        allProjects = [];
        renderCurrentView();
    }
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
        
        // FIXED: Proper column header structure
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
    
    // NEW: Show deadline request indicator if pending
    const deadlineRequestIndicator = project.deadlineRequest && project.deadlineRequest.status === 'pending' ? 
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
    
    // Reset proposal editing state
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
    document.getElementById('details-publication-deadline').textContent = new Date(finalDeadline + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    
    // NEW: Set up proposal display/editing
    const proposalElement = document.getElementById('details-proposal');
    const titleElement = document.getElementById('details-title');
    proposalElement.textContent = project.proposal || 'No proposal provided.';
    
    // Show edit button if user can edit (author or admin)
    const canEditProposal = isAuthor || isAdmin;
    const editBtn = document.getElementById('edit-proposal-button');
    if (editBtn) editBtn.style.display = canEditProposal ? 'inline-block' : 'none';

    document.getElementById('admin-approval-section').style.display = isAdmin && project.proposalStatus === 'pending' ? 'block' : 'none';
    
    const needsEditor = project.timeline && project.timeline["Article Writing Complete"] && !project.editorId;
    document.getElementById('assign-editor-section').style.display = isAdmin && needsEditor ? 'flex' : 'none';
    
    // REMOVED: Interview details section is completely removed
    
    populateEditorDropdown(project.editorId);
    renderTimeline(project, isAuthor, isEditor, isAdmin);
    renderDeadlines(project, isAuthor, isEditor, isAdmin);
    renderDeadlineRequestSection(project, isAuthor, isAdmin);
    renderActivityFeed(project.activity || []);
    
    // NEW: Show delete button only for project authors or admins
    const deleteButton = document.getElementById('delete-project-button');
    if (deleteButton) {
        deleteButton.style.display = (isAuthor || isAdmin) ? 'block' : 'none';
    }
}

// NEW: Enhanced Deadline Request Management
function renderDeadlineRequestSection(project, isAuthor, isAdmin) {
    const deadlineSection = document.getElementById('deadline-request-section');
    if (!deadlineSection) return;
    
    if (project.deadlineChangeRequest) {
        const request = project.deadlineChangeRequest;
        
        if (request.status === 'pending') {
            let requestDetailsHTML = `
                <h4>Pending Deadline Change Request</h4>
                <p><strong>Requested by:</strong> ${request.requestedBy}</p>
                <p><strong>Reason:</strong> ${request.reason}</p>
                <div style="margin: 12px 0;">
                    <strong>Requested Changes:</strong>
                </div>
            `;
            
            for (const [field, newDate] of Object.entries(request.requestedDeadlines)) {
                const fieldLabels = {
                    'contact': 'Contact Professor',
                    'interview': 'Conduct Interview', 
                    'draft': 'Write Draft',
                    'review': 'Editor Review',
                    'edits': 'Review Edits'
                };
                
                requestDetailsHTML += `
                    <p style="margin-left: 16px;">• ${fieldLabels[field]}: ${new Date(newDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                `;
            }
            
            if (isAdmin) {
                requestDetailsHTML += `
                    <div class="button-group" style="margin-top: 16px;">
                        <button id="approve-deadline-change-button" class="btn-success">Approve Changes</button>
                        <button id="reject-deadline-change-button" class="btn-danger">Reject Request</button>
                    </div>
                `;
            } else {
                requestDetailsHTML += '<p style="font-style: italic; color: var(--warning-color); margin-top: 12px;">Awaiting admin approval...</p>';
            }
            
            deadlineSection.innerHTML = requestDetailsHTML;
            deadlineSection.style.display = 'block';
            
            // Re-attach event listeners for dynamically created buttons
            if (isAdmin) {
                const approveBtn = document.getElementById('approve-deadline-change-button');
                const rejectBtn = document.getElementById('reject-deadline-change-button');
                if (approveBtn) approveBtn.addEventListener('click', handleApproveDeadlineChangeRequest);
                if (rejectBtn) rejectBtn.addEventListener('click', handleRejectDeadlineChangeRequest);
            }
        } else {
            deadlineSection.style.display = 'none';
        }
    } else {
        deadlineSection.style.display = 'none';
    }
}

// NEW: Proposal Editing Functions
function enableProposalEditing() {
    const project = allProjects.find(p => p.id === currentlyViewedProjectId);
    if (!project) return;
    
    // Replace title with input
    const titleElement = document.getElementById('details-title');
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.id = 'edit-title-input';
    titleInput.value = project.title;
    titleInput.className = 'edit-title-input';
    titleElement.replaceWith(titleInput);
    
    // Replace proposal text with textarea
    const proposalElement = document.getElementById('details-proposal');
    const proposalTextarea = document.createElement('textarea');
    proposalTextarea.id = 'edit-proposal-textarea';
    proposalTextarea.value = project.proposal || '';
    proposalTextarea.className = 'edit-proposal-textarea';
    proposalTextarea.rows = 6;
    proposalElement.replaceWith(proposalTextarea);
    
    // Show save/cancel buttons, hide edit button
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
    
    // Restore title
    const titleInput = document.getElementById('edit-title-input');
    if (titleInput) {
        const titleElement = document.createElement('h2');
        titleElement.id = 'details-title';
        titleElement.textContent = project.title;
        titleInput.replaceWith(titleElement);
    }
    
    // Restore proposal text
    const proposalTextarea = document.getElementById('edit-proposal-textarea');
    if (proposalTextarea) {
        const proposalElement = document.createElement('p');
        proposalElement.id = 'details-proposal';
        proposalElement.textContent = project.proposal || 'No proposal provided.';
        proposalTextarea.replaceWith(proposalElement);
    }
    
    // Show edit button, hide save/cancel buttons
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
        
        // The modal will refresh automatically due to the subscription
        
    } catch (error) {
        console.error('[PROPOSAL UPDATE ERROR]', error);
        alert('Failed to update proposal. Please try again.');
    }
}

// NEW: Enhanced Deadline Change Request Functions
async function handleRequestDeadlineChangeModal() {
    if (!currentlyViewedProjectId) return;
    
    const project = allProjects.find(p => p.id === currentlyViewedProjectId);
    if (!project) return;
    
    // Create a modal for deadline change request
    const reason = prompt('Please provide a reason for the deadline change request:');
    if (!reason || !reason.trim()) return;
    
    // Show form for setting new deadlines
    showDeadlineChangeForm(project, reason.trim());
}

function showDeadlineChangeForm(project, reason) {
    // Create a temporary modal for deadline changes
    const modalHTML = `
        <div id="deadline-change-modal" class="modal-overlay" style="display: flex;">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Request Deadline Changes</h2>
                    <button class="close-button" onclick="closeDeadlineChangeModal()">×</button>
                </div>
                <div style="padding: 24px;">
                    <p><strong>Reason:</strong> ${reason}</p>
                    <p style="margin: 16px 0;">Select which deadlines you want to change:</p>
                    <form id="deadline-change-form">
                        ${project.type === 'Interview' ? `
                        <div class="deadline-item">
                            <label>
                                <input type="checkbox" id="change-contact"> Contact Professor
                            </label>
                            <input type="date" id="new-contact" disabled>
                        </div>
                        <div class="deadline-item">
                            <label>
                                <input type="checkbox" id="change-interview"> Conduct Interview
                            </label>
                            <input type="date" id="new-interview" disabled>
                        </div>
                        ` : ''}
                        <div class="deadline-item">
                            <label>
                                <input type="checkbox" id="change-draft"> Write Draft
                            </label>
                            <input type="date" id="new-draft" disabled>
                        </div>
                        ${project.editorId === currentUser.uid ? `
                        <div class="deadline-item">
                            <label>
                                <input type="checkbox" id="change-review"> Editor Review
                            </label>
                            <input type="date" id="new-review" disabled>
                        </div>
                        ` : ''}
                        <div class="deadline-item">
                            <label>
                                <input type="checkbox" id="change-edits"> Review Edits
                            </label>
                            <input type="date" id="new-edits" disabled>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-secondary" onclick="closeDeadlineChangeModal()">Cancel</button>
                    <button type="button" class="btn-primary" onclick="submitDeadlineChangeRequest('${reason}')">Submit Request</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Add event listeners for checkboxes
    document.querySelectorAll('#deadline-change-form input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const fieldName = this.id.replace('change-', '');
            const dateInput = document.getElementById(`new-${fieldName}`);
            dateInput.disabled = !this.checked;
            if (!this.checked) dateInput.value = '';
        });
    });
}

window.closeDeadlineChangeModal = function() {
    const modal = document.getElementById('deadline-change-modal');
    if (modal) modal.remove();
};

window.submitDeadlineChangeRequest = async function(reason) {
    if (!currentlyViewedProjectId) return;
    
    const requestedDeadlines = {};
    const checkboxes = document.querySelectorAll('#deadline-change-form input[type="checkbox"]:checked');
    
    if (checkboxes.length === 0) {
        alert('Please select at least one deadline to change.');
        return;
    }
    
    let hasValidDates = true;
    checkboxes.forEach(checkbox => {
        const fieldName = checkbox.id.replace('change-', '');
        const dateInput = document.getElementById(`new-${fieldName}`);
        if (!dateInput.value) {
            hasValidDates = false;
            return;
        }
        requestedDeadlines[fieldName] = dateInput.value;
    });
    
    if (!hasValidDates) {
        alert('Please fill in all selected deadline dates.');
        return;
    }
    
    try {
        await db.collection('projects').doc(currentlyViewedProjectId).update({
            deadlineChangeRequest: {
                requestedBy: currentUserName,
                requestedDeadlines: requestedDeadlines,
                reason: reason,
                status: 'pending',
                requestedAt: new Date()
            }
        });
        
        await addActivity(currentlyViewedProjectId, `requested deadline changes for: ${Object.keys(requestedDeadlines).join(', ')}. Reason: ${reason}`);
        
        closeDeadlineChangeModal();
        
    } catch (error) {
        console.error('[DEADLINE CHANGE REQUEST ERROR]', error);
        alert('Failed to submit deadline change request. Please try again.');
    }
};

async function handleApproveDeadlineChangeRequest() {
    if (!currentlyViewedProjectId) return;
    
    const project = allProjects.find(p => p.id === currentlyViewedProjectId);
    if (!project || !project.deadlineChangeRequest) return;
    
    try {
        const newDeadlines = {
            ...project.deadlines,
            ...project.deadlineChangeRequest.requestedDeadlines
        };
        
        await db.collection('projects').doc(currentlyViewedProjectId).update({
            deadlines: newDeadlines,
            'deadlineChangeRequest.status': 'approved',
            'deadlineChangeRequest.approvedBy': currentUserName,
            'deadlineChangeRequest.approvedAt': new Date()
        });
        
        const changedFields = Object.keys(project.deadlineChangeRequest.requestedDeadlines).join(', ');
        await addActivity(currentlyViewedProjectId, `approved deadline changes for: ${changedFields}`);
        
    } catch (error) {
        console.error('[DEADLINE CHANGE APPROVAL ERROR]', error);
        alert('Failed to approve deadline changes. Please try again.');
    }
}

async function handleRejectDeadlineChangeRequest() {
    if (!currentlyViewedProjectId) return;
    
    const reason = prompt('Please provide a reason for rejecting this deadline change request (optional):');
    
    try {
        const updates = {
            'deadlineChangeRequest.status': 'rejected',
            'deadlineChangeRequest.rejectedBy': currentUserName,
            'deadlineChangeRequest.rejectedAt': new Date()
        };
        
        if (reason && reason.trim()) {
            updates['deadlineChangeRequest.rejectionReason'] = reason.trim();
        }
        
        await db.collection('projects').doc(currentlyViewedProjectId).update(updates);
        
        const activityText = reason ? 
            `rejected the deadline change request. Reason: ${reason.trim()}` :
            'rejected the deadline change request.';
        
        await addActivity(currentlyViewedProjectId, activityText);
        
    } catch (error) {
        console.error('[DEADLINE CHANGE REJECTION ERROR]', error);
        alert('Failed to reject deadline change request. Please try again.');
    }
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

// NEW: Enhanced Deadline Management
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
        
        // Determine if user can set this deadline
        let canSetDeadline = false;
        if (isAdmin) {
            canSetDeadline = true;
        } else if (field.key === 'review' && isEditor) {
            canSetDeadline = true;
        } else if (field.key !== 'review' && isAuthor) {
            canSetDeadline = true;
        }
        
        // If deadline is already set, disable editing (only admins can approve changes)
        const isDeadlineSet = value !== '';
        const canEdit = canSetDeadline && !isDeadlineSet;
        
        deadlineItem.innerHTML = `
            <label for="deadline-${field.key}">${field.label}</label>
            <input type="date" id="deadline-${field.key}" value="${value}" ${!canEdit ? 'disabled' : ''}>
            ${isDeadlineSet && canSetDeadline && !isAdmin ? 
                `<span style="font-size: 11px; color: var(--text-secondary);">Set - contact admin to change</span>` : 
                ''}
        `;
        
        if (canEdit) {
            const input = deadlineItem.querySelector('input');
            input.addEventListener('change', async function() {
                if (this.value) {
                    await handleSetIndividualDeadline(project.id, field.key, this.value);
                    this.disabled = true; // Disable after setting
                }
            });
        }
        
        deadlinesList.appendChild(deadlineItem);
    });
    
    // Show deadline change request button for authors and editors
    const requestButton = document.getElementById('request-deadline-change-button');
    if (requestButton) {
        if ((isAuthor || isEditor) && !project.deadlineChangeRequest || 
            (project.deadlineChangeRequest && project.deadlineChangeRequest.status !== 'pending')) {
            requestButton.style.display = 'inline-block';
        } else {
            requestButton.style.display = 'none';
        }
    }
    
    // Remove the old update deadlines button - no longer needed
    const updateButton = document.getElementById('update-deadlines-button');
    if (updateButton) updateButton.style.display = 'none';
    
    // Show set deadlines button instead
    const setButton = document.getElementById('set-deadlines-button');
    if (setButton) {
        // Only show for admins or if user has unset deadlines they can control
        const hasUnsetDeadlines = deadlineFields.some(field => {
            if (project.type === 'Op-Ed' && (field.key === 'contact' || field.key === 'interview')) return false;
            const canSet = isAdmin || (field.key === 'review' && isEditor) || (field.key !== 'review' && isAuthor);
            return canSet && !deadlines[field.key];
        });
        
        setButton.style.display = hasUnsetDeadlines ? 'block' : 'none';
    }
}

// NEW: Individual deadline setting
async function handleSetIndividualDeadline(projectId, field, date) {
    if (!date || !projectId) return;
    
    try {
        await db.collection('projects').doc(projectId).update({
            [`deadlines.${field}`]: date
        });
        
        const fieldLabels = {
            'contact': 'Contact Professor',
            'interview': 'Conduct Interview',
            'draft': 'Write Draft',
            'review': 'Editor Review',
            'edits': 'Review Edits'
        };
        
        await addActivity(projectId, `set ${fieldLabels[field]} deadline to ${new Date(date).toLocaleDateString()}`);
        
    } catch (error) {
        console.error('[INDIVIDUAL DEADLINE SET ERROR]', error);
        alert('Failed to set deadline. Please try again.');
    }
}

// NEW: Batch deadline setting (for admins mainly)
async function handleSetDeadlines() {
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
        if (input && input.value) {
            const oldValue = currentProject.deadlines[field] || '';
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
            console.error('[BATCH DEADLINE SET ERROR]', error);
            alert('Failed to set deadlines. Please try again.');
        }
    }
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

async function handleDeleteProject() {
    if (!currentlyViewedProjectId) return;
    
    const project = allProjects.find(p => p.id === currentlyViewedProjectId);
    if (!project) return;
    
    // Check if user can delete this project
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
    reportContent.innerHTML = ''; // Clear previous report

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // 1. General Alerts
    const overdueProjects = allProjects.filter(p => {
        const finalDeadline = p.deadlines ? p.deadlines.publication : p.deadline;
        return new Date(finalDeadline) < now && getProjectState(p).column !== 'Completed';
    });

    // NEW: Pending deadline change requests for admin attention
    const pendingDeadlineRequests = allProjects.filter(p => 
        p.deadlineChangeRequest && p.deadlineChangeRequest.status === 'pending'
    );

    const completedThisWeek = allProjects.filter(p => {
        const state = getProjectState(p);
        if (state.column !== 'Completed') return false;
        const completionActivity = (p.activity || []).find(a => a.text.includes('Suggestions Reviewed'));
        if (!completionActivity) return false;
        return completionActivity.timestamp.toDate() >= oneWeekAgo;
    });
    
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
                `<h3>Pending Deadline Change Requests (${pendingDeadlineRequests.length})</h3>` + pendingDeadlineRequests.map(p => `
                    <div class="report-item deadline-request-item" data-id="${p.id}">
                        <span class="report-item-title">${p.title}</span>
                        <span class="report-item-meta">Requested by: ${p.deadlineChangeRequest.requestedBy} | Fields: ${Object.keys(p.deadlineChangeRequest.requestedDeadlines).join(', ')}</span>
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
