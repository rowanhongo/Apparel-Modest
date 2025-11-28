/**
 * Body Measurements & Size Chart Display Service
 * Combined service for body measurements selection and size chart display
 */

class BodyMeasurementsService {
    constructor() {
        this.bodyMeasurementsSelect = null;
        this.customSizeInput = null;
        this.customSize = null;
        this.customBust = null;
        this.customWaist = null;
        this.customHips = null;
    }

    /**
     * Initialize the body measurements service
     * @param {string} bodyMeasurementsId - ID of the body measurements select element
     * @param {string} customSizeInputId - ID of the custom size input container
     */
    init(bodyMeasurementsId, customSizeInputId) {
        this.bodyMeasurementsSelect = document.getElementById(bodyMeasurementsId);
        this.customSizeInput = document.getElementById(customSizeInputId);
        this.customSize = document.getElementById('customSize');
        this.customBust = document.getElementById('customBust');
        this.customWaist = document.getElementById('customWaist');
        this.customHips = document.getElementById('customHips');

        if (this.bodyMeasurementsSelect) {
            this.bodyMeasurementsSelect.addEventListener('change', () => 
                this.handleMeasurementChange()
            );
        }

        // Initialize custom size field sanitization
        this.initCustomSizeSanitization();
    }

    /**
     * Handle body measurements dropdown change
     */
    handleMeasurementChange() {
        if (!this.bodyMeasurementsSelect || !this.customSizeInput) return;

        const selectedValue = this.bodyMeasurementsSelect.value;

        if (selectedValue === 'custom') {
            this.showCustomSizeInput();
        } else {
            this.hideCustomSizeInput();
        }
    }

    /**
     * Show custom size input fields
     */
    showCustomSizeInput() {
        if (this.customSizeInput) {
            this.customSizeInput.style.display = 'block';
        }

        // Set required attributes
        if (this.customSize) this.customSize.required = true;
        if (this.customBust) this.customBust.required = true;
        if (this.customWaist) this.customWaist.required = true;
        if (this.customHips) this.customHips.required = true;
    }

    /**
     * Hide custom size input fields
     */
    hideCustomSizeInput() {
        if (this.customSizeInput) {
            this.customSizeInput.style.display = 'none';
        }

        // Remove required attributes
        if (this.customSize) {
            this.customSize.required = false;
            this.customSize.value = '';
        }
        if (this.customBust) {
            this.customBust.required = false;
            this.customBust.value = '';
        }
        if (this.customWaist) {
            this.customWaist.required = false;
            this.customWaist.value = '';
        }
        if (this.customHips) {
            this.customHips.required = false;
            this.customHips.value = '';
        }
    }

    /**
     * Initialize input sanitization for custom size fields
     * Ensures only numeric values can be entered
     */
    initCustomSizeSanitization() {
        const customFields = [
            this.customSize,
            this.customBust,
            this.customWaist,
            this.customHips
        ].filter(field => field !== null);

        customFields.forEach(field => {
            field.addEventListener('input', function(e) {
                // Remove any non-numeric characters
                this.value = this.value.replace(/[^0-9]/g, '');
            });

            field.addEventListener('keypress', function(e) {
                // Prevent non-numeric characters from being typed
                const allowedKeys = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
                if (!/[0-9]/.test(e.key) && !allowedKeys.includes(e.key)) {
                    e.preventDefault();
                }
            });
        });
    }

    /**
     * Get body measurements data in an orderly manner for database storage
     * @returns {Object|null} Body measurements object or null if invalid
     */
    getBodyMeasurementsData() {
        if (!this.bodyMeasurementsSelect) return null;

        const selectedValue = this.bodyMeasurementsSelect.value;

        if (!selectedValue) {
            return null;
        }

        // If custom size is selected, return structured data
        if (selectedValue === 'custom') {
            const customSize = this.customSize ? this.customSize.value.trim() : '';
            const customBust = this.customBust ? this.customBust.value.trim() : '';
            const customWaist = this.customWaist ? this.customWaist.value.trim() : '';
            const customHips = this.customHips ? this.customHips.value.trim() : '';

            // Return structured object for database storage
            return {
                type: 'custom',
                size: customSize,
                bust: customBust,
                waist: customWaist,
                hips: customHips,
                // Also provide formatted string for display
                formatted: `Custom ${customSize}, ${customBust}, ${customWaist}, ${customHips}`
            };
        } else {
            // Return standard size
            return {
                type: 'standard',
                size: selectedValue,
                formatted: selectedValue
            };
        }
    }

    /**
     * Validate body measurements
     * @returns {Object} Validation result with isValid and message
     */
    validate() {
        if (!this.bodyMeasurementsSelect || !this.bodyMeasurementsSelect.value) {
            return {
                isValid: false,
                message: 'Please select body measurements'
            };
        }

        const selectedValue = this.bodyMeasurementsSelect.value;

        if (selectedValue === 'custom') {
            const customSize = this.customSize ? this.customSize.value.trim() : '';
            const customBust = this.customBust ? this.customBust.value.trim() : '';
            const customWaist = this.customWaist ? this.customWaist.value.trim() : '';
            const customHips = this.customHips ? this.customHips.value.trim() : '';

            if (!customSize || !customBust || !customWaist || !customHips) {
                return {
                    isValid: false,
                    message: 'Please fill in all custom measurement fields (Size, Bust, Waist, Hips)'
                };
            }
        }

        return {
            isValid: true,
            message: ''
        };
    }

    /**
     * Reset body measurements to initial state
     */
    reset() {
        if (this.bodyMeasurementsSelect) {
            this.bodyMeasurementsSelect.value = '';
        }
        this.hideCustomSizeInput();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BodyMeasurementsService;
}

