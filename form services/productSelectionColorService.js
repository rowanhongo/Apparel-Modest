/**
 * Product Selection & Color Selection Service
 * Combined service for product selection and color selection functionality
 */

class ProductSelectionColorService {
    constructor() {
        this.selectedProduct = null;
        this.selectedColor = null;
        this.searchInput = null;
        this.selectedProductDiv = null;
        this.colorOptionsDiv = null;
        this.colorGrid = null;
    }

    /**
     * Initialize the product selection and color service
     * @param {string} searchInputId - ID of the search input element
     * @param {string} selectedProductId - ID of the selected product container
     * @param {string} colorOptionsId - ID of the color options container
     * @param {string} colorGridId - ID of the color grid container
     */
    init(searchInputId, selectedProductId, colorOptionsId, colorGridId) {
        this.searchInput = document.getElementById(searchInputId);
        this.selectedProductDiv = document.getElementById(selectedProductId);
        this.colorOptionsDiv = document.getElementById(colorOptionsId);
        this.colorGrid = document.getElementById(colorGridId);
    }

    /**
     * Select a product and display its details
     * @param {Object} product - Product object with id, name, price, image, colors
     */
    selectProduct(product) {
        this.selectedProduct = product;

        if (this.searchInput) {
            this.searchInput.value = product.name;
        }

        // Update selected product display
        const selectedImage = document.getElementById('selectedImage');
        const selectedName = document.getElementById('selectedName');
        const selectedPrice = document.getElementById('selectedPrice');

        if (selectedImage) selectedImage.src = product.image;
        if (selectedName) selectedName.textContent = product.name;
        if (selectedPrice) selectedPrice.textContent = `KES ${product.price.toLocaleString()}`;
        
        if (this.selectedProductDiv) {
            this.selectedProductDiv.classList.add('active');
        }

        // Display color options for selected product
        if (product.colors && Array.isArray(product.colors)) {
            this.displayColorOptions(product.colors);
        }
    }

    /**
     * Display color options for the selected product
     * @param {Array} colors - Array of color strings
     */
    displayColorOptions(colors) {
        if (!this.colorGrid || !this.colorOptionsDiv) return;

        this.colorGrid.innerHTML = colors.map(color => `
            <div class="color-option" data-color="${color}">${color}</div>
        `).join('');

        this.colorOptionsDiv.classList.add('active');

        // Attach click handlers to color options
        document.querySelectorAll('.color-option').forEach(option => {
            option.addEventListener('click', () => {
                // Remove selected class from all options
                document.querySelectorAll('.color-option').forEach(o => 
                    o.classList.remove('selected')
                );
                
                // Add selected class to clicked option
                option.classList.add('selected');
                this.selectedColor = option.dataset.color;
            });
        });
    }

    /**
     * Get the currently selected product
     * @returns {Object|null} Selected product object or null
     */
    getSelectedProduct() {
        return this.selectedProduct;
    }

    /**
     * Get the currently selected color
     * @returns {string|null} Selected color string or null
     */
    getSelectedColor() {
        return this.selectedColor;
    }

    /**
     * Reset product and color selection
     */
    reset() {
        this.selectedProduct = null;
        this.selectedColor = null;

        if (this.selectedProductDiv) {
            this.selectedProductDiv.classList.remove('active');
        }

        if (this.colorOptionsDiv) {
            this.colorOptionsDiv.classList.remove('active');
        }

        if (this.colorGrid) {
            this.colorGrid.innerHTML = '';
        }
    }

    /**
     * Validate that product and color are selected
     * @returns {Object} Validation result with isValid and message
     */
    validate() {
        if (!this.selectedProduct) {
            return {
                isValid: false,
                message: 'Please select an item'
            };
        }

        if (!this.selectedColor) {
            return {
                isValid: false,
                message: 'Please select a color'
            };
        }

        return {
            isValid: true,
            message: ''
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProductSelectionColorService;
}

