/**
 * After Sales Service
 * Service for managing completed orders - filtering, sorting, and table rendering
 */

class AfterSalesService {
    constructor() {
        this.orders = [];
        this.filteredOrders = [];
        this.tableBody = null;
        this.supabase = null;
        this.ordersChannel = null; // Realtime subscription channel
        this.filters = {
            date: '',
            item: '',
            color: '',
            sort: 'date'
        };
    }

    /**
     * Initialize the after sales service
     * @param {string} tableBodyId - ID of the table body element
     */
    async init(tableBodyId) {
        this.tableBody = document.getElementById(tableBodyId);
        
        // Get Supabase client
        this.supabase = getSupabaseClient();
        if (!this.supabase) {
            console.error('❌ Supabase client not available');
            return;
        }

        // Load orders from database
        await this.loadOrdersFromDatabase();
        
        // Initialize filters after loading data
        this.initFilters();
        
        // Populate filter dropdowns with actual data
        this.populateFilterDropdowns();
        
        // Set up realtime subscription for orders
        this.setupOrdersRealtime();
    }

    /**
     * Load orders from Supabase database
     */
    async loadOrdersFromDatabase() {
        try {
            // Fetch orders with status 'completed'
            // Try ordering by completed_at first, fallback to created_at if column doesn't exist
            // CRITICAL: Explicitly select customer_id to ensure proper relationship mapping
            let { data: orders, error } = await this.supabase
                .from('orders')
                .select(`
                    *,
                    customer_id,
                    customers (
                        id,
                        name,
                        phone
                    ),
                    products (
                        name
                    )
                `)
                .eq('status', 'completed')
                .order('completed_at', { ascending: false, nullsFirst: false });

            // If error is about completed_at column, try with created_at
            if (error && error.message && error.message.includes('completed_at')) {
                console.warn('completed_at column not available, using created_at for ordering');
                const result = await this.supabase
                    .from('orders')
                    .select(`
                        *,
                        customer_id,
                        customers (
                            id,
                            name,
                            phone
                        ),
                        products (
                            name
                        )
                    `)
                    .eq('status', 'completed')
                    .order('created_at', { ascending: false });
                
                if (result.error) {
                    throw result.error;
                }
                orders = result.data;
            } else if (error) {
                throw error;
            }

            // Transform Supabase data to match expected format
            this.orders = (orders || []).map(order => this.transformOrder(order));
            this.applyFilters();
        } catch (error) {
            console.error('Error loading orders from database:', error);
            this.orders = [];
            this.applyFilters();
        }
    }

    /**
     * Transform Supabase order to display format
     * @param {Object} order - Order from Supabase
     * @returns {Object} Transformed order object
     */
    transformOrder(order) {
        // Use completed_at if available, otherwise use created_at
        const completedDate = order.completed_at || order.created_at;
        const dateStr = completedDate ? new Date(completedDate).toISOString().split('T')[0] : '';

        // CRITICAL FIX: Properly extract customer data to prevent name replication bug
        let customerName = 'Unknown Customer';
        let customerPhone = '';
        
        if (order.customers) {
            if (typeof order.customers === 'object' && !Array.isArray(order.customers)) {
                customerName = order.customers.name || 'Unknown Customer';
                customerPhone = order.customers.phone || '';
            } else if (Array.isArray(order.customers) && order.customers.length > 0) {
                customerName = order.customers[0].name || 'Unknown Customer';
                customerPhone = order.customers[0].phone || '';
            }
        }
        
        if (customerName === 'Unknown Customer' && order.customer_id) {
            console.warn(`⚠️ Order ${order.id} has customer_id ${order.customer_id} but customer data not loaded`);
        }
        
        if (customerName === 'Unknown Customer' && !order.customer_id && order.customer_name) {
            customerName = order.customer_name;
        }
        
        if (!customerPhone && !order.customer_id) {
            customerPhone = order.customer_phone || order.phone || '';
        } else if (!customerPhone && order.customer_phone) {
            customerPhone = order.customer_phone;
        }

        return {
            id: order.id,
            customerName: customerName,
            phone: customerPhone,
            itemName: order.products?.name || order.product_name || 'Unknown Product',
            color: order.color || '',
            price: order.price || 0,
            date: dateStr
        };
    }

    /**
     * Populate filter dropdowns with actual data from orders
     */
    populateFilterDropdowns() {
        // Get unique items and colors from orders
        const uniqueItems = [...new Set(this.orders.map(o => o.itemName).filter(Boolean))].sort();
        const uniqueColors = [...new Set(this.orders.map(o => o.color).filter(Boolean))].sort();

        // Populate item filter
        const itemFilter = document.getElementById('itemFilter');
        if (itemFilter) {
            // Keep "All Items" option, then add unique items
            itemFilter.innerHTML = '<option value="">All Items</option>';
            uniqueItems.forEach(item => {
                const option = document.createElement('option');
                option.value = item;
                option.textContent = item;
                itemFilter.appendChild(option);
            });
        }

        // Populate color filter
        const colorFilter = document.getElementById('colorFilter');
        if (colorFilter) {
            // Keep "All Colors" option, then add unique colors
            colorFilter.innerHTML = '<option value="">All Colors</option>';
            uniqueColors.forEach(color => {
                const option = document.createElement('option');
                option.value = color;
                option.textContent = color;
                colorFilter.appendChild(option);
            });
        }
    }

    /**
     * Initialize filter event listeners
     */
    initFilters() {
        const dateFilter = document.getElementById('dateFilter');
        const itemFilter = document.getElementById('itemFilter');
        const colorFilter = document.getElementById('colorFilter');
        const sortFilter = document.getElementById('sortFilter');

        if (dateFilter) {
            dateFilter.addEventListener('change', (e) => {
                this.filters.date = e.target.value;
                this.applyFilters();
            });
        }

        if (itemFilter) {
            itemFilter.addEventListener('change', (e) => {
                this.filters.item = e.target.value;
                this.applyFilters();
            });
        }

        if (colorFilter) {
            colorFilter.addEventListener('change', (e) => {
                this.filters.color = e.target.value;
                this.applyFilters();
            });
        }

        if (sortFilter) {
            sortFilter.addEventListener('change', (e) => {
                this.filters.sort = e.target.value;
                this.applyFilters();
            });
        }
    }

    /**
     * Load orders into the service (for backward compatibility)
     * @param {Array} orders - Array of completed order objects
     */
    loadOrders(orders) {
        this.orders = orders || [];
        this.applyFilters();
    }

    /**
     * Reload orders from database
     */
    async reloadOrders() {
        await this.loadOrdersFromDatabase();
        this.populateFilterDropdowns();
    }

    /**
     * Add a new completed order
     * @param {Object} order - Completed order object
     */
    addOrder(order) {
        this.orders.unshift(order);
        this.applyFilters();
    }

    /**
     * Apply filters and sorting
     */
    applyFilters() {
        let filtered = [...this.orders];

        // Apply date filter (compare date strings)
        if (this.filters.date) {
            filtered = filtered.filter(order => {
                // Compare date strings (YYYY-MM-DD format)
                return order.date === this.filters.date;
            });
        }

        // Apply item filter
        if (this.filters.item) {
            filtered = filtered.filter(order => order.itemName === this.filters.item);
        }

        // Apply color filter
        if (this.filters.color) {
            filtered = filtered.filter(order => order.color === this.filters.color);
        }

        // Apply sorting
        switch (this.filters.sort) {
            case 'date':
                filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
                break;
            case 'date-oldest':
                filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
                break;
            case 'item-popular':
                const itemCounts = {};
                filtered.forEach(order => {
                    itemCounts[order.itemName] = (itemCounts[order.itemName] || 0) + 1;
                });
                filtered.sort((a, b) => itemCounts[b.itemName] - itemCounts[a.itemName]);
                break;
            case 'color-popular':
                const colorCounts = {};
                filtered.forEach(order => {
                    colorCounts[order.color] = (colorCounts[order.color] || 0) + 1;
                });
                filtered.sort((a, b) => colorCounts[b.color] - colorCounts[a.color]);
                break;
            case 'price-high':
                filtered.sort((a, b) => b.price - a.price);
                break;
            case 'price-low':
                filtered.sort((a, b) => a.price - b.price);
                break;
        }

        this.filteredOrders = filtered;
        this.render();
    }

    /**
     * Render orders in the table
     */
    render() {
        if (!this.tableBody) return;

        this.tableBody.innerHTML = this.filteredOrders.map(order => `
            <tr>
                <td>${order.customerName}</td>
                <td>${order.phone || 'N/A'}</td>
                <td>${order.itemName}</td>
                <td>${order.color}</td>
                <td class="price-cell">KES ${order.price.toLocaleString()}</td>
                <td>${order.date}</td>
            </tr>
        `).join('');
    }

    /**
     * Get filtered orders
     * @returns {Array} Array of filtered orders
     */
    getFilteredOrders() {
        return [...this.filteredOrders];
    }

    /**
     * Get all orders
     * @returns {Array} Array of all orders
     */
    getAllOrders() {
        return [...this.orders];
    }

    /**
     * Get filter values
     * @returns {Object} Current filter values
     */
    getFilters() {
        return { ...this.filters };
    }

    /**
     * Set up realtime subscription for orders table (completed status)
     */
    setupOrdersRealtime() {
        if (!this.supabase) {
            console.warn('Supabase client not available for realtime subscription');
            return;
        }

        // Clean up existing subscription if any
        if (this.ordersChannel) {
            this.supabase.removeChannel(this.ordersChannel);
        }

        // Create new channel for orders table with status 'completed'
        this.ordersChannel = this.supabase
            .channel('orders-completed-changes')
            .on(
                'postgres_changes',
                {
                    event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
                    schema: 'public',
                    table: 'orders',
                    filter: 'status=eq.completed' // Only listen to completed orders
                },
                (payload) => {
                    console.log('Orders realtime event (after sales):', payload.eventType, payload);
                    // Reload orders when any change occurs
                    this.loadOrdersFromDatabase();
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('✅ Subscribed to orders realtime changes (after sales - completed)');
                } else if (status === 'CHANNEL_ERROR') {
                    console.error('❌ Error subscribing to orders realtime (after sales)');
                }
            });
    }

    /**
     * Clean up realtime subscriptions
     */
    cleanup() {
        if (this.ordersChannel && this.supabase) {
            this.supabase.removeChannel(this.ordersChannel);
            this.ordersChannel = null;
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AfterSalesService;
}

// Make available globally
if (typeof window !== 'undefined') {
    window.AfterSalesService = AfterSalesService;
}

