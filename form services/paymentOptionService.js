/**
 * Payment Option Service
 * Independent service for payment option selection
 */

class PaymentOptionService {
    constructor() {
        this.paymentOptionSelect = null;
    }

    /**
     * Initialize the payment option service
     * @param {string} paymentOptionId - ID of the payment option select element
     */
    init(paymentOptionId) {
        this.paymentOptionSelect = document.getElementById(paymentOptionId);
    }

    /**
     * Get selected payment option
     * @returns {string} Selected payment option value
     */
    getSelectedPaymentOption() {
        if (!this.paymentOptionSelect) return null;
        return this.paymentOptionSelect.value;
    }

    /**
     * Validate payment option selection
     * @returns {Object} Validation result with isValid and message
     */
    validate() {
        if (!this.paymentOptionSelect || !this.paymentOptionSelect.value) {
            return {
                isValid: false,
                message: 'Please select a payment option'
            };
        }

        return {
            isValid: true,
            message: ''
        };
    }

    /**
     * Reset payment option to initial state
     */
    reset() {
        if (this.paymentOptionSelect) {
            this.paymentOptionSelect.value = '';
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PaymentOptionService;
}

