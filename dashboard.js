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
        console.log('[FIREBASE] Firebase initialized successfully');
    }
} catch (initError) {
    console.error("[FIREBASE] Firebase initialization failed:", initError);
    alert("Failed to connect to the database. Please refresh the page and try again.");
}

const auth = firebase.auth();
const db = firebase.firestore();

// Enable offline persistence for better reliability
db.enablePersistence({ synchronizeTabs: true })
    .catch(function(err) {
        if (err.code === 'failed-precondition') {
            console.warn('[FIREBASE] Persistence failed: Multiple tabs open');
        } else if (err.code === 'unimplemented') {
            console.warn('[FIREBASE] Persistence not available in this browser');
        }
    });

/**
 * Ensure realtime subscriptions are initialized after all scripts load.
 * Retries a few times because fixedSubscriptions.js loads after dashboard.js.
 */
function ensureSubscriptionsInitialized(attempt = 0) {
    const MAX_ATTEMPTS = 20;

    if (typeof window.initializeSubscriptions === 'function') {
        console.log('[INIT] Initializing realtime subscriptions');
        window.initializeSubscriptions();
        return;
    }

    if (attempt < MAX_ATTEMPTS) {
        const nextAttempt = attempt + 1;
        console.warn(`[INIT] Subscriptions not ready (attempt ${nextAttempt}/${MAX_ATTEMPTS}), retrying...`);
        setTimeout(() => ensureSubscriptionsInitialized(nextAttempt), 300);
        return;
    }

    console.error('[INIT] Failed to initialize subscriptions after multiple attempts');
    showNotification('Live updates failed to start. Please refresh the page.', 'error');
}

// ==================
//  Missing Helper Functions
// ==================

async function approveProposal(projectId) {
    if (!projectId) {
        console.error('[APPROVE] No project ID provided');
        showNotification('No project selected.', 'error');
        return;
    }

    if (currentUserRole !== 'admin') {
        console.error('[APPROVE] User is not admin:', currentUserRole);
        showNotification('Only admins can approve proposals.', 'error');
        return;
    }

    try {
        console.log('[APPROVE] Approving proposal:', projectId);
        await db.collection('projects').doc(projectId).update({
            proposalStatus: 'approved',
            'timeline.Topic Proposal Complete': true,
            activity: firebase.firestore.FieldValue.arrayUnion({
                text: 'approved the proposal',
                authorName: currentUserName,
                timestamp: new Date()
            })
        });

        showNotification('Proposal approved successfully!', 'success');
        console.log('[APPROVE] Proposal approved successfully');
    } catch (error) {
        console.error('[APPROVE ERROR] Failed to approve proposal:', error);
        let errorMessage = 'Failed to approve proposal. ';
        
        if (error.code === 'permission-denied') {
            errorMessage += 'You do not have permission to approve proposals.';
        } else {
            errorMessage += 'Please try again.';
        }
        
        showNotification(errorMessage, 'error');
    }
}

async function updateProposalStatus(status) {
    if (!currentlyViewedProjectId) {
        console.error('[UPDATE STATUS] No project ID provided');
        showNotification('No project selected.', 'error');
        return;
    }

    if (currentUserRole !== 'admin') {
        console.error('[UPDATE STATUS] User is not admin:', currentUserRole);
        showNotification('Only admins can update proposal status.', 'error');
        return;
    }

    try {
        console.log('[UPDATE STATUS] Updating proposal status to:', status, 'for project:', currentlyViewedProjectId);
        await db.collection('projects').doc(currentlyViewedProjectId).update({
            proposalStatus: status,
            activity: firebase.firestore.FieldValue.arrayUnion({
                text: `${status} the proposal`,
                authorName: currentUserName,
                timestamp: new Date()
            })
        });

        showNotification(`Proposal ${status} successfully!`, 'success');
        console.log('[UPDATE STATUS] Status updated successfully');
    } catch (error) {
        console.error(`[UPDATE STATUS ERROR] Failed to ${status} proposal:`, error);
        let errorMessage = `Failed to ${status} proposal. `;
        
        if (error.code === 'permission-denied') {
            errorMessage += 'You do not have permission to update proposal status.';
        } else {
            errorMessage += 'Please try again.';
        }
        
        showNotification(errorMessage, 'error');
    }
}

async function handleAddComment() {
    const commentInput = document.getElementById('comment-input');
    if (!commentInput || !currentlyViewedProjectId) return;

    const comment = commentInput.value.trim();
    if (!comment) {
        showNotification('Please enter a comment.', 'error');
        return;
    }

    try {
        await db.collection('projects').doc(currentlyViewedProjectId).update({
            activity: firebase.firestore.FieldValue.arrayUnion({
                text: `commented: "${comment}"`,
                authorName: currentUserName,
                timestamp: new Date()
            })
        });

        commentInput.value = '';
        showNotification('Comment added successfully!', 'success');
    } catch (error) {
        console.error('[ERROR] Failed to add comment:', error);
        showNotification('Failed to add comment. Please try again.', 'error');
    }
}

async function handleAssignEditor() {
    const editorDropdown = document.getElementById('editor-dropdown');
    if (!editorDropdown || !currentlyViewedProjectId) return;

    const editorId = editorDropdown.value;
    if (!editorId) {
        showNotification('Please select an editor.', 'error');
        return;
    }

    const editor = allEditors.find(e => e.id === editorId);
    if (!editor) return;

    // Get current project to check if we're reassigning
    const project = allProjects.find(p => p.id === currentlyViewedProjectId);
    const isReassignment = project && project.editorId;
    const previousEditorName = project ? project.editorName : null;

    try {
        await db.collection('projects').doc(currentlyViewedProjectId).update({
            editorId: editorId,
            editorName: editor.name,
            activity: firebase.firestore.FieldValue.arrayUnion({
                text: isReassignment 
                    ? `reassigned editor from ${previousEditorName} to ${editor.name}`
                    : `assigned ${editor.name} as editor`,
                authorName: currentUserName,
                timestamp: new Date()
            })
        });

        showNotification(
            isReassignment 
                ? `Editor reassigned to ${editor.name} successfully!` 
                : `Editor ${editor.name} assigned successfully!`, 
            'success'
        );
    } catch (error) {
        console.error('[ERROR] Failed to assign editor:', error);
        showNotification('Failed to assign editor. Please try again.', 'error');
    }
}

async function handleDeleteProject() {
    if (!currentlyViewedProjectId) {
        console.error('[DELETE] No project ID provided');
        showNotification('No project selected for deletion.', 'error');
        return;
    }

    const project = allProjects.find(p => p.id === currentlyViewedProjectId);
    if (!project) {
        console.error('[DELETE] Project not found:', currentlyViewedProjectId);
        showNotification('Project not found.', 'error');
        return;
    }

    const isAdmin = currentUserRole === 'admin';
    const isAuthor = currentUser.uid === project.authorId;

    console.log('[DELETE PROJECT] Permissions check:', {
        currentUserRole,
        isAdmin,
        isAuthor,
        projectAuthorId: project.authorId,
        currentUserId: currentUser.uid
    });

    if (!isAdmin && !isAuthor) {
        showNotification('You can only delete projects you created.', 'error');
        return;
    }

    const confirmMessage = `Are you sure you want to permanently delete "${project.title}"?\n\nThis action cannot be undone and will remove all associated data.`;
    
    if (confirm(confirmMessage)) {
        try {
            console.log('[DELETE] Deleting project:', currentlyViewedProjectId);
            await db.collection('projects').doc(currentlyViewedProjectId).delete();
            showNotification('Project deleted successfully!', 'success');
            console.log('[DELETE] Project deleted successfully');
            
            // Close modal after a short delay
            setTimeout(() => {
                closeAllModals();
            }, 500);
        } catch (error) {
            console.error('[DELETE ERROR] Failed to delete project:', error);
            let errorMessage = 'Failed to delete project. ';
            
            if (error.code === 'permission-denied') {
                errorMessage += 'You do not have permission to delete this project.';
            } else if (error.code === 'not-found') {
                errorMessage += 'Project not found.';
            } else {
                errorMessage += 'Please try again or contact support.';
            }
            
            showNotification(errorMessage, 'error');
        }
    }
}


// ---- App State ----
let currentUser = null, currentUserName = null, currentUserRole = null;
let allProjects = [], allEditors = [], allTasks = [], allUsers = [];
let currentlyViewedProjectId = null, currentlyViewedTaskId = null;
let currentView = 'interviews';
// Allow deep-linking to views via query parameter
try {
    const params = new URLSearchParams(window.location.search);
    const viewParam = (params.get('view') || '').toLowerCase();
    const viewMap = {
        'dashboard': 'interviews',
        'interviews': 'interviews',
        'opeds': 'opeds',
        'tasks': 'tasks',
        'my-assignments': 'my-assignments',
        'my': 'my-assignments',
        'calendar': 'calendar'
    };
    if (viewParam && viewMap[viewParam]) {
        currentView = viewMap[viewParam];
    }
} catch (e) { console.warn('[VIEW PARAM] Unable to parse view param:', e); }
let calendarDate = new Date();
const pendingEditorAlertedProjects = new Set();
let taskFormSubmitListenerAttached = false;
let modalCloseDelegationAttached = false;

// ==================
//  Modal Management
// ==================

/**
 * Properly close all modals and reset their states
 * This function ensures clean transitions between modals
 */
function closeAllModals() {
    console.log('[MODAL CLOSE] Closing all modals and resetting states');
    
    // Get all modal elements
    const modals = [
        'project-modal',
        'task-modal',
        'details-modal',
        'task-details-modal',
        'report-modal'
    ];
    
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal) {
            // Force remove display and reset all styles
            modal.style.display = 'none';
            modal.style.opacity = '';
            modal.style.visibility = '';
            modal.style.transition = '';
            
            // Clear dataset to avoid stale project/task IDs
            if (modal.dataset.projectId) {
                delete modal.dataset.projectId;
            }
            if (modal.dataset.taskId) {
                delete modal.dataset.taskId;
            }
            
            // Remove any loading states
            modal.classList.remove('loading');
            
            console.log(`[MODAL CLOSE] Closed ${modalId}`);
        }
    });
    
    // Only clear currently viewed IDs if we're actually closing all modals
    // Don't clear if we're just transitioning between modals
    // The setTimeout in openDetailsModal will set the new ID before this takes effect
    setTimeout(() => {
        // Check if any modal is actually open after a brief delay
        const anyModalOpen = modals.some(modalId => {
            const modal = document.getElementById(modalId);
            return modal && modal.style.display === 'flex';
        });
        
        // Only clear IDs if no modals are open
        if (!anyModalOpen) {
            currentlyViewedProjectId = null;
            currentlyViewedTaskId = null;
            window.currentlyViewedProjectId = null;
            window.currentlyViewedTaskId = null;
            console.log('[MODAL CLOSE] Cleared all viewed IDs');
        } else {
            console.log('[MODAL CLOSE] Modal still open, keeping IDs');
        }
    }, 50);
    
    // Remove blur from background and restore scrolling
    document.body.style.overflow = '';
    document.body.style.filter = '';
    
    const appContainer = document.getElementById('app-container');
    if (appContainer) {
        appContainer.style.filter = '';
        appContainer.style.transition = '';
    }
    
    console.log('[MODAL CLOSE] All modals closed successfully, states reset');
}

// ==================
//  Utility Functions
// ==================

function stringToColor(str) {
    if (!str) return '#64748b';
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = hash % 360;
    return `hsl(${hue}, 65%, 50%)`;
}

function getUserDisplayName(user) {
    if (!user) return 'Team Member';

    if (typeof user === 'string' && user.trim()) {
        return user.trim();
    }

    const nameCandidates = [
        user.name,
        user.displayName,
        user.authorName,
        user.editorName
    ].filter(candidate => typeof candidate === 'string' && candidate.trim());

    if (nameCandidates.length > 0) {
        return nameCandidates[0].trim();
    }

    if (user.email && typeof user.email === 'string') {
        const localPart = user.email.split('@')[0];
        if (localPart) {
            return localPart;
        }
    }

    if (user.id) {
        return `Member ${String(user.id).slice(0, 4)}`;
    }

    return 'Team Member';
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function calculateProgress(timeline) {
    if (!timeline) return 0;
    const tasks = Object.values(timeline);
    if (tasks.length === 0) return 0;
    const completed = tasks.filter(t => t === true).length;
    return Math.round((completed / tasks.length) * 100);
}

function isUserAssignedToTask(task, userId) {
    if (!task || !userId) return false;

    if (task.assigneeIds && Array.isArray(task.assigneeIds)) {
        return task.assigneeIds.includes(userId);
    }

    return task.assigneeId === userId;
}

function getTaskAssigneeNames(task) {
    if (!task) return ['Not assigned'];

    if (task.assigneeNames && Array.isArray(task.assigneeNames) && task.assigneeNames.length > 0) {
        return task.assigneeNames;
    }

    if (task.assigneeName) {
        return [task.assigneeName];
    }

    return ['Not assigned'];
}

function isValidDate(dateString) {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) return false;
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
}

function showNotification(message, type = 'info') {
    const container = document.getElementById('notification-container') || createNotificationContainer();

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">${getNotificationIcon(type)}</span>
            <span class="notification-message">${escapeHtml(message)}</span>
        </div>
        <button class="notification-close" aria-label="Close">×</button>
    `;

    container.appendChild(notification);

    setTimeout(() => notification.classList.add('show'), 10);

    notification.querySelector('.notification-close').addEventListener('click', () => {
        removeNotification(notification);
    });

    setTimeout(() => removeNotification(notification), 5000);
}

function createNotificationContainer() {
    const container = document.createElement('div');
    container.id = 'notification-container';
    container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 10000; display: flex; flex-direction: column; gap: 10px;';
    document.body.appendChild(container);
    return container;
}

function getNotificationIcon(type) {
    const icons = {
        success: 'OK',
        error: 'X',
        warning: '!',
        info: 'i'
    };
    return icons[type] || icons.info;
}

function removeNotification(notification) {
    notification.classList.remove('show');
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 300);
}

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

    const newContainer = container.cloneNode(true);
    container.parentNode.replaceChild(newContainer, container);

    const freshContainer = document.getElementById('multi-select-container');
    const freshSearch = document.getElementById('assignee-search');
    const freshHeader = document.getElementById('multi-select-header');
    const freshIndicator = document.getElementById('dropdown-indicator');

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

    freshHeader.addEventListener('click', (e) => {
        if (!e.target.closest('.remove-assignee') && !e.target.closest('.dropdown-indicator')) {
            freshSearch.focus();
            if (!isDropdownOpen) openDropdown();
        }
    });

    freshIndicator.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDropdown();
        if (isDropdownOpen) freshSearch.focus();
    });

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

    container.innerHTML = selectedAssignees.map(user => {
        const displayName = getUserDisplayName(user);
        const initials = displayName.charAt(0).toUpperCase();
        return `
            <div class="assignee-tag" data-user-id="${user.id}">
                <div class="assignee-avatar" style="background-color: ${stringToColor(displayName)}">
                    ${initials}
                </div>
                <span>${escapeHtml(displayName)}</span>
                <div class="remove-assignee" onclick="removeAssignee('${user.id}')" title="Remove ${escapeHtml(displayName)}">
                    ×
                </div>
            </div>
        `;
    }).join('');
}

function renderDropdownOptions() {
    const dropdown = document.getElementById('assignee-dropdown');
    if (!dropdown) return;

    if (filteredUsers.length === 0) {
        dropdown.innerHTML = '<div class="no-results">No team members found. Please ask an admin to add users.</div>';
        return;
    }

    dropdown.innerHTML = filteredUsers.map(user => {
        const isSelected = selectedAssignees.some(selected => selected.id === user.id);
        const displayName = getUserDisplayName(user);
        const initials = displayName.charAt(0).toUpperCase();
        const roleLabel = user.role || 'member';
        return `
            <div class="assignee-item ${isSelected ? 'selected' : ''}"
                 onclick="toggleAssignee('${user.id}')"
                 data-user-id="${user.id}"
                 tabindex="0">
                <div class="user-avatar" style="background-color: ${stringToColor(displayName)}">
                    ${initials}
                </div>
                <div class="assignee-info">
                    <div class="assignee-name">${escapeHtml(displayName)}</div>
                    <div class="assignee-role">${escapeHtml(roleLabel)}</div>
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

// ==================
//  Initialization & Auth
// ==================
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    currentUser = user;

    try {
        const userDoc = await db.collection('users').doc(user.uid).get();

        if (!userDoc.exists) {
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

        ensureSubscriptionsInitialized();

        document.getElementById('loader').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';

    } catch (error) {
        console.error("Initialization Error:", error);
        alert("Could not load your profile. Please refresh the page and try again.");
    }
});

function normalizeUserRecord(doc) {
    if (!doc) return null;

    const rawData = typeof doc.data === 'function' ? doc.data() : doc;
    const normalizedData = { ...rawData };
    const normalizedName = getUserDisplayName({ ...normalizedData, id: doc.id });

    return {
        id: doc.id,
        ...normalizedData,
        name: normalizedName,
        role: normalizedData.role || 'member',
        email: normalizedData.email || ''
    };
}

async function fetchEditors() {
    try {
        const editorsSnapshot = await db.collection('users')
            .where('role', 'in', ['admin', 'editor'])
            .get();

        allEditors = editorsSnapshot.docs
            .map(doc => normalizeUserRecord(doc))
            .filter(Boolean);
    } catch (error) {
        console.error("Error fetching editors:", error);
        allEditors = [];
    }
}

async function fetchAllUsers() {
    try {
        const usersSnapshot = await db.collection('users').get();
        allUsers = usersSnapshot.docs
            .map(doc => normalizeUserRecord(doc))
            .filter(Boolean);

        if (currentUser && !allUsers.some(user => user.id === currentUser.uid)) {
            const fallbackUser = normalizeUserRecord({
                id: currentUser.uid,
                name: currentUserName || currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'Me'),
                email: currentUser.email || '',
                role: currentUserRole || 'writer'
            });

            if (fallbackUser) {
                allUsers.push(fallbackUser);
            }
        }
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
    document.getElementById('logout-button').addEventListener('click', () => auth.signOut());

    document.querySelectorAll('.nav-item').forEach(link => {
        link.addEventListener('click', e => {
            const href = link.getAttribute('href');
            if (href && href !== '#') {
                return;
            }

            e.preventDefault();
            const view = link.id.replace('nav-', '');
            handleNavClick(view);
        });
    });

    const addProjectBtn = document.getElementById('add-project-button');
    if (addProjectBtn) {
        // Clone to remove any existing listeners
        const newBtn = addProjectBtn.cloneNode(true);
        addProjectBtn.parentNode.replaceChild(newBtn, addProjectBtn);
        // Attach fresh listener
        document.getElementById('add-project-button').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('[BUTTON CLICK] Add project button clicked');
            openProjectModal();
        });
        console.log('[SETUP] Add project button listener attached');
    }
    document.getElementById('add-task-button').addEventListener('click', openTaskModal);

    const statusReportBtn = document.getElementById('status-report-button');
    if (statusReportBtn) {
        statusReportBtn.addEventListener('click', generateStatusReport);
    }

    // Project modal buttons - using event delegation since these are in modals
    // These will be reattached when modals open

    document.getElementById('prev-month').addEventListener('click', () => changeMonth(-1));
    document.getElementById('next-month').addEventListener('click', () => changeMonth(1));

    document.querySelectorAll('.modal-overlay').forEach(modal => {
        const newModal = modal.cloneNode(true);
        modal.parentNode.replaceChild(newModal, modal);
    });

    const editProposalBtn = document.getElementById('edit-proposal-button');
    const saveProposalBtn = document.getElementById('save-proposal-button');
    const cancelProposalBtn = document.getElementById('cancel-proposal-button');

    if (editProposalBtn) editProposalBtn.addEventListener('click', enableProposalEditing);
    if (saveProposalBtn) saveProposalBtn.addEventListener('click', handleSaveProposal);
    if (cancelProposalBtn) {
        cancelProposalBtn.addEventListener('click', () => disableProposalEditing({ revertToOriginal: true }));
    }

    const setDeadlinesBtn = document.getElementById('set-deadlines-button');
    const requestDeadlineChangeBtn = document.getElementById('request-deadline-change-button');

    if (setDeadlinesBtn) {
        setDeadlinesBtn.addEventListener('click', () => {
            // Use window.handleSetDeadlines if available (from deadlineFixes_APPLY.js)
            // Otherwise fall back to local handleSetDeadlines (from dashboardHelpers.js)
            if (typeof window.handleSetDeadlines === 'function') {
                console.log('[DEADLINES] Using window.handleSetDeadlines from deadlineFixes_APPLY.js');
                window.handleSetDeadlines();
            } else if (typeof handleSetDeadlines === 'function') {
                console.log('[DEADLINES] Using local handleSetDeadlines');
                handleSetDeadlines();
            } else {
                console.error('[DEADLINES] handleSetDeadlines function not found!');
                showNotification('Deadline function not loaded. Please refresh the page.', 'error');
            }
        });
    }
    if (requestDeadlineChangeBtn) requestDeadlineChangeBtn.addEventListener('click', handleRequestDeadlineChange);

    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', e => {
            if (e.target === modal || e.target.classList.contains('close-button')) {
                e.preventDefault();
                e.stopPropagation();
                closeAllModals();
            }
        });

        const closeButtons = modal.querySelectorAll('.close-button');
        closeButtons.forEach(btn => {
            btn.addEventListener('click', e => {
                e.preventDefault();
                e.stopPropagation();
                closeAllModals();
            });
        });
    });

    const projectForm = document.getElementById('project-form');
    const taskForm = document.getElementById('task-form');

    if (projectForm) {
        const newProjectForm = projectForm.cloneNode(true);
        projectForm.parentNode.replaceChild(newProjectForm, projectForm);

        const freshProjectForm = document.getElementById('project-form');
        if (freshProjectForm) {
            freshProjectForm.addEventListener('submit', handleProjectFormSubmit);
            freshProjectForm.dataset.submitHandler = 'attached';
            console.log('[SETUP] Project form submit handler attached');
        } else {
            console.error('[SETUP] Fresh project form reference missing after clone');
        }

        const saveProjectBtn = document.getElementById('save-project-button');
        if (saveProjectBtn) {
            saveProjectBtn.addEventListener('click', (event) => handleProjectFormSubmit(event));
            saveProjectBtn.dataset.clickHandler = 'attached';
            console.log('[SETUP] Project save button click handler attached');
        } else {
            console.error('[SETUP] Save project button not found after cloning form');
        }
    } else {
        console.error('[SETUP] Project form not found!');
    }
    
    if (!taskForm) {
        console.error('[SETUP] Task form not found!');
    }

    ensureTaskFormSubmitListener();
    ensureGlobalModalCloseHandler();

    setupCalendarListeners();
    setupCalendarKeyboardNavigation();
}

// ==================
//  View Management
// ==================
function handleNavClick(view) {
    if (view === 'dashboard') {
        view = 'interviews';
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
function updateNavCounts() {
    if (!currentUser || !currentUser.uid) {
        return;
    }

    const projectMap = new Map();

    allProjects.forEach(project => {
        if (project.authorId === currentUser.uid || project.editorId === currentUser.uid) {
            projectMap.set(project.id, project);
        }
    });

    if (currentUserRole === 'admin') {
        allProjects.forEach(project => {
            if (isAwaitingEditorAssignment(project)) {
                projectMap.set(project.id, project);
            }
        });
    }

    const myAssignmentsProjects = projectMap.size;

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
    document.getElementById('task-form').reset();
    selectedAssignees = [];

    initializeMultiSelect();

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('task-deadline').value = tomorrow.toISOString().split('T')[0];

    document.getElementById('task-modal').style.display = 'flex';

    setTimeout(() => {
        document.getElementById('task-title').focus();
    }, 100);
}

async function handleTaskFormSubmit(e) {
    e.preventDefault();

    const submitButton = document.getElementById('save-task-button');
    const originalText = submitButton.textContent;

    if (!currentUser || !currentUser.uid) {
        console.error('[TASK SUBMIT] No authenticated user available');
        showNotification('Your session expired. Please sign in again before creating tasks.', 'error');
        return;
    }

    try {
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

        submitButton.disabled = true;
        submitButton.classList.add('loading');
        submitButton.textContent = 'Creating Task...';

        const description = document.getElementById('task-description').value.trim();
        const priority = document.getElementById('task-priority').value || 'medium';

        const assigneeIds = selectedAssignees.map(u => u.id);
        const assigneeNames = selectedAssignees.map(u => getUserDisplayName(u));
        const creatorName = currentUserName || currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'Unknown User');
        const primaryAssigneeId = assigneeIds[0] || null;
        const primaryAssigneeName = assigneeNames[0] || 'Assigned Member';

        const taskData = {
            title: title,
            description: description || null,
            assigneeIds: assigneeIds,
            assigneeNames: assigneeNames,
            assigneeId: primaryAssigneeId,
            assigneeName: primaryAssigneeName,
            deadline: deadline,
            priority: priority,
            creatorId: currentUser.uid,
            creatorName: creatorName,
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            activity: [{
                text: assigneeIds.length === 1 ?
                    `created this task and assigned it to ${assigneeNames[0]}` :
                    `created this task and assigned it to ${assigneeNames.join(', ')}`,
                authorName: creatorName,
                timestamp: new Date()
            }]
        };

        const docRef = await db.collection('tasks').add(taskData);
        console.log('[TASK SUBMIT] Task created with ID:', docRef.id);

        const nowSeconds = Math.floor(Date.now() / 1000);
        const localTask = {
            id: docRef.id,
            title,
            description: description || null,
            assigneeIds,
            assigneeNames,
            assigneeId: primaryAssigneeId,
            assigneeName: primaryAssigneeName,
            deadline,
            priority,
            creatorId: currentUser.uid,
            creatorName,
            status: 'pending',
            createdAt: { seconds: nowSeconds },
            updatedAt: { seconds: nowSeconds },
            activity: [{
                text: assigneeIds.length === 1 ?
                    `created this task and assigned it to ${assigneeNames[0]}` :
                    `created this task and assigned it to ${assigneeNames.join(', ')}`,
                authorName: creatorName,
                timestamp: { seconds: nowSeconds }
            }]
        };

        allTasks = [localTask, ...allTasks.filter(t => t.id !== docRef.id)];
        renderCurrentViewEnhanced();
        updateNavCounts();

        showNotification(`Task assigned to ${assigneeNames.join(', ')} successfully!`, 'success');

        setTimeout(() => {
            closeAllModals();
        }, 1000);

        document.getElementById('task-form').reset();
        selectedAssignees = [];

    } catch (error) {
        console.error("[ERROR] Failed to create task:", error);
        showNotification(error.message || 'Failed to create task. Please try again.', 'error');
    } finally {
        submitButton.disabled = false;
        submitButton.classList.remove('loading');
        submitButton.textContent = originalText;
    }
}

function renderTasksBoard(tasks) {
    const board = document.getElementById('tasks-board');
    board.innerHTML = '';

const columns = [
        { id: 'pending', title: 'Pending Approval', icon: '', color: '#f59e0b' },
        { id: 'approved', title: 'Approved', icon: '', color: '#10b981' },
        { id: 'in_progress', title: 'In Progress', icon: '', color: '#3b82f6' },
        { id: 'completed', title: 'Completed', icon: '', color: '#8b5cf6' }
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
    
    // Get column for task
    const taskColumn = getTaskColumn(task);
    let columnClass = '';
    if (taskColumn === 'completed') {
        columnClass = 'column-completed';
    } else if (taskColumn === 'in_progress') {
        columnClass = 'column-in-progress';
    } else if (taskColumn === 'approved') {
        columnClass = 'column-approved';
    } else if (taskColumn === 'pending') {
        columnClass = 'column-pending';
    }
    
    card.className = `kanban-card priority-${task.priority || 'medium'} ${columnClass}`;
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

    card.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openTaskDetailsModal(task.id);
    });

    return card;
}

function openTaskDetailsModal(taskId) {
    const task = allTasks.find(t => t.id === taskId);
    if (!task) {
        console.error('[MODAL] Task not found:', taskId);
        showNotification('Task not found. Please refresh the page.', 'error');
        return;
    }

    console.log('[MODAL OPEN] Opening task modal:', taskId);
    
    // Force close all modals first and clear any lingering states
    closeAllModals();

    // Use setTimeout to ensure closing is complete before opening new modal
    // Increased timeout to 150ms for smoother transition
    setTimeout(() => {
        currentlyViewedTaskId = taskId;

        const modal = document.getElementById('task-details-modal');
        if (!modal) {
            console.error('[MODAL] Task modal element not found');
            return;
        }

        // Ensure modal is completely reset before opening
        modal.style.display = 'none';
        modal.style.opacity = '';
        modal.style.visibility = '';
        modal.style.transition = '';
        
        // Force browser reflow to apply the reset
        void modal.offsetHeight;
        
        // Now set display to flex to show the modal
        modal.style.display = 'flex';
        
        // Another reflow to ensure display change is applied
        void modal.offsetHeight;

        refreshTaskDetailsModal(task);
        attachTaskModalListeners();

        document.body.style.overflow = 'hidden';
        const appContainer = document.getElementById('app-container');
        if (appContainer) {
            appContainer.style.filter = 'blur(4px)';
            appContainer.style.transition = 'filter 0.3s ease';
        }
        
        console.log('[MODAL OPEN] Task modal opened successfully');
    }, 150);
}

function attachTaskModalListeners() {
    console.log('[LISTENERS] Attaching task modal listeners');
    
    const addTaskCommentBtn = document.getElementById('add-task-comment-button');
    const approveTaskBtn = document.getElementById('approve-task-button');
    const rejectTaskBtn = document.getElementById('reject-task-button');
    const completeTaskBtn = document.getElementById('complete-task-button');
    const requestExtensionBtn = document.getElementById('request-extension-button');
    const deleteTaskBtn = document.getElementById('delete-task-button');

    // Remove old listeners by cloning and replacing
    if (addTaskCommentBtn) {
        const newBtn = addTaskCommentBtn.cloneNode(true);
        addTaskCommentBtn.parentNode.replaceChild(newBtn, addTaskCommentBtn);
        newBtn.addEventListener('click', handleAddTaskComment);
    }

    if (approveTaskBtn) {
        const newBtn = approveTaskBtn.cloneNode(true);
        approveTaskBtn.parentNode.replaceChild(newBtn, approveTaskBtn);
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('[BUTTON CLICK] Approve task button clicked');
            updateTaskStatus('approved');
        });
        console.log('[LISTENERS] Approve task button listener attached');
    }

    if (rejectTaskBtn) {
        const newBtn = rejectTaskBtn.cloneNode(true);
        rejectTaskBtn.parentNode.replaceChild(newBtn, rejectTaskBtn);
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('[BUTTON CLICK] Reject task button clicked');
            updateTaskStatus('rejected');
        });
        console.log('[LISTENERS] Reject task button listener attached');
    }

    if (completeTaskBtn) {
        const newBtn = completeTaskBtn.cloneNode(true);
        completeTaskBtn.parentNode.replaceChild(newBtn, completeTaskBtn);
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('[BUTTON CLICK] Complete task button clicked');
            updateTaskStatus('completed');
        });
    }

    if (requestExtensionBtn) {
        const newBtn = requestExtensionBtn.cloneNode(true);
        requestExtensionBtn.parentNode.replaceChild(newBtn, requestExtensionBtn);
        newBtn.addEventListener('click', handleRequestExtension);
    }

    if (deleteTaskBtn) {
        const newBtn = deleteTaskBtn.cloneNode(true);
        deleteTaskBtn.parentNode.replaceChild(newBtn, deleteTaskBtn);
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('[BUTTON CLICK] Delete task button clicked');
            handleDeleteTask();
        });
        console.log('[LISTENERS] Delete task button listener attached');
    }
}

function refreshTaskDetailsModal(task) {
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

    const assigneeElement = document.getElementById('task-details-assignee');
    const assigneeNames = getTaskAssigneeNames(task);

    if (assigneeNames.length > 1) {
        assigneeElement.innerHTML = assigneeNames.map(name =>
            `<span class="task-assignee-badge">${escapeHtml(name)}</span>`
        ).join(' ');
    } else {
        assigneeElement.textContent = assigneeNames[0] || 'Not assigned';
    }

    const createdDate = getTimestampValue(task.createdAt);
    const deadlineDate = new Date(task.deadline);

    document.getElementById('task-details-created').textContent = createdDate.toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
    });
    document.getElementById('task-details-deadline').textContent = deadlineDate.toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
    });
    document.getElementById('task-details-priority').textContent = (task.priority || 'medium').toUpperCase();

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
        const canDelete = isAdmin || isCreator;
        deleteButton.style.display = canDelete ? 'block' : 'none';
        console.log('[TASK MODAL] Delete button visibility:', {
            canDelete,
            isAdmin,
            isCreator,
            display: deleteButton.style.display
        });
    } else {
        console.error('[TASK MODAL] Delete task button not found in DOM');
    }

    renderTaskActivityFeed(task.activity || []);
}

function renderTaskActivityFeed(activity) {
    const feed = document.getElementById('task-details-activity-feed');
    if (!feed) return;

    feed.innerHTML = renderActivityWithTimestamps(activity);
}

async function updateTaskStatus(newStatus) {
    if (!currentlyViewedTaskId) {
        console.error('[TASK STATUS] No task ID provided');
        showNotification('No task selected. Please try again.', 'error');
        return;
    }

    const task = allTasks.find(t => t.id === currentlyViewedTaskId);
    if (!task) {
        console.error('[TASK STATUS] Task not found:', currentlyViewedTaskId);
        showNotification('Task not found.', 'error');
        return;
    }

    // Check permissions
    const isAdmin = currentUserRole === 'admin';
    const isAssignee = isUserAssignedToTask(task, currentUser.uid);
    const isCreator = currentUser.uid === task.creatorId;

    console.log('[TASK STATUS] Permission check:', {
        taskId: currentlyViewedTaskId,
        newStatus,
        currentUserRole,
        currentUserId: currentUser.uid,
        currentUserName,
        isAdmin,
        isAssignee,
        isCreator,
        taskStatus: task.status,
        taskCreatorId: task.creatorId,
        taskAssigneeId: task.assigneeId,
        taskAssigneeIds: task.assigneeIds
    });

    // Verify admin status from database
    try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        const userData = userDoc.data();
        console.log('[TASK STATUS] User document from database:', userData);
        console.log('[TASK STATUS] Database role:', userData?.role);
        
        if (userData?.role !== 'admin' && !isAdmin) {
            console.error('[TASK STATUS] Role mismatch! Local:', currentUserRole, 'Database:', userData?.role);
        }
    } catch (err) {
        console.error('[TASK STATUS] Could not verify user role:', err);
    }

    // Admin can approve/reject, assignee can mark complete
    if (newStatus === 'approved' || newStatus === 'rejected') {
        if (!isAdmin) {
            console.error('[TASK STATUS] Permission denied: User is not admin');
            showNotification('Only admins can approve or reject tasks.', 'error');
            return;
        }
    } else if (newStatus === 'completed') {
        if (!isAssignee && !isAdmin) {
            console.error('[TASK STATUS] Permission denied: User is not assignee or admin');
            showNotification('Only assigned team members can mark tasks as complete.', 'error');
            return;
        }
    }

    try {
        console.log('[TASK STATUS] Updating status to:', newStatus);
        console.log('[TASK STATUS] Current user:', currentUser.uid);
        console.log('[TASK STATUS] Task document ID:', currentlyViewedTaskId);
        
        const updates = {
            status: newStatus,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (newStatus === 'completed') {
            updates.completedAt = firebase.firestore.FieldValue.serverTimestamp();
        }

        const activityEntry = {
            text: `marked task as ${newStatus.replace('_', ' ')}`,
            authorName: currentUserName,
            timestamp: new Date()
        };

        console.log('[TASK STATUS] About to update with:', updates);
        console.log('[TASK STATUS] Activity entry:', activityEntry);

        await db.collection('tasks').doc(currentlyViewedTaskId).update({
            ...updates,
            activity: firebase.firestore.FieldValue.arrayUnion(activityEntry)
        });

        showNotification(`Task ${newStatus.replace('_', ' ')} successfully!`, 'success');
        console.log('[TASK STATUS] Status updated successfully');

    } catch (error) {
        console.error(`[TASK STATUS ERROR] Failed to update task status:`, error);
        console.error('[TASK STATUS ERROR] Error code:', error.code);
        console.error('[TASK STATUS ERROR] Error message:', error.message);
        console.error('[TASK STATUS ERROR] Error stack:', error.stack);
        
        let errorMessage = 'Failed to update task. ';
        if (error.code === 'permission-denied') {
            errorMessage += 'Permission denied. Please verify: 1) Your user role is "admin" in Firestore, 2) Security rules allow admin updates, 3) You are logged in correctly.';
            console.error('[FIRESTORE RULES] Permission denied! Check:');
            console.error('1. Is your role in Firestore set to "admin"?');
            console.error('2. Are the security rules published?');
            console.error('3. Try logging out and back in.');
        } else if (error.code === 'not-found') {
            errorMessage += 'Task not found in database.';
        } else if (error.code === 'unavailable') {
            errorMessage += 'Service temporarily unavailable. Please try again.';
        } else {
            errorMessage += `Error: ${error.message || 'Unknown error'}`;
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
                requestedAt: firebase.firestore.FieldValue.serverTimestamp()
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
    if (!currentlyViewedTaskId) {
        console.error('[DELETE] No task ID provided');
        showNotification('No task selected for deletion.', 'error');
        return;
    }

    const task = allTasks.find(t => t.id === currentlyViewedTaskId);
    if (!task) {
        console.error('[DELETE] Task not found:', currentlyViewedTaskId);
        showNotification('Task not found.', 'error');
        return;
    }

    const isAdmin = currentUserRole === 'admin';
    const isCreator = currentUser.uid === task.creatorId;

    console.log('[DELETE TASK] Permissions check:', {
        currentUserRole,
        isAdmin,
        isCreator,
        taskCreatorId: task.creatorId,
        currentUserId: currentUser.uid
    });

    if (!isAdmin && !isCreator) {
        showNotification('You can only delete tasks you created.', 'error');
        return;
    }

    const confirmMessage = `Are you sure you want to permanently delete "${task.title}"?\n\nThis action cannot be undone and will remove all associated data.`;
    
    if (confirm(confirmMessage)) {
        try {
            console.log('[DELETE] Deleting task:', currentlyViewedTaskId);
            await db.collection('tasks').doc(currentlyViewedTaskId).delete();
            showNotification('Task deleted successfully!', 'success');
            console.log('[DELETE] Task deleted successfully');
            
            // Close modal after a short delay
            setTimeout(() => {
                closeAllModals();
            }, 500);
        } catch (error) {
            console.error('[DELETE ERROR] Failed to delete task:', error);
            let errorMessage = 'Failed to delete task. ';
            
            if (error.code === 'permission-denied') {
                errorMessage += 'You do not have permission to delete this task.';
            } else if (error.code === 'not-found') {
                errorMessage += 'Task not found.';
            } else {
                errorMessage += 'Please try again or contact support.';
            }
            
            showNotification(errorMessage, 'error');
        }
    }
}

// ==================
//  Projects
// ==================
function openProjectModal() {
    console.log('[OPEN MODAL] Opening project modal...');
    
    // Reset form
    const form = document.getElementById('project-form');
    if (form) {
        form.reset();
        console.log('[OPEN MODAL] Form reset');
    } else {
        console.error('[OPEN MODAL] Form not found!');
    }
    
    // Set modal title
    const modalTitle = document.getElementById('modal-title');
    if (modalTitle) {
        modalTitle.textContent = 'Propose New Article';
    }
    
    // Set default project type based on current view
    const projectTypeSelect = document.getElementById('project-type');
    if (projectTypeSelect) {
        if (currentView === 'interviews' || currentView === 'dashboard') {
            projectTypeSelect.value = 'Interview';
        } else if (currentView === 'opeds') {
            projectTypeSelect.value = 'Op-Ed';
        }
    }
    
    // Show modal
    const modal = document.getElementById('project-modal');
    if (modal) {
        modal.style.display = 'flex';
        console.log('[OPEN MODAL] Modal display set to flex');
        
        // Apply blur and disable scrolling
        document.body.style.overflow = 'hidden';
        const appContainer = document.getElementById('app-container');
        if (appContainer) {
            appContainer.style.filter = 'blur(4px)';
            appContainer.style.transition = 'filter 0.3s ease';
        }
        
        // Focus on title field after a short delay
        setTimeout(() => {
            const titleInput = document.getElementById('project-title');
            if (titleInput) {
                titleInput.focus();
                console.log('[OPEN MODAL] Title input focused');
            }
        }, 100);
        
        console.log('[OPEN MODAL] Modal opened successfully');
    } else {
        console.error('[OPEN MODAL] Modal element not found!');
    }
}

if (typeof window !== 'undefined') {
    window.openProjectModal = openProjectModal;
}

function openDetailsModal(projectId) {
    const project = allProjects.find(p => p.id === projectId);
    if (!project) {
        console.error('[MODAL] Project not found:', projectId);
        showNotification('Project not found. Please refresh the page.', 'error');
        return;
    }

    console.log('[MODAL OPEN] Opening project modal:', projectId);
    
    // Force close all modals first and clear any lingering states
    closeAllModals();
    
    // Use setTimeout to ensure closing is complete before opening new modal
    // Increased timeout to 150ms for smoother transition
    setTimeout(() => {
        // Set project ID in both local and window scope for maximum compatibility
        currentlyViewedProjectId = projectId;
        window.currentlyViewedProjectId = projectId;
        console.log('[MODAL OPEN] Set currentlyViewedProjectId:', projectId);
        console.log('[MODAL OPEN] Set window.currentlyViewedProjectId:', projectId);

        const modal = document.getElementById('details-modal');
        if (!modal) {
            console.error('[MODAL] Modal element not found');
            return;
        }
        
        // Store project ID in modal dataset for reliable access
        modal.dataset.projectId = projectId;
        console.log('[MODAL OPEN] Stored project ID in modal dataset:', projectId);

        // Ensure modal is completely reset before opening
        modal.style.display = 'none';
        modal.style.opacity = '';
        modal.style.visibility = '';
        modal.style.transition = '';
        
        // Force browser reflow to apply the reset
        void modal.offsetHeight;
        
        // Now set display to flex to show the modal
        modal.style.display = 'flex';
        
        // Another reflow to ensure display change is applied
        void modal.offsetHeight;

        refreshDetailsModal(project);
        attachProjectModalListeners();

        document.body.style.overflow = 'hidden';
        const appContainer = document.getElementById('app-container');
        if (appContainer) {
            appContainer.style.filter = 'blur(4px)';
            appContainer.style.transition = 'filter 0.3s ease';
        }
        
        console.log('[MODAL OPEN] Project modal opened successfully');
    }, 150);
}

function attachProjectModalListeners() {
    console.log('[LISTENERS] Attaching project modal listeners');
    
    const addCommentBtn = document.getElementById('add-comment-button');
    const assignEditorBtn = document.getElementById('assign-editor-button');
    const deleteProjectBtn = document.getElementById('delete-project-button');
    const approveBtn = document.getElementById('approve-button');
    const rejectBtn = document.getElementById('reject-button');

    // Remove old listeners by cloning and replacing
    if (addCommentBtn) {
        const newBtn = addCommentBtn.cloneNode(true);
        addCommentBtn.parentNode.replaceChild(newBtn, addCommentBtn);
        newBtn.addEventListener('click', handleAddComment);
    }

    if (assignEditorBtn) {
        const newBtn = assignEditorBtn.cloneNode(true);
        assignEditorBtn.parentNode.replaceChild(newBtn, assignEditorBtn);
        newBtn.addEventListener('click', handleAssignEditor);
    }

    if (deleteProjectBtn) {
        const newBtn = deleteProjectBtn.cloneNode(true);
        deleteProjectBtn.parentNode.replaceChild(newBtn, deleteProjectBtn);
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('[BUTTON CLICK] Delete project button clicked');
            handleDeleteProject();
        });
        console.log('[LISTENERS] Delete project button listener attached');
    }

    if (approveBtn) {
        const newBtn = approveBtn.cloneNode(true);
        approveBtn.parentNode.replaceChild(newBtn, approveBtn);
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('[BUTTON CLICK] Approve button clicked');
            approveProposal(currentlyViewedProjectId);
        });
        console.log('[LISTENERS] Approve button listener attached');
    }

    if (rejectBtn) {
        const newBtn = rejectBtn.cloneNode(true);
        rejectBtn.parentNode.replaceChild(newBtn, rejectBtn);
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('[BUTTON CLICK] Reject button clicked');
            updateProposalStatus('rejected');
        });
        console.log('[LISTENERS] Reject button listener attached');
    }

    const setDeadlinesBtn = document.getElementById('set-deadlines-button');
    if (setDeadlinesBtn) {
        const newBtn = setDeadlinesBtn.cloneNode(true);
        setDeadlinesBtn.parentNode.replaceChild(newBtn, setDeadlinesBtn);
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('[BUTTON CLICK] Set deadlines button clicked');
            handleSetDeadlines();
        });
        console.log('[LISTENERS] Set deadlines button listener attached');
    }

    const requestDeadlineBtn = document.getElementById('request-deadline-change-button');
    if (requestDeadlineBtn) {
        const newBtn = requestDeadlineBtn.cloneNode(true);
        requestDeadlineBtn.parentNode.replaceChild(newBtn, requestDeadlineBtn);
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('[BUTTON CLICK] Request deadline change button clicked');
            handleRequestDeadlineChange();
        });
        console.log('[LISTENERS] Request deadline change listener attached');
    }

    // Attach edit button listeners for proposal editing
    if (typeof window.attachEditListeners === 'function') {
        window.attachEditListeners();
    }
}

function refreshDetailsModal(project) {
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

    titleEl.textContent = project.title;
    authorEl.textContent = project.authorName;
    editorEl.textContent = project.editorName || 'Not Assigned';

    const state = resolveProjectState(project, currentView, currentUser);
    statusEl.textContent = state.statusText;

    const finalDeadline = project.deadlines ? project.deadlines.publication : project.deadline;
    if (finalDeadline) {
        document.getElementById('details-publication-deadline').textContent =
            new Date(finalDeadline + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } else {
        document.getElementById('details-publication-deadline').textContent = 'Not set';
    }

    // Ensure proposal element is in paragraph mode (not textarea)
    let proposalElement = document.getElementById('details-proposal');
    const textareaElement = document.getElementById('proposal-edit-textarea');

    // If in edit mode, convert back to paragraph first
    if (textareaElement) {
        const paragraph = document.createElement('p');
        paragraph.id = 'details-proposal';
        paragraph.textContent = project.proposal || 'No proposal provided.';
        textareaElement.replaceWith(paragraph);
        proposalElement = paragraph;

        // Hide save/cancel buttons, show edit button
        const saveBtn = document.getElementById('save-proposal-button');
        const cancelBtn = document.getElementById('cancel-proposal-button');
        const editBtn = document.getElementById('edit-proposal-button');
        if (saveBtn) saveBtn.style.display = 'none';
        if (cancelBtn) cancelBtn.style.display = 'none';
        if (editBtn) editBtn.style.display = 'inline-block';
    } else if (proposalElement) {
        proposalElement.textContent = project.proposal || 'No proposal provided.';
    }

    const canEditProposal = isAuthor || isAdmin;
    const editBtn = document.getElementById('edit-proposal-button');
    if (editBtn) editBtn.style.display = canEditProposal ? 'inline-block' : 'none';

    const approvalSection = document.getElementById('admin-approval-section');
    if (approvalSection) {
        approvalSection.style.display = isAdmin && project.proposalStatus === 'pending' ? 'block' : 'none';
    }

    // Allow admins to assign/reassign editors at any time
    const assignSection = document.getElementById('assign-editor-section');
    if (assignSection) {
        assignSection.style.display = isAdmin ? 'flex' : 'none';
        
        // Update button text based on whether editor is already assigned
        const assignButton = document.getElementById('assign-editor-button');
        if (assignButton) {
            if (project.editorId) {
                assignButton.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink: 0;">
                        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                    </svg>
                    Reassign Editor
                `;
            } else {
                assignButton.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink: 0;">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="16"></line>
                        <line x1="8" y1="12" x2="16" y2="12"></line>
                    </svg>
                    Assign Editor
                `;
            }
        }
    }

    populateEditorDropdown(project.editorId);
    renderTimeline(project, isAuthor, isEditor, isAdmin);
    renderDeadlines(project, isAuthor, isEditor, isAdmin);
    renderDeadlineRequestSection(project, isAuthor, isAdmin);
    renderActivityFeed(project.activity || []);

    const deleteButton = document.getElementById('delete-project-button');
    if (deleteButton) {
        const canDelete = isAuthor || isAdmin;
        deleteButton.style.display = canDelete ? 'block' : 'none';
        console.log('[MODAL] Delete button visibility:', {
            canDelete,
            isAuthor,
            isAdmin,
            display: deleteButton.style.display
        });
    } else {
        console.error('[MODAL] Delete project button not found in DOM');
    }
}

function renderTimeline(project, isAuthor, isEditor, isAdmin) {
    const timelineContainer = document.getElementById('details-timeline');
    if (!timelineContainer) {
        console.error('[TIMELINE] Timeline container not found');
        return;
    }
    
    timelineContainer.innerHTML = '';
    const timeline = project.timeline || {};
    
    console.log('[TIMELINE] Rendering timeline for project:', {
        projectId: project.id,
        isAuthor,
        isEditor,
        isAdmin,
        timeline
    });

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

        // Allow admins, authors for their tasks, and editors for their tasks
        if (isAdmin) {
            canEditTask = true;
        } else if (isAuthor && authorTasks.includes(task)) {
            canEditTask = true;
        } else if (isEditor && editorTasks.includes(task)) {
            canEditTask = true;
        }

        // Topic Proposal Complete should never be editable (set by system)
        if (task === "Topic Proposal Complete") {
            canEditTask = false;
        }

        const completed = timeline[task] || false;
        const taskEl = document.createElement('div');
        taskEl.className = 'task';
        const taskId = `task-${project.id}-${task.replace(/\s+/g, '-')}`;
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = taskId;
        checkbox.checked = completed;
        checkbox.disabled = !canEditTask;
        
        const label = document.createElement('label');
        label.htmlFor = taskId;
        label.textContent = task;
        
        taskEl.appendChild(checkbox);
        taskEl.appendChild(label);

        if (canEditTask) {
            checkbox.addEventListener('change', async (e) => {
                const isChecked = e.target.checked;
                const previousValue = !isChecked; // Store the previous value
                
                console.log('========================================');
                console.log('[TIMELINE CHECKBOX] User clicked checkbox!');
                console.log('[TIMELINE CHECKBOX] Task:', task);
                console.log('[TIMELINE CHECKBOX] New value:', isChecked);
                console.log('[TIMELINE CHECKBOX] Previous value:', previousValue);
                console.log('[TIMELINE CHECKBOX] Project ID:', project.id);
                console.log('[TIMELINE CHECKBOX] User:', currentUserName);
                console.log('[TIMELINE CHECKBOX] Can edit:', canEditTask);
                console.log('[TIMELINE CHECKBOX] Firebase DB available:', !!db);
                console.log('========================================');
                
                // Disable checkbox while processing
                checkbox.disabled = true;
                const checkboxLabel = checkbox.nextElementSibling;
                if (checkboxLabel) {
                    checkboxLabel.style.opacity = '0.5';
                }
                
                try {
                    console.log('[TIMELINE CHECKBOX] Calling handleTaskCompletion...');
                    await handleTaskCompletion(project.id, task, isChecked, db, currentUserName);
                    console.log('[TIMELINE CHECKBOX] SUCCESS! Task completion handled');
                    
                    // Re-enable after success
                    checkbox.disabled = false;
                    if (checkboxLabel) {
                        checkboxLabel.style.opacity = '1';
                    }
                } catch (error) {
                    console.error('========================================');
                    console.error('[TIMELINE CHECKBOX] FAILED!');
                    console.error('[TIMELINE CHECKBOX] Error:', error);
                    console.error('[TIMELINE CHECKBOX] Error code:', error?.code);
                    console.error('[TIMELINE CHECKBOX] Error message:', error?.message);
                    console.error('========================================');
                    
                    // Revert checkbox on error
                    e.target.checked = previousValue;
                    checkbox.disabled = false;
                    if (checkboxLabel) {
                        checkboxLabel.style.opacity = '1';
                    }
                    // Error notification already shown in handleTaskCompletion
                }
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

    if (!activity || !Array.isArray(activity)) {
        activityFeed.innerHTML = '<p>No activity yet.</p>';
        return;
    }

    activityFeed.innerHTML = renderActivityWithTimestamps(activity);
}

async function handleProjectFormSubmit(e) {
    if (e) {
        if (typeof e.preventDefault === 'function') e.preventDefault();
        if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }
    
    console.log('========================================');
    console.log('[PROJECT SUBMIT] FORM SUBMISSION STARTED');
    if (e) {
        console.log('[PROJECT SUBMIT] Event:', e);
        console.log('[PROJECT SUBMIT] Event type:', e.type);
    } else {
        console.log('[PROJECT SUBMIT] Event: none (manual invoke)');
    }
    console.log('[PROJECT SUBMIT] Timestamp:', new Date().toISOString());
    console.log('========================================');

    const submitButton = document.getElementById('save-project-button');
    if (!submitButton) {
        console.error('[PROJECT SUBMIT] Submit button not found!');
        showNotification('Form error. Please refresh and try again.', 'error');
        return;
    }

    if (submitButton.dataset.submitting === 'true') {
        console.warn('[PROJECT SUBMIT] Duplicate submission prevented');
        return;
    }

    const originalText = submitButton.textContent;

    // Validate required fields before processing
    const titleInput = document.getElementById('project-title');
    const typeInput = document.getElementById('project-type');
    const proposalInput = document.getElementById('project-proposal');
    const deadlineInput = document.getElementById('project-deadline');

    if (!titleInput || !typeInput || !proposalInput || !deadlineInput) {
        console.error('[PROJECT SUBMIT] Required form fields missing!');
        showNotification('Form error. Please refresh the page.', 'error');
        return;
    }

    const title = titleInput.value.trim();
    const type = typeInput.value;
    const proposal = proposalInput.value.trim();
    const deadline = deadlineInput.value;

    console.log('[PROJECT SUBMIT] Form values:', { title, type, proposal: proposal.substring(0, 50), deadline });

    // Validation
    if (!title || title.length < 3) {
        showNotification('Please enter a title with at least 3 characters.', 'error');
        titleInput.focus();
        return;
    }

    if (!type) {
        showNotification('Please select a project type.', 'error');
        typeInput.focus();
        return;
    }

    if (!deadline) {
        showNotification('Please set a publication deadline.', 'error');
        deadlineInput.focus();
        return;
    }

    // Validate deadline is in the future
    const deadlineDate = new Date(deadline);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (deadlineDate < today) {
        showNotification('Publication deadline must be in the future.', 'error');
        deadlineInput.focus();
        return;
    }

    if (!currentUser || !currentUser.uid) {
        console.error('[PROJECT SUBMIT] No authenticated user available');
        showNotification('Your session expired. Please sign in again before submitting a proposal.', 'error');
        return;
    }

    const authorId = currentUser.uid;
    const authorName = currentUserName || currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'Unknown User');
    const normalizedProposal = proposal || 'No proposal provided.';

    try {
        submitButton.disabled = true;
        submitButton.classList.add('loading');
        submitButton.textContent = 'Submitting...';
        submitButton.dataset.submitting = 'true';
        console.log('[PROJECT SUBMIT] Button disabled, preparing data...');

        // Create timeline based on project type
        const timeline = {};
        const tasks = type === "Interview"
            ? ["Topic Proposal Complete", "Interview Scheduled", "Interview Complete",
               "Article Writing Complete", "Review In Progress", "Review Complete", "Suggestions Reviewed"]
            : ["Topic Proposal Complete", "Article Writing Complete",
               "Review In Progress", "Review Complete", "Suggestions Reviewed"];

        tasks.forEach(task => timeline[task] = false);
        console.log('[PROJECT SUBMIT] Timeline created:', timeline);

        // Prepare project data
        const projectData = {
            title: title,
            type: type,
            proposal: normalizedProposal,
            deadline: deadline,
            deadlines: {
                publication: deadline,
                contact: '',
                interview: '',
                draft: '',
                review: '',
                edits: ''
            },
            authorId: authorId,
            authorName: authorName,
            editorId: null,
            editorName: null,
            proposalStatus: 'pending',
            timeline: timeline,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            activity: [{
                text: 'created the project.',
                authorName: authorName,
                timestamp: new Date()
            }]
        };

        console.log('[PROJECT SUBMIT] Project data prepared:', {
            title: projectData.title,
            type: projectData.type,
            authorId: projectData.authorId,
            authorName: projectData.authorName,
            proposalStatus: projectData.proposalStatus
        });

        // Check Firebase connection
        if (!db) {
            throw new Error('Database connection not available');
        }

        console.log('[PROJECT SUBMIT] Adding document to Firestore...');
        const docRef = await db.collection('projects').add(projectData);
        console.log('[PROJECT SUBMIT] Document added successfully. ID:', docRef.id);

        const nowSeconds = Math.floor(Date.now() / 1000);
        const localProject = {
            id: docRef.id,
            title,
            type,
            proposal: normalizedProposal,
            deadline,
            deadlines: { ...projectData.deadlines },
            authorId,
            authorName,
            editorId: null,
            editorName: null,
            proposalStatus: 'pending',
            timeline: { ...timeline },
            createdAt: { seconds: nowSeconds },
            updatedAt: { seconds: nowSeconds },
            activity: [{
                text: 'created the project.',
                authorName,
                timestamp: { seconds: nowSeconds }
            }]
        };

        allProjects = [localProject, ...allProjects.filter(p => p.id !== docRef.id)];
        console.log('[PROJECT SUBMIT] Local project inserted for immediate UI update');
        updateNavCounts();
        renderCurrentViewEnhanced();

        showNotification('Project proposal submitted successfully!', 'success');

        // Reset form
        document.getElementById('project-form').reset();
        console.log('[PROJECT SUBMIT] Form reset');

        // Close modal after short delay
        setTimeout(() => {
            console.log('[PROJECT SUBMIT] Closing modal...');
            closeAllModals();
        }, 1000);

    } catch (error) {
        console.error('========================================');
        console.error('[PROJECT SUBMIT ERROR] Failed to create project');
        console.error('[PROJECT SUBMIT ERROR] Error:', error);
        console.error('[PROJECT SUBMIT ERROR] Error code:', error.code);
        console.error('[PROJECT SUBMIT ERROR] Error message:', error.message);
        console.error('[PROJECT SUBMIT ERROR] Error stack:', error.stack);
        console.error('========================================');
        
        let errorMessage = 'Failed to create project. ';
        
        if (error.code === 'permission-denied') {
            errorMessage += 'Permission denied. Please check: 1) You are logged in, 2) Firestore security rules allow write access, 3) Your account has the correct permissions.';
        } else if (error.code === 'unavailable') {
            errorMessage += 'Database temporarily unavailable. Please check your internet connection and try again.';
        } else if (error.message) {
            errorMessage += error.message;
        } else {
            errorMessage += 'Please try again or contact support.';
        }
        
        showNotification(errorMessage, 'error');

    } finally {
        submitButton.disabled = false;
        submitButton.classList.remove('loading');
        submitButton.textContent = originalText;
        delete submitButton.dataset.submitting;
        console.log('[PROJECT SUBMIT] Button re-enabled');
    }
}

if (typeof window !== 'undefined') {
    window.handleProjectFormSubmit = handleProjectFormSubmit;
}



// ==================
//  Kanban Board
// ==================
function isAwaitingEditorAssignment(project) {
    if (!project) return false;
    const timeline = project.timeline || {};

    return project.proposalStatus === 'approved' &&
        timeline["Article Writing Complete"] === true &&
        !timeline["Suggestions Reviewed"] &&
        !project.editorId;
}

function resolveColumnsForView(view) {
    if (typeof getColumnsForView === 'function') {
        const columns = getColumnsForView(view);
        if (Array.isArray(columns) && columns.length > 0) {
            return columns;
        }
    }

    if (view === 'my-assignments') {
        return ['To Do', 'In Progress', 'In Review', 'Done'];
    }

    return ['Topic Proposal', 'Interview Stage', 'Writing Stage', 'In Review', 'Reviewing Suggestions', 'Completed'];
}

function resolveProjectState(project, view, user) {
    const awaitingEditor = isAwaitingEditorAssignment(project);

    if (typeof getProjectState === 'function') {
        const state = getProjectState(project, view, user);
        if (view === 'my-assignments' && currentUserRole === 'admin' && awaitingEditor) {
            return {
                ...state,
                column: 'In Progress',
                color: 'yellow',
                statusText: 'Awaiting Editor Assignment'
            };
        }
        return state;
    }

    if (view === 'my-assignments' && currentUserRole === 'admin' && awaitingEditor) {
        return {
            column: 'In Progress',
            color: 'yellow',
            statusText: 'Awaiting Editor Assignment'
        };
    }

    return {
        column: 'Topic Proposal',
        color: 'default',
        statusText: 'Pending'
    };
}

function handlePendingEditorAlerts() {
    if (currentUserRole !== 'admin' || !currentUser) {
        pendingEditorAlertedProjects.clear();
        return;
    }

    const pendingProjects = allProjects.filter(isAwaitingEditorAssignment);
    const pendingIds = new Set(pendingProjects.map(project => project.id));

    pendingProjects.forEach(project => {
        if (!pendingEditorAlertedProjects.has(project.id)) {
            showNotification(`"${project.title}" is awaiting an editor assignment.`, 'warning');
            pendingEditorAlertedProjects.add(project.id);
        }
    });

    Array.from(pendingEditorAlertedProjects).forEach(projectId => {
        if (!pendingIds.has(projectId)) {
            pendingEditorAlertedProjects.delete(projectId);
        }
    });
}

function ensureTaskFormSubmitListener() {
    if (taskFormSubmitListenerAttached) {
        return;
    }

    document.addEventListener('submit', (event) => {
        const form = event.target;
        if (form && form.id === 'task-form') {
            event.preventDefault();
            handleTaskFormSubmit(event);
        }
    }, true);

    taskFormSubmitListenerAttached = true;
    console.log('[SETUP] Delegated task form handler attached');
}

function ensureGlobalModalCloseHandler() {
    if (modalCloseDelegationAttached) {
        return;
    }

    document.addEventListener('click', (event) => {
        const closeBtn = event.target.closest('.close-button');
        if (closeBtn) {
            event.preventDefault();
            event.stopPropagation();
            closeAllModals();
            return;
        }

        const target = event.target;
        if (target && target.classList && target.classList.contains('modal-overlay')) {
            event.preventDefault();
            closeAllModals();
        }
    });

    modalCloseDelegationAttached = true;
    console.log('[SETUP] Global modal close delegation attached');
}

function renderKanbanBoard(projects) {
    const board = document.getElementById('kanban-board');
    board.innerHTML = '';

    const columns = resolveColumnsForView(currentView);

    const meta = {
        'Pitch': { icon: '', sub: 'Submit idea, await approval' },
        'Outreach & Prep': { icon: '', sub: 'Contact interviews, outline, prep' },
        'Interview': { icon: '', sub: 'Interview scheduled/in progress' },
        'Writing Stage': { icon: '', sub: 'Write and shape story' },
        'Drafting': { icon: '', sub: 'Write and shape story' },
        'In Review': { icon: '', sub: 'Editor review in progress' },
        'Editor Review': { icon: '', sub: 'Editor review in progress' },
        'Reviewing Suggestions': { icon: '', sub: 'Photos, citations, punctuation' },
        'Copy Edit': { icon: '', sub: 'Photos, citations, punctuation' },
        'Completed': { icon: '', sub: 'Done' }
    };

    columns.forEach(columnTitle => {
        const columnProjects = projects.filter(project => {
            const state = resolveProjectState(project, currentView, currentUser);
            return state.column === columnTitle;
        });

        const columnEl = document.createElement('div');
        columnEl.className = 'kanban-column';

        const { icon, sub } = meta[columnTitle] || { icon: '', sub: '' };
        columnEl.innerHTML = `
            <div class="column-header">
                <div class="column-title">
                    <div class="column-title-main">
                      <span class="column-title-text">${columnTitle}</span>
                    </div>
                    <span class="task-count">${columnProjects.length}</span>
                </div>
                ${sub ? `<div class=\"column-subtitle\">${sub}</div>` : ''}
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
        case 'dashboard':
        case 'interviews':
            return allProjects.filter(p => p.type === 'Interview');
        case 'opeds':
            return allProjects.filter(p => p.type === 'Op-Ed');
        case 'my-assignments':
            const userId = currentUser ? currentUser.uid : null;
            const myProjects = userId
                ? allProjects.filter(p => p.authorId === userId || p.editorId === userId)
                : [];

            let adminQueue = [];
            if (currentUserRole === 'admin') {
                adminQueue = allProjects.filter(isAwaitingEditorAssignment);
            }

            const projectMap = new Map();
            [...myProjects, ...adminQueue].forEach(project => {
                if (project && project.id) {
                    projectMap.set(project.id, project);
                }
            });

            const myTasks = userId
                ? allTasks
                    .filter(t => t.creatorId === userId || isUserAssignedToTask(t, userId))
                    .map(t => ({ ...t, isTask: true }))
                : [];

            return [...projectMap.values(), ...myTasks];
        default:
            return allProjects;
    }
}

function createProjectCard(project) {
    if (project.isTask) {
        return createTaskCardForAssignments(project);
    }

    const state = resolveProjectState(project, currentView, currentUser);
    const card = document.createElement('div');

    // Add column-based class for color coding
    let columnClass = '';
    if (state.column === 'Completed') {
        columnClass = 'column-completed';
    } else if (state.column === 'In Progress') {
        columnClass = 'column-in-progress';
    } else if (state.column === 'Approved') {
        columnClass = 'column-approved';
    } else if (state.column === 'Pending Approval') {
        columnClass = 'column-pending';
    }

    card.className = `kanban-card status-${state.color} ${columnClass}`;
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

    card.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
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

    for (let i = firstDay - 1; i >= 0; i--) {
        const dayDate = new Date(prevMonth);
        dayDate.setDate(prevMonth.getDate() - i);
        createCalendarDay(calendarGrid, dayDate, true, today);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dayDate = new Date(year, month, day);
        createCalendarDay(calendarGrid, dayDate, false, today);
    }

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
        eventEl.textContent = `${item.title}`;
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
    const now = new Date();
    now.setHours(0, 0, 0, 0);

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

    allProjects.forEach(project => {
        const deadlines = project.deadlines || {};
        const finalDeadline = deadlines.publication || project.deadline;

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

                    const state = resolveProjectState(project, currentView, currentUser);
                    if (deadline < now && state.column !== 'Completed' && !state.statusText.includes('Completed')) {
                        overdueCount++;
                    }
                }
            } catch (error) {
                console.error('[CALENDAR STATS] Error parsing final deadline:', error);
            }
        }

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
            const { eventTitle } = getEventTypeForDate(item, date);
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
    console.log('[MODAL CLOSE] Closing all modals');
    const modals = document.querySelectorAll('.modal-overlay');

    modals.forEach(modal => {
        // Remove all inline styles to reset state completely
        modal.style.display = 'none';
        modal.style.opacity = '';
        modal.style.visibility = '';
        modal.classList.remove('loading', 'closing');
        
        // Clear any content opacity
        const content = modal.querySelector('.details-container');
        if (content) {
            content.style.opacity = '';
        }
    });

    currentlyViewedProjectId = null;
    currentlyViewedTaskId = null;
    if (typeof window !== 'undefined') {
        window.currentlyViewedProjectId = null;
        window.currentlyViewedTaskId = null;
    }
    disableProposalEditing({ revertToOriginal: true });

    document.body.style.overflow = '';
    const appContainer = document.getElementById('app-container');
    if (appContainer) {
        appContainer.style.filter = '';
    }
    
    // Force browser to apply the display:none before continuing
    document.body.offsetHeight; // Force reflow
    
    console.log('[MODAL CLOSE] All modals closed and reset');
}

if (typeof window !== 'undefined') {
    window.__modalManagerV2Applied = true;
}

// ==================
//  Status Reports
// ==================
function generateStatusReport() {
    const reportModal = document.getElementById('report-modal');
    const reportContent = document.getElementById('report-content');
    if (!reportModal || !reportContent) {
        console.error('[REPORT] Modal elements not found');
        return;
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const userWorkload = {};

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

    allProjects.forEach(project => {
        const state = resolveProjectState(project, currentView, currentUser);
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

        if (project.authorId && userWorkload[project.authorId]) {
            userWorkload[project.authorId].projects.push(projectInfo);
            if (status === 'overdue') userWorkload[project.authorId].overdue++;
            else if (status === 'completed') userWorkload[project.authorId].completed++;
            else userWorkload[project.authorId].onTrack++;
        }

        if (project.editorId && userWorkload[project.editorId]) {
            userWorkload[project.editorId].projects.push(projectInfo);
            if (status === 'overdue') userWorkload[project.editorId].overdue++;
            else if (status === 'completed') userWorkload[project.editorId].completed++;
            else userWorkload[project.editorId].onTrack++;
        }
    });

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

    const totalOverdue = Object.values(userWorkload).reduce((sum, user) => sum + user.overdue, 0);
    const totalOnTrack = Object.values(userWorkload).reduce((sum, user) => sum + user.onTrack, 0);
    const totalCompleted = Object.values(userWorkload).reduce((sum, user) => sum + user.completed, 0);
    const activeUsers = Object.values(userWorkload).filter(u => u.projects.length > 0 || u.tasks.length > 0).length;

    let reportHTML = `
        <div class="report-header">
            <h2>Team Status Report</h2>
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
            <h2>Executive Summary</h2>
            <div class="summary-grid">
                <div class="summary-item total">
                    <div class="summary-icon"></div>
                    <div class="summary-value">${activeUsers}</div>
                    <div class="summary-label">Active Team Members</div>
                </div>
                <div class="summary-item ${totalOverdue > 0 ? 'overdue' : ''}">
                    <div class="summary-icon"></div>
                    <div class="summary-value">${totalOverdue}</div>
                    <div class="summary-label">Overdue Items</div>
                </div>
                <div class="summary-item on-track">
                    <div class="summary-icon"></div>
                    <div class="summary-value">${totalOnTrack}</div>
                    <div class="summary-label">On Track</div>
                </div>
                <div class="summary-item completed">
                    <div class="summary-icon"></div>
                    <div class="summary-value">${totalCompleted}</div>
                    <div class="summary-label">Completed</div>
                </div>
            </div>
        </div>
    `;

    const sortedUsers = Object.values(userWorkload)
        .filter(u => u.projects.length > 0 || u.tasks.length > 0)
        .sort((a, b) => {
            if (b.overdue !== a.overdue) return b.overdue - a.overdue;
            return (b.projects.length + b.tasks.length) - (a.projects.length + a.tasks.length);
        });

    if (sortedUsers.length > 0) {
        reportHTML += `
            <div class="report-section team-details">
                <h2>Team Member Breakdown</h2>
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
                            <span class="stat-value">${user.overdue}</span>
                            <span class="stat-label">Overdue</span>
                        </div>
                        <div class="stat-item on-track">
                            <span class="stat-value">${user.onTrack}</span>
                            <span class="stat-label">On Track</span>
                        </div>
                        <div class="stat-item completed">
                            <span class="stat-value">${user.completed}</span>
                            <span class="stat-label">Done</span>
                        </div>
                    </div>
            `;

            if (user.projects.length > 0) {
                reportHTML += `
                    <div class="user-work-section">
                        <h4>Projects (${user.projects.length})</h4>
                        <div class="work-items">
                `;

                user.projects.forEach(project => {
                    const deadlineText = project.daysUntilDeadline !== null
                        ? (project.daysUntilDeadline < 0
                            ? `${Math.abs(project.daysUntilDeadline)} days overdue`
                            : `${project.daysUntilDeadline} days remaining`)
                        : 'No deadline';

                    reportHTML += `
                        <div class="work-item ${project.status}" data-id="${project.id}" onclick="openDetailsModal('${project.id}')">
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

            if (user.tasks.length > 0) {
                reportHTML += `
                    <div class="user-work-section">
                        <h4>Tasks (${user.tasks.length})</h4>
                        <div class="work-items">
                `;

                user.tasks.forEach(task => {
                    const deadlineText = task.daysUntilDeadline !== null
                        ? (task.daysUntilDeadline < 0
                            ? `${Math.abs(task.daysUntilDeadline)} days overdue`
                            : `${task.daysUntilDeadline} days remaining`)
                        : 'No deadline';

                    reportHTML += `
                        <div class="work-item ${task.status}" data-id="${task.id}" data-type="task" onclick="openTaskDetailsModal('${task.id}')">
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

            reportHTML += `</div>`;
        });

        reportHTML += `</div>`;
    }

    reportHTML += `
        <div class="report-section recommendations">
            <h2>Recommendations</h2>
            <div class="recommendation-list">
    `;

    const highWorkloadUsers = sortedUsers.filter(u => (u.projects.length + u.tasks.length) > 10);
    const overdueUsers = sortedUsers.filter(u => u.overdue > 0);

    if (overdueUsers.length > 0) {
        reportHTML += `
            <div class="recommendation-item urgent">
                <span class="recommendation-icon"></span>
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
                <span class="recommendation-icon"></span>
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
                <span class="recommendation-icon"></span>
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
}

// ==================
//  Proposal Editing
// ==================
const PROPOSAL_PLACEHOLDER_TEXT = 'No proposal provided.';

function enableProposalEditing() {
    const displayElement = document.getElementById('details-proposal');
    const editBtn = document.getElementById('edit-proposal-button');
    const saveBtn = document.getElementById('save-proposal-button');
    const cancelBtn = document.getElementById('cancel-proposal-button');

    if (!displayElement) {
        console.error('[PROPOSAL EDIT] Display element not found');
        return;
    }

    // Prevent duplicate textareas if button is clicked multiple times
    const existingTextarea = document.getElementById('proposal-edit-textarea');
    if (existingTextarea) {
        existingTextarea.focus();
        existingTextarea.setSelectionRange(existingTextarea.value.length, existingTextarea.value.length);
        return;
    }

    let originalText = (displayElement.textContent || '').trim();
    if (originalText === PROPOSAL_PLACEHOLDER_TEXT) {
        originalText = '';
    }

    const textarea = document.createElement('textarea');
    textarea.id = 'proposal-edit-textarea';
    textarea.className = 'edit-proposal-textarea';
    textarea.value = originalText;
    textarea.dataset.originalText = originalText;
    textarea.setAttribute('aria-label', 'Edit proposal text');

    textarea.addEventListener('input', () => {
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
    });

    const parent = displayElement.parentNode;
    if (parent) {
        parent.replaceChild(textarea, displayElement);
    }

    // Trigger autoresize once content is in place
    requestAnimationFrame(() => {
        textarea.dispatchEvent(new Event('input'));
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    });

    if (editBtn) editBtn.style.display = 'none';
    if (saveBtn) saveBtn.style.display = 'inline-block';
    if (cancelBtn) cancelBtn.style.display = 'inline-block';
}

function disableProposalEditing({ revertToOriginal = false } = {}) {
    const textarea = document.getElementById('proposal-edit-textarea');
    let proposalElement = document.getElementById('details-proposal');
    const editBtn = document.getElementById('edit-proposal-button');
    const saveBtn = document.getElementById('save-proposal-button');
    const cancelBtn = document.getElementById('cancel-proposal-button');

    if (textarea) {
        const originalText = textarea.dataset.originalText || '';
        const finalText = revertToOriginal ? originalText : textarea.value.trim();
        const sanitizedFinal = finalText || '';

        const paragraph = document.createElement('p');
        paragraph.id = 'details-proposal';
        paragraph.textContent = sanitizedFinal || PROPOSAL_PLACEHOLDER_TEXT;
        paragraph.setAttribute('data-original-text', revertToOriginal ? originalText : sanitizedFinal);

        textarea.parentNode.replaceChild(paragraph, textarea);
        proposalElement = paragraph;
    } else if (proposalElement && revertToOriginal && proposalElement.hasAttribute('data-original-text')) {
        const originalText = proposalElement.getAttribute('data-original-text');
        proposalElement.textContent = originalText || PROPOSAL_PLACEHOLDER_TEXT;
    }

    if (!proposalElement) return;

    const projectId = currentlyViewedProjectId || window.currentlyViewedProjectId || null;
    const project = projectId ? allProjects.find(p => p.id === projectId) : null;
    const isAuthor = !!(project && currentUser && currentUser.uid === project.authorId);
    const isAdmin = currentUserRole === 'admin';
    const canEditProposal = !!project && (isAuthor || isAdmin);

    if (editBtn) editBtn.style.display = canEditProposal ? 'inline-block' : 'none';
    if (saveBtn) saveBtn.style.display = 'none';
    if (cancelBtn) cancelBtn.style.display = 'none';
}

async function handleSaveProposal() {
    const textarea = document.getElementById('proposal-edit-textarea');
    if (!textarea) {
        console.error('[SAVE PROPOSAL] Edit textarea not found');
        showNotification('Please click Edit before saving.', 'error');
        return;
    }

    const projectId = currentlyViewedProjectId ||
        window.currentlyViewedProjectId ||
        document.getElementById('details-modal')?.dataset?.projectId ||
        null;

    if (!projectId) {
        console.error('[SAVE PROPOSAL] No project ID available');
        showNotification('Error: No project selected.', 'error');
        return;
    }

    if (!currentlyViewedProjectId) {
        currentlyViewedProjectId = projectId;
    }
    if (typeof window !== 'undefined') {
        window.currentlyViewedProjectId = projectId;
    }

    const newProposal = textarea.value.trim();
    const originalText = textarea.dataset.originalText || '';

    if (!newProposal) {
        showNotification('Proposal cannot be empty.', 'error');
        textarea.focus();
        return;
    }

    if (newProposal === originalText) {
        showNotification('No changes to save.', 'info');
        disableProposalEditing();
        return;
    }

    const saveBtn = document.getElementById('save-proposal-button');
    const originalButtonText = saveBtn ? saveBtn.textContent : null;

    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
        saveBtn.classList.add('loading');
    }

    textarea.disabled = true;

    try {
        if (!db) {
            throw new Error('Database connection not available');
        }

        await db.collection('projects').doc(projectId).update({
            proposal: newProposal,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            activity: firebase.firestore.FieldValue.arrayUnion({
                text: 'updated the proposal',
                authorName: currentUserName || 'Unknown User',
                timestamp: new Date()
            })
        });

        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = originalButtonText;
            saveBtn.classList.remove('loading');
        }

        textarea.disabled = false;
        textarea.dataset.originalText = newProposal;

        showNotification('Proposal updated successfully!', 'success');
        const project = allProjects.find(p => p.id === projectId);
        if (project) {
            project.proposal = newProposal;
        }
        disableProposalEditing();

    } catch (error) {
        console.error('[SAVE PROPOSAL ERROR]', error);
        showNotification('Failed to save proposal. Please try again.', 'error');

        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = originalButtonText;
            saveBtn.classList.remove('loading');
        }
        textarea.disabled = false;
    }
}

if (typeof window !== 'undefined') {
    window.handleSaveProposal = handleSaveProposal;
}

// ==================
//  Deadline Management
// ==================
async function handleSetDeadlines() {
    const projectId = currentlyViewedProjectId || window.currentlyViewedProjectId;
    
    if (!projectId) {
        showNotification('No project selected. Please try again.', 'error');
        return;
    }

    if (!currentlyViewedProjectId && typeof currentlyViewedProjectId !== 'undefined') {
        currentlyViewedProjectId = projectId;
    }
    if (!window.currentlyViewedProjectId) {
        window.currentlyViewedProjectId = projectId;
    }

    const projectIndex = allProjects.findIndex(p => p.id === projectId);
    if (projectIndex === -1) {
        console.error('[SET DEADLINES] Project not found:', projectId);
        showNotification('Project not found. Please refresh and try again.', 'error');
        return;
    }

    const project = allProjects[projectIndex];
    const existingDeadlines = project.deadlines || {};
    const updatedDeadlines = { ...existingDeadlines };

    const deadlineFields = [
        { key: 'contact', label: 'Contact Professor', inputId: 'deadline-contact' },
        { key: 'interview', label: 'Conduct Interview', inputId: 'deadline-interview' },
        { key: 'draft', label: 'Write Draft', inputId: 'deadline-draft' },
        { key: 'review', label: 'Editor Review', inputId: 'deadline-review' },
        { key: 'edits', label: 'Review Edits', inputId: 'deadline-edits' }
    ];

    let hasChanges = false;
    const changedLabels = [];

    deadlineFields.forEach(field => {
        const input = document.getElementById(field.inputId);
        if (!input) {
            console.warn(`[SET DEADLINES] Input not found: ${field.inputId}`);
            return;
        }

        const newValue = input.value ? input.value.trim() : '';
        const currentValue = existingDeadlines[field.key] || '';

        if (newValue) {
            if (currentValue !== newValue) {
                updatedDeadlines[field.key] = newValue;
                hasChanges = true;
                changedLabels.push(field.label);
            }
        } else if (currentValue) {
            delete updatedDeadlines[field.key];
            hasChanges = true;
            changedLabels.push(`${field.label} (cleared)`);
        }
    });

    if (!updatedDeadlines.publication) {
        if (existingDeadlines.publication) {
            updatedDeadlines.publication = existingDeadlines.publication;
        } else if (project.deadline) {
            updatedDeadlines.publication = project.deadline;
        }
    }

    if (!hasChanges) {
        showNotification('No deadline changes detected. Update at least one deadline before saving.', 'warning');
        return;
    }

    try {
        await db.collection('projects').doc(project.id).update({
            deadlines: updatedDeadlines,
            activity: firebase.firestore.FieldValue.arrayUnion({
                text: changedLabels.length > 0
                    ? `updated project deadlines (${changedLabels.join(', ')})`
                    : 'updated project deadlines',
                authorName: currentUserName,
                timestamp: new Date()
            })
        });

        allProjects[projectIndex] = { ...project, deadlines: updatedDeadlines };

        if (projectId === project.id) {
            refreshDetailsModal(allProjects[projectIndex]);
            attachProjectModalListeners();
        }

        showNotification('Deadlines updated successfully!', 'success');
    } catch (error) {
        console.error('[SET DEADLINES ERROR]', error);
        showNotification('Failed to save deadlines. Please try again.', 'error');
    }
}

if (typeof window !== 'undefined') {
    window.__deadlineHandlerV2Applied = true;
}

async function handleRequestDeadlineChange() {
    if (!currentlyViewedProjectId) return;

    const reason = prompt('Please provide a reason for requesting deadline changes:');
    if (!reason || !reason.trim()) {
        showNotification('Please provide a reason for the deadline change request.', 'error');
        return;
    }

    const requestedDeadlines = {
        contact: document.getElementById('deadline-contact')?.value || '',
        interview: document.getElementById('deadline-interview')?.value || '',
        draft: document.getElementById('deadline-draft')?.value || '',
        review: document.getElementById('deadline-review')?.value || '',
        edits: document.getElementById('deadline-edits')?.value || ''
    };

    try {
        await db.collection('projects').doc(currentlyViewedProjectId).update({
            deadlineChangeRequest: {
                requestedBy: currentUserName,
                requestedDeadlines: requestedDeadlines,
                reason: reason.trim(),
                status: 'pending',
                requestedAt: new Date()
            },
            activity: firebase.firestore.FieldValue.arrayUnion({
                text: `requested deadline changes. Reason: ${reason.trim()}`,
                authorName: currentUserName,
                timestamp: new Date()
            })
        });

        showNotification('Deadline change request submitted successfully!', 'success');

    } catch (error) {
        console.error('[DEADLINE REQUEST ERROR]', error);
        showNotification('Failed to submit deadline request. Please try again.', 'error');
    }
}

async function handleApproveDeadlineRequest() {
    if (!currentlyViewedProjectId) return;

    const project = allProjects.find(p => p.id === currentlyViewedProjectId);
    if (!project) return;

    const request = project.deadlineRequest || project.deadlineChangeRequest;
    if (!request) return;

    try {
        const updates = {
            activity: firebase.firestore.FieldValue.arrayUnion({
                text: `approved deadline change request from ${request.requestedBy}`,
                authorName: currentUserName,
                timestamp: new Date()
            })
        };

        if (project.deadlineRequest) {
            updates.deadline = request.requestedDate;
            updates['deadlines.publication'] = request.requestedDate;
            updates.deadlineRequest = firebase.firestore.FieldValue.delete();
        } else if (project.deadlineChangeRequest) {
            updates.deadlines = request.requestedDeadlines;
            updates.deadlineChangeRequest = firebase.firestore.FieldValue.delete();
        }

        await db.collection('projects').doc(currentlyViewedProjectId).update(updates);

        showNotification('Deadline request approved!', 'success');

    } catch (error) {
        console.error('[APPROVE DEADLINE ERROR]', error);
        showNotification('Failed to approve deadline request. Please try again.', 'error');
    }
}

async function handleRejectDeadlineRequest() {
    if (!currentlyViewedProjectId) return;

    const project = allProjects.find(p => p.id === currentlyViewedProjectId);
    if (!project) return;

    const request = project.deadlineRequest || project.deadlineChangeRequest;
    if (!request) return;

    try {
        const updates = {
            activity: firebase.firestore.FieldValue.arrayUnion({
                text: `rejected deadline change request from ${request.requestedBy}`,
                authorName: currentUserName,
                timestamp: new Date()
            })
        };

        if (project.deadlineRequest) {
            updates.deadlineRequest = firebase.firestore.FieldValue.delete();
        } else if (project.deadlineChangeRequest) {
            updates.deadlineChangeRequest = firebase.firestore.FieldValue.delete();
        }

        await db.collection('projects').doc(currentlyViewedProjectId).update(updates);

        showNotification('Deadline request rejected.', 'info');

    } catch (error) {
        console.error('[REJECT DEADLINE ERROR]', error);
        showNotification('Failed to reject deadline request. Please try again.', 'error');
    }
}

window.handleApproveDeadlineRequest = handleApproveDeadlineRequest;
window.handleRejectDeadlineRequest = handleRejectDeadlineRequest;

// ==================
//  General Helper Functions
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
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showNotification(message, type = 'success') {
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
    if (!task) return false;
    if (task.creatorId === userId) return true;
    const assigneeIds = getTaskAssigneeIds(task);
    return assigneeIds.includes(userId);
}

window.toggleAssignee = toggleAssignee;
window.removeAssignee = removeAssignee;
