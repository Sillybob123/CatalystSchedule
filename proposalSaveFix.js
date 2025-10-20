// ===============================
// PROPOSAL SAVE FIX V3 - NON-CONFLICTING
// Monitors form submissions without overriding
// ===============================

console.log('[PROPOSAL FIX V3] 🔧 Loading proposal save monitor...');

// Monitor form submissions to help debug issues
function initializeProposalMonitor() {
    console.log('[PROPOSAL FIX V3] Initializing monitor...');
    
    // Check prerequisites
    if (typeof firebase === 'undefined' || !firebase.firestore) {
        console.error('[PROPOSAL FIX V3] ❌ Firebase not loaded yet, retrying...');
        setTimeout(initializeProposalMonitor, 500);
        return;
    }
    
    if (typeof db === 'undefined' || !db) {
        console.error('[PROPOSAL FIX V3] ❌ Database not ready yet, retrying...');
        setTimeout(initializeProposalMonitor, 500);
        return;
    }
    
    console.log('[PROPOSAL FIX V3] ✅ Prerequisites met, setting up monitor...');
    
    // Monitor the form without overriding
    monitorFormSubmissions();
    
    console.log('[PROPOSAL FIX V3] ✅ Monitor active');
}

/**
 * Monitor form submissions without interfering
 */
function monitorFormSubmissions() {
    const form = document.getElementById('project-form');
    if (!form) {
        console.warn('[PROPOSAL FIX V3] Form not found, retrying...');
        setTimeout(monitorFormSubmissions, 1000);
        return;
    }
    
    console.log('[PROPOSAL FIX V3] ✅ Form found, monitoring submissions');
    
    // Monitor submit button clicks
    const submitButton = document.getElementById('save-project-button');
    if (submitButton) {
        submitButton.addEventListener('click', function() {
            console.log('[PROPOSAL FIX V3] 🖱️ Submit button clicked');
            console.log('[PROPOSAL FIX V3] Form values:', {
                title: document.getElementById('project-title')?.value,
                type: document.getElementById('project-type')?.value,
                deadline: document.getElementById('project-deadline')?.value
            });
        });
    }
    
    // Monitor actual form submissions
    form.addEventListener('submit', function(e) {
        console.log('[PROPOSAL FIX V3] 📝 Form submit event fired');
        console.log('[PROPOSAL FIX V3] User authenticated:', !!currentUser);
        console.log('[PROPOSAL FIX V3] Database ready:', !!db);
    }, { capture: true }); // Use capture phase to log before other handlers
}

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(initializeProposalMonitor, 1000);
    });
} else {
    setTimeout(initializeProposalMonitor, 1000);
}

console.log('[PROPOSAL FIX V3] 🚀 Monitor script loaded, waiting for initialization...');
