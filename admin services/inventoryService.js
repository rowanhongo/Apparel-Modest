/**
 * Inventory Service
 * Service for admin inventory management - track stock levels and manage inventory
 */

class InventoryService {
    constructor() {
        this.inventory = [];
        this.container = null;
    }

    /**
     * Initialize the inventory service
     * @param {string} containerId - ID of the inventory container element
     */
    init(containerId) {
        this.container = document.getElementById(containerId);
    }

    /**
     * Load inventory items into the service
     * @param {Array} inventory - Array of inventory item objects
     */
    loadInventory(inventory) {
        this.inventory = inventory || [];
        this.render();
    }

    /**
     * Render inventory items in the container
     */
    render() {
        if (!this.container) return;

        this.container.innerHTML = '';

        this.inventory.forEach(item => {
            const inventoryCard = this.createInventoryCard(item);
            this.container.appendChild(inventoryCard);
        });
    }

    /**
     * Create inventory card element
     * @param {Object} item - Inventory item object
     * @returns {HTMLElement} Inventory card element
     */
    createInventoryCard(item) {
        const card = document.createElement('div');
        card.className = 'glass-card hover:bg-white/15 transition-all duration-300';
        
        const stockPercentage = this.calculateStockPercentage(item.totalStock, item.maxStock);
        const colorBreakdown = this.formatColorBreakdown(item.colors);

        card.innerHTML = `
            <div class="p-6">
                <h3 class="text-white font-semibold mb-2">${item.name}</h3>
                <div class="text-2xl font-bold text-accent mb-2">${item.totalStock} units</div>
                <div class="text-sm text-white/60 mb-4">${colorBreakdown}</div>
                <div class="w-full bg-white/20 rounded-full h-2">
                    <div class="bg-accent h-2 rounded-full" style="width: ${stockPercentage}%"></div>
                </div>
                <div class="text-xs text-white/60 mt-1">${stockPercentage}% in stock</div>
            </div>
        `;

        return card;
    }

    /**
     * Calculate stock percentage
     * @param {number} currentStock - Current stock quantity
     * @param {number} maxStock - Maximum stock capacity
     * @returns {number} Stock percentage
     */
    calculateStockPercentage(currentStock, maxStock) {
        if (!maxStock || maxStock === 0) return 0;
        return Math.round((currentStock / maxStock) * 100);
    }

    /**
     * Format color breakdown for display
     * @param {Object} colors - Color breakdown object (e.g., { Black: 45, White: 38 })
     * @returns {string} Formatted color string
     */
    formatColorBreakdown(colors) {
        if (!colors || typeof colors !== 'object') return 'N/A';
        return Object.entries(colors)
            .map(([color, quantity]) => `${color}: ${quantity}`)
            .join(', ');
    }

    /**
     * Add inventory item
     * @param {Object} item - Inventory item object
     */
    addInventoryItem(item) {
        this.inventory.push(item);
        this.render();
    }

    /**
     * Update inventory item
     * @param {string} itemName - Inventory item name
     * @param {Object} updates - Updates to apply
     */
    updateInventoryItem(itemName, updates) {
        const index = this.inventory.findIndex(item => item.name === itemName);
        if (index !== -1) {
            this.inventory[index] = { ...this.inventory[index], ...updates };
            this.render();
        }
    }

    /**
     * Update stock for an item
     * @param {string} itemName - Inventory item name
     * @param {number} quantity - Stock quantity to add/subtract
     * @param {boolean} isAddition - Whether to add (true) or subtract (false)
     */
    updateStock(itemName, quantity, isAddition = true) {
        const item = this.inventory.find(i => i.name === itemName);
        if (item) {
            if (isAddition) {
                item.totalStock += quantity;
            } else {
                item.totalStock = Math.max(0, item.totalStock - quantity);
            }
            this.render();
        }
    }

    /**
     * Get all inventory items
     * @returns {Array} Array of all inventory items
     */
    getInventory() {
        return [...this.inventory];
    }

    /**
     * Get inventory item by name
     * @param {string} itemName - Inventory item name
     * @returns {Object|null} Inventory item object or null
     */
    getInventoryItem(itemName) {
        return this.inventory.find(item => item.name === itemName) || null;
    }

    /**
     * Get low stock items (below threshold)
     * @param {number} threshold - Stock threshold percentage (default: 30)
     * @returns {Array} Array of low stock items
     */
    getLowStockItems(threshold = 30) {
        return this.inventory.filter(item => {
            const percentage = this.calculateStockPercentage(item.totalStock, item.maxStock);
            return percentage < threshold;
        });
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = InventoryService;
}

