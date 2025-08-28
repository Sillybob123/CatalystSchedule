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

let currentUser = null;
let currentUserName = null;
let currentUserRole = null;
let currentProjects = [];
let currentlyViewedProjectId = null;

const projectTimelines = {
    "Interview": ["Think of a topic", "Email professor", "Interview Professor", "Write Article", "Review edit suggestions and finalize article"],
    "Op-Ed": ["Think of a topic", "Write Article", "Review edit suggestions and finalize article"],
    "Editing": ["Talk to writer about their project", "Edit and fix story", "Finalize piece"]
};

// --- AUTHENTICATION ---
auth.onAuthStateChanged(user => {
    const loader = document.getElementById('loader');
    const appContainer = document.getElementById('app-container');

    if (user) {
        currentUser = user;
        db.collection('users').doc(user.uid).get().then(doc => {
            if (doc.exists) {
                const userData = doc.data();
                currentUserName = userData.name;
                currentUserRole = userData.role;
                
                setupUI();
                fetchAndRenderProjects();

                loader.style.display = 'none';
                appContainer.style.display = 'flex';
            } else {
                handleAuthError("Your user profile could not be found in the database.");
            }
        }).catch(error => {
            console.error("Error fetching user data:", error);
            handleAuthError("Error connecting to the database.");
        });
    } else {
        window.location.href = 'index.html';
    }
});

function setupUI() {
    document.getElementById('user-name').textContent = currentUserName;
    document.getElementById('user-role').textContent = currentUserRole;
    document.getElementById('user-avatar').textContent = currentUserName.charAt(0);
    
    if (currentUserRole !== 'writer' && currentUserRole !== 'admin') {
        document.getElementById('add-project-button').style.display = 'none';
    }
    
    document.getElementById('logout-button').addEventListener('click', () => auth.signOut());
}

function handleAuthError(message) {
    const loader = document.getElementById('loader');
    loader.innerHTML = `
        <div style="text-align: center; color: var(--text-secondary); padding: 20px;">
            <h2>Account Setup Incomplete</h2>
            <p>${message}</p>
            <p>Please contact an administrator.</p>
            <button id="error-logout-button" class="btn-primary" style="margin-top: 15px;">Logout</button>
        </div>
    `;
    document.getElementById('error-logout-button').addEventListener('click', () => auth.signOut());
}

// --- KANBAN BOARD ---
const KANBAN_COLUMNS = {
    PROPOSAL: "Topic Proposal",
    IN_PROGRESS: "In Progress",
    EDITING: "In Editing",
    PUBLICATION: "Ready for Publication"
};

function fetchAndRenderProjects() {
    db.collection('projects').orderBy("deadline").onSnapshot(snapshot => {
        currentProjects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderKanbanBoard(currentProjects);
    });
}

function renderKanbanBoard(projects) {
    const board = document.getElementById('kanban-board');
    board.innerHTML = ''; // Clear previous state

    Object.values(KANBAN_COLUMNS).forEach(columnTitle => {
        const columnProjects = projects.filter(p => getProjectColumn(p) === columnTitle);
        const columnEl = document.createElement('div');
        columnEl.className = 'kanban-column';
        columnEl.innerHTML = `
            <h3>
                <span class="column-title">${columnTitle}</span>
                <span class="task-count">${columnProjects.length}</span>
            </h3>
            <div class="kanban-cards"></div>
        `;
        columnProjects.forEach(project => {
            const cardContainer = columnEl.querySelector('.kanban-cards');
            cardContainer.appendChild(createProjectCard(project));
        });
        board.appendChild(columnEl);
    });
}

function getProjectColumn(project) {
    if (project.proposalStatus !== 'approved') return KANBAN_COLUMNS.PROPOSAL;
    if (project.status === 'Ready for Publication') return KANBAN_COLUMNS.PUBLICATION;
    if (project.status === 'In Editing') return KANBAN_COLUMNS.EDITING;
    return KANBAN_COLUMNS.IN_PROGRESS;
}

function createProjectCard(project) {
    const card = document.createElement('div');
    card.className = 'kanban-card';
    card.dataset.id = project.id;

    // Deadline styling
    const deadline = new Date(project.deadline + 'T23:59:59'); // Assume end of day
    const now = new Date();
    const daysUntilDue = (deadline - now) / (1000 * 60 * 60 * 24);
    let deadlineClass = '';
    if (daysUntilDue < 0) deadlineClass = 'overdue';
    else if (daysUntilDue < 7) deadlineClass = 'due-soon';

    // Progress bar
    const totalTasks = Object.keys(project.timeline).length;
    const completedTasks = Object.values(project.timeline).filter(Boolean).length;
    const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    let proposalBadge = '';
    if (project.proposalStatus === 'pending') proposalBadge = `<span style="color: orange; font-weight: 500;">[Pending]</span>`;
    if (project.proposalStatus === 'rejected') proposalBadge = `<span style="color: var(--danger-color); font-weight: 500;">[Rejected]</span>`;

    card.innerHTML = `
        <h4 class="card-title">${project.title} ${proposalBadge}</h4>
        <div class="card-meta">
            <div class="card-author">
                <div class="user-avatar" style="background-color: ${stringToColor(project.authorName)}">${project.authorName.charAt(0)}</div>
                <span>${project.authorName}</span>
            </div>
            <span class="card-deadline ${deadlineClass}">${new Date(project.deadline + 'T00:00:00').toLocaleDateString()}</span>
        </div>
        <div class="progress-bar-container">
            <div class="progress-bar" style="width: ${progress}%;"></div>
        </div>
    `;
    card.addEventListener('click', () => openDetailsModal(project.id));
    return card;
}


// --- MODAL HANDLING (GENERIC) ---
const modals = document.querySelectorAll('.modal-overlay');
modals.forEach(modal => {
    modal.addEventListener('click', e => {
        if (e.target === modal) closeAllModals();
    });
    modal.querySelectorAll('.close-button').forEach(btn => btn.addEventListener('click', closeAllModals));
});

function closeAllModals() {
    modals.forEach(modal => modal.style.display = 'none');
    currentlyViewedProjectId = null;
}

// --- PROJECT MODAL (ADD/EDIT) ---
const projectModal = document.getElementById('project-modal');
const projectForm = document.getElementById('project-form');

document.getElementById('add-project-button').addEventListener('click', () => {
    projectForm.reset();
    document.getElementById('project-id').value = '';
    document.getElementById('modal-title').textContent = 'Propose New Article';
    projectModal.style.display = 'flex';
});

projectForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const projectId = document.getElementById('project-id').value;
    const type = document.getElementById('project-type').value;

    const projectData = {
        title: document.getElementById('project-title').value,
        type: type,
        proposal: document.getElementById('project-proposal').value,
        deadline: document.getElementById('project-deadline').value,
        authorId: currentUser.uid,
        authorName: currentUserName,
        proposalStatus: 'pending',
        status: 'Proposed',
        timeline: projectTimelines[type].reduce((acc, task) => ({...acc, [task]: false }), {}),
        deadlineHistory: [],
        activity: []
    };

    try {
        if (projectId) {
            await db.collection('projects').doc(projectId).update(projectData);
        } else {
            await db.collection('projects').add(projectData);
        }
        closeAllModals();
    } catch (error) {
        console.error("Error saving project:", error);
        alert("Could not save project.");
    }
});


// --- DETAILS MODAL ---
const detailsModal = document.getElementById('details-modal');
let activityUnsubscribe = null; // To stop listening for activity when modal closes

async function openDetailsModal(projectId) {
    const project = currentProjects.find(p => p.id === projectId);
    if (!project) return;
    currentlyViewedProjectId = projectId;
    
    // Populate static fields
    document.getElementById('details-title').textContent = project.title;
    document.getElementById('details-author').textContent = project.authorName;
    document.getElementById('details-status').textContent = project.proposalStatus !== 'approved' ? `Proposal: ${project.proposalStatus}` : project.status;
    document.getElementById('details-deadline').textContent = new Date(project.deadline + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    document.getElementById('details-proposal').textContent = project.proposal || 'No proposal provided.';

    // Admin section
    const adminSection = document.getElementById('admin-approval-section');
    adminSection.style.display = (currentUserRole === 'admin') ? 'block' : 'none';
    document.getElementById('proposal-feedback').value = project.proposalFeedback || '';

    // Timeline/Checklist
    renderTimeline(project);

    // Deadline History
    renderDeadlineHistory(project);

    // Activity Feed (with real-time updates)
    if (activityUnsubscribe) activityUnsubscribe(); // Stop previous listener
    const activityFeed = document.getElementById('details-activity-feed');
    activityUnsubscribe = db.collection('projects').doc(projectId).onSnapshot(doc => {
        const projectData = doc.data();
        if (projectData) renderActivityFeed(projectData.activity || []);
    });
    
    detailsModal.style.display = 'flex';
}

function renderTimeline(project) {
    const timelineContainer = document.getElementById('details-timeline');
    timelineContainer.innerHTML = '';
    Object.entries(project.timeline).forEach(([task, completed]) => {
        const isEditable = (currentUser.uid === project.authorId || currentUserRole === 'admin');
        const taskEl = document.createElement('div');
        taskEl.className = 'task';
        taskEl.innerHTML = `
            <input type="checkbox" id="task-${task.replace(/\s+/g, '-')}" ${completed ? 'checked' : ''} ${!isEditable ? 'disabled' : ''}>
            <label for="task-${task.replace(/\s+/g, '-')}">${task}</label>
        `;
        taskEl.querySelector('input').addEventListener('change', (e) => {
            updateTaskStatus(project.id, task, e.target.checked);
        });
        timelineContainer.appendChild(taskEl);
    });
}

function renderDeadlineHistory(project) {
    const historyContainer = document.getElementById('deadline-history');
    historyContainer.innerHTML = '';
    if (project.originalDeadline) {
        historyContainer.innerHTML += `<p><strong>Original:</strong> ${project.originalDeadline}</p>`;
    }
    project.deadlineHistory?.forEach(entry => {
        historyContainer.innerHTML += `<p><strong>${entry.newDeadline}:</strong> ${entry.reason}</p>`;
    });
}

function renderActivityFeed(activity) {
    const activityFeed = document.getElementById('details-activity-feed');
    activityFeed.innerHTML = '';
    activity.sort((a, b) => b.timestamp.seconds - a.timestamp.seconds).forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = 'feed-item';
        itemEl.innerHTML = `
            <div class="user-avatar" style="background-color: ${stringToColor(item.authorName)}">${item.authorName.charAt(0)}</div>
            <div class="feed-content">
                <p><span class="author">${item.authorName}</span> ${item.text}</p>
                <span class="timestamp">${new Date(item.timestamp.seconds * 1000).toLocaleString()}</span>
            </div>
        `;
        activityFeed.appendChild(itemEl);
    });
}

// --- ACTIONS & UPDATES ---
async function addActivity(projectId, text) {
    const activity = {
        text: text,
        authorName: currentUserName,
        timestamp: new Date()
    };
    const projectRef = db.collection('projects').doc(projectId);
    await projectRef.update({
        activity: firebase.firestore.FieldValue.arrayUnion(activity)
    });
}

async function updateTaskStatus(projectId, task, isCompleted) {
    const updatePath = `timeline.${task}`;
    await db.collection('projects').doc(projectId).update({ [updatePath]: isCompleted });
    addActivity(projectId, `${isCompleted ? 'completed' : 'un-completed'} the task: "${task}"`);
}

document.getElementById('add-comment-button').addEventListener('click', async () => {
    const commentInput = document.getElementById('comment-input');
    if (commentInput.value.trim() && currentlyViewedProjectId) {
        await addActivity(currentlyViewedProjectId, `commented: "${commentInput.value.trim()}"`);
        commentInput.value = '';
    }
});

document.getElementById('approve-button').addEventListener('click', () => updateProposalStatus('approved'));
document.getElementById('reject-button').addEventListener('click', () => updateProposalStatus('rejected'));
document.getElementById('hold-button').addEventListener('click', () => updateProposalStatus('on-hold'));

async function updateProposalStatus(newStatus) {
    if (!currentlyViewedProjectId || currentUserRole !== 'admin') return;
    const feedback = document.getElementById('proposal-feedback').value;
    try {
        await db.collection('projects').doc(currentlyViewedProjectId).update({
            proposalStatus: newStatus,
            status: newStatus === 'approved' ? 'In Progress' : 'On Hold/Rejected',
            proposalFeedback: feedback
        });
        await addActivity(currentlyViewedProjectId, `set the proposal status to ${newStatus}.`);
        closeAllModals();
    } catch (error) {
        console.error("Error updating proposal status:", error);
    }
}

document.getElementById('update-deadline-button').addEventListener('click', async () => {
    const newDeadline = document.getElementById('new-deadline-input').value;
    const reason = document.getElementById('deadline-reason-input').value;
    if (!currentlyViewedProjectId || !newDeadline || !reason) {
        alert("Please provide a new deadline and a reason.");
        return;
    }
    
    const project = currentProjects.find(p => p.id === currentlyViewedProjectId);
    const historyEntry = { newDeadline, reason, changedAt: new Date() };

    try {
        await db.collection('projects').doc(currentlyViewedProjectId).update({
            deadline: newDeadline,
            originalDeadline: project.originalDeadline || project.deadline,
            deadlineHistory: firebase.firestore.FieldValue.arrayUnion(historyEntry)
        });
        await addActivity(currentlyViewedProjectId, `changed the deadline to ${newDeadline} for reason: "${reason}"`);
        closeAllModals();
    } catch (error) {
        console.error("Error updating deadline: ", error);
    }
});


// --- UTILITY FUNCTIONS ---
function stringToColor(str) {
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
