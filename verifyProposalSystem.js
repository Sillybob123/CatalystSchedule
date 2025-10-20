// ===============================
// PROPOSAL SYSTEM VERIFICATION
// Run this in browser console to check if everything is set up correctly
// ===============================

console.log('🔍 Starting Proposal System Verification...');
console.log('==========================================\n');

// Test 1: Check if fix script loaded
console.log('✅ TEST 1: Fix Script Loaded');
const fixLoaded = typeof window.handleProjectFormSubmit === 'function';
console.log(`   Result: ${fixLoaded ? '✅ PASS' : '❌ FAIL'}`);
if (!fixLoaded) {
    console.error('   → Fix script not loaded! Check if proposalSaveFix.js is included in HTML');
}
console.log('');

// Test 2: Check Firebase
console.log('✅ TEST 2: Firebase Connection');
const firebaseOk = typeof firebase !== 'undefined' && firebase.firestore;
console.log(`   Result: ${firebaseOk ? '✅ PASS' : '❌ FAIL'}`);
if (!firebaseOk) {
    console.error('   → Firebase not initialized! Check Firebase scripts in HTML');
}
console.log('');

// Test 3: Check Database
console.log('✅ TEST 3: Firestore Database');
const dbOk = typeof db !== 'undefined' && db;
console.log(`   Result: ${dbOk ? '✅ PASS' : '❌ FAIL'}`);
if (!dbOk) {
    console.error('   → Database not available! Check Firebase initialization');
}
console.log('');

// Test 4: Check User Authentication
console.log('✅ TEST 4: User Authentication');
const userOk = typeof currentUser !== 'undefined' && currentUser;
console.log(`   Result: ${userOk ? '✅ PASS' : '❌ FAIL'}`);
if (userOk) {
    console.log(`   → User: ${currentUserName}`);
    console.log(`   → Role: ${currentUserRole}`);
    console.log(`   → UID: ${currentUser.uid}`);
} else {
    console.error('   → Not logged in! Please log in first');
}
console.log('');

// Test 5: Check Form Elements
console.log('✅ TEST 5: Form Elements');
const elements = {
    form: document.getElementById('project-form'),
    titleInput: document.getElementById('project-title'),
    typeSelect: document.getElementById('project-type'),
    proposalTextarea: document.getElementById('project-proposal'),
    deadlineInput: document.getElementById('project-deadline'),
    submitButton: document.getElementById('save-project-button'),
    modal: document.getElementById('project-modal'),
    addButton: document.getElementById('add-project-button')
};

let allElementsOk = true;
Object.entries(elements).forEach(([name, element]) => {
    const exists = !!element;
    console.log(`   ${exists ? '✅' : '❌'} ${name}: ${exists ? 'Found' : 'Missing'}`);
    if (!exists) allElementsOk = false;
});
console.log(`   Result: ${allElementsOk ? '✅ PASS' : '❌ FAIL'}`);
console.log('');

// Test 6: Check Required Functions
console.log('✅ TEST 6: Required Functions');
const functions = {
    'handleProjectFormSubmit': window.handleProjectFormSubmit,
    'openProjectModal': window.openProjectModal,
    'closeAllModals': window.closeAllModals || closeAllModals,
    'showNotification': showNotification,
    'renderCurrentViewEnhanced': renderCurrentViewEnhanced
};

let allFunctionsOk = true;
Object.entries(functions).forEach(([name, func]) => {
    const exists = typeof func === 'function';
    console.log(`   ${exists ? '✅' : '❌'} ${name}: ${exists ? 'Available' : 'Missing'}`);
    if (!exists) allFunctionsOk = false;
});
console.log(`   Result: ${allFunctionsOk ? '✅ PASS' : '❌ FAIL'}`);
console.log('');

// Test 7: Check Subscription System
console.log('✅ TEST 7: Subscription System');
const subscriptionsOk = typeof allProjects !== 'undefined' && Array.isArray(allProjects);
console.log(`   Result: ${subscriptionsOk ? '✅ PASS' : '❌ FAIL'}`);
if (subscriptionsOk) {
    console.log(`   → Projects loaded: ${allProjects.length}`);
    console.log(`   → Tasks loaded: ${typeof allTasks !== 'undefined' ? allTasks.length : 0}`);
} else {
    console.error('   → Subscriptions not working! Check fixedSubscriptions.js');
}
console.log('');

// Test 8: Check Current View
console.log('✅ TEST 8: Current View');
const viewOk = typeof currentView !== 'undefined';
console.log(`   Result: ${viewOk ? '✅ PASS' : '❌ FAIL'}`);
if (viewOk) {
    console.log(`   → Current view: ${currentView}`);
}
console.log('');

// Summary
console.log('\n==========================================');
console.log('📊 VERIFICATION SUMMARY');
console.log('==========================================\n');

const allTests = [
    fixLoaded,
    firebaseOk,
    dbOk,
    userOk,
    allElementsOk,
    allFunctionsOk,
    subscriptionsOk,
    viewOk
];

const passedTests = allTests.filter(test => test).length;
const totalTests = allTests.length;

if (passedTests === totalTests) {
    console.log('🎉 ALL TESTS PASSED! System is ready to use.');
    console.log('   You can now create proposals successfully.');
} else {
    console.log(`⚠️  ${passedTests}/${totalTests} tests passed`);
    console.log('   Some issues detected. Check the failed tests above.');
}

console.log('\n==========================================');
console.log('🧪 Quick Test Function');
console.log('==========================================\n');
console.log('To test proposal creation, run:');
console.log('testProposalCreation()');

// Create test function
window.testProposalCreation = async function() {
    console.log('🧪 Testing proposal creation...');
    
    if (!userOk) {
        console.error('❌ Cannot test: User not logged in');
        return;
    }
    
    if (!dbOk) {
        console.error('❌ Cannot test: Database not available');
        return;
    }
    
    const testData = {
        title: `Test Proposal - ${new Date().toLocaleTimeString()}`,
        type: 'Interview',
        proposal: 'This is a test proposal created by the verification script. You can delete it.',
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        deadlines: {
            publication: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
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
        timeline: {
            "Topic Proposal Complete": false,
            "Interview Scheduled": false,
            "Interview Complete": false,
            "Article Writing Complete": false,
            "Review In Progress": false,
            "Review Complete": false,
            "Suggestions Reviewed": false
        },
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        activity: [{
            text: 'created the project (TEST)',
            authorName: currentUserName,
            timestamp: new Date()
        }]
    };
    
    try {
        console.log('   Creating test proposal...');
        const docRef = await db.collection('projects').add(testData);
        console.log('✅ SUCCESS! Test proposal created');
        console.log(`   Document ID: ${docRef.id}`);
        console.log('   Check your board - it should appear in "Pending Approval"');
        console.log('   You can delete it from the project details modal');
    } catch (error) {
        console.error('❌ FAILED to create test proposal');
        console.error(`   Error: ${error.message}`);
        if (error.code === 'permission-denied') {
            console.error('   → Check your Firestore security rules!');
            console.error('   → Go to Firebase Console → Firestore → Rules');
            console.error('   → Ensure "allow create: if request.auth != null;" is present');
        }
    }
};

console.log('\n✅ Verification complete! Scroll up to see results.');
