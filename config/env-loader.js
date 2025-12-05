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
            
            const response = await fetch(functionUrl);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Function response error:', response.status, errorText);
                throw new Error(`Failed to load config: ${response.status} - ${errorText}`);
            }
            
            const config = await response.json();
            
            // Helper function to sanitize values (remove trailing commas and whitespace)
            const sanitizeValue = (value) => {
                if (!value || typeof value !== 'string') return value || '';
                return value.trim().replace(/,$/, '');
            };
            
            // Sanitize all config values to remove trailing commas and whitespace
            const sanitizedConfig = {
                supabaseUrl: sanitizeValue(config.supabaseUrl),
                supabaseAnonKey: sanitizeValue(config.supabaseAnonKey),
                cloudinaryCloudName: sanitizeValue(config.cloudinaryCloudName),
                cloudinaryApiKey: sanitizeValue(config.cloudinaryApiKey),
                cloudinaryUploadPreset: sanitizeValue(config.cloudinaryUploadPreset),
                emailjsServiceId: sanitizeValue(config.emailjsServiceId),
                emailjsTemplateId: sanitizeValue(config.emailjsTemplateId),
                emailjsPublicKey: sanitizeValue(config.emailjsPublicKey),
                emailjsWelcomeTemplateId: sanitizeValue(config.emailjsWelcomeTemplateId),
                mapboxAccessToken: sanitizeValue(config.mapboxAccessToken),
                paystackPublicKey: sanitizeValue(config.paystackPublicKey)
            };
            
            // Set Supabase configuration
            window.SUPABASE_URL = sanitizedConfig.supabaseUrl;
            window.SUPABASE_ANON_KEY = sanitizedConfig.supabaseAnonKey;
            
            // Set Cloudinary configuration
            window.CLOUDINARY_CLOUD_NAME = sanitizedConfig.cloudinaryCloudName;
            window.CLOUDINARY_API_KEY = sanitizedConfig.cloudinaryApiKey;
            window.CLOUDINARY_UPLOAD_PRESET = sanitizedConfig.cloudinaryUploadPreset;
            
            // Set EmailJS configuration
            window.EMAILJS_SERVICE_ID = sanitizedConfig.emailjsServiceId;
            window.EMAILJS_TEMPLATE_ID = sanitizedConfig.emailjsTemplateId;
            window.EMAILJS_PUBLIC_KEY = sanitizedConfig.emailjsPublicKey;
            window.EMAILJS_WELCOME_TEMPLATE_ID = sanitizedConfig.emailjsWelcomeTemplateId;
            
            // Set Mapbox configuration
            window.MAPBOX_ACCESS_TOKEN = sanitizedConfig.mapboxAccessToken;
            
            // Set Paystack configuration (public key only - safe to expose)
            window.PAYSTACK_PUBLIC_KEY = sanitizedConfig.paystackPublicKey;
            
            // Mark as loaded
            window.ENV_CONFIG_LOADED = true;
            
            // Dispatch event to notify other scripts (using sanitized config)
            window.dispatchEvent(new CustomEvent('envConfigLoaded', { detail: sanitizedConfig }));
            
            return sanitizedConfig;
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

