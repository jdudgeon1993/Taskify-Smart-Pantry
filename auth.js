// Show login/signup screen
function showLoginScreen() {
  document.getElementById('app-content').style.display = 'none';
  document.getElementById('auth-screen').style.display = 'block';
}

// Show main app
function showAppScreen() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app-content').style.display = 'block';
}

// Sign up with email
async function signUp(email, password, displayName) {
  const { data, error } = await supabase.auth.signUp({
    email: email,
    password: password,
    options: {
      data: {
        display_name: displayName
      }
    }
  });

  if (error) {
    alert('Error signing up: ' + error.message);
    return false;
  }

  alert('Check your email for confirmation link!');
  return true;
}

// Sign in with email
async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email,
    password: password
  });

  if (error) {
    alert('Error signing in: ' + error.message);
    return false;
  }

  return true;
}

// Sign out
async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    alert('Error signing out: ' + error.message);
  }
}

// NOTE: getCurrentUser() and getUserHousehold() are defined in db.js
// They are imported via script tag order (db.js loads before auth.js completes)

// ==============================================
// UI HANDLERS (called from HTML)
// ==============================================

// Handle login form submission
async function handleLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  if (!email || !password) {
    alert('Please enter both email and password');
    return;
  }

  const success = await signIn(email, password);
  if (success) {
    // initializeApp() is called automatically by auth state change listener in supabase-config.js
    // No need to call it here
  }
}

// Handle signup form submission
async function handleSignup() {
  const displayName = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;

  if (!email || !password) {
    alert('Please enter both email and password');
    return;
  }

  if (password.length < 6) {
    alert('Password must be at least 6 characters');
    return;
  }

  await signUp(email, password, displayName || email.split('@')[0]);
}

// Handle signout
async function handleSignout() {
  if (confirm('Are you sure you want to sign out?')) {
    await signOut();
    showLoginScreen();
    // Clear local state
    currentUser = null;
    currentHousehold = null;
    window.isInitialized = false; // Reset initialization flag
    window.isLoading = false; // Reset loading flag
    ingredients = { pantry: [], fridge: [], freezer: [] };
    recipes = [];
    shoppingList = [];
    mealPlan = {
      week1: {
        monday: [], tuesday: [], wednesday: [], thursday: [],
        friday: [], saturday: [], sunday: []
      },
      week2: {
        monday: [], tuesday: [], wednesday: [], thursday: [],
        friday: [], saturday: [], sunday: []
      }
    };
  }
}

// Show login form (hide signup)
function showLoginForm() {
  document.getElementById('login-form').style.display = 'block';
  document.getElementById('signup-form').style.display = 'none';
}

// Show signup form (hide login)
function showSignupForm() {
  document.getElementById('login-form').style.display = 'none';
  document.getElementById('signup-form').style.display = 'block';
}

// ==============================================
// HOUSEHOLD SHARING FUNCTIONS
// ==============================================

// Show invite modal
async function showInviteModal() {
  const modal = document.getElementById('invite-modal');
  const codeDisplay = document.getElementById('invite-code-display');

  modal.style.display = 'block';
  codeDisplay.textContent = 'Generating...';

  try {
    const code = await generateInviteCode();
    codeDisplay.textContent = code;
  } catch (error) {
    console.error('Error generating invite code:', error);
    codeDisplay.textContent = 'Error generating code';
    alert('Failed to generate invite code: ' + error.message);
  }
}

// Hide invite modal
function hideInviteModal() {
  document.getElementById('invite-modal').style.display = 'none';
}

// Copy invite code to clipboard
function copyInviteCode() {
  const code = document.getElementById('invite-code-display').textContent;
  navigator.clipboard.writeText(code).then(() => {
    alert('Invite code copied to clipboard!');
  });
}

// Show join household modal
function showJoinModal() {
  document.getElementById('join-modal').style.display = 'block';
  document.getElementById('join-code-input').value = '';
}

// Hide join household modal
function hideJoinModal() {
  document.getElementById('join-modal').style.display = 'none';
}

// Handle joining a household
async function handleJoinHousehold() {
  const code = document.getElementById('join-code-input').value.trim().toUpperCase();

  if (!code) {
    alert('Please enter an invite code');
    return;
  }

  try {
    await joinHousehold(code);
    hideJoinModal();
    alert('Successfully joined household! Reloading...');
    location.reload(); // Reload to refresh household data
  } catch (error) {
    console.error('Error joining household:', error);
    alert('Failed to join household: ' + error.message);
  }
}
