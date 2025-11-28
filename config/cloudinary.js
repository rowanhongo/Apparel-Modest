/**
 * Cloudinary Configuration
 * This file sets up the connection to Cloudinary for image uploads
 * 
 * IMPORTANT: Make sure your credentials are set:
 * - CLOUDINARY_CLOUD_NAME=your-cloud-name
 * - CLOUDINARY_API_KEY=your-api-key
 * - CLOUDINARY_UPLOAD_PRESET=your-upload-preset (for unsigned uploads)
 */

// Check if we're in a browser environment
if (typeof window !== 'undefined') {
    // Browser environment - credentials loaded from inline script in HTML
    window.CLOUDINARY_CONFIG = window.CLOUDINARY_CONFIG || {
        cloudName: '',
        apiKey: '',
        uploadPreset: ''
    };
}

/**
 * Initialize Cloudinary Configuration
 * @param {string} cloudName - Your Cloudinary cloud name
 * @param {string} apiKey - Your Cloudinary API key
 * @param {string} uploadPreset - Your upload preset (for unsigned uploads)
 * @returns {Object} Cloudinary config object
 */
function initCloudinary(cloudName, apiKey, uploadPreset = '') {
    if (!cloudName || !apiKey) {
        console.error('❌ Missing Cloudinary credentials!');
        return null;
    }

    const config = {
        cloudName: cloudName,
        apiKey: apiKey,
        uploadPreset: uploadPreset,
        apiUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`
    };

    console.log('✅ Cloudinary configuration initialized successfully!');
    return config;
}

/**
 * Get Cloudinary Config Instance
 * This is the main function you'll use in your services
 * 
 * Usage:
 * const cloudinaryConfig = getCloudinaryConfig();
 */
function getCloudinaryConfig() {
    if (typeof window === 'undefined') {
        console.error('❌ Cloudinary config only works in browser environment');
        return null;
    }

    const cloudName = window.CLOUDINARY_CLOUD_NAME || window.CLOUDINARY_CONFIG?.cloudName;
    const apiKey = window.CLOUDINARY_API_KEY || window.CLOUDINARY_CONFIG?.apiKey;
    const uploadPreset = window.CLOUDINARY_UPLOAD_PRESET || window.CLOUDINARY_CONFIG?.uploadPreset;

    if (!cloudName || !apiKey) {
        console.error('❌ Cloudinary credentials not set!');
        return null;
    }

    return {
        cloudName: cloudName,
        apiKey: apiKey,
        uploadPreset: uploadPreset,
        apiUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`
    };
}

