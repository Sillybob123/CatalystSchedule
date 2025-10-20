// ===============================
// FIREBASE & FORM SUBMISSION FIX
// Ensures Firebase is properly initialized and forms work correctly
// ===============================

console.log('[FIREBASE FIX] Loading critical fixes for GitHub deployment...');

// Wait for Firebase to be fully loaded
function waitForFirebase(callback, attempts = 0) {
    if (typeof firebase !== 'undefined' && firebase.firestore && firebase.auth) {
        console.log('[FIREBASE FIX] ✅ Firebase is ready');
        callback();
    } else if (attempts < 50) { // Try for 5 seconds
        console.log('[FIREBASE FIX] Waiting for Firebase... attempt', attempts + 1);
        setTimeout(() => waitForFirebase(callback, attempts + 1), 100);
    } else {
        console.error('[FIREBASE FIX] ❌ Firebase failed to load after 5 seconds');
        alert('Failed to load Firebase. Please check your internet connection and refresh the page.');
    }
}

// Enhanced form submission handler
function fixProjectFormSubmission() {
    console.log('[FIREBASE FIX] Setting up enhanced form submission handler...');
    
    const form = document.getElementById('project-form');
    const submitButton = document.getElementById('save-project-button');
    
    if (!form || !submitButton) {
        console.error('[FIREBASE FIX] Form or submit button not found');
        setTimeout(fixProjectFormSubmission, 500);
        return;
    }

    const handler = typeof window.handleProjectFormSubmit === 'function'
        ? window.handleProjectFormSubmit
        : fallbackProjectFormSubmit;

    if (!form.dataset.firebaseFixSubmitAttached) {
        form.addEventListener('submit', handler);
        form.dataset.firebaseFixSubmitAttached = 'true';
        console.log('[FIREBASE FIX] Project form submit listener attached');
    } else {
        console.log('[FIREBASE FIX] Project form submit listener already attached');
    }

    if (!submitButton.dataset.firebaseFixClickAttached) {
        submitButton.addEventListener('click', handler);
        submitButton.dataset.firebaseFixClickAttached = 'true';
        console.log('[FIREBASE FIX] Save button click listener attached');
    } else {
        console.log('[FIREBASE FIX] Save button click listener already attached');
    }
    
    const handlerLabel = handler === fallbackProjectFormSubmit ? 'fallback' : 'dashboard';
    console.log(`[FIREBASE FIX] ✅ Form submission handler installed (${handlerLabel})`);
}

async function fallbackProjectFormSubmit(e) {
    if (e) {
        if (typeof e.preventDefault === 'function') e.preventDefault();
        if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }

    console.log('[FIREBASE FIX] Using fallback submission handler');

    const submitBtn = document.getElementById('save-project-button');
    if (!submitBtn) {
        alert('Error: Submit button not found');
        return;
    }

    if (submitBtn.dataset.submitting === 'true' || submitBtn.disabled) {
        console.warn('[FIREBASE FIX] Duplicate submission prevented by fallback handler');
        return;
    }

    const titleInput = document.getElementById('project-title');
    const typeInput = document.getElementById('project-type');
    const proposalInput = document.getElementById('project-proposal');
    const deadlineInput = document.getElementById('project-deadline');

    const title = titleInput ? titleInput.value.trim() : '';
    const type = typeInput ? typeInput.value : '';
    const proposal = proposalInput ? proposalInput.value.trim() : '';
    const deadline = deadlineInput ? deadlineInput.value : '';

    const notifyError = (message) => {
        if (typeof showNotification === 'function') {
            showNotification(message, 'error');
        } else {
            alert(message);
        }
    };

    if (!title || title.length < 3) {
        notifyError('Please enter a title with at least 3 characters.');
        if (titleInput) titleInput.focus();
        return;
    }

    if (!type) {
        notifyError('Please select a project type.');
        if (typeInput) typeInput.focus();
        return;
    }

    if (!deadline) {
        notifyError('Please set a publication deadline.');
        if (deadlineInput) deadlineInput.focus();
        return;
    }

    if (!window.currentUser || !window.currentUser.uid) {
        console.error('[FIREBASE FIX] No authenticated user (fallback)');
        notifyError('You must be logged in to create a project.');
        return;
    }

    if (!window.db) {
        console.error('[FIREBASE FIX] Database not available (fallback)');
        notifyError('Database connection lost. Please refresh the page.');
        return;
    }

    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.dataset.submitting = 'true';
    submitBtn.textContent = 'Saving...';

    try {
        console.log('[FIREBASE FIX] Preparing project data (fallback)...');

        const authorId = window.currentUser.uid;
        const authorName = window.currentUserName || window.currentUser.displayName ||
            (window.currentUser.email ? window.currentUser.email.split('@')[0] : 'Unknown User');

        const timeline = {};
        const tasks = type === 'Interview'
            ? ["Topic Proposal Complete", "Interview Scheduled", "Interview Complete",
               "Article Writing Complete", "Review In Progress", "Review Complete", "Suggestions Reviewed"]
            : ["Topic Proposal Complete", "Article Writing Complete",
               "Review In Progress", "Review Complete", "Suggestions Reviewed"];

        tasks.forEach(task => {
            timeline[task] = false;
        });

        const projectData = {
            title,
            type,
            proposal: proposal || 'No proposal provided.',
            deadline,
            deadlines: {
                publication: deadline,
                contact: '',
                interview: '',
                draft: '',
                review: '',
                edits: ''
            },
            authorId,
            authorName,
            editorId: null,
            editorName: null,
            proposalStatus: 'pending',
            timeline,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            activity: [{
                text: 'created the project.',
                authorName,
                timestamp: new Date()
            }]
        };

        console.log('[FIREBASE FIX] Adding project to Firestore (fallback)...');
        const docRef = await window.db.collection('projects').add(projectData);
        console.log('[FIREBASE FIX] ✅ Project created successfully with ID (fallback):', docRef.id);

        if (window.allProjects) {
            const localProject = {
                id: docRef.id,
                ...projectData,
                createdAt: { seconds: Math.floor(Date.now() / 1000) },
                updatedAt: { seconds: Math.floor(Date.now() / 1000) }
            };
            window.allProjects.unshift(localProject);
        }

        if (typeof showNotification === 'function') {
            showNotification('Project proposal submitted successfully!', 'success');
        } else {
            alert('Project proposal submitted successfully!');
        }

        const form = document.getElementById('project-form');
        if (form) form.reset();

        setTimeout(() => {
            if (typeof closeAllModals === 'function') {
                closeAllModals();
            } else {
                const modal = document.getElementById('project-modal');
                if (modal) modal.style.display = 'none';
            }

            if (typeof renderCurrentViewEnhanced === 'function') {
                renderCurrentViewEnhanced();
            }
        }, 1000);

    } catch (error) {
        console.error('[FIREBASE FIX] Error saving project (fallback):', error);

        let errorMessage = 'Failed to save project. ';
        if (error.code === 'permission-denied') {
            errorMessage += 'Permission denied. Please make sure you are logged in.';
        } else if (error.code === 'unavailable') {
            errorMessage += 'Service temporarily unavailable. Please try again.';
        } else {
            errorMessage += error.message || 'Please try again.';
        }

        if (typeof showNotification === 'function') {
            showNotification(errorMessage, 'error');
        } else {
            alert(errorMessage);
        }
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        delete submitBtn.dataset.submitting;
    }
}

// Initialize fixes when DOM is ready
function initializeFixes() {
    waitForFirebase(() => {
        console.log('[FIREBASE FIX] Firebase ready, applying fixes...');
        
        // Wait a bit for the main dashboard.js to initialize
        setTimeout(() => {
            fixProjectFormSubmission();
            
            // Also fix the add project button
            const addProjectBtn = document.getElementById('add-project-button');
            if (addProjectBtn && !addProjectBtn.dataset.firebaseFixAttached) {
                addProjectBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('[FIREBASE FIX] Add project button clicked');
                    
                    if (typeof window.openProjectModal === 'function') {
                        window.openProjectModal();
                        return;
                    }
                    
                    const modal = document.getElementById('project-modal');
                    if (modal) {
                        const form = document.getElementById('project-form');
                        if (form) form.reset();
                        
                        modal.style.display = 'flex';
                        
                        const projectTypeSelect = document.getElementById('project-type');
                        if (projectTypeSelect && window.currentView) {
                            if (window.currentView === 'interviews' || window.currentView === 'dashboard') {
                                projectTypeSelect.value = 'Interview';
                            } else if (window.currentView === 'opeds') {
                                projectTypeSelect.value = 'Op-Ed';
                            }
                        }
                        
                        setTimeout(() => {
                            const titleInput = document.getElementById('project-title');
                            if (titleInput) titleInput.focus();
                        }, 100);
                    }
                });
                
                addProjectBtn.dataset.firebaseFixAttached = 'true';
                console.log('[FIREBASE FIX] ✅ Add project button fixed');
            }
        }, 2000);
    });
}

// Start initialization
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeFixes);
} else {
    initializeFixes();
}

console.log('[FIREBASE FIX] Fix script loaded, waiting for initialization...');
