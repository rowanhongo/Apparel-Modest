/**
 * Revenue Service
 * Service for admin revenue dashboard - financial insights and revenue analytics
 */

class RevenueService {
    constructor() {
        this.metrics = {
            totalRevenue: 0,
            averageOrderValue: 0,
            growthRate: 0,
            grossIncome: 0,
            totalCosts: 0
        };
        this.monthlyRevenue = [];
        this.supabase = null;
    }

    /**
     * Initialize the revenue service
     */
    async init() {
        // Get Supabase client
        this.supabase = getSupabaseClient();
        if (!this.supabase) {
            console.error('❌ Supabase client not available');
            return;
        }

        // Initialize costs service if available
        if (costsService && !costsService.supabase) {
            await costsService.init();
        }

        // Load all revenue data
        await this.loadRevenueData();
    }

    /**
     * Load all revenue data from Supabase
     */
    async loadRevenueData() {
        try {
            // Load metrics and monthly data in parallel
            const [metricsData, monthlyData] = await Promise.all([
                this.fetchMetrics(),
                this.fetchMonthlyRevenue()
            ]);

            // Update metrics - use a small delay to ensure DOM is ready
            setTimeout(() => {
                this.updateMetrics(metricsData);
                // Render chart
                this.renderRevenueChart(monthlyData);
            }, 100);
        } catch (error) {
            console.error('Error loading revenue data:', error);
            // Fallback to empty metrics
            setTimeout(() => {
                this.updateMetrics({
                    totalRevenue: 0,
                    averageOrderValue: 0,
                    growthRate: 0,
                    grossIncome: 0,
                    totalCosts: 0
                });
                this.renderRevenueChart(this.getEmptyMonthlyData());
            }, 100);
        }
    }

    /**
     * Fetch revenue metrics from database
     * @returns {Promise<Object>} Revenue metrics object
     */
    async fetchMetrics() {
        try {
            // Get current month start and end
            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
            const monthStartStr = monthStart.toISOString();
            const monthEndStr = monthEnd.toISOString();

            // Get previous month start and end
            const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
            const prevMonthStartStr = prevMonthStart.toISOString();
            const prevMonthEndStr = prevMonthEnd.toISOString();

            // Fetch orders from this month
            const { data: currentMonthOrders, error: currentError } = await this.supabase
                .from('orders')
                .select('price, status')
                .eq('status', 'completed')
                .gte('created_at', monthStartStr)
                .lte('created_at', monthEndStr);

            if (currentError) {
                console.error('Error fetching current month orders:', currentError);
                throw currentError;
            }

            // Fetch orders from previous month
            const { data: previousMonthOrders, error: prevError } = await this.supabase
                .from('orders')
                .select('price, status')
                .eq('status', 'completed')
                .gte('created_at', prevMonthStartStr)
                .lte('created_at', prevMonthEndStr);

            if (prevError) {
                console.error('Error fetching previous month orders:', prevError);
                // Continue with current month data only
            }

            // Calculate total revenue for current month
            const totalRevenue = (currentMonthOrders || []).reduce((sum, order) => {
                return sum + (parseFloat(order.price) || 0);
            }, 0);

            // Calculate average order value
            const orderCount = (currentMonthOrders || []).length;
            const averageOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;

            // Calculate growth rate
            const previousRevenue = (previousMonthOrders || []).reduce((sum, order) => {
                return sum + (parseFloat(order.price) || 0);
            }, 0);

            let growthRate = 0;
            if (previousRevenue > 0) {
                growthRate = ((totalRevenue - previousRevenue) / previousRevenue) * 100;
            } else if (totalRevenue > 0) {
                growthRate = 100; // 100% growth if no previous revenue
            }

            // Fetch total costs for current month
            let totalCosts = 0;
            if (costsService && costsService.supabase) {
                totalCosts = await costsService.fetchMonthlyCosts();
            }

            // Calculate gross income (revenue - costs)
            const grossIncome = totalRevenue - totalCosts;

            return {
                totalRevenue,
                averageOrderValue,
                growthRate,
                grossIncome,
                totalCosts
            };
        } catch (error) {
            console.error('Error in fetchMetrics:', error);
            return {
                totalRevenue: 0,
                averageOrderValue: 0,
                growthRate: 0,
                profitMargin: 0
            };
        }
    }

    /**
     * Fetch monthly revenue data for the current year
     * @returns {Promise<Array>} Monthly revenue data array
     */
    async fetchMonthlyRevenue() {
        try {
            // Get current year start and end
            const now = new Date();
            const yearStart = new Date(now.getFullYear(), 0, 1);
            const yearEnd = new Date(now.getFullYear() + 1, 0, 1);
            const yearStartStr = yearStart.toISOString();
            const yearEndStr = yearEnd.toISOString();

            // Fetch all completed orders from this year
            const { data: orders, error } = await this.supabase
                .from('orders')
                .select('price, created_at, status')
                .eq('status', 'completed')
                .gte('created_at', yearStartStr)
                .lt('created_at', yearEndStr);

            if (error) {
                console.error('Error fetching monthly revenue:', error);
                return this.getEmptyMonthlyData();
            }

            // Group orders by month (0-11 for Jan-Dec)
            const monthlyRevenue = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

            (orders || []).forEach(order => {
                const orderDate = new Date(order.created_at);
                const monthIndex = orderDate.getMonth(); // 0-11
                if (monthIndex >= 0 && monthIndex < 12) {
                    monthlyRevenue[monthIndex] += parseFloat(order.price) || 0;
                }
            });

            return monthlyRevenue;
        } catch (error) {
            console.error('Error in fetchMonthlyRevenue:', error);
            return this.getEmptyMonthlyData();
        }
    }

    /**
     * Get empty monthly data array
     * @returns {Array} Array of 12 zeros
     */
    getEmptyMonthlyData() {
        return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    }

    /**
     * Update revenue metrics in DOM
     * @param {Object} metricsData - Revenue metrics data object
     */
    updateMetrics(metricsData = null) {
        if (metricsData) {
            this.metrics = { ...this.metrics, ...metricsData };
        }

        // Update DOM elements
        const totalRevenueEl = document.getElementById('revenue-total');
        const avgOrderValueEl = document.getElementById('revenue-avg-order-value');
        const growthRateEl = document.getElementById('revenue-growth-rate');
        const grossIncomeEl = document.getElementById('revenue-gross-income');

        if (totalRevenueEl) {
            totalRevenueEl.textContent = this.formatCurrency(this.metrics.totalRevenue);
        }
        if (avgOrderValueEl) {
            avgOrderValueEl.textContent = this.formatCurrency(this.metrics.averageOrderValue);
        }
        if (growthRateEl) {
            growthRateEl.textContent = this.formatPercentage(this.metrics.growthRate);
        }
        if (grossIncomeEl) {
            grossIncomeEl.textContent = this.formatCurrency(this.metrics.grossIncome);
        }
    }

    /**
     * Render monthly revenue trend chart
     * @param {Array} monthlyData - Monthly revenue data array (12 values for Jan-Dec)
     */
    renderRevenueChart(monthlyData = null) {
        if (!monthlyData) {
            monthlyData = this.getEmptyMonthlyData();
        }

        this.monthlyRevenue = monthlyData;

        const chartContainer = document.querySelector('#admin-revenue-content .chart-container');
        if (!chartContainer) {
            console.warn('Revenue chart container not found');
            return;
        }

        // Find or create SVG element
        let svg = chartContainer.querySelector('svg');
        if (!svg) {
            svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('width', '100%');
            svg.setAttribute('height', '300');
            svg.setAttribute('viewBox', '0 0 800 300');
            
            // Add defs
            const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
            pattern.setAttribute('id', 'admin-revenue-grid');
            pattern.setAttribute('width', '60');
            pattern.setAttribute('height', '30');
            pattern.setAttribute('patternUnits', 'userSpaceOnUse');
            const patternPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            patternPath.setAttribute('d', 'M 60 0 L 0 0 0 30');
            patternPath.setAttribute('fill', 'none');
            patternPath.setAttribute('stroke', 'rgba(224,216,201,0.1)');
            patternPath.setAttribute('stroke-width', '1');
            pattern.appendChild(patternPath);
            
            const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
            gradient.setAttribute('id', 'admin-lineGradient');
            gradient.setAttribute('x1', '0%');
            gradient.setAttribute('y1', '0%');
            gradient.setAttribute('x2', '100%');
            gradient.setAttribute('y2', '0%');
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
            gridRect.setAttribute('fill', 'url(#admin-revenue-grid)');
            svg.appendChild(gridRect);
            
            // Create groups for chart elements
            const lineGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            lineGroup.setAttribute('class', 'revenue-chart-line');
            svg.appendChild(lineGroup);
            
            const labelsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            labelsGroup.setAttribute('class', 'revenue-chart-labels');
            labelsGroup.setAttribute('fill', '#2D332D');
            labelsGroup.setAttribute('font-size', '12');
            labelsGroup.setAttribute('font-weight', '700');
            svg.appendChild(labelsGroup);
            
            chartContainer.appendChild(svg);
        }

        // Clear existing chart elements
        const lineGroup = svg.querySelector('.revenue-chart-line');
        if (lineGroup) {
            lineGroup.innerHTML = '';
        }
        const labelsGroup = svg.querySelector('.revenue-chart-labels');
        if (labelsGroup) {
            labelsGroup.innerHTML = '';
        }

        // Calculate chart dimensions
        const chartWidth = 800;
        const chartHeight = 300;
        const padding = 50;
        const availableWidth = chartWidth - (padding * 2);
        const availableHeight = chartHeight - (padding * 2);

        // Calculate max value for scaling
        const maxValue = Math.max(...monthlyData, 1);

        // Calculate points for polyline
        const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const points = [];
        const monthSpacing = availableWidth / (monthlyData.length - 1);

        monthlyData.forEach((value, i) => {
            const x = padding + (i * monthSpacing);
            const y = chartHeight - padding - ((value / maxValue) * availableHeight);
            points.push(`${x},${y}`);
        });

        // Create polyline
        const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        polyline.setAttribute('points', points.join(' '));
        polyline.setAttribute('fill', 'none');
        polyline.setAttribute('stroke', 'url(#admin-lineGradient)');
        polyline.setAttribute('stroke-width', '3');
        polyline.setAttribute('stroke-linecap', 'round');
        polyline.setAttribute('stroke-linejoin', 'round');
        lineGroup.appendChild(polyline);

        // Add month labels
        monthlyData.forEach((value, i) => {
            const x = padding + (i * monthSpacing);
            const y = chartHeight - 10;
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', x);
            text.setAttribute('y', y);
            text.setAttribute('text-anchor', 'middle');
            text.textContent = monthLabels[i];
            labelsGroup.appendChild(text);
        });

        // Add hover circles and tooltip functionality
        const tooltip = document.getElementById('revenue-tooltip');
        
        monthlyData.forEach((value, i) => {
            const x = padding + (i * monthSpacing);
            const y = chartHeight - padding - ((value / maxValue) * availableHeight);
            
            // Create invisible hover circle (larger area for easier hovering)
            const hoverCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            hoverCircle.setAttribute('cx', x);
            hoverCircle.setAttribute('cy', y);
            hoverCircle.setAttribute('r', '15'); // Larger hover area
            hoverCircle.setAttribute('fill', 'transparent');
            hoverCircle.setAttribute('stroke', 'none');
            hoverCircle.setAttribute('style', 'cursor: pointer;');
            hoverCircle.setAttribute('data-month', monthLabels[i]);
            hoverCircle.setAttribute('data-value', value);
            hoverCircle.setAttribute('data-index', i);
            
            // Create visible dot at data point
            const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            dot.setAttribute('cx', x);
            dot.setAttribute('cy', y);
            dot.setAttribute('r', '4');
            dot.setAttribute('fill', '#41463F');
            dot.setAttribute('stroke', '#FAFAFA');
            dot.setAttribute('stroke-width', '2');
            dot.setAttribute('style', 'cursor: pointer; transition: r 0.2s;');
            
            // Add hover event listeners
            const showTooltip = (e) => {
                if (!tooltip) return;
                
                const revenueValue = this.formatCurrency(value);
                tooltip.textContent = `${monthLabels[i]}: ${revenueValue}`;
                tooltip.style.display = 'block';
                
                // Use requestAnimationFrame to ensure tooltip is rendered before calculating position
                requestAnimationFrame(() => {
                    // Calculate tooltip position relative to chart container
                    const containerRect = chartContainer.getBoundingClientRect();
                    const svgRect = svg.getBoundingClientRect();
                    
                    // Convert SVG coordinates to screen coordinates
                    const scaleX = svgRect.width / 800; // viewBox width
                    const scaleY = svgRect.height / 300; // viewBox height
                    
                    // Calculate position relative to chart container
                    const pointX = (x * scaleX) + (svgRect.left - containerRect.left);
                    const pointY = (y * scaleY) + (svgRect.top - containerRect.top);
                    
                    // Position tooltip above the point, centered
                    const tooltipWidth = tooltip.offsetWidth || 100; // Fallback width
                    tooltip.style.left = `${pointX - (tooltipWidth / 2)}px`;
                    tooltip.style.top = `${pointY - 40}px`;
                });
                
                // Highlight the dot
                dot.setAttribute('r', '6');
            };
            
            const hideTooltip = () => {
                if (tooltip) {
                    tooltip.style.display = 'none';
                }
                // Reset dot size
                dot.setAttribute('r', '4');
            };
            
            hoverCircle.addEventListener('mouseenter', showTooltip);
            hoverCircle.addEventListener('mouseleave', hideTooltip);
            dot.addEventListener('mouseenter', showTooltip);
            dot.addEventListener('mouseleave', hideTooltip);
            
            lineGroup.appendChild(hoverCircle);
            lineGroup.appendChild(dot);
        });
    }

    /**
     * Get revenue metrics
     * @returns {Object} Current revenue metrics
     */
    getMetrics() {
        return { ...this.metrics };
    }

    /**
     * Get monthly revenue data
     * @returns {Array} Monthly revenue array
     */
    getMonthlyRevenue() {
        return [...this.monthlyRevenue];
    }

    /**
     * Format currency for display
     * @param {number} amount - Amount to format
     * @returns {string} Formatted currency string
     */
    formatCurrency(amount) {
        return `KES ${Math.round(amount).toLocaleString()}`;
    }

    /**
     * Format percentage for display
     * @param {number} value - Percentage value
     * @returns {string} Formatted percentage string
     */
    formatPercentage(value) {
        const sign = value >= 0 ? '+' : '';
        return `${sign}${value.toFixed(1)}%`;
    }
}

// Create global instance
const revenueService = new RevenueService();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RevenueService;
}
