/**
 * Analytics Service
 * Service for admin analytics dashboard - deep insights and performance analytics
 */

class AnalyticsService {
    constructor() {
        this.metrics = {
            totalCustomers: 0,
            activeCustomers: 0,
            repeatCustomerRate: 0,
            orderStatusBreakdown: {
                pending: 0,
                in_progress: 0,
                completed: 0,
                cancelled: 0
            },
            completionRate: 0,
            cancellationRate: 0,
            topCustomers: [],
            stagePerformance: {
                sales: { avgTime: 0, count: 0 },
                production: { avgTime: 0, count: 0 },
                instore: { avgTime: 0, count: 0 },
                logistics: { avgTime: 0, count: 0 }
            },
            weeklyOrderTrend: []
        };
        this.supabase = null;
    }

    /**
     * Initialize the analytics service
     */
    async init() {
        // Get Supabase client
        this.supabase = getSupabaseClient();
        if (!this.supabase) {
            console.error('❌ Supabase client not available');
            return;
        }

        // Load all analytics data
        await this.loadAnalyticsData();
    }

    /**
     * Load all analytics data from Supabase
     */
    async loadAnalyticsData() {
        try {
            // Load all metrics in parallel
            const [
                customerMetrics,
                statusBreakdown,
                topCustomersData,
                stagePerformanceData,
                weeklyTrendData
            ] = await Promise.all([
                this.fetchCustomerMetrics(),
                this.fetchOrderStatusBreakdown(),
                this.fetchTopCustomers(),
                this.fetchStagePerformance(),
                this.fetchWeeklyOrderTrend()
            ]);

            // Update metrics
            this.metrics = {
                ...this.metrics,
                ...customerMetrics,
                orderStatusBreakdown: statusBreakdown,
                topCustomers: topCustomersData,
                stagePerformance: stagePerformanceData,
                weeklyOrderTrend: weeklyTrendData
            };

            // Calculate derived metrics
            this.calculateDerivedMetrics();

            // Update DOM
            setTimeout(() => {
                this.updateMetrics();
                this.renderCharts();
            }, 100);
        } catch (error) {
            console.error('Error loading analytics data:', error);
            // Fallback to empty metrics
            setTimeout(() => {
                this.updateMetrics();
                this.renderCharts();
            }, 100);
        }
    }

    /**
     * Normalize phone number for consistent tracking
     * @param {string} phone - Phone number string
     * @returns {string} Normalized phone number
     */
    normalizePhone(phone) {
        if (!phone || typeof phone !== 'string') return null;
        // Remove spaces, dashes, and parentheses, keep only digits and +
        return phone.replace(/[\s\-\(\)]/g, '').trim();
    }

    /**
     * Get customer identifier (prioritize phone, fallback to email)
     * @param {Object} order - Order object
     * @returns {string|null} Customer identifier
     */
    getCustomerId(order) {
        // Check if customer relation exists
        const customer = order.customers || order.customer;
        
        // Prioritize phone number from customer relation
        const phone = this.normalizePhone(customer?.phone || order.customer_phone);
        if (phone && phone.length > 0) {
            return phone;
        }
        
        // Fallback to email from customer relation (only if customer relation exists)
        if (customer?.email && customer.email.trim().length > 0) {
            return customer.email.trim().toLowerCase();
        }
        
        // If neither available, return null (will be excluded from customer count)
        return null;
    }

    /**
     * Fetch customer metrics
     * @returns {Promise<Object>} Customer metrics
     */
    async fetchCustomerMetrics() {
        try {
            // Get all orders with customer information via relation
            const { data: orders, error } = await this.supabase
                .from('orders')
                .select(`
                    created_at,
                    status,
                    customers (
                        name,
                        phone,
                        email
                    )
                `);

            if (error) {
                throw error;
            }

            const ordersList = orders || [];

            // Get unique customers by phone number (primary) or email (fallback)
            const uniqueCustomers = new Set();
            const customerOrders = {};
            
            ordersList.forEach(order => {
                const customerId = this.getCustomerId(order);
                if (customerId) {
                    uniqueCustomers.add(customerId);
                    
                    if (!customerOrders[customerId]) {
                        customerOrders[customerId] = [];
                    }
                    customerOrders[customerId].push(order);
                }
            });

            const totalCustomers = uniqueCustomers.size;

            // Active customers (ordered in last 30 days)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const activeCustomers = new Set();
            
            ordersList.forEach(order => {
                const customerId = this.getCustomerId(order);
                if (customerId && new Date(order.created_at) >= thirtyDaysAgo) {
                    activeCustomers.add(customerId);
                }
            });

            // Repeat customers (customers with more than 1 order)
            let repeatCustomers = 0;
            Object.values(customerOrders).forEach(orders => {
                if (orders.length > 1) {
                    repeatCustomers++;
                }
            });

            const repeatCustomerRate = totalCustomers > 0 
                ? (repeatCustomers / totalCustomers) * 100 
                : 0;

            // Removed console.log for cleaner output

            return {
                totalCustomers,
                activeCustomers: activeCustomers.size,
                repeatCustomerRate: Math.round(repeatCustomerRate * 10) / 10
            };
        } catch (error) {
            console.error('Error fetching customer metrics:', error);
            return {
                totalCustomers: 0,
                activeCustomers: 0,
                repeatCustomerRate: 0
            };
        }
    }

    /**
     * Fetch order status breakdown
     * @returns {Promise<Object>} Status breakdown
     */
    async fetchOrderStatusBreakdown() {
        try {
            const { data: orders, error } = await this.supabase
                .from('orders')
                .select('status');

            if (error) {
                throw error;
            }

            const ordersList = orders || [];
            const breakdown = {
                pending: 0,
                in_progress: 0,
                completed: 0,
                cancelled: 0
            };

            ordersList.forEach(order => {
                const status = order.status || 'pending';
                if (breakdown.hasOwnProperty(status)) {
                    breakdown[status]++;
                } else {
                    breakdown.pending++;
                }
            });

            return breakdown;
        } catch (error) {
            console.error('Error fetching status breakdown:', error);
            return {
                pending: 0,
                in_progress: 0,
                completed: 0,
                cancelled: 0
            };
        }
    }

    /**
     * Fetch top customers by order count and revenue
     * @returns {Promise<Array>} Top customers array
     */
    async fetchTopCustomers() {
        try {
            const { data: orders, error } = await this.supabase
                .from('orders')
                .select(`
                    price,
                    status,
                    created_at,
                    customers (
                        name,
                        phone,
                        email
                    )
                `)
                .order('created_at', { ascending: false })
                .limit(1000);

            if (error) {
                throw error;
            }

            const ordersList = orders || [];
            const customerData = {};

            ordersList.forEach(order => {
                const customerId = this.getCustomerId(order);
                if (!customerId) return; // Skip orders without customer identifier
                
                const customer = order.customers || order.customer;
                const customerName = customer?.name || customerId;
                
                if (!customerData[customerId]) {
                    customerData[customerId] = {
                        name: customerName,
                        email: customer?.email || '',
                        phone: customer?.phone || '',
                        orderCount: 0,
                        totalRevenue: 0,
                        lastOrderDate: null
                    };
                }

                customerData[customerId].orderCount++;
                if (order.status === 'completed') {
                    customerData[customerId].totalRevenue += parseFloat(order.price) || 0;
                }
                
                const orderDate = new Date(order.created_at);
                if (!customerData[customerId].lastOrderDate || orderDate > customerData[customerId].lastOrderDate) {
                    customerData[customerId].lastOrderDate = orderDate;
                }
            });

            // Sort by order count, then by revenue
            const topCustomers = Object.values(customerData)
                .sort((a, b) => {
                    if (b.orderCount !== a.orderCount) {
                        return b.orderCount - a.orderCount;
                    }
                    return b.totalRevenue - a.totalRevenue;
                })
                .slice(0, 10);

            return topCustomers;
        } catch (error) {
            console.error('Error fetching top customers:', error);
            return [];
        }
    }

    /**
     * Fetch stage performance metrics
     * Uses status transitions and updated_at timestamps to calculate stage times
     * @returns {Promise<Object>} Stage performance data
     */
    async fetchStagePerformance() {
        try {
            // Try to fetch with completed_at, but handle if column doesn't exist
            let { data: orders, error } = await this.supabase
                .from('orders')
                .select('status, created_at, updated_at, completed_at')
                .order('created_at', { ascending: false })
                .limit(1000);

            // If error is about completed_at column, try without it
            if (error && error.message && (error.message.includes('completed_at') || error.code === '42703')) {
                const result = await this.supabase
                    .from('orders')
                    .select('status, created_at, updated_at')
                    .order('created_at', { ascending: false })
                    .limit(1000);
                
                if (result.error) {
                    throw result.error;
                }
                orders = result.data;
                error = null;
            } else if (error) {
                throw error;
            }

            if (error) {
                throw error;
            }

            const ordersList = orders || [];
            const stageData = {
                sales: { times: [], count: 0 },
                production: { times: [], count: 0 },
                instore: { times: [], count: 0 },
                logistics: { times: [], count: 0 }
            };

            ordersList.forEach(order => {
                const created = new Date(order.created_at);
                const updated = order.updated_at ? new Date(order.updated_at) : created;
                const completed = order.completed_at ? new Date(order.completed_at) : null;
                
                // Sales stage: time from creation to first status change (pending -> in_progress)
                // Approximate as time from created to updated if status is in_progress or beyond
                if (order.status !== 'pending' && order.status !== 'cancelled') {
                    const salesTime = updated;
                    const diff = (salesTime - created) / (1000 * 60 * 60); // hours
                    if (diff > 0) {
                        stageData.sales.times.push(diff);
                        stageData.sales.count++;
                    }
                }

                // Production stage: time in in_progress status
                // Approximate as time from when status becomes in_progress to when it becomes to_deliver
                if (order.status === 'to_deliver' || order.status === 'completed') {
                    // Estimate production time as 50% of time from in_progress to to_deliver
                    // This is an approximation since we don't have exact stage timestamps
                    const productionEstimate = (updated - created) * 0.3; // Rough estimate
                    if (productionEstimate > 0) {
                        stageData.production.times.push(productionEstimate / (1000 * 60 * 60));
                        stageData.production.count++;
                    }
                }

                // In-Store and Logistics stages: approximate based on status transitions
                // These are rough estimates since exact timestamps aren't available
                if (order.status === 'completed' && completed) {
                    const totalTime = (completed - created) / (1000 * 60 * 60);
                    // Estimate instore and logistics as portions of total time
                    if (totalTime > 0) {
                        stageData.instore.times.push(totalTime * 0.2); // 20% estimate
                        stageData.instore.count++;
                        stageData.logistics.times.push(totalTime * 0.1); // 10% estimate
                        stageData.logistics.count++;
                    }
                }
            });

            // Calculate averages
            const performance = {
                sales: {
                    avgTime: this.calculateAverage(stageData.sales.times),
                    count: stageData.sales.count
                },
                production: {
                    avgTime: this.calculateAverage(stageData.production.times),
                    count: stageData.production.count
                },
                instore: {
                    avgTime: this.calculateAverage(stageData.instore.times),
                    count: stageData.instore.count
                },
                logistics: {
                    avgTime: this.calculateAverage(stageData.logistics.times),
                    count: stageData.logistics.count
                }
            };

            return performance;
        } catch (error) {
            // Silently return empty metrics on error
            return {
                sales: { avgTime: 0, count: 0 },
                production: { avgTime: 0, count: 0 },
                instore: { avgTime: 0, count: 0 },
                logistics: { avgTime: 0, count: 0 }
            };
        }
    }

    /**
     * Fetch weekly order trend (last 12 weeks)
     * @returns {Promise<Array>} Weekly trend data
     */
    async fetchWeeklyOrderTrend() {
        try {
            const { data: orders, error } = await this.supabase
                .from('orders')
                .select('created_at, status')
                .order('created_at', { ascending: false })
                .limit(5000);

            if (error) {
                throw error;
            }

            const ordersList = orders || [];
            const now = new Date();
            const weeks = [];
            
            // Initialize last 12 weeks
            for (let i = 11; i >= 0; i--) {
                const weekStart = new Date(now);
                weekStart.setDate(weekStart.getDate() - (i * 7));
                weekStart.setHours(0, 0, 0, 0);
                
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekEnd.getDate() + 6);
                weekEnd.setHours(23, 59, 59, 999);
                
                weeks.push({
                    start: weekStart,
                    end: weekEnd,
                    total: 0,
                    completed: 0
                });
            }

            // Count orders per week
            ordersList.forEach(order => {
                const orderDate = new Date(order.created_at);
                weeks.forEach(week => {
                    if (orderDate >= week.start && orderDate <= week.end) {
                        week.total++;
                        if (order.status === 'completed') {
                            week.completed++;
                        }
                    }
                });
            });

            return weeks.map(week => ({
                label: this.formatWeekLabel(week.start),
                total: week.total,
                completed: week.completed
            }));
        } catch (error) {
            console.error('Error fetching weekly trend:', error);
            return [];
        }
    }

    /**
     * Calculate derived metrics
     */
    calculateDerivedMetrics() {
        const { orderStatusBreakdown } = this.metrics;
        const total = orderStatusBreakdown.pending + 
                     orderStatusBreakdown.in_progress + 
                     orderStatusBreakdown.completed + 
                     orderStatusBreakdown.cancelled;

        if (total > 0) {
            this.metrics.completionRate = Math.round((orderStatusBreakdown.completed / total) * 100 * 10) / 10;
            this.metrics.cancellationRate = Math.round((orderStatusBreakdown.cancelled / total) * 100 * 10) / 10;
        }
    }

    /**
     * Calculate average from array
     * @param {Array} values - Array of numbers
     * @returns {number} Average value
     */
    calculateAverage(values) {
        if (!values || values.length === 0) return 0;
        const sum = values.reduce((a, b) => a + b, 0);
        return Math.round((sum / values.length) * 10) / 10;
    }

    /**
     * Format week label
     * @param {Date} date - Week start date
     * @returns {string} Formatted label
     */
    formatWeekLabel(date) {
        const month = date.toLocaleDateString('en-US', { month: 'short' });
        const day = date.getDate();
        return `${month} ${day}`;
    }

    /**
     * Format time in hours
     * @param {number} hours - Hours value
     * @returns {string} Formatted time string
     */
    formatTime(hours) {
        if (hours === 0) return 'N/A';
        if (hours < 1) {
            return `${Math.round(hours * 60)} min`;
        }
        if (hours < 24) {
            return `${hours.toFixed(1)} hrs`;
        }
        const days = Math.floor(hours / 24);
        const remainingHours = hours % 24;
        if (remainingHours === 0) {
            return `${days} day${days > 1 ? 's' : ''}`;
        }
        return `${days}d ${remainingHours.toFixed(1)}h`;
    }

    /**
     * Update metrics in DOM
     */
    updateMetrics() {
        // Customer metrics
        const totalCustomersEl = document.getElementById('analytics-total-customers');
        const activeCustomersEl = document.getElementById('analytics-active-customers');
        const repeatRateEl = document.getElementById('analytics-repeat-rate');

        if (totalCustomersEl) {
            totalCustomersEl.textContent = this.metrics.totalCustomers.toLocaleString();
        }
        if (activeCustomersEl) {
            activeCustomersEl.textContent = this.metrics.activeCustomers.toLocaleString();
        }
        if (repeatRateEl) {
            repeatRateEl.textContent = `${this.metrics.repeatCustomerRate}%`;
        }

        // Order status metrics
        const completionRateEl = document.getElementById('analytics-completion-rate');
        const cancellationRateEl = document.getElementById('analytics-cancellation-rate');
        const pendingCountEl = document.getElementById('analytics-pending-count');
        const inProgressCountEl = document.getElementById('analytics-in-progress-count');
        const completedCountEl = document.getElementById('analytics-completed-count');
        const cancelledCountEl = document.getElementById('analytics-cancelled-count');

        if (completionRateEl) {
            completionRateEl.textContent = `${this.metrics.completionRate}%`;
        }
        if (cancellationRateEl) {
            cancellationRateEl.textContent = `${this.metrics.cancellationRate}%`;
        }
        if (pendingCountEl) {
            pendingCountEl.textContent = this.metrics.orderStatusBreakdown.pending;
        }
        if (inProgressCountEl) {
            inProgressCountEl.textContent = this.metrics.orderStatusBreakdown.in_progress;
        }
        if (completedCountEl) {
            completedCountEl.textContent = this.metrics.orderStatusBreakdown.completed;
        }
        if (cancelledCountEl) {
            cancelledCountEl.textContent = this.metrics.orderStatusBreakdown.cancelled;
        }

        // Stage performance
        const salesTimeEl = document.getElementById('analytics-sales-time');
        const productionTimeEl = document.getElementById('analytics-production-time');
        const instoreTimeEl = document.getElementById('analytics-instore-time');
        const logisticsTimeEl = document.getElementById('analytics-logistics-time');
        const totalTimeEl = document.getElementById('analytics-total-time');

        if (salesTimeEl) {
            salesTimeEl.textContent = this.formatTime(this.metrics.stagePerformance.sales.avgTime);
        }
        if (productionTimeEl) {
            productionTimeEl.textContent = this.formatTime(this.metrics.stagePerformance.production.avgTime);
        }
        if (instoreTimeEl) {
            instoreTimeEl.textContent = this.formatTime(this.metrics.stagePerformance.instore.avgTime);
        }
        if (logisticsTimeEl) {
            logisticsTimeEl.textContent = this.formatTime(this.metrics.stagePerformance.logistics.avgTime);
        }
        if (totalTimeEl) {
            const total = this.metrics.stagePerformance.sales.avgTime +
                         this.metrics.stagePerformance.production.avgTime +
                         this.metrics.stagePerformance.instore.avgTime +
                         this.metrics.stagePerformance.logistics.avgTime;
            totalTimeEl.textContent = this.formatTime(total);
        }

        // Top customers
        this.renderTopCustomers();
    }

    /**
     * Render top customers list
     */
    renderTopCustomers() {
        const container = document.getElementById('analytics-top-customers-list');
        if (!container) return;

        if (this.metrics.topCustomers.length === 0) {
            container.innerHTML = '<div class="text-center py-4 text-white/60">No customer data available</div>';
            return;
        }

        container.innerHTML = this.metrics.topCustomers.map((customer, index) => {
            const initials = this.getInitials(customer.name);
            return `
                <div class="flex items-center justify-between py-3 ${index < this.metrics.topCustomers.length - 1 ? 'border-b border-white/10' : ''}">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-accent rounded-full flex items-center justify-center">
                            <span class="text-accent-foreground font-bold text-sm">${initials}</span>
                        </div>
                        <div>
                            <div class="text-white font-medium">${customer.name}</div>
                            <div class="text-white/60 text-sm">${customer.email}</div>
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="text-white font-medium">${customer.orderCount} order${customer.orderCount !== 1 ? 's' : ''}</div>
                        <div class="text-white/60 text-sm">KES ${customer.totalRevenue.toLocaleString()}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Get initials from name
     * @param {string} name - Full name
     * @returns {string} Initials
     */
    getInitials(name) {
        if (!name) return '??';
        const parts = name.trim().split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }

    /**
     * Render charts
     */
    renderCharts() {
        this.renderStatusBreakdownChart();
        this.renderWeeklyTrendChart();
    }

    /**
     * Render order status breakdown chart
     */
    renderStatusBreakdownChart() {
        const container = document.getElementById('analytics-status-chart');
        if (!container) return;

        const { orderStatusBreakdown } = this.metrics;
        const total = orderStatusBreakdown.pending + 
                     orderStatusBreakdown.in_progress + 
                     orderStatusBreakdown.completed + 
                     orderStatusBreakdown.cancelled;

        if (total === 0) {
            container.innerHTML = '<div class="text-center py-8" style="color: rgba(65, 70, 63, 0.6);">No order data available</div>';
            return;
        }

        const data = [
            { label: 'Completed', value: orderStatusBreakdown.completed, color: '#10B981' },
            { label: 'In Progress', value: orderStatusBreakdown.in_progress, color: '#3B82F6' },
            { label: 'Pending', value: orderStatusBreakdown.pending, color: '#F59E0B' },
            { label: 'Cancelled', value: orderStatusBreakdown.cancelled, color: '#EF4444' }
        ].filter(item => item.value > 0);

        let currentAngle = -90;
        const radius = 80;
        const centerX = 120;
        const centerY = 120;

        let svg = container.querySelector('svg');
        if (!svg) {
            svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('width', '100%');
            svg.setAttribute('height', '240');
            svg.setAttribute('viewBox', '0 0 240 240');
            svg.style.display = 'block';
            svg.style.visibility = 'visible';
            svg.style.opacity = '1';
            svg.style.maxWidth = '100%';
            svg.style.height = 'auto';
            container.appendChild(svg);
        }

        svg.innerHTML = '';

        data.forEach(item => {
            const percentage = (item.value / total) * 100;
            const angle = (percentage / 100) * 360;

            const startAngle = currentAngle;
            const endAngle = currentAngle + angle;

            const x1 = centerX + radius * Math.cos((startAngle * Math.PI) / 180);
            const y1 = centerY + radius * Math.sin((startAngle * Math.PI) / 180);
            const x2 = centerX + radius * Math.cos((endAngle * Math.PI) / 180);
            const y2 = centerY + radius * Math.sin((endAngle * Math.PI) / 180);

            const largeArc = angle > 180 ? 1 : 0;

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`);
            path.setAttribute('fill', item.color);
            path.setAttribute('opacity', '0.8');
            svg.appendChild(path);

            // Label
            const labelAngle = (startAngle + endAngle) / 2;
            const labelX = centerX + (radius * 0.7) * Math.cos((labelAngle * Math.PI) / 180);
            const labelY = centerY + (radius * 0.7) * Math.sin((labelAngle * Math.PI) / 180);

            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', labelX);
            text.setAttribute('y', labelY);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('dominant-baseline', 'middle');
            text.setAttribute('fill', '#FAFAFA');
            text.setAttribute('font-size', '12');
            text.setAttribute('font-weight', '600');
            text.textContent = `${percentage.toFixed(0)}%`;
            svg.appendChild(text);

            currentAngle = endAngle;
        });

        // Legend
        const legend = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        let legendY = 200;
        data.forEach(item => {
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', '20');
            rect.setAttribute('y', legendY - 8);
            rect.setAttribute('width', '12');
            rect.setAttribute('height', '12');
            rect.setAttribute('fill', item.color);
            legend.appendChild(rect);

            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', '38');
            text.setAttribute('y', legendY);
            text.setAttribute('fill', '#FAFAFA');
            text.setAttribute('font-size', '11');
            text.textContent = `${item.label}: ${item.value}`;
            legend.appendChild(text);

            legendY += 20;
        });
        svg.appendChild(legend);
    }

    /**
     * Render weekly trend chart
     */
    renderWeeklyTrendChart() {
        const container = document.getElementById('analytics-weekly-trend-chart');
        if (!container) return;

        if (this.metrics.weeklyOrderTrend.length === 0) {
            container.innerHTML = '<div class="text-center py-8" style="color: rgba(65, 70, 63, 0.6);">No trend data available</div>';
            return;
        }

        const data = this.metrics.weeklyOrderTrend;
        const maxValue = Math.max(...data.map(d => Math.max(d.total, d.completed)), 1);
        const chartHeight = 200;
        const chartWidth = 100;
        const barWidth = 8;
        const spacing = (chartWidth - (barWidth * data.length)) / (data.length + 1);

        let svg = container.querySelector('svg');
        if (!svg) {
            svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('width', '100%');
            svg.setAttribute('height', '240');
            svg.setAttribute('viewBox', '0 0 800 240');
            svg.style.display = 'block';
            svg.style.visibility = 'visible';
            svg.style.opacity = '1';
            svg.style.maxWidth = '100%';
            svg.style.height = 'auto';
            container.appendChild(svg);
        }

        svg.innerHTML = '';

        // Draw bars
        data.forEach((week, index) => {
            const x = 100 + (index * (barWidth + spacing)) + spacing;
            const totalHeight = (week.total / maxValue) * chartHeight;
            const completedHeight = (week.completed / maxValue) * chartHeight;
            const yTotal = 20 + (chartHeight - totalHeight);
            const yCompleted = 20 + (chartHeight - completedHeight);

            // Total orders bar (lighter)
            const totalBar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            totalBar.setAttribute('x', x);
            totalBar.setAttribute('y', yTotal);
            totalBar.setAttribute('width', barWidth);
            totalBar.setAttribute('height', totalHeight);
            totalBar.setAttribute('fill', 'rgba(59, 130, 246, 0.5)');
            svg.appendChild(totalBar);

            // Completed orders bar (darker)
            const completedBar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            completedBar.setAttribute('x', x);
            completedBar.setAttribute('y', yCompleted);
            completedBar.setAttribute('width', barWidth);
            completedBar.setAttribute('height', completedHeight);
            completedBar.setAttribute('fill', '#3B82F6');
            svg.appendChild(completedBar);

            // Label
            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.setAttribute('x', x + barWidth / 2);
            label.setAttribute('y', 220);
            label.setAttribute('text-anchor', 'middle');
            label.setAttribute('fill', '#FAFAFA');
            label.setAttribute('font-size', '10');
            label.setAttribute('transform', `rotate(-45 ${x + barWidth / 2} 220)`);
            label.textContent = week.label;
            svg.appendChild(label);
        });

        // Y-axis labels
        for (let i = 0; i <= 5; i++) {
            const value = Math.round((maxValue / 5) * i);
            const y = 20 + chartHeight - ((i / 5) * chartHeight);
            
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', '95');
            text.setAttribute('y', y + 4);
            text.setAttribute('text-anchor', 'end');
            text.setAttribute('fill', 'rgba(250, 250, 250, 0.6)');
            text.setAttribute('font-size', '10');
            text.textContent = value;
            svg.appendChild(text);
        }
    }
}

// Create global instance
const analyticsService = new AnalyticsService();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AnalyticsService;
}
