/**
 * Deleted Orders Service
 * Service for managing deleted orders - viewing and restoring
 */

class DeletedOrdersService {
    constructor() {
        this.orders = [];
        this.container = null;
        this.supabase = null;
        this.ordersChannel = null; // Realtime subscription channel
    }

    /**
     * Initialize the deleted orders service
     * @param {string} containerId - ID of the container element
     */
    async init(containerId) {
        this.container = document.getElementById(containerId);
        
        // Get Supabase client
        this.supabase = getSupabaseClient();
        if (!this.supabase) {
            console.error('❌ Supabase client not available');
            return;
        }

        if (!this.container) {
            console.error('Container not found:', containerId);
            return;
        }

        // Load deleted orders from database
        await this.loadDeletedOrders();
        
        // Set up realtime subscription for deleted orders
        this.setupDeletedOrdersRealtime();
    }

    /**
     * Load deleted orders from Supabase database
     */
    async loadDeletedOrders() {
        try {
            // Fetch orders where deleted_at is not null
            // CRITICAL: Explicitly select customer_id to ensure proper relationship mapping
            const { data: orders, error } = await this.supabase
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
                .not('deleted_at', 'is', null)
                .order('deleted_at', { ascending: false });

            if (error) {
                console.error('Error fetching deleted orders:', error);
                this.orders = [];
                this.render();
                return;
            }

            // Transform Supabase data to match expected format
            this.orders = (orders || []).map(order => this.transformOrder(order));
            this.render();
        } catch (error) {
            console.error('Error loading deleted orders:', error);
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

        // Process items from JSONB column or fallback to single item
        let items = [];
        if (order.items && Array.isArray(order.items) && order.items.length > 0) {
            items = order.items.map(item => ({
                productName: item.product_name || 'Unknown Product',
                productImage: item.product_image || 'https://via.placeholder.com/400',
                color: item.color || '',
                price: item.price || 0,
                measurements: item.measurements || {}
            }));
        } else {
            items = [{
                productName: order.products?.name || order.product_name || 'Unknown Product',
                productImage: order.products?.image_url || order.product_image || order.image_url || 'https://via.placeholder.com/400',
                color: order.color || '',
                price: order.price || 0,
                measurements: measurements
            }];
        }

        // Format dates
        const orderDate = order.created_at ? new Date(order.created_at).toISOString().split('T')[0] : '';
        const deletedDate = order.deleted_at ? new Date(order.deleted_at) : null;
        const deletedDateStr = deletedDate ? deletedDate.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }) : 'Unknown';

        // Get deleted by user name if available
        const deletedByName = order.deleted_by_name || order.deleted_by || 'Unknown';

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
        
        if (!customerPhone && !order.customer_id && order.phone) {
            customerPhone = order.phone;
        } else if (!customerPhone && order.customer_phone) {
            customerPhone = order.customer_phone;
        }

        return {
            id: order.id,
            customerName: customerName,
            phone: customerPhone,
            productName: items[0]?.productName || 'Unknown Product',
            productImage: items[0]?.productImage || 'https://via.placeholder.com/400',
            color: items[0]?.color || '',
            price: order.price || 0,
            items: items,
            measurements: measurements,
            comments: order.comments || order.notes || '',
            date: orderDate,
            deletedDate: deletedDateStr,
            deletedAt: order.deleted_at,
            deletedBy: deletedByName,
            originalStatus: order.original_status || order.status || 'pending',
            deliveryOption: order.delivery_option || order.deliveryOption || '',
            paymentOption: order.payment_option || order.paymentOption || '',
            paymentReference: order.payment_reference || order.paymentReference || '',
            deliveryLocation: order.delivery_display_name || order.delivery_location || order.deliveryLocation || ''
        };
    }

    /**
     * Render deleted orders in the container
     */
    render() {
        if (!this.container) return;

        this.container.innerHTML = '';

        if (this.orders.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'empty-state-message';
            emptyMessage.style.cssText = 'text-align: center; padding: 60px 20px; color: rgba(65, 70, 63, 0.6); font-size: 18px; font-weight: 500;';
            emptyMessage.textContent = 'No deleted orders';
            this.container.appendChild(emptyMessage);
            return;
        }

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
        
        const items = order.items || [order];
        const isMultiItem = items.length > 1;
        
        // Generate items HTML
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
        } else {
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
            <div style="padding: 12px; background: rgba(244, 67, 54, 0.1); border-radius: 8px; margin-top: 12px; border: 1px solid rgba(244, 67, 54, 0.2);">
                <div style="display: flex; flex-direction: column; gap: 6px; font-size: 13px;">
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: rgba(65, 70, 63, 0.8); font-weight: 600;">Original Status:</span>
                        <span style="color: #41463F; font-weight: 700; text-transform: capitalize;">${this.formatStatus(order.originalStatus)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: rgba(65, 70, 63, 0.8); font-weight: 600;">Deleted On:</span>
                        <span style="color: #41463F; font-weight: 700;">${order.deletedDate}</span>
                    </div>
                    ${order.deletedBy && order.deletedBy !== 'Unknown' ? `
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: rgba(65, 70, 63, 0.8); font-weight: 600;">Deleted By:</span>
                        <span style="color: #41463F; font-weight: 700;">${order.deletedBy}</span>
                    </div>
                    ` : ''}
                </div>
            </div>
            <div class="order-actions">
                <button class="btn btn-accept" data-action="restore" data-id="${order.id}">Restore</button>
            </div>
        `;

        // Add restore button handler
        const restoreBtn = bubble.querySelector('[data-action="restore"]');
        if (restoreBtn) {
            restoreBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.restoreOrder(order.id);
            });
        }

        // Add click handler for expanding
        bubble.addEventListener('click', (e) => {
            if (!e.target.closest('.btn')) {
                e.preventDefault();
                e.stopPropagation();
                bubble.classList.toggle('expanded');
            }
        });

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
            <div class="detail-row">
                <div class="detail-label">Items:</div>
                <div class="detail-value">${items.length} item${items.length > 1 ? 's' : ''}</div>
            </div>
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
     * Restore a deleted order
     * @param {string|number} orderId - Order ID
     */
    async restoreOrder(orderId) {
        const order = this.orders.find(o => o.id === orderId);
        if (!order) {
            alert('Order not found');
            return;
        }

        if (!confirm(`Are you sure you want to restore this order? It will be restored with status: ${this.formatStatus(order.originalStatus)}`)) {
            return;
        }

        try {
            // Restore order by clearing deleted_at and setting status back to original
            const { error } = await this.supabase
                .from('orders')
                .update({ 
                    deleted_at: null,
                    deleted_by: null,
                    original_status: null,
                    status: order.originalStatus,
                    updated_at: new Date().toISOString()
                })
                .eq('id', orderId);

            if (error) {
                console.error('Error restoring order:', error);
                alert('Failed to restore order. Please try again.');
                return;
            }

            // Remove from local array
            this.orders = this.orders.filter(o => o.id !== orderId);

            this.render();
            alert(`✓ Order restored successfully with status: ${this.formatStatus(order.originalStatus)}`);
        } catch (error) {
            console.error('Error restoring order:', error);
            alert('Failed to restore order. Please try again.');
        }
    }

    /**
     * Format status for display
     * @param {string} status - Status value
     * @returns {string} Formatted status
     */
    formatStatus(status) {
        const statusMap = {
            'pending': 'Pending',
            'in_progress': 'In Progress',
            'to_deliver': 'To Deliver',
            'completed': 'Completed',
            'cancelled': 'Cancelled'
        };
        return statusMap[status] || status;
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
     * Set up realtime subscription for deleted orders
     */
    setupDeletedOrdersRealtime() {
        if (!this.supabase) {
            console.warn('Supabase client not available for realtime subscription');
            return;
        }

        // Clean up existing subscription if any
        if (this.ordersChannel) {
            this.supabase.removeChannel(this.ordersChannel);
        }

        // Create new channel for orders table with deleted_at not null
        this.ordersChannel = this.supabase
            .channel('deleted-orders-changes')
            .on(
                'postgres_changes',
                {
                    event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
                    schema: 'public',
                    table: 'orders'
                },
                (payload) => {
                    console.log('Deleted orders realtime event:', payload.eventType, payload);
                    // Reload deleted orders when any change occurs
                    this.loadDeletedOrders();
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('✅ Subscribed to deleted orders realtime changes');
                } else if (status === 'CHANNEL_ERROR') {
                    console.error('❌ Error subscribing to deleted orders realtime');
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
     * Get current deleted orders
     * @returns {Array} Array of current deleted orders
     */
    getDeletedOrders() {
        return [...this.orders];
    }
}

// Create global instance
const deletedOrdersService = new DeletedOrdersService();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DeletedOrdersService;
}

