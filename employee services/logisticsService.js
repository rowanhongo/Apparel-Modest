/**
 * Logistics Service
 * Service for managing orders to deliver - mark as delivered
 */

class LogisticsService {
    constructor() {
        this.orders = [];
        this.container = null;
        this.onOrderUpdateCallback = null;
        this.supabase = null;
    }

    /**
     * Initialize the logistics service
     * @param {string} containerId - ID of the container element
     * @param {Function} onOrderUpdate - Callback when order status changes
     */
    async init(containerId, onOrderUpdate = null) {
        this.container = document.getElementById(containerId);
        this.onOrderUpdateCallback = onOrderUpdate;
        
        // Get Supabase client
        this.supabase = getSupabaseClient();
        if (!this.supabase) {
            console.error('❌ Supabase client not available');
            return;
        }

        // Load orders from database
        await this.loadOrdersFromDatabase();
    }

    /**
     * Load orders from Supabase database
     */
    async loadOrdersFromDatabase() {
        try {
            // Fetch orders with status 'to_deliver' (matches the tab name 'to-deliver')
            const { data: orders, error } = await this.supabase
                .from('orders')
                .select(`
                    *,
                    customers (
                        name,
                        phone
                    ),
                    products (
                        name,
                        image_url
                    )
                `)
                .eq('status', 'to_deliver')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching logistics orders:', error);
                this.orders = [];
                this.render();
                return;
            }

            // Transform Supabase data to match expected format
            this.orders = (orders || []).map(order => this.transformOrder(order));
            this.render();
        } catch (error) {
            console.error('Error loading orders from database:', error);
            this.orders = [];
            this.render();
        }
    }

    /**
     * Transform Supabase order to display format
     * @param {Object} order - Order from Supabase
     * @returns {Object} Transformed order object
     */
    transformOrder(order) {
        // Parse measurements if stored as JSON
        let measurements = { size: '', bust: '', waist: '', hips: '', length: '' };
        if (order.measurements) {
            if (typeof order.measurements === 'string') {
                try {
                    measurements = JSON.parse(order.measurements);
                } catch (e) {
                    measurements = { size: '', bust: '', waist: '', hips: '', length: '' };
                }
            } else {
                measurements = order.measurements;
            }
        }

        // Extract measurements from comments if they're stored there
        let comments = order.comments || order.notes || '';
        if (comments && comments.includes('Measurements:')) {
            // Try multiple regex patterns to handle different formats
            let measurementsMatch = comments.match(/Measurements:\s*Size=([^,\n\r]+?),\s*Bust=([^,\n\r]+?),\s*Waist=([^,\n\r]+?),\s*Hips=([^\n\r]+?)(?:\n|$)/i);
            
            if (!measurementsMatch) {
                measurementsMatch = comments.match(/Measurements:.*?Size=([^,\n\r]+?)[,\s]+Bust=([^,\n\r]+?)[,\s]+Waist=([^,\n\r]+?)[,\s]+Hips=([^\n\r]+?)(?:\n|$)/i);
            }
            
            if (!measurementsMatch) {
                measurementsMatch = comments.match(/Size=([^,\n\r]+?)[,\s]+Bust=([^,\n\r]+?)[,\s]+Waist=([^,\n\r]+?)[,\s]+Hips=([^\n\r]+?)(?:\n|$)/i);
            }
            
            if (measurementsMatch && measurementsMatch.length >= 5) {
                measurements.size = measurementsMatch[1].trim();
                measurements.bust = measurementsMatch[2].trim();
                measurements.waist = measurementsMatch[3].trim();
                measurements.hips = measurementsMatch[4].trim();
                
                // Remove measurements line from comments
                comments = comments.replace(/\n?Measurements:.*$/m, '').trim();
                comments = comments.replace(/Measurements:.*$/m, '').trim();
            }
        }

        // Format date
        const orderDate = order.created_at ? new Date(order.created_at).toISOString().split('T')[0] : '';

        return {
            id: order.id,
            customerName: order.customers?.name || order.customer_name || 'Unknown Customer',
            phone: order.customers?.phone || order.phone || '',
            productName: order.products?.name || order.product_name || 'Unknown Product',
            productImage: order.products?.image_url || order.product_image || order.image_url || 'https://via.placeholder.com/400',
            color: order.color || '',
            price: order.price || 0,
            measurements: measurements,
            comments: comments,
            date: orderDate,
            deliveryOption: order.delivery_option || order.deliveryOption || '',
            paymentOption: order.payment_option || order.paymentOption || ''
        };
    }

    /**
     * Load orders into the service (for backward compatibility)
     * @param {Array} orders - Array of order objects
     */
    loadOrders(orders) {
        this.orders = orders || [];
        this.render();
    }

    /**
     * Render orders in the container
     */
    render() {
        if (!this.container) return;

        this.container.innerHTML = '';

        this.orders.forEach(order => {
            const orderBubble = this.createOrderBubble(order);
            this.container.appendChild(orderBubble);
        });
    }

    /**
     * Create order bubble element
     * @param {Object} order - Order object
     * @returns {HTMLElement} Order bubble element
     */
    createOrderBubble(order) {
        const bubble = document.createElement('div');
        bubble.className = 'order-bubble';
        bubble.innerHTML = `
            <div class="order-header">
                <img src="${order.productImage}" alt="${order.productName}" class="order-image">
                <div class="order-info">
                    <div class="customer-name">${order.customerName}</div>
                    <div class="product-name">${order.productName}</div>
                    <span class="product-color">Colour: ${order.color}</span>
                </div>
            </div>
            <div class="order-details" id="details-${order.id}">
                ${this.renderOrderDetails(order)}
            </div>
            <div class="order-actions">
                <button class="btn btn-delivered" data-action="delivered" data-id="${order.id}">Delivered</button>
            </div>
        `;

        // Add click handler for order bubble (toggle expanded state)
        bubble.addEventListener('click', (e) => {
            // Check if click is on or inside a button
            if (!e.target.closest('.btn')) {
                bubble.classList.toggle('expanded');
                console.log('Card toggled, expanded:', bubble.classList.contains('expanded'));
            }
        });

        // Add button click handler (stop propagation to prevent toggle)
        const deliveredBtn = bubble.querySelector('[data-action="delivered"]');
        if (deliveredBtn) {
            deliveredBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.markAsDelivered(order.id);
            });
        }

        return bubble;
    }

    /**
     * Render order details HTML
     * @param {Object} order - Order object
     * @returns {string} HTML string for order details
     */
    renderOrderDetails(order) {
        return `
            <div class="detail-row">
                <div class="detail-label">Phone:</div>
                <div class="detail-value">${order.phone}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Price:</div>
                <div class="detail-value">KES ${order.price.toLocaleString()}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Measurements:</div>
                <div class="detail-value">
                    ${(() => {
                        const parts = [];
                        if (order.measurements.size && order.measurements.size !== 'N/A' && order.measurements.size !== '') {
                            parts.push(`Size: ${order.measurements.size}`);
                        }
                        if (order.measurements.bust && order.measurements.bust !== 'N/A' && order.measurements.bust !== '') {
                            parts.push(`Bust: ${order.measurements.bust}"`);
                        }
                        if (order.measurements.waist && order.measurements.waist !== 'N/A' && order.measurements.waist !== '') {
                            parts.push(`Waist: ${order.measurements.waist}"`);
                        }
                        if (order.measurements.hips && order.measurements.hips !== 'N/A' && order.measurements.hips !== '') {
                            parts.push(`Hips: ${order.measurements.hips}"`);
                        }
                        return parts.length > 0 ? parts.join(', ') : 'No measurements provided';
                    })()}
                </div>
            </div>
            ${order.comments ? `
                <div class="detail-row">
                    <div class="detail-label">Comments:</div>
                    <div class="detail-value">${order.comments}</div>
                </div>
            ` : ''}
            ${order.deliveryOption ? `
                <div class="detail-row">
                    <div class="detail-label">Preferred Choice of Delivery:</div>
                    <div class="detail-value">${this.formatDeliveryOption(order.deliveryOption)}</div>
                </div>
            ` : ''}
            ${order.paymentOption ? `
                <div class="detail-row">
                    <div class="detail-label">Payment Option:</div>
                    <div class="detail-value">${this.formatPaymentOption(order.paymentOption)}</div>
                </div>
            ` : ''}
            <div class="detail-row">
                <div class="detail-label">Order Date:</div>
                <div class="detail-value">${order.date}</div>
            </div>
        `;
    }

    /**
     * Mark order as delivered
     * @param {string} orderId - Order ID (UUID)
     */
    async markAsDelivered(orderId) {
        const order = this.orders.find(o => o.id === orderId);
        if (!order) {
            alert('Order not found');
            return;
        }

        try {
            console.log('📦 Marking order as delivered');
            console.log('🆔 Order ID:', orderId);
            console.log('📋 Order ID type:', typeof orderId);
            console.log('📋 Order details:', order);
            
            // Ensure orderId is a string (UUID)
            const orderIdStr = String(orderId);
            console.log('🆔 Order ID (string):', orderIdStr);
            
            // Try to include completed_at, but handle if column doesn't exist
            const { data: dataWithTimestamp, error: errorWithTimestamp } = await this.supabase
                .from('orders')
                .update({ 
                    status: 'completed',
                    completed_at: new Date().toISOString()
                })
                .eq('id', orderIdStr)
                .select();

            // If error occurred, try without completed_at or log the error
            if (errorWithTimestamp) {
                console.warn('⚠️ Error updating with completed_at:', errorWithTimestamp);
                console.error('📋 Full error object:', JSON.stringify(errorWithTimestamp, null, 2));
                console.error('🔍 Error message:', errorWithTimestamp.message);
                console.error('🔍 Error hint:', errorWithTimestamp.hint);
                console.error('🔍 Error details:', errorWithTimestamp.details);
                console.error('🔍 Error code:', errorWithTimestamp.code);
                
                // Check if error is about missing column or any column-related issue
                const errorMsg = errorWithTimestamp.message || '';
                const errorHint = errorWithTimestamp.hint || '';
                const isColumnError = errorMsg.includes('completed_at') || 
                                     errorMsg.includes('column') || 
                                     errorHint.includes('completed_at') ||
                                     errorMsg.includes('Could not find');
                
                if (isColumnError) {
                    console.log('📝 Column-related error detected, trying update without completed_at');
                    const { data, error } = await this.supabase
                        .from('orders')
                        .update({ status: 'completed' })
                        .eq('id', orderIdStr)
                        .select();
                    
                    if (error) {
                        console.error('❌ Error updating order (without completed_at):', error);
                        console.error('📋 Full error object:', JSON.stringify(error, null, 2));
                        console.error('🔍 Error message:', error.message);
                        console.error('🔍 Error hint:', error.hint);
                        console.error('🔍 Error details:', error.details);
                        console.error('🔍 Error code:', error.code);
                        alert(`Failed to update order: ${error.message || 'Unknown error'}. Please check the console for details.`);
                        return;
                    }
                    
                    console.log('✅ Order updated successfully (without completed_at)');
                    console.log('📋 Updated order data:', data);
                } else {
                    // Different error (constraint, permission, etc.)
                    console.error('❌ Non-column error detected');
                    alert(`Failed to update order: ${errorWithTimestamp.message || 'Unknown error'}. Please check the console for details.`);
                    return;
                }
            } else {
                console.log('✅ Order updated successfully (with completed_at)');
                console.log('📋 Updated order data:', dataWithTimestamp);
            }

            // Remove from local array
            this.orders = this.orders.filter(o => o.id !== orderId);

            // Create completed order object for callback
            const completedOrder = {
                customerName: order.customerName,
                phone: order.phone || 'N/A',
                itemName: order.productName,
                color: order.color,
                price: order.price,
                date: new Date().toISOString().split('T')[0],
                deliveryOption: order.deliveryOption || null,
                paymentOption: order.paymentOption || null
            };

            if (this.onOrderUpdateCallback) {
                this.onOrderUpdateCallback('delivered', completedOrder);
            }

            this.render();
            alert('✓ Order marked as delivered!');
        } catch (error) {
            console.error('❌ Unexpected error marking order as delivered:', error);
            console.error('📋 Full error object:', JSON.stringify(error, null, 2));
            console.error('🔍 Error message:', error.message);
            console.error('🔍 Error stack:', error.stack);
            alert(`Failed to update order: ${error.message || 'Unknown error'}. Please check the console for details.`);
        }
    }

    /**
     * Format delivery option for display
     * @param {string} option - Delivery option value
     * @returns {string} Formatted delivery option
     */
    formatDeliveryOption(option) {
        const options = {
            'uber': 'Uber',
            'pickup-mtaani': 'Pick Up Mtaani',
            'courier': 'Courier',
            'in-store-pickup': 'In Store Pick Up'
        };
        return options[option] || option;
    }

    /**
     * Format payment option for display
     * @param {string} option - Payment option value
     * @returns {string} Formatted payment option
     */
    formatPaymentOption(option) {
        const options = {
            'mpesa': 'Mpesa',
            'stk-push': 'STK Push',
            'card': 'Card',
            'paypal': 'Paypal',
            'apple-pay': 'Apple Pay'
        };
        return options[option] || option;
    }

    /**
     * Get current orders
     * @returns {Array} Array of current orders
     */
    getOrders() {
        return [...this.orders];
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LogisticsService;
}

// Make available globally
if (typeof window !== 'undefined') {
    window.LogisticsService = LogisticsService;
}

