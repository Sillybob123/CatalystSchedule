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
    
    setupCalendarListeners();
    setupCalendarKeyboardNavigation();
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
    renderCurrentViewEnhanced();
}

function renderCurrentViewEnhanced() {
    const boardView = document.getElementById('board-view');
    const calendarView = document.getElementById('calendar-view');

    if (currentView === 'calendar') {
        boardView.style.display = 'none';
        calendarView.style.display = 'block';
        
        // Setup calendar listeners if not already done
        setupCalendarListeners();
        
        // Render calendar
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
        
        renderCurrentViewEnhanced();
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
    
    if (!calendarGrid || !monthYear) return;
    
    calendarGrid.innerHTML = '';
    
    const month = calendarDate.getMonth();
    const year = calendarDate.getFullYear();
    
    // Update header
    monthYear.textContent = `${calendarDate.toLocaleString('default', { month: 'long' })} ${year}`;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonth = new Date(year, month, 0);
    const today = new Date();

    // Previous month's trailing days
    for (let i = firstDay - 1; i >= 0; i--) {
        const dayDate = new Date(prevMonth);
        dayDate.setDate(prevMonth.getDate() - i);
        createCalendarDay(calendarGrid, dayDate, true, today);
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
        const dayDate = new Date(year, month, day);
        createCalendarDay(calendarGrid, dayDate, false, today);
    }

    // Next month's leading days to fill the grid (6 rows × 7 days = 42 total)
    const totalCells = calendarGrid.children.length;
    const remainingCells = 42 - totalCells;
    const nextMonth = new Date(year, month + 1, 1);
    
    for (let day = 1; day <= remainingCells; day++) {
        const dayDate = new Date(nextMonth);
        dayDate.setDate(day);
        createCalendarDay(calendarGrid, dayDate, true, today);
    }

    // Update statistics
    updateCalendarStats();
    
    // Add fade-in animation
    const container = document.querySelector('.calendar-container');
    if (container) {
        container.classList.add('calendar-fade-in');
        setTimeout(() => container.classList.remove('calendar-fade-in'), 300);
    }
}

function createCalendarDay(grid, date, isOtherMonth, today) {
    const dayEl = document.createElement('div');
    dayEl.className = 'calendar-day';
    
    if (isOtherMonth) {
        dayEl.classList.add('other-month');
    }
    
    // Check if this is today
    if (isSameDay(date, today)) {
        dayEl.classList.add('today');
    }

    // Create day number
    const dayNumber = document.createElement('div');
    dayNumber.className = 'day-number';
    dayNumber.textContent = date.getDate();

    // Create events container
    const eventsContainer = document.createElement('div');
    eventsContainer.className = 'calendar-events';

    // Find projects for this day
    const dayProjects = allProjects.filter(project => {
        return hasProjectDeadlineOnDate(project, date);
    });

    // Display up to 3 events, then show "+X more"
    const maxVisibleEvents = 3;
    dayProjects.slice(0, maxVisibleEvents).forEach(project => {
        const eventEl = createCalendarEvent(project, date);
        eventsContainer.appendChild(eventEl);
    });

    if (dayProjects.length > maxVisibleEvents) {
        const moreEl = document.createElement('div');
        moreEl.className = 'event-more';
        moreEl.textContent = `+${dayProjects.length - maxVisibleEvents} more`;
        moreEl.addEventListener('click', (e) => {
            e.stopPropagation();
            showDayDetails(date, dayProjects);
        });
        eventsContainer.appendChild(moreEl);
    }

    dayEl.appendChild(dayNumber);
    dayEl.appendChild(eventsContainer);

    // Add click handler for day
    dayEl.addEventListener('click', () => {
        if (dayProjects.length === 1) {
            openDetailsModal(dayProjects[0].id);
        } else if (dayProjects.length > 1) {
            showDayDetails(date, dayProjects);
        }
    });

    grid.appendChild(dayEl);
}

function createCalendarEvent(project, date) {
    const eventEl = document.createElement('div');
    
    // Determine event type and styling
    const { eventType, eventTitle } = getEventTypeForDate(project, date);
    
    eventEl.className = `calendar-event ${eventType}`;
    eventEl.textContent = eventTitle;
    eventEl.title = `${project.title} - ${eventTitle} - ${date.toLocaleDateString()}`;

    // Add click handler
    eventEl.addEventListener('click', (e) => {
        e.stopPropagation();
        openDetailsModal(project.id);
    });

    return eventEl;
}

function getEventTypeForDate(project, date) {
    const deadlines = project.deadlines || {};
    const finalDeadline = deadlines.publication || project.deadline;
    const dateStr = formatDateForComparison(date);
    
    // Check different types of deadlines
    if (deadlines.contact && formatDateForComparison(new Date(deadlines.contact + 'T00:00:00')) === dateStr) {
        return { eventType: 'interview', eventTitle: 'Contact Professor' };
    }
    if (deadlines.interview && formatDateForComparison(new Date(deadlines.interview + 'T00:00:00')) === dateStr) {
        return { eventType: 'interview', eventTitle: 'Interview Due' };
    }
    if (deadlines.draft && formatDateForComparison(new Date(deadlines.draft + 'T00:00:00')) === dateStr) {
        return { eventType: 'due-soon', eventTitle: 'Draft Due' };
    }
    if (deadlines.review && formatDateForComparison(new Date(deadlines.review + 'T00:00:00')) === dateStr) {
        return { eventType: 'due-soon', eventTitle: 'Review Due' };
    }
    if (deadlines.edits && formatDateForComparison(new Date(deadlines.edits + 'T00:00:00')) === dateStr) {
        return { eventType: 'due-soon', eventTitle: 'Edits Due' };
    }
    if (finalDeadline && formatDateForComparison(new Date(finalDeadline + 'T00:00:00')) === dateStr) {
        const isOverdue = new Date(finalDeadline) < new Date();
        const eventType = isOverdue ? 'overdue' : 'publication';
        return { eventType, eventTitle: 'Publication Due' };
    }
    
    return { eventType: 'publication', eventTitle: project.title };
}

function hasProjectDeadlineOnDate(project, date) {
    const deadlines = project.deadlines || {};
    const finalDeadline = deadlines.publication || project.deadline;
    const dateStr = formatDateForComparison(date);
    
    // Check all possible deadline types
    const deadlineTypes = ['contact', 'interview', 'draft', 'review', 'edits'];
    
    for (const type of deadlineTypes) {
        if (deadlines[type]) {
            const deadlineDate = new Date(deadlines[type] + 'T00:00:00');
            if (formatDateForComparison(deadlineDate) === dateStr) {
                return true;
            }
        }
    }
    
    // Check final publication deadline
    if (finalDeadline) {
        const publicationDate = new Date(finalDeadline + 'T00:00:00');
        if (formatDateForComparison(publicationDate) === dateStr) {
            return true;
        }
    }
    
    return false;
}

function formatDateForComparison(date) {
    return date.getFullYear() + '-' + 
           String(date.getMonth() + 1).padStart(2, '0') + '-' +
           String(date.getDate()).padStart(2, '0');
}

function isSameDay(date1, date2) {
    return date1.getDate() === date2.getDate() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getFullYear() === date2.getFullYear();
}

function updateCalendarStats() {
    const now = new Date();
    const monthStart = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1);
    const monthEnd = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0);
    
    // Get week boundaries
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    let thisMonthCount = 0;
    let thisWeekCount = 0;
    let overdueCount = 0;
    
    allProjects.forEach(project => {
        const deadlines = project.deadlines || {};
        const finalDeadline = deadlines.publication || project.deadline;
        
        if (finalDeadline) {
            const deadline = new Date(finalDeadline + 'T00:00:00');
            
            // Count for this month
            if (deadline >= monthStart && deadline <= monthEnd) {
                thisMonthCount++;
            }
            
            // Count for this week
            if (deadline >= weekStart && deadline <= weekEnd) {
                thisWeekCount++;
            }
            
            // Count overdue (not completed)
            const state = getProjectState(project);
            if (deadline < now && state.column !== 'Completed') {
                overdueCount++;
            }
        }
        
        // Also check intermediate deadlines for current month/week
        const deadlineTypes = ['contact', 'interview', 'draft', 'review', 'edits'];
        deadlineTypes.forEach(type => {
            if (deadlines[type]) {
                const deadline = new Date(deadlines[type] + 'T00:00:00');
                
                if (deadline >= monthStart && deadline <= monthEnd) {
                    thisMonthCount++;
                }
                
                if (deadline >= weekStart && deadline <= weekEnd) {
                    thisWeekCount++;
                }
            }
        });
    });
    
    // Update stats display
    const statMonth = document.getElementById('stat-month');
    const statWeek = document.getElementById('stat-week');
    const statOverdue = document.getElementById('stat-overdue');
    
    if (statMonth) statMonth.textContent = thisMonthCount;
    if (statWeek) statWeek.textContent = thisWeekCount;
    if (statOverdue) statOverdue.textContent = overdueCount;
}

function showDayDetails(date, projects) {
    const dateStr = date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    let message = `Events for ${dateStr}:\n\n`;
    
    projects.forEach((project, index) => {
        const { eventType, eventTitle } = getEventTypeForDate(project, date);
        message += `${index + 1}. ${project.title}\n   ${eventTitle}\n   Author: ${project.authorName}\n\n`;
    });
    
    message += 'Click on an individual event to view project details.';
    alert(message);
}

function changeMonth(offset) {
    calendarDate.setMonth(calendarDate.getMonth() + offset);
    renderCalendar();
}

function goToToday() {
    calendarDate = new Date();
    renderCalendar();
}

// Enhanced event listener setup for calendar
function setupCalendarListeners() {
    // Navigation buttons
    const prevBtn = document.getElementById('prev-month');
    const nextBtn = document.getElementById('next-month');
    const todayBtn = document.getElementById('today-btn');
    
    if (prevBtn) prevBtn.addEventListener('click', () => changeMonth(-1));
    if (nextBtn) nextBtn.addEventListener('click', () => changeMonth(1));
    if (todayBtn) todayBtn.addEventListener('click', goToToday);
    
    // View toggle buttons
    document.querySelectorAll('.view-toggle button').forEach((btn, index) => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.view-toggle button').forEach((b, i) => {
                b.classList.toggle('active', i === index);
            });
            // Future: implement different view modes
            renderCalendar();
        });
    });
}

// Keyboard navigation for calendar
function setupCalendarKeyboardNavigation() {
    document.addEventListener('keydown', (e) => {
        if (currentView !== 'calendar') return;
        
        switch(e.key) {
            case 'ArrowLeft':
                if (e.ctrlKey || e.metaKey) {
                    changeMonth(-1);
                    e.preventDefault();
                }
                break;
            case 'ArrowRight':
                if (e.ctrlKey || e.metaKey) {
                    changeMonth(1);
                    e.preventDefault();
                }
                break;
            case 't':
            case 'T':
                if (e.ctrlKey || e.metaKey) {
                    goToToday();
                    e.preventDefault();
                }
                break;
        }
    });
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

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // --- Data Analysis ---
    const overdueProjects = allProjects.filter(p => {
        const finalDeadline = p.deadlines ? p.deadlines.publication : p.deadline;
        return finalDeadline && new Date(finalDeadline) < now && getProjectState(p).column !== 'Completed';
    });

    const pendingProposals = allProjects.filter(p => p.proposalStatus === 'pending');
    
    const pendingDeadlineRequests = allProjects.filter(p => 
        (p.deadlineRequest?.status === 'pending') || (p.deadlineChangeRequest?.status === 'pending')
    );

    const recentlyCompleted = allProjects.filter(p => {
        const state = getProjectState(p);
        if (state.column !== 'Completed') return false;
        const completionActivity = (p.activity || []).find(a => a.text.includes('Suggestions Reviewed'));
        if (!completionActivity?.timestamp) return false;
        const activityDate = completionActivity.timestamp.seconds ? new Date(completionActivity.timestamp.seconds * 1000) : new Date(completionActivity.timestamp);
        return activityDate >= oneWeekAgo;
    });

    const stuckProjects = allProjects.filter(p => {
        const state = getProjectState(p);
        if (state.column === 'Completed' || state.column === 'Topic Proposal') return false;
        const lastActivity = (p.activity || []).sort((a,b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0))[0];
        if (!lastActivity?.timestamp) return false;
        const lastActivityDate = lastActivity.timestamp.seconds ? new Date(lastActivity.timestamp.seconds * 1000) : new Date(lastActivity.timestamp);
        const daysSinceUpdate = (now - lastActivityDate) / (1000 * 60 * 60 * 24);
        return daysSinceUpdate > 14; // Stuck if no activity for 14 days
    });

    // --- Report Generation ---
    let reportHTML = `<div class="report-container">`;

    // 1. Executive Summary
    reportHTML += `
        <div class="report-section">
            <h2>📊 Executive Summary</h2>
            <div class="summary-grid">
                <div class="summary-item">
                    <div class="summary-value">${allProjects.length}</div>
                    <div class="summary-label">Total Projects</div>
                </div>
                <div class="summary-item overdue">
                    <div class="summary-value">${overdueProjects.length}</div>
                    <div class="summary-label">Overdue</div>
                </div>
                <div class="summary-item pending">
                    <div class="summary-value">${pendingProposals.length + pendingDeadlineRequests.length}</div>
                    <div class="summary-label">Pending Approvals</div>
                </div>
                 <div class="summary-item completed">
                    <div class="summary-value">${recentlyCompleted.length}</div>
                    <div class="summary-label">Completed This Week</div>
                </div>
            </div>
        </div>
    `;

    // 2. Meeting Agenda & Action Items
    const meetingItems = [];
    if(overdueProjects.length > 0) meetingItems.push(`Address ${overdueProjects.length} overdue projects.`);
    if(pendingProposals.length > 0) meetingItems.push(`Review ${pendingProposals.length} new article proposals.`);
    if(pendingDeadlineRequests.length > 0) meetingItems.push(`Action ${pendingDeadlineRequests.length} deadline requests.`);
    if(stuckProjects.length > 0) meetingItems.push(`Check in on ${stuckProjects.length} potentially stuck projects (no updates in >2 weeks).`);
    
    if (meetingItems.length > 0) {
        reportHTML += `
            <div class="report-section">
                <h2>📋 Meeting Agenda / Action Items</h2>
                <ul class="meeting-agenda">
                    ${meetingItems.map(item => `<li>${item}</li>`).join('')}
                </ul>
            </div>
        `;
    }

    // 3. Detailed "Action Required" Section
    if (overdueProjects.length > 0 || pendingProposals.length > 0 || pendingDeadlineRequests.length > 0) {
        reportHTML += `
            <div class="report-section">
                <h2>🚨 Action Required</h2>
                ${overdueProjects.length > 0 ? `<h3>Overdue Projects (${overdueProjects.length})</h3>` + overdueProjects.map(p => {
                    const deadline = p.deadlines ? p.deadlines.publication : p.deadline;
                    return `<div class="report-item overdue-item" data-id="${p.id}"><span>${p.title} (by ${p.authorName})</span><span class="meta">Due: ${new Date(deadline).toLocaleDateString()}</span></div>`;
                }).join('') : ''}
                
                ${pendingProposals.length > 0 ? `<h3>Pending Proposals (${pendingProposals.length})</h3>` + pendingProposals.map(p => {
                    return `<div class="report-item pending-item" data-id="${p.id}"><span>${p.title} (by ${p.authorName})</span><span class="meta">Awaiting Approval</span></div>`;
                }).join('') : ''}
                
                ${pendingDeadlineRequests.length > 0 ? `<h3>Pending Deadline Requests (${pendingDeadlineRequests.length})</h3>` + pendingDeadlineRequests.map(p => {
                     const request = p.deadlineRequest || p.deadlineChangeRequest;
                    return `<div class="report-item pending-item" data-id="${p.id}"><span>${p.title} (by ${p.authorName})</span><span class="meta">Requested by ${request.requestedBy}</span></div>`;
                }).join('') : ''}
            </div>
        `;
    }

    // 4. Team Workload Overview
    const userProjects = {};
    allProjects.forEach(p => {
        if (!userProjects[p.authorName]) userProjects[p.authorName] = { authored: [], edited: [] };
        userProjects[p.authorName].authored.push(p);

        if (p.editorName) {
            if (!userProjects[p.editorName]) userProjects[p.editorName] = { authored: [], edited: [] };
            userProjects[p.editorName].edited.push(p);
        }
    });

    reportHTML += `
        <div class="report-section">
            <h2>👥 Team Workload & Status</h2>
            <div class="user-workload-grid">
            ${Object.keys(userProjects).sort().map(name => {
                const data = userProjects[name];
                const authoredProjects = data.authored;
                const editedProjects = data.edited;
                return `
                    <div class="user-card">
                        <div class="user-card-header">
                            <div class="user-avatar" style="background:${stringToColor(name)}">${name.charAt(0)}</div>
                            <div class="user-card-name">${name}</div>
                            <div class="user-card-stats">
                                <span><strong>${authoredProjects.length}</strong> Authored</span>
                                <span><strong>${editedProjects.length}</strong> Edited</span>
                            </div>
                        </div>
                        <div class="user-card-body">
                            ${authoredProjects.length > 0 ? '<h4>Authored Projects:</h4>' + authoredProjects.map(p => {
                                const state = getProjectState(p);
                                return `<div class="report-item mini" data-id="${p.id}"><span class="status-dot ${state.color}"></span><span>${p.title}</span><span class="meta">${state.statusText}</span></div>`
                            }).join('') : ''}
                             ${editedProjects.length > 0 ? '<h4>Edited Projects:</h4>' + editedProjects.map(p => {
                                const state = getProjectState(p);
                                return `<div class="report-item mini" data-id="${p.id}"><span class="status-dot ${state.color}"></span><span>${p.title}</span><span class="meta">${state.statusText}</span></div>`
                            }).join('') : ''}
                        </div>
                    </div>
                `
            }).join('')}
            </div>
        </div>
    `;


    reportHTML += '</div>';
    reportContent.innerHTML = reportHTML;

    // Add event listeners to make report items clickable
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
