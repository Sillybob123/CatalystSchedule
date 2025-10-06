// ===============================
// Dashboard Helper Functions
// These functions support the main dashboard functionality
// ===============================

/**
 * Handle saving edited proposal text
 */
async function handleSaveProposal() {
    if (!currentlyViewedProjectId) return;
    
    const proposalElement = document.getElementById('details-proposal');
    if (!proposalElement) return;
    
    const newProposal = proposalElement.textContent.trim();
    
    if (!newProposal) {
        showNotification('Proposal cannot be empty.', 'error');
        return;
    }
    
    try {
        await db.collection('projects').doc(currentlyViewedProjectId).update({
            proposal: newProposal,
            activity: firebase.firestore.FieldValue.arrayUnion({
                text: 'updated the proposal',
                authorName: currentUserName,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            })
        });
        
        showNotification('Proposal updated successfully!', 'success');
        disableProposalEditing();
        
    } catch (error) {
        console.error('[ERROR] Failed to save proposal:', error);
        showNotification('Failed to save proposal. Please try again.', 'error');
    }
}

/**
 * Handle setting deadlines for a project
 */
async function handleSetDeadlines() {
    if (!currentlyViewedProjectId) return;
    
    const deadlines = {};
    const fields = ['contact', 'interview', 'draft', 'review', 'edits'];
    
    fields.forEach(field => {
        const input = document.getElementById(`deadline-${field}`);
        if (input && input.value) {
            deadlines[field] = input.value;
        }
    });
    
    try {
        await db.collection('projects').doc(currentlyViewedProjectId).update({
            deadlines: deadlines,
            activity: firebase.firestore.FieldValue.arrayUnion({
                text: 'updated project deadlines',
                authorName: currentUserName,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            })
        });
        
        showNotification('Deadlines updated successfully!', 'success');
        
    } catch (error) {
        console.error('[ERROR] Failed to set deadlines:', error);
        showNotification('Failed to update deadlines. Please try again.', 'error');
    }
}

/**
 * Handle requesting deadline changes
 */
async function handleRequestDeadlineChange() {
    if (!currentlyViewedProjectId) return;
    
    const reason = prompt('Please provide a reason for the deadline change request:');
    if (!reason || !reason.trim()) {
        showNotification('Please provide a reason for the deadline change.', 'error');
        return;
    }
    
    const requestedDeadlines = {};
    const fields = ['contact', 'interview', 'draft', 'review', 'edits'];
    
    fields.forEach(field => {
        const input = document.getElementById(`deadline-${field}`);
        if (input && input.value) {
            requestedDeadlines[field] = input.value;
        }
    });
    
    try {
        await db.collection('projects').doc(currentlyViewedProjectId).update({
            deadlineChangeRequest: {
                requestedBy: currentUserName,
                requestedDeadlines: requestedDeadlines,
                reason: reason.trim(),
                status: 'pending',
                requestedAt: firebase.firestore.FieldValue.serverTimestamp()
            },
            activity: firebase.firestore.FieldValue.arrayUnion({
                text: `requested deadline changes. Reason: ${reason.trim()}`,
                authorName: currentUserName,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            })
        });
        
        showNotification('Deadline change request submitted successfully!', 'success');
        
    } catch (error) {
        console.error('[ERROR] Failed to request deadline change:', error);
        showNotification('Failed to submit deadline change request. Please try again.', 'error');
    }
}

/**
 * Handle approving deadline request
 */
async function handleApproveDeadlineRequest() {
    if (!currentlyViewedProjectId) return;
    
    const project = allProjects.find(p => p.id === currentlyViewedProjectId);
    if (!project) return;
    
    try {
        const updates = {
            activity: firebase.firestore.FieldValue.arrayUnion({
                text: 'approved deadline change request',
                authorName: currentUserName,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            })
        };
        
        if (project.deadlineRequest) {
            updates.deadline = project.deadlineRequest.requestedDate;
            updates['deadlines.publication'] = project.deadlineRequest.requestedDate;
            updates.deadlineRequest = firebase.firestore.FieldValue.delete();
        } else if (project.deadlineChangeRequest) {
            updates.deadlines = project.deadlineChangeRequest.requestedDeadlines;
            updates.deadlineChangeRequest = firebase.firestore.FieldValue.delete();
        }
        
        await db.collection('projects').doc(currentlyViewedProjectId).update(updates);
        
        showNotification('Deadline request approved!', 'success');
        
    } catch (error) {
        console.error('[ERROR] Failed to approve deadline request:', error);
        showNotification('Failed to approve deadline request. Please try again.', 'error');
    }
}

/**
 * Handle rejecting deadline request
 */
async function handleRejectDeadlineRequest() {
    if (!currentlyViewedProjectId) return;
    
    const project = allProjects.find(p => p.id === currentlyViewedProjectId);
    if (!project) return;
    
    try {
        const updates = {
            activity: firebase.firestore.FieldValue.arrayUnion({
                text: 'rejected deadline change request',
                authorName: currentUserName,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
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
        console.error('[ERROR] Failed to reject deadline request:', error);
        showNotification('Failed to reject deadline request. Please try again.', 'error');
    }
}

/**
 * Generate comprehensive status report
 */
function generateStatusReport() {
    console.log('[REPORT] Generating status report...');
    
    const reportModal = document.getElementById('report-modal');
    const reportContent = document.getElementById('report-content');
    
    if (!reportModal || !reportContent) {
        console.error('[REPORT] Modal elements not found');
        return;
    }
    
    let html = '<div class="report-section">';
    html += '<h3>Overall Project Status</h3>';
    
    const totalProjects = allProjects.length;
    const completedProjects = allProjects.filter(p => {
        const state = getProjectState(p, currentView, currentUser);
        return state.column === 'Completed';
    }).length;
    const inProgressProjects = allProjects.filter(p => {
        const state = getProjectState(p, currentView, currentUser);
        return state.column === 'In Progress';
    }).length;
    const pendingProjects = allProjects.filter(p => p.proposalStatus === 'pending').length;
    
    html += `<p><strong>Total Projects:</strong> ${totalProjects}</p>`;
    html += `<p><strong>Completed:</strong> ${completedProjects}</p>`;
    html += `<p><strong>In Progress:</strong> ${inProgressProjects}</p>`;
    html += `<p><strong>Pending Approval:</strong> ${pendingProjects}</p>`;
    html += '</div>';
    
    html += '<div class="report-section">';
    html += '<h3>Task Overview</h3>';
    const totalTasks = allTasks.length;
    const completedTasks = allTasks.filter(t => t.status === 'completed').length;
    const pendingTasks = allTasks.filter(t => t.status === 'pending').length;
    const approvedTasks = allTasks.filter(t => t.status === 'approved').length;
    
    html += `<p><strong>Total Tasks:</strong> ${totalTasks}</p>`;
    html += `<p><strong>Completed:</strong> ${completedTasks}</p>`;
    html += `<p><strong>Approved:</strong> ${approvedTasks}</p>`;
    html += `<p><strong>Pending:</strong> ${pendingTasks}</p>`;
    html += '</div>';
    
    html += '<div class="report-section">';
    html += '<h3>Team Workload</h3>';
    
    const userWorkload = {};
    allUsers.forEach(user => {
        userWorkload[user.id] = {
            name: user.name,
            projects: 0,
            tasks: 0
        };
    });
    
    allProjects.forEach(project => {
        if (project.authorId && userWorkload[project.authorId]) {
            userWorkload[project.authorId].projects++;
        }
        if (project.editorId && userWorkload[project.editorId]) {
            userWorkload[project.editorId].projects++;
        }
    });
    
    allTasks.forEach(task => {
        if (task.assigneeIds && Array.isArray(task.assigneeIds)) {
            task.assigneeIds.forEach(assigneeId => {
                if (userWorkload[assigneeId]) {
                    userWorkload[assigneeId].tasks++;
                }
            });
        } else if (task.assigneeId && userWorkload[task.assigneeId]) {
            userWorkload[task.assigneeId].tasks++;
        }
    });
    
    Object.values(userWorkload).forEach(user => {
        html += `<p><strong>${user.name}:</strong> ${user.projects} projects, ${user.tasks} tasks</p>`;
    });
    
    html += '</div>';
    
    reportContent.innerHTML = html;
    reportModal.style.display = 'flex';
}

console.log('[HELPERS] Dashboard helper functions loaded');
