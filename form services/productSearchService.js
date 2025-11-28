/**
 * Product Search Service
 * Independent service for searching products from database
 * Fetches products from Supabase and displays images from Cloudinary
 */

class ProductSearchService {
    constructor() {
        this.products = [];
        this.searchInput = null;
        this.searchResults = null;
        this.onProductSelectCallback = null;
    }

    /**
     * Initialize the product search service
     * @param {string} searchInputId - ID of the search input element
     * @param {string} searchResultsId - ID of the search results container
     * @param {Function} onProductSelect - Callback when product is selected
     */
    init(searchInputId, searchResultsId, onProductSelect) {
        this.searchInput = document.getElementById(searchInputId);
        this.searchResults = document.getElementById(searchResultsId);
        this.onProductSelectCallback = onProductSelect;

        if (this.searchInput) {
            this.searchInput.addEventListener('input', (e) => this.handleSearch(e));
        }
    }

    /**
     * Fetch products from Supabase database
     * @returns {Promise<Array>} Array of products with Cloudinary image URLs
     */
    async fetchProducts() {
        try {
            // TODO: Replace with actual Supabase API call
            // const { data, error } = await supabase
            //     .from('products')
            //     .select('id, name, price, image_url, colors');
            
            // For now, return mock data structure
            // This will be replaced with actual Supabase integration
            return this.products;
        } catch (error) {
            console.error('Error fetching products:', error);
            return [];
        }
    }

    /**
     * Load products into the service
     * @param {Array} products - Array of product objects
     */
    loadProducts(products) {
        this.products = products;
    }

    /**
     * Handle search input changes
     * @param {Event} e - Input event
     */
    handleSearch(e) {
        const query = e.target.value.toLowerCase().trim();
        
        if (query.length === 0) {
            this.hideResults();
            return;
        }

        const filtered = this.products.filter(p => 
            p.name.toLowerCase().includes(query)
        );
        
        this.displaySearchResults(filtered);
    }

    /**
     * Display search results with Cloudinary images
     * @param {Array} results - Filtered product results
     */
    displaySearchResults(results) {
        if (!this.searchResults) return;

        if (results.length === 0) {
            this.searchResults.innerHTML = '<div class="no-results">No items found</div>';
            this.searchResults.classList.add('active');
            return;
        }

        this.searchResults.innerHTML = results.map(product => `
            <div class="search-result-item" data-id="${product.id}">
                <img src="${product.image}" alt="${product.name}" class="result-image">
                <div class="result-info">
                    <div class="result-name">${product.name}</div>
                    <div class="result-price">KES ${product.price.toLocaleString()}</div>
                </div>
            </div>
        `).join('');

        this.searchResults.classList.add('active');

        // Attach click handlers to search result items
        document.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const productId = parseInt(item.dataset.id);
                const selectedProduct = this.products.find(p => p.id === productId);
                
                if (selectedProduct && this.onProductSelectCallback) {
                    this.onProductSelectCallback(selectedProduct);
                }
                
                this.hideResults();
            });
        });
    }

    /**
     * Hide search results dropdown
     */
    hideResults() {
        if (this.searchResults) {
            this.searchResults.classList.remove('active');
        }
    }

    /**
     * Check if click is outside search container
     * @param {Event} e - Click event
     */
    handleOutsideClick(e) {
        if (this.searchInput && this.searchResults) {
            if (!this.searchInput.contains(e.target) && !this.searchResults.contains(e.target)) {
                this.hideResults();
            }
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProductSearchService;
}

