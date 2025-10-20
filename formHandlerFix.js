// ===========================================
// FORM HANDLER FIX - GUARANTEED WORKING VERSION
// ===========================================

console.log('[FORM FIX] 🔧 Loading bulletproof form handler...');

// Function to attach the form handler
function attachProjectFormHandler() {
    console.log('[FORM FIX] Attempting to attach form handler...');
    
    const form = document.getElementById('project-form');
    if (!form) {
        console.error('[FORM FIX] Form not found, retrying...');
        setTimeout(attachProjectFormHandler, 500);
        return;
    }
    
    console.log('[FORM FIX] ✅ Form found, attaching handler');
    
    // Remove ALL existing listeners by cloning
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);
    
    // Get fresh reference
    const freshForm = document.getElementById('project-form');
    
    // Attach the handler
    freshForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        console.log('🚀🚀🚀 [FORM SUBMIT] FORM SUBMITTED! 🚀🚀🚀');
        
        const submitButton = document.getElementById('save-project-button');
        if (!submitButton) {
            alert('Error: Submit button not found');
            return;
        }
        
        const originalText = submitButton.textContent;
        
        // Get values
        const title = document.getElementById('project-title')?.value?.trim();
        const type = document.getElementById('project-type')?.value;
        const proposal = document.getElementById('project-proposal')?.value?.trim();
        const deadline = document.getElementById('project-deadline')?.value;
        
        console.log('[FORM SUBMIT] Form values:', { title, type, proposal: proposal?.substring(0, 50), deadline });
        
        // Validate
        if (!title || title.length < 3) {
            alert('Please enter a title with at least 3 characters');
            return;
        }
        
        if (!type) {
            alert('Please select a project type');
            return;
        }
        
        if (!deadline) {
            alert('Please set a publication deadline');
            return;
        }
        
        // Check auth
        if (typeof currentUser === 'undefined' || !currentUser || !currentUser.uid) {
            alert('You are not logged in. Please refresh the page and log in again.');
            return;
        }
        
        if (typeof currentUserName === 'undefined' || !currentUserName) {
            alert('User information not available. Please refresh the page.');
            return;
        }
        
        try {
            submitButton.disabled = true;
            submitButton.textContent = 'Submitting...';
            
            console.log('[FORM SUBMIT] Creating project data...');
            
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
            
            console.log('[FORM SUBMIT] ✅✅✅ SUCCESS! Project ID:', docRef.id);
            
            alert('✅ Project proposal submitted successfully!\n\nProject ID: ' + docRef.id);
            
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
            console.error('[FORM SUBMIT] ❌ ERROR:', error);
            
            let errorMsg = 'Failed to submit proposal:\n\n';
            if (error.code === 'permission-denied') {
                errorMsg += 'Permission denied. Check Firestore security rules.';
            } else {
                errorMsg += error.message || 'Unknown error';
            }
            
            alert(errorMsg);
            
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = originalText;
        }
    });
    
    console.log('[FORM FIX] ✅ Handler attached successfully');
}

// Also attach handler to the submit button directly as a backup
function attachButtonHandler() {
    const button = document.getElementById('save-project-button');
    if (!button) {
        console.log('[FORM FIX] Button not found, retrying...');
        setTimeout(attachButtonHandler, 500);
        return;
    }
    
    console.log('[FORM FIX] Attaching backup handler to button');
    
    // Clone to remove old listeners
    const newButton = button.cloneNode(true);
    button.parentNode.replaceChild(newButton, button);
    
    const freshButton = document.getElementById('save-project-button');
    freshButton.addEventListener('click', function(e) {
        console.log('[FORM FIX] 🔘 BUTTON CLICKED!');
        
        // Trigger form submission
        const form = document.getElementById('project-form');
        if (form) {
            console.log('[FORM FIX] Triggering form submit event');
            form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        } else {
            console.error('[FORM FIX] Form not found when button clicked!');
        }
    });
    
    console.log('[FORM FIX] ✅ Button handler attached');
}

// Override the openProjectModal function
function setupModalOpener() {
    window.openProjectModal = function() {
        console.log('[FORM FIX] Opening project modal...');
        
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
            
            // Re-attach handlers every time modal opens
            setTimeout(() => {
                console.log('[FORM FIX] Re-attaching handlers for modal...');
                attachProjectFormHandler();
                attachButtonHandler();
            }, 200);
        }
        
        console.log('[FORM FIX] ✅ Modal opened');
    };
    
    console.log('[FORM FIX] ✅ Modal opener overridden');
}

// Initialize after a delay to ensure everything is loaded
setTimeout(function() {
    console.log('[FORM FIX] Initializing...');
    
    attachProjectFormHandler();
    attachButtonHandler();
    setupModalOpener();
    
    // Also attach to the add button
    const addButton = document.getElementById('add-project-button');
    if (addButton) {
        const newAddButton = addButton.cloneNode(true);
        addButton.parentNode.replaceChild(newAddButton, addButton);
        
        const freshAddButton = document.getElementById('add-project-button');
        freshAddButton.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('[FORM FIX] Add project button clicked');
            window.openProjectModal();
        });
        
        console.log('[FORM FIX] ✅ Add button handler attached');
    }
    
    console.log('[FORM FIX] ✅✅✅ ALL HANDLERS INSTALLED ✅✅✅');
    
}, 2000);
