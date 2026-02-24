// ===============================
// Catalyst Tracker - Social Media Planner JS (Complete)
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
const DEFAULT_ZOOM_MEETING_URL = 'https://gwu-edu.zoom.us/j/97392237308';
const DEFAULT_MEETING_TIMEZONE = 'America/New_York';
const OWNER_EMAILS = ['bendoryair@gmail.com'];
let zoomMeetingUrl = DEFAULT_ZOOM_MEETING_URL;
let zoomElements = [];
let nextMeetingTime = null;
let nextMeetingTimezone = DEFAULT_MEETING_TIMEZONE;
let meetingCountdownInterval = null;
let meetingSettingsUnsubscribe = null;
const meetingSettingsDocRef = db.collection('settings').doc('meeting');

// ---- App State ----
let currentUser = null, currentUserName = null, currentUserRole = null;
let allPosts = [], allUsers = [];
let currentlyViewedPostId = null;

// ======================
//  Initialization
// ======================
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        console.log("[AUTH] No user found, redirecting to login");
        window.location.href = 'index.html';
        return;
    }
    
    currentUser = user;
    console.log("[AUTH] User authenticated:", user.uid);

    try {
        // Get user document with better error handling
        const userDoc = await db.collection('users').doc(user.uid).get();
        
        if (!userDoc.exists) {
            console.warn("[INIT] User document not found, creating default profile");
            
            // Create default user document
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

        console.log("[INIT] User profile loaded:", { name: currentUserName, role: currentUserRole });
        
        // Fetch all users for assignment dropdown
        await fetchAllUsers();
        
        // Setup UI and listeners
        setupUI();
        setupListeners();
        setupOwnerOnlyControls();
        initializeZoomCTA();
        subscribeToMeetingSettings();
        
        // Subscribe to posts
        subscribeToPosts();

        // Hide loader and show app
        document.getElementById('loader').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
        
        console.log("[INIT] Social Media Planner initialized successfully");
        
    } catch (error) {
        console.error("[INIT] Initialization error:", error);
        showNotification('Could not load your profile. Please refresh the page and try again.', 'error');
        
        // Still hide loader to prevent infinite loading
        document.getElementById('loader').style.display = 'none';
    }
});

// ==================
//  Helper Functions
// ==================
async function fetchAllUsers() {
    try {
        console.log("[INIT] Fetching users...");
        const usersSnapshot = await db.collection('users').get();
        allUsers = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("[INIT] Found", allUsers.length, "users");
    } catch (error) {
        console.error("[ERROR] Error fetching users:", error);
        allUsers = [];
    }
}

function setupUI() {
    // Update user info in sidebar
    document.getElementById('user-name').textContent = currentUserName;
    document.getElementById('user-role').textContent = currentUserRole;
    
    // Setup user avatar
    const avatar = document.getElementById('user-avatar');
    avatar.textContent = currentUserName.charAt(0).toUpperCase();
    avatar.style.backgroundColor = stringToColor(currentUserName);
    
    // Show admin-only elements if user is admin
    if (currentUserRole === 'admin') {
        document.querySelectorAll('.admin-only').forEach(el => {
            el.style.display = 'block';
        });
    }

    toggleOwnerOnlySections();
}

function isOwnerUser() {
    if (!currentUser || !currentUser.email) return false;
    return OWNER_EMAILS.includes(currentUser.email.trim().toLowerCase());
}

function toggleOwnerOnlySections() {
    const showOwner = isOwnerUser();
    document.querySelectorAll('.owner-only').forEach(el => {
        const desiredDisplay = el.dataset.ownerDisplay || 'block';
        if (el.id === 'zoom-settings-panel') {
            const isOpen = el.dataset.open === 'true';
            el.style.display = showOwner && isOpen ? desiredDisplay : 'none';
        } else {
            el.style.display = showOwner ? desiredDisplay : 'none';
        }
    });
}

function setupSidebarNavigation() {
    const sidebarRoutes = {
        'nav-dashboard': 'dashboard.html?view=interviews',
        'nav-tasks': 'dashboard.html?view=tasks',
        'nav-my-assignments': 'dashboard.html?view=my-assignments',
        'nav-calendar': 'dashboard.html?view=calendar',
        'nav-meeting-prep': 'dashboard.html?view=meeting-prep',
        'nav-interviews': 'dashboard.html?view=interviews',
        'nav-opeds': 'dashboard.html?view=opeds'
    };

    Object.entries(sidebarRoutes).forEach(([id, url]) => {
        const link = document.getElementById(id);
        if (!link) return;
        link.setAttribute('href', url);
    });
}

// ==================
//  Event Listeners
// ==================
function setupListeners() {
    setupSidebarNavigation();

    // Navigation
    document.getElementById('logout-button').addEventListener('click', () => {
        auth.signOut().then(() => {
            console.log("[AUTH] User signed out");
        }).catch(error => {
            console.error("[ERROR] Logout error:", error);
        });
    });
    
    // FAB and modal triggers
    const postTriggers = [
        document.getElementById('fab-new-post'),
        document.getElementById('header-new-post')
    ];

    postTriggers.forEach(trigger => {
        if (!trigger) return;
        trigger.addEventListener('click', event => {
            event.preventDefault();
            openPostModal();
        });
    });
    
    // Form submission
    document.getElementById('post-form').addEventListener('submit', handlePostFormSubmit);
    
    // Modal close handlers
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', e => {
            if (e.target.classList.contains('modal-overlay') || e.target.classList.contains('close-button')) {
                closeAllModals();
            }
        });
    });
    
    // Details modal actions
    const approveBtn = document.getElementById('approve-btn');
    const rejectBtn = document.getElementById('reject-btn');
    const assignBtn = document.getElementById('assign-btn');
    const addCommentBtn = document.getElementById('add-comment');
    const deleteBtn = document.getElementById('delete-btn');
    
    if (approveBtn) approveBtn.addEventListener('click', () => updatePostStatus('approved'));
    if (rejectBtn) rejectBtn.addEventListener('click', () => updatePostStatus('rejected'));
    if (assignBtn) assignBtn.addEventListener('click', handleAssignUser);
    if (addCommentBtn) addCommentBtn.addEventListener('click', handleAddComment);
    if (deleteBtn) deleteBtn.addEventListener('click', handleDeletePost);
    
    // Form enhancements
    setupFormEnhancements();
    
    console.log("[INIT] Event listeners set up");
}

function setupFormEnhancements() {
    // Character counter for content
    const contentTextarea = document.getElementById('post-content');
    const characterCounter = document.getElementById('character-counter');
    
    if (contentTextarea && characterCounter) {
        contentTextarea.addEventListener('input', () => {
            const count = contentTextarea.value.length;
            const max = 2000;
            characterCounter.textContent = `${count} / ${max}`;
            
            // Update counter styling based on usage
            characterCounter.className = 'character-counter';
            if (count > max * 0.9) {
                characterCounter.classList.add('error');
            } else if (count > max * 0.8) {
                characterCounter.classList.add('warning');
            }
        });
    }
    
    // Platform preview
    const platformSelect = document.getElementById('post-platform');
    const preview = document.getElementById('platform-preview');
    const previewContent = document.getElementById('preview-content');
    const previewIcon = document.getElementById('preview-icon');
    const previewTitle = document.getElementById('preview-title');
    
    if (platformSelect && preview) {
        platformSelect.addEventListener('change', () => {
            const platform = platformSelect.value;
            if (platform) {
                preview.style.display = 'block';
                
                // Update preview based on platform
                const platformInfo = {
                    instagram: { icon: '📸', title: 'Instagram Preview' },
                    linkedin: { icon: '💼', title: 'LinkedIn Preview' },
                    twitter: { icon: '🐦', title: 'Twitter Preview' },
                    facebook: { icon: '📘', title: 'Facebook Preview' }
                };
                
                const info = platformInfo[platform];
                if (info) {
                    previewIcon.textContent = info.icon;
                    previewTitle.textContent = info.title;
                }
                
                updatePreviewContent();
            } else {
                preview.style.display = 'none';
            }
        });
        
        // Update preview when content changes
        if (contentTextarea) {
            contentTextarea.addEventListener('input', updatePreviewContent);
        }
    }
    
    function updatePreviewContent() {
        const content = contentTextarea?.value || '';
        const platform = platformSelect?.value || '';
        
        if (previewContent && content) {
            // Simple preview - could be enhanced with platform-specific formatting
            previewContent.textContent = content.substring(0, 280) + (content.length > 280 ? '...' : '');
        } else if (previewContent) {
            previewContent.textContent = 'Your content will appear here...';
        }
    }
}

function initializeZoomCTA() {
    zoomElements = Array.from(document.querySelectorAll('[data-zoom-link]'));
    if (!zoomElements.length) return;

    zoomElements.forEach(el => {
        if (el.tagName.toLowerCase() !== 'a') {
            el.addEventListener('click', event => {
                event.preventDefault();
                window.open(zoomMeetingUrl, '_blank', 'noopener,noreferrer');
            });
        }
    });

    applyZoomLinkToElements();

    const updateZoomState = () => {
        const live = isWithinZoomWindow();
        zoomElements.forEach(el => {
            el.classList.toggle('zoom-live', live);
            el.setAttribute('aria-label', live ? 'Join Zoom (live now)' : 'Join Zoom (Mondays 6:30-8:30pm ET)');
            el.title = live ? 'Live now: The Catalyst Meeting' : 'Join Zoom on Mondays, 6:30-8:30pm ET';
        });
    };

    updateZoomState();
    // Update every 30 seconds to keep in sync with the meeting window
    setInterval(updateZoomState, 30000);
}

function applyZoomLinkToElements() {
    if (!zoomElements.length) {
        zoomElements = Array.from(document.querySelectorAll('[data-zoom-link]'));
    }

    zoomElements.forEach(el => {
        if (el.tagName.toLowerCase() === 'a') {
            el.setAttribute('href', zoomMeetingUrl);
            el.setAttribute('target', '_blank');
            el.setAttribute('rel', 'noopener noreferrer');
        }
    });

    const zoomLinkDisplay = document.getElementById('zoom-link-display');
    if (zoomLinkDisplay) {
        zoomLinkDisplay.textContent = zoomMeetingUrl;
        zoomLinkDisplay.setAttribute('href', zoomMeetingUrl);
    }

    const zoomInput = document.getElementById('zoom-link-input');
    if (zoomInput && zoomInput !== document.activeElement) {
        zoomInput.value = zoomMeetingUrl;
    }
}

function setZoomMeetingUrl(newUrl) {
    zoomMeetingUrl = (newUrl && typeof newUrl === 'string') ? newUrl : DEFAULT_ZOOM_MEETING_URL;
    applyZoomLinkToElements();
}

function sanitizeZoomLink(rawLink) {
    if (!rawLink || typeof rawLink !== 'string') return '';
    try {
        const candidate = rawLink.trim();
        const parsed = new URL(candidate);
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '';
        return parsed.toString();
    } catch (error) {
        return '';
    }
}

function setupOwnerOnlyControls() {
    toggleOwnerOnlySections();

    const zoomForm = document.getElementById('zoom-link-form');
    if (zoomForm && !zoomForm.dataset.listenerAttached) {
        zoomForm.addEventListener('submit', handleZoomLinkSave);
        zoomForm.dataset.listenerAttached = 'true';
    }

    const meetingForm = document.getElementById('meeting-form');
    if (meetingForm && !meetingForm.dataset.listenerAttached) {
        meetingForm.addEventListener('submit', handleMeetingScheduleSave);
        meetingForm.dataset.listenerAttached = 'true';
    }

    const clearMeetingBtn = document.getElementById('clear-meeting-button');
    if (clearMeetingBtn && !clearMeetingBtn.dataset.listenerAttached) {
        clearMeetingBtn.addEventListener('click', handleClearMeetingSchedule);
        clearMeetingBtn.dataset.listenerAttached = 'true';
    }

    const settingsToggle = document.getElementById('open-zoom-settings');
    const settingsPanel = document.getElementById('zoom-settings-panel');
    if (settingsToggle && settingsPanel && !settingsToggle.dataset.listenerAttached) {
        settingsToggle.addEventListener('click', () => {
            const isOpen = settingsPanel.dataset.open === 'true';
            const nextState = !isOpen;
            settingsPanel.dataset.open = nextState ? 'true' : 'false';
            settingsPanel.style.display = nextState ? (settingsPanel.dataset.ownerDisplay || 'block') : 'none';
            settingsPanel.setAttribute('aria-hidden', (!nextState).toString());
            settingsToggle.setAttribute('aria-expanded', nextState.toString());
        });
        settingsToggle.dataset.listenerAttached = 'true';
    }
}

function subscribeToMeetingSettings() {
    try {
        if (meetingSettingsUnsubscribe) {
            meetingSettingsUnsubscribe();
            meetingSettingsUnsubscribe = null;
        }

        meetingSettingsUnsubscribe = meetingSettingsDocRef.onSnapshot(snapshot => {
            const data = snapshot.exists ? snapshot.data() : {};
            const zoomLink = sanitizeZoomLink(data.zoomLink) || DEFAULT_ZOOM_MEETING_URL;
            setZoomMeetingUrl(zoomLink);

            const meetingTimestamp = data.nextMeetingTime && data.nextMeetingTime.toDate ? data.nextMeetingTime.toDate() : null;
            const meetingTimezone = data.nextMeetingTimezone || DEFAULT_MEETING_TIMEZONE;

            updateMeetingDisplay(meetingTimestamp, meetingTimezone);
            updateMeetingEditorForm(meetingTimestamp, meetingTimezone);
        }, error => {
            console.error('[MEETING] Failed to load shared meeting settings:', error);
        });
    } catch (error) {
        console.error('[MEETING] Error initializing shared meeting settings:', error);
    }
}

async function handleZoomLinkSave(event) {
    event.preventDefault();
    if (!isOwnerUser()) {
        showNotification('Only Yair can update the Zoom link.', 'error');
        return;
    }

    const input = document.getElementById('zoom-link-input');
    if (!input) return;

    const sanitizedLink = sanitizeZoomLink(input.value);
    if (!sanitizedLink) {
        showNotification('Please enter a valid https:// Zoom link.', 'error');
        return;
    }

    try {
        await meetingSettingsDocRef.set({ zoomLink: sanitizedLink }, { merge: true });
        setZoomMeetingUrl(sanitizedLink);
        showNotification('Zoom link updated for everyone.', 'success');
    } catch (error) {
        console.error('[MEETING] Failed to update Zoom link:', error);
        showNotification('Could not update the Zoom link. Please try again.', 'error');
    }
}

async function handleMeetingScheduleSave(event) {
    event.preventDefault();
    if (!isOwnerUser()) {
        showNotification('Only Yair can update the meeting schedule.', 'error');
        return;
    }

    const dateInput = document.getElementById('meeting-date-input');
    const timeInput = document.getElementById('meeting-time-input');
    const timezoneInput = document.getElementById('meeting-timezone-input');

    if (!dateInput || !timeInput) {
        showNotification('Meeting inputs are missing on this page.', 'error');
        return;
    }

    const dateValue = dateInput.value;
    const timeValue = timeInput.value;
    const timeZone = timezoneInput?.value || DEFAULT_MEETING_TIMEZONE;

    if (!dateValue || !timeValue) {
        showNotification('Please choose both a date and a time.', 'error');
        return;
    }

    const meetingDate = buildDateForTimezone(dateValue, timeValue, timeZone);
    if (!meetingDate || isNaN(meetingDate.getTime())) {
        showNotification('Unable to read that date/time. Please try again.', 'error');
        return;
    }

    try {
        await meetingSettingsDocRef.set({
            nextMeetingTime: firebase.firestore.Timestamp.fromDate(meetingDate),
            nextMeetingTimezone: timeZone
        }, { merge: true });

        updateMeetingDisplay(meetingDate, timeZone);
        showNotification('Next meeting updated.', 'success');
    } catch (error) {
        console.error('[MEETING] Failed to save meeting schedule:', error);
        showNotification('Could not save the meeting time. Please try again.', 'error');
    }
}

async function handleClearMeetingSchedule() {
    if (!isOwnerUser()) {
        showNotification('Only Yair can clear the meeting schedule.', 'error');
        return;
    }

    try {
        await meetingSettingsDocRef.set({
            nextMeetingTime: null,
            nextMeetingTimezone: DEFAULT_MEETING_TIMEZONE
        }, { merge: true });

        updateMeetingDisplay(null, DEFAULT_MEETING_TIMEZONE);
        updateMeetingEditorForm(null, DEFAULT_MEETING_TIMEZONE);
        showNotification('Meeting schedule cleared.', 'success');
    } catch (error) {
        console.error('[MEETING] Failed to clear meeting schedule:', error);
        showNotification('Could not clear the meeting schedule.', 'error');
    }
}

function updateMeetingDisplay(meetingDate, timeZone = DEFAULT_MEETING_TIMEZONE) {
    const summaryEl = document.getElementById('meeting-summary');
    const countdownEl = document.getElementById('meeting-countdown');

    if (meetingCountdownInterval) {
        clearInterval(meetingCountdownInterval);
        meetingCountdownInterval = null;
    }

    nextMeetingTime = meetingDate && !isNaN(meetingDate?.getTime?.()) ? meetingDate : null;
    nextMeetingTimezone = timeZone || DEFAULT_MEETING_TIMEZONE;

    if (!nextMeetingTime) {
        if (summaryEl) summaryEl.textContent = 'No meeting scheduled';
        if (countdownEl) {
            countdownEl.textContent = '-- : -- : --';
            countdownEl.classList.remove('live', 'past');
        }
        return;
    }

    const meetingLabel = nextMeetingTime.toLocaleString('en-US', {
        timeZone: nextMeetingTimezone,
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short'
    });

    if (summaryEl) summaryEl.textContent = meetingLabel;

    const updateCountdown = () => {
        const now = new Date();
        const diff = nextMeetingTime.getTime() - now.getTime();

        if (!countdownEl) return;

        if (diff <= 0) {
            countdownEl.textContent = 'LIVE NOW';
            countdownEl.classList.add('live');
            countdownEl.classList.remove('past');

            if (meetingCountdownInterval) {
                clearInterval(meetingCountdownInterval);
                meetingCountdownInterval = null;
            }
            return;
        }

        const days = Math.floor(diff / 86400000);
        const hours = Math.floor((diff % 86400000) / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);

        const parts = [];
        if (days > 0) parts.push(`${days}d`);
        parts.push(`${hours.toString().padStart(2, '0')}h`);
        parts.push(`${minutes.toString().padStart(2, '0')}m`);
        parts.push(`${seconds.toString().padStart(2, '0')}s`);

        countdownEl.textContent = parts.join(' ');
        countdownEl.classList.remove('live', 'past');
    };

    updateCountdown();
    meetingCountdownInterval = setInterval(updateCountdown, 1000);
}

function updateMeetingEditorForm(meetingDate, timeZone = DEFAULT_MEETING_TIMEZONE) {
    const dateInput = document.getElementById('meeting-date-input');
    const timeInput = document.getElementById('meeting-time-input');
    const timezoneInput = document.getElementById('meeting-timezone-input');

    if (timezoneInput) {
        const allowed = Array.from(timezoneInput.options || []).some(option => option.value === timeZone);
        timezoneInput.value = allowed ? timeZone : DEFAULT_MEETING_TIMEZONE;
    }

    if (meetingDate && !isNaN(meetingDate?.getTime?.())) {
        const formatted = formatDateTimeForInputs(meetingDate, timeZone);
        if (dateInput) dateInput.value = formatted.dateString;
        if (timeInput) timeInput.value = formatted.timeString;
    } else {
        if (dateInput) dateInput.value = '';
        if (timeInput) timeInput.value = '';
    }
}

function formatDateTimeForInputs(date, timeZone) {
    try {
        const formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone,
            hour12: false,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });

        const parts = formatter.formatToParts(date).reduce((acc, part) => {
            if (part.type !== 'literal') {
                acc[part.type] = part.value;
            }
            return acc;
        }, {});

        return {
            dateString: `${parts.year}-${parts.month}-${parts.day}`,
            timeString: `${parts.hour}:${parts.minute}`
        };
    } catch (error) {
        console.error('[MEETING] Failed to format date for inputs:', error);
        return { dateString: '', timeString: '' };
    }
}

function buildDateForTimezone(dateValue, timeValue, timeZone = DEFAULT_MEETING_TIMEZONE) {
    try {
        const localDate = new Date(`${dateValue}T${timeValue}:00`);
        if (isNaN(localDate.getTime())) return null;

        const localizedString = localDate.toLocaleString('en-US', { timeZone });
        const inTargetTimezone = new Date(localizedString);
        if (isNaN(inTargetTimezone.getTime())) return localDate;

        const offset = localDate.getTime() - inTargetTimezone.getTime();
        return new Date(localDate.getTime() + offset);
    } catch (error) {
        console.error('[MEETING] Failed to build timezone-aware date:', error);
        return null;
    }
}

function isWithinZoomWindow() {
    const now = new Date();
    const isMonday = now.toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'short' }) === 'Mon';
    if (!isMonday) return false;
    
    const [hourStr, minuteStr] = now
        .toLocaleString('en-US', { timeZone: 'America/New_York', hour12: false, hour: '2-digit', minute: '2-digit' })
        .split(':');
    const minutes = parseInt(hourStr, 10) * 60 + parseInt(minuteStr, 10);
    
    return minutes >= (18 * 60 + 30) && minutes < (20 * 60 + 30);
}

// ==================
//  Data Handling
// ==================
function subscribeToPosts() {
    console.log("[FIREBASE] Setting up posts subscription...");
    
    db.collection('social_posts').onSnapshot(snapshot => {
        console.log("[FIREBASE] Posts updated, processing...");
        
        allPosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderKanbanBoard(allPosts);
        updateStats();
        
        // Refresh details modal if open
        if (currentlyViewedPostId) {
            const post = allPosts.find(p => p.id === currentlyViewedPostId);
            if (post) {
                refreshDetailsModal(post);
            } else {
                closeAllModals();
            }
        }
    }, error => {
        console.error("[FIREBASE ERROR] Posts subscription failed:", error);
        showNotification('Failed to load posts. Please refresh the page.', 'error');
    });
}

function updateStats() {
    const stats = {
        total: allPosts.length,
        pending: allPosts.filter(p => p.status === 'proposed').length,
        scheduled: allPosts.filter(p => p.status === 'approved' || p.status === 'assigned').length,
        posted: allPosts.filter(p => p.status === 'posted').length
    };
    
    document.getElementById('stat-total').textContent = stats.total;
    document.getElementById('stat-pending').textContent = stats.pending;
    document.getElementById('stat-scheduled').textContent = stats.scheduled;
    document.getElementById('stat-posted').textContent = stats.posted;
}

// ==================
//  Kanban Board
// ==================
function renderKanbanBoard(posts) {
    console.log(`[RENDER] Rendering ${posts.length} posts`);
    const board = document.getElementById('kanban-board');
    
    // Clear loading placeholder
    board.innerHTML = '';
    
    const columns = [
        { id: 'proposed', title: 'Proposed', icon: '💡' },
        { id: 'approved', title: 'Approved', icon: '✅' },
        { id: 'assigned', title: 'Assigned', icon: '👤' },
        { id: 'posted', title: 'Posted', icon: '🚀' }
    ];
    
    columns.forEach(column => {
        const columnPosts = posts.filter(post => post.status === column.id);
        console.log(`[COLUMN] "${column.title}" has ${columnPosts.length} posts`);
        
        const columnEl = document.createElement('div');
        columnEl.className = `kanban-column column-${column.id}`;
        
        columnEl.innerHTML = `
            <div class="column-header">
                <div class="column-title">
                    <div class="column-title-main">
                        <span class="column-icon">${column.icon}</span>
                        <span class="column-title-text">${column.title}</span>
                    </div>
                    <span class="task-count">${columnPosts.length}</span>
                </div>
            </div>
            <div class="column-content">
                <div class="kanban-cards"></div>
            </div>
        `;
        
        const cardsContainer = columnEl.querySelector('.kanban-cards');
        
        if (columnPosts.length === 0) {
            // Show empty state
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-column';
            emptyState.innerHTML = `
                <div class="empty-column-icon">${column.icon}</div>
                <div class="empty-column-text">No ${column.title.toLowerCase()} posts</div>
                <div class="empty-column-subtext">Posts will appear here when they reach this stage</div>
            `;
            cardsContainer.appendChild(emptyState);
        } else {
            columnPosts.forEach(post => {
                cardsContainer.appendChild(createPostCard(post));
            });
        }
        
        board.appendChild(columnEl);
    });
}

function createPostCard(post) {
    const card = document.createElement('div');
    card.className = `kanban-card platform-${post.platform}`;
    card.dataset.id = post.id;
    
    // Check if overdue
    const isOverdue = new Date(post.deadline) < new Date() && post.status !== 'posted';
    const isDueSoon = !isOverdue && new Date(post.deadline) < new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    
    if (isOverdue) card.classList.add('overdue');
    if (isDueSoon) card.classList.add('due-soon');
    
    // Format deadline
    const deadline = new Date(post.deadline);
    const deadlineText = deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    // Platform info
    const platformInfo = {
        instagram: { icon: '📸', name: 'Instagram' },
        linkedin: { icon: '💼', name: 'LinkedIn' },
        twitter: { icon: '🐦', name: 'Twitter' },
        facebook: { icon: '📘', name: 'Facebook' }
    };
    
    const platform = platformInfo[post.platform] || { icon: '📱', name: post.platform };
    
    card.innerHTML = `
        <h4 class="card-title">${escapeHtml(post.title)}</h4>
        <div class="card-meta">
            <div class="platform-badge ${post.platform}">
                <span>${platform.icon}</span>
                <span>${platform.name}</span>
            </div>
            <div class="status-badge ${post.status}">${post.status}</div>
        </div>
        ${post.content ? `<div class="card-content-preview">${escapeHtml(post.content.substring(0, 100))}${post.content.length > 100 ? '...' : ''}</div>` : ''}
        <div class="card-footer">
            <div class="card-author">
                <div class="user-avatar" style="background-color: ${stringToColor(post.proposerName)}">
                    ${post.proposerName.charAt(0).toUpperCase()}
                </div>
                <span>${escapeHtml(post.proposerName)}</span>
            </div>
            <div class="card-deadline ${isOverdue ? 'overdue' : isDueSoon ? 'due-today' : ''}">
                ${deadlineText}
            </div>
        </div>
        ${post.assigneeName ? `<div class="card-assignment">Assigned to ${escapeHtml(post.assigneeName)}</div>` : ''}
    `;
    
    card.addEventListener('click', () => openDetailsModal(post.id));
    return card;
}

// ==================
//  Modal Functions
// ==================
function openPostModal() {
    document.getElementById('post-form').reset();
    document.getElementById('platform-preview').style.display = 'none';
    document.getElementById('character-counter').textContent = '0 / 2000';
    document.getElementById('post-modal').style.display = 'flex';
    
    // Focus first input
    setTimeout(() => {
        document.getElementById('post-title').focus();
    }, 100);
}

function openDetailsModal(postId) {
    const post = allPosts.find(p => p.id === postId);
    if (!post) {
        console.error("[MODAL] Post not found:", postId);
        return;
    }
    
    currentlyViewedPostId = postId;
    refreshDetailsModal(post);
    document.getElementById('details-modal').style.display = 'flex';
}

function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.style.display = 'none';
    });
    currentlyViewedPostId = null;
}

function refreshDetailsModal(post) {
    // Basic info
    document.getElementById('details-modal-title').textContent = post.title;
    document.getElementById('details-content').textContent = post.content || 'No content provided.';
    
    // Notes section
    const notesSection = document.getElementById('notes-section');
    const notesContent = document.getElementById('details-notes');
    if (post.notes && post.notes.trim()) {
        notesSection.style.display = 'block';
        notesContent.textContent = post.notes;
    } else {
        notesSection.style.display = 'none';
    }
    
    // Status and platform
    const statusBadge = document.getElementById('details-status');
    statusBadge.className = `status-badge ${post.status}`;
    statusBadge.textContent = post.status.charAt(0).toUpperCase() + post.status.slice(1);
    
    const platformBadge = document.getElementById('details-platform');
    const platformInfo = {
        instagram: { icon: '📸', name: 'Instagram' },
        linkedin: { icon: '💼', name: 'LinkedIn' },
        twitter: { icon: '🐦', name: 'Twitter' },
        facebook: { icon: '📘', name: 'Facebook' }
    };
    const platform = platformInfo[post.platform] || { icon: '📱', name: post.platform };
    platformBadge.className = `platform-badge ${post.platform}`;
    platformBadge.innerHTML = `<span>${platform.icon}</span><span>${platform.name}</span>`;
    
    // Timeline
    const createdDate = post.createdAt ? new Date(post.createdAt.seconds * 1000) : new Date();
    const deadlineDate = new Date(post.deadline);
    document.getElementById('details-created').textContent = createdDate.toLocaleDateString('en-US', { 
        year: 'numeric', month: 'long', day: 'numeric' 
    });
    document.getElementById('details-deadline').textContent = deadlineDate.toLocaleDateString('en-US', { 
        year: 'numeric', month: 'long', day: 'numeric' 
    });
    
    // Team info
    document.getElementById('details-proposer').textContent = post.proposerName;
    document.getElementById('details-assignee').textContent = post.assigneeName || 'Not assigned';
    
    // Permissions and actions
    const isAdmin = currentUserRole === 'admin';
    const isProposer = currentUser.uid === post.proposerId;
    const isAssignee = currentUser.uid === post.assigneeId;
    
    // Admin actions
    const adminSection = document.getElementById('admin-actions');
    if (adminSection) {
        adminSection.style.display = isAdmin && post.status === 'proposed' ? 'block' : 'none';
    }
    
    // Assignment section
    const assignmentSection = document.getElementById('assignment-section');
    if (assignmentSection) {
        assignmentSection.style.display = isAdmin && post.status === 'approved' ? 'block' : 'none';
        if (isAdmin && post.status === 'approved') {
            populateAssigneeDropdown(post.assigneeId);
        }
    }
    
    // Delete section
    const deleteSection = document.getElementById('delete-section');
    if (deleteSection) {
        deleteSection.style.display = (isAdmin || isProposer) ? 'block' : 'none';
    }
    
    // Activity feed
    renderActivityFeed(post.activity || []);
}

function populateAssigneeDropdown(currentAssigneeId) {
    const dropdown = document.getElementById('assignee-select');
    if (!dropdown) return;
    
    dropdown.innerHTML = '<option value="">Select assignee...</option>';
    allUsers.forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = user.name;
        if (user.id === currentAssigneeId) option.selected = true;
        dropdown.appendChild(option);
    });
}

function renderActivityFeed(activity) {
    const feed = document.getElementById('activity-feed');
    if (!feed) return;
    
    feed.innerHTML = '';
    
    if (!activity || activity.length === 0) {
        feed.innerHTML = '<div class="activity-item"><p class="loading-text">No activity yet.</p></div>';
        return;
    }
    
    // Sort activity by timestamp (newest first)
    const sortedActivity = [...activity].sort((a, b) => {
        const aTime = a.timestamp?.seconds || 0;
        const bTime = b.timestamp?.seconds || 0;
        return bTime - aTime;
    });
    
    sortedActivity.forEach(item => {
        const activityEl = document.createElement('div');
        activityEl.className = 'activity-item';
        
        const timestamp = item.timestamp?.seconds ? 
            new Date(item.timestamp.seconds * 1000).toLocaleString() : 
            'Unknown time';
        
        activityEl.innerHTML = `
            <div class="activity-header">
                <span class="activity-user">${escapeHtml(item.authorName || 'Unknown User')}</span>
                <span class="activity-time">${timestamp}</span>
            </div>
            <div class="activity-message">${escapeHtml(item.text || 'No message')}</div>
        `;
        
        feed.appendChild(activityEl);
    });
}

// ==================
//  Actions
// ==================
async function handlePostFormSubmit(e) {
    e.preventDefault();
    
    const submitButton = document.getElementById('submit-post');
    const originalText = submitButton.textContent;
    
    try {
        // Show loading state
        submitButton.disabled = true;
        submitButton.textContent = 'Creating...';
        
        const newPost = {
            title: document.getElementById('post-title').value.trim(),
            platform: document.getElementById('post-platform').value,
            content: document.getElementById('post-content').value.trim(),
            notes: document.getElementById('post-notes').value.trim() || null,
            deadline: document.getElementById('post-deadline').value,
            proposerId: currentUser.uid,
            proposerName: currentUserName,
            assigneeId: null,
            assigneeName: null,
            status: 'proposed',
            createdAt: new Date(),
            activity: [{
                text: 'created this post proposal',
                authorName: currentUserName,
                timestamp: new Date()
            }]
        };
        
        await db.collection('social_posts').add(newPost);
        
        showNotification('Post proposal created successfully!', 'success');
        closeAllModals();
        
    } catch (error) {
        console.error("[ERROR] Failed to create post:", error);
        showNotification('Failed to create post. Please try again.', 'error');
    } finally {
        // Reset button
        submitButton.disabled = false;
        submitButton.textContent = originalText;
    }
}

async function updatePostStatus(newStatus) {
    if (!currentlyViewedPostId) return;
    
    try {
        await db.collection('social_posts').doc(currentlyViewedPostId).update({
            status: newStatus,
            activity: firebase.firestore.FieldValue.arrayUnion({
                text: `marked post as ${newStatus}`,
                authorName: currentUserName,
                timestamp: new Date()
            })
        });
        
        showNotification(`Post ${newStatus} successfully!`, 'success');
        
    } catch (error) {
        console.error(`[ERROR] Failed to update post status to ${newStatus}:`, error);
        showNotification(`Failed to ${newStatus} post. Please try again.`, 'error');
    }
}

async function handleAssignUser() {
    const dropdown = document.getElementById('assignee-select');
    if (!dropdown || !currentlyViewedPostId) return;
    
    const userId = dropdown.value;
    if (!userId) {
        showNotification('Please select a user to assign.', 'error');
        return;
    }
    
    const selectedUser = allUsers.find(u => u.id === userId);
    if (!selectedUser) {
        showNotification('Selected user not found.', 'error');
        return;
    }
    
    try {
        await db.collection('social_posts').doc(currentlyViewedPostId).update({
            assigneeId: userId,
            assigneeName: selectedUser.name,
            status: 'assigned',
            activity: firebase.firestore.FieldValue.arrayUnion({
                text: `assigned post to ${selectedUser.name}`,
                authorName: currentUserName,
                timestamp: new Date()
            })
        });
        
        showNotification(`Post assigned to ${selectedUser.name} successfully!`, 'success');
        
    } catch (error) {
        console.error("[ERROR] Failed to assign user:", error);
        showNotification('Failed to assign user. Please try again.', 'error');
    }
}

async function handleAddComment() {
    const commentInput = document.getElementById('comment-input');
    if (!commentInput || !currentlyViewedPostId) return;
    
    const comment = commentInput.value.trim();
    if (!comment) {
        showNotification('Please enter a comment.', 'error');
        return;
    }
    
    try {
        await db.collection('social_posts').doc(currentlyViewedPostId).update({
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

async function handleDeletePost() {
    if (!currentlyViewedPostId) return;
    
    const post = allPosts.find(p => p.id === currentlyViewedPostId);
    if (!post) return;
    
    const isAdmin = currentUserRole === 'admin';
    const isProposer = currentUser.uid === post.proposerId;
    
    if (!isAdmin && !isProposer) {
        showNotification('You can only delete your own posts.', 'error');
        return;
    }
    
    if (confirm(`Are you sure you want to delete "${post.title}"? This action cannot be undone.`)) {
        try {
            await db.collection('social_posts').doc(currentlyViewedPostId).delete();
            showNotification('Post deleted successfully!', 'success');
            closeAllModals();
        } catch (error) {
            console.error("[ERROR] Failed to delete post:", error);
            showNotification('Failed to delete post. Please try again.', 'error');
        }
    }
}

// ==================
//  Utility Functions
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

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showNotification(message, type = 'success') {
    const container = document.getElementById('notification-container') || document.body;
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    container.appendChild(notification);
    
    // Show notification
    setTimeout(() => notification.classList.add('show'), 100);
    
    // Hide and remove notification
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// ==================
//  Error Handling
// ==================
window.addEventListener('error', function(e) {
    console.error('[GLOBAL ERROR]', e.error || e.message);
    showNotification('An unexpected error occurred. Please refresh the page.', 'error');
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', function(e) {
    console.error('[UNHANDLED PROMISE REJECTION]', e.reason);
    showNotification('An unexpected error occurred. Please refresh the page.', 'error');
});

window.addEventListener('beforeunload', () => {
    if (meetingSettingsUnsubscribe) {
        meetingSettingsUnsubscribe();
        meetingSettingsUnsubscribe = null;
    }
    if (meetingCountdownInterval) {
        clearInterval(meetingCountdownInterval);
        meetingCountdownInterval = null;
    }
});

console.log("[INIT] Social Media Planner JavaScript loaded successfully");
