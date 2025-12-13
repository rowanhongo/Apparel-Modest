/**
 * Sales Service
 * Service for managing new order requests - accept/deny orders
 */

class SalesService {
    constructor() {
        this.orders = [];
        this.container = null;
        this.onOrderUpdateCallback = null;
        this.supabase = null;
        this.ordersChannel = null; // Realtime subscription channel
    }

    /**
     * Initialize the sales service
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

        // Set up event delegation for card clicks
        if (this.container) {
            // Remove any existing listener to avoid duplicates
            this.container.removeEventListener('click', this.handleCardClick);
            // Create bound handler
            this.handleCardClick = (e) => {
                const bubble = e.target.closest('.order-bubble');
                if (bubble && !e.target.closest('.btn')) {
                    e.preventDefault();
                    e.stopPropagation();
                    bubble.classList.toggle('expanded');
                }
            };
            this.container.addEventListener('click', this.handleCardClick);
        } else {
            console.error('Container not found:', containerId);
        }

        // Load orders from database
        await this.loadOrdersFromDatabase();
        
        // Set up realtime subscription for orders
        this.setupOrdersRealtime();
    }

    /**
     * Load orders from Supabase database
     */
    async loadOrdersFromDatabase() {
        try {
            // Fetch orders with status 'pending' (new requests)
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
                .eq('status', 'pending')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching sales orders:', error);
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
            // Parse measurements from comments string
            // Format: "Measurements: Size=SS 6, Bust=32, Waist=25, Hips=36"
            // Or: "some text\nMeasurements: Size=SS 6, Bust=32, Waist=25, Hips=36"
            // Try multiple regex patterns to handle different formats
            // Pattern 1: Standard format with proper spacing
            let measurementsMatch = comments.match(/Measurements:\s*Size=([^,\n\r]+?),\s*Bust=([^,\n\r]+?),\s*Waist=([^,\n\r]+?),\s*Hips=([^\n\r]+?)(?:\n|$)/i);
            
            // Pattern 2: More flexible, handles any spacing
            if (!measurementsMatch) {
                measurementsMatch = comments.match(/Measurements:.*?Size=([^,\n\r]+?)[,\s]+Bust=([^,\n\r]+?)[,\s]+Waist=([^,\n\r]+?)[,\s]+Hips=([^\n\r]+?)(?:\n|$)/i);
            }
            
            // Pattern 3: Very flexible, just find the values
            if (!measurementsMatch) {
                measurementsMatch = comments.match(/Size=([^,\n\r]+?)[,\s]+Bust=([^,\n\r]+?)[,\s]+Waist=([^,\n\r]+?)[,\s]+Hips=([^\n\r]+?)(?:\n|$)/i);
            }
            
            if (measurementsMatch && measurementsMatch.length >= 5) {
                measurements.size = measurementsMatch[1].trim();
                measurements.bust = measurementsMatch[2].trim();
                measurements.waist = measurementsMatch[3].trim();
                measurements.hips = measurementsMatch[4].trim();
                
                // Remove measurements line from comments (handle both single line and multi-line)
                comments = comments.replace(/\n?Measurements:.*$/m, '').trim();
                // Also remove if it's at the end of a line
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
            paymentOption: order.payment_option || order.paymentOption || '',
            paymentReference: order.payment_reference || order.paymentReference || '', // Include payment reference
            deliveryLocation: order.delivery_display_name || order.delivery_location || order.deliveryLocation || ''
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

        // Store the current scroll position if needed
        const scrollTop = this.container.scrollTop;

        this.container.innerHTML = '';

        if (this.orders.length === 0) {
            // Show empty state message
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'empty-state-message';
            emptyMessage.style.cssText = 'text-align: center; padding: 60px 20px; color: rgba(65, 70, 63, 0.6); font-size: 18px; font-weight: 500;';
            emptyMessage.textContent = 'No sales yet';
            this.container.appendChild(emptyMessage);
        } else {
        this.orders.forEach(order => {
            const orderBubble = this.createOrderBubble(order);
            this.container.appendChild(orderBubble);
        });
        }

        // Restore scroll position
        this.container.scrollTop = scrollTop;
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
                <button class="btn btn-accept" data-action="accept" data-id="${order.id}">Accept</button>
            </div>
        `;

        // Note: Click handler for expanding is now handled via event delegation in init()
        // Add button click handlers (stop propagation to prevent toggle)
        const acceptBtn = bubble.querySelector('[data-action="accept"]');
        
        if (acceptBtn) {
            acceptBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.acceptOrder(order.id);
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
            ${order.deliveryLocation ? `
                <div class="detail-row">
                    <div class="detail-label">Delivery Location:</div>
                    <div class="detail-value">${order.deliveryLocation}</div>
                </div>
            ` : ''}
            ${order.paymentOption ? `
                <div class="detail-row">
                    <div class="detail-label">Payment Option:</div>
                    <div class="detail-value">${order.paymentOption === 'mpesa' && order.paymentReference && order.paymentReference.startsWith('INHOUSE-')
                        ? `inhouse; mpesa code: ${order.paymentReference.replace('INHOUSE-', '')}` 
                        : order.paymentOption === 'mpesa' && order.paymentReference
                        ? `${this.formatPaymentOption(order.paymentOption)} (Code: ${order.paymentReference})`
                        : this.formatPaymentOption(order.paymentOption)}</div>
                </div>
            ` : ''}
            <div class="detail-row">
                <div class="detail-label">Order Date:</div>
                <div class="detail-value">${order.date}</div>
            </div>
        `;
    }

    /**
     * Accept an order
     * @param {number} orderId - Order ID
     */
    async acceptOrder(orderId) {
        const order = this.orders.find(o => o.id === orderId);
        if (!order) {
            alert('Order not found');
            return;
        }

        try {
            // Update order status in Supabase
            const { error } = await this.supabase
                .from('orders')
                .update({ 
                    status: 'in_progress',
                    updated_at: new Date().toISOString()
                })
                .eq('id', orderId);

            if (error) {
                console.error('Error accepting order:', error);
                alert('Failed to accept order. Please try again.');
                return;
            }

            // Remove from local array
            this.orders = this.orders.filter(o => o.id !== orderId);

            if (this.onOrderUpdateCallback) {
                this.onOrderUpdateCallback('accepted', order);
            }

            this.render();
            alert('✓ Order accepted and moved to In Progress');
        } catch (error) {
            console.error('Error accepting order:', error);
            alert('Failed to accept order. Please try again.');
        }
    }

    /**
     * Delete an order
     * @param {string|number} orderId - Order ID
     */
    async deleteOrder(orderId) {
        const order = this.orders.find(o => o.id === orderId);
        if (!order) {
            alert('Order not found');
            return;
        }

        // Ask for confirmation
        if (!confirm('Are you sure you want to delete this order? This action cannot be undone.')) {
            return;
        }

        try {
            // Delete order from Supabase
            const { error } = await this.supabase
                .from('orders')
                .delete()
                .eq('id', orderId);

            if (error) {
                console.error('Error deleting order:', error);
                alert('Failed to delete order. Please try again.');
                return;
            }

            // Remove from local array
            this.orders = this.orders.filter(o => o.id !== orderId);

            if (this.onOrderUpdateCallback) {
                this.onOrderUpdateCallback('deleted', order);
            }

            this.render();
            alert('✓ Order deleted successfully');
        } catch (error) {
            console.error('Error deleting order:', error);
            alert('Failed to delete order. Please try again.');
        }
    }

    /**
     * Deny an order
     * @param {number} orderId - Order ID
     */
    async denyOrder(orderId) {
        const order = this.orders.find(o => o.id === orderId);
        if (!order) {
            alert('Order not found');
            return;
        }

        if (!confirm('Are you sure you want to deny this order? This action cannot be undone.')) {
            return;
        }

        try {
            // Update order status to 'cancelled' to keep history
            const { error } = await this.supabase
                .from('orders')
                .update({ 
                    status: 'cancelled',
                    updated_at: new Date().toISOString()
                })
                .eq('id', orderId);

            if (error) {
                console.error('Error denying order:', error);
                alert('Failed to deny order. Please try again.');
                return;
            }

            // Remove from local array
            this.orders = this.orders.filter(o => o.id !== orderId);

            if (this.onOrderUpdateCallback) {
                this.onOrderUpdateCallback('denied', order);
            }

            this.render();
            alert('Order denied and removed');
        } catch (error) {
            console.error('Error denying order:', error);
            alert('Failed to deny order. Please try again.');
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
            'apple-pay': 'Apple Pay',
            'paystack': 'Paystack'
        };
        return options[option] || option;
    }

    /**
     * Set up realtime subscription for orders table (pending status)
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

        // Create new channel for orders table with status 'pending'
        this.ordersChannel = this.supabase
            .channel('orders-pending-changes')
            .on(
                'postgres_changes',
                {
                    event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
                    schema: 'public',
                    table: 'orders',
                    filter: 'status=eq.pending' // Only listen to pending orders
                },
                (payload) => {
                    console.log('Orders realtime event (sales):', payload.eventType, payload);
                    // Reload orders when any change occurs
                    this.loadOrdersFromDatabase();
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('✅ Subscribed to orders realtime changes (sales - pending)');
                } else if (status === 'CHANNEL_ERROR') {
                    console.error('❌ Error subscribing to orders realtime (sales)');
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
    module.exports = SalesService;
}

