# Quick Reference: Delete & Approval Functions

## Delete Buttons Location

### Project Details Modal
- Button ID: `delete-project-button`
- Located in: Right sidebar under "Delete Project" section
- Visible to: Admin OR Project Author

### Task Details Modal
- Button ID: `delete-task-button`
- Located in: Right sidebar under "Delete Task" section
- Visible to: Admin OR Task Creator

## Approval Buttons Location

### Project Details Modal (Admin Only)
- Section ID: `admin-approval-section`
- Approve Button: `approve-button`
- Reject Button: `reject-button`
- Visible when: User is admin AND proposal status is "pending"

### Task Details Modal (Admin Only)
- Section ID: `task-admin-approval-section`
- Approve Button: `approve-task-button`
- Reject Button: `reject-task-button`
- Visible when: User is admin AND task status is "pending"

## How It Works

### When Delete Button is Clicked:
1. ✅ System checks if user has permission (admin or creator)
2. ✅ Shows confirmation dialog with clear warning
3. ✅ If confirmed, deletes from Firebase
4. ✅ Shows success notification
5. ✅ Closes modal after 500ms delay
6. ✅ Card automatically disappears from board (Firebase real-time listener)

### When Approve/Reject is Clicked:
1. ✅ System checks if user is admin
2. ✅ Updates status in Firebase
3. ✅ Adds activity log entry
4. ✅ Shows success notification
5. ✅ Card moves to appropriate column (Firebase real-time listener)

## Troubleshooting

### "Delete Forever" button not visible?
- Check if you're the creator/admin
- Open browser console (F12) and look for: `[MODAL] Delete button visibility`
- This will show the permission check results

### Delete not working?
- Check browser console for errors
- Look for: `[DELETE ERROR]` messages
- Common issues:
  - Firebase permission rules
  - Network connectivity
  - User not authenticated

### Approve/Reject not working?
- Check browser console for errors
- Look for: `[APPROVE ERROR]` or `[UPDATE STATUS ERROR]`
- Verify user has admin role
- Check Firebase security rules

## Console Logging Guide

All operations now have detailed logging:
- `[DELETE]` - Delete operation logs
- `[APPROVE]` - Approval operation logs
- `[UPDATE STATUS]` - Status update logs
- `[TASK STATUS]` - Task status change logs
- `[MODAL]` - Modal visibility and rendering logs

## Firebase Security Rules

Make sure your Firebase security rules allow:
```javascript
// Projects
match /projects/{projectId} {
  allow delete: if request.auth != null && 
    (resource.data.authorId == request.auth.uid || 
     get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin');
}

// Tasks
match /tasks/{taskId} {
  allow delete: if request.auth != null && 
    (resource.data.creatorId == request.auth.uid || 
     get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin');
}
```

## Debug Console Removed

The debug console at the bottom of the page has been removed. To view logs:
1. Open browser Developer Tools (F12 or right-click → Inspect)
2. Go to "Console" tab
3. All logging is still available there

## Key Functions Modified

### dashboard.js Functions:
- `handleDeleteProject()` - Enhanced with better error handling
- `handleDeleteTask()` - Enhanced with better error handling
- `approveProposal()` - Added admin permission check
- `updateProposalStatus()` - Added admin permission check
- `updateTaskStatus()` - Added permission checks for admin/assignee
- `refreshDetailsModal()` - Enhanced delete button visibility logging
- `refreshTaskDetailsModal()` - Enhanced delete button visibility logging
