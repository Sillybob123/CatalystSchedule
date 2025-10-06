// ===============================
// Catalyst Tracker - COMPLETE FIXED Dashboard JS
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
let allProjects = [], allEditors = [], allTasks = [], allUsers = [];
let currentlyViewedProjectId = null, currentlyViewedTaskId = null;
let currentView = 'interviews';
let calendarDate = new Date();

// ==================
//  Multi-Select State & Functions
// ==================
let selectedAssignees = [];
let filteredUsers = [];
let isDropdownOpen = false;

function initializeMultiSelect() {
    selectedAssignees = [];
    filteredUsers = [...allUsers];
    isDropdownOpen = false;
    
    renderSelectedAssignees();
    renderDropdownOptions();
    setupMultiSelectListeners();
    
    console.log('[MULTI-SELECT] Initialized with', allUsers.length, 'users');
}

function setupMultiSelectListeners() {
    const container = document.getElementById('multi-select-container');
    const searchInput = document.getElementById('assignee-search');
    const header = document.getElementById('multi-select-header');
    const indicator = document.getElementById('dropdown-indicator');
    
    if (!container || !searchInput || !header || !indicator) {
        console.error('[MULTI-SELECT] Required elements not found');
        return;
    }
    
    // Remove all existing event listeners by cloning
    const newContainer = container.cloneNode(true);
    container.parentNode.replaceChild(newContainer, container);
    
    // Get fresh references
    const freshContainer = document.getElementById('multi-select-container');
    const freshSearch = document.getElementById('assignee-search');
    const freshHeader = document.getElementById('multi-select-header');
    const freshIndicator = document.getElementById('dropdown-indicator');
    
    // Search input handlers
    freshSearch.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        filterUsers(searchTerm);
        if (!isDropdownOpen) openDropdown();
    });
    
    freshSearch.addEventListener('focus', () => {
        openDropdown();
    });
    
    freshSearch.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeDropdown();
            e.target.blur();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (filteredUsers.length > 0) {
                const firstUnselected = filteredUsers.find(user => 
                    !selectedAssignees.some(selected => selected.id === user.id)
                );
                if (firstUnselected) {
                    toggleAssignee(firstUnselected.id);
                    e.target.value = '';
                    filterUsers('');
                }
            }
        } else if (e.key === 'Backspace' && e.target.value === '' && selectedAssignees.length > 0) {
            const lastAssignee = selectedAssignees[selectedAssignees.length - 1];
            removeAssignee(lastAssignee.id);
        }
    });
    
    // Container click handler
    freshHeader.addEventListener('click', (e) => {
        if (!e.target.closest('.remove-assignee') && !e.target.closest('.dropdown-indicator')) {
            freshSearch.focus();
            if (!isDropdownOpen) openDropdown();
        }
    });
    
    // Dropdown indicator
    freshIndicator.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDropdown();
        if (isDropdownOpen) freshSearch.focus();
    });
    
    // Close dropdown when clicking outside
    const handleOutsideClick = (e) => {
        if (freshContainer && !freshContainer.contains(e.target)) {
            closeDropdown();
        }
    };
    
    document.removeEventListener('click', handleOutsideClick);
    document.addEventListener('click', handleOutsideClick);
}

function openDropdown() {
    isDropdownOpen = true;
    const container = document.getElementById('multi-select-container');
    const dropdown = document.getElementById('assignee-dropdown');
    
    if (container && dropdown) {
        container.classList.add('open');
        dropdown.classList.add('show');
    }
}

function closeDropdown() {
    isDropdownOpen = false;
    const container = document.getElementById('multi-select-container');
    const dropdown = document.getElementById('assignee-dropdown');
    
    if (container && dropdown) {
        container.classList.remove('open');
        dropdown.classList.remove('show');
    }
}

function toggleDropdown() {
    if (isDropdownOpen) {
        closeDropdown();
    } else {
        openDropdown();
    }
}

function filterUsers(searchTerm) {
    if (!searchTerm.trim()) {
        filteredUsers = [...allUsers];
    } else {
        filteredUsers = allUsers.filter(user =>
            user.name.toLowerCase().includes(searchTerm) ||
            (user.role && user.role.toLowerCase().includes(searchTerm)) ||
            (user.email && user.email.toLowerCase().includes(searchTerm))
        );
    }
    renderDropdownOptions();
}

function toggleAssignee(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;

    const existingIndex = selectedAssignees.findIndex(selected => selected.id === userId);
    
    if (existingIndex > -1) {
        selectedAssignees.splice(existingIndex, 1);
    } else {
        selectedAssignees.push(user);
    }

    renderSelectedAssignees();
    renderDropdownOptions();
    updateSelectionCounter();
}

function removeAssignee(userId) {
    selectedAssignees = selectedAssignees.filter(user => user.id !== userId);
    renderSelectedAssignees();
    renderDropdownOptions();
    updateSelectionCounter();
}

function renderSelectedAssignees() {
    const container = document.getElementById('selected-assignees');
    if (!container) return;
    
    if (selectedAssignees.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = selectedAssignees.map(user => `
        <div class="assignee-tag" data-user-id="${user.id}">
            <div class="assignee-avatar" style="background-color: ${stringToColor(user.name)}">
                ${user.name.charAt(0).toUpperCase()}
            </div>
            <span>${escapeHtml(user.name)}</span>
            <div class="remove-assignee" onclick="removeAssignee('${user.id}')" title="Remove ${escapeHtml(user.name)}">
                ×
            </div>
        </div>
    `).join('');
}

function renderDropdownOptions() {
    const dropdown = document.getElementById('assignee-dropdown');
    if (!dropdown) return;
    
    if (filteredUsers.length === 0) {
        dropdown.innerHTML = '<div class="no-results">No team members found</div>';
        return;
    }

    dropdown.innerHTML = filteredUsers.map(user => {
        const isSelected = selectedAssignees.some(selected => selected.id === user.id);
        return `
            <div class="assignee-item ${isSelected ? 'selected' : ''}" 
                 onclick="toggleAssignee('${user.id}')"
                 data-user-id="${user.id}"
                 tabindex="0">
                <div class="user-avatar" style="background-color: ${stringToColor(user.name)}">
                    ${user.name.charAt(0).toUpperCase()}
                </div>
                <div class="assignee-info">
                    <div class="assignee-name">${escapeHtml(user.name)}</div>
                    <div class="assignee-role">${escapeHtml(user.role || 'member')}</div>
                </div>
                <div class="assignee-status">available</div>
            </div>
        `;
    }).join('');
}

function updateSelectionCounter() {
    const counter = document.getElementById('selection-counter');
    if (!counter) return;
    
    if (selectedAssignees.length > 0) {
        counter.textContent = selectedAssignees.length;
        counter.classList.add('show');
    } else {
        counter.classList.remove('show');
    }
}

// Make functions globally available
window.toggleAssignee = toggleAssignee;
window.removeAssignee = removeAssignee;

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
        await fetchAllUsers();
        setupUI();
        setupNavAndListeners();
        subscribeToProjects();
        subscribeToTasks();

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

async function fetchAllUsers() {
    try {
        console.log("[INIT] Fetching all users...");
        const usersSnapshot = await db.collection('users').get();
        allUsers = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("[INIT] Found", allUsers.length, "users");
    } catch (error) {
        console.error("Error fetching users:", error);
        allUsers = [];
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
    
    // Navigation handling
    document.querySelectorAll('.nav-item').forEach(link => {
        link.addEventListener('click', e => {
            const href = link.getAttribute('href');
            if (href && href !== '#') {
                return; // Let normal navigation happen
            }
            
            e.preventDefault();
            const view = link.id.replace('nav-', '');
            handleNavClick(view);
        });
    });

    // Modal and form listeners
    document.getElementById('add-project-button').addEventListener('click', openProjectModal);
    document.getElementById('add-task-button').addEventListener('click', openTaskModal);
    document.getElementById('project-form').addEventListener('submit', handleProjectFormSubmit);
    document.getElementById('task-form').addEventListener('submit', handleTaskFormSubmit);
    
    // Status report button
    const statusReportBtn = document.getElementById('status-report-button');
    if (statusReportBtn) {
        statusReportBtn.addEventListener('click', generateStatusReport);
    }
    
    // Project modal listeners
    document.getElementById('add-comment-button').addEventListener('click', handleAddComment);
    document.getElementById('assign-editor-button').addEventListener('click', handleAssignEditor);
    document.getElementById('delete-project-button').addEventListener('click', handleDeleteProject);
    document.getElementById('approve-button').addEventListener('click', () => approveProposal(currentlyViewedProjectId));
    document.getElementById('reject-button').addEventListener('click', () => updateProposalStatus('rejected'));

    // Task modal listeners
    document.getElementById('add-task-comment-button').addEventListener('click', handleAddTaskComment);
    document.getElementById('approve-task-button').addEventListener('click', () => updateTaskStatus('approved'));
    document.getElementById('reject-task-button').addEventListener('click', () => updateTaskStatus('rejected'));
    document.getElementById('complete-task-button').addEventListener('click', () => updateTaskStatus('completed'));
    document.getElementById('request-extension-button').addEventListener('click', handleRequestExtension);
    document.getElementById('delete-task-button').addEventListener('click', handleDeleteTask);

    // Calendar listeners
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
    const setDeadlinesBtn = document.getElementById('set-deadlines-button');
    const requestDeadlineChangeBtn = document.getElementById('request-deadline-change-button');

    if (setDeadlinesBtn) setDeadlinesBtn.addEventListener('click', handleSetDeadlines);
    if (requestDeadlineChangeBtn) requestDeadlineChangeBtn.addEventListener('click', handleRequestDeadlineChange);

    // Modal close listeners
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        // Remove any existing listeners first
        const newModal = modal.cloneNode(true);
        modal.parentNode.replaceChild(newModal, modal);
    });
    
    // Re-attach listeners to fresh modals
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', e => {
            // Only close if clicking directly on overlay or close button
            if (e.target === modal || e.target.classList.contains('close-button')) {
                e.preventDefault();
                e.stopPropagation();
                closeAllModals();
            }
        });
        
        // Close button handler
        const closeButtons = modal.querySelectorAll('.close-button');
        closeButtons.forEach(btn => {
            btn.addEventListener('click', e => {
                e.preventDefault();
                e.stopPropagation();
                closeAllModals();
            });
        });
    });
    
    setupCalendarListeners();
    setupCalendarKeyboardNavigation();
}

// ==================
//  View Management
// ==================
function handleNavClick(view) {
    if (view === 'dashboard') {
        view = 'interviews'; // Default to interviews view
    }
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
        'dashboard': 'Catalyst in the Capital',
        'my-assignments': 'My Assignments',
        'interviews': 'Catalyst in the Capital',
        'opeds': 'Op-Eds',
        'calendar': 'Deadlines Calendar',
        'tasks': 'Task Management'
    };
    document.getElementById('board-title').textContent = viewTitles[view] || view;
    
    // Show/hide appropriate buttons
    const addProjectBtn = document.getElementById('add-project-button');
    const addTaskBtn = document.getElementById('add-task-button');
    
    if (view === 'tasks') {
        addProjectBtn.style.display = 'none';
        addTaskBtn.style.display = 'inline-flex';
    } else {
        addProjectBtn.style.display = 'inline-flex';
        addTaskBtn.style.display = 'none';
    }
    
    renderCurrentViewEnhanced();
}

function renderCurrentViewEnhanced() {
    const boardView = document.getElementById('board-view');
    const tasksView = document.getElementById('tasks-view');
    const calendarView = document.getElementById('calendar-view');

    // Hide all views first
    boardView.style.display = 'none';
    tasksView.style.display = 'none';
    calendarView.style.display = 'none';

    if (currentView === 'calendar') {
        calendarView.style.display = 'block';
        setupCalendarListeners();
        renderCalendar();
    } else if (currentView === 'tasks') {
        tasksView.style.display = 'block';
        renderTasksBoard(allTasks);
    } else {
        boardView.style.display = 'block';
        renderKanbanBoard(filterProjects());
    }
}

// ==================
//  Data Handling
// ==================
function subscribeToProjects() {
    console.log("[FIREBASE] Setting up projects subscription...");
    
    db.collection('projects').onSnapshot(snapshot => {
        console.log('[FIREBASE] Projects snapshot received, count:', snapshot.docs.length);
        console.log('[FIREBASE] Current view:', currentView);
        
        allProjects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (currentView !== 'tasks') {
            renderCurrentViewEnhanced();
        }
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

function subscribeToTasks() {
    console.log("[FIREBASE] Setting up tasks subscription...");
    
    db.collection('tasks').onSnapshot(snapshot => {
        console.log("[FIREBASE] Tasks updated, processing...");
        
        allTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (currentView === 'tasks') {
            renderTasksBoard(allTasks);
        }
        updateNavCounts();

        if (currentlyViewedTaskId) {
            const task = allTasks.find(t => t.id === currentlyViewedTaskId);
            if (task) {
                refreshTaskDetailsModal(task);
            } else {
                closeAllModals();
            }
        }
    }, error => {
        console.error("[FIREBASE ERROR] Tasks subscription failed:", error);
    });
}

function updateNavCounts() {
    const myAssignmentsProjects = allProjects.filter(p => {
        return p.authorId === currentUser.uid || p.editorId === currentUser.uid;
    }).length;
    
    const myAssignmentsTasks = allTasks.filter(t => {
        return t.creatorId === currentUser.uid || isUserAssignedToTask(t, currentUser.uid);
    }).length;
    
    const totalAssignments = myAssignmentsProjects + myAssignmentsTasks;
    
    const navLink = document.querySelector('#nav-my-assignments span');
    if (navLink) {
        navLink.textContent = `My Assignments (${totalAssignments})`;
    }
}

// ==================
//  Task Management
// ==================
function openTaskModal() {
    // Reset form and state
    document.getElementById('task-form').reset();
    selectedAssignees = [];
    filteredUsers = [...allUsers];
    isDropdownOpen = false;
    
    // Initialize multi-select
    initializeMultiSelect();
    
    // Set default deadline to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('task-deadline').value = tomorrow.toISOString().split('T')[0];
    
    // Show modal
    document.getElementById('task-modal').style.display = 'flex';
    
    // Focus first input after animation
    setTimeout(() => {
        document.getElementById('task-title').focus();
    }, 100);
}

function initializeMultiSelect() {
    filteredUsers = [...allUsers];
    renderSelectedAssignees();
    renderDropdownOptions();
    setupMultiSelectListeners();
    
    console.log('[MULTI-SELECT] Initialized with', allUsers.length, 'users');
}

function setupMultiSelectListeners() {
    const container = document.getElementById('multi-select-container');
    const searchInput = document.getElementById('assignee-search');
    const dropdown = document.getElementById('assignee-dropdown');
    const indicator = document.getElementById('dropdown-indicator');
    
    if (!container || !searchInput || !dropdown || !indicator) {
        console.error('[MULTI-SELECT] Required elements not found');
        return;
    }
    
    // Remove existing listeners to prevent duplicates
    const newContainer = container.cloneNode(true);
    container.parentNode.replaceChild(newContainer, container);
    
    // Get fresh references
    const freshContainer = document.getElementById('multi-select-container');
    const freshSearch = document.getElementById('assignee-search');
    const freshIndicator = document.getElementById('dropdown-indicator');
    
    // Search input events
    freshSearch.addEventListener('input', handleSearchInput);
    freshSearch.addEventListener('focus', () => openDropdown());
    freshSearch.addEventListener('keydown', handleSearchKeydown);
    
    // Container click events
    freshContainer.addEventListener('click', (e) => {
        if (e.target === freshContainer || e.target.closest('.multi-select-header')) {
            freshSearch.focus();
            if (!isDropdownOpen) openDropdown();
        }
    });
    
    // Dropdown indicator
    freshIndicator.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDropdown();
        if (isDropdownOpen) freshSearch.focus();
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', handleOutsideClick);
    
    console.log('[MULTI-SELECT] Event listeners attached');
}

function handleSearchInput(e) {
    const searchTerm = e.target.value.toLowerCase();
    filterUsers(searchTerm);
    if (!isDropdownOpen) openDropdown();
}

function handleSearchKeydown(e) {
    switch (e.key) {
        case 'Escape':
            closeDropdown();
            e.target.blur();
            break;
        case 'Enter':
            e.preventDefault();
            if (filteredUsers.length > 0) {
                const firstUnselected = filteredUsers.find(user => 
                    !selectedAssignees.some(selected => selected.id === user.id)
                );
                if (firstUnselected) {
                    toggleAssignee(firstUnselected.id);
                    e.target.value = '';
                    filterUsers('');
                }
            }
            break;
        case 'Backspace':
            if (e.target.value === '' && selectedAssignees.length > 0) {
                const lastAssignee = selectedAssignees[selectedAssignees.length - 1];
                removeAssignee(lastAssignee.id);
            }
            break;
    }
}

function handleOutsideClick(e) {
    const container = document.getElementById('multi-select-container');
    if (container && !container.contains(e.target)) {
        closeDropdown();
    }
}

function openDropdown() {
    isDropdownOpen = true;
    updateDropdownState();
}

function closeDropdown() {
    isDropdownOpen = false;
    updateDropdownState();
}

function toggleDropdown() {
    isDropdownOpen = !isDropdownOpen;
    updateDropdownState();
}

function updateDropdownState() {
    const container = document.getElementById('multi-select-container');
    const dropdown = document.getElementById('assignee-dropdown');
    
    if (container && dropdown) {
        container.classList.toggle('open', isDropdownOpen);
        dropdown.classList.toggle('show', isDropdownOpen);
    }
}

function filterUsers(searchTerm) {
    if (!searchTerm.trim()) {
        filteredUsers = [...allUsers];
    } else {
        filteredUsers = allUsers.filter(user =>
            user.name.toLowerCase().includes(searchTerm) ||
            (user.role && user.role.toLowerCase().includes(searchTerm)) ||
            (user.email && user.email.toLowerCase().includes(searchTerm))
        );
    }
    renderDropdownOptions();
}

function toggleAssignee(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) {
        console.error('[MULTI-SELECT] User not found:', userId);
        return;
    }

    const existingIndex = selectedAssignees.findIndex(selected => selected.id === userId);
    
    if (existingIndex > -1) {
        selectedAssignees.splice(existingIndex, 1);
        console.log('[MULTI-SELECT] Removed assignee:', user.name);
    } else {
        selectedAssignees.push(user);
        console.log('[MULTI-SELECT] Added assignee:', user.name);
    }

    renderSelectedAssignees();
    renderDropdownOptions();
}

function removeAssignee(userId) {
    selectedAssignees = selectedAssignees.filter(user => user.id !== userId);
    renderSelectedAssignees();
    renderDropdownOptions();
    
    const user = allUsers.find(u => u.id === userId);
    console.log('[MULTI-SELECT] Removed assignee:', user?.name);
}

function renderSelectedAssignees() {
    const container = document.getElementById('selected-assignees');
    if (!container) return;
    
    if (selectedAssignees.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = selectedAssignees.map(user => `
        <div class="assignee-tag" data-user-id="${user.id}">
            <div class="assignee-avatar" style="background-color: ${stringToColor(user.name)}">
                ${user.name.charAt(0).toUpperCase()}
            </div>
            <span>${escapeHtml(user.name)}</span>
            <div class="remove-assignee" onclick="removeAssignee('${user.id}')" title="Remove ${escapeHtml(user.name)}">
                ×
            </div>
        </div>
    `).join('');
}

function renderDropdownOptions() {
    const dropdown = document.getElementById('assignee-dropdown');
    if (!dropdown) return;
    
    if (filteredUsers.length === 0) {
        dropdown.innerHTML = '<div class="no-results">No team members found</div>';
        return;
    }

    dropdown.innerHTML = filteredUsers.map(user => {
        const isSelected = selectedAssignees.some(selected => selected.id === user.id);
        return `
            <div class="assignee-item ${isSelected ? 'selected' : ''}" 
                 onclick="toggleAssignee('${user.id}')"
                 data-user-id="${user.id}"
                 tabindex="0">
                <div class="user-avatar" style="background-color: ${stringToColor(user.name)}">
                    ${user.name.charAt(0).toUpperCase()}
                </div>
                <div class="assignee-info">
                    <div class="assignee-name">${escapeHtml(user.name)}</div>
                    <div class="assignee-role">${escapeHtml(user.role || 'member')}</div>
                </div>
                <div class="assignee-status">available</div>
            </div>
        `;
    }).join('');
}

async function handleTaskFormSubmit(e) {
    e.preventDefault();
    
    const submitButton = document.getElementById('save-task-button');
    const originalText = submitButton.textContent;
    
    try {
        // Validate form
        const title = document.getElementById('task-title').value.trim();
        const deadline = document.getElementById('task-deadline').value;
        
        const errors = [];
        
        if (!title || title.length < 3) {
            errors.push('Task title must be at least 3 characters long');
        }
        
        if (selectedAssignees.length === 0) {
            errors.push('Please select at least one person to assign this task to');
        }
        
        if (!deadline) {
            errors.push('Please set a deadline for this task');
        }
        
        if (errors.length > 0) {
            showNotification(errors.join('. '), 'error');
            return;
        }
        
        // Show loading state
        submitButton.disabled = true;
        submitButton.classList.add('loading');
        submitButton.textContent = 'Creating Task...';
        
        // Get form values
        const description = document.getElementById('task-description').value.trim();
        const priority = document.getElementById('task-priority').value || 'medium';
        
        // Prepare assignee data
        const assigneeIds = selectedAssignees.map(u => u.id);
        const assigneeNames = selectedAssignees.map(u => u.name);
        
        const newTask = {
            title: title,
            description: description || null,
            // Multiple assignees (new format)
            assigneeIds: assigneeIds,
            assigneeNames: assigneeNames,
            // Single assignee (backwards compatibility)
            assigneeId: assigneeIds[0],
            assigneeName: assigneeNames[0],
            deadline: deadline,
            priority: priority,
            creatorId: currentUser.uid,
            creatorName: currentUserName,
            status: 'pending',
            createdAt: new Date(),
            activity: [{
                text: assigneeIds.length === 1 ? 
                    `created this task and assigned it to ${assigneeNames[0]}` :
                    `created this task and assigned it to ${assigneeNames.join(', ')}`,
                authorName: currentUserName,
                timestamp: new Date()
            }]
        };
        
        console.log('[TASK CREATE] Creating task:', newTask);
        
        await db.collection('tasks').add(newTask);
        
        showNotification(`Task assigned to ${assigneeNames.join(', ')} successfully!`, 'success');
        closeAllModals();
        
        // Reset form and state
        document.getElementById('task-form').reset();
        selectedAssignees = [];
        
    } catch (error) {
        console.error("[ERROR] Failed to create task:", error);
        showNotification(error.message || 'Failed to create task. Please try again.', 'error');
    } finally {
        // Reset button state
        submitButton.disabled = false;
        submitButton.classList.remove('loading');
        submitButton.textContent = originalText;
    }
}

function renderTasksBoard(tasks) {
    console.log(`[RENDER] Rendering ${tasks.length} tasks`);
    const board = document.getElementById('tasks-board');
    board.innerHTML = '';
    
    const columns = [
        { id: 'pending', title: 'Pending Approval', icon: '⏳', color: '#f59e0b' },
        { id: 'approved', title: 'Approved', icon: '✅', color: '#10b981' },
        { id: 'in_progress', title: 'In Progress', icon: '🔄', color: '#3b82f6' },
        { id: 'completed', title: 'Completed', icon: '🎉', color: '#8b5cf6' }
    ];
    
    columns.forEach((column) => {
        const columnTasks = tasks.filter(task => getTaskColumn(task) === column.id);

        const columnEl = document.createElement('div');
        columnEl.className = 'kanban-column';
        columnEl.style.setProperty('--column-accent', column.color);
        
        columnEl.innerHTML = `
            <div class="column-header">
                <div class="column-title">
                    <div class="column-title-main">
                        <span class="column-icon">${column.icon}</span>
                        <span class="column-title-text">${column.title}</span>
                    </div>
                    <span class="task-count">${columnTasks.length}</span>
                </div>
            </div>
            <div class="column-content">
                <div class="kanban-cards"></div>
            </div>
        `;
        
        const cardsContainer = columnEl.querySelector('.kanban-cards');
        
        if (columnTasks.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-column';
            emptyState.innerHTML = `
                <div class="empty-column-icon">${column.icon}</div>
                <div class="empty-column-text">No ${column.title.toLowerCase()}</div>
                <div class="empty-column-subtext">Tasks will appear here when they reach this stage</div>
            `;
            cardsContainer.appendChild(emptyState);
        } else {
            columnTasks.forEach(task => {
                cardsContainer.appendChild(createTaskCard(task));
            });
        }
        
        board.appendChild(columnEl);
    });
}

function getTaskColumn(task) {
    if (task.status === 'completed') return 'completed';
    if (task.status === 'rejected') return 'pending';
    if (task.status === 'approved') {
        if (task.activity && task.activity.some(a => 
            a.text.includes('started working') || 
            a.text.includes('in progress') ||
            a.text.includes('commented:')
        )) {
            return 'in_progress';
        }
        return 'approved';
    }
    return 'pending';
}

function createTaskCard(task) {
    const card = document.createElement('div');
    card.className = 'kanban-card';
    card.classList.add(`priority-${task.priority || 'medium'}`);
    card.dataset.id = task.id;
    card.dataset.type = 'task';
    
    const isOverdue = new Date(task.deadline) < new Date() && task.status !== 'completed';
    const isDueSoon = !isOverdue && new Date(task.deadline) < new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    
    if (isOverdue) card.classList.add('overdue');
    if (isDueSoon) card.classList.add('due-soon');
    
    const deadline = new Date(task.deadline);
    const deadlineText = deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    const priorityColors = {
        urgent: '#dc2626',
        high: '#ea580c',
        medium: '#f59e0b',
        low: '#059669'
    };
    
    const priorityColor = priorityColors[task.priority] || priorityColors.medium;
    
    // Handle multiple assignees
    const assigneeNames = getTaskAssigneeNames(task);
    let displayNames = assigneeNames.join(', ');
    let multipleIndicator = '';
    
    if (assigneeNames.length > 2) {
        displayNames = `${assigneeNames.slice(0, 2).join(', ')} +${assigneeNames.length - 2} more`;
        multipleIndicator = `<span class="multiple-assignees-indicator">+${assigneeNames.length}</span>`;
    } else if (assigneeNames.length > 1) {
        multipleIndicator = `<span class="multiple-assignees-indicator">+${assigneeNames.length}</span>`;
    }
    
    card.innerHTML = `
        <h4 class="card-title">${escapeHtml(task.title)}</h4>
        <div class="card-meta">
            <div class="priority-badge ${task.priority || 'medium'}" style="background-color: ${priorityColor}; color: white;">
                ${(task.priority || 'medium').toUpperCase()}
            </div>
            <div class="status-badge ${task.status || 'pending'}">
                ${(task.status || 'pending').replace('_', ' ')}
            </div>
            ${multipleIndicator}
        </div>
        ${task.description ? `<div class="card-content-preview">${escapeHtml(task.description.substring(0, 100))}${task.description.length > 100 ? '...' : ''}</div>` : ''}
        <div class="card-footer">
            <div class="card-author">
                <div class="user-avatar" style="background-color: ${stringToColor(task.creatorName)}">
                    ${task.creatorName.charAt(0).toUpperCase()}
                </div>
                <span title="Assigned to: ${assigneeNames.join(', ')}">→ ${escapeHtml(displayNames)}</span>
            </div>
            <div class="card-deadline ${isOverdue ? 'overdue' : isDueSoon ? 'due-today' : ''}">
                ${deadlineText}
            </div>
        </div>
        <div class="priority-indicator" style="background: ${priorityColor}; color: white; padding: 2px 8px; border-radius: 8px; font-size: 10px; font-weight: 600; margin-top: 8px; text-align: center;">
            ${(task.priority || 'medium').toUpperCase()} PRIORITY
        </div>
    `;
    
    // Prevent event bubbling issues
    card.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('[CARD CLICK] Opening task:', task.id);
        openTaskDetailsModal(task.id);
    });
    
    return card;
}

function openTaskDetailsModal(taskId) {
    console.log('[MODAL] Opening task details for:', taskId);
    
    const task = allTasks.find(t => t.id === taskId);
    if (!task) {
        console.error('[MODAL] Task not found:', taskId);
        showNotification('Task not found. Please refresh the page.', 'error');
        return;
    }
    
    // CRITICAL: Ensure all modals are completely closed first
    closeAllModals();
    
    // Wait a brief moment to ensure close is complete
    setTimeout(() => {
        console.log('[MODAL] Setting up task modal for:', task.title);
        currentlyViewedTaskId = taskId;
        
        const modal = document.getElementById('task-details-modal');
        if (!modal) {
            console.error('[MODAL] Task modal element not found');
            return;
        }
        
        const content = modal.querySelector('.details-container');
        
        // Force reset the content state
        if (content) {
            content.style.opacity = '0';
            content.style.transition = 'none';
            content.style.display = 'flex'; // Ensure it's visible
        }
        
        // Show modal
        modal.style.display = 'flex';
        
        // Force a reflow to ensure styles are applied
        void modal.offsetHeight;
        
        // Populate content immediately
        refreshTaskDetailsModal(task);
        
        // Re-enable transition and fade in
        requestAnimationFrame(() => {
            if (content) {
                content.style.transition = 'opacity 0.2s ease-in-out';
                content.style.opacity = '1';
            }
        });
        
        console.log('[MODAL] Task modal opened successfully');
    }, 100); // Small delay to ensure clean state
}

function refreshTaskDetailsModal(task) {
    console.log('[MODAL REFRESH] Refreshing task details for:', task.title);
    
    // Ensure all elements exist before populating
    const titleEl = document.getElementById('task-details-title');
    const descEl = document.getElementById('task-details-description');
    const statusEl = document.getElementById('task-details-status');
    const creatorEl = document.getElementById('task-details-creator');
    const assigneeEl = document.getElementById('task-details-assignee');
    const createdEl = document.getElementById('task-details-created');
    const deadlineEl = document.getElementById('task-details-deadline');
    const priorityEl = document.getElementById('task-details-priority');
    
    if (!titleEl || !descEl || !statusEl || !creatorEl || !assigneeEl || !createdEl || !deadlineEl || !priorityEl) {
        console.error('[MODAL REFRESH] Required task elements not found in DOM');
        return;
    }
    
    titleEl.textContent = task.title;
    descEl.textContent = task.description || 'No description provided.';
    statusEl.textContent = (task.status || 'pending').replace('_', ' ').toUpperCase();
    creatorEl.textContent = task.creatorName;
    
    // Handle multiple assignees in details
    const assigneeElement = document.getElementById('task-details-assignee');
    const assigneeNames = getTaskAssigneeNames(task);
    
    if (assigneeNames.length > 1) {
        assigneeElement.innerHTML = assigneeNames.map(name => 
            `<span class="task-assignee-badge">${escapeHtml(name)}</span>`
        ).join(' ');
    } else {
        assigneeElement.textContent = assigneeNames[0] || 'Not assigned';
    }
    
    const createdDate = task.createdAt ? new Date(task.createdAt.seconds * 1000) : new Date();
    const deadlineDate = new Date(task.deadline);
    
    document.getElementById('task-details-created').textContent = createdDate.toLocaleDateString('en-US', { 
        year: 'numeric', month: 'long', day: 'numeric' 
    });
    document.getElementById('task-details-deadline').textContent = deadlineDate.toLocaleDateString('en-US', { 
        year: 'numeric', month: 'long', day: 'numeric' 
    });
    document.getElementById('task-details-priority').textContent = (task.priority || 'medium').toUpperCase();
    
    // Permissions
    const isAdmin = currentUserRole === 'admin';
    const isCreator = currentUser.uid === task.creatorId;
    const isAssignee = isUserAssignedToTask(task, currentUser.uid);
    
    const adminSection = document.getElementById('task-admin-approval-section');
    if (adminSection) {
        adminSection.style.display = isAdmin && task.status === 'pending' ? 'block' : 'none';
    }
    
    const assigneeActions = document.getElementById('task-assignee-actions');
    if (assigneeActions) {
        assigneeActions.style.display = isAssignee && task.status === 'approved' ? 'block' : 'none';
    }
    
    const deleteButton = document.getElementById('delete-task-button');
    if (deleteButton) {
        deleteButton.style.display = (isAdmin || isCreator) ? 'block' : 'none';
    }
    
    renderTaskActivityFeed(task.activity || []);
}

function renderTaskActivityFeed(activity) {
    const feed = document.getElementById('task-details-activity-feed');
    if (!feed) return;
    
    feed.innerHTML = '';
    
    if (!activity || activity.length === 0) {
        feed.innerHTML = '<p>No activity yet.</p>';
        return;
    }
    
    const sortedActivity = [...activity].sort((a, b) => {
        const aTime = a.timestamp?.seconds || 0;
        const bTime = b.timestamp?.seconds || 0;
        return bTime - aTime;
    });
    
    sortedActivity.forEach(item => {
        const timestamp = item.timestamp?.seconds ? 
            new Date(item.timestamp.seconds * 1000).toLocaleString() : 
            'Unknown time';
        
        feed.innerHTML += `
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

async function updateTaskStatus(newStatus) {
    if (!currentlyViewedTaskId) {
        console.error('[TASK STATUS] No task ID set');
        showNotification('No task selected. Please try again.', 'error');
        return;
    }
    
    console.log(`[TASK STATUS] Updating task ${currentlyViewedTaskId} to status: ${newStatus}`);
    
    try {
        // Prepare the update object
        const updates = {
            status: newStatus,
            updatedAt: new Date()
        };
        
        // Add completion timestamp if completing
        if (newStatus === 'completed') {
            updates.completedAt = new Date();
        }
        
        // Prepare activity entry
        const activityEntry = {
            text: `marked task as ${newStatus.replace('_', ' ')}`,
            authorName: currentUserName,
            timestamp: new Date()
        };
        
        console.log('[TASK STATUS] Applying updates:', updates);
        console.log('[TASK STATUS] Adding activity:', activityEntry);
        
        // Update the document with both status and activity
        await db.collection('tasks').doc(currentlyViewedTaskId).update({
            ...updates,
            activity: window.firebase.firestore.FieldValue.arrayUnion(activityEntry)
        });
        
        console.log('[TASK STATUS] Update successful');
        showNotification(`Task ${newStatus.replace('_', ' ')} successfully!`, 'success');
        
    } catch (error) {
        console.error(`[TASK STATUS ERROR] Failed to update task status:`, error);
        let errorMessage = 'Failed to update task. ';
        if (error.code === 'permission-denied') {
            errorMessage += 'You do not have permission to update this task.';
        } else if (error.code === 'not-found') {
            errorMessage += 'Task not found.';
        } else if (error.code === 'unavailable') {
            errorMessage += 'Service temporarily unavailable. Please try again.';
        } else {
            errorMessage += 'Please try again or contact support if the problem persists.';
        }
        
        showNotification(errorMessage, 'error');
    }
}


async function handleAddTaskComment() {
    const commentInput = document.getElementById('task-comment-input');
    if (!commentInput || !currentlyViewedTaskId) return;
    
    const comment = commentInput.value.trim();
    if (!comment) {
        showNotification('Please enter a comment.', 'error');
        return;
    }
    
    try {
        await db.collection('tasks').doc(currentlyViewedTaskId).update({
            activity: firebase.firestore.FieldValue.arrayUnion({
                text: `commented: "${comment}"`,
                authorName: currentUserName,
                timestamp: new Date()
            })
        });
        
        commentInput.value = '';
        showNotification('Comment added successfully!', 'success');
        
    } catch (error) {
        console.error("[ERROR] Failed to add comment:", error);
        showNotification('Failed to add comment. Please try again.', 'error');
    }
}

async function handleRequestExtension() {
    if (!currentlyViewedTaskId) return;
    
    const newDate = prompt('Enter new deadline (YYYY-MM-DD format):');
    if (!newDate || !isValidDate(newDate)) {
        showNotification('Please enter a valid date in YYYY-MM-DD format.', 'error');
        return;
    }
    
    const reason = prompt('Please provide a reason for the extension:');
    if (!reason || !reason.trim()) {
        showNotification('Please provide a reason for the extension.', 'error');
        return;
    }
    
    try {
        await db.collection('tasks').doc(currentlyViewedTaskId).update({
            extensionRequest: {
                requestedBy: currentUserName,
                requestedDate: newDate,
                reason: reason.trim(),
                status: 'pending',
                requestedAt: new Date()
            },
            activity: firebase.firestore.FieldValue.arrayUnion({
                text: `requested deadline extension to ${new Date(newDate).toLocaleDateString()}. Reason: ${reason.trim()}`,
                authorName: currentUserName,
                timestamp: new Date()
            })
        });
        
        showNotification('Extension request submitted successfully!', 'success');
        
    } catch (error) {
        console.error("[ERROR] Failed to request extension:", error);
        showNotification('Failed to submit extension request. Please try again.', 'error');
    }
}

async function handleDeleteTask() {
    if (!currentlyViewedTaskId) return;
    
    const task = allTasks.find(t => t.id === currentlyViewedTaskId);
    if (!task) return;
    
    const isAdmin = currentUserRole === 'admin';
    const isCreator = currentUser.uid === task.creatorId;
    
    if (!isAdmin && !isCreator) {
        showNotification('You can only delete tasks you created.', 'error');
        return;
    }
    
    if (confirm(`Are you sure you want to delete "${task.title}"? This action cannot be undone.`)) {
        try {
            await db.collection('tasks').doc(currentlyViewedTaskId).delete();
            showNotification('Task deleted successfully!', 'success');
            closeAllModals();
        } catch (error) {
            console.error("[ERROR] Failed to delete task:", error);
            showNotification('Failed to delete task. Please try again.', 'error');
        }
    }
}

// ==================
//  Projects
// ==================
function openProjectModal() {
    document.getElementById('project-form').reset();
    document.getElementById('modal-title').textContent = 'Propose New Article';
    // Pre-select project type based on the current view
    const projectTypeSelect = document.getElementById('project-type');
    if (currentView === 'interviews') {
        projectTypeSelect.value = 'Interview';
    } else if (currentView === 'opeds') {
        projectTypeSelect.value = 'Op-Ed';
    }
    document.getElementById('project-modal').style.display = 'flex';
}

function openDetailsModal(projectId) {
    console.log('[MODAL] Opening project details for:', projectId);
    
    const project = allProjects.find(p => p.id === projectId);
    if (!project) {
        console.error('[MODAL] Project not found:', projectId);
        showNotification('Project not found. Please refresh the page.', 'error');
        return;
    }
    
    // CRITICAL: Ensure all modals are completely closed first
    closeAllModals();
    
    // Wait a brief moment to ensure close is complete
    setTimeout(() => {
        console.log('[MODAL] Setting up project modal for:', project.title);
        currentlyViewedProjectId = projectId;
        
        const modal = document.getElementById('details-modal');
        if (!modal) {
            console.error('[MODAL] Modal element not found');
            return;
        }
        
        const content = modal.querySelector('.details-container');
        
        // Force reset the content state
        if (content) {
            content.style.opacity = '0';
            content.style.transition = 'none';
            content.style.display = 'flex'; // Ensure it's visible
        }
        
        // Show modal
        modal.style.display = 'flex';
        
        // Force a reflow to ensure styles are applied
        void modal.offsetHeight;
        
        // Populate content immediately
        refreshDetailsModal(project);
        
        // Re-enable transition and fade in
        requestAnimationFrame(() => {
            if (content) {
                content.style.transition = 'opacity 0.2s ease-in-out';
                content.style.opacity = '1';
            }
        });
        
        console.log('[MODAL] Project modal opened successfully');
    }, 100); // Small delay to ensure clean state
}

function refreshDetailsModal(project) {
    console.log('[MODAL REFRESH] Refreshing project details for:', project.title);
    
    // Ensure all elements exist before populating
    const titleEl = document.getElementById('details-title');
    const authorEl = document.getElementById('details-author');
    const editorEl = document.getElementById('details-editor');
    const statusEl = document.getElementById('details-status');
    const deadlineEl = document.getElementById('details-publication-deadline');
    const proposalEl = document.getElementById('details-proposal');
    
    if (!titleEl || !authorEl || !editorEl || !statusEl || !deadlineEl || !proposalEl) {
        console.error('[MODAL REFRESH] Required elements not found in DOM');
        return;
    }
    
    const isAuthor = currentUser.uid === project.authorId;
    const isEditor = currentUser.uid === project.editorId;
    const isAdmin = currentUserRole === 'admin';
    
    // Set basic info
    titleEl.textContent = project.title;
    authorEl.textContent = project.authorName;
    editorEl.textContent = project.editorName || 'Not Assigned';
    
    const state = getProjectState(project, currentView, currentUser);
    statusEl.textContent = state.statusText;

    const finalDeadline = project.deadlines ? project.deadlines.publication : project.deadline;
    if (finalDeadline) {
        document.getElementById('details-publication-deadline').textContent = 
            new Date(finalDeadline + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } else {
        document.getElementById('details-publication-deadline').textContent = 'Not set';
    }
    
    const proposalElement = document.getElementById('details-proposal');
    proposalElement.textContent = project.proposal || 'No proposal provided.';
    
    const canEditProposal = isAuthor || isAdmin;
    const editBtn = document.getElementById('edit-proposal-button');
    if (editBtn) editBtn.style.display = canEditProposal ? 'inline-block' : 'none';

    const approvalSection = document.getElementById('admin-approval-section');
    if (approvalSection) {
        approvalSection.style.display = isAdmin && project.proposalStatus === 'pending' ? 'block' : 'none';
    }
    
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
    
    const deleteButton = document.getElementById('delete-project-button');
    if (deleteButton) {
        deleteButton.style.display = (isAuthor || isAdmin) ? 'block' : 'none';
    }
}

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
        if (project.type === 'Op-Ed' && (task === "Interview Scheduled" || task === "Interview Complete")) {
            return;
        }

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
        
        if (task === "Topic Proposal Complete") canEditTask = false;

        const completed = timeline[task] || false;
        const taskEl = document.createElement('div');
        taskEl.className = 'task';
        const taskId = `task-${project.id}-${task.replace(/\s+/g, '-')}`;
        taskEl.innerHTML = `
            <input type="checkbox" id="${taskId}" ${completed ? 'checked' : ''} ${!canEditTask ? 'disabled' : ''}>
            <label for="${taskId}">${task}</label>
        `;
        
        if (canEditTask) {
            taskEl.querySelector('input').addEventListener('change', async (e) => {
                await handleTaskCompletion(project.id, task, e.target.checked, db, currentUserName);
            });
        }
        
        timelineContainer.appendChild(taskEl);
    });
}

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

async function handleProjectFormSubmit(e) {
    e.preventDefault();
    
    // Get submit button reference for loading states
    const submitButton = document.getElementById('save-project-button');
    const originalText = submitButton.textContent;
    
    try {
        // Show loading state to user
        submitButton.disabled = true;
        submitButton.classList.add('loading');
        submitButton.textContent = 'Submitting...';
        
        // Build timeline tasks based on project type
        const type = document.getElementById('project-type').value;
        const timeline = {};
        const tasks = type === "Interview" 
            ? ["Topic Proposal Complete", "Interview Scheduled", "Interview Complete", 
               "Article Writing Complete", "Review In Progress", "Review Complete", "Suggestions Reviewed"] 
            : ["Topic Proposal Complete", "Article Writing Complete", 
               "Review In Progress", "Review Complete", "Suggestions Reviewed"];
        
        // Initialize all timeline tasks as incomplete
        tasks.forEach(task => timeline[task] = false);

        // ✅ FIX: Use new Date() instead of serverTimestamp in the activity array
        const newProject = {
            title: document.getElementById('project-title').value, 
            type: type,
            proposal: document.getElementById('project-proposal').value,
            deadline: document.getElementById('project-deadline').value,
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
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            // ✅ FIXED: Initialize with activity entry using new Date()
            activity: [{
                text: 'created the project.',
                authorName: currentUserName,
                timestamp: new Date() // ✅ Use new Date() instead of serverTimestamp()
            }]
        };
        
        console.log('[PROJECT CREATE] Creating project:', newProject);

        // ✅ SIMPLIFIED: Create the document with activity included - ONE operation instead of two
        await db.collection('projects').add(newProject);
        
        console.log('[PROJECT CREATE] Project created successfully');
        
        // Show success message and close modal
        showNotification('Project proposal submitted successfully!', 'success');
        closeAllModals();
        
    } catch (error) {
        // Log detailed error information
        console.error("[PROJECT ERROR] Failed to create project:", error);
        console.error("[PROJECT ERROR] Error code:", error.code);
        console.error("[PROJECT ERROR] Error message:", error.message);
        
        // Show user-friendly error message
        showNotification(`Failed to create project: ${error.message}`, 'error');
        
    } finally {
        // ALWAYS reset button state, even if there was an error
        submitButton.disabled = false;
        submitButton.classList.remove('loading');
        submitButton.textContent = originalText;
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
            const state = getProjectState(project, currentView, currentUser);
            return state.column === columnTitle;
        });

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
    console.log('[FILTER] Filtering projects for view:', currentView);
    switch (currentView) {
        case 'dashboard':
        case 'interviews':
            return allProjects.filter(p => p.type === 'Interview');
        case 'opeds':
            return allProjects.filter(p => p.type === 'Op-Ed');
        case 'my-assignments':
            const myProjects = allProjects.filter(p => p.authorId === currentUser.uid || p.editorId === currentUser.uid);
            const myTasks = allTasks.filter(t => isUserAssignedToTask(t, currentUser.uid)).map(t => ({...t, isTask: true}));
            return [...myProjects, ...myTasks];
        default:
            return allProjects;
    }
}


function createProjectCard(project) {
    if (project.isTask) {
        return createTaskCardForAssignments(project);
    }
    
    const state = getProjectState(project, currentView, currentUser);
    const card = document.createElement('div');
    
    card.className = `kanban-card status-${state.color}`;
    card.dataset.id = project.id;
    card.dataset.type = 'project';
    
    const progress = calculateProgress(project.timeline);
    
    const finalDeadline = project.deadlines ? project.deadlines.publication : project.deadline;
    const daysUntilDeadline = finalDeadline ? Math.ceil((new Date(finalDeadline) - new Date()) / (1000 * 60 * 60 * 24)) : 0;
    const deadlineClass = daysUntilDeadline < 0 ? 'overdue' : daysUntilDeadline <= 3 ? 'due-soon' : '';
    
    const deadlineRequestIndicator = (project.deadlineRequest && project.deadlineRequest.status === 'pending') || 
                                   (project.deadlineChangeRequest && project.deadlineChangeRequest.status === 'pending') ? 
        '<span class="deadline-request-indicator">⏰</span>' : '';
    
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
    
    // Prevent event bubbling issues
    card.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('[CARD CLICK] Opening project:', project.id);
        openDetailsModal(project.id);
    });
    
    return card;
}

function createTaskCardForAssignments(task) {
    const card = document.createElement('div');
    card.className = 'kanban-card task-card';
    card.dataset.id = task.id;
    card.dataset.type = 'task';
    
    const isOverdue = new Date(task.deadline) < new Date() && task.status !== 'completed';
    const isDueSoon = !isOverdue && new Date(task.deadline) < new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    
    if (isOverdue) card.classList.add('overdue');
    if (isDueSoon) card.classList.add('due-soon');
    
    const deadline = new Date(task.deadline);
    const deadlineText = deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    const priorityColors = {
        low: '#10b981',
        medium: '#f59e0b', 
        high: '#ef4444',
        urgent: '#dc2626'
    };
    
    const priorityColor = priorityColors[task.priority] || priorityColors.medium;
    
    // Handle multiple assignees display
    const assigneeNames = getTaskAssigneeNames(task);
    let displayNames = assigneeNames.join(', ');
    let multipleIndicator = '';
    
    if (assigneeNames.length > 2) {
        displayNames = `${assigneeNames.slice(0, 2).join(', ')} +${assigneeNames.length - 2} more`;
        multipleIndicator = `<span class="multiple-assignees-indicator">+${assigneeNames.length}</span>`;
    } else if (assigneeNames.length > 1) {
        multipleIndicator = `<span class="multiple-assignees-indicator">+${assigneeNames.length}</span>`;
    }
    
    card.innerHTML = `
        <h4 class="card-title">📋 ${escapeHtml(task.title)}</h4>
        <div class="card-meta">
            <span class="card-type" style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white;">TASK</span>
            <span class="card-status">${(task.status || 'pending').replace('_', ' ')}</span>
            ${multipleIndicator}
        </div>
        <div class="card-footer">
            <div class="card-author">
                <div class="user-avatar" style="background: ${stringToColor(task.creatorName)}">
                    ${task.creatorName.charAt(0)}
                </div>
                <span title="Assigned to: ${assigneeNames.join(', ')}">→ ${escapeHtml(displayNames)}</span>
            </div>
            <div class="card-deadline ${isOverdue ? 'overdue' : isDueSoon ? 'due-today' : ''}">
                ${deadlineText}
            </div>
        </div>
        <div class="priority-indicator" style="background: ${priorityColor}; color: white; padding: 2px 8px; border-radius: 8px; font-size: 10px; font-weight: 600; margin-top: 8px; text-align: center;">
            ${(task.priority || 'medium').toUpperCase()} PRIORITY
        </div>
    `;
    
    card.addEventListener('click', () => openTaskDetailsModal(task.id));
    return card;
}

// ==================
//  Calendar
// ==================
function renderCalendar() {
    const calendarGrid = document.getElementById('calendar-grid');
    const monthYear = document.getElementById('month-year');
    
    if (!calendarGrid || !monthYear) return;
    
    calendarGrid.innerHTML = '';
    
    const month = calendarDate.getMonth();
    const year = calendarDate.getFullYear();
    
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

    // Next month's leading days to fill the grid
    const totalCells = calendarGrid.children.length;
    const remainingCells = 42 - totalCells;
    const nextMonth = new Date(year, month + 1, 1);
    
    for (let day = 1; day <= remainingCells; day++) {
        const dayDate = new Date(nextMonth);
        dayDate.setDate(day);
        createCalendarDay(calendarGrid, dayDate, true, today);
    }

    updateCalendarStats();
}

function createCalendarDay(grid, date, isOtherMonth, today) {
    const dayEl = document.createElement('div');
    dayEl.className = 'calendar-day';
    
    if (isOtherMonth) {
        dayEl.classList.add('other-month');
    }
    
    if (isSameDay(date, today)) {
        dayEl.classList.add('today');
    }

    const dayNumber = document.createElement('div');
    dayNumber.className = 'day-number';
    dayNumber.textContent = date.getDate();

    const eventsContainer = document.createElement('div');
    eventsContainer.className = 'calendar-events';

    const dayProjects = allProjects.filter(project => {
        return hasProjectDeadlineOnDate(project, date);
    });
    
    const dayTasks = allTasks.filter(task => {
        return hasTaskDeadlineOnDate(task, date);
    });

    const maxVisibleEvents = 3;
    const allEvents = [...dayProjects, ...dayTasks.map(t => ({...t, isTask: true}))];
    
    allEvents.slice(0, maxVisibleEvents).forEach(item => {
        const eventEl = createCalendarEvent(item, date);
        eventsContainer.appendChild(eventEl);
    });

    if (allEvents.length > maxVisibleEvents) {
        const moreEl = document.createElement('div');
        moreEl.className = 'event-more';
        moreEl.textContent = `+${allEvents.length - maxVisibleEvents} more`;
        moreEl.addEventListener('click', (e) => {
            e.stopPropagation();
            showDayDetails(date, allEvents);
        });
        eventsContainer.appendChild(moreEl);
    }

    dayEl.appendChild(dayNumber);
    dayEl.appendChild(eventsContainer);

    dayEl.addEventListener('click', () => {
        if (allEvents.length === 1) {
            if (allEvents[0].isTask) {
                openTaskDetailsModal(allEvents[0].id);
            } else {
                openDetailsModal(allEvents[0].id);
            }
        } else if (allEvents.length > 1) {
            showDayDetails(date, allEvents);
        }
    });

    grid.appendChild(dayEl);
}

function createCalendarEvent(item, date) {
    const eventEl = document.createElement('div');
    
    if (item.isTask) {
        eventEl.className = 'calendar-event task-event';
        eventEl.textContent = `📋 ${item.title}`;
        eventEl.title = `Task: ${item.title} - Due ${date.toLocaleDateString()}`;
        eventEl.style.background = 'linear-gradient(135deg, #3b82f6, #1d4ed8)';
    } else {
        const { eventType, eventTitle } = getEventTypeForDate(item, date);
        eventEl.className = `calendar-event ${eventType}`;
        eventEl.textContent = eventTitle;
        eventEl.title = `${item.title} - ${eventTitle} - ${date.toLocaleDateString()}`;
    }

    eventEl.addEventListener('click', (e) => {
        e.stopPropagation();
        if (item.isTask) {
            openTaskDetailsModal(item.id);
        } else {
            openDetailsModal(item.id);
        }
    });

    return eventEl;
}

function hasTaskDeadlineOnDate(task, date) {
    if (!task.deadline) return false;
    
    try {
        // Handle both date strings and Date objects
        const taskDeadline = new Date(task.deadline + 'T00:00:00');
        
        if (isNaN(taskDeadline.getTime())) {
            console.error('[CALENDAR] Invalid task deadline:', task.deadline);
            return false;
        }
        
        return formatDateForComparison(taskDeadline) === formatDateForComparison(date);
    } catch (error) {
        console.error('[CALENDAR] Error parsing task deadline:', error);
        return false;
    }
}

function hasProjectDeadlineOnDate(project, date) {
    const deadlines = project.deadlines || {};
    const finalDeadline = deadlines.publication || project.deadline;
    const dateStr = formatDateForComparison(date);
    
    const deadlineTypes = ['contact', 'interview', 'draft', 'review', 'edits'];
    
    // Check intermediate deadlines
    for (const type of deadlineTypes) {
        if (deadlines[type]) {
            try {
                const deadlineDate = new Date(deadlines[type] + 'T00:00:00');
                
                if (isNaN(deadlineDate.getTime())) {
                    console.error('[CALENDAR] Invalid deadline for type:', type, deadlines[type]);
                    continue;
                }
                
                if (formatDateForComparison(deadlineDate) === dateStr) {
                    return true;
                }
            } catch (error) {
                console.error('[CALENDAR] Error parsing deadline:', error);
                continue;
            }
        }
    }
    
    // Check final publication deadline
    if (finalDeadline) {
        try {
            const publicationDate = new Date(finalDeadline + 'T00:00:00');
            
            if (isNaN(publicationDate.getTime())) {
                console.error('[CALENDAR] Invalid publication deadline:', finalDeadline);
                return false;
            }
            
            if (formatDateForComparison(publicationDate) === dateStr) {
                return true;
            }
        } catch (error) {
            console.error('[CALENDAR] Error parsing publication deadline:', error);
            return false;
        }
    }
    
    return false;
}

function getEventTypeForDate(project, date) {
    const deadlines = project.deadlines || {};
    const finalDeadline = deadlines.publication || project.deadline;
    const dateStr = formatDateForComparison(date);
    
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

function formatDateForComparison(date) {
    if (!date || isNaN(date.getTime())) {
        console.error('[CALENDAR] Invalid date for comparison:', date);
        return '';
    }
    
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
    console.log('[CALENDAR] Updating calendar statistics');
    
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Normalize to start of day
    
    const monthStart = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);
    
    const monthEnd = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0);
    monthEnd.setHours(23, 59, 59, 999);
    
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    
    let thisMonthCount = 0;
    let thisWeekCount = 0;
    let overdueCount = 0;
    
    // Count project deadlines
    allProjects.forEach(project => {
        const deadlines = project.deadlines || {};
        const finalDeadline = deadlines.publication || project.deadline;
        
        // Check final publication deadline
        if (finalDeadline) {
            try {
                const deadline = new Date(finalDeadline + 'T00:00:00');
                
                if (!isNaN(deadline.getTime())) {
                    if (deadline >= monthStart && deadline <= monthEnd) {
                        thisMonthCount++;
                    }
                    
                    if (deadline >= weekStart && deadline <= weekEnd) {
                        thisWeekCount++;
                    }
                    
                    const state = getProjectState(project, currentView, currentUser);
                    if (deadline < now && state.column !== 'Completed' && !state.statusText.includes('Completed')) {
                        overdueCount++;
                    }
                }
            } catch (error) {
                console.error('[CALENDAR STATS] Error parsing final deadline:', error);
            }
        }
        
        // Count intermediate deadlines
        const deadlineTypes = ['contact', 'interview', 'draft', 'review', 'edits'];
        deadlineTypes.forEach(type => {
            if (deadlines[type]) {
                try {
                    const deadline = new Date(deadlines[type] + 'T00:00:00');
                    
                    if (!isNaN(deadline.getTime())) {
                        if (deadline >= monthStart && deadline <= monthEnd) {
                            thisMonthCount++;
                        }
                        
                        if (deadline >= weekStart && deadline <= weekEnd) {
                            thisWeekCount++;
                        }
                    }
                } catch (error) {
                    console.error('[CALENDAR STATS] Error parsing deadline type:', type, error);
                }
            }
        });
    });
    
    // Count task deadlines
    allTasks.forEach(task => {
        if (!task.deadline) return;
        
        try {
            const deadline = new Date(task.deadline + 'T00:00:00');
            
            if (!isNaN(deadline.getTime())) {
                if (deadline >= monthStart && deadline <= monthEnd) {
                    thisMonthCount++;
                }
                
                if (deadline >= weekStart && deadline <= weekEnd) {
                    thisWeekCount++;
                }
                
                if (deadline < now && task.status !== 'completed') {
                    overdueCount++;
                }
            }
        } catch (error) {
            console.error('[CALENDAR STATS] Error parsing task deadline:', error);
        }
    });
    
    console.log('[CALENDAR STATS] Month:', thisMonthCount, 'Week:', thisWeekCount, 'Overdue:', overdueCount);
    
    const statMonth = document.getElementById('stat-month');
    const statWeek = document.getElementById('stat-week');
    const statOverdue = document.getElementById('stat-overdue');
    
    if (statMonth) statMonth.textContent = thisMonthCount;
    if (statWeek) statWeek.textContent = thisWeekCount;
    if (statOverdue) statOverdue.textContent = overdueCount;
}

function showDayDetails(date, items) {
    const dateStr = date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    let message = `Events for ${dateStr}:\n\n`;
    
    items.forEach((item, index) => {
        if (item.isTask) {
            const assigneeNames = getTaskAssigneeNames(item);
            message += `${index + 1}. [TASK] ${item.title}\n   Assigned to: ${assigneeNames.join(', ')}\n   Priority: ${item.priority || 'medium'}\n\n`;
        } else {
            const { eventType, eventTitle } = getEventTypeForDate(item, date);
            message += `${index + 1}. ${item.title}\n   ${eventTitle}\n   Author: ${item.authorName}\n\n`;
        }
    });
    
    message += 'Click on an individual event to view details.';
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

function setupCalendarListeners() {
    const prevBtn = document.getElementById('prev-month');
    const nextBtn = document.getElementById('next-month');
    const todayBtn = document.getElementById('today-btn');
    
    if (prevBtn) prevBtn.addEventListener('click', () => changeMonth(-1));
    if (nextBtn) nextBtn.addEventListener('click', () => changeMonth(1));
    if (todayBtn) todayBtn.addEventListener('click', goToToday);
    
    document.querySelectorAll('.view-toggle button').forEach((btn, index) => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.view-toggle button').forEach((b, i) => {
                b.classList.toggle('active', i === index);
            });
            renderCalendar();
        });
    });
}

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

// ==================
//  Modals
// ==================
function closeAllModals() {
    console.log('[MODAL] Closing all modals');
    
    // Get all modals
    const modals = document.querySelectorAll('.modal-overlay');
    
    modals.forEach(modal => {
        // Reset opacity immediately on all content
        const detailsContainers = modal.querySelectorAll('.details-container');
        detailsContainers.forEach(content => {
            content.style.opacity = '1';
            content.style.transition = 'none'; // Remove transition during close
        });
        
        // Hide modal
        modal.style.display = 'none';
        
        // Reset transition after a brief delay
        setTimeout(() => {
            detailsContainers.forEach(content => {
                content.style.transition = 'opacity 0.2s ease-in-out';
            });
        }, 50);
    });
    
    // Clear state
    currentlyViewedProjectId = null;
    currentlyViewedTaskId = null;
    disableProposalEditing();
    
    console.log('[MODAL] All modals closed and reset');
}

// ==================
//  Status Reports
// ==================
function generateStatusReport() {
    console.log('[REPORT] Generating comprehensive status report');
    
    const reportModal = document.getElementById('report-modal');
    const reportContent = document.getElementById('report-content');
    if (!reportModal || !reportContent) {
        console.error('[REPORT] Modal elements not found');
        return;
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    // Group projects and tasks by user
    const userWorkload = {};
    
    // Initialize all users
    allUsers.forEach(user => {
        userWorkload[user.id] = {
            name: user.name,
            role: user.role || 'member',
            email: user.email,
            projects: [],
            tasks: [],
            overdue: 0,
            onTrack: 0,
            completed: 0
        };
    });
    
    // Categorize projects
    allProjects.forEach(project => {
        const state = getProjectState(project, currentView, currentUser);
        const finalDeadline = project.deadlines ? project.deadlines.publication : project.deadline;
        
        let status = 'on-track';
        let daysUntilDeadline = null;
        
        if (finalDeadline) {
            try {
                const deadline = new Date(finalDeadline + 'T00:00:00');
                if (!isNaN(deadline.getTime())) {
                    daysUntilDeadline = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
                    
                    if (state.column === 'Completed' || state.statusText.includes('Completed')) {
                        status = 'completed';
                    } else if (daysUntilDeadline < 0) {
                        status = 'overdue';
                    } else if (daysUntilDeadline <= 3) {
                        status = 'due-soon';
                    }
                }
            } catch (error) {
                console.error('[REPORT] Error processing project deadline:', error);
            }
        }
        
        const projectInfo = {
            id: project.id,
            title: project.title,
            type: project.type,
            status: status,
            state: state.statusText,
            deadline: finalDeadline,
            daysUntilDeadline: daysUntilDeadline,
            proposalStatus: project.proposalStatus
        };
        
        // Add to author's workload
        if (project.authorId && userWorkload[project.authorId]) {
            userWorkload[project.authorId].projects.push(projectInfo);
            if (status === 'overdue') userWorkload[project.authorId].overdue++;
            else if (status === 'completed') userWorkload[project.authorId].completed++;
            else userWorkload[project.authorId].onTrack++;
        }
        
        // Add to editor's workload
        if (project.editorId && userWorkload[project.editorId]) {
            userWorkload[project.editorId].projects.push(projectInfo);
            if (status === 'overdue') userWorkload[project.editorId].overdue++;
            else if (status === 'completed') userWorkload[project.editorId].completed++;
            else userWorkload[project.editorId].onTrack++;
        }
    });
    
    // Categorize tasks
    allTasks.forEach(task => {
        let status = 'on-track';
        let daysUntilDeadline = null;
        
        if (task.deadline) {
            try {
                const deadline = new Date(task.deadline + 'T00:00:00');
                if (!isNaN(deadline.getTime())) {
                    daysUntilDeadline = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
                    
                    if (task.status === 'completed') {
                        status = 'completed';
                    } else if (daysUntilDeadline < 0) {
                        status = 'overdue';
                    } else if (daysUntilDeadline <= 3) {
                        status = 'due-soon';
                    }
                }
            } catch (error) {
                console.error('[REPORT] Error processing task deadline:', error);
            }
        }
        
        const taskInfo = {
            id: task.id,
            title: task.title,
            status: status,
            taskStatus: task.status,
            deadline: task.deadline,
            daysUntilDeadline: daysUntilDeadline,
            priority: task.priority || 'medium'
        };
        
        // Add to all assignees
        const assigneeIds = task.assigneeIds || [task.assigneeId];
        assigneeIds.forEach(assigneeId => {
            if (assigneeId && userWorkload[assigneeId]) {
                userWorkload[assigneeId].tasks.push(taskInfo);
                if (status === 'overdue') userWorkload[assigneeId].overdue++;
                else if (status === 'completed') userWorkload[assigneeId].completed++;
                else userWorkload[assigneeId].onTrack++;
            }
        });
    });
    
    // Calculate overall statistics
    const totalOverdue = Object.values(userWorkload).reduce((sum, user) => sum + user.overdue, 0);
    const totalOnTrack = Object.values(userWorkload).reduce((sum, user) => sum + user.onTrack, 0);
    const totalCompleted = Object.values(userWorkload).reduce((sum, user) => sum + user.completed, 0);
    const activeUsers = Object.values(userWorkload).filter(u => u.projects.length > 0 || u.tasks.length > 0).length;
    
    // Start building report HTML
    let reportHTML = `
        <div class="report-header">
            <h2>📊 Comprehensive Team Status Report</h2>
            <p class="report-date">Generated: ${new Date().toLocaleString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            })}</p>
        </div>
        
        <div class="report-section executive-summary">
            <h2>🎯 Executive Summary</h2>
            <div class="summary-grid">
                <div class="summary-item total">
                    <div class="summary-icon">👥</div>
                    <div class="summary-value">${activeUsers}</div>
                    <div class="summary-label">Active Team Members</div>
                </div>
                <div class="summary-item ${totalOverdue > 0 ? 'overdue' : ''}">
                    <div class="summary-icon">⚠️</div>
                    <div class="summary-value">${totalOverdue}</div>
                    <div class="summary-label">Overdue Items</div>
                </div>
                <div class="summary-item on-track">
                    <div class="summary-icon">🎯</div>
                    <div class="summary-value">${totalOnTrack}</div>
                    <div class="summary-label">On Track</div>
                </div>
                <div class="summary-item completed">
                    <div class="summary-icon">✅</div>
                    <div class="summary-value">${totalCompleted}</div>
                    <div class="summary-label">Completed</div>
                </div>
            </div>
        </div>
    `;
    
    // Team member details - sorted by workload
    const sortedUsers = Object.values(userWorkload)
        .filter(u => u.projects.length > 0 || u.tasks.length > 0)
        .sort((a, b) => {
            // Sort by overdue first, then total workload
            if (b.overdue !== a.overdue) return b.overdue - a.overdue;
            return (b.projects.length + b.tasks.length) - (a.projects.length + a.tasks.length);
        });
    
    if (sortedUsers.length > 0) {
        reportHTML += `
            <div class="report-section team-details">
                <h2>👥 Team Member Breakdown</h2>
        `;
        
        sortedUsers.forEach(user => {
            const totalItems = user.projects.length + user.tasks.length;
            const workloadLevel = totalItems > 10 ? 'high' : totalItems > 5 ? 'medium' : 'low';
            const performanceClass = user.overdue > 0 ? 'needs-attention' : user.onTrack > user.completed ? 'in-progress' : 'excellent';
            
            reportHTML += `
                <div class="user-card ${performanceClass}">
                    <div class="user-card-header">
                        <div class="user-info">
                            <div class="user-avatar" style="background-color: ${stringToColor(user.name)}">
                                ${user.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <h3>${escapeHtml(user.name)}</h3>
                                <p class="user-role">${escapeHtml(user.role)}</p>
                            </div>
                        </div>
                        <div class="workload-indicator ${workloadLevel}">
                            <div class="workload-count">${totalItems}</div>
                            <div class="workload-label">Total Items</div>
                        </div>
                    </div>
                    
                    <div class="user-stats">
                        <div class="stat-item ${user.overdue > 0 ? 'overdue' : ''}">
                            <span class="stat-icon">⚠️</span>
                            <span class="stat-value">${user.overdue}</span>
                            <span class="stat-label">Overdue</span>
                        </div>
                        <div class="stat-item on-track">
                            <span class="stat-icon">🎯</span>
                            <span class="stat-value">${user.onTrack}</span>
                            <span class="stat-label">On Track</span>
                        </div>
                        <div class="stat-item completed">
                            <span class="stat-icon">✅</span>
                            <span class="stat-value">${user.completed}</span>
                            <span class="stat-label">Done</span>
                        </div>
                    </div>
            `;
            
            // Projects section
            if (user.projects.length > 0) {
                reportHTML += `
                    <div class="user-work-section">
                        <h4>📝 Projects (${user.projects.length})</h4>
                        <div class="work-items">
                `;
                
                user.projects.forEach(project => {
                    const deadlineText = project.daysUntilDeadline !== null 
                        ? (project.daysUntilDeadline < 0 
                            ? `${Math.abs(project.daysUntilDeadline)} days overdue` 
                            : `${project.daysUntilDeadline} days remaining`)
                        : 'No deadline';
                    
                    reportHTML += `
                        <div class="work-item ${project.status}" data-id="${project.id}" onclick="openDetailsModal('${project.id}'); closeAllModals();">
                            <div class="work-item-header">
                                <span class="work-item-title">${escapeHtml(project.title)}</span>
                                <span class="work-item-type">${escapeHtml(project.type)}</span>
                            </div>
                            <div class="work-item-meta">
                                <span class="work-item-status">${escapeHtml(project.state)}</span>
                                <span class="work-item-deadline ${project.status}">${deadlineText}</span>
                            </div>
                        </div>
                    `;
                });
                
                reportHTML += `
                        </div>
                    </div>
                `;
            }
            
            // Tasks section
            if (user.tasks.length > 0) {
                reportHTML += `
                    <div class="user-work-section">
                        <h4>📋 Tasks (${user.tasks.length})</h4>
                        <div class="work-items">
                `;
                
                user.tasks.forEach(task => {
                    const deadlineText = task.daysUntilDeadline !== null 
                        ? (task.daysUntilDeadline < 0 
                            ? `${Math.abs(task.daysUntilDeadline)} days overdue` 
                            : `${task.daysUntilDeadline} days remaining`)
                        : 'No deadline';
                    
                    reportHTML += `
                        <div class="work-item ${task.status}" data-id="${task.id}" data-type="task" onclick="openTaskDetailsModal('${task.id}'); closeAllModals();">
                            <div class="work-item-header">
                                <span class="work-item-title">${escapeHtml(task.title)}</span>
                                <span class="priority-badge ${task.priority}">${task.priority.toUpperCase()}</span>
                            </div>
                            <div class="work-item-meta">
                                <span class="work-item-status">${escapeHtml(task.taskStatus)}</span>
                                <span class="work-item-deadline ${task.status}">${deadlineText}</span>
                            </div>
                        </div>
                    `;
                });
                
                reportHTML += `
                        </div>
                    </div>
                `;
            }
            
            reportHTML += `</div>`; // Close user-card
        });
        
        reportHTML += `</div>`; // Close team-details section
    }
    
    // Recommendations section
    reportHTML += `
        <div class="report-section recommendations">
            <h2>💡 Recommendations</h2>
            <div class="recommendation-list">
    `;
    
    const highWorkloadUsers = sortedUsers.filter(u => (u.projects.length + u.tasks.length) > 10);
    const overdueUsers = sortedUsers.filter(u => u.overdue > 0);
    
    if (overdueUsers.length > 0) {
        reportHTML += `
            <div class="recommendation-item urgent">
                <span class="recommendation-icon">🚨</span>
                <div>
                    <h4>Immediate Attention Required</h4>
                    <p>${overdueUsers.map(u => u.name).join(', ')} ${overdueUsers.length === 1 ? 'has' : 'have'} overdue items that need immediate attention.</p>
                </div>
            </div>
        `;
    }
    
    if (highWorkloadUsers.length > 0) {
        reportHTML += `
            <div class="recommendation-item warning">
                <span class="recommendation-icon">⚖️</span>
                <div>
                    <h4>High Workload Alert</h4>
                    <p>${highWorkloadUsers.map(u => u.name).join(', ')} ${highWorkloadUsers.length === 1 ? 'has' : 'have'} a high number of assignments. Consider redistributing workload.</p>
                </div>
            </div>
        `;
    }
    
    if (overdueUsers.length === 0 && totalOnTrack > totalCompleted) {
        reportHTML += `
            <div class="recommendation-item success">
                <span class="recommendation-icon">🎉</span>
                <div>
                    <h4>Team On Track</h4>
                    <p>No overdue items! The team is making good progress. Keep up the great work!</p>
                </div>
            </div>
        `;
    }
    
    reportHTML += `
            </div>
        </div>
    `;
    
    reportContent.innerHTML = reportHTML;
    reportModal.style.display = 'flex';
    console.log('[REPORT] Comprehensive status report generated successfully');
}

// ==================
//  Project Actions
// ==================
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

// ==================
//  Proposal Editing
// ==================
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

// ==================
//  Helper Functions
// ==================
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

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showNotification(message, type = 'success') {
    console.log(`[NOTIFICATION ${type.toUpperCase()}] ${message}`);
    
    let container = document.getElementById('notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        container.className = 'notification-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            pointer-events: none;
        `;
        document.body.appendChild(container);
    }
    
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.style.cssText = `
        padding: 16px 20px;
        margin-bottom: 8px;
        border-radius: 12px;
        color: white;
        font-weight: 600;
        font-size: 14px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
        transform: translateX(400px);
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        max-width: 350px;
        pointer-events: auto;
        position: relative;
    `;
    
    if (type === 'success') {
        notification.style.background = 'linear-gradient(135deg, #10b981, #059669)';
    } else if (type === 'error') {
        notification.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
    } else if (type === 'warning') {
        notification.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
    } else {
        notification.style.background = 'linear-gradient(135deg, #3b82f6, #2563eb)';
    }
    
    notification.textContent = message;
    container.appendChild(notification);
    
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    setTimeout(() => {
        notification.style.transform = 'translateX(400px)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 4000);
}

function getTaskAssigneeNames(task) {
    if (Array.isArray(task.assigneeNames) && task.assigneeNames.length > 0) {
        return task.assigneeNames.filter(name => name && name.trim());
    } else if (task.assigneeName && task.assigneeName.trim()) {
        return [task.assigneeName];
    }
    return ['Unassigned'];
}

function getTaskAssigneeIds(task) {
    if (Array.isArray(task.assigneeIds) && task.assigneeIds.length > 0) {
        return task.assigneeIds.filter(id => id && id.trim());
    } else if (task.assigneeId && task.assigneeId.trim()) {
        return [task.assigneeId];
    }
    return [];
}

function isUserAssignedToTask(task, userId) {
    if (task.creatorId === userId) return true;
    const assigneeIds = getTaskAssigneeIds(task);
    return assigneeIds.includes(userId);
}

// Make global functions available for onclick handlers
window.toggleAssignee = toggleAssignee;
window.removeAssignee = removeAssignee;

console.log('[DASHBOARD] Fixed dashboard.js loaded successfully!');
