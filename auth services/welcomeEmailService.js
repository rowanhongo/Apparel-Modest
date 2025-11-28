/**
 * Welcome Email Service
 * Sends welcome emails to new staff members when admin adds them
 */

class WelcomeEmailService {
    constructor() {
        // No hardcoded values - will be loaded from environment variables
    }

    /**
     * Get EmailJS configuration from environment variables
     * @returns {Object} EmailJS config object
     */
    getEmailJSConfig() {
        return {
            serviceId: window.EMAILJS_SERVICE_ID || '',
            templateId: window.EMAILJS_WELCOME_TEMPLATE_ID || '',
            publicKey: window.EMAILJS_PUBLIC_KEY || ''
        };
    }

    /**
     * Initialize EmailJS
     */
    init() {
        if (typeof emailjs === 'undefined') {
            console.error('❌ EmailJS library not loaded!');
            return false;
        }

        // Get configuration from environment variables
        const config = this.getEmailJSConfig();
        if (!config.publicKey) {
            console.error('❌ EmailJS public key not found! Make sure EMAILJS_PUBLIC_KEY is set in Netlify environment variables.');
            return false;
        }

        emailjs.init(config.publicKey);
        return true;
    }

    /**
     * Send welcome email to new staff member
     * @param {string} userEmail - Staff member's email
     * @param {string} userName - Staff member's name
     * @param {string} userRole - Staff member's role
     * @returns {Promise<Object>} { success: boolean, message: string }
     */
    async sendWelcomeEmail(userEmail, userName, userRole) {
        try {
            if (typeof emailjs === 'undefined') {
                throw new Error('EmailJS not loaded');
            }

            // Get EmailJS configuration from environment variables
            const config = this.getEmailJSConfig();
            if (!config.serviceId || !config.templateId) {
                throw new Error('EmailJS configuration not found. Check Netlify environment variables.');
            }

            // Prepare email template parameters
            const templateParams = {
                user_name: userName,
                user_role: userRole,
                email: userEmail,
                login_url: window.location.origin + '/dashboard.html' // Link to login page
            };

            // Send email via EmailJS
            const response = await emailjs.send(
                config.serviceId,
                config.templateId,
                templateParams
            );

            if (response.status === 200) {
                console.log('✅ Welcome email sent successfully');
                return {
                    success: true,
                    message: 'Welcome email sent successfully'
                };
            } else {
                return {
                    success: false,
                    message: 'Failed to send welcome email'
                };
            }
        } catch (error) {
            console.error('❌ Error sending welcome email:', error);
            return {
                success: false,
                message: error.text || error.message || 'Failed to send welcome email'
            };
        }
    }
}

// Create global instance
const welcomeEmailService = new WelcomeEmailService();


