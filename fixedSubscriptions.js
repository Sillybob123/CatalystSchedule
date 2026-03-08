// ===============================
// FIXED SUBSCRIPTIONS - Bulletproof version
// ===============================

/**
 * This file contains bulletproof subscription handlers that:
 * 1. Handle null timestamps gracefully
 * 2. Ensure items always render in correct columns
 * 3. Never lose data during re-renders
 */

// Store the original subscriptions to prevent overwriting
let originalSubscribeToProjects = null;
let originalSubscribeToTasks = null;

/**
 * Setup bulletproof subscriptions
 */
function setupBulletproofSubscriptions() {
    console.log('[BULLETPROOF] Setting up fixed subscriptions...');
    
    // Projects subscription with robust error handling
    db.collection('projects').onSnapshot(snapshot => {
        console.log('[BULLETPROOF PROJECTS] ===== SNAPSHOT RECEIVED =====');
        console.log('[BULLETPROOF PROJECTS] Document count:', snapshot.docs.length);
        console.log('[BULLETPROOF PROJECTS] Changes:', snapshot.docChanges().map(c => `${c.type}: ${c.doc.id}`));
        
        if (typeof debugLog === 'function') {
            debugLog(`📦 Projects update: ${snapshot.docs.length} documents`, 'info');
        }
        
        try {
            allProjects = snapshot.docs.map(doc => {
                const data = doc.data();
                const normalized = bulletproofNormalize(data);
                
                console.log('[BULLETPROOF] Processing project:', normalized.title, 'Status:', normalized.proposalStatus);
                
                return { id: doc.id, ...normalized };
            });
            
            console.log('[BULLETPROOF] All projects loaded:', allProjects.length);
            console.log('[BULLETPROOF] Current view:', currentView);
            
            if (typeof debugLog === 'function') {
                debugLog(`✅ ${allProjects.length} projects loaded successfully`, 'success');
            }
            
            // Force re-render
            if (currentView !== 'tasks') {
                console.log('[BULLETPROOF] Triggering render for view:', currentView);
                renderCurrentViewEnhanced();
                if (typeof debugLog === 'function') {
                    debugLog('🎨 UI updated with new project data', 'info');
                }
            }
            updateNavCounts();
            
            if (typeof handlePendingEditorAlerts === 'function') {
                handlePendingEditorAlerts();
            }
            
            // Update modal if open - but DON'T re-render timeline to avoid disrupting checkbox updates
            if (currentlyViewedProjectId) {
                const project = allProjects.find(p => p.id === currentlyViewedProjectId);
                if (project) {
                    // Update activity feed
                    console.log('[BULLETPROOF] Updating project modal (activity, status, editor)');
                    if (typeof renderActivityFeed === 'function') {
                        renderActivityFeed(project.activity || []);
                    }
                    // Update status
                    const statusEl = document.getElementById('details-status');
                    if (statusEl && typeof resolveProjectState === 'function') {
                        const state = resolveProjectState(project, currentView, currentUser);
                        statusEl.textContent = state.statusText;
                    } else if (statusEl && typeof getProjectState === 'function') {
                        const state = getProjectState(project, currentView, currentUser);
                        statusEl.textContent = state.statusText;
                    }
                    // Update editor name display
                    const editorEl = document.getElementById('details-editor');
                    if (editorEl) {
                        editorEl.textContent = project.editorName || 'Not Assigned';
                    }
                    // Update assign/reassign button text
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
                    // Update editor dropdown selection
                    if (typeof populateEditorDropdown === 'function') {
                        populateEditorDropdown(project.editorId);
                    }
                    // Update inactivity banner
                    if (typeof updateInactivityBanner === 'function') {
                        updateInactivityBanner(project);
                    }
                } else {
                    console.log('[BULLETPROOF] Project no longer exists, closing modal');
                    if (typeof closeAllModals === 'function') {
                        closeAllModals();
                    }
                }
            }
            
            console.log('[BULLETPROOF PROJECTS] ===== PROCESSING COMPLETE =====');
        } catch (error) {
            console.error('[BULLETPROOF ERROR] Projects processing failed:', error);
            if (typeof debugLog === 'function') {
                debugLog(`❌ Error processing projects: ${error.message}`, 'error');
            }
        }
    }, error => {
        console.error('[BULLETPROOF ERROR] Projects subscription failed:', error);
        if (typeof debugLog === 'function') {
            debugLog(`❌ Projects subscription error: ${error.message}`, 'error');
        }
    });
    
    // Tasks subscription with robust error handling  
    db.collection('tasks').onSnapshot(snapshot => {
        console.log('[BULLETPROOF TASKS] ===== SNAPSHOT RECEIVED =====');
        console.log('[BULLETPROOF TASKS] Document count:', snapshot.docs.length);
        console.log('[BULLETPROOF TASKS] Changes:', snapshot.docChanges().map(c => `${c.type}: ${c.doc.id}`));
        
        if (typeof debugLog === 'function') {
            debugLog(`📝 Tasks update: ${snapshot.docs.length} documents`, 'info');
        }
        
        try {
            allTasks = snapshot.docs.map(doc => {
                const data = doc.data();
                const normalized = bulletproofNormalize(data);
                
                console.log('[BULLETPROOF] Processing task:', normalized.title, 'Status:', normalized.status);
                
                return { id: doc.id, ...normalized };
            });
            
            console.log('[BULLETPROOF] All tasks loaded:', allTasks.length);
            console.log('[BULLETPROOF] Current view:', currentView);
            
            if (typeof debugLog === 'function') {
                debugLog(`✅ ${allTasks.length} tasks loaded successfully`, 'success');
            }
            
            // Force re-render
            if (currentView === 'tasks') {
                console.log('[BULLETPROOF] Triggering tasks board render');
                renderTasksBoard(allTasks);
                if (typeof debugLog === 'function') {
                    debugLog('🎨 Tasks board updated with new data', 'info');
                }
            } else {
                // Keep availability panel and calendar in sync with task assignments
                renderCurrentViewEnhanced();
            }
            updateNavCounts();
            
            // Update modal if open
            if (currentlyViewedTaskId) {
                const task = allTasks.find(t => t.id === currentlyViewedTaskId);
                if (task && typeof refreshTaskDetailsModal === 'function') {
                    console.log('[BULLETPROOF] Refreshing open task modal');
                    refreshTaskDetailsModal(task);
                } else if (!task) {
                    console.log('[BULLETPROOF] Task no longer exists, closing modal');
                    closeAllModals();
                }
            }
            
            console.log('[BULLETPROOF TASKS] ===== PROCESSING COMPLETE =====');
        } catch (error) {
            console.error('[BULLETPROOF ERROR] Tasks processing failed:', error);
            if (typeof debugLog === 'function') {
                debugLog(`❌ Error processing tasks: ${error.message}`, 'error');
            }
        }
    }, error => {
        console.error('[BULLETPROOF ERROR] Tasks subscription failed:', error);
        if (typeof debugLog === 'function') {
            debugLog(`❌ Tasks subscription error: ${error.message}`, 'error');
        }
    });
}

/**
 * Bulletproof document normalization
 * Handles ALL edge cases with null timestamps
 */
function bulletproofNormalize(doc) {
    if (!doc) return doc;
    
    const normalized = { ...doc };
    const now = Date.now();
    const nowSeconds = Math.floor(now / 1000);
    
    // Fix createdAt
    if (normalized.createdAt === null || normalized.createdAt === undefined) {
        console.log('[BULLETPROOF] Fixing null createdAt');
        normalized.createdAt = { seconds: nowSeconds };
    }
    
    // Fix updatedAt
    if (normalized.updatedAt === null) {
        normalized.updatedAt = { seconds: nowSeconds };
    }
    
    // Fix completedAt
    if (normalized.completedAt === null) {
        normalized.completedAt = { seconds: nowSeconds };
    }
    
    // Fix activity array timestamps
    if (normalized.activity && Array.isArray(normalized.activity)) {
        normalized.activity = normalized.activity.map(item => {
            if (!item.timestamp || item.timestamp === null) {
                console.log('[BULLETPROOF] Fixing null activity timestamp');
                return {
                    ...item,
                    timestamp: { seconds: nowSeconds }
                };
            }
            return item;
        });
    }
    
    // Ensure proposalStatus exists for projects
    if (normalized.timeline && !normalized.proposalStatus) {
        normalized.proposalStatus = 'pending';
    }
    
    // Ensure status exists for tasks
    if (normalized.deadline && !normalized.status) {
        normalized.status = 'pending';
    }
    
    return normalized;
}

// Flag to ensure we only setup once
let subscriptionsSetup = false;

/**
 * Public function to manually trigger subscription setup
 * Call this from dashboard.js after auth completes
 */
window.initializeSubscriptions = function() {
    if (subscriptionsSetup) {
        console.log('[BULLETPROOF] Subscriptions already setup, skipping');
        return;
    }
    
    if (typeof db === 'undefined' || !db) {
        console.error('[BULLETPROOF] Firebase not ready');
        return;
    }
    
    if (typeof allProjects === 'undefined' || typeof allTasks === 'undefined') {
        console.error('[BULLETPROOF] Global variables not ready');
        return;
    }
    
    subscriptionsSetup = true;
    setupBulletproofSubscriptions();
};
