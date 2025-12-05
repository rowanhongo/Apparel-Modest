/**
 * OTP Service
 * Handles OTP generation, email sending, and verification
 * Uses EmailJS for email delivery
 */

class OTPService {
    constructor() {
        // OTP Configuration
        this.otpExpirationDays = 30; // OTP valid for 1 month
        this.otpLength = 6;
    }

    /**
     * Get EmailJS configuration from environment variables
     * @returns {Object} EmailJS config object
     */
    getEmailJSConfig() {
        return {
            serviceId: window.EMAILJS_SERVICE_ID || '',
            templateId: window.EMAILJS_TEMPLATE_ID || '',
            publicKey: window.EMAILJS_PUBLIC_KEY || ''
        };
    }

    /**
     * Initialize EmailJS
     * Call this once when the page loads
     */
    init() {
        // Check if EmailJS is loaded
        if (typeof emailjs === 'undefined') {
            console.error('❌ EmailJS library not loaded! Make sure you include the EmailJS CDN in your HTML.');
            return false;
        }

        // Get configuration from environment variables
        const config = this.getEmailJSConfig();
        if (!config.publicKey) {
            console.error('❌ EmailJS public key not found!');
            console.error('   Make sure one of these is set in Netlify environment variables:');
            console.error('   - EMAILJS_PUBLIC_KEY');
            console.error('   - API_keys_Public_Key');
            return false;
        }
        
        // Initialize EmailJS with public key
        emailjs.init(config.publicKey);
        console.log('✅ EmailJS initialized');
        return true;
    }

    /**
     * Generate a random 6-digit OTP code
     * @returns {string} 6-digit OTP code
     */
    generateOTP() {
        const min = 100000; // 6-digit minimum
        const max = 999999; // 6-digit maximum
        const otp = Math.floor(Math.random() * (max - min + 1)) + min;
        return otp.toString();
    }

    /**
     * Save OTP to database
     * @param {string} userId - User ID (UUID)
     * @param {string} email - User email
     * @param {string} otpCode - 6-digit OTP code
     * @param {string} purpose - Purpose: 'first_login', 'password_reset', 'login', 'email_verification'
     * @returns {Promise<Object|null>} OTP record or null if error
     */
    async saveOTPToDatabase(userId, email, otpCode, purpose = 'login') {
        try {
            const supabase = getSupabaseClient();
            if (!supabase) {
                throw new Error('Supabase client not initialized');
            }

            // Calculate expiration time (1 month from now)
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + this.otpExpirationDays);

            // Insert OTP into database
            const { data, error } = await supabase
                .from('otps')
                .insert([
                    {
                        user_id: userId,
                        email: email,
                        otp_code: otpCode,
                        purpose: purpose,
                        expires_at: expiresAt.toISOString(),
                        used: false
                    }
                ])
                .select()
                .single();

            if (error) {
                console.error('Error saving OTP to database:', error);
                return null;
            }

            console.log('✅ OTP saved to database');
            return data;
        } catch (error) {
            console.error('Error in saveOTPToDatabase:', error);
            return null;
        }
    }

    /**
     * Send OTP email via EmailJS
     * @param {string} userEmail - Recipient email address
     * @param {string} userName - User's name
     * @param {string} otpCode - 6-digit OTP code
     * @returns {Promise<boolean>} True if email sent successfully
     */
    async sendOTPEmail(userEmail, userName, otpCode) {
        try {
            // Check if EmailJS is loaded
            if (typeof emailjs === 'undefined') {
                throw new Error('EmailJS not loaded');
            }

            // Get EmailJS configuration from environment variables
            const config = this.getEmailJSConfig();
            if (!config.serviceId || !config.templateId) {
                throw new Error('EmailJS configuration not found. Check Netlify environment variables.');
            }
            
            // Ensure EmailJS is initialized with public key
            if (!config.publicKey) {
                throw new Error('EmailJS public key not found. Make sure EMAILJS_PUBLIC_KEY or API_keys_Public_Key is set in Netlify environment variables.');
            }
            
            // Initialize EmailJS if not already initialized
            // Check if emailjs has been initialized by checking if it has the send method
            // If init hasn't been called, the send method will fail
            try {
                // Try to initialize (safe to call multiple times)
                emailjs.init(config.publicKey);
            } catch (initError) {
                console.warn('⚠️ EmailJS init warning:', initError);
                // Continue anyway, might already be initialized
            }

            // Prepare email template parameters
            // Note: Variable names must match EXACTLY what's in your EmailJS template
            // Your template uses:
            // - {{user_name}} and {{otp_code}} in the content
            // - {{email}} in the "To Email" field (required!)
            const templateParams = {
                user_name: userName,
                otp_code: otpCode,
                email: userEmail  // This is required for the "To Email" field in your template!
            };

            console.log('📧 Sending email with params:', templateParams);

            // Send email via EmailJS
            const response = await emailjs.send(
                config.serviceId,
                config.templateId,
                templateParams
            );

            console.log('📧 EmailJS response:', response);

            if (response.status === 200) {
                console.log('✅ OTP email sent successfully');
                return true;
            } else {
                console.error('❌ EmailJS returned non-200 status:', response.status);
                return false;
            }
        } catch (error) {
            console.error('❌ Error sending OTP email:', error);
            console.error('❌ Error details:', {
                text: error.text,
                status: error.status,
                message: error.message
            });
            
            // More helpful error message
            if (error.text) {
                console.error('❌ EmailJS error text:', error.text);
            }
            
            return false;
        }
    }

    /**
     * Generate and send OTP (complete flow)
     * @param {string} userId - User ID (UUID)
     * @param {string} userEmail - User email
     * @param {string} userName - User's name
     * @param {string} purpose - Purpose: 'first_login', 'password_reset', 'login', 'email_verification'
     * @returns {Promise<Object>} { success: boolean, otpCode: string, message: string }
     */
    async generateAndSendOTP(userId, userEmail, userName, purpose = 'login') {
        try {
            // Generate OTP
            const otpCode = this.generateOTP();
            console.log(`Generated OTP for ${userEmail}: ${otpCode}`);

            // Save to database
            const savedOTP = await this.saveOTPToDatabase(userId, userEmail, otpCode, purpose);
            if (!savedOTP) {
                return {
                    success: false,
                    otpCode: null,
                    message: 'Failed to save OTP to database'
                };
            }

            // Send email
            const emailSent = await this.sendOTPEmail(userEmail, userName, otpCode);
            if (!emailSent) {
                return {
                    success: false,
                    otpCode: null,
                    message: 'Failed to send OTP email'
                };
            }

            return {
                success: true,
                otpCode: otpCode, // Only return for debugging, don't show to user
                message: 'OTP sent successfully'
            };
        } catch (error) {
            console.error('Error in generateAndSendOTP:', error);
            return {
                success: false,
                otpCode: null,
                message: error.message || 'Failed to generate and send OTP'
            };
        }
    }

    /**
     * Verify OTP code
     * @param {string} email - User email
     * @param {string} otpCode - OTP code to verify
     * @param {string} purpose - Purpose to verify against
     * @returns {Promise<Object>} { valid: boolean, message: string, otpRecord: Object|null }
     */
    async verifyOTP(email, otpCode, purpose = 'login') {
        try {
            const supabase = getSupabaseClient();
            if (!supabase) {
                throw new Error('Supabase client not initialized');
            }

            // For login OTPs, allow reuse (don't check used status)
            // For other purposes (password reset, etc.), only allow unused OTPs
            const isLoginOTP = purpose === 'login';
            
            let query = supabase
                .from('otps')
                .select('*')
                .eq('email', email)
                .eq('otp_code', otpCode)
                .eq('purpose', purpose)
                .gt('expires_at', new Date().toISOString())
                .order('created_at', { ascending: false })
                .limit(1);

            // Only filter by used=false for non-login OTPs
            if (!isLoginOTP) {
                query = query.eq('used', false);
            }

            const { data, error } = await query.single();

            if (error || !data) {
                return {
                    valid: false,
                    message: 'Invalid OTP code',
                    otpRecord: null
                };
            }

            // Check if OTP has expired (double check)
            const expiresAt = new Date(data.expires_at);
            const now = new Date();
            
            if (now > expiresAt) {
                return {
                    valid: false,
                    message: 'OTP code has expired',
                    otpRecord: data
                };
            }

            // For login OTPs: mark as used after first verification (but still allow reuse)
            // This tracks that the OTP has been verified at least once
            // For other OTPs: mark as used (single use)
            if (isLoginOTP) {
                // Mark as used to track first verification, but OTP can still be reused
                if (!data.used) {
                    await supabase
                        .from('otps')
                        .update({ used: true })
                        .eq('id', data.id);
                    // Update the data object to reflect the change
                    data.used = true;
                }
            } else {
                // Non-login OTPs: mark as used (single use)
            await supabase
                .from('otps')
                .update({ used: true })
                .eq('id', data.id);
            }

            return {
                valid: true,
                message: 'OTP verified successfully',
                otpRecord: data
            };
        } catch (error) {
            console.error('Error verifying OTP:', error);
            return {
                valid: false,
                message: error.message || 'Error verifying OTP',
                otpRecord: null
            };
        }
    }

    /**
     * Check if there's a valid OTP for an email
     * @param {string} email - User email
     * @param {string} purpose - Purpose to check
     * @param {boolean} requireVerified - If true, only return OTPs that have been verified at least once (for auto-login)
     * @returns {Promise<Object|null>} OTP record with remaining time or null
     */
    async getValidOTP(email, purpose = 'login', requireVerified = false) {
        try {
            const supabase = getSupabaseClient();
            if (!supabase) {
                return null;
            }

            // For login OTPs, allow used OTPs (they can be reused until expiration)
            // For other purposes, only allow unused OTPs
            const isLoginOTP = purpose === 'login';
            
            let query = supabase
                .from('otps')
                .select('*')
                .eq('email', email)
                .eq('purpose', purpose)
                .gt('expires_at', new Date().toISOString())
                .order('created_at', { ascending: false })
                .limit(1);

            // For login OTPs: if requireVerified is true, only return OTPs that have been verified (used=true)
            // This ensures newly sent OTPs must be entered first time
            if (isLoginOTP && requireVerified) {
                query = query.eq('used', true);
            } else if (!isLoginOTP) {
                // Non-login OTPs: only allow unused
                query = query.eq('used', false);
            }

            const { data, error } = await query.single();

            if (error || !data) {
                return null;
            }

            // Calculate remaining time
            const expiresAt = new Date(data.expires_at);
            const now = new Date();
            const remainingMs = expiresAt - now;
            const remainingDays = Math.floor(remainingMs / (1000 * 60 * 60 * 24));
            const remainingHours = Math.floor((remainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const remainingMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

            return {
                ...data,
                remainingDays,
                remainingHours,
                remainingMinutes,
                remainingMs
            };
        } catch (error) {
            console.error('Error getting valid OTP:', error);
            return null;
        }
    }

    /**
     * Format remaining time as human-readable string
     * @param {Object} otpRecord - OTP record with remaining time
     * @returns {string} Formatted time string
     */
    formatRemainingTime(otpRecord) {
        if (!otpRecord) return '';
        
        const { remainingDays, remainingHours, remainingMinutes } = otpRecord;
        
        if (remainingDays > 0) {
            return `${remainingDays} day${remainingDays !== 1 ? 's' : ''} and ${remainingHours} hour${remainingHours !== 1 ? 's' : ''}`;
        } else if (remainingHours > 0) {
            return `${remainingHours} hour${remainingHours !== 1 ? 's' : ''} and ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`;
        } else {
            return `${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`;
        }
    }

    /**
     * Clean up expired OTPs (optional - can be called periodically)
     * @returns {Promise<number>} Number of OTPs cleaned up
     */
    async cleanupExpiredOTPs() {
        try {
            const supabase = getSupabaseClient();
            if (!supabase) {
                return 0;
            }

            const now = new Date().toISOString();

            // Mark expired OTPs as used (soft delete)
            const { data, error } = await supabase
                .from('otps')
                .update({ used: true })
                .lt('expires_at', now)
                .eq('used', false)
                .select();

            if (error) {
                console.error('Error cleaning up expired OTPs:', error);
                return 0;
            }

            return data ? data.length : 0;
        } catch (error) {
            console.error('Error in cleanupExpiredOTPs:', error);
            return 0;
        }
    }
}

// Create global instance
const otpService = new OTPService();

