// Supabase configuration
const SUPABASE_URL = 'https://exojuwforrrtewccqjfu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4b2p1d2ZvcnJydGV3Y2NxamZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5NjYwNzcsImV4cCI6MjA4MjU0MjA3N30.ZE-vLmDg9y4FxLby3AEOGYyJcYLk0Tvazwl94CdzjUI';

// Debug: Check what's available
console.log('Window supabase library:', typeof window.supabase);

// Initialize Supabase client using window property to avoid conflicts
window.supabaseClient = null;

try {
  if (window.supabase && window.supabase.createClient) {
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Also create global alias for backwards compatibility
    window.supabase = window.supabaseClient;

    console.log('✅ Supabase client initialized successfully');

    // Auth state listener
    window.supabaseClient.auth.onAuthStateChange(async (event, session) => {
      console.log('🔔 Auth state changed:', event);
      if (event === 'SIGNED_IN') {
        console.log('✅ User signed in:', session?.user?.email);
        console.log('🔍 Checking for initializeApp...', typeof window.initializeApp);
        // Initialize app when user successfully signs in
        if (typeof window.initializeApp === 'function') {
          console.log('📱 Calling initializeApp()...');
          try {
            await window.initializeApp();
            console.log('✅ initializeApp() completed');
          } catch (error) {
            console.error('❌ Error in initializeApp:', error);
          }
        } else {
          console.warn('⚠️ initializeApp is not available yet');
        }
      } else if (event === 'SIGNED_OUT') {
        console.log('👋 User signed out');
        if (typeof showLoginScreen === 'function') {
          showLoginScreen();
        }
      }
    });
  } else {
    console.error('❌ Supabase library not loaded from CDN!');
    console.error('window.supabase =', window.supabase);
    alert('ERROR: Supabase library failed to load. Please refresh the page or check your internet connection.');
  }
} catch (error) {
  console.error('❌ Error initializing Supabase:', error);
  alert('ERROR: ' + error.message);
}

// Make supabase globally available for other scripts
var supabase = window.supabaseClient;
