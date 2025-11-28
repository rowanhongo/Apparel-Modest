/**
 * Costs Service
 * Service for managing business costs and expenses
 */

class CostsService {
    constructor() {
        this.costs = [];
        this.supabase = null;
    }

    /**
     * Initialize the costs service
     */
    async init() {
        // Get Supabase client
        this.supabase = getSupabaseClient();
        if (!this.supabase) {
            console.error('❌ Supabase client not available');
            return;
        }
    }

    /**
     * Fetch total costs for current month
     * @returns {Promise<number>} Total costs amount
     */
    async fetchMonthlyCosts() {
        try {
            // Get current month start and end
            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
            const monthStartStr = monthStart.toISOString().split('T')[0];
            const monthEndStr = monthEnd.toISOString().split('T')[0];

            // Fetch costs from this month
            const { data: costs, error } = await this.supabase
                .from('costs')
                .select('amount')
                .gte('cost_date', monthStartStr)
                .lte('cost_date', monthEndStr);

            if (error) {
                console.error('Error fetching monthly costs:', error);
                return 0;
            }

            // Calculate total
            const total = (costs || []).reduce((sum, cost) => {
                return sum + (parseFloat(cost.amount) || 0);
            }, 0);

            return total;
        } catch (error) {
            console.error('Error in fetchMonthlyCosts:', error);
            return 0;
        }
    }

    /**
     * Fetch costs for analytics table
     * @param {Object} options - Filter and sort options
     * @returns {Promise<Array>} Array of cost objects
     */
    async fetchCostsForTable(options = {}) {
        try {
            const {
                search = '',
                sortBy = 'created_at',
                sortOrder = 'desc',
                dateFilter = null,
                amountFilter = null,
                limit = 10
            } = options;

            // Get current month start and end
            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
            const monthStartStr = monthStart.toISOString().split('T')[0];
            const monthEndStr = monthEnd.toISOString().split('T')[0];

            // Build query
            let query = this.supabase
                .from('costs')
                .select('*')
                .gte('cost_date', monthStartStr)
                .lte('cost_date', monthEndStr);

            // Apply search filter
            if (search) {
                query = query.ilike('name', `%${search}%`);
            }

            // Apply date filter
            if (dateFilter) {
                query = query.eq('cost_date', dateFilter);
            }

            // Apply amount filter
            if (amountFilter) {
                query = query.eq('amount', parseFloat(amountFilter));
            }

            // Apply sorting
            query = query.order(sortBy, { ascending: sortOrder === 'asc' });

            // Apply limit
            query = query.limit(limit);

            const { data: costs, error } = await query;

            if (error) {
                console.error('Error fetching costs for table:', error);
                return [];
            }

            return costs || [];
        } catch (error) {
            console.error('Error in fetchCostsForTable:', error);
            return [];
        }
    }

    /**
     * Add a new cost
     * @param {Object} costData - Cost data object
     * @returns {Promise<Object>} Result object with success status
     */
    async addCost(costData) {
        try {
            const { name, amount, cost_date } = costData;

            // Validate inputs
            if (!name || !amount || !cost_date) {
                return {
                    success: false,
                    message: 'Please fill in all required fields'
                };
            }

            // Insert cost
            const { data, error } = await this.supabase
                .from('costs')
                .insert([
                    {
                        name: name.trim(),
                        amount: parseFloat(amount),
                        cost_date: cost_date
                    }
                ])
                .select()
                .single();

            if (error) {
                console.error('Error adding cost:', error);
                return {
                    success: false,
                    message: error.message || 'Failed to add cost'
                };
            }

            return {
                success: true,
                message: 'Cost added successfully',
                data: data
            };
        } catch (error) {
            console.error('Error in addCost:', error);
            return {
                success: false,
                message: 'An error occurred while adding cost'
            };
        }
    }

    /**
     * Delete a cost
     * @param {string} costId - Cost ID
     * @returns {Promise<Object>} Result object with success status
     */
    async deleteCost(costId) {
        try {
            const { error } = await this.supabase
                .from('costs')
                .delete()
                .eq('id', costId);

            if (error) {
                console.error('Error deleting cost:', error);
                return {
                    success: false,
                    message: error.message || 'Failed to delete cost'
                };
            }

            return {
                success: true,
                message: 'Cost deleted successfully'
            };
        } catch (error) {
            console.error('Error in deleteCost:', error);
            return {
                success: false,
                message: 'An error occurred while deleting cost'
            };
        }
    }
}

// Create global instance
const costsService = new CostsService();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CostsService;
}

