// ===============================
// Writing Workflow Page - Auth + Sidebar UI
// ===============================

const firebaseConfig = {
  apiKey: "AIzaSyBT6urJvPCtuYQ1c2iH77QTDfzE3yGw-Xk",
  authDomain: "catalystmonday.firebaseapp.com",
  projectId: "catalystmonday",
  storageBucket: "catalystmonday.appspot.com",
  messagingSenderId: "394311851220",
  appId: "1:394311851220:web:86e4939b7d5a085b46d75d"
};

try {
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
} catch (e) {
  console.error('[FIREBASE] Initialization error:', e);
}

const auth = firebase.auth();
const db = firebase.firestore();

function stringToColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
  return '#' + '00000'.substring(0, 6 - c.length) + c;
}

auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = 'index.html';
    return;
  }

  let name = user.displayName || (user.email ? user.email.split('@')[0] : 'User');
  let role = 'writer';

  try {
    const doc = await db.collection('users').doc(user.uid).get();
    if (doc.exists) {
      const data = doc.data();
      name = data.name || name;
      role = data.role || role;
    }
  } catch (e) {
    console.warn('[USER] Could not fetch user profile:', e);
  }

  const avatar = document.getElementById('user-avatar');
  const userNameEl = document.getElementById('user-name');
  const userRoleEl = document.getElementById('user-role');

  if (avatar) {
    avatar.textContent = name.charAt(0).toUpperCase();
    avatar.style.backgroundColor = stringToColor(name);
  }
  if (userNameEl) userNameEl.textContent = name;
  if (userRoleEl) userRoleEl.textContent = role;

  const logoutBtn = document.getElementById('logout-button');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => auth.signOut());
  }

  // Reveal app UI
  document.getElementById('loader').style.display = 'none';
  document.getElementById('app-container').style.display = 'flex';
});

