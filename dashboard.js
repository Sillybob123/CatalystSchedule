// NOTE: This firebaseConfig should be identical to the one in auth.js
const firebaseConfig = {
    apiKey: "AIzaSyBT6urJvPCtuYQ1c2iH77QTDfzE3yGw-Xk",
    authDomain: "catalystmonday.firebaseapp.com",
    projectId: "catalystmonday",
    storageBucket: "catalystmonday.appspot.com",
    messagingSenderId: "394311851220",
    appId: "1:394311851220:web:86e4939b7d5a085b46d75d"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let currentUserRole = null;
let currentUserName = null; // Variable to store the user's name
let currentProjects = [];

// --- TIMELINE TEMPLATES ---
const projectTimelines = {
    "Interview": [
        "Think of a topic", "Email professor", "Interview Professor",
        "Write Article", "Review edit suggestions and finalize article"
    ],
    "Op-Ed": [
        "Think of a topic", "Write Article", "Review edit suggestions and finalize article"
    ],
    "Editing": [
        "Talk to writer about their project", "Edit and fix story", "Finalize piece"
    ]
};


// --- AUTHENTICATION ---
auth.onAuthStateChanged(user => {
    const loader = document.getElementById('loader');
    const mainContent = document.getElementById('main-content');

    if (user) {
        currentUser = user;
        // Fetch user's role and name from Firestore
        db.collection('users').doc(user.uid).get().then(doc => {
            if (doc.exists) {
                const userData = doc.data();
                currentUserName = userData.name; // Store the user's name
                currentUserRole = userData.role;
                
                document.getElementById('user-name').textContent = `Welcome, ${currentUserName}`;
                
                // Hide 'Propose Article' button if user is not a writer or admin
                if (currentUserRole !== 'writer' && currentUserRole !== 'admin') {
                    document.getElementById('add-project-button').style.display = 'none';
                }
                
                fetchAndRenderProjects();

                // Show main content and hide loader
                loader.style.display = 'none';
                mainContent.style.display = 'block';

            } else {
                // *** IMPROVED ERROR HANDLING ***
                // This block runs if the user exists in Authentication, but not in the Firestore database.
                console.error("User data not found in Firestore!");
                loader.innerHTML = `
                    <div style="text-align: center; color: var(--secondary-color); padding: 20px;">
                        <h2>Account Setup Incomplete</h2>
                        <p>Your user profile could not be found in the database.</p>
                        <p>Please contact an administrator to ensure your account is set up correctly in the Firestore 'users' collection.</p>
                        <button id="error-logout-button" style="width: auto; padding: 10px 20px; margin-top: 15px;">Logout</button>
                    </div>
                `;
                document.getElementById('error-logout-button').addEventListener('click', () => auth.signOut());
            }
        }).catch(error => {
            console.error("Error fetching user data:", error);
            loader.innerHTML = `<div style="text-align: center; color: red;">Error connecting to the database. Check console for details.</div>`;
        });
    } else {
        // If not logged in after check, redirect to login page
        window.location.href = 'index.html';
    }
});

document.getElementById('logout-button').addEventListener('click', () => {
    auth.signOut();
});

// --- KANBAN BOARD RENDERING (No changes below this line) ---
const KANBAN_COLUMNS = {
    PROPOSAL: "Topic Proposal",
    IN_PROGRESS: "In Progress",
    EDITING: "In Editing",
    PUBLICATION: "Ready for Publication"
};

function fetchAndRenderProjects() {
    db.collection('projects').onSnapshot(snapshot => {
        currentProjects = [];
        snapshot.forEach(doc => {
            currentProjects.push({ id: doc.id, ...doc.data() });
        });
        renderKanbanBoard(currentProjects);
    });
}

function renderKanbanBoard(projects) {
    const board = document.getElementById('kanban-board');
    board.innerHTML = '';

    Object.values(KANBAN_COLUMNS).forEach(columnTitle => {
        const columnEl = document.createElement('div');
        columnEl.className = 'kanban-column';
        columnEl.innerHTML = `<h3>${columnTitle}</h3><div class="kanban-cards"></div>`;
        board.appendChild(columnEl);
    });

    projects.forEach(project => {
        let projectColumn;
        if (project.proposalStatus !== 'approved') {
            projectColumn = KANBAN_COLUMNS.PROPOSAL;
        } else if (project.status === 'Ready for Publication') {
            projectColumn = KANBAN_COLUMNS.PUBLICATION;
        } else if (project.status === 'In Editing') {
             projectColumn = KANBAN_COLUMNS.EDITING;
        } else {
            projectColumn = KANBAN_COLUMNS.IN_PROGRESS;
        }

        const columnEl = Array.from(board.querySelectorAll('h3')).find(h => h.textContent === projectColumn)?.nextElementSibling;
        if (columnEl) {
            columnEl.appendChild(createProjectCard(project));
        }
    });
}

function createProjectCard(project) {
    const card = document.createElement('div');
    card.className = 'kanban-card';
    card.dataset.id = project.id;
    
    const deadline = new Date(project.deadline);
    const isOverdue = new Date() > deadline && project.status !== "Ready for Publication";

    let proposalBadge = '';
    if (project.proposalStatus === 'pending') proposalBadge = `<span style="color: orange;">[Pending Approval]</span>`;
    if (project.proposalStatus === 'rejected') proposalBadge = `<span style="color: red;">[Rejected]</span>`;
    if (project.proposalStatus === 'on-hold') proposalBadge = `<span style="color: #6c757d;">[On Hold]</span>`;

    card.innerHTML = `
        <h4 class="card-title">${project.title} ${proposalBadge}</h4>
        <div class="card-meta">
            <p class="card-author"><strong>By:</strong> ${project.authorName}</p>
            <p class="card-deadline ${isOverdue ? 'overdue' : ''}"><strong>Deadline:</strong> ${project.deadline}</p>
        </div>
    `;

    card.addEventListener('click', () => openDetailsModal(project.id));
    return card;
}


// --- PROJECT MODAL (ADD/EDIT) ---
const projectModal = document.getElementById('project-modal');
const projectForm = document.getElementById('project-form');
const addProjectButton = document.getElementById('add-project-button');

addProjectButton.addEventListener('click', () => {
    projectForm.reset();
    document.getElementById('project-id').value = '';
    document.getElementById('modal-title').textContent = 'Propose New Article';
    projectModal.style.display = 'block';
});

projectModal.querySelector('.close-button').addEventListener('click', () => {
    projectModal.style.display = 'none';
});

projectForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const projectId = document.getElementById('project-id').value;
    
    const projectData = {
        title: document.getElementById('project-title').value,
        type: document.getElementById('project-type').value,
        proposal: document.getElementById('project-proposal').value,
        deadline: document.getElementById('project-deadline').value,
        authorId: currentUser.uid,
        authorName: currentUserName,
        proposalStatus: 'pending',
        status: 'Proposed',
        timeline: projectTimelines[document.getElementById('project-type').value].reduce((acc, task) => {
            acc[task] = false;
            return acc;
        }, {}),
        deadlineHistory: []
    };

    try {
        if (projectId) {
            await db.collection('projects').doc(projectId).update(projectData);
        } else {
            await db.collection('projects').add(projectData);
        }
        projectModal.style.display = 'none';
    } catch (error) {
        console.error("Error saving project: ", error);
        alert("Could not save project. See console for details.");
    }
});


// --- DETAILS MODAL ---
const detailsModal = document.getElementById('details-modal');
let currentlyViewedProjectId = null;

detailsModal.querySelector('.close-button').addEventListener('click', () => {
    detailsModal.style.display = 'none';
    currentlyViewedProjectId = null;
});

function openDetailsModal(projectId) {
    const project = currentProjects.find(p => p.id === projectId);
    if (!project) return;
    
    currentlyViewedProjectId = projectId;
    
    document.getElementById('details-title').textContent = project.title;
    document.getElementById('details-author').textContent = project.authorName;
    document.getElementById('details-status').textContent = project.status;
    document.getElementById('details-deadline').textContent = project.deadline;
    
    document.getElementById('details-proposal').textContent = project.proposal || 'No proposal provided.';
    const adminSection = document.getElementById('admin-approval-section');
    adminSection.style.display = (currentUserRole === 'admin') ? 'block' : 'none';
    document.getElementById('proposal-feedback').value = project.proposalFeedback || '';

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
            updateTaskStatus(projectId, task, e.target.checked);
        });
        timelineContainer.appendChild(taskEl);
    });

    const historyContainer = document.getElementById('deadline-history');
    historyContainer.innerHTML = '';
    if (project.originalDeadline) {
        historyContainer.innerHTML += `<p><strong>Original Deadline:</strong> ${project.originalDeadline}</p>`;
    }
    project.deadlineHistory?.forEach(entry => {
        historyContainer.innerHTML += `<p>Changed to ${entry.newDeadline} on ${new Date(entry.changedAt.seconds * 1000).toLocaleDateString()}: "${entry.reason}"</p>`;
    });

    detailsModal.style.display = 'block';
}

async function updateTaskStatus(projectId, task, isCompleted) {
    const projectRef = db.collection('projects').doc(projectId);
    const updatePath = `timeline.${task}`;
    
    try {
        await projectRef.update({ [updatePath]: isCompleted });
        console.log(`Task '${task}' status updated.`);
    } catch (error) {
        console.error("Error updating task: ", error);
    }
}

// --- ADMIN & DEADLINE ACTIONS in DETAILS MODAL ---
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
        detailsModal.style.display = 'none';
    } catch (error) {
        console.error("Error updating proposal status: ", error);
    }
}

document.getElementById('update-deadline-button').addEventListener('click', async () => {
    const newDeadline = document.getElementById('new-deadline-input').value;
    const reason = document.getElementById('deadline-reason-input').value;
    if (!currentlyViewedProjectId || !newDeadline || !reason) {
        alert("Please provide a new deadline and a reason for the change.");
        return;
    }
    
    const projectRef = db.collection('projects').doc(currentlyViewedProjectId);
    const project = currentProjects.find(p => p.id === currentlyViewedProjectId);

    const historyEntry = {
        newDeadline: newDeadline,
        reason: reason,
        changedAt: new Date()
    };

    try {
        await projectRef.update({
            deadline: newDeadline,
            originalDeadline: project.originalDeadline || project.deadline,
            deadlineHistory: firebase.firestore.FieldValue.arrayUnion(historyEntry)
        });
        detailsModal.style.display = 'none';
    } catch (error) {
        console.error("Error updating deadline: ", error);
    }
});


// Close modals if clicked outside
window.onclick = function(event) {
    if (event.target == projectModal) {
        projectModal.style.display = "none";
    }
    if (event.target == detailsModal) {
        detailsModal.style.display = "none";
    }
}
