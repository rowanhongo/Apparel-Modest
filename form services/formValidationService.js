/**
 * Form Validation & Input Sanitization Service
 * Combined service for form validation and input sanitization
 */

class FormValidationService {
    constructor() {
        this.nameField = null;
        this.phoneField = null;
    }

    /**
     * Initialize the form validation and sanitization service
     * @param {string} nameFieldId - ID of the name input field
     * @param {string} phoneFieldId - ID of the phone input field
     */
    init(nameFieldId, phoneFieldId) {
        this.nameField = document.getElementById(nameFieldId);
        this.phoneField = document.getElementById(phoneFieldId);

        this.initNameSanitization();
        this.initPhoneSanitization();
    }

    /**
     * Initialize name field sanitization
     * Only allows letters, spaces, hyphens, apostrophes, and periods
     */
    initNameSanitization() {
        if (!this.nameField) return;

        this.nameField.addEventListener('input', function(e) {
            // Remove any non-text characters (keep only letters, spaces, hyphens, apostrophes, and periods)
            this.value = this.value.replace(/[^a-zA-Z\s\-'\.]/g, '');
        });

        this.nameField.addEventListener('keypress', function(e) {
            // Prevent non-text characters from being typed
            const allowedKeys = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
            if (!/[a-zA-Z\s\-'\.]/.test(e.key) && !allowedKeys.includes(e.key)) {
                e.preventDefault();
            }
        });
    }

    /**
     * Initialize phone field sanitization
     * Only allows numeric digits
     */
    initPhoneSanitization() {
        if (!this.phoneField) return;

        this.phoneField.addEventListener('input', function(e) {
            // Remove any non-numeric characters
            this.value = this.value.replace(/[^0-9]/g, '');
        });

        this.phoneField.addEventListener('keypress', function(e) {
            // Prevent non-numeric characters from being typed
            const allowedKeys = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
            if (!/[0-9]/.test(e.key) && !allowedKeys.includes(e.key)) {
                e.preventDefault();
            }
        });
    }

    /**
     * Validate name field
     * @returns {Object} Validation result with isValid and message
     */
    validateName() {
        if (!this.nameField || !this.nameField.value.trim()) {
            return {
                isValid: false,
                message: 'Please enter your full name'
            };
        }

        const name = this.nameField.value.trim();
        if (name.length < 2) {
            return {
                isValid: false,
                message: 'Name must be at least 2 characters long'
            };
        }

        return {
            isValid: true,
            message: ''
        };
    }

    /**
     * Validate phone field
     * @returns {Object} Validation result with isValid and message
     */
    validatePhone() {
        if (!this.phoneField || !this.phoneField.value.trim()) {
            return {
                isValid: false,
                message: 'Please enter your WhatsApp number'
            };
        }

        const phone = this.phoneField.value.trim();
        // Basic phone validation (at least 9 digits for international numbers)
        if (phone.length < 9) {
            return {
                isValid: false,
                message: 'Please enter a valid phone number'
            };
        }

        return {
            isValid: true,
            message: ''
        };
    }

    /**
     * Validate all form fields
     * @param {Object} additionalValidators - Additional validation functions
     * @returns {Object} Validation result with isValid and message
     */
    validateForm(additionalValidators = {}) {
        // Validate name
        const nameValidation = this.validateName();
        if (!nameValidation.isValid) {
            return nameValidation;
        }

        // Validate phone
        const phoneValidation = this.validatePhone();
        if (!phoneValidation.isValid) {
            return phoneValidation;
        }

        // Run additional validators if provided
        for (const [key, validator] of Object.entries(additionalValidators)) {
            if (typeof validator === 'function') {
                const result = validator();
                if (!result.isValid) {
                    return result;
                }
            }
        }

        return {
            isValid: true,
            message: ''
        };
    }

    /**
     * Get sanitized name value
     * @returns {string} Sanitized name
     */
    getSanitizedName() {
        if (!this.nameField) return '';
        return this.nameField.value.trim();
    }

    /**
     * Get sanitized phone value
     * @returns {string} Sanitized phone number
     */
    getSanitizedPhone() {
        if (!this.phoneField) return '';
        return this.phoneField.value.trim();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FormValidationService;
}

