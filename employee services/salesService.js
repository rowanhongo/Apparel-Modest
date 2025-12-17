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

            // Fetch order_items for all orders (if table exists)
            let orderItemsMap = {};
            if (orders && orders.length > 0) {
                const orderIds = orders.map(o => o.id);
                try {
                    const { data: orderItems, error: itemsError } = await this.supabase
                        .from('order_items')
                        .select(`
                            *,
                            products (
                                name,
                                image_url
                            )
                        `)
                        .in('order_id', orderIds);

                    if (itemsError) {
                        // Log error but don't fail - table might not exist yet
                        console.warn('⚠️ Could not fetch order_items (table may not exist):', itemsError.message);
                        console.log('💡 To enable multi-item orders, create the order_items table in Supabase');
                    } else if (orderItems && orderItems.length > 0) {
                        console.log(`✅ Found ${orderItems.length} order_items for ${orderIds.length} orders`);
                        console.log('📋 Order items data:', orderItems);
                        // Group items by order_id
                        orderItems.forEach(item => {
                            if (!orderItemsMap[item.order_id]) {
                                orderItemsMap[item.order_id] = [];
                            }
                            orderItemsMap[item.order_id].push(item);
                        });
                        // Log which orders have multiple items
                        Object.keys(orderItemsMap).forEach(orderId => {
                            const count = orderItemsMap[orderId].length;
                            console.log(`📦 Order ${orderId} has ${count} item${count > 1 ? 's' : ''}:`, orderItemsMap[orderId].map(i => i.products?.name || 'Unknown'));
                            if (count > 1) {
                                console.log(`   → This order should display ${count} items horizontally`);
                            }
                        });
                    } else {
                        console.log('ℹ️ No order_items found - orders may be single-item only');
                        console.log('💡 Checking if order_items exist in database...');
                        // Diagnostic: Check one order
                        if (orderIds.length > 0) {
                            const { data: testItems } = await this.supabase
                                .from('order_items')
                                .select('*')
                                .eq('order_id', orderIds[0])
                                .limit(5);
                            console.log(`🔍 Test query for order ${orderIds[0]}:`, testItems);
                        }
                    }
                } catch (error) {
                    console.warn('⚠️ Error fetching order_items:', error);
                }
            }

            // Transform Supabase data to match expected format
            this.orders = (orders || []).map(order => this.transformOrder(order, orderItemsMap[order.id] || null));
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
     * @param {Array} orderItems - Array of order_items (optional)
     * @returns {Object} Transformed order object
     */
    transformOrder(order, orderItems = null) {
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
            // Format 1 (standard): "Measurements: Size=SS 6, Bust=32, Waist=25, Hips=36"
            // Format 2 (in-house): "Measurements: Height=N/A, Bust=38, High Waist=32, Hips=43"
            // Or: "some text\nMeasurements: ..."
            
            // Pattern 1: In-house format with Height and High Waist (handle any text before "Measurements:")
            let measurementsMatch = comments.match(/Measurements:\s*Height=([^,\n\r]+?),\s*Bust=([^,\n\r]+?),\s*High\s+Waist=([^,\n\r]+?),\s*Hips=([^\n\r]+?)(?:\n|$)/i);
            
            if (measurementsMatch && measurementsMatch.length >= 5) {
                // In-house format: Height, Bust, High Waist, Hips
                measurements.size = measurementsMatch[1].trim(); // Use Height as size (or could be N/A)
                measurements.bust = measurementsMatch[2].trim();
                measurements.waist = measurementsMatch[3].trim(); // High Waist becomes waist
                measurements.hips = measurementsMatch[4].trim();
            } else {
                // Pattern 2: Standard format with Size and Waist
                measurementsMatch = comments.match(/Measurements:\s*Size=([^,\n\r]+?),\s*Bust=([^,\n\r]+?),\s*Waist=([^,\n\r]+?),\s*Hips=([^\n\r]+?)(?:\n|$)/i);
                
                // Pattern 3: More flexible, handles any spacing
                if (!measurementsMatch) {
                    measurementsMatch = comments.match(/Measurements:.*?Size=([^,\n\r]+?)[,\s]+Bust=([^,\n\r]+?)[,\s]+Waist=([^,\n\r]+?)[,\s]+Hips=([^\n\r]+?)(?:\n|$)/i);
                }
                
                // Pattern 4: Very flexible, just find the values (standard format)
                if (!measurementsMatch) {
                    measurementsMatch = comments.match(/Size=([^,\n\r]+?)[,\s]+Bust=([^,\n\r]+?)[,\s]+Waist=([^,\n\r]+?)[,\s]+Hips=([^\n\r]+?)(?:\n|$)/i);
                }
                
                // Pattern 5: Very flexible, just find the values (in-house format)
                if (!measurementsMatch) {
                    measurementsMatch = comments.match(/Height=([^,\n\r]+?)[,\s]+Bust=([^,\n\r]+?)[,\s]+High\s+Waist=([^,\n\r]+?)[,\s]+Hips=([^\n\r]+?)(?:\n|$)/i);
                }
                
                if (measurementsMatch && measurementsMatch.length >= 5) {
                    // Check if it's in-house format (has Height) or standard format (has Size)
                    const firstMatch = measurementsMatch[0];
                    if (firstMatch.includes('Height=')) {
                        // In-house format
                        measurements.size = measurementsMatch[1].trim();
                        measurements.bust = measurementsMatch[2].trim();
                        measurements.waist = measurementsMatch[3].trim();
                        measurements.hips = measurementsMatch[4].trim();
                    } else {
                        // Standard format
                        measurements.size = measurementsMatch[1].trim();
                        measurements.bust = measurementsMatch[2].trim();
                        measurements.waist = measurementsMatch[3].trim();
                        measurements.hips = measurementsMatch[4].trim();
                    }
                }
            }
            
            if (measurementsMatch && measurementsMatch.length >= 5) {
                // Remove measurements line from comments (handle both single line and multi-line)
                comments = comments.replace(/\n?Measurements:.*$/m, '').trim();
                // Also remove if it's at the end of a line
                comments = comments.replace(/Measurements:.*$/m, '').trim();
            }
        }

        // Format date
        const orderDate = order.created_at ? new Date(order.created_at).toISOString().split('T')[0] : '';

        // Process order_items if available
        let items = [];
        if (orderItems && orderItems.length > 0) {
            console.log(`📦 Processing ${orderItems.length} items for order ${order.id}`);
            items = orderItems.map(item => {
                let itemMeasurements = {};
                if (item.measurements) {
                    try {
                        itemMeasurements = typeof item.measurements === 'string' 
                            ? JSON.parse(item.measurements) 
                            : item.measurements;
                    } catch (e) {
                        itemMeasurements = {};
                    }
                }
                return {
                    productName: item.products?.name || 'Unknown Product',
                    productImage: item.products?.image_url || 'https://via.placeholder.com/400',
                    color: item.color || '',
                    price: item.price || 0,
                    measurements: itemMeasurements
                };
            });
            console.log(`✅ Created ${items.length} items for order ${order.id}:`, items.map(i => i.productName));
        } else {
            // Fallback to single item (backward compatibility)
            console.log(`ℹ️ No order_items found for order ${order.id}, using single item fallback`);
            items = [{
                productName: order.products?.name || order.product_name || 'Unknown Product',
                productImage: order.products?.image_url || order.product_image || order.image_url || 'https://via.placeholder.com/400',
                color: order.color || '',
                price: order.price || 0,
                measurements: measurements
            }];
        }

        return {
            id: order.id,
            customerName: order.customers?.name || order.customer_name || 'Unknown Customer',
            phone: order.customers?.phone || order.phone || '',
            productName: items[0]?.productName || 'Unknown Product', // First item for backward compatibility
            productImage: items[0]?.productImage || 'https://via.placeholder.com/400', // First item for backward compatibility
            color: items[0]?.color || '', // First item for backward compatibility
            price: order.price || 0, // Total price
            items: items, // Array of all items
            measurements: measurements,
            comments: comments,
            date: orderDate,
            deliveryOption: order.delivery_option || order.deliveryOption || '',
            paymentOption: order.payment_option || order.paymentOption || '',
            paymentReference: order.payment_reference || order.paymentReference || '',
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
        
        // Check if order has multiple items
        const items = order.items || [order]; // Fallback to single item if items array doesn't exist
        const isMultiItem = items.length > 1;
        
        // Debug logging
        console.log(`🎨 Creating bubble for order ${order.id}:`, {
            hasItems: !!order.items,
            itemsCount: order.items?.length || 0,
            isMultiItem: isMultiItem,
            items: items.map(i => ({ name: i.productName, color: i.color }))
        });
        
        // Generate items HTML with horizontal images
        let itemsHTML = '';
        if (isMultiItem) {
            itemsHTML = `
                <div style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid rgba(0,0,0,0.1);">
                    <div style="display: flex; gap: 12px; overflow-x: auto; padding-bottom: 8px;">
                        ${items.map(item => `
                            <div style="flex-shrink: 0; text-align: center; min-width: 100px;">
                                <img src="${item.productImage}" alt="${item.productName}" 
                                     style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; margin-bottom: 6px; border: 2px solid rgba(27, 77, 62, 0.2);">
                                <div style="font-size: 12px; font-weight: 600; color: #2d3748; margin-bottom: 2px;">${item.productName}</div>
                                <div style="font-size: 11px; color: #718096; margin-bottom: 2px;">Color: ${item.color}</div>
                                <div style="font-size: 12px; font-weight: 600; color: #1B4D3E;">KES ${item.price.toLocaleString()}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        bubble.innerHTML = `
            <div class="order-header">
                ${!isMultiItem ? `<img src="${order.productImage}" alt="${order.productName}" class="order-image">` : ''}
                <div class="order-info" style="${isMultiItem ? 'width: 100%;' : ''}">
                    <div class="customer-name">${order.customerName}</div>
                    ${!isMultiItem ? `
                        <div class="product-name">${order.productName}</div>
                        <span class="product-color">Colour: ${order.color}</span>
                    ` : `
                        <div class="product-name" style="margin-top: 4px;">${items.length} Item${items.length > 1 ? 's' : ''}</div>
                    `}
                </div>
            </div>
            ${itemsHTML}
            <div class="order-details" id="details-${order.id}">
                ${this.renderOrderDetails(order)}
            </div>
            <div class="order-actions">
                <button class="btn btn-accept" data-action="accept" data-id="${order.id}">Accept</button>
                <button class="btn btn-deny" data-action="reject" data-id="${order.id}">Reject</button>
            </div>
        `;

        // Note: Click handler for expanding is now handled via event delegation in init()
        // Add button click handlers (stop propagation to prevent toggle)
        const acceptBtn = bubble.querySelector('[data-action="accept"]');
        const rejectBtn = bubble.querySelector('[data-action="reject"]');
        
        if (acceptBtn) {
            acceptBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.acceptOrder(order.id);
            });
        }

        if (rejectBtn) {
            rejectBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.denyOrder(order.id);
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
        const items = order.items || [order];
        const isMultiItem = items.length > 1;
        
        return `
            <div class="detail-row">
                <div class="detail-label">Phone:</div>
                <div class="detail-value">${order.phone}</div>
            </div>
            ${isMultiItem ? `
                <div class="detail-row">
                    <div class="detail-label">Items:</div>
                    <div class="detail-value">${items.length} item${items.length > 1 ? 's' : ''}</div>
                </div>
            ` : ''}
            <div class="detail-row">
                <div class="detail-label">${isMultiItem ? 'Total Price:' : 'Price:'}</div>
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
