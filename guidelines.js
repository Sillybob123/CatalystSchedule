// ===============================
// Catalyst Tracker - Writing Guidelines Page JS
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

try {
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
} catch (error) {
  console.error('[FIREBASE] Initialization failed:', error);
}

const auth = firebase.auth();
const db = firebase.firestore();

const DEFAULT_ZOOM_MEETING_URL = 'https://gwu-edu.zoom.us/j/97392237308';
const DEFAULT_MEETING_TIMEZONE = 'America/New_York';
const OWNER_EMAILS = ['bendoryair@gmail.com'];

let currentUser = null;
let currentUserRole = 'writer';

let zoomMeetingUrl = DEFAULT_ZOOM_MEETING_URL;
let zoomElements = [];
let meetingSettingsUnsubscribe = null;
let meetingCountdownInterval = null;

const meetingSettingsDocRef = db.collection('settings').doc('meeting');

// ==================
//  Auth + App Setup
// ==================
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = 'index.html';
    return;
  }

  currentUser = user;
  setupSidebarNavigation();

  try {
    const userDoc = await db.collection('users').doc(user.uid).get();
    const data = userDoc.exists ? userDoc.data() : {};

    const name = data.name || user.email || 'User';
    currentUserRole = data.role || 'writer';

    const avatarEl = document.getElementById('user-avatar');
    const nameEl = document.getElementById('user-name');
    const roleEl = document.getElementById('user-role');

    if (avatarEl) avatarEl.textContent = name.charAt(0).toUpperCase();
    if (nameEl) nameEl.textContent = name;
    if (roleEl) roleEl.textContent = currentUserRole;
  } catch (error) {
    console.warn('[AUTH] Could not load user profile:', error);
  }

  const logoutButton = document.getElementById('logout-button');
  if (logoutButton && !logoutButton.dataset.listenerAttached) {
    logoutButton.addEventListener('click', () => {
      auth.signOut().then(() => {
        window.location.href = 'index.html';
      });
    });
    logoutButton.dataset.listenerAttached = 'true';
  }

  toggleOwnerOnlySections();
  setupOwnerOnlyControls();
  initializeZoomCTA();
  subscribeToMeetingSettings();

  const loader = document.getElementById('loader');
  const appContainer = document.getElementById('app-container');
  if (loader) loader.style.display = 'none';
  if (appContainer) appContainer.style.display = 'flex';
});

// ==================
//  Sidebar Navigation
// ==================
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

// ==================
//  Zoom + Meeting Controls
// ==================
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
      showNotification('Live meeting settings are unavailable right now.', 'error');
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

  const validMeetingDate = meetingDate && !isNaN(meetingDate?.getTime?.()) ? meetingDate : null;

  if (!validMeetingDate) {
    if (summaryEl) summaryEl.textContent = 'No meeting scheduled';
    if (countdownEl) {
      countdownEl.textContent = '-- : -- : --';
      countdownEl.classList.remove('live', 'past');
    }
    return;
  }

  const meetingLabel = validMeetingDate.toLocaleString('en-US', {
    timeZone: timeZone || DEFAULT_MEETING_TIMEZONE,
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  });

  if (summaryEl) summaryEl.textContent = meetingLabel;

  const updateCountdown = () => {
    if (!countdownEl) return;

    const now = new Date();
    const diff = validMeetingDate.getTime() - now.getTime();

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

function showNotification(message, type = 'success') {
  const method = type === 'error' ? 'error' : 'log';
  console[method](`[GUIDELINES] ${message}`);
}

// ==================
//  Guidelines Page Interactions
// ==================
function initializeTocBehavior() {
  document.querySelectorAll('.toc-link').forEach(link => {
    link.addEventListener('click', event => {
      event.preventDefault();
      const target = document.querySelector(link.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  const sections = document.querySelectorAll('.guideline-section');
  const tocLinks = document.querySelectorAll('.toc-link');

  if (!sections.length || !tocLinks.length) return;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;

      tocLinks.forEach(link => link.classList.remove('toc-active'));
      const active = document.querySelector(`.toc-link[href="#${entry.target.id}"]`);
      if (active) active.classList.add('toc-active');
    });
  }, { rootMargin: '-20% 0px -70% 0px' });

  sections.forEach(section => observer.observe(section));
}

function initializeQuickRefChecklist() {
  document.querySelectorAll('.qr-item').forEach(item => {
    item.addEventListener('click', () => {
      item.classList.toggle('checked');
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setupSidebarNavigation();
  initializeTocBehavior();
  initializeQuickRefChecklist();
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
