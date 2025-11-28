/**
 * Authentication Service
 * Handles user authentication, login, and session management
 * Uses JWT tokens for session management
 */

class AuthService {
    constructor() {
        this.currentUser = null;
        this.tokenKey = 'apparel_modest_token';
        this.userKey = 'apparel_modest_user';
    }

    /**
     * Initialize authentication service
     */
    init() {
        // Load user from localStorage if exists
        this.loadUserFromStorage();
        
        // Initialize OTP service
        if (typeof otpService !== 'undefined') {
            otpService.init();
        }
    }

    /**
     * Find user by email
     * @param {string} email - User email
     * @returns {Promise<Object|null>} User object or null
     */
    async findUserByEmail(email) {
        try {
            const supabase = getSupabaseClient();
            if (!supabase) {
                throw new Error('Supabase client not initialized');
            }

            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('email', email.toLowerCase().trim())
                .eq('status', 'active')
                .single();

            if (error || !data) {
                return null;
            }

            return data;
        } catch (error) {
            console.error('Error finding user:', error);
            return null;
        }
    }

    /**
     * Request OTP for login
     * @param {string} email - User email
     * @returns {Promise<Object>} { success: boolean, message: string }
     */
    async requestOTP(email) {
        try {
            // Find user
            const user = await this.findUserByEmail(email);
            if (!user) {
                return {
                    success: false,
                    message: 'No account found with this email. Please contact admin.'
                };
            }

            // Generate and send OTP
            const result = await otpService.generateAndSendOTP(
                user.id,
                user.email,
                user.name,
                'login'
            );

            if (result.success) {
                return {
                    success: true,
                    message: 'OTP sent to your email. Please check your inbox.'
                };
            } else {
                return {
                    success: false,
                    message: result.message || 'Failed to send OTP'
                };
            }
        } catch (error) {
            console.error('Error requesting OTP:', error);
            return {
                success: false,
                message: 'An error occurred. Please try again.'
            };
        }
    }

    /**
     * Verify OTP and login
     * @param {string} email - User email
     * @param {string} otpCode - OTP code
     * @returns {Promise<Object>} { success: boolean, user: Object|null, token: string|null, message: string }
     */
    async verifyOTPAndLogin(email, otpCode) {
        try {
            // Find user
            const user = await this.findUserByEmail(email);
            if (!user) {
                return {
                    success: false,
                    user: null,
                    token: null,
                    message: 'User not found'
                };
            }

            // Verify OTP
            const verification = await otpService.verifyOTP(email, otpCode, 'login');
            if (!verification.valid) {
                return {
                    success: false,
                    user: null,
                    token: null,
                    message: verification.message
                };
            }

            // Update last login
            await this.updateLastLogin(user.id);

            // Create JWT token (we'll implement this next)
            const token = this.createJWTToken(user);

            // Save user and token
            this.saveUserToStorage(user, token);

            return {
                success: true,
                user: user,
                token: token,
                message: 'Login successful'
            };
        } catch (error) {
            console.error('Error verifying OTP and logging in:', error);
            return {
                success: false,
                user: null,
                token: null,
                message: 'An error occurred during login'
            };
        }
    }

    /**
     * Update user's last login timestamp
     * @param {string} userId - User ID
     */
    async updateLastLogin(userId) {
        try {
            const supabase = getSupabaseClient();
            if (!supabase) return;

            await supabase
                .from('users')
                .update({ last_login: new Date().toISOString() })
                .eq('id', userId);
        } catch (error) {
            console.error('Error updating last login:', error);
        }
    }

    /**
     * Create JWT token (simple implementation)
     * Note: For production, use a proper JWT library
     * @param {Object} user - User object
     * @returns {string} JWT token
     */
    createJWTToken(user) {
        // Simple token structure (we'll use a proper JWT library later)
        const payload = {
            userId: user.id,
            email: user.email,
            role: user.role,
            name: user.name,
            iat: Math.floor(Date.now() / 1000), // Issued at
            exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // Expires in 24 hours
        };

        // For now, we'll use a simple base64 encoding
        // TODO: Replace with proper JWT library (jsonwebtoken or jose)
        const token = btoa(JSON.stringify(payload));
        return token;
    }

    /**
     * Verify JWT token
     * @param {string} token - JWT token
     * @returns {Object|null} Decoded token or null if invalid
     */
    verifyJWTToken(token) {
        try {
            const payload = JSON.parse(atob(token));
            
            // Check expiration
            const now = Math.floor(Date.now() / 1000);
            if (payload.exp && payload.exp < now) {
                return null; // Token expired
            }

            return payload;
        } catch (error) {
            return null; // Invalid token
        }
    }

    /**
     * Save user and token to localStorage
     * @param {Object} user - User object
     * @param {string} token - JWT token
     */
    saveUserToStorage(user, token) {
        try {
            localStorage.setItem(this.tokenKey, token);
            localStorage.setItem(this.userKey, JSON.stringify(user));
            this.currentUser = user;
        } catch (error) {
            console.error('Error saving user to storage:', error);
        }
    }

    /**
     * Load user from localStorage
     * @returns {Object|null} User object or null
     */
    loadUserFromStorage() {
        try {
            const token = localStorage.getItem(this.tokenKey);
            const userStr = localStorage.getItem(this.userKey);

            if (!token || !userStr) {
                return null;
            }

            // Verify token
            const payload = this.verifyJWTToken(token);
            if (!payload) {
                // Token expired or invalid, clear storage
                this.logout();
                return null;
            }

            const user = JSON.parse(userStr);
            this.currentUser = user;
            return user;
        } catch (error) {
            console.error('Error loading user from storage:', error);
            this.logout();
            return null;
        }
    }

    /**
     * Check if user is logged in
     * @returns {boolean}
     */
    isLoggedIn() {
        const user = this.loadUserFromStorage();
        return user !== null;
    }

    /**
     * Get current user
     * @returns {Object|null}
     */
    getCurrentUser() {
        if (!this.currentUser) {
            this.currentUser = this.loadUserFromStorage();
        }
        return this.currentUser;
    }

    /**
     * Logout user
     */
    logout() {
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.userKey);
        this.currentUser = null;
    }

    /**
     * Check if user has specific role
     * @param {string} role - Role to check
     * @returns {boolean}
     */
    hasRole(role) {
        const user = this.getCurrentUser();
        return user && user.role === role;
    }

    /**
     * Check if user is admin
     * @returns {boolean}
     */
    isAdmin() {
        return this.hasRole('admin');
    }
}

// Create global instance
const authService = new AuthService();


