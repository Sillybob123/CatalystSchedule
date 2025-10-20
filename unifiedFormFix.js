// ===============================
// UNIFIED FORM FIX - FAST & NO RELOAD VERSION
// This replaces all other form fix scripts
// ===============================

console.log('[UNIFIED FIX] 🚀 Loading unified form submission fix...');

let formHandlerAttached = false;
let buttonHandlerAttached = false;

/**
 * Main initialization function
 */
function initializeUnifiedFix() {
    console.log('[UNIFIED FIX] Checking prerequisites...');
    
    // Check if Firebase is ready
    if (typeof firebase === 'undefined' || !firebase.firestore || !firebase.auth) {
        console.log('[UNIFIED FIX] Firebase not ready, retrying in 200ms...');
        setTimeout(initializeUnifiedFix, 200);
        return;
    }
    
    // Check if database is ready
    if (typeof db === 'undefined' || !db) {
        console.log('[UNIFIED FIX] Database not ready, retrying in 200ms...');
        setTimeout(initializeUnifiedFix, 200);
        return;
    }
    
    // Check if user is ready
    if (typeof currentUser === 'undefined' || !currentUser) {
        console.log('[UNIFIED FIX] User not ready, retrying in 200ms...');
        setTimeout(initializeUnifiedFix, 200);
        return;
    }
    
    console.log('[UNIFIED FIX] ✅ All prerequisites met');
    
    // Attach form handlers WITHOUT cloning (to prevent page reload)
    attachFormHandlersDirectly();
    
    // Attach button handler
    attachButtonHandlerDirectly();
    
    // Override modal opener
    overrideModalOpener();
    
    console.log('[UNIFIED FIX] ✅ All handlers installed');
}

/**
 * Attach the main form submit handler DIRECTLY without cloning
 */
function attachFormHandlersDirectly() {
    const form = document.getElementById('project-form');
    
    if (!form) {
        console.log('[UNIFIED FIX] Form not found, retrying in 500ms...');
        setTimeout(attachFormHandlersDirectly, 500);
        return;
    }
    
    if (formHandlerAttached) {
        console.log('[UNIFIED FIX] Form handler already attached, skipping');
        return;
    }
    
    console.log('[UNIFIED FIX] Attaching form handler directly...');
    
    // Add handler with capture phase to intercept early
    form.addEventListener('submit', handleProjectSubmit, true);
    
    formHandlerAttached = true;
    console.log('[UNIFIED FIX] ✅ Form handler attached');
}

/**
 * Main project submission handler - PREVENTS PAGE RELOAD
 */
async function handleProjectSubmit(e) {
    // CRITICAL: Prevent form submission and page reload
    if (e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
    }
    
    console.log('[UNIFIED FIX] 🎯 Form submission triggered - NO RELOAD');
    
    const submitButton = document.getElementById('save-project-button');
    
    if (!submitButton) {
        console.error('[UNIFIED FIX] Submit button not found');
        showNotificationSafe('Error: Submit button not found. Please refresh the page.', 'error');
        return false;
    }
    
    // Prevent duplicate submissions
    if (submitButton.disabled || submitButton.dataset.submitting === 'true') {
        console.warn('[UNIFIED FIX] Duplicate submission prevented');
        return false;
    }
    
    const originalText = submitButton.innerHTML;
    
    try {
        // Get form values
        const title = document.getElementById('project-title')?.value?.trim();
        const type = document.getElementById('project-type')?.value;
        const proposal = document.getElementById('project-proposal')?.value?.trim();
        const deadline = document.getElementById('project-deadline')?.value;
        
        console.log('[UNIFIED FIX] Form values:', {
            title: title,
            type: type,
            proposalLength: proposal?.length || 0,
            deadline: deadline
        });
        
        // Validate inputs
        if (!title || title.length < 3) {
            showNotificationSafe('Please enter a title with at least 3 characters.', 'error');
            document.getElementById('project-title')?.focus();
            return false;
        }
        
        if (!type) {
            showNotificationSafe('Please select a project type.', 'error');
            document.getElementById('project-type')?.focus();
            return false;
        }
        
        if (!deadline) {
            showNotificationSafe('Please set a publication deadline.', 'error');
            document.getElementById('project-deadline')?.focus();
            return false;
        }
        
        // Check authentication
        if (!currentUser || !currentUser.uid) {
            console.error('[UNIFIED FIX] User not authenticated');
            showNotificationSafe('You must be logged in to create a project. Please refresh and log in again.', 'error');
            return false;
        }
        
        // Check database connection
        if (!db) {
            console.error('[UNIFIED FIX] Database not available');
            showNotificationSafe('Database connection lost. Please refresh the page.', 'error');
            return false;
        }
        
        // Set loading state
        submitButton.disabled = true;
        submitButton.dataset.submitting = 'true';
        submitButton.innerHTML = '<span style="display: inline-flex; align-items: center; gap: 8px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;"><circle cx="12" cy="12" r="10"></circle><path d="M12 2 A10 10 0 0 1 22 12"></path></svg>Saving...</span>';
        
        console.log('[UNIFIED FIX] Creating project data...');
        
        // Get user information
        const authorId = currentUser.uid;
        const authorName = currentUserName || 
                          currentUser.displayName || 
                          (currentUser.email ? currentUser.email.split('@')[0] : 'Unknown User');
        
        // Create timeline based on project type
        const timeline = {};
        const tasks = type === 'Interview'
            ? [
                "Topic Proposal Complete",
                "Interview Scheduled",
                "Interview Complete",
                "Article Writing Complete",
                "Review In Progress",
                "Review Complete",
                "Suggestions Reviewed"
              ]
            : [
                "Topic Proposal Complete",
                "Article Writing Complete",
                "Review In Progress",
                "Review Complete",
                "Suggestions Reviewed"
              ];
        
        tasks.forEach(task => {
            timeline[task] = false;
        });
        
        // Create project data object
        const projectData = {
            title: title,
            type: type,
            proposal: proposal || 'No proposal provided.',
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
        
        console.log('[UNIFIED FIX] Submitting to Firestore...');
        
        // Submit to Firestore
        const docRef = await db.collection('projects').add(projectData);
        
        console.log('[UNIFIED FIX] ✅✅✅ SUCCESS! Project created with ID:', docRef.id);
        
        // Update local state immediately
        if (typeof window.allProjects !== 'undefined' && Array.isArray(window.allProjects)) {
            const nowSeconds = Math.floor(Date.now() / 1000);
            const localProject = {
                id: docRef.id,
                ...projectData,
                createdAt: { seconds: nowSeconds },
                updatedAt: { seconds: nowSeconds }
            };
            
            window.allProjects = [localProject, ...window.allProjects.filter(p => p.id !== docRef.id)];
            console.log('[UNIFIED FIX] Local state updated');
            
            // Refresh view immediately
            if (typeof window.renderCurrentViewEnhanced === 'function') {
                window.renderCurrentViewEnhanced();
            }
        }
        
        // Show success message
        showNotificationSafe('✅ Project proposal submitted successfully!', 'success');
        
        // Reset form
        const form = document.getElementById('project-form');
        if (form) {
            form.reset();
        }
        
        // Close modal quickly
        setTimeout(() => {
            const modal = document.getElementById('project-modal');
            if (modal) {
                modal.style.display = 'none';
            }
            
            document.body.style.overflow = '';
            
            const appContainer = document.getElementById('app-container');
            if (appContainer) {
                appContainer.style.filter = '';
            }
            
            console.log('[UNIFIED FIX] Modal closed');
        }, 500);
        
    } catch (error) {
        console.error('[UNIFIED FIX] ❌ Submission error:', error);
        console.error('[UNIFIED FIX] Error code:', error.code);
        console.error('[UNIFIED FIX] Error message:', error.message);
        
        let errorMessage = 'Failed to save project. ';
        
        if (error.code === 'permission-denied') {
            errorMessage += 'Permission denied. Please check that you are logged in with proper permissions.';
        } else if (error.code === 'unavailable') {
            errorMessage += 'Service temporarily unavailable. Please check your internet connection and try again.';
        } else if (error.code === 'unauthenticated') {
            errorMessage += 'You are not authenticated. Please log out and log back in.';
        } else {
            errorMessage += error.message || 'Unknown error occurred.';
        }
        
        showNotificationSafe(errorMessage, 'error');
        
    } finally {
        // Reset button state
        submitButton.disabled = false;
        submitButton.innerHTML = originalText;
        delete submitButton.dataset.submitting;
    }
    
    return false; // Prevent any default behavior
}

/**
 * Attach click handler to submit button DIRECTLY without cloning
 */
function attachButtonHandlerDirectly() {
    const button = document.getElementById('save-project-button');
    
    if (!button) {
        console.log('[UNIFIED FIX] Button not found, retrying in 500ms...');
        setTimeout(attachButtonHandlerDirectly, 500);
        return;
    }
    
    if (buttonHandlerAttached) {
        console.log('[UNIFIED FIX] Button handler already attached, skipping');
        return;
    }
    
    console.log('[UNIFIED FIX] Attaching button handler directly...');
    
    // Add handler that prevents default and calls our submission handler
    button.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        console.log('[UNIFIED FIX] 🔘 Button clicked - calling submit handler');
        
        // Call our handler directly instead of triggering form submit
        handleProjectSubmit(e);
    }, true);
    
    buttonHandlerAttached = true;
    console.log('[UNIFIED FIX] ✅ Button handler attached');
}

/**
 * Override the openProjectModal function
 */
function overrideModalOpener() {
    console.log('[UNIFIED FIX] Overriding modal opener function...');
    
    window.openProjectModal = function() {
        console.log('[UNIFIED FIX] Opening project modal...');
        
        // Reset form
        const form = document.getElementById('project-form');
        if (form) {
            form.reset();
        }
        
        // Set modal title
        const modalTitle = document.getElementById('modal-title');
        if (modalTitle) {
            modalTitle.textContent = 'Propose New Article';
        }
        
        // Set default type based on current view
        const projectTypeSelect = document.getElementById('project-type');
        if (projectTypeSelect && typeof currentView !== 'undefined') {
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
            document.body.style.overflow = 'hidden';
            
            const appContainer = document.getElementById('app-container');
            if (appContainer) {
                appContainer.style.filter = 'blur(4px)';
                appContainer.style.transition = 'filter 0.3s ease';
            }
            
            // Focus on title field
            setTimeout(() => {
                const titleInput = document.getElementById('project-title');
                if (titleInput) {
                    titleInput.focus();
                }
            }, 100);
            
            console.log('[UNIFIED FIX] ✅ Modal opened');
        }
    };
    
    console.log('[UNIFIED FIX] ✅ Modal opener overridden');
}

/**
 * Safe notification function with fallback to alert
 */
function showNotificationSafe(message, type = 'info') {
    if (typeof showNotification === 'function') {
        showNotification(message, type);
    } else {
        // Fallback to console + alert
        console.log(`[NOTIFICATION] ${type.toUpperCase()}: ${message}`);
        const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
        alert(icon + ' ' + message);
    }
}

// Add CSS for spinning animation
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('[UNIFIED FIX] DOM loaded, starting initialization in 1.5 seconds...');
        setTimeout(initializeUnifiedFix, 1500);
    });
} else {
    console.log('[UNIFIED FIX] DOM already loaded, starting initialization in 1.5 seconds...');
    setTimeout(initializeUnifiedFix, 1500);
}

console.log('[UNIFIED FIX] Script loaded successfully');
