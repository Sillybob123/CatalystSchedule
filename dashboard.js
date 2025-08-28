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
let allProjects = [];
let currentlyViewedProjectId = null;
let currentView = 'all'; // 'all', 'interviews', 'opeds', 'editors'

const projectTimelines = {
    "Interview": ["Think of a topic", "Write an email to professor", "Have an interview", "Write article", "Fix/Review editor's suggestions"],
    "Op-Ed": ["Think of a topic", "Write article", "Fix/Review editor's suggestions"],
    "Editing": ["Talk to writer about their project", "Edit and fix story", "Finalize piece"] // Retained for logic
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
                setupNav();
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
    
    if (currentUserRole === 'admin') {
        document.getElementById('status-report-button').style.display = 'block';
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

// --- NAVIGATION & VIEWS ---
function setupNav() {
    const navLinks = document.querySelectorAll('.nav-item');
    const boardTitle = document.getElementById('board-title');

    const views = {
        'nav-all': { view: 'all', title: 'All Projects' },
        'nav-interviews': { view: 'interviews', title: 'Catalyst in the Capital' },
        'nav-opeds': { view: 'opeds', title: 'Op-Eds' },
        'nav-editors': { view: 'editors', title: "Editors' View" }
    };

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            const { view, title } = views[link.id];
            currentView = view;
            boardTitle.textContent = title;
            renderKanbanBoard();
        });
    });
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
        allProjects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderKanbanBoard();
    });
}

function filterProjects() {
    switch(currentView) {
        case 'interviews':
            return allProjects.filter(p => p.type === 'Interview');
        case 'opeds':
            return allProjects.filter(p => p.type === 'Op-Ed');
        case 'editors':
             return allProjects.filter(p => p.proposalStatus === 'approved' && p.status !== 'Proposed');
        case 'all':
        default:
            return allProjects;
    }
}

function renderKanbanBoard() {
    const projectsToRender = filterProjects();
    const board = document.getElementById('kanban-board');
    board.innerHTML = ''; // Clear previous state

    Object.values(KANBAN_COLUMNS).forEach(columnTitle => {
        const columnProjects = projectsToRender.filter(p => getProjectColumn(p) === columnTitle);
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
            columnEl.querySelector('.kanban-cards').appendChild(createProjectCard(project));
        });
        board.appendChild(columnEl);
    });
}

function getProjectColumn(project) {
    if (project.proposalStatus !== 'approved') return KANBAN_COLUMNS.PROPOSAL;
    
    // Custom logic for Editors' view to simplify columns
    if (currentView === 'editors') {
         const lastTask = Object.keys(project.timeline).pop();
         if (project.timeline[lastTask] === true) return KANBAN_COLUMNS.PUBLICATION;
         return KANBAN_COLUMNS.EDITING;
    }

    if (project.status === 'Ready for Publication') return KANBAN_COLUMNS.PUBLICATION;
    if (project.status === 'In Editing') return KANBAN_COLUMNS.EDITING;
    return KANBAN_COLUMNS.IN_PROGRESS;
}

function createProjectCard(project) {
    const card = document.createElement('div');
    card.className = 'kanban-card';
    card.dataset.id = project.id;

    // Deadline styling
    const deadline = new Date(project.deadline + 'T23:59:59');
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


// --- MODAL HANDLING ---
const modals = document.querySelectorAll('.modal-overlay');
modals.forEach(modal => {
    modal.addEventListener('click', e => {
        if (e.target.classList.contains('modal-overlay') || e.target.classList.contains('close-button')) {
            closeAllModals();
        }
    });
    modal.querySelectorAll('.close-button').forEach(btn => btn.addEventListener('click', closeAllModals));
});

function closeAllModals() {
    modals.forEach(modal => modal.style.display = 'none');
    if (activityUnsubscribe) activityUnsubscribe();
    currentlyViewedProjectId = null;
}

// --- PROJECT MODAL (ADD) ---
const projectModal = document.getElementById('project-modal');
const projectForm = document.getElementById('project-form');

document.getElementById('add-project-button').addEventListener('click', () => {
    projectForm.reset();
    document.getElementById('modal-title').textContent = 'Propose New Article';
    projectModal.style.display = 'flex';
});

projectForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const type = document.getElementById('project-type').value;
    const newProject = {
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
        activity: [{
            text: 'created the project.',
            authorName: currentUserName,
            timestamp: new Date()
        }]
    };
    try {
        await db.collection('projects').add(newProject);
        closeAllModals();
    } catch (error) {
        console.error("Error saving project:", error);
    }
});


// --- DETAILS MODAL ---
const detailsModal = document.getElementById('details-modal');
let activityUnsubscribe = null;

function openDetailsModal(projectId) {
    const project = allProjects.find(p => p.id === projectId);
    if (!project) return;
    currentlyViewedProjectId = projectId;
    
    document.getElementById('details-title').textContent = project.title;
    document.getElementById('details-author').textContent = project.authorName;
    document.getElementById('details-status').textContent = project.proposalStatus !== 'approved' ? `Proposal: ${project.proposalStatus}` : project.status;
    document.getElementById('details-deadline').textContent = new Date(project.deadline + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    document.getElementById('details-proposal').textContent = project.proposal || 'No proposal provided.';

    document.getElementById('admin-approval-section').style.display = (currentUserRole === 'admin') ? 'block' : 'none';
    document.getElementById('proposal-feedback').value = project.proposalFeedback || '';
    
    // Show delete button only to author or admin
    document.getElementById('delete-section').style.display = (currentUser.uid === project.authorId || currentUserRole === 'admin') ? 'block' : 'none';

    renderTimeline(project);
    renderDeadlineHistory(project);
    
    if (activityUnsubscribe) activityUnsubscribe();
    activityUnsubscribe = db.collection('projects').doc(projectId).onSnapshot(doc => {
        if (doc.exists) renderActivityFeed(doc.data().activity || []);
    });
    
    detailsModal.style.display = 'flex';
}

function renderTimeline(project) {
    const timelineContainer = document.getElementById('details-timeline');
    timelineContainer.innerHTML = '';
    const timeline = project.type === "Interview" ? projectTimelines.Interview : projectTimelines["Op-Ed"];
    timeline.forEach(task => {
        const completed = project.timeline[task] || false;
        const isEditable = (currentUser.uid === project.authorId || currentUserRole === 'admin');
        const taskEl = document.createElement('div');
        taskEl.className = 'task';
        taskEl.innerHTML = `<input type="checkbox" id="task-${task.replace(/\s+/g, '-')}" ${completed ? 'checked' : ''} ${!isEditable ? 'disabled' : ''}><label for="task-${task.replace(/\s+/g, '-')}">${task}</label>`;
        taskEl.querySelector('input').addEventListener('change', (e) => updateTaskStatus(project.id, task, e.target.checked));
        timelineContainer.appendChild(taskEl);
    });
}

function renderDeadlineHistory(project) {
    const historyContainer = document.getElementById('deadline-history');
    historyContainer.innerHTML = project.originalDeadline ? `<p><strong>Original:</strong> ${project.originalDeadline}</p>` : '';
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
            </div>`;
        activityFeed.appendChild(itemEl);
    });
}

// --- STATUS REPORT MODAL ---
const reportModal = document.getElementById('report-modal');
document.getElementById('status-report-button').addEventListener('click', () => {
    const reportContent = document.getElementById('report-content');
    const now = new Date();
    
    const overdueProjects = allProjects.filter(p => new Date(p.deadline) < now && p.proposalStatus === 'approved' && p.status !== 'Ready for Publication');
    const activeProjectsByPerson = allProjects.reduce((acc, p) => {
        if (p.proposalStatus === 'approved' && p.status !== 'Ready for Publication') {
            if (!acc[p.authorName]) acc[p.authorName] = [];
            acc[p.authorName].push(p);
        }
        return acc;
    }, {});

    let reportHTML = `<div class="report-section"><h3><span class="emoji">⚠️</span> Overdue Projects (${overdueProjects.length})</h3>`;
    if (overdueProjects.length > 0) {
        overdueProjects.forEach(p => {
            reportHTML += `<div class="report-item overdue-item"><span class="report-item-title">${p.title}</span> <span class="report-item-meta">by ${p.authorName} - Due ${p.deadline}</span></div>`;
        });
    } else {
        reportHTML += `<p>No overdue projects. Great job, team!</p>`;
    }
    reportHTML += `</div>`;

    reportHTML += `<div class="report-section"><h3><span class="emoji">🚀</span> Active Projects by Person</h3>`;
    Object.entries(activeProjectsByPerson).forEach(([name, projects]) => {
        reportHTML += `<h4>${name} (${projects.length})</h4>`;
        projects.forEach(p => {
            reportHTML += `<div class="report-item"><span class="report-item-title">${p.title}</span> <span class="report-item-meta">Due ${p.deadline}</span></div>`;
        });
    });
    reportHTML += `</div>`;

    reportContent.innerHTML = reportHTML;
    reportModal.style.display = 'flex';
});

// --- ACTIONS & UPDATES ---
async function addActivity(projectId, text) {
    const activity = { text, authorName: currentUserName, timestamp: new Date() };
    await db.collection('projects').doc(projectId).update({ activity: firebase.firestore.FieldValue.arrayUnion(activity) });
}

async function updateTaskStatus(projectId, task, isCompleted) {
    await db.collection('projects').doc(projectId).update({ [`timeline.${task}`]: isCompleted });
    addActivity(projectId, `${isCompleted ? 'completed' : 'un-completed'} the task: "${task}"`);
}

document.getElementById('add-comment-button').addEventListener('click', async () => {
    const commentInput = document.getElementById('comment-input');
    if (commentInput.value.trim() && currentlyViewedProjectId) {
        await addActivity(currentlyViewedProjectId, `commented: "${commentInput.value.trim()}"`);
        commentInput.value = '';
    }
});

['approve-button', 'reject-button', 'hold-button'].forEach(id => {
    document.getElementById(id).addEventListener('click', () => updateProposalStatus(id.split('-')[0]));
});

async function updateProposalStatus(newStatus) {
    if (!currentlyViewedProjectId || currentUserRole !== 'admin') return;
    const feedback = document.getElementById('proposal-feedback').value;
    try {
        await db.collection('projects').doc(currentlyViewedProjectId).update({
            proposalStatus: newStatus,
            status: newStatus === 'approved' ? 'In Progress' : 'On Hold/Rejected',
            proposalFeedback: feedback
        });
        await addActivity(currentlyViewedProjectId, `set the proposal status to **${newStatus}**.`);
        closeAllModals();
    } catch (error) { console.error("Error updating status:", error); }
}

document.getElementById('update-deadline-button').addEventListener('click', async () => {
    const newDeadline = document.getElementById('new-deadline-input').value;
    const reason = document.getElementById('deadline-reason-input').value;
    if (!currentlyViewedProjectId || !newDeadline || !reason) return;
    
    const project = allProjects.find(p => p.id === currentlyViewedProjectId);
    const historyEntry = { newDeadline, reason };

    await db.collection('projects').doc(currentlyViewedProjectId).update({
        deadline: newDeadline,
        originalDeadline: project.originalDeadline || project.deadline,
        deadlineHistory: firebase.firestore.FieldValue.arrayUnion(historyEntry)
    });
    await addActivity(currentlyViewedProjectId, `changed the deadline to **${newDeadline}** for reason: "${reason}"`);
    closeAllModals();
});

document.getElementById('delete-project-button').addEventListener('click', async () => {
    if (!currentlyViewedProjectId) return;
    if (confirm("Are you sure you want to permanently delete this project? This action cannot be undone.")) {
        try {
            await db.collection('projects').doc(currentlyViewedProjectId).delete();
            closeAllModals();
        } catch (error) {
            console.error("Error deleting project:", error);
            alert("Could not delete the project.");
        }
    }
});

// --- UTILITY ---
function stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    let color = '#';
    for (let i = 0; i < 3; i++) {
        let value = (hash >> (i * 8)) & 0xFF;
        color += ('00' + value.toString(16)).substr(-2);
    }
    return color;
}
