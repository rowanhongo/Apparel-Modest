/**
 * Home Service
 * Service for dashboard home page - stats, charts, and welcome section
 */

class HomeService {
    constructor() {
        this.stats = {
            sales: 0,
            production: 0,
            logistics: 0,
            afterSales: 0
        };
        this.supabase = null;
        this.ordersChannel = null; // Realtime subscription channel
    }

    /**
     * Initialize the home service
     */
    async init() {
        // Get Supabase client
        this.supabase = getSupabaseClient();
        if (!this.supabase) {
            console.error('❌ Supabase client not available');
            return;
        }

        // Load data from database
        await this.loadDashboardData();
        
        // Set up realtime subscription for orders
        this.setupOrdersRealtime();
        
        // Load and display failed orders notifications
        this.loadFailedOrdersNotifications();
    }

    /**
     * Load all dashboard data from Supabase
     */
    async loadDashboardData() {
        try {
            // Load stats and charts in parallel
            const [statsData, weeklyData, statusData] = await Promise.all([
                this.fetchStats(),
                this.fetchWeeklyOrders(),
                this.fetchStatusDistribution()
            ]);

            // Update stats
            this.updateStats(statsData);

            // Update charts
            this.renderCharts({
                weekly: weeklyData,
                status: statusData
            });

            // Update welcome section
            this.updateWelcomeSection();
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            // Fallback to empty stats
            this.updateStats({ sales: 0, production: 0, logistics: 0, afterSales: 0 });
        }
    }

    /**
     * Fetch statistics from database
     * @returns {Promise<Object>} Stats object with counts
     */
    async fetchStats() {
        try {
            // Fetch current orders by status (not filtered by week - showing current counts)
            // Exclude deleted orders to match Sales page behavior
            const { count: salesCount, error: salesError } = await this.supabase
                .from('orders')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'pending')
                .is('deleted_at', null);

            const { count: productionCount, error: productionError } = await this.supabase
                .from('orders')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'in_progress')
                .is('deleted_at', null);

            const { count: logisticsCount, error: logisticsError } = await this.supabase
                .from('orders')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'to_deliver')
                .is('deleted_at', null);

            // Total After Sales - all completed orders (not just today)
            // Exclude deleted orders
            let afterSalesCount = 0;
            let afterSalesError = null;
            
            try {
                // Fetch count of all completed orders
                const { count, error: completedError } = await this.supabase
                    .from('orders')
                    .select('*', { count: 'exact', head: true })
                    .eq('status', 'completed')
                    .is('deleted_at', null);
                
                if (completedError) {
                    afterSalesError = completedError;
                    console.warn('Error fetching completed orders:', completedError);
                } else {
                    afterSalesCount = count || 0;
                }
            } catch (error) {
                afterSalesError = error;
                console.warn('Error fetching completed orders:', error);
                afterSalesCount = 0;
            }

            if (salesError || productionError || logisticsError || afterSalesError) {
                console.error('Error fetching stats:', { salesError, productionError, logisticsError, afterSalesError });
                return { sales: 0, production: 0, logistics: 0, afterSales: 0 };
            }

            return {
                sales: salesCount || 0,
                production: productionCount || 0,
                logistics: logisticsCount || 0,
                afterSales: afterSalesCount || 0
            };
        } catch (error) {
            console.error('Error in fetchStats:', error);
            return { sales: 0, production: 0, logistics: 0, afterSales: 0 };
        }
    }

    /**
     * Set up realtime subscription for orders table (all statuses for dashboard stats)
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
            .channel('orders-all-changes-dashboard')
            .on(
                'postgres_changes',
                {
                    event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
                    schema: 'public',
                    table: 'orders'
                },
                (payload) => {
                    console.log('Orders realtime event (dashboard):', payload.eventType, payload);
                    // Reload dashboard data when any order change occurs
                    this.loadDashboardData();
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('✅ Subscribed to orders realtime changes (dashboard)');
                } else if (status === 'CHANNEL_ERROR') {
                    console.error('❌ Error subscribing to orders realtime (dashboard)');
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
     * Fetch weekly orders data for bar chart
     * @returns {Promise<Object>} Weekly chart data
     */
    async fetchWeeklyOrders() {
        try {
            // Get start of week (Monday)
            const now = new Date();
            const dayOfWeek = now.getDay();
            const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust when day is Sunday
            const startOfWeek = new Date(now.setDate(diff));
            startOfWeek.setHours(0, 0, 0, 0);

            // Fetch orders from this week (exclude deleted orders)
            const { data: orders, error } = await this.supabase
                .from('orders')
                .select('created_at')
                .gte('created_at', startOfWeek.toISOString())
                .is('deleted_at', null);

            if (error) {
                console.error('Error fetching weekly orders:', error);
                return {
                    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                    values: [0, 0, 0, 0, 0, 0, 0]
                };
            }

            // Group orders by day of week
            const dayCounts = [0, 0, 0, 0, 0, 0, 0]; // Mon-Sun

            orders?.forEach(order => {
                const orderDate = new Date(order.created_at);
                const dayIndex = orderDate.getDay();
                // Convert Sunday (0) to index 6, Monday (1) to index 0, etc.
                const adjustedIndex = dayIndex === 0 ? 6 : dayIndex - 1;
                if (adjustedIndex >= 0 && adjustedIndex < 7) {
                    dayCounts[adjustedIndex]++;
                }
            });

            return {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                values: dayCounts
            };
        } catch (error) {
            console.error('Error in fetchWeeklyOrders:', error);
            return {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                values: [0, 0, 0, 0, 0, 0, 0]
            };
        }
    }

    /**
     * Fetch status distribution for doughnut chart
     * @returns {Promise<Object>} Status chart data
     */
    async fetchStatusDistribution() {
        try {
            // Get start of week (Monday) for weekly stats
            const now = new Date();
            const dayOfWeek = now.getDay();
            const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust when day is Sunday
            const startOfWeek = new Date(now.setDate(diff));
            startOfWeek.setHours(0, 0, 0, 0);
            const startOfWeekStr = startOfWeek.toISOString();

            // Fetch counts for each status using count option - for this week (exclude deleted orders)
            const { count: salesCount } = await this.supabase
                .from('orders')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'pending')
                .gte('created_at', startOfWeekStr)
                .is('deleted_at', null);

            const { count: productionCount } = await this.supabase
                .from('orders')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'in_progress')
                .gte('created_at', startOfWeekStr)
                .is('deleted_at', null);

            const { count: logisticsCount } = await this.supabase
                .from('orders')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'to_deliver')
                .gte('created_at', startOfWeekStr)
                .is('deleted_at', null);

            const { count: afterSalesCount } = await this.supabase
                .from('orders')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'completed')
                .gte('created_at', startOfWeekStr)
                .is('deleted_at', null);

            return {
                labels: ['Sales', 'Production', 'Logistics', 'After Sales'],
                values: [
                    salesCount || 0,
                    productionCount || 0,
                    logisticsCount || 0,
                    afterSalesCount || 0
                ]
            };
        } catch (error) {
            console.error('Error in fetchStatusDistribution:', error);
            return {
                labels: ['Sales', 'Production', 'Logistics', 'After Sales'],
                values: [0, 0, 0, 0]
            };
        }
    }

    /**
     * Update dashboard statistics
     * @param {Object} statsData - Stats object with counts
     */
    updateStats(statsData = null) {
        if (statsData) {
            this.stats.sales = statsData.sales || 0;
            this.stats.production = statsData.production || 0;
            this.stats.logistics = statsData.logistics || 0;
            this.stats.afterSales = statsData.afterSales || 0;
        }

        // Update DOM elements
        const statsCards = document.querySelectorAll('.stat-card .stat-value');
        if (statsCards.length >= 4) {
            statsCards[0].textContent = this.stats.sales;
            statsCards[1].textContent = this.stats.production;
            statsCards[2].textContent = this.stats.logistics;
            statsCards[3].textContent = this.stats.afterSales;
        }
    }

    /**
     * Update welcome section with user name and date
     */
    updateWelcomeSection() {
        try {
            const currentUser = authService.getCurrentUser();
            const welcomeHeading = document.getElementById('welcome-heading');
            const welcomeDate = document.getElementById('welcome-date');
            
            // Update name
            if (welcomeHeading) {
                if (currentUser && currentUser.name) {
                    // Extract first name (handle cases where name might be empty)
                    const nameParts = currentUser.name.trim().split(/\s+/);
                    const firstName = nameParts.length > 0 && nameParts[0] ? nameParts[0] : 'User';
                    welcomeHeading.textContent = `Welcome back, ${firstName}! 👋`;
                } else {
                    welcomeHeading.textContent = 'Welcome back! 👋';
                }
            }
            
            // Update date
            if (welcomeDate) {
                const today = new Date();
                const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
                welcomeDate.textContent = today.toLocaleDateString('en-US', options);
            }
        } catch (error) {
            console.error('Error updating welcome section:', error);
        }
    }

    /**
     * Render dashboard charts
     * @param {Object} chartData - Chart data for weekly and status charts
     */
    renderCharts(chartData = null) {
        const weeklyData = chartData?.weekly || {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            values: [5, 8, 6, 9, 7, 4, 3]
        };

        const statusData = chartData?.status || {
            labels: ['Sales', 'Production', 'Logistics', 'After Sales'],
            values: [8, 12, 5, 42]
        };

        this.drawChart('weeklyChart', 'bar', weeklyData);
        this.drawChart('statusChart', 'doughnut', statusData);
        
        // Calculate and display total orders for the week
        const weeklyTotal = weeklyData.values.reduce((sum, value) => {
            const num = Number(value);
            return sum + (isNaN(num) || !isFinite(num) ? 0 : num);
        }, 0);
        
        const weeklyTotalElement = document.getElementById('weekly-total-value');
        if (weeklyTotalElement) {
            weeklyTotalElement.textContent = weeklyTotal;
        }
    }

    /**
     * Draw chart on canvas
     * @param {string} canvasId - ID of the canvas element
     * @param {string} type - Chart type ('bar' or 'doughnut')
     * @param {Object} data - Chart data with labels and values
     */
    drawChart(canvasId, type, data) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        ctx.clearRect(0, 0, width, height);

        if (type === 'bar') {
            this.drawBarChart(ctx, width, height, data);
        } else if (type === 'doughnut') {
            this.drawDoughnutChart(ctx, width, height, data);
        }
    }

    /**
     * Draw bar chart
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} width - Canvas width
     * @param {number} height - Canvas height
     * @param {Object} data - Chart data
     */
    drawBarChart(ctx, width, height, data) {
        // Ensure all values are valid numbers
        const validValues = data.values.map(v => {
            const num = Number(v);
            return isNaN(num) || !isFinite(num) ? 0 : num;
        });

        // If all values are 0, set maxValue to 1 to avoid division by zero
        const maxValue = Math.max(...validValues, 1);
        const barWidth = (width - 100) / data.labels.length;
        const padding = 60;

        validValues.forEach((value, i) => {
            // Calculate bar height (ensure it's a valid number)
            const barHeight = maxValue > 0 ? (value / maxValue) * (height - padding - 40) : 0;
            const x = padding + i * barWidth;
            const y = height - padding - barHeight;

            // Only draw gradient if we have valid coordinates
            if (isFinite(y) && isFinite(barHeight) && barHeight > 0) {
                const gradient = ctx.createLinearGradient(0, y, 0, height - padding);
                gradient.addColorStop(0, '#41463F');
                gradient.addColorStop(1, '#353C35');
                ctx.fillStyle = gradient;
                ctx.fillRect(x, y, barWidth - 20, barHeight);
            } else {
                // Draw empty bar with border
                ctx.fillStyle = 'rgba(65, 70, 63, 0.1)';
                ctx.fillRect(x, height - padding, barWidth - 20, 0);
            }

            ctx.fillStyle = '#2D332D';
            ctx.font = 'bold 13px sans-serif';
            ctx.textAlign = 'center';
            // Draw day label
            ctx.fillText(data.labels[i], x + (barWidth - 20) / 2, height - 25);
            // Draw number below the day label
            ctx.font = 'bold 14px sans-serif';
            ctx.fillText(value.toString(), x + (barWidth - 20) / 2, height - 5);
        });
    }

    /**
     * Draw doughnut chart
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} width - Canvas width
     * @param {number} height - Canvas height
     * @param {Object} data - Chart data
     */
    drawDoughnutChart(ctx, width, height, data) {
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) / 3;
        let currentAngle = -Math.PI / 2;

        // Ensure all values are valid numbers
        const validValues = data.values.map(v => {
            const num = Number(v);
            return isNaN(num) || !isFinite(num) ? 0 : num;
        });

        const total = validValues.reduce((a, b) => a + b, 0);
        // Distinct, bright colors for each status: Sales (Blue), Production (Orange), Logistics (Green), After Sales (Purple)
        const colors = ['#3B82F6', '#F59E0B', '#10B981', '#8B5CF6'];

        // If no data, draw empty circle with message
        if (total === 0) {
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            ctx.arc(centerX, centerY, radius * 0.6, 2 * Math.PI, 0, true);
            ctx.closePath();
            ctx.fillStyle = 'rgba(65, 70, 63, 0.1)';
            ctx.fill();

            ctx.fillStyle = '#2D332D';
            ctx.font = 'bold 14px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('No data available', centerX, centerY);
            return;
        }

        validValues.forEach((value, i) => {
            if (value === 0) {
                // Skip zero values but still advance angle for spacing
                return;
            }

            const sliceAngle = (value / total) * 2 * Math.PI;

            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
            ctx.arc(centerX, centerY, radius * 0.6, currentAngle + sliceAngle, currentAngle, true);
            ctx.closePath();
            ctx.fillStyle = colors[i % colors.length];
            ctx.fill();

            const labelAngle = currentAngle + sliceAngle / 2;
            const labelDistance = radius + 40;
            let labelX = centerX + Math.cos(labelAngle) * labelDistance;
            let labelY = centerY + Math.sin(labelAngle) * labelDistance;

            // Keep labels within canvas bounds
            labelX = Math.max(20, Math.min(width - 20, labelX));
            labelY = Math.max(20, Math.min(height - 20, labelY));

            ctx.fillStyle = '#2D332D';
            ctx.font = 'bold 14px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${data.labels[i]}: ${value}`, labelX, labelY);

            currentAngle += sliceAngle;
        });
    }

    /**
     * Get current statistics
     * @returns {Object} Current stats object
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * Load failed orders from localStorage and display notifications
     */
    loadFailedOrdersNotifications() {
        try {
            const failedOrders = JSON.parse(localStorage.getItem('failed_orders') || '[]');
            
            // Filter out old entries (older than 7 days)
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const recentFailedOrders = failedOrders.filter(order => {
                const orderDate = new Date(order.timestamp || order.failedAt);
                return orderDate > sevenDaysAgo;
            });

            // Update localStorage with filtered list
            if (recentFailedOrders.length !== failedOrders.length) {
                localStorage.setItem('failed_orders', JSON.stringify(recentFailedOrders));
            }

            // Display notifications
            this.renderFailedOrdersNotifications(recentFailedOrders);
        } catch (error) {
            console.error('Error loading failed orders notifications:', error);
        }
    }

    /**
     * Render failed orders notifications on home page
     * @param {Array} failedOrders - Array of failed order objects
     */
    renderFailedOrdersNotifications(failedOrders) {
        // Find or create notifications container
        let notificationsContainer = document.getElementById('failed-orders-notifications');
        
        if (!notificationsContainer) {
            // Create notifications container if it doesn't exist
            const homeTab = document.getElementById('home');
            if (!homeTab) return;

            // Create container after welcome section
            const welcomeSection = homeTab.querySelector('.welcome-section');
            if (welcomeSection) {
                notificationsContainer = document.createElement('div');
                notificationsContainer.id = 'failed-orders-notifications';
                notificationsContainer.style.cssText = 'margin: 20px 0; padding: 0 20px;';
                welcomeSection.parentNode.insertBefore(notificationsContainer, welcomeSection.nextSibling);
            } else {
                return; // Can't find where to insert
            }
        }

        // Clear existing notifications
        notificationsContainer.innerHTML = '';

        if (failedOrders.length === 0) {
            return; // No failed orders to display
        }

        // Create notifications section
        const notificationsHTML = `
            <div style="background: linear-gradient(135deg, #FEE2E2 0%, #FECACA 100%); border-radius: 12px; padding: 20px; margin-bottom: 20px; border: 2px solid #F87171; box-shadow: 0 4px 12px rgba(248, 113, 113, 0.2);">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: #DC2626;">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                        </svg>
                        <h3 style="margin: 0; font-size: 18px; font-weight: 600; color: #DC2626;">Failed Orders Requiring Attention</h3>
                        <span style="background: #DC2626; color: white; padding: 4px 12px; border-radius: 12px; font-size: 14px; font-weight: 600;">${failedOrders.length}</span>
                    </div>
                    <button id="dismiss-all-failed-orders" style="background: rgba(220, 38, 38, 0.1); border: 1px solid #DC2626; color: #DC2626; padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s;" 
                            onmouseover="this.style.background='rgba(220, 38, 38, 0.2)'" 
                            onmouseout="this.style.background='rgba(220, 38, 38, 0.1)'">
                        Dismiss All
                    </button>
                </div>
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    ${failedOrders.map((order, index) => `
                        <div style="background: white; border-radius: 8px; padding: 16px; border: 1px solid #FCA5A5;">
                            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                                <div style="flex: 1;">
                                    <div style="font-weight: 600; color: #1F2937; margin-bottom: 4px;">Payment Reference: <span style="font-family: monospace; color: #DC2626;">${order.paymentReference || 'N/A'}</span></div>
                                    <div style="font-size: 14px; color: #6B7280; margin-bottom: 4px;">Customer: ${order.customerName || 'Unknown'}</div>
                                    <div style="font-size: 14px; color: #6B7280; margin-bottom: 4px;">Phone: ${order.customerPhone || 'N/A'}</div>
                                    <div style="font-size: 14px; color: #6B7280; margin-bottom: 4px;">Amount: KES ${(order.totalPrice || 0).toLocaleString()}</div>
                                    <div style="font-size: 12px; color: #9CA3AF; margin-top: 8px;">Failed: ${new Date(order.failedAt || order.timestamp).toLocaleString()}</div>
                                    ${order.error ? `<div style="font-size: 12px; color: #DC2626; margin-top: 8px; padding: 8px; background: rgba(220, 38, 38, 0.1); border-radius: 4px;">Error: ${order.error}</div>` : ''}
                                </div>
                                <button class="dismiss-failed-order" data-index="${index}" style="background: rgba(220, 38, 38, 0.1); border: 1px solid #DC2626; color: #DC2626; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; margin-left: 12px; transition: all 0.2s;"
                                        onmouseover="this.style.background='rgba(220, 38, 38, 0.2)'" 
                                        onmouseout="this.style.background='rgba(220, 38, 38, 0.1)'">
                                    Dismiss
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        notificationsContainer.innerHTML = notificationsHTML;

        // Add event listeners for dismiss buttons
        notificationsContainer.querySelectorAll('.dismiss-failed-order').forEach(button => {
            button.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.dismissFailedOrder(index);
            });
        });

        // Add event listener for dismiss all button
        const dismissAllBtn = notificationsContainer.querySelector('#dismiss-all-failed-orders');
        if (dismissAllBtn) {
            dismissAllBtn.addEventListener('click', () => {
                this.dismissAllFailedOrders();
            });
        }
    }

    /**
     * Dismiss a single failed order
     * @param {number} index - Index of failed order to dismiss
     */
    dismissFailedOrder(index) {
        try {
            const failedOrders = JSON.parse(localStorage.getItem('failed_orders') || '[]');
            failedOrders.splice(index, 1);
            localStorage.setItem('failed_orders', JSON.stringify(failedOrders));
            this.loadFailedOrdersNotifications(); // Reload to update display
        } catch (error) {
            console.error('Error dismissing failed order:', error);
        }
    }

    /**
     * Dismiss all failed orders
     */
    dismissAllFailedOrders() {
        if (confirm('Are you sure you want to dismiss all failed order notifications? This will not delete the orders from localStorage, but will hide them from view.')) {
            try {
                localStorage.setItem('failed_orders', JSON.stringify([]));
                this.loadFailedOrdersNotifications(); // Reload to update display
            } catch (error) {
                console.error('Error dismissing all failed orders:', error);
            }
        }
    }
}

// Create global instance
const homeService = new HomeService();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HomeService;
}

