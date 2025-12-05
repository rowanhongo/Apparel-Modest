/**
 * Supabase Configuration
 * This file sets up the connection to your Supabase database
 * 
 * IMPORTANT: Make sure your .env file has:
 * - SUPABASE_URL=your-project-url
 * - SUPABASE_ANON_KEY=your-anon-key
 */

// Load environment variables from .env file
// Note: In browser, we'll need to load these differently
// For now, we'll use a simple approach

// Check if we're in a browser environment
if (typeof window !== 'undefined') {
    // Browser environment - we'll load from a separate config file
    // or use inline script tags in HTML
    
    // This will be set by loading env.js or inline script
    window.SUPABASE_CONFIG = window.SUPABASE_CONFIG || {
        url: '',
        anonKey: ''
    };
}

/**
 * Initialize Supabase Client
 * This function creates and returns a Supabase client instance
 * 
 * @param {string} supabaseUrl - Your Supabase project URL
 * @param {string} supabaseAnonKey - Your Supabase anonymous key
 * @returns {Object} Supabase client instance
 */
function initSupabase(supabaseUrl, supabaseAnonKey) {
    // Check if Supabase library is loaded
    if (typeof supabase === 'undefined') {
        console.error('❌ Supabase library not loaded! Make sure you include the Supabase CDN in your HTML.');
        return null;
    }

    // Validate inputs
    if (!supabaseUrl || !supabaseAnonKey) {
        console.error('❌ Missing Supabase credentials! Check your .env file.');
        return null;
    }

    // Create and return Supabase client
    try {
        const supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);
        return supabaseClient;
    } catch (error) {
        console.error('❌ Error initializing Supabase:', error);
        return null;
    }
}

/**
 * Get Supabase Client Instance
 * This is the main function you'll use in your services
 * 
 * Usage in your services:
 * const supabase = getSupabaseClient();
 * const { data, error } = await supabase.from('orders').select('*');
 */
let supabaseClientInstance = null;

function getSupabaseClient() {
    // If already initialized, return the instance
    if (supabaseClientInstance) {
        return supabaseClientInstance;
    }

    // Try to get credentials from window object (set by HTML script or env-loader)
    const supabaseUrl = window.SUPABASE_URL || '';
    const supabaseAnonKey = window.SUPABASE_ANON_KEY || '';

    // Initialize if we have credentials
    if (supabaseUrl && supabaseAnonKey) {
        supabaseClientInstance = initSupabase(supabaseUrl, supabaseAnonKey);
        return supabaseClientInstance;
    }

    // Provide detailed error message
    console.error('❌ Supabase credentials not found!');
    console.error('   SUPABASE_URL:', supabaseUrl ? `Set ✓ (${supabaseUrl.substring(0, 30)}...)` : 'Missing ❌');
    console.error('   SUPABASE_ANON_KEY:', supabaseAnonKey ? `Set ✓ (${supabaseAnonKey.substring(0, 20)}...)` : 'Missing ❌');
    console.error('   Make sure:');
    console.error('   1. Environment variables are loaded (check env-loader.js)');
    console.error('   2. Netlify function returns SUPABASE_URL and SUPABASE_ANON_KEY');
    console.error('   3. Wait for env config to load before calling getSupabaseClient()');
    return null;
}

// Export for use in other files (if using modules)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { initSupabase, getSupabaseClient };
}

