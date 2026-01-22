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
            sort: 'date',
            search: ''
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
        
        // Initialize search
        this.initSearch();
        
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
            // CRITICAL: Explicitly select customer_id, items, and comments to ensure proper relationship mapping
            let { data: orders, error } = await this.supabase
                .from('orders')
                .select(`
                    *,
                    customer_id,
                    items,
                    comments,
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
                        items,
                        comments,
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

        // Parse measurements from comments if stored there (for backward compatibility)
        let measurements = {};
        let comments = order.comments || order.notes || '';
        if (comments && comments.includes('Measurements:')) {
            // Pattern 1: In-house format with Height and High Waist
            let measurementsMatch = comments.match(/Measurements:\s*Height=([^,\n\r]+?),\s*Bust=([^,\n\r]+?),\s*High\s+Waist=([^,\n\r]+?),\s*Hips=([^\n\r]+?)(?:\n|$)/i);
            
            if (measurementsMatch && measurementsMatch.length >= 5) {
                measurements = {
                    height: measurementsMatch[1].trim(),
                    bust: measurementsMatch[2].trim(),
                    high_waist: measurementsMatch[3].trim(),
                    hips: measurementsMatch[4].trim()
                };
            } else {
                // Pattern 2: Standard format with Size and Waist
                measurementsMatch = comments.match(/Measurements:\s*Size=([^,\n\r]+?),\s*Bust=([^,\n\r]+?),\s*Waist=([^,\n\r]+?),\s*Hips=([^\n\r]+?)(?:\n|$)/i);
                
                if (!measurementsMatch) {
                    measurementsMatch = comments.match(/Size=([^,\n\r]+?)[,\s]+Bust=([^,\n\r]+?)[,\s]+Waist=([^,\n\r]+?)[,\s]+Hips=([^\n\r]+?)(?:\n|$)/i);
                }
                
                if (measurementsMatch && measurementsMatch.length >= 5) {
                    measurements = {
                        size: measurementsMatch[1].trim(),
                        bust: measurementsMatch[2].trim(),
                        waist: measurementsMatch[3].trim(),
                        hips: measurementsMatch[4].trim()
                    };
                }
            }
        }

        // Process items from JSONB column (new approach) or fallback to single item
        let items = [];
        let totalPrice = 0;
        
        // Check if order has items stored as JSONB array
        if (order.items && Array.isArray(order.items) && order.items.length > 0) {
            console.log(`📦 Processing ${order.items.length} items from JSONB for order ${order.id}`);
            items = order.items.map(item => ({
                productName: item.product_name || 'Unknown Product',
                productImage: item.product_image || 'https://via.placeholder.com/400',
                color: item.color || '',
                price: item.price || 0,
                measurements: item.measurements || {}
            }));
            totalPrice = items.reduce((sum, item) => sum + (item.price || 0), 0);
            console.log(`✅ Created ${items.length} items for order ${order.id}:`, items.map(i => i.productName));
        } else {
            // Fallback to single item (backward compatibility for old orders)
            console.log(`ℹ️ No items array found for order ${order.id}, using single item fallback`);
            items = [{
                productName: order.products?.name || order.product_name || 'Unknown Product',
                productImage: order.products?.image_url || order.product_image || order.image_url || 'https://via.placeholder.com/400',
                color: order.color || '',
                price: order.price || 0,
                measurements: measurements
            }];
            totalPrice = order.price || 0;
        }

        // Get first item name and color for display in main row (backward compatibility)
        const firstItem = items[0] || {};
        const itemName = firstItem.productName || order.products?.name || order.product_name || 'Unknown Product';
        const color = firstItem.color || order.color || '';

        return {
            id: order.id,
            customerName: customerName,
            phone: customerPhone,
            itemName: itemName,
            color: color,
            price: totalPrice,
            date: dateStr,
            items: items, // All items array
            measurements: measurements, // Measurements from comments (if available)
            comments: comments // Store comments for reference
        };
    }

    /**
     * Populate filter dropdowns with actual data from orders
     */
    populateFilterDropdowns() {
        // Get unique items and colors from all orders (including all items in each order)
        const allItemNames = [];
        const allColors = [];
        
        this.orders.forEach(order => {
            if (order.items && order.items.length > 0) {
                order.items.forEach(item => {
                    if (item.productName) allItemNames.push(item.productName);
                    if (item.color) allColors.push(item.color);
                });
            } else {
                // Fallback for orders without items array
                if (order.itemName) allItemNames.push(order.itemName);
                if (order.color) allColors.push(order.color);
            }
        });
        
        const uniqueItems = [...new Set(allItemNames)].sort();
        const uniqueColors = [...new Set(allColors)].sort();

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
     * Initialize search functionality
     */
    initSearch() {
        const searchInput = document.getElementById('afterSalesSearchInput');
        const clearSearchBtn = document.getElementById('clearSearchBtn');

        if (searchInput) {
            // Debounce search for better performance
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                const searchTerm = e.target.value.trim();
                
                // Show/hide clear button
                if (clearSearchBtn) {
                    clearSearchBtn.style.display = searchTerm ? 'flex' : 'none';
                }
                
                // Debounce the search
                searchTimeout = setTimeout(() => {
                    this.filters.search = searchTerm.toLowerCase();
                    this.applyFilters();
                }, 300); // 300ms delay
            });

            // Handle Enter key
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    clearTimeout(searchTimeout);
                    const searchTerm = e.target.value.trim().toLowerCase();
                    this.filters.search = searchTerm;
                    this.applyFilters();
                }
            });

            // Clear search button
            if (clearSearchBtn) {
                clearSearchBtn.addEventListener('click', () => {
                    searchInput.value = '';
                    this.filters.search = '';
                    clearSearchBtn.style.display = 'none';
                    this.applyFilters();
                    searchInput.focus();
                });
            }
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

        // Apply search filter (searches across multiple fields)
        if (this.filters.search) {
            const searchTerm = this.filters.search;
            filtered = filtered.filter(order => {
                // Search in customer name
                const customerMatch = order.customerName && 
                    order.customerName.toLowerCase().includes(searchTerm);
                
                // Search in phone number
                const phoneMatch = order.phone && 
                    order.phone.toLowerCase().includes(searchTerm);
                
                // Search in item names (all items)
                let itemMatch = false;
                if (order.items && order.items.length > 0) {
                    itemMatch = order.items.some(item => 
                        item.productName && item.productName.toLowerCase().includes(searchTerm)
                    );
                } else {
                    itemMatch = order.itemName && 
                        order.itemName.toLowerCase().includes(searchTerm);
                }
                
                // Search in colors (all items)
                let colorMatch = false;
                if (order.items && order.items.length > 0) {
                    colorMatch = order.items.some(item => 
                        item.color && item.color.toLowerCase().includes(searchTerm)
                    );
                } else {
                    colorMatch = order.color && 
                        order.color.toLowerCase().includes(searchTerm);
                }
                
                // Search in order ID
                const idMatch = order.id && 
                    order.id.toString().toLowerCase().includes(searchTerm);
                
                // Search in price
                const priceMatch = order.price && 
                    order.price.toString().includes(searchTerm);
                
                // Search in date
                const dateMatch = order.date && 
                    order.date.toLowerCase().includes(searchTerm);
                
                return customerMatch || phoneMatch || itemMatch || colorMatch || 
                       idMatch || priceMatch || dateMatch;
            });
        }

        // Apply date filter (compare date strings)
        if (this.filters.date) {
            filtered = filtered.filter(order => {
                // Compare date strings (YYYY-MM-DD format)
                return order.date === this.filters.date;
            });
        }

        // Apply item filter (check all items in order)
        if (this.filters.item) {
            filtered = filtered.filter(order => {
                if (order.items && order.items.length > 0) {
                    return order.items.some(item => item.productName === this.filters.item);
                }
                return order.itemName === this.filters.item;
            });
        }

        // Apply color filter (check all items in order)
        if (this.filters.color) {
            filtered = filtered.filter(order => {
                if (order.items && order.items.length > 0) {
                    return order.items.some(item => item.color === this.filters.color);
                }
                return order.color === this.filters.color;
            });
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
                    if (order.items && order.items.length > 0) {
                        order.items.forEach(item => {
                            const itemName = item.productName || order.itemName;
                            itemCounts[itemName] = (itemCounts[itemName] || 0) + 1;
                        });
                    } else {
                        itemCounts[order.itemName] = (itemCounts[order.itemName] || 0) + 1;
                    }
                });
                filtered.sort((a, b) => {
                    const aCount = a.items && a.items.length > 0 
                        ? Math.max(...a.items.map(item => itemCounts[item.productName] || 0))
                        : itemCounts[a.itemName] || 0;
                    const bCount = b.items && b.items.length > 0 
                        ? Math.max(...b.items.map(item => itemCounts[item.productName] || 0))
                        : itemCounts[b.itemName] || 0;
                    return bCount - aCount;
                });
                break;
            case 'color-popular':
                const colorCounts = {};
                filtered.forEach(order => {
                    if (order.items && order.items.length > 0) {
                        order.items.forEach(item => {
                            const color = item.color || order.color;
                            if (color) colorCounts[color] = (colorCounts[color] || 0) + 1;
                        });
                    } else {
                        if (order.color) colorCounts[order.color] = (colorCounts[order.color] || 0) + 1;
                    }
                });
                filtered.sort((a, b) => {
                    const aColor = a.items && a.items.length > 0 ? a.items[0].color : a.color;
                    const bColor = b.items && b.items.length > 0 ? b.items[0].color : b.color;
                    return (colorCounts[bColor] || 0) - (colorCounts[aColor] || 0);
                });
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

        // Show "no results" message if search/filter returns no results
        if (this.filteredOrders.length === 0) {
            const hasActiveFilters = this.filters.search || this.filters.date || 
                                   this.filters.item || this.filters.color;
            
            this.tableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px 20px; color: rgba(65, 70, 63, 0.6);">
                        <div style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
                            <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="opacity: 0.5;">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                            <div style="font-size: 16px; font-weight: 500;">
                                ${hasActiveFilters ? 'No orders found matching your search/filters' : 'No completed orders found'}
                            </div>
                            ${hasActiveFilters ? '<div style="font-size: 13px; opacity: 0.7;">Try adjusting your search or filters</div>' : ''}
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        this.tableBody.innerHTML = this.filteredOrders.map(order => {
            const orderId = `order-${order.id}`;
            const hasMultipleItems = order.items && order.items.length > 1;
            const hasMeasurements = order.items && order.items.some(item => 
                item.measurements && Object.keys(item.measurements).length > 0
            ) || (order.measurements && Object.keys(order.measurements).length > 0);
            
            // Build items display
            let itemsHtml = '';
            if (order.items && order.items.length > 0) {
                itemsHtml = order.items.map((item, index) => {
                    const itemMeasurements = item.measurements || {};
                    const hasItemMeasurements = Object.keys(itemMeasurements).length > 0;
                    
                    let measurementsHtml = '';
                    if (hasItemMeasurements) {
                        const measurementsList = Object.entries(itemMeasurements)
                            .filter(([key, value]) => value && value !== 'N/A' && value !== '')
                            .map(([key, value]) => {
                                const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                                return `<div class="measurement-item"><span class="measurement-label">${label}:</span> <span class="measurement-value">${value}</span></div>`;
                            })
                            .join('');
                        
                        if (measurementsList) {
                            measurementsHtml = `
                                <div class="item-measurements">
                                    <div class="measurements-title">Measurements:</div>
                                    ${measurementsList}
                                </div>
                            `;
                        }
                    }
                    
                    return `
                        <div class="order-item-detail">
                            <div class="item-header">
                                <span class="item-number">${index + 1}.</span>
                                <span class="item-name">${item.productName || 'Unknown Product'}</span>
                                <span class="item-color">${item.color ? `(${item.color})` : ''}</span>
                                <span class="item-price">KES ${(item.price || 0).toLocaleString()}</span>
                            </div>
                            ${measurementsHtml}
                        </div>
                    `;
                }).join('');
            }
            
            // Show first item name in main row, or indicate multiple items
            const displayItemName = hasMultipleItems 
                ? `${order.itemName} (${order.items.length} items)` 
                : order.itemName;
            
            return `
                <tr class="order-row" data-order-id="${order.id}" style="cursor: pointer;">
                    <td>${order.customerName}</td>
                    <td>${order.phone || 'N/A'}</td>
                    <td>${displayItemName}</td>
                    <td>${order.color}</td>
                    <td class="price-cell">KES ${order.price.toLocaleString()}</td>
                    <td>${order.date}</td>
                </tr>
                <tr class="order-details-row" id="${orderId}-details" style="display: none;">
                    <td colspan="6" class="order-details-cell">
                        <div class="order-details-content">
                            <div class="order-details-header">
                                <h4>Order Details</h4>
                                <span class="items-count">${order.items ? order.items.length : 1} ${order.items && order.items.length === 1 ? 'Item' : 'Items'}</span>
                            </div>
                            <div class="order-items-list">
                                ${itemsHtml || '<div class="no-items">No items found</div>'}
                            </div>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Add click event listeners to rows
        this.tableBody.querySelectorAll('.order-row').forEach(row => {
            row.addEventListener('click', (e) => {
                const orderId = row.getAttribute('data-order-id');
                const detailsRow = document.getElementById(`order-${orderId}-details`);
                
                if (detailsRow) {
                    const isExpanded = detailsRow.style.display !== 'none';
                    
                    // Close all other expanded rows
                    this.tableBody.querySelectorAll('.order-details-row').forEach(detailRow => {
                        detailRow.style.display = 'none';
                    });
                    this.tableBody.querySelectorAll('.order-row').forEach(r => {
                        r.classList.remove('expanded');
                    });
                    
                    // Toggle current row
                    if (!isExpanded) {
                        detailsRow.style.display = 'table-row';
                        row.classList.add('expanded');
                    }
                }
            });
        });
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

