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
        console.log('[BULLETPROOF PROJECTS] Snapshot received:', snapshot.docs.length, 'projects');
        
        try {
            allProjects = snapshot.docs.map(doc => {
                const data = doc.data();
                const normalized = bulletproofNormalize(data);
                
                console.log('[BULLETPROOF] Processing project:', normalized.title, 'Status:', normalized.proposalStatus);
                
                return { id: doc.id, ...normalized };
            });
            
            console.log('[BULLETPROOF] All projects loaded:', allProjects.length);
            
            // Force re-render
            if (currentView !== 'tasks') {
                renderCurrentViewEnhanced();
            }
            updateNavCounts();
            
            // Update modal if open
            if (currentlyViewedProjectId) {
                const project = allProjects.find(p => p.id === currentlyViewedProjectId);
                if (project && typeof refreshDetailsModal === 'function') {
                    refreshDetailsModal(project);
                } else if (!project) {
                    closeAllModals();
                }
            }
        } catch (error) {
            console.error('[BULLETPROOF ERROR] Projects processing failed:', error);
        }
    }, error => {
        console.error('[BULLETPROOF ERROR] Projects subscription failed:', error);
    });
    
    // Tasks subscription with robust error handling  
    db.collection('tasks').onSnapshot(snapshot => {
        console.log('[BULLETPROOF TASKS] Snapshot received:', snapshot.docs.length, 'tasks');
        
        try {
            allTasks = snapshot.docs.map(doc => {
                const data = doc.data();
                const normalized = bulletproofNormalize(data);
                
                console.log('[BULLETPROOF] Processing task:', normalized.title, 'Status:', normalized.status);
                
                return { id: doc.id, ...normalized };
            });
            
            console.log('[BULLETPROOF] All tasks loaded:', allTasks.length);
            
            // Force re-render
            if (currentView === 'tasks') {
                renderTasksBoard(allTasks);
            }
            updateNavCounts();
            
            // Update modal if open
            if (currentlyViewedTaskId) {
                const task = allTasks.find(t => t.id === currentlyViewedTaskId);
                if (task && typeof refreshTaskDetailsModal === 'function') {
                    refreshTaskDetailsModal(task);
                } else if (!task) {
                    closeAllModals();
                }
            }
        } catch (error) {
            console.error('[BULLETPROOF ERROR] Tasks processing failed:', error);
        }
    }, error => {
        console.error('[BULLETPROOF ERROR] Tasks subscription failed:', error);
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

// Auto-initialize when this script loads
if (typeof db !== 'undefined' && db) {
    console.log('[BULLETPROOF] Auto-initializing...');
    // Wait a moment for the main script to set up
    setTimeout(() => {
        if (typeof allProjects !== 'undefined' && typeof allTasks !== 'undefined') {
            setupBulletproofSubscriptions();
        } else {
            console.error('[BULLETPROOF] Cannot initialize - main variables not ready');
        }
    }, 1000);
}
