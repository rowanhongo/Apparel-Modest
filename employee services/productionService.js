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
        this.ordersChannel = null; // Realtime subscription channel
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

        // Set up event delegation for card clicks
        if (this.container) {
            console.log('Setting up event delegation for container:', containerId);
            // Remove any existing listener to avoid duplicates
            this.container.removeEventListener('click', this.handleCardClick);
            // Create bound handler
            this.handleCardClick = (e) => {
                const bubble = e.target.closest('.order-bubble');
                if (bubble && !e.target.closest('.btn')) {
                    e.preventDefault();
                    e.stopPropagation();
                    bubble.classList.toggle('expanded');
                    console.log('Card toggled via delegation, expanded:', bubble.classList.contains('expanded'));
                }
            };
            this.container.addEventListener('click', this.handleCardClick);
            console.log('Event delegation set up successfully');
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
            // Parse measurements from comments string
            // Format 1 (standard): "Measurements: Size=SS 6, Bust=32, Waist=25, Hips=36"
            // Format 2 (in-house): "Measurements: Height=N/A, Bust=38, High Waist=32, Hips=43"
            
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
                // Remove measurements line from comments
                comments = comments.replace(/\n?Measurements:.*$/m, '').trim();
                comments = comments.replace(/Measurements:.*$/m, '').trim();
            }
        }

        // Format date
        const orderDate = order.created_at ? new Date(order.created_at).toISOString().split('T')[0] : '';

        // Process items from JSONB column (new approach) or fallback to single item
        let items = [];
        
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

        this.container.innerHTML = '';

        if (this.orders.length === 0) {
            // Show empty state message
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'empty-state-message';
            emptyMessage.style.cssText = 'text-align: center; padding: 60px 20px; color: rgba(65, 70, 63, 0.6); font-size: 18px; font-weight: 500;';
            emptyMessage.textContent = 'No production requests yet';
            this.container.appendChild(emptyMessage);
        } else {
            this.orders.forEach(order => {
                const orderBubble = this.createOrderBubble(order);
                this.container.appendChild(orderBubble);
            });
        }
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
        
        // Generate items HTML - use same format for both single and multi-item for consistency
        let itemsHTML = '';
        if (isMultiItem) {
            // Multi-item: horizontal scrollable row
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
        } else {
            // Single-item: use same layout structure as multi-item for consistency
            itemsHTML = `
                <div style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid rgba(0,0,0,0.1);">
                    <div style="display: flex; gap: 12px; padding-bottom: 8px;">
                        <div style="flex-shrink: 0; text-align: center; min-width: 100px;">
                            <img src="${items[0].productImage}" alt="${items[0].productName}" 
                                 style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; margin-bottom: 6px; border: 2px solid rgba(27, 77, 62, 0.2);">
                            <div style="font-size: 12px; font-weight: 600; color: #2d3748; margin-bottom: 2px;">${items[0].productName}</div>
                            <div style="font-size: 11px; color: #718096; margin-bottom: 2px;">Color: ${items[0].color}</div>
                            <div style="font-size: 12px; font-weight: 600; color: #1B4D3E;">KES ${items[0].price.toLocaleString()}</div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        bubble.innerHTML = `
            <div class="order-header">
                <div class="order-info" style="width: 100%;">
                    <div class="customer-name">${order.customerName}</div>
                    <div class="product-name" style="margin-top: 4px;">${isMultiItem ? `${items.length} Item${items.length > 1 ? 's' : ''}` : items[0].productName}</div>
                </div>
            </div>
            ${itemsHTML}
            <div class="order-details" id="details-${order.id}">
                ${this.renderOrderDetails(order)}
            </div>
            <div class="order-actions">
                <button class="btn btn-done" data-action="done" data-id="${order.id}">Mark as Done</button>
            </div>
        `;

        // Note: Click handler for expanding is now handled via event delegation in init()
        // Add button click handler (stop propagation to prevent toggle)
        const doneBtn = bubble.querySelector('[data-action="done"]');
        if (doneBtn) {
            doneBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.markAsDone(order.id);
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
     * Set up realtime subscription for orders table (in_progress status)
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

        // Create new channel for orders table with status 'in_progress'
        this.ordersChannel = this.supabase
            .channel('orders-in-progress-changes')
            .on(
                'postgres_changes',
                {
                    event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
                    schema: 'public',
                    table: 'orders',
                    filter: 'status=eq.in_progress' // Only listen to in_progress orders
                },
                (payload) => {
                    console.log('Orders realtime event (production):', payload.eventType, payload);
                    // Reload orders when any change occurs
                    this.loadOrdersFromDatabase();
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('✅ Subscribed to orders realtime changes (production - in_progress)');
                } else if (status === 'CHANNEL_ERROR') {
                    console.error('❌ Error subscribing to orders realtime (production)');
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
    module.exports = ProductionService;
}

// Make available globally
if (typeof window !== 'undefined') {
    window.ProductionService = ProductionService;
}

