/**
 * Form Submission & Form Reset Service
 * Combined service for form submission and reset functionality
 */

class FormSubmissionService {
    constructor() {
        this.orderForm = null;
        this.selectedProductDiv = null;
        this.colorOptionsDiv = null;
        this.customSizeInput = null;
        this.deliveryLocationInput = null;
        this.storeLocationMessage = null;
    }

    /**
     * Initialize the form submission service
     * @param {string} orderFormId - ID of the order form element
     */
    init(orderFormId) {
        this.orderForm = document.getElementById(orderFormId);
        this.selectedProductDiv = document.getElementById('selectedProduct');
        this.colorOptionsDiv = document.getElementById('colorOptions');
        this.customSizeInput = document.getElementById('customSizeInput');
        this.deliveryLocationInput = document.getElementById('deliveryLocationInput');
        this.storeLocationMessage = document.getElementById('storeLocationMessage');
    }

    /**
     * Handle form submission
     * @param {Object} formData - Complete form data object
     * @param {Function} onSubmitCallback - Callback function to handle submission
     */
    async handleSubmit(formData, onSubmitCallback) {
        try {
            // Call the submission callback (e.g., save to Supabase)
            if (onSubmitCallback && typeof onSubmitCallback === 'function') {
                await onSubmitCallback(formData);
            }

            // Show success message
            alert('✓ Order submitted successfully! We\'ll contact you on WhatsApp shortly.');

            // Reset the form
            this.resetForm();

            return {
                success: true,
                message: 'Order submitted successfully'
            };
        } catch (error) {
            console.error('Error submitting form:', error);
            alert('There was an error submitting your order. Please try again.');
            return {
                success: false,
                message: error.message || 'Submission failed'
            };
        }
    }

    /**
     * Collect all form data into a structured object
     * @param {Object} services - Object containing all form services
     * @returns {Object} Complete order data object
     */
    collectFormData(services) {
        const name = services.formValidation ? services.formValidation.getSanitizedName() : '';
        const phone = services.formValidation ? services.formValidation.getSanitizedPhone() : '';
        const selectedProduct = services.productSelectionColor ? services.productSelectionColor.getSelectedProduct() : null;
        const selectedColor = services.productSelectionColor ? services.productSelectionColor.getSelectedColor() : null;
        const bodyMeasurements = services.bodyMeasurements ? services.bodyMeasurements.getBodyMeasurementsData() : null;
        const deliveryOption = services.searchResultsDelivery ? services.searchResultsDelivery.getDeliveryOption() : null;
        const deliveryLocation = services.searchResultsDelivery ? services.searchResultsDelivery.getDeliveryLocation() : null;
        const paymentOption = services.paymentOption ? services.paymentOption.getSelectedPaymentOption() : null;
        const comments = document.getElementById('comments') ? document.getElementById('comments').value.trim() : '';

        return {
            name: name,
            phone: phone,
            product: selectedProduct ? selectedProduct.name : null,
            productId: selectedProduct ? selectedProduct.id : null,
            color: selectedColor,
            price: selectedProduct ? selectedProduct.price : null,
            bodyMeasurements: bodyMeasurements,
            deliveryOption: deliveryOption,
            deliveryLocation: deliveryLocation,
            paymentOption: paymentOption,
            comments: comments,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Reset the form to initial state
     */
    resetForm() {
        // Reset form fields
        if (this.orderForm) {
            this.orderForm.reset();
        }

        // Reset UI elements
        if (this.selectedProductDiv) {
            this.selectedProductDiv.classList.remove('active');
        }

        if (this.colorOptionsDiv) {
            this.colorOptionsDiv.classList.remove('active');
        }

        if (this.customSizeInput) {
            this.customSizeInput.style.display = 'none';
        }

        // Clear custom size fields
        const customSize = document.getElementById('customSize');
        const customBust = document.getElementById('customBust');
        const customWaist = document.getElementById('customWaist');
        const customHips = document.getElementById('customHips');

        if (customSize) customSize.value = '';
        if (customBust) customBust.value = '';
        if (customWaist) customWaist.value = '';
        if (customHips) customHips.value = '';

        if (this.deliveryLocationInput) {
            this.deliveryLocationInput.style.display = 'none';
        }

        if (this.storeLocationMessage) {
            this.storeLocationMessage.style.display = 'none';
        }
    }

    /**
     * Validate all form data before submission
     * @param {Object} services - Object containing all form services
     * @returns {Object} Validation result with isValid and message
     */
    validateFormData(services) {
        // Validate product selection and color
        if (services.productSelectionColor) {
            const productColorValidation = services.productSelectionColor.validate();
            if (!productColorValidation.isValid) {
                return productColorValidation;
            }
        }

        // Validate body measurements
        if (services.bodyMeasurements) {
            const bodyMeasurementsValidation = services.bodyMeasurements.validate();
            if (!bodyMeasurementsValidation.isValid) {
                return bodyMeasurementsValidation;
            }
        }

        // Validate delivery option
        if (services.searchResultsDelivery) {
            const deliveryValidation = services.searchResultsDelivery.validate();
            if (!deliveryValidation.isValid) {
                return deliveryValidation;
            }
        }

        // Validate payment option
        if (services.paymentOption) {
            const paymentValidation = services.paymentOption.validate();
            if (!paymentValidation.isValid) {
                return paymentValidation;
            }
        }

        // Validate form fields (name, phone)
        if (services.formValidation) {
            const formValidation = services.formValidation.validateForm();
            if (!formValidation.isValid) {
                return formValidation;
            }
        }

        return {
            isValid: true,
            message: ''
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FormSubmissionService;
}

