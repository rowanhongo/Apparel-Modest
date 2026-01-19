/**
 * Production Service
 * Service for managing in-progress orders - mark as done
 */

class ProductionService {
    constructor() {
        this.orders = [];
        this.filteredOrders = [];
        this.searchTerm = '';
        this.container = null;
        this.onOrderUpdateCallback = null;
        this.supabase = null;
        this.ordersChannel = null; // Realtime subscription channel
        this.checkedOrders = new Set(); // Track which orders are checked
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
        
        // Set up search input listener
        this.setupSearchInput();
    }

    /**
     * Load orders from Supabase database
     */
    async loadOrdersFromDatabase() {
        try {
            // Fetch orders with status 'in_progress'
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

            // Validate customer data integrity before transforming
            const validatedOrders = (orders || []).map(order => {
                // Verify customer relationship is correct
                if (order.customer_id && order.customers) {
                    if (typeof order.customers === 'object' && !Array.isArray(order.customers)) {
                        // Validate customer ID matches (if customer object has id)
                        if (order.customers.id && order.customers.id !== order.customer_id) {
                            console.error(`⚠️ Customer ID mismatch for order ${order.id}: order.customer_id=${order.customer_id}, customer.id=${order.customers.id}`);
                        }
                    }
                }
                return order;
            });

            // Transform Supabase data to match expected format
            this.orders = validatedOrders.map(order => this.transformOrder(order));
            this.filterOrders();
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
        this.filterOrders();
        this.render();
    }

    /**
     * Filter orders based on search term
     */
    filterOrders() {
        if (!this.searchTerm || this.searchTerm.trim() === '') {
            this.filteredOrders = [...this.orders];
        } else {
            const searchLower = this.searchTerm.toLowerCase().trim();
            this.filteredOrders = this.orders.filter(order => {
                const customerName = (order.customerName || '').toLowerCase();
                return customerName.includes(searchLower);
            });
        }
    }

    /**
     * Render orders in the container
     */
    render() {
        if (!this.container) return;

        this.container.innerHTML = '';

        if (this.filteredOrders.length === 0) {
            // Show empty state message
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'empty-state-message';
            emptyMessage.style.cssText = 'text-align: center; padding: 60px 20px; color: rgba(65, 70, 63, 0.6); font-size: 18px; font-weight: 500;';
            emptyMessage.textContent = this.searchTerm ? 'No orders found matching your search' : 'No production requests yet';
            this.container.appendChild(emptyMessage);
        } else {
            this.filteredOrders.forEach(order => {
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
        
        // Check if this order is already checked (normalize ID to string for consistency)
        const orderIdStr = String(order.id);
        const isChecked = this.checkedOrders.has(orderIdStr);
        const checkboxStyle = isChecked 
            ? 'border: 2px solid #4CAF50; background: rgba(76, 175, 80, 0.1);'
            : 'border: 2px solid rgba(65, 70, 63, 0.4); background: white;';
        const checkboxContent = isChecked 
            ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display: block;">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>`
            : '';

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
            <div class="order-actions" style="display: flex; align-items: center; gap: 16px; justify-content: flex-end;">
                <div class="production-checkbox-container" data-order-id="${order.id}" style="display: flex; align-items: center; cursor: pointer; user-select: none; -webkit-user-select: none;">
                    <div class="production-checkbox" data-order-id="${order.id}" style="
                        width: 24px;
                        height: 24px;
                        ${checkboxStyle}
                        border-radius: 4px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        transition: all 0.2s ease;
                        position: relative;
                    ">
                        ${checkboxContent}
                    </div>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-edit" data-action="edit" data-id="${order.id}" style="background-color: #4A90E2; color: white; border: none;">Edit</button>
                    <button class="btn btn-done" data-action="done" data-id="${order.id}">Mark as Done</button>
                </div>
            </div>
        `;

        // Note: Click handler for expanding is now handled via event delegation in init()
        // Add button click handlers (stop propagation to prevent toggle)
        const editBtn = bubble.querySelector('[data-action="edit"]');
        const doneBtn = bubble.querySelector('[data-action="done"]');
        
        if (editBtn) {
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.editOrder(order);
            });
        }
        
        if (doneBtn) {
            doneBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.markAsDone(order.id);
            });
        }

        // Add checkbox toggle handler
        const checkboxContainer = bubble.querySelector('.production-checkbox-container');
        const checkbox = bubble.querySelector('.production-checkbox');
        
        if (checkboxContainer && checkbox) {
            const handleCheckboxClick = (e) => {
                e.stopPropagation();
                e.preventDefault();
                
                // Normalize order ID to string for consistent Set operations
                const orderIdStr = String(order.id);
                const isChecked = this.checkedOrders.has(orderIdStr);
                
                if (isChecked) {
                    // Uncheck - only remove if manually unchecked
                    this.checkedOrders.delete(orderIdStr);
                    checkbox.innerHTML = '';
                    checkbox.style.borderColor = 'rgba(65, 70, 63, 0.4)';
                    checkbox.style.background = 'white';
                } else {
                    // Check - add to Set to persist state
                    this.checkedOrders.add(orderIdStr);
                    checkbox.innerHTML = `
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display: block;">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    `;
                    checkbox.style.borderColor = '#4CAF50';
                    checkbox.style.background = 'rgba(76, 175, 80, 0.1)';
                }
            };
            
            checkboxContainer.addEventListener('click', handleCheckboxClick);
            checkbox.addEventListener('click', handleCheckboxClick);
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
     * Edit an order
     * @param {Object} order - Order object
     */
    editOrder(order) {
        this.showEditModal(order);
    }

    /**
     * Show edit modal for order
     * @param {Object} order - Order object
     */
    showEditModal(order) {
        // Create modal overlay
        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'editOrderModal';
        modalOverlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center;';
        
        const items = order.items || [order];
        const isMultiItem = items.length > 1;
        
        // Build items HTML for editing
        let itemsEditHTML = '';
        items.forEach((item, index) => {
            itemsEditHTML += `
                <div style="border: 1px solid rgba(27, 77, 62, 0.2); border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                    <h3 style="margin: 0 0 12px 0; color: #1B4D3E; font-size: 16px;">Item ${index + 1}: ${item.productName}</h3>
                    <div style="margin-bottom: 12px;">
                        <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #2d3748;">Color:</label>
                        <input type="text" id="edit-color-${index}" value="${item.color || ''}" 
                               style="width: 100%; padding: 8px 12px; border: 2px solid rgba(27, 77, 62, 0.2); border-radius: 6px; font-size: 14px; outline: none;"
                               onfocus="this.style.borderColor='#1B4D3E';" 
                               onblur="this.style.borderColor='rgba(27, 77, 62, 0.2)';">
                    </div>
                </div>
            `;
        });
        
        modalOverlay.innerHTML = `
            <div style="background: white; border-radius: 12px; padding: 24px; max-width: 600px; width: 90%; max-height: 90vh; overflow-y: auto; box-shadow: 0 10px 40px rgba(0,0,0,0.2);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                    <h2 style="margin: 0; color: #1B4D3E; font-size: 24px;">Edit Order</h2>
                    <button id="closeEditModal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #718096; padding: 0; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">&times;</button>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <div style="font-weight: 600; color: #2d3748; margin-bottom: 8px;">Customer:</div>
                    <div style="color: #718096;">${order.customerName}</div>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <h3 style="margin: 0 0 12px 0; color: #1B4D3E; font-size: 18px;">Items</h3>
                    ${itemsEditHTML}
                </div>
                
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #2d3748;">Measurements:</label>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div>
                            <label style="display: block; margin-bottom: 4px; font-size: 12px; color: #718096;">Size:</label>
                            <input type="text" id="edit-measurement-size" value="${order.measurements?.size || ''}" 
                                   style="width: 100%; padding: 8px 12px; border: 2px solid rgba(27, 77, 62, 0.2); border-radius: 6px; font-size: 14px; outline: none;"
                                   onfocus="this.style.borderColor='#1B4D3E';" 
                                   onblur="this.style.borderColor='rgba(27, 77, 62, 0.2)';">
                        </div>
                        <div>
                            <label style="display: block; margin-bottom: 4px; font-size: 12px; color: #718096;">Bust:</label>
                            <input type="text" id="edit-measurement-bust" value="${order.measurements?.bust || ''}" 
                                   style="width: 100%; padding: 8px 12px; border: 2px solid rgba(27, 77, 62, 0.2); border-radius: 6px; font-size: 14px; outline: none;"
                                   onfocus="this.style.borderColor='#1B4D3E';" 
                                   onblur="this.style.borderColor='rgba(27, 77, 62, 0.2)';">
                        </div>
                        <div>
                            <label style="display: block; margin-bottom: 4px; font-size: 12px; color: #718096;">Waist:</label>
                            <input type="text" id="edit-measurement-waist" value="${order.measurements?.waist || ''}" 
                                   style="width: 100%; padding: 8px 12px; border: 2px solid rgba(27, 77, 62, 0.2); border-radius: 6px; font-size: 14px; outline: none;"
                                   onfocus="this.style.borderColor='#1B4D3E';" 
                                   onblur="this.style.borderColor='rgba(27, 77, 62, 0.2)';">
                        </div>
                        <div>
                            <label style="display: block; margin-bottom: 4px; font-size: 12px; color: #718096;">Hips:</label>
                            <input type="text" id="edit-measurement-hips" value="${order.measurements?.hips || ''}" 
                                   style="width: 100%; padding: 8px 12px; border: 2px solid rgba(27, 77, 62, 0.2); border-radius: 6px; font-size: 14px; outline: none;"
                                   onfocus="this.style.borderColor='#1B4D3E';" 
                                   onblur="this.style.borderColor='rgba(27, 77, 62, 0.2)';">
                        </div>
                    </div>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #2d3748;">Comments:</label>
                    <textarea id="edit-comments" rows="4" 
                              style="width: 100%; padding: 8px 12px; border: 2px solid rgba(27, 77, 62, 0.2); border-radius: 6px; font-size: 14px; outline: none; resize: vertical; font-family: inherit;"
                              onfocus="this.style.borderColor='#1B4D3E';" 
                              onblur="this.style.borderColor='rgba(27, 77, 62, 0.2)';">${order.comments || ''}</textarea>
                </div>
                
                <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
                    <button id="cancelEditOrder" style="padding: 10px 20px; background: #E2E8F0; color: #2d3748; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer;">Cancel</button>
                    <button id="saveEditOrder" style="padding: 10px 20px; background: #1B4D3E; color: white; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer;">Save Changes</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modalOverlay);
        
        // Close modal handlers
        const closeModal = () => {
            document.body.removeChild(modalOverlay);
        };
        
        modalOverlay.querySelector('#closeEditModal').addEventListener('click', closeModal);
        modalOverlay.querySelector('#cancelEditOrder').addEventListener('click', closeModal);
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                closeModal();
            }
        });
        
        // Save handler
        modalOverlay.querySelector('#saveEditOrder').addEventListener('click', async () => {
            const saveButton = modalOverlay.querySelector('#saveEditOrder');
            const originalText = saveButton.textContent;
            saveButton.disabled = true;
            saveButton.textContent = 'Saving...';
            
            try {
                const success = await this.saveOrderEdit(order);
                if (success) {
                    closeModal();
                } else {
                    saveButton.disabled = false;
                    saveButton.textContent = originalText;
                }
            } catch (error) {
                saveButton.disabled = false;
                saveButton.textContent = originalText;
            }
        });
    }

    /**
     * Save order edits to database
     * @param {Object} order - Original order object
     */
    async saveOrderEdit(order) {
        try {
            const items = order.items || [order];
            const isMultiItem = items.length > 1;
            
            // Collect updated item colors
            const updatedItems = items.map((item, index) => {
                const colorInput = document.getElementById(`edit-color-${index}`);
                const newColor = colorInput ? colorInput.value.trim() : item.color;
                
                return {
                    ...item,
                    color: newColor
                };
            });
            
            // Collect updated measurements
            const sizeInput = document.getElementById('edit-measurement-size');
            const bustInput = document.getElementById('edit-measurement-bust');
            const waistInput = document.getElementById('edit-measurement-waist');
            const hipsInput = document.getElementById('edit-measurement-hips');
            
            const updatedMeasurements = {
                size: sizeInput ? sizeInput.value.trim() : (order.measurements?.size || ''),
                bust: bustInput ? bustInput.value.trim() : (order.measurements?.bust || ''),
                waist: waistInput ? waistInput.value.trim() : (order.measurements?.waist || ''),
                hips: hipsInput ? hipsInput.value.trim() : (order.measurements?.hips || '')
            };
            
            // Collect updated comments
            const commentsInput = document.getElementById('edit-comments');
            let updatedComments = commentsInput ? commentsInput.value.trim() : (order.comments || '');
            
            // Remove existing measurements line from comments if it exists
            updatedComments = updatedComments.replace(/\n?Measurements:.*$/m, '').trim();
            updatedComments = updatedComments.replace(/Measurements:.*$/m, '').trim();
            
            // Add measurements to comments (since measurements column doesn't exist in database)
            if (updatedMeasurements.size || updatedMeasurements.bust || updatedMeasurements.waist || updatedMeasurements.hips) {
                const measurementsText = `Measurements: Size=${updatedMeasurements.size || 'N/A'}, Bust=${updatedMeasurements.bust || 'N/A'}, Waist=${updatedMeasurements.waist || 'N/A'}, Hips=${updatedMeasurements.hips || 'N/A'}`;
                updatedComments = updatedComments ? `${updatedComments}\n${measurementsText}` : measurementsText;
            }
            
            // Update items array in database (JSONB column)
            const itemsForDB = updatedItems.map(item => ({
                product_name: item.productName,
                product_image: item.productImage,
                color: item.color,
                price: item.price,
                measurements: updatedMeasurements // Store measurements in items array
            }));
            
            // Update color field for backward compatibility (use first item's color)
            const updatedColor = updatedItems[0]?.color || order.color || '';
            
            // Ensure order.id is a string (UUID)
            const orderIdStr = String(order.id);
            
            // Update order in database (DO NOT include measurements column - it doesn't exist)
            const { data, error } = await this.supabase
                .from('orders')
                .update({
                    items: itemsForDB,
                    color: updatedColor,
                    comments: updatedComments || null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', orderIdStr)
                .select();
            
            if (error) {
                console.error('❌ Error updating order:', error);
                console.error('📋 Full error object:', JSON.stringify(error, null, 2));
                console.error('🔍 Error message:', error.message);
                console.error('🔍 Error hint:', error.hint);
                console.error('🔍 Error details:', error.details);
                console.error('🔍 Error code:', error.code);
                console.error('📝 Order ID:', orderIdStr);
                console.error('📝 Order data being sent:', {
                    items: itemsForDB,
                    color: updatedColor,
                    measurements: updatedMeasurements,
                    comments: updatedComments
                });
                alert(`Failed to update order: ${error.message || 'Unknown error'}. Please check the console (F12) for details.`);
                return false;
            }
            
            if (!data || data.length === 0) {
                console.error('⚠️ No data returned from update, order may not exist');
                alert('Order not found in database. Please refresh the page.');
                return false;
            }
            
            // Update local order data
            const orderIndex = this.orders.findIndex(o => o.id === order.id);
            if (orderIndex !== -1) {
                this.orders[orderIndex] = {
                    ...this.orders[orderIndex],
                    items: updatedItems,
                    color: updatedColor,
                    measurements: updatedMeasurements,
                    comments: updatedComments
                };
                this.filterOrders();
                this.render();
            }
            
            alert('✓ Order updated successfully');
            return true;
        } catch (error) {
            console.error('❌ Unexpected error saving order edit:', error);
            console.error('📋 Full error object:', JSON.stringify(error, null, 2));
            console.error('🔍 Error message:', error.message);
            console.error('🔍 Error stack:', error.stack);
            alert(`Failed to update order: ${error.message || 'Unknown error'}. Please check the console (F12) for details.`);
            return false;
        }
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
            // Explicitly update updated_at to track when order was marked as done in production
            // If this fails with a constraint error, the database constraint needs to be updated
            const { data, error } = await this.supabase
                .from('orders')
                .update({ 
                    status: 'to_deliver',
                    updated_at: new Date().toISOString()
                })
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
            this.filterOrders();
            
            // Remove from checked orders set if it was checked (normalize ID to string)
            this.checkedOrders.delete(String(orderId));

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
     * Set up search input listener
     */
    setupSearchInput() {
        const searchInput = document.getElementById('productionSearchInput');
        if (searchInput) {
            // Remove existing listener if any
            searchInput.removeEventListener('input', this.handleSearchInput);
            // Create bound handler
            this.handleSearchInput = (e) => {
                this.searchTerm = e.target.value;
                this.filterOrders();
                this.render();
            };
            searchInput.addEventListener('input', this.handleSearchInput);
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

