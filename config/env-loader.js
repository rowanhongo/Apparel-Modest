/**
 * Environment Variables Loader
 * 
 * This file loads environment variables from Netlify serverless function
 * Fetches configuration securely from /api/get-env-config
 */

// Global flag to track if config is loaded
window.ENV_CONFIG_LOADED = false;
window.ENV_CONFIG_PROMISE = null;

/**
 * Load all environment variables from Netlify function
 * This function fetches config from the serverless function and sets global variables
 * 
 * @returns {Promise<void>}
 */
async function loadEnvConfig() {
    // Return existing promise if already loading
    if (window.ENV_CONFIG_PROMISE) {
        return window.ENV_CONFIG_PROMISE;
    }

    // Create and store the promise
    window.ENV_CONFIG_PROMISE = (async () => {
        try {
            // Fetch environment variables from Netlify function
            const functionUrl = '/.netlify/functions/get-env-config';
            console.log('🔍 Fetching config from:', functionUrl);
            
            const response = await fetch(functionUrl);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Function response error:', response.status, errorText);
                throw new Error(`Failed to load config: ${response.status} - ${errorText}`);
            }
            
            const config = await response.json();
            console.log('📦 Received config from Netlify function:', config);
            console.log('📦 Full config object keys:', Object.keys(config));
            console.log('📦 Config values:', JSON.stringify(config, null, 2));
            
            // Set Supabase configuration
            window.SUPABASE_URL = config.supabaseUrl || '';
            window.SUPABASE_ANON_KEY = config.supabaseAnonKey || '';
            
            // Set Cloudinary configuration
            window.CLOUDINARY_CLOUD_NAME = config.cloudinaryCloudName || '';
            window.CLOUDINARY_API_KEY = config.cloudinaryApiKey || '';
            window.CLOUDINARY_UPLOAD_PRESET = config.cloudinaryUploadPreset || '';
            
            // Set EmailJS configuration
            window.EMAILJS_SERVICE_ID = config.emailjsServiceId || '';
            window.EMAILJS_TEMPLATE_ID = config.emailjsTemplateId || '';
            window.EMAILJS_PUBLIC_KEY = config.emailjsPublicKey || '';
            window.EMAILJS_WELCOME_TEMPLATE_ID = config.emailjsWelcomeTemplateId || '';
            
            // Mark as loaded
            window.ENV_CONFIG_LOADED = true;
            
            console.log('✅ Environment configuration loaded from Netlify');
            console.log('📍 Supabase URL:', config.supabaseUrl ? `Set ✓ (${config.supabaseUrl.substring(0, 30)}...)` : 'Missing ❌');
            console.log('🔑 Supabase Key:', config.supabaseAnonKey ? `Set ✓ (${config.supabaseAnonKey.substring(0, 20)}...)` : 'Missing ❌');
            console.log('☁️ Cloudinary:', config.cloudinaryCloudName ? `Set ✓ (${config.cloudinaryCloudName})` : 'Missing ❌');
            console.log('📧 EmailJS Service:', config.emailjsServiceId ? `Set ✓ (${config.emailjsServiceId})` : 'Missing ❌');
            
            // Debug logging for EmailJS Public Key
            if (config.emailjsPublicKey) {
                const keyPreview = config.emailjsPublicKey.substring(0, 10) + '...';
                console.log('📧 EmailJS Public Key: Set ✓', keyPreview);
                console.log('   📝 Note: This key was loaded from either EMAILJS_PUBLIC_KEY or API_keys_Public_Key in Netlify');
            } else {
                console.error('📧 EmailJS Public Key: Missing ❌');
                console.error('   ⚠️ Check Netlify environment variables for either:');
                console.error('      - EMAILJS_PUBLIC_KEY');
                console.error('      - API_keys_Public_Key');
            }
            
            // Dispatch event to notify other scripts
            window.dispatchEvent(new CustomEvent('envConfigLoaded', { detail: config }));
            
            return config;
        } catch (error) {
            console.error('❌ Error loading environment configuration:', error);
            console.warn('⚠️ Make sure environment variables are set in Netlify dashboard');
            window.ENV_CONFIG_LOADED = false;
            throw error;
        }
    })();

    return window.ENV_CONFIG_PROMISE;
}

/**
 * Wait for environment config to be loaded
 * @returns {Promise<void>}
 */
async function waitForEnvConfig() {
    if (window.ENV_CONFIG_LOADED) {
        return Promise.resolve();
    }
    
    if (window.ENV_CONFIG_PROMISE) {
        return window.ENV_CONFIG_PROMISE;
    }
    
    // If not started, start loading
    return loadEnvConfig();
}

// Make functions globally available
window.loadEnvConfig = loadEnvConfig;
window.waitForEnvConfig = waitForEnvConfig;

/**
 * Legacy function for backward compatibility
 * @param {string} supabaseUrl - Your Supabase project URL
 * @param {string} supabaseAnonKey - Your Supabase anonymous key
 */
function loadSupabaseConfig(supabaseUrl, supabaseAnonKey) {
    window.SUPABASE_URL = supabaseUrl;
    window.SUPABASE_ANON_KEY = supabaseAnonKey;
    console.log('✅ Supabase configuration loaded (legacy method)');
}

