/**
 * Staff Management Service
 * Handles adding staff members, sending welcome emails, and managing staff
 */

class StaffManagementService {
    constructor() {
        this.currentAdmin = null;
    }

    /**
     * Initialize the service
     */
    init() {
        // Initialize welcome email service
        if (typeof welcomeEmailService !== 'undefined') {
            welcomeEmailService.init();
        }
    }

    /**
     * Validate staff member data before saving
     * @param {Object} staffData - Staff member data to validate
     * @returns {Object} { valid: boolean, errors: Array }
     */
    validateStaffData(staffData) {
        const errors = [];

        // Validate name
        if (!staffData.name || staffData.name.trim().length < 2) {
            errors.push('Name must be at least 2 characters');
        }

        // Validate email
        if (!staffData.email) {
            errors.push('Email is required');
        } else {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(staffData.email)) {
                errors.push('Please enter a valid email address');
            }
        }

        // Validate role
        const validRoles = ['sales', 'production', 'logistics', 'instore', 'admin'];
        if (!staffData.role || !validRoles.includes(staffData.role.toLowerCase())) {
            errors.push('Please select a valid role');
        }

        // Phone is optional, but if provided, should be valid format
        if (staffData.phone && staffData.phone.trim().length > 0) {
            // Basic phone validation (numbers and +)
            const phoneRegex = /^[\d\s\+\-\(\)]+$/;
            if (!phoneRegex.test(staffData.phone)) {
                errors.push('Please enter a valid phone number');
            }
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Check if email already exists in database
     * @param {string} email - Email to check
     * @returns {Promise<boolean>} True if email exists
     */
    async checkEmailExists(email) {
        try {
            const supabase = getSupabaseClient();
            if (!supabase) {
                throw new Error('Supabase client not initialized');
            }

            const { data, error } = await supabase
                .from('users')
                .select('id')
                .eq('email', email.toLowerCase().trim())
                .single();

            // If data exists, email is taken
            return data !== null;
        } catch (error) {
            // If error is "not found", email doesn't exist (good!)
            if (error.code === 'PGRST116') {
                return false;
            }
            console.error('Error checking email:', error);
            return false;
        }
    }

    /**
     * Add new staff member to database
     * @param {Object} staffData - Staff member data
     * @param {string} adminId - ID of admin adding the staff
     * @returns {Promise<Object>} { success: boolean, user: Object|null, message: string }
     */
    async addStaffMember(staffData, adminId) {
        try {
            // Validate data
            const validation = this.validateStaffData(staffData);
            if (!validation.valid) {
                return {
                    success: false,
                    user: null,
                    message: validation.errors.join(', ')
                };
            }

            // Check if email already exists
            const emailExists = await this.checkEmailExists(staffData.email);
            if (emailExists) {
                return {
                    success: false,
                    user: null,
                    message: 'This email is already registered'
                };
            }

            const supabase = getSupabaseClient();
            if (!supabase) {
                throw new Error('Supabase client not initialized');
            }

            // Prepare user data
            const userData = {
                name: staffData.name.trim(),
                email: staffData.email.toLowerCase().trim(),
                role: staffData.role.toLowerCase(),
                phone: staffData.phone ? staffData.phone.trim() : null,
                status: 'active',
                email_verified: false,
                orders_completed: 0,
                avg_response_time: 0,
                created_by: adminId
            };

            // Insert into database
            const { data, error } = await supabase
                .from('users')
                .insert([userData])
                .select()
                .single();

            if (error) {
                console.error('Error adding staff member:', error);
                return {
                    success: false,
                    user: null,
                    message: error.message || 'Failed to add staff member'
                };
            }

            // Send welcome email
            const emailResult = await welcomeEmailService.sendWelcomeEmail(
                data.email,
                data.name,
                data.role
            );

            if (!emailResult.success) {
                console.warn('Staff added but welcome email failed:', emailResult.message);
                // Still return success since staff was added
            }

            return {
                success: true,
                user: data,
                message: emailResult.success 
                    ? 'Staff member added and welcome email sent!' 
                    : 'Staff member added, but welcome email failed to send'
            };
        } catch (error) {
            console.error('Error in addStaffMember:', error);
            return {
                success: false,
                user: null,
                message: error.message || 'An error occurred while adding staff member'
            };
        }
    }

    /**
     * Fetch all staff members from database
     * @returns {Promise<Array>} Array of staff members
     */
    async fetchAllStaff() {
        try {
            const supabase = getSupabaseClient();
            if (!supabase) {
                throw new Error('Supabase client not initialized');
            }

            const { data, error } = await supabase
                .from('users')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching staff:', error);
                return [];
            }

            return data || [];
        } catch (error) {
            console.error('Error in fetchAllStaff:', error);
            return [];
        }
    }

    /**
     * Update staff member status
     * @param {string} userId - User ID
     * @param {string} status - New status ('active' or 'inactive')
     * @returns {Promise<Object>} { success: boolean, message: string }
     */
    async updateStaffStatus(userId, status) {
        try {
            const supabase = getSupabaseClient();
            if (!supabase) {
                throw new Error('Supabase client not initialized');
            }

            const { error } = await supabase
                .from('users')
                .update({ status: status })
                .eq('id', userId);

            if (error) {
                return {
                    success: false,
                    message: error.message || 'Failed to update status'
                };
            }

            return {
                success: true,
                message: `Staff member ${status === 'active' ? 'activated' : 'deactivated'} successfully`
            };
        } catch (error) {
            console.error('Error updating staff status:', error);
            return {
                success: false,
                message: error.message || 'An error occurred'
            };
        }
    }

    /**
     * Delete staff member from database
     * @param {string} userId - User ID to delete
     * @returns {Promise<Object>} { success: boolean, message: string }
     */
    async deleteStaffMember(userId) {
        try {
            const supabase = getSupabaseClient();
            if (!supabase) {
                throw new Error('Supabase client not initialized');
            }

            // Check if user has any orders assigned (optional - you might want to prevent deletion if they have active orders)
            const { data: ordersData, error: ordersError } = await supabase
                .from('orders')
                .select('id')
                .eq('assigned_to', userId)
                .limit(1);

            if (ordersError) {
                console.warn('Error checking orders:', ordersError);
            }

            // Delete the user
            const { error } = await supabase
                .from('users')
                .delete()
                .eq('id', userId);

            if (error) {
                console.error('Error deleting staff member:', error);
                return {
                    success: false,
                    message: error.message || 'Failed to delete staff member'
                };
            }

            return {
                success: true,
                message: 'Staff member deleted successfully'
            };
        } catch (error) {
            console.error('Error in deleteStaffMember:', error);
            return {
                success: false,
                message: error.message || 'An error occurred while deleting staff member'
            };
        }
    }
}

// Create global instance
const staffManagementService = new StaffManagementService();


