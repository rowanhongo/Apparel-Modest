/**
 * Overview Service
 * Service for admin overview dashboard - key metrics, charts, and business summary
 */

class OverviewService {
    constructor() {
        this.metrics = {
            totalOrders: 0,
            totalRevenue: 0,
            mostOrdered: '',
            popularColor: '',
            preferredDelivery: '',
            avgProcessingTime: '',
            ordersToday: 0
        };
        this.supabase = null;
        this.ordersChannel = null; // Realtime subscription channel
    }

    /**
     * Initialize the overview service
     */
    async init() {
        console.log('🚀 Initializing admin overview service...');
        
        // Get Supabase client
        this.supabase = getSupabaseClient();
        if (!this.supabase) {
            console.error('❌ Supabase client not available');
            return;
        }

        // Wait a bit to ensure DOM is ready
        await new Promise(resolve => setTimeout(resolve, 100));

        // Load all data
        await this.loadOverviewData();
        
        // Set up realtime subscription for orders
        this.setupOrdersRealtime();
        
        console.log('✅ Admin overview service initialized');
    }

    /**
     * Load all overview data from Supabase
     */
    async loadOverviewData() {
        try {
            console.log('📊 Loading admin overview data...');
            
            // Load metrics and charts in parallel
            const [metricsData, monthlyData, deliveryData] = await Promise.all([
                this.fetchMetrics(),
                this.fetchMonthlyOrders(),
                this.fetchDeliveryMethods()
            ]);

            console.log('✅ Admin overview data loaded:', {
                metrics: metricsData,
                monthly: monthlyData,
                delivery: deliveryData
            });

            // Update metrics
            this.updateMetrics(metricsData);

            // Render charts
            this.renderCharts({
                monthlyOrders: monthlyData,
                deliveryMethods: deliveryData
            });
        } catch (error) {
            console.error('❌ Error loading overview data:', error);
            // Fallback to empty metrics
            this.updateMetrics({
                totalOrders: 0,
                totalRevenue: 0,
                mostOrdered: 'N/A',
                popularColor: 'N/A',
                preferredDelivery: 'N/A',
                preferredDeliveryCount: 0,
                avgProcessingTime: 'N/A',
                ordersToday: 0,
                ordersTodayChange: 'No change'
            });
        }
    }

    /**
     * Fetch all metrics from database
     * @returns {Promise<Object>} Metrics object
     */
    async fetchMetrics() {
        try {
            console.log('📊 Fetching admin overview metrics...');
            
            // Get today's date (start of day) for orders today calculation
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const todayStr = today.toISOString();
            const tomorrowStr = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString();

            // Fetch ALL orders (not just current month) for total orders, revenue, and other metrics
            // Exclude deleted orders
            const { data: allOrders, error: allOrdersError } = await this.supabase
                .from('orders')
                .select(`
                    *,
                    products (
                        name
                    )
                `)
                .is('deleted_at', null)
                .order('created_at', { ascending: false });

            if (allOrdersError) {
                console.error('❌ Error fetching all orders:', allOrdersError);
                throw allOrdersError;
            }

            const allOrdersList = allOrders || [];
            console.log(`📦 Fetched ${allOrdersList.length} orders (excluding deleted)`);

            // Calculate total orders (all orders, not just this month)
            const totalOrders = allOrdersList.length;

            // Calculate total revenue (only from completed orders, all time)
            const completedOrders = allOrdersList.filter(order => order.status === 'completed');
            const totalRevenue = completedOrders.reduce((sum, order) => {
                return sum + (parseFloat(order.price) || 0);
            }, 0);

            // Calculate most ordered item - handle both JSONB items array and single product
            const itemCounts = {};
            allOrdersList.forEach(order => {
                // Check if order has items stored as JSONB array (new format)
                if (order.items && Array.isArray(order.items) && order.items.length > 0) {
                    order.items.forEach(item => {
                        const itemName = item.product_name || 'Unknown';
                        if (itemName && itemName !== 'Unknown') {
                            itemCounts[itemName] = (itemCounts[itemName] || 0) + 1;
                        }
                    });
                } else {
                    // Fallback to single product (old format)
                    const itemName = order.products?.name || order.product_name || 'Unknown';
                    if (itemName && itemName !== 'Unknown') {
                        itemCounts[itemName] = (itemCounts[itemName] || 0) + 1;
                    }
                }
            });
            const mostOrderedEntry = Object.entries(itemCounts).sort((a, b) => b[1] - a[1])[0];
            const mostOrdered = mostOrderedEntry 
                ? `${mostOrderedEntry[0]} (${mostOrderedEntry[1]} units)` 
                : 'N/A';

            // Calculate popular color - handle both JSONB items array and single product
            const colorCounts = {};
            allOrdersList.forEach(order => {
                // Check if order has items stored as JSONB array (new format)
                if (order.items && Array.isArray(order.items) && order.items.length > 0) {
                    order.items.forEach(item => {
                        const color = item.color || order.color;
                        if (color) {
                            colorCounts[color] = (colorCounts[color] || 0) + 1;
                        }
                    });
                } else {
                    // Fallback to single color (old format)
                    const color = order.color;
                    if (color) {
                        colorCounts[color] = (colorCounts[color] || 0) + 1;
                    }
                }
            });
            const popularColorEntry = Object.entries(colorCounts).sort((a, b) => b[1] - a[1])[0];
            const popularColor = popularColorEntry 
                ? `${popularColorEntry[0]} (${popularColorEntry[1]} orders)` 
                : 'N/A';

            // Calculate preferred delivery method (all orders)
            const deliveryCounts = {};
            allOrdersList.forEach(order => {
                const delivery = order.delivery_option || order.deliveryOption;
                if (delivery) {
                    deliveryCounts[delivery] = (deliveryCounts[delivery] || 0) + 1;
                }
            });
            const preferredDeliveryEntry = Object.entries(deliveryCounts).sort((a, b) => b[1] - a[1])[0];
            const preferredDelivery = preferredDeliveryEntry 
                ? preferredDeliveryEntry[0] 
                : 'N/A';
            const preferredDeliveryCount = preferredDeliveryEntry 
                ? preferredDeliveryEntry[1] 
                : 0;

            // Calculate orders today (only today's orders)
            const ordersToday = allOrdersList.filter(order => {
                const orderDate = new Date(order.created_at);
                return orderDate >= today && orderDate < new Date(tomorrowStr);
            }).length;

            // Calculate orders yesterday for comparison
            const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
            const yesterdayStr = yesterday.toISOString();
            const yesterdayEndStr = new Date(yesterday.getTime() + 24 * 60 * 60 * 1000).toISOString();
            
            // Fetch yesterday's orders for comparison (exclude deleted orders)
            const { data: yesterdayOrders, error: yesterdayError } = await this.supabase
                .from('orders')
                .select('created_at')
                .is('deleted_at', null)
                .gte('created_at', yesterdayStr)
                .lt('created_at', yesterdayEndStr);

            const ordersYesterday = (yesterdayOrders || []).length;

            // Calculate percentage change
            let ordersTodayChange = '';
            if (ordersYesterday > 0) {
                const change = ((ordersToday - ordersYesterday) / ordersYesterday) * 100;
                const sign = change >= 0 ? '+' : '';
                ordersTodayChange = `${sign}${change.toFixed(0)}% from yesterday`;
            } else if (ordersToday > 0) {
                ordersTodayChange = 'New orders today';
            } else {
                ordersTodayChange = 'No change';
            }

            // Calculate average processing time per stage
            const avgProcessingTime = await this.calculateAvgProcessingTime();

            return {
                totalOrders,
                totalRevenue,
                mostOrdered,
                popularColor,
                preferredDelivery,
                preferredDeliveryCount,
                avgProcessingTime,
                ordersToday,
                ordersTodayChange
            };
        } catch (error) {
            console.error('Error in fetchMetrics:', error);
            return {
                totalOrders: 0,
                totalRevenue: 0,
                mostOrdered: 'N/A',
                popularColor: 'N/A',
                preferredDelivery: 'N/A',
                preferredDeliveryCount: 0,
                avgProcessingTime: 'N/A',
                ordersToday: 0,
                ordersTodayChange: 'No change'
            };
        }
    }

    /**
     * Calculate average processing time per stage
     * @returns {Promise<string>} Average processing time string
     */
    async calculateAvgProcessingTime() {
        try {
            // Fetch completed orders with timestamps (exclude deleted orders)
            const { data: completedOrders, error } = await this.supabase
                .from('orders')
                .select('created_at, updated_at, status')
                .eq('status', 'completed')
                .is('deleted_at', null);

            if (error || !completedOrders || completedOrders.length === 0) {
                return 'N/A';
            }

            // Use updated_at as fallback if completed_at doesn't exist
            // Calculate time differences for each stage
            // For now, we'll use a simplified calculation based on updated_at - created_at
            // In a real system, you'd track stage transitions
            const processingTimes = completedOrders.map(order => {
                const created = new Date(order.created_at);
                const completed = order.updated_at ? new Date(order.updated_at) : new Date();
                const diffHours = (completed - created) / (1000 * 60 * 60);
                return diffHours;
            }).filter(time => time > 0 && isFinite(time));

            if (processingTimes.length === 0) {
                return 'N/A';
            }

            // Calculate average
            const avgHours = processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length;
            
            // Divide by 4 stages (Sales, Production, Logistics, After Sales) for per-stage average
            const avgPerStage = avgHours / 4;

            // Format as hours or minutes
            if (avgPerStage < 1) {
                return `${Math.round(avgPerStage * 60)} minutes`;
            } else {
                return `${avgPerStage.toFixed(1)} hours`;
            }
        } catch (error) {
            console.error('Error calculating avg processing time:', error);
            return 'N/A';
        }
    }

    /**
     * Fetch monthly orders data for bar chart
     * @returns {Promise<Object>} Monthly chart data
     */
    async fetchMonthlyOrders() {
        try {
            console.log('📊 Fetching monthly orders (all-time)...');
            
            // Fetch ALL orders (all-time, not just current year) - filter deleted in JavaScript
            const { data: orders, error } = await this.supabase
                .from('orders')
                .select('created_at, deleted_at');

            if (error) {
                console.error('Error fetching monthly orders:', error);
                return {
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                    values: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                    total: 0
                };
            }

            // Filter out deleted orders in JavaScript
            const validOrders = (orders || []).filter(order => !order.deleted_at);
            console.log(`📦 Processing ${validOrders.length} orders for monthly breakdown (all-time)`);

            // Group orders by month (0-11 for Jan-Dec) - combines all years
            // This shows total orders per month across all time
            const monthCounts = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

            validOrders.forEach(order => {
                const orderDate = new Date(order.created_at);
                const monthIndex = orderDate.getMonth(); // 0-11
                if (monthIndex >= 0 && monthIndex < 12) {
                    monthCounts[monthIndex]++;
                }
            });

            // Calculate total
            const total = monthCounts.reduce((sum, count) => sum + count, 0);
            console.log(`✅ Monthly orders calculated: Total = ${total}`);

            return {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                values: monthCounts,
                total: total
            };
        } catch (error) {
            console.error('Error in fetchMonthlyOrders:', error);
            return {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                values: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                total: 0
            };
        }
    }

    /**
     * Fetch delivery methods distribution for pie chart
     * @returns {Promise<Object>} Delivery methods chart data
     */
    async fetchDeliveryMethods() {
        try {
            console.log('📊 Fetching delivery methods (all-time)...');
            
            // Fetch all orders with delivery options (filter deleted in JavaScript)
            const { data: orders, error } = await this.supabase
                .from('orders')
                .select('delivery_option, deliveryOption, deleted_at');

            if (error) {
                console.error('Error fetching delivery methods:', error);
                return {
                    labels: [],
                    values: []
                };
            }

            // Filter out deleted orders in JavaScript
            const validOrders = (orders || []).filter(order => !order.deleted_at);
            console.log(`📦 Processing ${validOrders.length} orders for delivery methods`);

            // Count delivery methods - check both delivery_option and deliveryOption fields
            const deliveryCounts = {};
            validOrders.forEach(order => {
                // Try both field names to match employee view
                const delivery = order.delivery_option || order.deliveryOption;
                if (delivery && delivery.trim() !== '') {
                    deliveryCounts[delivery] = (deliveryCounts[delivery] || 0) + 1;
                }
            });
            
            console.log(`✅ Found ${Object.keys(deliveryCounts).length} delivery methods:`, deliveryCounts);

            // Convert to arrays for chart
            const entries = Object.entries(deliveryCounts).sort((a, b) => b[1] - a[1]);
            const labels = entries.map(([key]) => {
                // Format delivery option names
                const formatted = key
                    .replace(/-/g, ' ')
                    .replace(/\b\w/g, l => l.toUpperCase());
                return formatted;
            });
            const values = entries.map(([, count]) => count);

            return {
                labels,
                values
            };
        } catch (error) {
            console.error('Error in fetchDeliveryMethods:', error);
            return {
                labels: [],
                values: []
            };
        }
    }

    /**
     * Set up realtime subscription for orders table (all statuses for admin overview)
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

        // Create new channel for orders table (all statuses)
        this.ordersChannel = this.supabase
            .channel('orders-all-changes-overview')
            .on(
                'postgres_changes',
                {
                    event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
                    schema: 'public',
                    table: 'orders'
                },
                (payload) => {
                    console.log('Orders realtime event (admin overview):', payload.eventType, payload);
                    // Reload overview data when any order change occurs
                    this.loadOverviewData();
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('✅ Subscribed to orders realtime changes (admin overview)');
                } else if (status === 'CHANNEL_ERROR') {
                    console.error('❌ Error subscribing to orders realtime (admin overview)');
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
     * Update overview metrics in DOM
     * @param {Object} metricsData - Metrics data object
     */
    updateMetrics(metricsData = null) {
        if (metricsData) {
            this.metrics = { ...this.metrics, ...metricsData };
        }

        console.log('📝 Updating admin overview metrics:', this.metrics);

        // Update DOM elements
        const totalOrdersEl = document.getElementById('total-orders');
        const totalRevenueEl = document.getElementById('total-revenue');
        const mostOrderedEl = document.getElementById('most-ordered');
        const popularColorEl = document.getElementById('popular-color');
        const preferredDeliveryEl = document.getElementById('preferred-delivery');

        if (totalOrdersEl) {
            totalOrdersEl.textContent = this.metrics.totalOrders;
            console.log('✅ Updated total-orders:', this.metrics.totalOrders);
        } else {
            console.warn('⚠️ Element total-orders not found');
        }
        
        if (totalRevenueEl) {
            totalRevenueEl.textContent = `KES ${this.metrics.totalRevenue.toLocaleString()}`;
            console.log('✅ Updated total-revenue:', this.metrics.totalRevenue);
        } else {
            console.warn('⚠️ Element total-revenue not found');
        }
        
        if (mostOrderedEl) {
            mostOrderedEl.textContent = this.metrics.mostOrdered;
            console.log('✅ Updated most-ordered:', this.metrics.mostOrdered);
        } else {
            console.warn('⚠️ Element most-ordered not found');
        }
        
        if (popularColorEl) {
            popularColorEl.textContent = this.metrics.popularColor;
            console.log('✅ Updated popular-color:', this.metrics.popularColor);
        } else {
            console.warn('⚠️ Element popular-color not found');
        }
        
        if (preferredDeliveryEl) {
            // Format delivery option
            const formatted = this.metrics.preferredDelivery
                .replace(/-/g, ' ')
                .replace(/\b\w/g, l => l.toUpperCase());
            preferredDeliveryEl.textContent = formatted;
            console.log('✅ Updated preferred-delivery:', formatted);
        } else {
            console.warn('⚠️ Element preferred-delivery not found');
        }
        
        // Update preferred delivery count
        const preferredDeliveryCountEl = document.getElementById('preferred-delivery-count');
        if (preferredDeliveryCountEl) {
            const count = this.metrics.preferredDelivery !== 'N/A' ? 
                (this.metrics.preferredDeliveryCount || 0) : 0;
            preferredDeliveryCountEl.textContent = `${count} orders`;
        }
        
        // Update avg processing time
        const avgProcessingTimeEl = document.getElementById('avg-processing-time');
        if (avgProcessingTimeEl) avgProcessingTimeEl.textContent = this.metrics.avgProcessingTime;
        
        // Update orders today
        const ordersTodayEl = document.getElementById('orders-today');
        if (ordersTodayEl) ordersTodayEl.textContent = this.metrics.ordersToday;
        
        // Update orders today change
        const ordersTodayChangeEl = document.getElementById('orders-today-change');
        if (ordersTodayChangeEl && this.metrics.ordersTodayChange) {
            ordersTodayChangeEl.textContent = this.metrics.ordersTodayChange;
        }
    }

    /**
     * Render overview charts
     * @param {Object} chartData - Chart data for monthly orders and delivery methods
     */
    renderCharts(chartData = null) {
        // Monthly Orders Chart
        if (chartData?.monthlyOrders) {
            this.renderMonthlyOrdersChart(chartData.monthlyOrders);
        }

        // Delivery Methods Chart
        if (chartData?.deliveryMethods) {
            this.renderDeliveryMethodsChart(chartData.deliveryMethods);
        }
    }

    /**
     * Render monthly orders as vertical text list
     * @param {Object} data - Monthly orders data with labels and values
     */
    renderMonthlyOrdersChart(data) {
        const listContainer = document.getElementById('monthly-orders-list');
        if (!listContainer) return;

        // Clear existing content
        listContainer.innerHTML = '';

        if (!data.labels || data.labels.length === 0 || !data.values || data.values.length === 0) {
            const noDataDiv = document.createElement('div');
            noDataDiv.style.cssText = 'text-align: center; color: rgba(65, 70, 63, 0.6); font-size: 14px; padding: 20px;';
            noDataDiv.textContent = 'No data available';
            listContainer.appendChild(noDataDiv);
            
            // Update yearly total
            const yearlyTotalEl = document.getElementById('yearly-total-value');
            if (yearlyTotalEl) {
                yearlyTotalEl.textContent = '0';
            }
            return;
        }

        // Full month names mapping
        const monthNames = {
            'Jan': 'January',
            'Feb': 'February',
            'Mar': 'March',
            'Apr': 'April',
            'May': 'May',
            'Jun': 'June',
            'Jul': 'July',
            'Aug': 'August',
            'Sep': 'September',
            'Oct': 'October',
            'Nov': 'November',
            'Dec': 'December'
        };

        // Create list items for each month
        data.labels.forEach((label, i) => {
            const value = data.values[i];
            if (value === undefined || value === null) return;

            const itemDiv = document.createElement('div');
            const isMobile = window.innerWidth <= 768;
            itemDiv.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: ${isMobile ? '14px 12px' : '14px 16px'};
                background: rgba(255, 255, 255, 0.05);
                border-radius: 8px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                transition: all 0.2s ease;
                font-size: ${isMobile ? '14px' : '15px'};
                color: #41463F;
                font-weight: 500;
                min-height: ${isMobile ? '48px' : '48px'};
                width: 100%;
                box-sizing: border-box;
                margin-bottom: ${isMobile ? '8px' : '0'};
            `;
            
            // Add hover effect for desktop
            if (!isMobile) {
                itemDiv.addEventListener('mouseenter', function() {
                    this.style.background = 'rgba(255, 255, 255, 0.1)';
                    this.style.transform = 'translateX(4px)';
                });
                itemDiv.addEventListener('mouseleave', function() {
                    this.style.background = 'rgba(255, 255, 255, 0.05)';
                    this.style.transform = 'translateX(0)';
                });
            }

            // Get full month name
            const fullMonthName = monthNames[label] || label;
            const orderText = value === 1 ? 'order' : 'orders';

            const labelSpan = document.createElement('span');
            labelSpan.textContent = `${fullMonthName}:`;
            const isMobileCheck = window.innerWidth <= 768;
            labelSpan.style.cssText = `color: #41463F; font-weight: 600; font-size: ${isMobileCheck ? '14px' : '15px'}; flex: 1;`;

            const valueSpan = document.createElement('span');
            valueSpan.textContent = `${value} ${orderText}`;
            valueSpan.style.cssText = `color: #1B4D3E; font-weight: 700; font-size: ${isMobileCheck ? '15px' : '16px'}; white-space: nowrap; margin-left: 8px;`;

            itemDiv.appendChild(labelSpan);
            itemDiv.appendChild(valueSpan);
            listContainer.appendChild(itemDiv);
        });

        // Update yearly total
        const yearlyTotalEl = document.getElementById('yearly-total-value');
        if (yearlyTotalEl && data.total !== undefined) {
            yearlyTotalEl.textContent = data.total;
        }
    }

    /**
     * Render delivery methods as vertical text list
     * @param {Object} data - Delivery methods data with labels and values
     */
    renderDeliveryMethodsChart(data) {
        const listContainer = document.getElementById('delivery-methods-list');
        if (!listContainer) return;

        // Clear existing content
        listContainer.innerHTML = '';

        if (!data.labels || data.labels.length === 0 || !data.values || data.values.length === 0) {
            const noDataDiv = document.createElement('div');
            noDataDiv.style.cssText = 'text-align: center; color: rgba(65, 70, 63, 0.6); font-size: 14px; padding: 20px;';
            noDataDiv.textContent = 'No data available';
            listContainer.appendChild(noDataDiv);
            return;
        }

        // Format delivery option names for display
        const formatDeliveryName = (name) => {
            return name
                .replace(/-/g, ' ')
                .replace(/\b\w/g, l => l.toUpperCase())
                .replace(/In Store/i, 'In Store')
                .replace(/Pick Up Mtaani/i, 'Pick Up Mtaani');
        };

        // Create list items for each delivery method
        data.labels.forEach((label, i) => {
            const value = data.values[i];
            if (value === 0 || value === undefined || value === null) return; // Skip zero values

            const itemDiv = document.createElement('div');
            const isMobile = window.innerWidth <= 768;
            itemDiv.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: ${isMobile ? '14px 12px' : '14px 16px'};
                background: rgba(255, 255, 255, 0.05);
                border-radius: 8px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                transition: all 0.2s ease;
                font-size: ${isMobile ? '14px' : '15px'};
                color: #41463F;
                font-weight: 500;
                min-height: ${isMobile ? '48px' : '48px'};
                width: 100%;
                box-sizing: border-box;
                margin-bottom: ${isMobile ? '8px' : '0'};
            `;
            
            // Add hover effect for desktop
            if (!isMobile) {
                itemDiv.addEventListener('mouseenter', function() {
                    this.style.background = 'rgba(255, 255, 255, 0.1)';
                    this.style.transform = 'translateX(4px)';
                });
                itemDiv.addEventListener('mouseleave', function() {
                    this.style.background = 'rgba(255, 255, 255, 0.05)';
                    this.style.transform = 'translateX(0)';
                });
            }

            const deliveryText = value === 1 ? 'delivery' : 'deliveries';
            const formattedLabel = formatDeliveryName(label);

            const labelSpan = document.createElement('span');
            labelSpan.textContent = `${formattedLabel}:`;
            labelSpan.style.cssText = `color: #41463F; font-weight: 600; font-size: ${isMobile ? '14px' : '15px'}; flex: 1;`;

            const valueSpan = document.createElement('span');
            valueSpan.textContent = `${value} ${deliveryText}`;
            valueSpan.style.cssText = `color: #1B4D3E; font-weight: 700; font-size: ${isMobile ? '15px' : '16px'}; white-space: nowrap; margin-left: 8px;`;

            itemDiv.appendChild(labelSpan);
            itemDiv.appendChild(valueSpan);
            listContainer.appendChild(itemDiv);
        });
    }

    /**
     * Get current metrics
     * @returns {Object} Current metrics object
     */
    getMetrics() {
        return { ...this.metrics };
    }
}

// Create global instance
const overviewService = new OverviewService();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OverviewService;
}
