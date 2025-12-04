/**
 * Production Service
 * Service for managing in-progress orders - mark as done
 */

class ProductionService {
    constructor() {
        this.orders = [];
        this.container = null;
        this.onOrderUpdateCallback = null;
        this.supabase = null;
    }

    /**
     * Initialize the production service
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
            // Fetch orders with status 'in_progress'
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
                .eq('status', 'in_progress')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching production orders:', error);
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
                <button class="btn btn-done" data-action="done" data-id="${order.id}">Mark as Done</button>
            </div>
        `;

        // Add click handler for order bubble (toggle expanded state)
        bubble.addEventListener('click', (e) => {
            if (!e.target.classList.contains('btn')) {
                bubble.classList.toggle('expanded');
            }
        });

        // Add button click handler (stop propagation to prevent toggle)
        bubble.querySelector('[data-action="done"]').addEventListener('click', (e) => {
            e.stopPropagation();
            this.markAsDone(order.id);
        });

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
     * Mark order as done
     * @param {string} orderId - Order ID (UUID)
     */
    async markAsDone(orderId) {
        // Ensure orderId is a string
        const orderIdStr = String(orderId);
        
        const order = this.orders.find(o => String(o.id) === orderIdStr);
        if (!order) {
            alert('Order not found');
            return;
        }

        try {
            // Update order status to 'to_deliver'
            // If this fails with a constraint error, the database constraint needs to be updated
            const { data, error } = await this.supabase
                .from('orders')
                .update({ status: 'to_deliver' })
                .eq('id', orderIdStr)
                .select();
            
            // Log the full error for debugging
            if (error) {
                console.error('❌ Error updating order:', error);
                console.error('📋 Full error object:', JSON.stringify(error, null, 2));
                console.error('🔍 Error message:', error.message);
                console.error('🔍 Error hint:', error.hint);
                console.error('🔍 Error details:', error.details);
                console.error('📝 Order ID:', orderIdStr);
                console.error('📝 Status being set:', 'to_deliver');
                
                // If constraint error, show helpful message
                if (error.message && error.message.includes('check constraint')) {
                    console.error('⚠️ Constraint error detected, but "to_deliver" should be allowed.');
                    console.error('💡 This might be caused by a trigger or related table insert.');
                    console.error('💡 Check if there are triggers on the orders table that might be failing.');
                    alert(`Database error: ${error.message}\n\nCheck the browser console (F12) for full error details.`);
                } else {
                    alert(`Failed to update order: ${error.message || 'Unknown error'}. Please try again.`);
                }
                return;
            }

            if (error) {
                console.error('Error updating order:', error);
                console.error('Error details:', JSON.stringify(error, null, 2));
                console.error('Order ID:', orderIdStr);
                console.error('Order ID type:', typeof orderIdStr);
                alert(`Failed to update order: ${error.message || error.hint || 'Unknown error'}. Please try again.`);
                return;
            }

            if (!data || data.length === 0) {
                console.error('No rows updated. Order ID:', orderIdStr);
                alert('Order not found in database. Please refresh the page.');
                return;
            }

            // Remove from local array
            this.orders = this.orders.filter(o => o.id !== orderId);

            if (this.onOrderUpdateCallback) {
                this.onOrderUpdateCallback('done', order);
            }

            this.render();
            alert('✓ Order marked as done and moved to To Be Delivered');
        } catch (error) {
            console.error('Error marking order as done:', error);
            alert('Failed to update order. Please try again.');
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
    module.exports = ProductionService;
}

// Make available globally
if (typeof window !== 'undefined') {
    window.ProductionService = ProductionService;
}

