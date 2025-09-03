// ===============================
// Catalyst Tracker - Social Media Planner JS
// ===============================

// ---- Firebase Configuration ----
const firebaseConfig = {
    apiKey: "AIzaSyBT6urJvPCtuYQ1c2iH77QTDfzE3yGw-Xk",
    authDomain: "catalystmonday.firebaseapp.com",
    projectId: "catalystmonday",
    storageBucket: "catalystmonday.appspot.com",
    messagingSenderId: "394311851220",
    appId: "1:394311851220:web:86e4939b7d5a085b46d75d"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

// ---- App State ----
let currentUser = null, currentUserName = null, currentUserRole = null;
let allPosts = [], allUsers = [];
let currentlyViewedPostId = null;

// ======================
//  Initialization
// ======================
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    currentUser = user;

    try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        const userData = userDoc.data();
        currentUserName = userData.name;
        currentUserRole = userData.role;

        await fetchAllUsers();
        setupUI();
        setupListeners();
        subscribeToPosts();

        document.getElementById('loader').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
        
    } catch (error) {
        console.error("Initialization Error:", error);
        alert("Could not load your profile. Please refresh the page and try again.");
    }
});

async function fetchAllUsers() {
    try {
        const usersSnapshot = await db.collection('users').get();
        allUsers = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching users:", error);
    }
}

function setupUI() {
    document.getElementById('user-name').textContent = currentUserName;
    document.getElementById('user-role').textContent = currentUserRole;
    const avatar = document.getElementById('user-avatar');
    avatar.textContent = currentUserName.charAt(0).toUpperCase();
}

// ==================
//  Event Listeners
// ==================
function setupListeners() {
    document.getElementById('logout-button').addEventListener('click', () => auth.signOut());
    document.getElementById('add-post-button').addEventListener('click', openPostModal);
    document.getElementById('post-form').addEventListener('submit', handlePostFormSubmit);
    
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', e => {
            if (e.target.classList.contains('modal-overlay') || e.target.classList.contains('close-button')) {
                closeAllModals();
            }
        });
    });

    document.getElementById('approve-button').addEventListener('click', () => updatePostStatus('approved'));
    document.getElementById('reject-button').addEventListener('click', () => updatePostStatus('rejected'));
    document.getElementById('assign-user-button').addEventListener('click', handleAssignUser);
    document.getElementById('mark-posted-button').addEventListener('click', () => updatePostStatus('posted'));
}

// ==================
//  Data Handling
// ==================
function subscribeToPosts() {
    db.collection('social_posts').onSnapshot(snapshot => {
        allPosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderKanbanBoard(allPosts);
        if (currentlyViewedPostId) {
            const post = allPosts.find(p => p.id === currentlyViewedPostId);
            if(post) {
                refreshDetailsModal(post);
            } else {
                closeAllModals();
            }
        }
    }, error => {
        console.error("Error fetching social posts:", error);
    });
}

// ==================
//  Kanban Board
// ==================
function renderKanbanBoard(posts) {
    const board = document.getElementById('kanban-board');
    board.innerHTML = '';
    
    const columns = ["Proposed", "Approved", "Assigned", "Posted"];
    
    columns.forEach(columnTitle => {
        const columnPosts = posts.filter(post => post.status === columnTitle.toLowerCase());
        
        const columnEl = document.createElement('div');
        columnEl.className = 'kanban-column';
        columnEl.innerHTML = `
            <div class="column-header">
                <div class="column-title">
                    <span class="column-title-text">${columnTitle}</span>
                    <span class="task-count">${columnPosts.length}</span>
                </div>
            </div>
            <div class="column-content">
                <div class="kanban-cards"></div>
            </div>
        `;
        
        const cardsContainer = columnEl.querySelector('.kanban-cards');
        columnPosts.forEach(post => {
            cardsContainer.appendChild(createPostCard(post));
        });
        
        board.appendChild(columnEl);
    });
}

function createPostCard(post) {
    const card = document.createElement('div');
    card.className = 'kanban-card';
    card.dataset.id = post.id;
    
    card.innerHTML = `
        <h4 class="card-title">${post.title}</h4>
        <div class="card-meta">
            <span class="card-type">${post.platform}</span>
        </div>
        <div class="card-footer">
            <div class="card-author">
                <span>Proposer: ${post.proposerName}</span>
            </div>
            <div class="card-deadline">
                ${new Date(post.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
        </div>
    `;
    
    card.addEventListener('click', () => openDetailsModal(post.id));
    return card;
}


// =================
// Modals
// =================
function openPostModal() {
    document.getElementById('post-form').reset();
    document.getElementById('modal-title').textContent = 'Propose New Social Media Post';
    document.getElementById('post-modal').style.display = 'flex';
}

function openDetailsModal(postId) {
    const post = allPosts.find(p => p.id === postId);
    if (!post) return;
    currentlyViewedPostId = postId;
    refreshDetailsModal(post);
    document.getElementById('details-modal').style.display = 'flex';
}

function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(modal => modal.style.display = 'none');
    currentlyViewedPostId = null;
}

function refreshDetailsModal(post) {
    document.getElementById('details-title').textContent = post.title;
    document.getElementById('details-content').textContent = post.content;
    document.getElementById('details-status').textContent = post.status.charAt(0).toUpperCase() + post.status.slice(1);
    document.getElementById('details-proposer').textContent = post.proposerName;
    document.getElementById('details-assignee').textContent = post.assigneeName || 'Not Assigned';
    document.getElementById('details-platform').textContent = post.platform;
    document.getElementById('details-deadline').textContent = new Date(post.deadline).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const isAdmin = currentUserRole === 'admin';
    const isAssignee = currentUser.uid === post.assigneeId;

    const adminApprovalSection = document.getElementById('admin-approval-section');
    adminApprovalSection.style.display = isAdmin && post.status === 'proposed' ? 'block' : 'none';

    const assignUserSection = document.getElementById('assign-user-section');
    assignUserSection.style.display = isAdmin && post.status === 'approved' ? 'flex' : 'none';

    const markPostedSection = document.getElementById('mark-posted-section');
    markPostedSection.style.display = (isAdmin || isAssignee) && post.status === 'assigned' ? 'block' : 'none';
    
    if (isAdmin) {
        populateUserDropdown(post.assigneeId);
    }
}

function populateUserDropdown(currentAssigneeId) {
    const dropdown = document.getElementById('user-dropdown');
    dropdown.innerHTML = '<option value="">Select User</option>';
    allUsers.forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = user.name;
        if (user.id === currentAssigneeId) option.selected = true;
        dropdown.appendChild(option);
    });
}

// =================
// Actions
// =================
async function handlePostFormSubmit(e) {
    e.preventDefault();
    const newPost = {
        title: document.getElementById('post-title').value, 
        platform: document.getElementById('post-platform').value,
        content: document.getElementById('post-content').value,
        deadline: document.getElementById('post-deadline').value,
        proposerId: currentUser.uid, 
        proposerName: currentUserName,
        assigneeId: null,
        assigneeName: null,
        status: 'proposed', // proposed, approved, assigned, posted
        createdAt: new Date()
    };
    
    try {
        await db.collection('social_posts').add(newPost);
        closeAllModals();
    } catch (error) {
        console.error("Failed to create post:", error);
        alert('Failed to create post. Please try again.');
    }
}

async function updatePostStatus(newStatus) {
    if (!currentlyViewedPostId) return;
    try {
        await db.collection('social_posts').doc(currentlyViewedPostId).update({
            status: newStatus
        });
    } catch (error) {
        console.error(`Failed to update post status to ${newStatus}:`, error);
        alert(`Failed to update post status. Please try again.`);
    }
}

async function handleAssignUser() {
    const dropdown = document.getElementById('user-dropdown');
    const userId = dropdown.value;
    if (!userId) return;
    
    const selectedUser = allUsers.find(u => u.id === userId);
    if (!selectedUser || !currentlyViewedPostId) return;
    
    try {
        await db.collection('social_posts').doc(currentlyViewedPostId).update({
            assigneeId: userId,
            assigneeName: selectedUser.name,
            status: 'assigned'
        });
    } catch (error) {
        console.error(`Failed to assign user:`, error);
        alert('Failed to assign user. Please try again.');
    }
}
