// ===================================
// Catalyst Tracker - State Manager
// ===================================

/**
 * Determines the precise state of a project, including its column, color, and status text.
 * This is the single source of truth for the entire workflow logic.
 *
 * @param {object} project - The project object from Firestore.
 * @param {string} view - The current view ('interviews', 'opeds', 'my-assignments').
 * @param {object} currentUser - The currently logged-in user object.
 * @returns {object} An object containing { column, color, statusText }.
 */
function getProjectState(project, view, currentUser) {
    const timeline = project.timeline || {};

    // --- Final State: COMPLETED ---
    if (timeline["Suggestions Reviewed"]) {
        const column = view === 'my-assignments' ? "Done" : "Completed";
        return { column, color: 'green', statusText: 'Completed' };
    }

    // --- View: My Assignments (Personalized Logic) ---
    if (view === 'my-assignments') {
        const isAuthor = project.authorId === currentUser.uid;
        const isEditor = project.editorId === currentUser.uid;

        if (isEditor) {
            if (timeline["Article Writing Complete"] && !timeline["Review Complete"]) {
                return { column: "In Progress", color: 'yellow', statusText: "Reviewing Article" };
            }
            // If review is done from editor's perspective, it's "Done" for them.
            if (timeline["Review Complete"]) {
                return { column: "Done", color: 'default', statusText: "Review Finished" };
            }
        }

        if (isAuthor) {
            if (timeline["Review Complete"] && !timeline["Suggestions Reviewed"]) {
                return { column: "In Review", color: 'blue', statusText: "Awaiting Your Review" };
            }
            if (project.proposalStatus === 'approved' && !timeline["Article Writing Complete"]) {
                return { column: "In Progress", color: 'yellow', statusText: "Writing in Progress" };
            }
            if (project.type === 'Interview' && project.proposalStatus === 'approved' && !timeline["Interview Complete"]) {
                return { column: "To Do", color: 'default', statusText: "Schedule Interview" };
            }
        }
        return { column: "To Do", color: 'default', statusText: "Pending" };
    }


    // --- View: Main Workflows ('interviews' & 'opeds') ---

    // 1. Topic Proposal
    if (project.proposalStatus !== 'approved') {
        return { column: "Topic Proposal", color: 'default', statusText: `Proposal: ${project.proposalStatus}` };
    }

    // 2. Interview Stage (Interview-specific)
    if (project.type === 'Interview' && !timeline["Interview Complete"]) {
        const color = timeline["Interview Scheduled"] ? 'yellow' : 'default';
        return { column: "Interview Stage", color: color, statusText: "Interview Stage" };
    }

    // 3. Writing Stage
    if (!timeline["Article Writing Complete"]) {
        return { column: "Writing Stage", color: 'yellow', statusText: "Writing in Progress" };
    }

    // 4. After Writing is Complete
    if (timeline["Article Writing Complete"]) {
        // Awaiting Editor Assignment
        if (!project.editorId) {
            return { column: "Writing Stage", color: 'yellow', statusText: "Awaiting Editor Assignment" };
        }
        // In Review
        if (!timeline["Review Complete"]) {
            return { column: "In Review", color: 'yellow', statusText: "In Review" };
        }
        // Reviewing Suggestions
        if (timeline["Review Complete"] && !timeline["Suggestions Reviewed"]) {
            return { column: "Reviewing Suggestions", color: 'blue', statusText: "Reviewing Suggestions" };
        }
    }

    // Fallback default
    return { column: "Topic Proposal", color: 'default', statusText: "Pending" };
}
