// ===========================================
// FORM HANDLER FIX - Production Version
// ===========================================

console.log('[FORM FIX] Loading form handler...');

// Function to attach the form handler
function attachProjectFormHandler() {
    const form = document.getElementById('project-form');
    if (!form) {
        setTimeout(attachProjectFormHandler, 500);
        return;
    }
    
    // Remove ALL existing listeners by cloning
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);
    
    // Get fresh reference
    const freshForm = document.getElementById('project-form');
    
    // Attach the handler
    freshForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        console.log('[FORM SUBMIT] Processing project submission...');
        
        const submitButton = document.getElementById('save-project-button');
        if (!submitButton) {
            showNotification('Error: Submit button not found. Please refresh the page.', 'error');
            return;
        }
        
        const originalText = submitButton.textContent;
        
        // Get values
        const title = document.getElementById('project-title')?.value?.trim();
        const type = document.getElementById('project-type')?.value;
        const proposal = document.getElementById('project-proposal')?.value?.trim();
        const deadline = document.getElementById('project-deadline')?.value;
        
        // Validate
        if (!title || title.length < 3) {
            showNotification('Please enter a title with at least 3 characters.', 'error');
            document.getElementById('project-title')?.focus();
            return;
        }
        
        if (!type) {
            showNotification('Please select a project type.', 'error');
            document.getElementById('project-type')?.focus();
            return;
        }
        
        if (!deadline) {
            showNotification('Please set a publication deadline.', 'error');
            document.getElementById('project-deadline')?.focus();
            return;
        }
        
        // Validate deadline is in the future
        const deadlineDate = new Date(deadline);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (deadlineDate < today) {
            showNotification('Publication deadline must be in the future.', 'error');
            document.getElementById('project-deadline')?.focus();
            return;
        }
        
        // Check auth
        if (typeof currentUser === 'undefined' || !currentUser || !currentUser.uid) {
            showNotification('Your session expired. Please refresh the page and log in again.', 'error');
            return;
        }
        
        if (typeof currentUserName === 'undefined' || !currentUserName) {
            showNotification('User information not available. Please refresh the page.', 'error');
            return;
        }
        
        try {
            submitButton.disabled = true;
            submitButton.classList.add('loading');
            submitButton.textContent = 'Submitting...';
            
            // Create timeline
            const timeline = {};
            const tasks = type === "Interview"
                ? ["Topic Proposal Complete", "Interview Scheduled", "Interview Complete",
                   "Article Writing Complete", "Review In Progress", "Review Complete", "Suggestions Reviewed"]
                : ["Topic Proposal Complete", "Article Writing Complete",
                   "Review In Progress", "Review Complete", "Suggestions Reviewed"];
            
            tasks.forEach(task => timeline[task] = false);
            
            // Create project data
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
                authorId: currentUser.uid,
                authorName: currentUserName,
                editorId: null,
                editorName: null,
                proposalStatus: 'pending',
                timeline: timeline,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                activity: [{
                    text: 'created the project.',
                    authorName: currentUserName,
                    timestamp: new Date()
                }]
            };
            
            console.log('[FORM SUBMIT] Submitting to Firestore...');
            
            // Submit to Firebase
            const docRef = await db.collection('projects').add(projectData);
            
            console.log('[FORM SUBMIT] ✅ Project created successfully! ID:', docRef.id);
            
            // Add to local array for immediate UI update
            const nowSeconds = Math.floor(Date.now() / 1000);
            const localProject = {
                id: docRef.id,
                title,
                type,
                proposal: proposal || 'No proposal provided.',
                deadline,
                deadlines: { ...projectData.deadlines },
                authorId: currentUser.uid,
                authorName: currentUserName,
                editorId: null,
                editorName: null,
                proposalStatus: 'pending',
                timeline: { ...timeline },
                createdAt: { seconds: nowSeconds },
                updatedAt: { seconds: nowSeconds },
                activity: [{
                    text: 'created the project.',
                    authorName: currentUserName,
                    timestamp: { seconds: nowSeconds }
                }]
            };
            
            // Update local state
            if (typeof allProjects !== 'undefined') {
                allProjects = [localProject, ...allProjects.filter(p => p.id !== docRef.id)];
                if (typeof renderCurrentViewEnhanced === 'function') {
                    renderCurrentViewEnhanced();
                }
                if (typeof updateNavCounts === 'function') {
                    updateNavCounts();
                }
            }
            
            showNotification('Project proposal submitted successfully!', 'success');
            
            // Reset form
            freshForm.reset();
            
            // Close modal
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
            }, 1000);
            
        } catch (error) {
            console.error('[FORM SUBMIT] Error:', error);
            
            let errorMsg = 'Failed to submit proposal. ';
            if (error.code === 'permission-denied') {
                errorMsg += 'Permission denied. Please verify your Firestore security rules allow project creation.';
            } else if (error.code === 'unavailable') {
                errorMsg += 'Database temporarily unavailable. Please check your internet connection.';
            } else {
                errorMsg += error.message || 'Please try again.';
            }
            
            showNotification(errorMsg, 'error');
            
        } finally {
            submitButton.disabled = false;
            submitButton.classList.remove('loading');
            submitButton.textContent = originalText;
        }
    });
    
    console.log('[FORM FIX] ✅ Form handler attached');
}

// Attach handler to the submit button as backup
function attachButtonHandler() {
    const button = document.getElementById('save-project-button');
    if (!button) {
        setTimeout(attachButtonHandler, 500);
        return;
    }
    
    // Clone to remove old listeners
    const newButton = button.cloneNode(true);
    button.parentNode.replaceChild(newButton, button);
    
    const freshButton = document.getElementById('save-project-button');
    freshButton.addEventListener('click', function(e) {
        const form = document.getElementById('project-form');
        if (form) {
            form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        }
    });
    
    console.log('[FORM FIX] ✅ Button handler attached');
}

// Override the openProjectModal function
function setupModalOpener() {
    window.openProjectModal = function() {
        // Reset form
        const form = document.getElementById('project-form');
        if (form) {
            form.reset();
        }
        
        // Set title
        const modalTitle = document.getElementById('modal-title');
        if (modalTitle) {
            modalTitle.textContent = 'Propose New Article';
        }
        
        // Set default type based on current view
        const projectTypeSelect = document.getElementById('project-type');
        if (projectTypeSelect && typeof currentView !== 'undefined') {
            if (currentView === 'interviews') {
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
            }
            
            // Focus on title field
            setTimeout(function() {
                const titleInput = document.getElementById('project-title');
                if (titleInput) {
                    titleInput.focus();
                }
            }, 100);
            
            // Re-attach handlers when modal opens
            setTimeout(() => {
                attachProjectFormHandler();
                attachButtonHandler();
            }, 200);
        }
    };
    
    console.log('[FORM FIX] ✅ Modal opener configured');
}

// Initialize after a delay to ensure everything is loaded
setTimeout(function() {
    attachProjectFormHandler();
    attachButtonHandler();
    setupModalOpener();
    
    // Attach to the add button
    const addButton = document.getElementById('add-project-button');
    if (addButton) {
        const newAddButton = addButton.cloneNode(true);
        addButton.parentNode.replaceChild(newAddButton, addButton);
        
        const freshAddButton = document.getElementById('add-project-button');
        freshAddButton.addEventListener('click', function(e) {
            e.preventDefault();
            window.openProjectModal();
        });
        
        console.log('[FORM FIX] ✅ Add button handler attached');
    }
    
    console.log('[FORM FIX] ✅ All handlers installed successfully');
    
}, 2000);
