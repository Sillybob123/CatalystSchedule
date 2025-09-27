// =================
// Modals (Projects)
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
    currentlyViewedTaskId = null;
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
// Actions (Projects)
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

// ===================================
// STATUS REPORT HELPER FUNCTIONS (Existing)
// ===================================

function getLastActivity(project) {
    const activity = project.activity || [];
    if (activity.length === 0) return 'No activity';
    
    const lastActivity = activity.sort((a, b) => {
        const aTime = a.timestamp?.seconds || 0;
        const bTime = b.timestamp?.seconds || 0;
        return bTime - aTime;
    })[0];
    
    if (!lastActivity.timestamp) return 'Unknown time';
    
    const timestamp = lastActivity.timestamp.seconds ? 
        new Date(lastActivity.timestamp.seconds * 1000) : 
        new Date(lastActivity.timestamp);
    
    const now = new Date();
    const diffTime = now - timestamp;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
    return `${Math.ceil(diffDays / 30)} months ago`;
}

// Simplified status report generation
function generateStatusReport() {
    const reportModal = document.getElementById('report-modal');
    const reportContent = document.getElementById('report-content');
    if (!reportModal || !reportContent) return;

    const now = new Date();
    
    // Project analysis
    const overdueProjects = allProjects.filter(p => {
        const finalDeadline = p.deadlines ? p.deadlines.publication : p.deadline;
        return finalDeadline && new Date(finalDeadline) < now && getProjectState(p).column !== 'Completed';
    });

    const pendingProposals = allProjects.filter(p => p.proposalStatus === 'pending');
    const completedProjects = allProjects.filter(p => getProjectState(p).column === 'Completed');
    
    // Task analysis
    const overdueTasks = allTasks.filter(t => new Date(t.deadline) < now && t.status !== 'completed');
    const pendingTasks = allTasks.filter(t => t.status === 'pending');
    const completedTasks = allTasks.filter(t => t.status === 'completed');
    
    let reportHTML = `
        <div class="report-section executive-summary">
            <h2>🎯 Executive Dashboard</h2>
            <div class="summary-grid">
                <div class="summary-item total">
                    <div class="summary-value">${allProjects.length}</div>
                    <div class="summary-label">Total Projects</div>
                </div>
                <div class="summary-item ${overdueProjects.length > 0 ? 'overdue' : ''}">
                    <div class="summary-value">${overdueProjects.length}</div>
                    <div class="summary-label">Overdue Projects</div>
                </div>
                <div class="summary-item completed">
                    <div class="summary-value">${completedProjects.length}</div>
                    <div class="summary-label">Completed Projects</div>
                </div>
                <div class="summary-item total">
                    <div class="summary-value">${allTasks.length}</div>
                    <div class="summary-label">Total Tasks</div>
                </div>
            </div>
        </div>
        
        <div class="report-section">
            <h2>📋 Task Overview</h2>
            <div class="summary-grid">
                <div class="summary-item ${overdueTasks.length > 0 ? 'overdue' : ''}">
                    <div class="summary-value">${overdueTasks.length}</div>
                    <div class="summary-label">Overdue Tasks</div>
                </div>
                <div class="summary-item ${pendingTasks.length > 0 ? 'pending' : ''}">
                    <div class="summary-value">${pendingTasks.length}</div>
                    <div class="summary-label">Pending Approval</div>
                </div>
                <div class="summary-item completed">
                    <div class="summary-value">${completedTasks.length}</div>
                    <div class="summary-label">Completed Tasks</div>
                </div>
                <div class="summary-item">
                    <div class="summary-value">${allTasks.filter(t => t.status === 'approved').length}</div>
                    <div class="summary-label">In Progress</div>
                </div>
            </div>
        </div>
    `;

    // Critical Issues
    if (overdueProjects.length > 0 || overdueTasks.length > 0 || pendingProposals.length > 0) {
        reportHTML += `
            <div class="report-section">
                <h2>🚨 Actions Required</h2>
                ${overdueProjects.length > 0 ? `<h3>Overdue Projects (${overdueProjects.length})</h3>` : ''}
                ${overdueProjects.map(p => {
                    const deadline = p.deadlines ? p.deadlines.publication : p.deadline;
                    const daysPast = Math.ceil((now - new Date(deadline)) / (1000 * 60 * 60 * 24));
                    return `
                        <div class="report-item overdue-item" data-id="${p.id}">
                            <span>${p.title}</span>
                            <span class="meta">${daysPast} days overdue</span>
                        </div>
                    `;
                }).join('')}
                
                ${overdueTasks.length > 0 ? `<h3>Overdue Tasks (${overdueTasks.length})</h3>` : ''}
                ${overdueTasks.map(t => {
                    const daysPast = Math.ceil((now - new Date(t.deadline)) / (1000 * 60 * 60 * 24));
                    return `
                        <div class="report-item overdue-item" data-id="${t.id}" data-type="task">
                            <span>${t.title} (assigned to ${t.assigneeName})</span>
                            <span class="meta">${daysPast} days overdue</span>
                        </div>
                    `;
                }).join('')}
                
                ${pendingProposals.length > 0 ? `<h3>Pending Proposals (${pendingProposals.length})</h3>` : ''}
                ${pendingProposals.map(p => `
                    <div class="report-item pending-item" data-id="${p.id}">
                        <span>${p.title}</span>
                        <span class="meta">by ${p.authorName}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    reportContent.innerHTML = reportHTML;

    // Add click handlers
    reportContent.querySelectorAll('[data-id]').forEach(item => {
        item.addEventListener('click', () => {
            closeAllModals();
            if (item.dataset.type === 'task') {
                openTaskDetailsModal(item.dataset.id);
            } else {
                openDetailsModal(item.dataset.id);
            }
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

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showNotification(message, type = 'success') {
    console.log(`[NOTIFICATION ${type.toUpperCase()}] ${message}`);
    // Simple alert for now - you could enhance this with a toast system
    if (type === 'error') {
        alert(`Error: ${message}`);
    } else {
        alert(message);
    }
}

// Import getProjectState and getColumnsForView from projectState.js
// These functions are defined in projectState.js which is loaded before this file// ==================
//  Data Handling (Projects)
// ==================
function subscribeToProjects() {
    console.log("[FIREBASE] Setting up projects subscription...");
    
    db.collection('projects').onSnapshot(snapshot => {
        console.log("[FIREBASE] Projects updated, processing...");
        
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

function updateNavCounts() {
    const myAssignmentsProjects = allProjects.filter(p => {
        return p.authorId === currentUser.uid || p.editorId === currentUser.uid;
    }).length;
    
    const myAssignmentsTasks = allTasks.filter(t => {
        return t.creatorId === currentUser.uid || t.assigneeId === currentUser.uid;
    }).length;
    
    const totalAssignments = myAssignmentsProjects + myAssignmentsTasks;
    
    const navLink = document.querySelector('#nav-my-assignments span');
    if (navLink) {
        navLink.textContent = `My Assignments (${totalAssignments})`;
    }
}

// ==================
//  Kanban Board (Projects)
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
            // Include both projects and tasks for my assignments
            return [...allProjects.filter(p => p.authorId === currentUser.uid || p.editorId === currentUser.uid),
                    ...allTasks.filter(t => t.creatorId === currentUser.uid || t.assigneeId === currentUser.uid).map(t => ({...t, isTask: true}))];
        default:
            return [];
    }
}

function createProjectCard(project) {
    // Handle task cards differently
    if (project.isTask) {
        return createTaskCardForAssignments(project);
    }
    
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
    
    card.addEventListener('click', () => openDetailsModal(project.id));
    return card;
}

function createTaskCardForAssignments(task) {
    const card = document.createElement('div');
    card.className = 'kanban-card task-card';
    card.dataset.id = task.id;
    card.dataset.type = 'task';
    
    // Check if overdue
    const isOverdue = new Date(task.deadline) < new Date() && task.status !== 'completed';
    const isDueSoon = !isOverdue && new Date(task.deadline) < new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    
    if (isOverdue) card.classList.add('overdue');
    if (isDueSoon) card.classList.add('due-soon');
    
    // Format deadline
    const deadline = new Date(task.deadline);
    const deadlineText = deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    // Priority colors
    const priorityColors = {
        low: '#10b981',
        medium: '#f59e0b', 
        high: '#ef4444',
        urgent: '#dc2626'
    };
    
    const priorityColor = priorityColors[task.priority] || priorityColors.medium;
    
    card.innerHTML = `
        <h4 class="card-title">📋 ${task.title}</h4>
        <div class="card-meta">
            <span class="card-type" style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white;">TASK</span>
            <span class="card-status">${(task.status || 'pending').replace('_', ' ')}</span>
        </div>
        <div class="card-footer">
            <div class="card-author">
                <div class="user-avatar" style="background: ${stringToColor(task.creatorName)}">
                    ${task.creatorName.charAt(0)}
                </div>
                <span>→ ${task.assigneeName}</span>
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

// =================
// Calendar (existing functionality)
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

    // Find projects and tasks for this day
    const dayProjects = allProjects.filter(project => {
        return hasProjectDeadlineOnDate(project, date);
    });
    
    const dayTasks = allTasks.filter(task => {
        return hasTaskDeadlineOnDate(task, date);
    });

    // Display up to 3 events, then show "+X more"
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

    // Add click handler for day
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
        // Task event
        eventEl.className = 'calendar-event task-event';
        eventEl.textContent = `📋 ${item.title}`;
        eventEl.title = `Task: ${item.title} - Due ${date.toLocaleDateString()}`;
        eventEl.style.background = 'linear-gradient(135deg, #3b82f6, #1d4ed8)';
    } else {
        // Project event
        const { eventType, eventTitle } = getEventTypeForDate(item, date);
        eventEl.className = `calendar-event ${eventType}`;
        eventEl.textContent = eventTitle;
        eventEl.title = `${item.title} - ${eventTitle} - ${date.toLocaleDateString()}`;
    }

    // Add click handler
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
    const taskDeadline = new Date(task.deadline + 'T00:00:00');
    return formatDateForComparison(taskDeadline) === formatDateForComparison(date);
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
    
    // Count project deadlines
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
    
    // Count task deadlines
    allTasks.forEach(task => {
        const deadline = new Date(task.deadline + 'T00:00:00');
        
        if (deadline >= monthStart && deadline <= monthEnd) {
            thisMonthCount++;
        }
        
        if (deadline >= weekStart && deadline <= weekEnd) {
            thisWeekCount++;
        }
        
        if (deadline < now && task.status !== 'completed') {
            overdueCount++;
        }
    });
    
    // Update stats display
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
            message += `${index + 1}. [TASK] ${item.title}\n   Assigned to: ${item.assigneeName}\n   Priority: ${item.priority || 'medium'}\n\n`;
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
}// ===============================
// Catalyst Tracker - Complete Working Dashboard JS with Task Management
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
//  Task Management
// ==================
function subscribeToTasks() {
    console.log("[FIREBASE] Setting up tasks subscription...");
    
    db.collection('tasks').onSnapshot(snapshot => {
        console.log("[FIREBASE] Tasks updated, processing...");
        
        allTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (currentView === 'tasks') {
            renderTasksBoard(allTasks);
        }
        updateNavCounts();

        // Refresh task details modal if open
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

function renderTasksBoard(tasks) {
    console.log(`[RENDER] Rendering ${tasks.length} tasks`);
    const board = document.getElementById('tasks-board');
    board.innerHTML = '';
    
    const columns = [
        { id: 'pending', title: 'Pending Approval', icon: '⏳' },
        { id: 'approved', title: 'Approved', icon: '✅' },
        { id: 'in_progress', title: 'In Progress', icon: '🔄' },
        { id: 'completed', title: 'Completed', icon: '🎉' }
    ];
    
    columns.forEach(column => {
        const columnTasks = tasks.filter(task => getTaskColumn(task) === column.id);
        console.log(`[COLUMN] "${column.title}" has ${columnTasks.length} tasks`);

        const columnEl = document.createElement('div');
        columnEl.className = 'kanban-column';
        
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
    if (task.status === 'rejected') return 'pending'; // Rejected tasks go back to pending
    if (task.status === 'approved') {
        // Check if assignee has started working on it
        if (task.activity && task.activity.some(a => a.text.includes('started working') || a.text.includes('in progress'))) {
            return 'in_progress';
        }
        return 'approved';
    }
    return 'pending'; // Default for new tasks
}

function createTaskCard(task) {
    const card = document.createElement('div');
    card.className = 'kanban-card';
    card.dataset.id = task.id;
    
    // Check if overdue
    const isOverdue = new Date(task.deadline) < new Date() && task.status !== 'completed';
    const isDueSoon = !isOverdue && new Date(task.deadline) < new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    
    if (isOverdue) card.classList.add('overdue');
    if (isDueSoon) card.classList.add('due-soon');
    
    // Priority styling
    card.classList.add(`priority-${task.priority || 'medium'}`);
    
    // Format deadline
    const deadline = new Date(task.deadline);
    const deadlineText = deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    // Priority badge
    const priorityColors = {
        low: '#10b981',
        medium: '#f59e0b', 
        high: '#ef4444',
        urgent: '#dc2626'
    };
    
    const priorityColor = priorityColors[task.priority] || priorityColors.medium;
    
    card.innerHTML = `
        <h4 class="card-title">${escapeHtml(task.title)}</h4>
        <div class="card-meta">
            <div class="priority-badge" style="background-color: ${priorityColor}; color: white; padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">
                ${(task.priority || 'medium').toUpperCase()}
            </div>
            <div class="status-badge ${task.status || 'pending'}">${(task.status || 'pending').replace('_', ' ')}</div>
        </div>
        ${task.description ? `<div class="card-content-preview">${escapeHtml(task.description.substring(0, 100))}${task.description.length > 100 ? '...' : ''}</div>` : ''}
        <div class="card-footer">
            <div class="card-author">
                <div class="user-avatar" style="background-color: ${stringToColor(task.creatorName)}">
                    ${task.creatorName.charAt(0).toUpperCase()}
                </div>
                <span>→ ${escapeHtml(task.assigneeName)}</span>
            </div>
            <div class="card-deadline ${isOverdue ? 'overdue' : isDueSoon ? 'due-today' : ''}">
                ${deadlineText}
            </div>
        </div>
    `;
    
    card.addEventListener('click', () => openTaskDetailsModal(task.id));
    return card;
}

// ==================
//  Task Modal Functions
// ==================
function openTaskModal() {
    document.getElementById('task-form').reset();
    populateTaskAssigneeDropdown();
    document.getElementById('task-modal').style.display = 'flex';
    
    // Focus first input
    setTimeout(() => {
        document.getElementById('task-title').focus();
    }, 100);
}

function populateTaskAssigneeDropdown() {
    const dropdown = document.getElementById('task-assignee');
    dropdown.innerHTML = '<option value="">Select person to assign task to</option>';
    allUsers.forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = user.name;
        dropdown.appendChild(option);
    });
}

function openTaskDetailsModal(taskId) {
    const task = allTasks.find(t => t.id === taskId);
    if (!task) {
        console.error("[MODAL] Task not found:", taskId);
        return;
    }
    
    currentlyViewedTaskId = taskId;
    refreshTaskDetailsModal(task);
    document.getElementById('task-details-modal').style.display = 'flex';
}

function refreshTaskDetailsModal(task) {
    // Basic info
    document.getElementById('task-details-title').textContent = task.title;
    document.getElementById('task-details-description').textContent = task.description || 'No description provided.';
    
    // Status
    document.getElementById('task-details-status').textContent = (task.status || 'pending').replace('_', ' ').toUpperCase();
    
    // Assignment
    document.getElementById('task-details-creator').textContent = task.creatorName;
    document.getElementById('task-details-assignee').textContent = task.assigneeName || 'Not assigned';
    
    // Timeline
    const createdDate = task.createdAt ? new Date(task.createdAt.seconds * 1000) : new Date();
    const deadlineDate = new Date(task.deadline);
    document.getElementById('task-details-created').textContent = createdDate.toLocaleDateString('en-US', { 
        year: 'numeric', month: 'long', day: 'numeric' 
    });
    document.getElementById('task-details-deadline').textContent = deadlineDate.toLocaleDateString('en-US', { 
        year: 'numeric', month: 'long', day: 'numeric' 
    });
    document.getElementById('task-details-priority').textContent = (task.priority || 'medium').toUpperCase();
    
    // Permissions and actions
    const isAdmin = currentUserRole === 'admin';
    const isCreator = currentUser.uid === task.creatorId;
    const isAssignee = currentUser.uid === task.assigneeId;
    
    // Admin approval section
    const adminSection = document.getElementById('task-admin-approval-section');
    if (adminSection) {
        adminSection.style.display = isAdmin && task.status === 'pending' ? 'block' : 'none';
    }
    
    // Assignee actions
    const assigneeActions = document.getElementById('task-assignee-actions');
    if (assigneeActions) {
        assigneeActions.style.display = isAssignee && task.status === 'approved' ? 'block' : 'none';
    }
    
    // Delete section
    const deleteSection = document.getElementById('task-delete-section');
    const deleteButton = document.getElementById('delete-task-button');
    if (deleteSection && deleteButton) {
        deleteButton.style.display = (isAdmin || isCreator) ? 'block' : 'none';
    }
    
    // Activity feed
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
    
    // Sort activity by timestamp (newest first)
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

// ==================
//  Task Actions
// ==================
async function handleTaskFormSubmit(e) {
    e.preventDefault();
    
    const submitButton = document.getElementById('save-task-button');
    const originalText = submitButton.textContent;
    
    try {
        submitButton.disabled = true;
        submitButton.textContent = 'Creating...';
        
        const assigneeId = document.getElementById('task-assignee').value;
        const assignee = allUsers.find(u => u.id === assigneeId);
        
        if (!assignee) {
            throw new Error('Please select a valid assignee');
        }
        
        const newTask = {
            title: document.getElementById('task-title').value.trim(),
            description: document.getElementById('task-description').value.trim(),
            assigneeId: assigneeId,
            assigneeName: assignee.name,
            deadline: document.getElementById('task-deadline').value,
            priority: document.getElementById('task-priority').value,
            creatorId: currentUser.uid,
            creatorName: currentUserName,
            status: 'pending',
            createdAt: new Date(),
            activity: [{
                text: 'created this task',
                authorName: currentUserName,
                timestamp: new Date()
            }]
        };
        
        await db.collection('tasks').add(newTask);
        
        showNotification('Task created successfully!', 'success');
        closeAllModals();
        
    } catch (error) {
        console.error("[ERROR] Failed to create task:", error);
        showNotification(error.message || 'Failed to create task. Please try again.', 'error');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = originalText;
    }
}

async function updateTaskStatus(newStatus) {
    if (!currentlyViewedTaskId) return;
    
    try {
        const updates = {
            status: newStatus,
            activity: firebase.firestore.FieldValue.arrayUnion({
                text: `marked task as ${newStatus}`,
                authorName: currentUserName,
                timestamp: new Date()
            })
        };
        
        if (newStatus === 'completed') {
            updates.completedAt = new Date();
        }
        
        await db.collection('tasks').doc(currentlyViewedTaskId).update(updates);
        
        showNotification(`Task ${newStatus} successfully!`, 'success');
        
    } catch (error) {
        console.error(`[ERROR] Failed to update task status to ${newStatus}:`, error);
        showNotification(`Failed to ${newStatus} task. Please try again.`, 'error');
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

// Enhanced Task Rendering Function
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
    
    columns.forEach((column, index) => {
        const columnTasks = tasks.filter(task => getTaskColumn(task) === column.id);
        console.log(`[COLUMN] "${column.title}" has ${columnTasks.length} tasks`);

        const columnEl = document.createElement('div');
        columnEl.className = 'kanban-column';
        columnEl.style.setProperty('--column-accent', column.color);
        columnEl.style.setProperty('--column-accent-dark', adjustColorBrightness(column.color, -20));
        
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
            columnTasks
                .sort((a, b) => {
                    // Sort by priority first, then by deadline
                    const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
                    const aPriority = priorityOrder[a.priority] || 2;
                    const bPriority = priorityOrder[b.priority] || 2;
                    
                    if (aPriority !== bPriority) {
                        return bPriority - aPriority; // Higher priority first
                    }
                    
                    // Then sort by deadline
                    return new Date(a.deadline) - new Date(b.deadline);
                })
                .forEach(task => {
                    cardsContainer.appendChild(createEnhancedTaskCard(task));
                });
        }
        
        board.appendChild(columnEl);
    });
}

// Enhanced Task Card Creation
function createEnhancedTaskCard(task) {
    const card = document.createElement('div');
    card.className = 'kanban-card';
    card.classList.add(`priority-${task.priority || 'medium'}`);
    card.dataset.id = task.id;
    
    // Check if overdue or due soon
    const deadline = new Date(task.deadline);
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    const isOverdue = deadline < now && task.status !== 'completed';
    const isDueSoon = deadline < tomorrow && deadline >= now;
    
    if (isOverdue) card.classList.add('overdue');
    if (isDueSoon) card.classList.add('due-soon');
    
    // Format deadline
    const deadlineText = deadline.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: deadline.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
    
    // Priority colors
    const priorityColors = {
        urgent: '#dc2626',
        high: '#ea580c',
        medium: '#f59e0b',
        low: '#059669'
    };
    
    const priorityColor = priorityColors[task.priority] || priorityColors.medium;
    
    // Build the card HTML
    let cardHTML = `
        <h4 class="card-title">${escapeHtml(task.title)}</h4>
        <div class="card-meta">
            <div class="priority-badge ${task.priority || 'medium'}" style="background-color: ${priorityColor};">
                ${(task.priority || 'medium').toUpperCase()}
            </div>
            <div class="status-badge ${task.status || 'pending'}">
                ${(task.status || 'pending').replace('_', ' ')}
            </div>
        </div>
    `;
    
    // Add description preview if available
    if (task.description && task.description.trim()) {
        const preview = task.description.length > 120 ? 
            task.description.substring(0, 120) + '...' : 
            task.description;
        cardHTML += `<div class="card-content-preview">${escapeHtml(preview)}</div>`;
    }
    
    // Add footer with assignee and deadline
    cardHTML += `
        <div class="card-footer">
            <div class="card-author">
                <div class="user-avatar" style="background-color: ${stringToColor(task.creatorName)}">
                    ${task.creatorName.charAt(0).toUpperCase()}
                </div>
                <span title="Created by ${escapeHtml(task.creatorName)}, assigned to ${escapeHtml(task.assigneeName)}">
                    → ${escapeHtml(task.assigneeName)}
                </span>
            </div>
            <div class="card-deadline ${isOverdue ? 'overdue' : isDueSoon ? 'due-today' : ''}" 
                 title="Due: ${deadline.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}">
                ${deadlineText}
            </div>
        </div>
    `;
    
    card.innerHTML = cardHTML;
    
    // Add click handler
    card.addEventListener('click', () => openTaskDetailsModal(task.id));
    
    return card;
}

// Enhanced task column determination
function getTaskColumn(task) {
    if (task.status === 'completed') return 'completed';
    if (task.status === 'rejected') return 'pending'; // Rejected tasks go back to pending
    if (task.status === 'approved') {
        // Check if assignee has started working on it (look for activity)
        if (task.activity && task.activity.some(a => 
            a.text.includes('started working') || 
            a.text.includes('in progress') ||
            a.text.includes('commented:')
        )) {
            return 'in_progress';
        }
        return 'approved';
    }
    return 'pending'; // Default for new tasks and rejected tasks
}

// Helper function to adjust color brightness
function adjustColorBrightness(hex, percent) {
    // Remove # if present
    hex = hex.replace('#', '');
    
    // Parse RGB values
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Adjust brightness
    const factor = (100 + percent) / 100;
    const newR = Math.round(Math.min(255, Math.max(0, r * factor)));
    const newG = Math.round(Math.min(255, Math.max(0, g * factor)));
    const newB = Math.round(Math.min(255, Math.max(0, b * factor)));
    
    // Convert back to hex
    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
}

// Enhanced form validation
function validateTaskForm() {
    const title = document.getElementById('task-title').value.trim();
    const assigneeId = document.getElementById('task-assignee').value;
    const deadline = document.getElementById('task-deadline').value;
    
    const errors = [];
    
    if (!title || title.length < 3) {
        errors.push('Task title must be at least 3 characters long');
    }
    
    if (!assigneeId) {
        errors.push('Please select someone to assign this task to');
    }
    
    if (!deadline) {
        errors.push('Please set a deadline for this task');
    } else {
        const deadlineDate = new Date(deadline);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (deadlineDate < today) {
            errors.push('Deadline cannot be in the past');
        }
    }
    
    return errors;
}

// Enhanced task form submission with better error handling
async function handleTaskFormSubmit(e) {
    e.preventDefault();
    
    const submitButton = document.getElementById('save-task-button');
    const originalText = submitButton.textContent;
    
    // Validate form
    const validationErrors = validateTaskForm();
    if (validationErrors.length > 0) {
        showNotification(validationErrors.join('. '), 'error');
        return;
    }
    
    try {
        // Show loading state
        submitButton.disabled = true;
        submitButton.classList.add('loading');
        submitButton.textContent = 'Creating Task...';
        
        const assigneeId = document.getElementById('task-assignee').value;
        const assignee = allUsers.find(u => u.id === assigneeId);
        
        if (!assignee) {
            throw new Error('Selected assignee not found');
        }
        
        const newTask = {
            title: document.getElementById('task-title').value.trim(),
            description: document.getElementById('task-description').value.trim() || null,
            assigneeId: assigneeId,
            assigneeName: assignee.name,
            deadline: document.getElementById('task-deadline').value,
            priority: document.getElementById('task-priority').value || 'medium',
            creatorId: currentUser.uid,
            creatorName: currentUserName,
            status: 'pending',
            createdAt: new Date(),
            activity: [{
                text: 'created this task',
                authorName: currentUserName,
                timestamp: new Date()
            }]
        };
        
        console.log('[TASK CREATE] Creating task:', newTask);
        
        const docRef = await db.collection('tasks').add(newTask);
        console.log('[TASK CREATE] Task created with ID:', docRef.id);
        
        showNotification('Task created successfully! It will appear once an admin approves it.', 'success');
        closeAllModals();
        
        // Reset form
        document.getElementById('task-form').reset();
        
    } catch (error) {
        console.error("[ERROR] Failed to create task:", error);
        
        let errorMessage = 'Failed to create task. ';
        
        if (error.code === 'permission-denied') {
            errorMessage += 'You do not have permission to create tasks. Please contact an administrator.';
        } else if (error.message) {
            errorMessage += error.message;
        } else {
            errorMessage += 'Please try again or contact support.';
        }
        
        showNotification(errorMessage, 'error');
    } finally {
        // Reset button state
        submitButton.disabled = false;
        submitButton.classList.remove('loading');
        submitButton.textContent = originalText;
    }
}

// Enhanced notification function with better styling
function showNotification(message, type = 'success') {
    console.log(`[NOTIFICATION ${type.toUpperCase()}] ${message}`);
    
    // Create notification container if it doesn't exist
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
    
    // Set colors based on type
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
    
    // Show notification
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Hide and remove notification
    setTimeout(() => {
        notification.style.transform = 'translateX(400px)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 4000);
}

// Enhanced task details modal with better status actions
function refreshTaskDetailsModal(task) {
    // Basic info
    document.getElementById('task-details-title').textContent = task.title;
    document.getElementById('task-details-description').textContent = task.description || 'No description provided.';
    
    // Status with better formatting
    const statusElement = document.getElementById('task-details-status');
    const statusText = (task.status || 'pending').replace('_', ' ').toUpperCase();
    statusElement.textContent = statusText;
    statusElement.className = `status-badge ${task.status || 'pending'}`;
    
    // Assignment info
    document.getElementById('task-details-creator').textContent = task.creatorName;
    document.getElementById('task-details-assignee').textContent = task.assigneeName || 'Not assigned';
    
    // Timeline with better date formatting
    const createdDate = task.createdAt ? new Date(task.createdAt.seconds * 1000) : new Date();
    const deadlineDate = new Date(task.deadline);
    
    document.getElementById('task-details-created').textContent = createdDate.toLocaleDateString('en-US', { 
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    
    document.getElementById('task-details-deadline').textContent = deadlineDate.toLocaleDateString('en-US', { 
        year: 'numeric', month: 'long', day: 'numeric' 
    });
    
    // Priority with color coding
    const priorityElement = document.getElementById('task-details-priority');
    const priority = (task.priority || 'medium').toUpperCase();
    priorityElement.textContent = priority;
    priorityElement.className = `priority-badge ${task.priority || 'medium'}`;
    
    const priorityColors = {
        urgent: '#dc2626',
        high: '#ea580c',
        medium: '#f59e0b',
        low: '#059669'
    };
    priorityElement.style.backgroundColor = priorityColors[task.priority] || priorityColors.medium;
    priorityElement.style.color = 'white';
    priorityElement.style.padding = '4px 8px';
    priorityElement.style.borderRadius = '8px';
    priorityElement.style.fontSize = '12px';
    priorityElement.style.fontWeight = '700';
    
    // Permissions and actions
    const isAdmin = currentUserRole === 'admin';
    const isCreator = currentUser.uid === task.creatorId;
    const isAssignee = currentUser.uid === task.assigneeId;
    
    // Admin approval section
    const adminSection = document.getElementById('task-admin-approval-section');
    if (adminSection) {
        adminSection.style.display = isAdmin && task.status === 'pending' ? 'block' : 'none';
    }
    
    // Assignee actions
    const assigneeActions = document.getElementById('task-assignee-actions');
    if (assigneeActions) {
        assigneeActions.style.display = isAssignee && task.status === 'approved' ? 'block' : 'none';
    }
    
    // Delete section
    const deleteSection = document.getElementById('task-delete-section');
    const deleteButton = document.getElementById('delete-task-button');
    if (deleteSection && deleteButton) {
        deleteButton.style.display = (isAdmin || isCreator) ? 'block' : 'none';
    }
    
    // Activity feed
    renderTaskActivityFeed(task.activity || []);
    
    // Add deadline warning if overdue or due soon
    const now = new Date();
    const deadline = new Date(task.deadline);
    const deadlineSection = document.getElementById('task-details-deadline').parentElement;
    
    // Remove existing warnings
    const existingWarning = deadlineSection.querySelector('.deadline-warning');
    if (existingWarning) {
        existingWarning.remove();
    }
    
    if (deadline < now && task.status !== 'completed') {
        const warning = document.createElement('div');
        warning.className = 'deadline-warning task-deadline-critical';
        warning.textContent = '⚠️ This task is overdue!';
        deadlineSection.appendChild(warning);
    } else if (deadline < new Date(now.getTime() + 24 * 60 * 60 * 1000)) {
        const warning = document.createElement('div');
        warning.className = 'deadline-warning task-deadline-warning';
        warning.textContent = '⏰ This task is due soon!';
        deadlineSection.appendChild(warning);
    }
}

// ===============================
// MULTIPLE TASK ASSIGNEES - SAFE ADDITIONS
// ===============================

// Store original functions
const originalPopulateTaskAssigneeDropdown = window.populateTaskAssigneeDropdown;
const originalHandleTaskFormSubmit = window.handleTaskFormSubmit;
const originalValidateTaskForm = window.validateTaskForm;

// Enhanced populate function
window.populateTaskAssigneeDropdown = function() {
    const dropdown = document.getElementById('task-assignee');
    if (!dropdown) return;
    
    dropdown.innerHTML = '<option value="" disabled>Select people to assign task to (hold Ctrl/Cmd for multiple)</option>';
    dropdown.multiple = true;
    dropdown.size = 6;
    
    allUsers.forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = user.name;
        dropdown.appendChild(option);
    });
};

// Enhanced validation
window.validateTaskForm = function() {
    const title = document.getElementById('task-title').value.trim();
    const assigneeSelect = document.getElementById('task-assignee');
    const selectedAssignees = assigneeSelect ? Array.from(assigneeSelect.selectedOptions) : [];
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
    } else {
        const deadlineDate = new Date(deadline);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (deadlineDate < today) {
            errors.push('Deadline cannot be in the past');
        }
    }
    
    return errors;
};

console.log('[MULTIPLE ASSIGNEES] Multiple assignee functionality loaded!');

// ===============================
// COMPLETE MULTIPLE ASSIGNEE FIX
// Add this to the END of dashboard.js
// ===============================

// Enhanced task form submission with multiple assignees
async function handleTaskFormSubmitEnhanced(e) {
    e.preventDefault();
    
    const submitButton = document.getElementById('save-task-button');
    const originalText = submitButton.textContent;
    
    try {
        // Show loading state
        submitButton.disabled = true;
        submitButton.classList.add('loading');
        submitButton.textContent = 'Creating Task...';
        
        // Get form values
        const title = document.getElementById('task-title').value.trim();
        const description = document.getElementById('task-description').value.trim();
        const deadline = document.getElementById('task-deadline').value;
        const priority = document.getElementById('task-priority').value || 'medium';
        
        // Get selected assignees
        const assigneeSelect = document.getElementById('task-assignee');
        const selectedOptions = assigneeSelect.selectedOptions;
        const selectedAssigneeIds = Array.from(selectedOptions).map(option => option.value).filter(id => id);
        
        // Validation
        if (!title || title.length < 3) {
            throw new Error('Task title must be at least 3 characters long');
        }
        
        if (selectedAssigneeIds.length === 0) {
            throw new Error('Please select at least one person to assign this task to');
        }
        
        if (!deadline) {
            throw new Error('Please set a deadline for this task');
        }
        
        const deadlineDate = new Date(deadline);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (deadlineDate < today) {
            throw new Error('Deadline cannot be in the past');
        }
        
        // Get assignee details
        const assignees = allUsers.filter(u => selectedAssigneeIds.includes(u.id));
        const assigneeNames = assignees.map(u => u.name);
        
        if (assignees.length !== selectedAssigneeIds.length) {
            throw new Error('Some selected users could not be found');
        }
        
        const newTask = {
            title: title,
            description: description || null,
            // Multiple assignees (new format)
            assigneeIds: selectedAssigneeIds,
            assigneeNames: assigneeNames,
            // Single assignee (backwards compatibility)
            assigneeId: selectedAssigneeIds[0],
            assigneeName: assigneeNames[0],
            deadline: deadline,
            priority: priority,
            creatorId: currentUser.uid,
            creatorName: currentUserName,
            status: 'pending',
            createdAt: new Date(),
            activity: [{
                text: selectedAssigneeIds.length === 1 ? 
                    `created this task and assigned it to ${assigneeNames[0]}` :
                    `created this task and assigned it to ${assigneeNames.join(', ')}`,
                authorName: currentUserName,
                timestamp: new Date()
            }]
        };
        
        console.log('[MULTI-ASSIGNEE] Creating task:', newTask);
        
        const docRef = await db.collection('tasks').add(newTask);
        console.log('[MULTI-ASSIGNEE] Task created with ID:', docRef.id);
        
        showNotification(`Task assigned to ${assigneeNames.join(', ')} successfully!`, 'success');
        closeAllModals();
        
        // Reset form
        document.getElementById('task-form').reset();
        
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

// Enhanced dropdown population
function populateTaskAssigneeDropdownEnhanced() {
    const dropdown = document.getElementById('task-assignee');
    if (!dropdown) {
        console.warn('[MULTI-ASSIGNEE] Task assignee dropdown not found');
        return;
    }
    
    console.log('[MULTI-ASSIGNEE] Populating dropdown with', allUsers.length, 'users');
    
    // Clear existing options
    dropdown.innerHTML = '';
    
    // Set dropdown to multiple selection
    dropdown.multiple = true;
    dropdown.size = Math.min(6, Math.max(3, allUsers.length));
    
    // Add placeholder (disabled, won't be selectable)
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Hold Ctrl/Cmd to select multiple people';
    placeholder.disabled = true;
    placeholder.style.fontStyle = 'italic';
    placeholder.style.color = '#999';
    dropdown.appendChild(placeholder);
    
    // Add user options
    allUsers.forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = user.name;
        option.style.padding = '8px 12px';
        dropdown.appendChild(option);
    });
    
    console.log('[MULTI-ASSIGNEE] Dropdown populated with', dropdown.options.length - 1, 'user options');
}

// Enhanced task details modal
function refreshTaskDetailsModalEnhanced(task) {
    // Call original function first for basic setup
    if (typeof refreshTaskDetailsModal === 'function') {
        try {
            refreshTaskDetailsModal(task);
        } catch (error) {
            console.warn('[MULTI-ASSIGNEE] Error calling original refresh function:', error);
        }
    }
    
    // Enhanced assignee display
    const assigneeElement = document.getElementById('task-details-assignee');
    if (assigneeElement) {
        const assigneeNames = getTaskAssigneeNames(task);
        
        if (assigneeNames.length > 1) {
            // Create a nice display for multiple assignees
            assigneeElement.innerHTML = '';
            
            assigneeNames.forEach((name, index) => {
                if (index > 0) {
                    assigneeElement.appendChild(document.createTextNode(', '));
                }
                
                const badge = document.createElement('span');
                badge.style.cssText = `
                    background: #f0f9ff;
                    color: #1e40af;
                    font-size: 12px;
                    font-weight: 500;
                    padding: 4px 8px;
                    border-radius: 12px;
                    border: 1px solid #bfdbfe;
                    margin: 2px;
                    display: inline-block;
                `;
                badge.textContent = name;
                assigneeElement.appendChild(badge);
            });
        } else if (assigneeNames.length === 1 && assigneeNames[0] !== 'Unassigned') {
            assigneeElement.textContent = assigneeNames[0];
        } else {
            assigneeElement.textContent = 'Not assigned';
        }
    }
    
    // Update permissions for multiple assignees
    const isAdmin = currentUserRole === 'admin';
    const isCreator = currentUser.uid === task.creatorId;
    const isAssignee = isUserAssignedToTaskEnhanced(task, currentUser.uid);
    
    // Assignee actions
    const assigneeActions = document.getElementById('task-assignee-actions');
    if (assigneeActions) {
        assigneeActions.style.display = isAssignee && task.status === 'approved' ? 'block' : 'none';
    }
}

// Helper functions
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

function isUserAssignedToTaskEnhanced(task, userId) {
    if (task.creatorId === userId) return true;
    const assigneeIds = getTaskAssigneeIds(task);
    return assigneeIds.includes(userId);
}

// Enhanced card creation for multiple assignees
function createTaskCardForAssignmentsEnhanced(task) {
    const card = document.createElement('div');
    card.className = 'kanban-card task-card';
    card.dataset.id = task.id;
    card.dataset.type = 'task';
    
    // Check if overdue
    const isOverdue = new Date(task.deadline) < new Date() && task.status !== 'completed';
    const isDueSoon = !isOverdue && new Date(task.deadline) < new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    
    if (isOverdue) card.classList.add('overdue');
    if (isDueSoon) card.classList.add('due-soon');
    
    // Format deadline
    const deadline = new Date(task.deadline);
    const deadlineText = deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    // Priority colors
    const priorityColors = {
        low: '#10b981',
        medium: '#f59e0b', 
        high: '#ef4444',
        urgent: '#dc2626'
    };
    
    const priorityColor = priorityColors[task.priority] || priorityColors.medium;
    
    // Handle multiple assignees display
    const assigneeNames = getTaskAssigneeNames(task);
    let displayNames, multipleIndicator = '';
    
    if (assigneeNames.length > 2) {
        displayNames = `${assigneeNames.slice(0, 2).join(', ')} +${assigneeNames.length - 2} more`;
        multipleIndicator = `<span style="background: rgba(59, 130, 246, 0.1); color: #2563eb; font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 8px; margin-left: 4px;">+${assigneeNames.length}</span>`;
    } else {
        displayNames = assigneeNames.join(', ');
        if (assigneeNames.length > 1) {
            multipleIndicator = `<span style="background: rgba(59, 130, 246, 0.1); color: #2563eb; font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 8px; margin-left: 4px;">+${assigneeNames.length}</span>`;
        }
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

// Enhanced filtering for my assignments
function filterProjectsEnhanced() {
    switch (currentView) {
        case 'interviews':
            return allProjects.filter(p => p.type === 'Interview');
        case 'opeds':
            return allProjects.filter(p => p.type === 'Op-Ed');
        case 'my-assignments':
            const myProjects = allProjects.filter(p => p.authorId === currentUser.uid || p.editorId === currentUser.uid);
            const myTasks = allTasks.filter(t => isUserAssignedToTaskEnhanced(t, currentUser.uid)).map(t => ({...t, isTask: true}));
            return [...myProjects, ...myTasks];
        default:
            return [];
    }
}

// Initialize the enhanced functionality
function initializeMultipleAssigneeEnhancements() {
    console.log('[MULTI-ASSIGNEE] Initializing enhanced multiple assignee functionality...');
    
    // Override existing functions
    window.populateTaskAssigneeDropdown = populateTaskAssigneeDropdownEnhanced;
    window.createTaskCardForAssignments = createTaskCardForAssignmentsEnhanced;
    window.filterProjects = filterProjectsEnhanced;
    
    // Setup enhanced task form submission
    const taskForm = document.getElementById('task-form');
    if (taskForm) {
        // Remove existing listeners
        taskForm.removeEventListener('submit', handleTaskFormSubmit);
        // Add enhanced listener
        taskForm.addEventListener('submit', handleTaskFormSubmitEnhanced);
        console.log('[MULTI-ASSIGNEE] Enhanced task form listener added');
    }
    
    // Setup enhanced task details refresh
    const originalOpenTaskDetailsModal = window.openTaskDetailsModal;
    window.openTaskDetailsModal = function(taskId) {
        const task = allTasks.find(t => t.id === taskId);
        if (!task) {
            console.error("[MODAL] Task not found:", taskId);
            return;
        }
        
        currentlyViewedTaskId = taskId;
        refreshTaskDetailsModalEnhanced(task);
        document.getElementById('task-details-modal').style.display = 'flex';
    };
    
    console.log('[MULTI-ASSIGNEE] Enhanced functionality initialized successfully!');
}

// Auto-initialize after a short delay to ensure all variables are loaded
setTimeout(() => {
    if (typeof allUsers !== 'undefined' && typeof currentUser !== 'undefined') {
        initializeMultipleAssigneeEnhancements();
    } else {
        console.warn('[MULTI-ASSIGNEE] Dependencies not ready, will retry...');
        setTimeout(initializeMultipleAssigneeEnhancements, 2000);
    }
}, 500);

// ===============================
// MULTIPLE TASK ASSIGNEES - SAFE ADDITIONS
// ===============================

// Store original functions
const originalPopulateTaskAssigneeDropdown = window.populateTaskAssigneeDropdown;
const originalHandleTaskFormSubmit = window.handleTaskFormSubmit;
const originalValidateTaskForm = window.validateTaskForm;

// Enhanced populate function
window.populateTaskAssigneeDropdown = function() {
    const dropdown = document.getElementById('task-assignee');
    if (!dropdown) return;
    
    dropdown.innerHTML = '<option value="" disabled>Select people to assign task to (hold Ctrl/Cmd for multiple)</option>';
    dropdown.multiple = true;
    dropdown.size = 6;
    
    allUsers.forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = user.name;
        dropdown.appendChild(option);
    });
};

// Enhanced validation
window.validateTaskForm = function() {
    const title = document.getElementById('task-title').value.trim();
    const assigneeSelect = document.getElementById('task-assignee');
    const selectedAssignees = assigneeSelect ? Array.from(assigneeSelect.selectedOptions) : [];
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
    } else {
        const deadlineDate = new Date(deadline);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (deadlineDate < today) {
            errors.push('Deadline cannot be in the past');
        }
    }
    
    return errors;
};

console.log('[MULTIPLE ASSIGNEES] Multiple assignee functionality loaded!');

// ===============================
// COMPLETE MULTIPLE ASSIGNEE FIX
// Add this to the END of dashboard.js
// ===============================

// Enhanced task form submission with multiple assignees
async function handleTaskFormSubmitEnhanced(e) {
    e.preventDefault();
    
    const submitButton = document.getElementById('save-task-button');
    const originalText = submitButton.textContent;
    
    try {
        // Show loading state
        submitButton.disabled = true;
        submitButton.classList.add('loading');
        submitButton.textContent = 'Creating Task...';
        
        // Get form values
        const title = document.getElementById('task-title').value.trim();
        const description = document.getElementById('task-description').value.trim();
        const deadline = document.getElementById('task-deadline').value;
        const priority = document.getElementById('task-priority').value || 'medium';
        
        // Get selected assignees
        const assigneeSelect = document.getElementById('task-assignee');
        const selectedOptions = assigneeSelect.selectedOptions;
        const selectedAssigneeIds = Array.from(selectedOptions).map(option => option.value).filter(id => id);
        
        // Validation
        if (!title || title.length < 3) {
            throw new Error('Task title must be at least 3 characters long');
        }
        
        if (selectedAssigneeIds.length === 0) {
            throw new Error('Please select at least one person to assign this task to');
        }
        
        if (!deadline) {
            throw new Error('Please set a deadline for this task');
        }
        
        const deadlineDate = new Date(deadline);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (deadlineDate < today) {
            throw new Error('Deadline cannot be in the past');
        }
        
        // Get assignee details
        const assignees = allUsers.filter(u => selectedAssigneeIds.includes(u.id));
        const assigneeNames = assignees.map(u => u.name);
        
        if (assignees.length !== selectedAssigneeIds.length) {
            throw new Error('Some selected users could not be found');
        }
        
        const newTask = {
            title: title,
            description: description || null,
            // Multiple assignees (new format)
            assigneeIds: selectedAssigneeIds,
            assigneeNames: assigneeNames,
            // Single assignee (backwards compatibility)
            assigneeId: selectedAssigneeIds[0],
            assigneeName: assigneeNames[0],
            deadline: deadline,
            priority: priority,
            creatorId: currentUser.uid,
            creatorName: currentUserName,
            status: 'pending',
            createdAt: new Date(),
            activity: [{
                text: selectedAssigneeIds.length === 1 ? 
                    `created this task and assigned it to ${assigneeNames[0]}` :
                    `created this task and assigned it to ${assigneeNames.join(', ')}`,
                authorName: currentUserName,
                timestamp: new Date()
            }]
        };
        
        console.log('[MULTI-ASSIGNEE] Creating task:', newTask);
        
        const docRef = await db.collection('tasks').add(newTask);
        console.log('[MULTI-ASSIGNEE] Task created with ID:', docRef.id);
        
        showNotification(`Task assigned to ${assigneeNames.join(', ')} successfully!`, 'success');
        closeAllModals();
        
        // Reset form
        document.getElementById('task-form').reset();
        
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

// Enhanced dropdown population
function populateTaskAssigneeDropdownEnhanced() {
    const dropdown = document.getElementById('task-assignee');
    if (!dropdown) {
        console.warn('[MULTI-ASSIGNEE] Task assignee dropdown not found');
        return;
    }
    
    console.log('[MULTI-ASSIGNEE] Populating dropdown with', allUsers.length, 'users');
    
    // Clear existing options
    dropdown.innerHTML = '';
    
    // Set dropdown to multiple selection
    dropdown.multiple = true;
    dropdown.size = Math.min(6, Math.max(3, allUsers.length));
    
    // Add placeholder (disabled, won't be selectable)
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Hold Ctrl/Cmd to select multiple people';
    placeholder.disabled = true;
    placeholder.style.fontStyle = 'italic';
    placeholder.style.color = '#999';
    dropdown.appendChild(placeholder);
    
    // Add user options
    allUsers.forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = user.name;
        option.style.padding = '8px 12px';
        dropdown.appendChild(option);
    });
    
    console.log('[MULTI-ASSIGNEE] Dropdown populated with', dropdown.options.length - 1, 'user options');
}

// Enhanced task details modal
function refreshTaskDetailsModalEnhanced(task) {
    // Call original function first for basic setup
    if (typeof refreshTaskDetailsModal === 'function') {
        try {
            refreshTaskDetailsModal(task);
        } catch (error) {
            console.warn('[MULTI-ASSIGNEE] Error calling original refresh function:', error);
        }
    }
    
    // Enhanced assignee display
    const assigneeElement = document.getElementById('task-details-assignee');
    if (assigneeElement) {
        const assigneeNames = getTaskAssigneeNames(task);
        
        if (assigneeNames.length > 1) {
            // Create a nice display for multiple assignees
            assigneeElement.innerHTML = '';
            
            assigneeNames.forEach((name, index) => {
                if (index > 0) {
                    assigneeElement.appendChild(document.createTextNode(', '));
                }
                
                const badge = document.createElement('span');
                badge.style.cssText = `
                    background: #f0f9ff;
                    color: #1e40af;
                    font-size: 12px;
                    font-weight: 500;
                    padding: 4px 8px;
                    border-radius: 12px;
                    border: 1px solid #bfdbfe;
                    margin: 2px;
                    display: inline-block;
                `;
                badge.textContent = name;
                assigneeElement.appendChild(badge);
            });
        } else if (assigneeNames.length === 1 && assigneeNames[0] !== 'Unassigned') {
            assigneeElement.textContent = assigneeNames[0];
        } else {
            assigneeElement.textContent = 'Not assigned';
        }
    }
    
    // Update permissions for multiple assignees
    const isAdmin = currentUserRole === 'admin';
    const isCreator = currentUser.uid === task.creatorId;
    const isAssignee = isUserAssignedToTaskEnhanced(task, currentUser.uid);
    
    // Assignee actions
    const assigneeActions = document.getElementById('task-assignee-actions');
    if (assigneeActions) {
        assigneeActions.style.display = isAssignee && task.status === 'approved' ? 'block' : 'none';
    }
}

// Helper functions
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

function isUserAssignedToTaskEnhanced(task, userId) {
    if (task.creatorId === userId) return true;
    const assigneeIds = getTaskAssigneeIds(task);
    return assigneeIds.includes(userId);
}

// Enhanced card creation for multiple assignees
function createTaskCardForAssignmentsEnhanced(task) {
    const card = document.createElement('div');
    card.className = 'kanban-card task-card';
    card.dataset.id = task.id;
    card.dataset.type = 'task';
    
    // Check if overdue
    const isOverdue = new Date(task.deadline) < new Date() && task.status !== 'completed';
    const isDueSoon = !isOverdue && new Date(task.deadline) < new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    
    if (isOverdue) card.classList.add('overdue');
    if (isDueSoon) card.classList.add('due-soon');
    
    // Format deadline
    const deadline = new Date(task.deadline);
    const deadlineText = deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    // Priority colors
    const priorityColors = {
        low: '#10b981',
        medium: '#f59e0b', 
        high: '#ef4444',
        urgent: '#dc2626'
    };
    
    const priorityColor = priorityColors[task.priority] || priorityColors.medium;
    
    // Handle multiple assignees display
    const assigneeNames = getTaskAssigneeNames(task);
    let displayNames, multipleIndicator = '';
    
    if (assigneeNames.length > 2) {
        displayNames = `${assigneeNames.slice(0, 2).join(', ')} +${assigneeNames.length - 2} more`;
        multipleIndicator = `<span style="background: rgba(59, 130, 246, 0.1); color: #2563eb; font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 8px; margin-left: 4px;">+${assigneeNames.length}</span>`;
    } else {
        displayNames = assigneeNames.join(', ');
        if (assigneeNames.length > 1) {
            multipleIndicator = `<span style="background: rgba(59, 130, 246, 0.1); color: #2563eb; font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 8px; margin-left: 4px;">+${assigneeNames.length}</span>`;
        }
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

// Enhanced filtering for my assignments
function filterProjectsEnhanced() {
    switch (currentView) {
        case 'interviews':
            return allProjects.filter(p => p.type === 'Interview');
        case 'opeds':
            return allProjects.filter(p => p.type === 'Op-Ed');
        case 'my-assignments':
            const myProjects = allProjects.filter(p => p.authorId === currentUser.uid || p.editorId === currentUser.uid);
            const myTasks = allTasks.filter(t => isUserAssignedToTaskEnhanced(t, currentUser.uid)).map(t => ({...t, isTask: true}));
            return [...myProjects, ...myTasks];
        default:
            return [];
    }
}

// Initialize the enhanced functionality
function initializeMultipleAssigneeEnhancements() {
    console.log('[MULTI-ASSIGNEE] Initializing enhanced multiple assignee functionality...');
    
    // Override existing functions
    window.populateTaskAssigneeDropdown = populateTaskAssigneeDropdownEnhanced;
    window.createTaskCardForAssignments = createTaskCardForAssignmentsEnhanced;
    window.filterProjects = filterProjectsEnhanced;
    
    // Setup enhanced task form submission
    const taskForm = document.getElementById('task-form');
    if (taskForm) {
        // Remove existing listeners
        taskForm.removeEventListener('submit', handleTaskFormSubmit);
        // Add enhanced listener
        taskForm.addEventListener('submit', handleTaskFormSubmitEnhanced);
        console.log('[MULTI-ASSIGNEE] Enhanced task form listener added');
    }
    
    // Setup enhanced task details refresh
    const originalOpenTaskDetailsModal = window.openTaskDetailsModal;
    window.openTaskDetailsModal = function(taskId) {
        const task = allTasks.find(t => t.id === taskId);
        if (!task) {
            console.error("[MODAL] Task not found:", taskId);
            return;
        }
        
        currentlyViewedTaskId = taskId;
        refreshTaskDetailsModalEnhanced(task);
        document.getElementById('task-details-modal').style.display = 'flex';
    };
    
    console.log('[MULTI-ASSIGNEE] Enhanced functionality initialized successfully!');
}

// Auto-initialize after a short delay to ensure all variables are loaded
setTimeout(() => {
    if (typeof allUsers !== 'undefined' && typeof currentUser !== 'undefined') {
        initializeMultipleAssigneeEnhancements();
    } else {
        console.warn('[MULTI-ASSIGNEE] Dependencies not ready, will retry...');
        setTimeout(initializeMultipleAssigneeEnhancements, 2000);
    }
}, 500);
