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

// Get current user
async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// Get user's household
async function getUserHousehold() {
  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('household_members')
    .select('household_id, households(*)')
    .eq('user_id', user.id)
    .single();

  if (error) {
    console.error('Error fetching household:', error);
    return null;
  }

  return data.households;
}
