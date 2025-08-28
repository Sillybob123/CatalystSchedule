// WARNING: Do NOT deploy this app with sensitive information exposed!
// This configuration is safe to be client-side.
const firebaseConfig = {
    apiKey: "AIzaSyBT6urJvPCtuYQ1c2iH77QTDfzE3yGw-Xk", // Your Web API Key
    authDomain: "catalystmonday.firebaseapp.com",
    projectId: "catalystmonday",
    storageBucket: "catalystmonday.appspot.com",
    // These values are often not needed for Auth/Firestore but are good to have
    // You can find them in your Firebase Project Settings
    messagingSenderId: "394311851220", 
    appId: "1:394311851220:web:86e4939b7d5a085b46d75d" // Check your firebase console for this value
};


// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// Login functionality
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // Signed in
            const user = userCredential.user;
            console.log('User logged in:', user.uid);
            window.location.href = 'dashboard.html'; // Redirect to dashboard
        })
        .catch((error) => {
            loginError.textContent = "Error: " + error.message;
            console.error('Login error:', error);
        });
});

// Check if a user is already logged in
auth.onAuthStateChanged((user) => {
    if (user) {
        // If user is logged in and on the login page, redirect to dashboard
        if(window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/')) {
            window.location.href = 'dashboard.html';
        }
    }
});
