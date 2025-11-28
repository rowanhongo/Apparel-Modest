/**
 * Search Results UI & Delivery Option Service
 * Combined service for search results UI management and delivery option handling
 */

class SearchResultsDeliveryService {
    constructor() {
        this.deliveryOptionSelect = null;
        this.deliveryLocationInput = null;
        this.deliveryLocation = null;
        this.storeLocationMessage = null;
    }

    /**
     * Initialize the search results and delivery service
     * @param {string} deliveryOptionId - ID of the delivery option select element
     */
    init(deliveryOptionId) {
        this.deliveryOptionSelect = document.getElementById(deliveryOptionId);
        this.deliveryLocationInput = document.getElementById('deliveryLocationInput');
        this.deliveryLocation = document.getElementById('deliveryLocation');
        this.storeLocationMessage = document.getElementById('storeLocationMessage');

        if (this.deliveryOptionSelect) {
            this.deliveryOptionSelect.addEventListener('change', () => 
                this.handleDeliveryOptionChange()
            );
        }

        // Initialize click outside handler for search results
        this.initSearchResultsClickHandler();
    }

    /**
     * Handle delivery option dropdown change
     */
    handleDeliveryOptionChange() {
        if (!this.deliveryOptionSelect) return;

        const selectedValue = this.deliveryOptionSelect.value;

        // Options that require delivery location
        const requiresLocation = ['uber', 'pickup-mtaani', 'courier'];

        if (requiresLocation.includes(selectedValue)) {
            this.showDeliveryLocationInput();
        } else if (selectedValue === 'in-store-pickup') {
            this.showStoreLocationMessage();
        } else {
            this.hideDeliveryLocationInput();
            this.hideStoreLocationMessage();
        }
    }

    /**
     * Show delivery location input field
     */
    showDeliveryLocationInput() {
        if (this.deliveryLocationInput) {
            this.deliveryLocationInput.style.display = 'block';
        }

        if (this.deliveryLocation) {
            this.deliveryLocation.required = true;
        }

        if (this.storeLocationMessage) {
            this.storeLocationMessage.style.display = 'none';
        }
    }

    /**
     * Hide delivery location input field
     */
    hideDeliveryLocationInput() {
        if (this.deliveryLocationInput) {
            this.deliveryLocationInput.style.display = 'none';
        }

        if (this.deliveryLocation) {
            this.deliveryLocation.required = false;
            this.deliveryLocation.value = '';
        }
    }

    /**
     * Show store location message
     */
    showStoreLocationMessage() {
        if (this.storeLocationMessage) {
            this.storeLocationMessage.style.display = 'block';
        }

        if (this.deliveryLocationInput) {
            this.deliveryLocationInput.style.display = 'none';
        }

        if (this.deliveryLocation) {
            this.deliveryLocation.required = false;
            this.deliveryLocation.value = '';
        }
    }

    /**
     * Hide store location message
     */
    hideStoreLocationMessage() {
        if (this.storeLocationMessage) {
            this.storeLocationMessage.style.display = 'none';
        }
    }

    /**
     * Initialize click outside handler for search results
     * Closes search results when clicking outside the search container
     */
    initSearchResultsClickHandler() {
        document.addEventListener('click', (e) => {
            const searchInput = document.getElementById('productSearch');
            const searchResults = document.getElementById('searchResults');

            if (searchInput && searchResults) {
                if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
                    searchResults.classList.remove('active');
                }
            }
        });
    }

    /**
     * Get selected delivery option
     * @returns {string} Selected delivery option value
     */
    getDeliveryOption() {
        if (!this.deliveryOptionSelect) return null;
        return this.deliveryOptionSelect.value;
    }

    /**
     * Get delivery location value
     * @returns {string|null} Delivery location or null
     */
    getDeliveryLocation() {
        if (!this.deliveryLocation) return null;
        const location = this.deliveryLocation.value.trim();
        return location || null;
    }

    /**
     * Validate delivery option and location
     * @returns {Object} Validation result with isValid and message
     */
    validate() {
        if (!this.deliveryOptionSelect || !this.deliveryOptionSelect.value) {
            return {
                isValid: false,
                message: 'Please select a delivery option'
            };
        }

        const selectedValue = this.deliveryOptionSelect.value;
        const requiresLocation = ['uber', 'pickup-mtaani', 'courier'];

        if (requiresLocation.includes(selectedValue)) {
            const location = this.getDeliveryLocation();
            if (!location) {
                return {
                    isValid: false,
                    message: 'Please enter delivery location'
                };
            }
        }

        return {
            isValid: true,
            message: ''
        };
    }

    /**
     * Reset delivery option to initial state
     */
    reset() {
        if (this.deliveryOptionSelect) {
            this.deliveryOptionSelect.value = '';
        }

        this.hideDeliveryLocationInput();
        this.hideStoreLocationMessage();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SearchResultsDeliveryService;
}

