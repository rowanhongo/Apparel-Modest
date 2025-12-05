/**
 * Netlify Serverless Function
 * Returns environment variables to the frontend
 * Only returns non-sensitive public keys (anon keys are safe to expose)
 */

exports.handler = async (event, context) => {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Debug: Log available environment variable names (not values for security)
  const envKeys = Object.keys(process.env).filter(key => 
    key.includes('SUPABASE') || 
    key.includes('CLOUDINARY') || 
    key.includes('EMAILJS') || 
    key.includes('MAPBOX') ||
    key.includes('PAYSTACK') ||
    key.includes('LIVE_') ||
    key.includes('API_keys') ||
    key.includes('Welcome') ||
    key.includes('One_Time')
  );
  console.log('Available env keys:', envKeys);

  // Get environment variables
  // Note: These are public keys (anon keys) that are safe to expose in the browser
  // Map both expected names and alternative names the user might have set
  
  const config = {
    // Supabase - check both names
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
    
    // Cloudinary - map CLOUDINARY_ID to CLOUDINARY_CLOUD_NAME
    cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_ID || '',
    cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || '',
    cloudinaryUploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET || '',
    
    // EmailJS - map alternative names with debug logging
    emailjsServiceId: process.env.EMAILJS_SERVICE_ID || '',
    emailjsTemplateId: process.env.EMAILJS_TEMPLATE_ID || process.env.One_Time_Password_Template_ID || '',
    emailjsPublicKey: (() => {
      // Check which EmailJS public key variable is available
      if (process.env.EMAILJS_PUBLIC_KEY) {
        console.log('✅ EmailJS Public Key found: Using EMAILJS_PUBLIC_KEY');
        return process.env.EMAILJS_PUBLIC_KEY;
      } else if (process.env.API_keys_Public_Key) {
        console.log('✅ EmailJS Public Key found: Using API_keys_Public_Key');
        return process.env.API_keys_Public_Key;
      } else {
        console.warn('⚠️ EmailJS Public Key NOT FOUND: Checked EMAILJS_PUBLIC_KEY and API_keys_Public_Key');
        return '';
      }
    })(),
    emailjsWelcomeTemplateId: process.env.EMAILJS_WELCOME_TEMPLATE_ID || process.env.Welcome_Template_ID || '',
    
    // Mapbox - for geocoding and map tiles
    mapboxAccessToken: process.env.MAPBOX_ACCESS_TOKEN || '',
    
    // Paystack - live public key (public key is safe to expose in frontend)
    // Note: LIVE_SECRET_KEY should NEVER be exposed in frontend - only use on backend
    paystackPublicKey: process.env.LIVE_PUBLIC_KEY || ''
  };

  // Log which values are set (for debugging in Netlify logs)
  const setValues = Object.entries(config)
    .filter(([key, value]) => value)
    .map(([key]) => key);
  console.log('Config values set:', setValues);
  console.log('Missing values:', Object.entries(config)
    .filter(([key, value]) => !value)
    .map(([key]) => key));

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*', // Allow CORS for frontend
      'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
    },
    body: JSON.stringify(config)
  };
};

