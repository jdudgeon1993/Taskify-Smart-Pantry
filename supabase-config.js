// Supabase configuration
const SUPABASE_URL = 'https://exojuwforrrtewccqjfu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4b2p1d2ZvcnJydGV3Y2NxamZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5NjYwNzcsImV4cCI6MjA4MjU0MjA3N30.ZE-vLmDg9y4FxLby3AEOGYyJcYLk0Tvazwl94CdzjUI';

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Auth state listener
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    console.log('User signed in:', session.user);
    initializeApp();
  } else if (event === 'SIGNED_OUT') {
    console.log('User signed out');
    showLoginScreen();
  }
});
