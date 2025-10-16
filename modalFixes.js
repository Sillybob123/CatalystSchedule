// ===============================
// MODAL FIXES - Add this to dashboard.js
// ===============================

/**
 * Properly close all modals and reset their states
 */
function closeAllModals() {
    console.log('[MODAL] Closing all modals');
    
    // Get all modal elements
    const modals = [
        'project-modal',
        'task-modal',
        'details-modal',
        'task-details-modal',
        'report-modal'
    ];
    
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal) {
            // Remove all display/visibility styles
            modal.style.display = 'none';
            modal.style.opacity = '';
            modal.style.visibility = '';
            
            // Remove any loading states
            modal.classList.remove('loading');
        }
    });
    
    // Clear currently viewed IDs
    currentlyViewedProjectId = null;
    currentlyViewedTaskId = null;
    
    // Remove blur from background
    document.body.style.overflow = '';
    
    console.log('[MODAL] All modals closed successfully');
}

/**
 * Enhanced modal opening with proper cleanup
 */
function openModalSafely(modalId, setupCallback) {
    console.log('[MODAL] Opening modal:', modalId);
    
    // Force close all modals first
    closeAllModals();
    
    // Small delay to ensure closing is complete
    setTimeout(() => {
        const modal = document.getElementById(modalId);
        if (!modal) {
            console.error('[MODAL] Modal not found:', modalId);
            return;
        }
        
        // Reset all styles
        modal.style.display = '';
        modal.style.opacity = '';
        modal.style.visibility = '';
        
        // Show modal
        modal.style.display = 'flex';
        
        // Force browser reflow
        void modal.offsetHeight;
        
        // Run setup callback if provided
        if (setupCallback) {
            setupCallback();
        }
        
        console.log('[MODAL] Modal opened successfully:', modalId);
    }, 100); // Increased delay to ensure proper cleanup
}
