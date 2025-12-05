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
    }

    /**
     * Initialize the overview service
     */
    async init() {
        // Get Supabase client
        this.supabase = getSupabaseClient();
        if (!this.supabase) {
            console.error('❌ Supabase client not available');
            return;
        }

        // Load all data
        await this.loadOverviewData();
    }

    /**
     * Load all overview data from Supabase
     */
    async loadOverviewData() {
        try {
            // Load metrics and charts in parallel
            const [metricsData, monthlyData, deliveryData] = await Promise.all([
                this.fetchMetrics(),
                this.fetchMonthlyOrders(),
                this.fetchDeliveryMethods()
            ]);

            // Update metrics
            this.updateMetrics(metricsData);

            // Render charts
            this.renderCharts({
                monthlyOrders: monthlyData,
                deliveryMethods: deliveryData
            });
        } catch (error) {
            console.error('Error loading overview data:', error);
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
            // Get current month start
            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const monthStartStr = monthStart.toISOString();

            // Get today's date (start of day)
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const todayStr = today.toISOString();
            const tomorrowStr = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString();

            // Get current month end
            const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
            const monthEndStr = monthEnd.toISOString();

            // Fetch all orders from this month (for total orders and other metrics)
            const { data: orders, error } = await this.supabase
                .from('orders')
                .select(`
                    *,
                    products (
                        name
                    )
                `)
                .gte('created_at', monthStartStr)
                .lte('created_at', monthEndStr);

            if (error) {
                console.error('Error fetching orders:', error);
                throw error;
            }

            const ordersList = orders || [];

            // Calculate total orders this month
            const totalOrders = ordersList.length;

            // Calculate total revenue this month (only from completed orders)
            const completedOrders = ordersList.filter(order => order.status === 'completed');
            const totalRevenue = completedOrders.reduce((sum, order) => {
                return sum + (parseFloat(order.price) || 0);
            }, 0);

            // Calculate most ordered item
            const itemCounts = {};
            ordersList.forEach(order => {
                const itemName = order.products?.name || order.product_name || 'Unknown';
                if (itemName && itemName !== 'Unknown') {
                    itemCounts[itemName] = (itemCounts[itemName] || 0) + 1;
                }
            });
            const mostOrderedEntry = Object.entries(itemCounts).sort((a, b) => b[1] - a[1])[0];
            const mostOrdered = mostOrderedEntry 
                ? `${mostOrderedEntry[0]} (${mostOrderedEntry[1]} units)` 
                : 'N/A';

            // Calculate popular color
            const colorCounts = {};
            ordersList.forEach(order => {
                const color = order.color;
                if (color) {
                    colorCounts[color] = (colorCounts[color] || 0) + 1;
                }
            });
            const popularColorEntry = Object.entries(colorCounts).sort((a, b) => b[1] - a[1])[0];
            const popularColor = popularColorEntry 
                ? `${popularColorEntry[0]} (${popularColorEntry[1]} orders)` 
                : 'N/A';

            // Calculate preferred delivery method
            const deliveryCounts = {};
            ordersList.forEach(order => {
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

            // Calculate orders today
            const ordersToday = ordersList.filter(order => {
                const orderDate = new Date(order.created_at);
                return orderDate >= today && orderDate < new Date(tomorrowStr);
            }).length;

            // Calculate orders yesterday for comparison
            const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
            const yesterdayStr = yesterday.toISOString();
            const yesterdayEndStr = new Date(yesterday.getTime() + 24 * 60 * 60 * 1000).toISOString();
            const ordersYesterday = ordersList.filter(order => {
                const orderDate = new Date(order.created_at);
                return orderDate >= yesterday && orderDate < new Date(yesterdayEndStr);
            }).length;

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
            // Fetch completed orders with timestamps
            const { data: completedOrders, error } = await this.supabase
                .from('orders')
                .select('created_at, updated_at, status')
                .eq('status', 'completed');

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
            // Get current year start
            const now = new Date();
            const yearStart = new Date(now.getFullYear(), 0, 1);
            const yearEnd = new Date(now.getFullYear() + 1, 0, 1);

            // Fetch all orders from this year
            const { data: orders, error } = await this.supabase
                .from('orders')
                .select('created_at')
                .gte('created_at', yearStart.toISOString())
                .lt('created_at', yearEnd.toISOString());

            if (error) {
                console.error('Error fetching monthly orders:', error);
                return {
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                    values: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                    total: 0
                };
            }

            // Group orders by month (0-11 for Jan-Dec)
            const monthCounts = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

            orders?.forEach(order => {
                const orderDate = new Date(order.created_at);
                const monthIndex = orderDate.getMonth(); // 0-11
                if (monthIndex >= 0 && monthIndex < 12) {
                    monthCounts[monthIndex]++;
                }
            });

            // Calculate total
            const total = monthCounts.reduce((sum, count) => sum + count, 0);

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
            // Fetch all orders with delivery options
            const { data: orders, error } = await this.supabase
                .from('orders')
                .select('delivery_option');

            if (error) {
                console.error('Error fetching delivery methods:', error);
                return {
                    labels: [],
                    values: []
                };
            }

            // Count delivery methods
            const deliveryCounts = {};
            orders?.forEach(order => {
                const delivery = order.delivery_option || order.deliveryOption;
                if (delivery) {
                    deliveryCounts[delivery] = (deliveryCounts[delivery] || 0) + 1;
                }
            });

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
     * Update overview metrics in DOM
     * @param {Object} metricsData - Metrics data object
     */
    updateMetrics(metricsData = null) {
        if (metricsData) {
            this.metrics = { ...this.metrics, ...metricsData };
        }

        // Update DOM elements
        const totalOrdersEl = document.getElementById('total-orders');
        const totalRevenueEl = document.getElementById('total-revenue');
        const mostOrderedEl = document.getElementById('most-ordered');
        const popularColorEl = document.getElementById('popular-color');
        const preferredDeliveryEl = document.getElementById('preferred-delivery');

        if (totalOrdersEl) totalOrdersEl.textContent = this.metrics.totalOrders;
        if (totalRevenueEl) totalRevenueEl.textContent = `KES ${this.metrics.totalRevenue.toLocaleString()}`;
        if (mostOrderedEl) mostOrderedEl.textContent = this.metrics.mostOrdered;
        if (popularColorEl) popularColorEl.textContent = this.metrics.popularColor;
        if (preferredDeliveryEl) {
            // Format delivery option
            const formatted = this.metrics.preferredDelivery
                .replace(/-/g, ' ')
                .replace(/\b\w/g, l => l.toUpperCase());
            preferredDeliveryEl.textContent = formatted;
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
     * Render monthly orders bar chart
     * @param {Object} data - Monthly orders data with labels and values
     */
    renderMonthlyOrdersChart(data) {
        const chartContainer = document.querySelector('#admin-overview-content .chart-container');
        if (!chartContainer) return;

        // Find or create SVG element
        let svg = chartContainer.querySelector('svg');
        if (!svg) {
            svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('width', '100%');
            svg.setAttribute('height', '300');
            svg.setAttribute('viewBox', '0 0 800 300');
            
            // Add defs with gradients
            const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
            pattern.setAttribute('id', 'grid');
            pattern.setAttribute('width', '40');
            pattern.setAttribute('height', '30');
            pattern.setAttribute('patternUnits', 'userSpaceOnUse');
            const patternPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            patternPath.setAttribute('d', 'M 40 0 L 0 0 0 30');
            patternPath.setAttribute('fill', 'none');
            patternPath.setAttribute('stroke', 'rgba(224,216,201,0.1)');
            patternPath.setAttribute('stroke-width', '1');
            pattern.appendChild(patternPath);
            
            const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
            gradient.setAttribute('id', 'barGradient');
            gradient.setAttribute('x1', '0%');
            gradient.setAttribute('y1', '0%');
            gradient.setAttribute('x2', '0%');
            gradient.setAttribute('y2', '100%');
            const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
            stop1.setAttribute('offset', '0%');
            stop1.setAttribute('style', 'stop-color:#41463F;stop-opacity:1');
            const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
            stop2.setAttribute('offset', '100%');
            stop2.setAttribute('style', 'stop-color:#353C35;stop-opacity:1');
            gradient.appendChild(stop1);
            gradient.appendChild(stop2);
            
            defs.appendChild(pattern);
            defs.appendChild(gradient);
            svg.appendChild(defs);
            
            // Add grid background
            const gridRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            gridRect.setAttribute('width', '100%');
            gridRect.setAttribute('height', '100%');
            gridRect.setAttribute('fill', 'url(#grid)');
            svg.appendChild(gridRect);
            
            chartContainer.appendChild(svg);
        }

        // Clear existing chart bars and labels (but keep defs and grid)
        const existingBars = svg.querySelector('.chart-bars');
        if (existingBars) {
            existingBars.innerHTML = '';
        }
        const existingLabels = svg.querySelector('.chart-labels');
        if (existingLabels) {
            existingLabels.innerHTML = '';
        } else {
            // Create labels group if it doesn't exist
            const labelsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            labelsGroup.setAttribute('class', 'chart-labels');
            svg.appendChild(labelsGroup);
        }

        // Calculate max value for scaling
        const maxValue = Math.max(...data.values, 1);
        const barWidth = 30;
        const barSpacing = 30;
        const chartWidth = 800;
        const chartHeight = 300;
        const padding = 60;
        const availableWidth = chartWidth - (padding * 2);
        const totalBarWidth = (barWidth + barSpacing) * data.values.length;
        const startX = padding + (availableWidth - totalBarWidth) / 2;

        // Get or create bars group
        let barsGroup = svg.querySelector('.chart-bars');
        if (!barsGroup) {
            barsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            barsGroup.setAttribute('class', 'chart-bars');
            svg.appendChild(barsGroup);
        }

        // Get or create labels group
        let labelsGroup = svg.querySelector('.chart-labels');
        if (!labelsGroup) {
            labelsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            labelsGroup.setAttribute('class', 'chart-labels');
            labelsGroup.setAttribute('fill', '#2D332D');
            labelsGroup.setAttribute('font-size', '14');
            labelsGroup.setAttribute('font-weight', '700');
            svg.appendChild(labelsGroup);
        }

        data.values.forEach((value, i) => {
            const barHeight = maxValue > 0 ? (value / maxValue) * (chartHeight - padding - 40) : 0;
            const x = startX + i * (barWidth + barSpacing);
            const y = chartHeight - padding - barHeight;

            // Create bar rectangle
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', x);
            rect.setAttribute('y', y);
            rect.setAttribute('width', barWidth);
            rect.setAttribute('height', barHeight);
            rect.setAttribute('rx', '8');
            rect.setAttribute('ry', '8');
            rect.setAttribute('fill', 'url(#barGradient)');

            // Create value text
            const valueText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            valueText.setAttribute('x', x + barWidth / 2);
            valueText.setAttribute('y', y - 5);
            valueText.setAttribute('text-anchor', 'middle');
            valueText.setAttribute('fill', '#2D332D');
            valueText.setAttribute('font-size', '16');
            valueText.setAttribute('font-weight', '700');
            valueText.textContent = value;

            // Create month label
            const monthText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            monthText.setAttribute('x', x + barWidth / 2);
            monthText.setAttribute('y', chartHeight - 10);
            monthText.setAttribute('text-anchor', 'middle');
            monthText.setAttribute('fill', '#2D332D');
            monthText.setAttribute('font-size', '14');
            monthText.setAttribute('font-weight', '700');
            monthText.textContent = data.labels[i];

            barsGroup.appendChild(rect);
            barsGroup.appendChild(valueText);
            labelsGroup.appendChild(monthText);
        });

        // Update yearly total
        const yearlyTotalEl = document.getElementById('yearly-total-value');
        if (yearlyTotalEl && data.total !== undefined) {
            yearlyTotalEl.textContent = data.total;
        }
    }

    /**
     * Render delivery methods pie chart
     * @param {Object} data - Delivery methods data with labels and values
     */
    renderDeliveryMethodsChart(data) {
        const chartContainer = document.querySelector('#admin-overview-content .chart-container:nth-of-type(2)');
        if (!chartContainer) return;

        // Find or create SVG element
        let svg = chartContainer.querySelector('svg');
        if (!svg) {
            svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('width', '200');
            svg.setAttribute('height', '200');
            svg.setAttribute('viewBox', '0 0 200 200');
            
            // Add defs with gradients
            const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            const gradients = [
                { id: 'pieGradient1', color1: '#41463F', color2: '#353C35' },
                { id: 'pieGradient2', color1: '#4A5249', color2: '#353C35' },
                { id: 'pieGradient3', color1: '#50584F', color2: '#353C35' },
                { id: 'pieGradient4', color1: '#5A6259', color2: '#353C35' },
                { id: 'pieGradient5', color1: '#656D64', color2: '#353C35' }
            ];
            
            gradients.forEach(g => {
                const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
                gradient.setAttribute('id', g.id);
                gradient.setAttribute('x1', '0%');
                gradient.setAttribute('y1', '0%');
                gradient.setAttribute('x2', '100%');
                gradient.setAttribute('y2', '100%');
                const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
                stop1.setAttribute('offset', '0%');
                stop1.setAttribute('style', `stop-color:${g.color1};stop-opacity:1`);
                const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
                stop2.setAttribute('offset', '100%');
                stop2.setAttribute('style', `stop-color:${g.color2};stop-opacity:1`);
                gradient.appendChild(stop1);
                gradient.appendChild(stop2);
                defs.appendChild(gradient);
            });
            
            svg.appendChild(defs);
            
            // Add background circle
            const bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            bgCircle.setAttribute('cx', '100');
            bgCircle.setAttribute('cy', '100');
            bgCircle.setAttribute('r', '80');
            bgCircle.setAttribute('fill', 'none');
            bgCircle.setAttribute('stroke', 'rgba(224,216,201,0.1)');
            bgCircle.setAttribute('stroke-width', '2');
            svg.appendChild(bgCircle);
            
            chartContainer.appendChild(svg);
        }

        // Clear existing chart paths and texts (but keep defs and background)
        const existingPaths = svg.querySelectorAll('path[data-chart="delivery"]');
        existingPaths.forEach(path => path.remove());
        const existingTexts = svg.querySelectorAll('text[data-chart="delivery"]');
        existingTexts.forEach(text => text.remove());
        // Also remove old static paths and texts
        const oldPaths = svg.querySelectorAll('path:not([data-chart])');
        oldPaths.forEach(path => {
            if (path.getAttribute('fill') && path.getAttribute('fill').includes('Gradient')) {
                path.remove();
            }
        });
        const oldTexts = svg.querySelectorAll('text:not([data-chart])');
        oldTexts.forEach(text => {
            if (text.textContent && (text.textContent.includes('Uber') || text.textContent.includes('Courier') || text.textContent.includes('Pickup'))) {
                text.remove();
            }
        });

        if (!data.labels || data.labels.length === 0 || !data.values || data.values.length === 0) {
            // Show "No data" message
            const noDataText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            noDataText.setAttribute('x', '100');
            noDataText.setAttribute('y', '100');
            noDataText.setAttribute('text-anchor', 'middle');
            noDataText.setAttribute('fill', '#41463F');
            noDataText.setAttribute('font-size', '14');
            noDataText.setAttribute('font-weight', '600');
            noDataText.setAttribute('data-chart', 'delivery');
            noDataText.textContent = 'No data';
            svg.appendChild(noDataText);
            return;
        }

        const centerX = 100;
        const centerY = 100;
        const radius = 80;
        const innerRadius = radius * 0.6;

        const total = data.values.reduce((sum, val) => sum + val, 0);
        if (total === 0) return;

        let currentAngle = -Math.PI / 2;
        const gradients = ['pieGradient1', 'pieGradient2', 'pieGradient3', 'pieGradient4', 'pieGradient5'];

        data.values.forEach((value, i) => {
            if (value === 0) return;

            const sliceAngle = (value / total) * 2 * Math.PI;
            const endAngle = currentAngle + sliceAngle;

            // Create path for pie slice
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            const startX = centerX + Math.cos(currentAngle) * radius;
            const startY = centerY + Math.sin(currentAngle) * radius;
            const endX = centerX + Math.cos(endAngle) * radius;
            const endY = centerY + Math.sin(endAngle) * radius;
            const largeArc = sliceAngle > Math.PI ? 1 : 0;

            const pathData = [
                `M ${centerX} ${centerY}`,
                `L ${startX} ${startY}`,
                `A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY}`,
                'Z',
                `M ${centerX} ${centerY}`,
                `L ${endX} ${endY}`,
                `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${startX} ${startY}`,
                'Z'
            ].join(' ');

            path.setAttribute('d', pathData);
            path.setAttribute('fill', `url(#${gradients[i % gradients.length]})`);
            path.setAttribute('data-chart', 'delivery');
            svg.appendChild(path);

            // Add label
            const labelAngle = currentAngle + sliceAngle / 2;
            const labelDistance = radius + 30;
            const labelX = centerX + Math.cos(labelAngle) * labelDistance;
            const labelY = centerY + Math.sin(labelAngle) * labelDistance;
            const percentage = ((value / total) * 100).toFixed(0);

            const labelText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            labelText.setAttribute('x', labelX);
            labelText.setAttribute('y', labelY);
            labelText.setAttribute('text-anchor', 'middle');
            labelText.setAttribute('fill', '#41463F');
            labelText.setAttribute('font-size', '11');
            labelText.setAttribute('font-weight', '600');
            labelText.setAttribute('data-chart', 'delivery');
            labelText.textContent = `${data.labels[i]} ${percentage}%`;
            svg.appendChild(labelText);

            currentAngle = endAngle;
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
