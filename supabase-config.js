// Supabase configuration
const SUPABASE_URL = 'https://exojuwforrrtewccqjfu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4b2p1d2ZvcnJydGV3Y2NxamZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5NjYwNzcsImV4cCI6MjA4MjU0MjA3N30.ZE-vLmDg9y4FxLby3AEOGYyJcYLk0Tvazwl94CdzjUI';

// Debug: Check what's available
console.log('Window supabase object:', window.supabase);
console.log('Type:', typeof window.supabase);

// Initialize Supabase client
let supabase;

try {
  if (window.supabase && window.supabase.createClient) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('✅ Supabase client initialized successfully');

    // Auth state listener
    supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event);
      if (event === 'SIGNED_IN') {
        console.log('User signed in:', session.user.email);
      } else if (event === 'SIGNED_OUT') {
        console.log('User signed out');
        if (typeof showLoginScreen === 'function') {
          showLoginScreen();
        }
      }
    });
  } else {
    console.error('❌ Supabase library not loaded!');
    console.error('window.supabase =', window.supabase);
    alert('ERROR: Supabase library failed to load from CDN. Check your internet connection.');
  }
} catch (error) {
  console.error('❌ Error initializing Supabase:', error);
  alert('ERROR: ' + error.message);
}
