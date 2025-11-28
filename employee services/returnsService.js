/**
 * Returns Service
 * Service for managing returns - add, edit, toggle resolved status
 */

class ReturnsService {
    constructor() {
        this.returns = [];
        this.container = null;
        this.modal = null;
        this.form = null;
        this.supabase = null;
        this.products = [];
        this.selectedProduct = null;
        this.productSearchInput = null;
        this.productSearchResults = null;
    }

    /**
     * Initialize the returns service
     * @param {string} containerId - ID of the container element
     * @param {string} modalId - ID of the add return modal
     * @param {string} formId - ID of the add return form
     */
    async init(containerId, modalId, formId) {
        this.container = document.getElementById(containerId);
        this.modal = document.getElementById(modalId);
        this.form = document.getElementById(formId);

        // Get Supabase client
        this.supabase = getSupabaseClient();
        if (!this.supabase) {
            console.error('❌ Supabase client not available');
            return;
        }

        // Get product search elements
        this.productSearchInput = document.getElementById('return-cloth-item');
        this.productSearchResults = document.getElementById('return-product-search-results');

        if (!this.productSearchInput) {
            console.error('❌ Product search input not found');
        }
        if (!this.productSearchResults) {
            console.error('❌ Product search results container not found');
        }

        // Load returns from database
        await this.loadReturnsFromDatabase();

        // Load products from database
        await this.loadProductsFromDatabase();

        this.initEventListeners();
        this.initProductSearch();
    }

    /**
     * Load products from Supabase database
     */
    async loadProductsFromDatabase() {
        try {
            const { data: productsData, error } = await this.supabase
                .from('products')
                .select('id, name, image_url')
                .order('name', { ascending: true });

            if (error) {
                console.error('Error loading products:', error);
                this.products = [];
                return;
            }

            this.products = (productsData || []).map(product => ({
                id: product.id,
                name: product.name || 'Unknown Product',
                image: product.image_url || 'https://via.placeholder.com/400'
            }));

            console.log(`✅ Loaded ${this.products.length} products for returns`);
        } catch (error) {
            console.error('Error loading products:', error);
            this.products = [];
        }
    }

    /**
     * Initialize product search functionality
     */
    initProductSearch() {
        if (!this.productSearchInput || !this.productSearchResults) return;

        // Search input handler
        this.productSearchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            console.log('🔍 Search query:', query, 'Products available:', this.products.length);
            if (query.length === 0) {
                this.productSearchResults.classList.remove('active');
                this.selectedProduct = null;
                return;
            }
            this.displayProductSearchResults(query);
        });

        // Click outside to close search results
        document.addEventListener('click', (e) => {
            if (!this.productSearchInput || !this.productSearchResults) return;
            const isSearchInput = this.productSearchInput.contains(e.target);
            const isSearchResults = this.productSearchResults.contains(e.target);
            
            if (!isSearchInput && !isSearchResults) {
                this.productSearchResults.classList.remove('active');
            }
        });

        // Event delegation for search results
        if (this.productSearchResults) {
            this.productSearchResults.addEventListener('click', (e) => {
                const item = e.target.closest('.return-search-result-item');
                if (item) {
                    e.preventDefault();
                    e.stopPropagation();
                    const productId = item.dataset.id;
                    this.selectProduct(productId);
                }
            });
        }
    }

    /**
     * Display product search results
     * @param {string} query - Search query
     */
    displayProductSearchResults(query) {
        if (!this.productSearchResults) {
            console.error('Product search results container not found');
            return;
        }

        if (!this.products || this.products.length === 0) {
            console.warn('No products loaded yet');
            this.productSearchResults.innerHTML = '<div class="return-search-no-results">Loading products...</div>';
            this.productSearchResults.classList.add('active');
            return;
        }

        const filtered = this.products.filter(p => 
            p.name.toLowerCase().includes(query)
        );

        if (filtered.length === 0) {
            this.productSearchResults.innerHTML = '<div class="return-search-no-results">No items found</div>';
            this.productSearchResults.classList.add('active');
            return;
        }

        this.productSearchResults.innerHTML = filtered.map(product => `
            <div class="return-search-result-item" data-id="${product.id}">
                <img src="${product.image}" alt="${product.name}" class="return-search-result-image">
                <div class="return-search-result-name">${product.name}</div>
            </div>
        `).join('');
        this.productSearchResults.classList.add('active');
        console.log(`✅ Displaying ${filtered.length} search results for query: "${query}"`);
    }

    /**
     * Select a product from search results
     * @param {string} productId - Product ID (UUID)
     */
    selectProduct(productId) {
        const product = this.products.find(p => String(p.id) === String(productId));
        if (!product) {
            console.error('Product not found:', productId);
            return;
        }

        this.selectedProduct = product;
        if (this.productSearchInput) {
            this.productSearchInput.value = product.name;
        }
        if (this.productSearchResults) {
            this.productSearchResults.classList.remove('active');
        }
        
        // Set hidden input for product ID
        const hiddenInput = document.getElementById('return-selected-product-id');
        if (hiddenInput) {
            hiddenInput.value = product.id;
        }

        // Show selected product preview
        this.showSelectedProductPreview(product);
    }

    /**
     * Show selected product preview
     * @param {Object} product - Selected product object
     */
    showSelectedProductPreview(product) {
        const preview = document.getElementById('return-selected-product-preview');
        const previewImage = document.getElementById('return-selected-product-image');
        const previewName = document.getElementById('return-selected-product-name');

        if (preview && previewImage && previewName) {
            previewImage.src = product.image || 'https://via.placeholder.com/400';
            previewImage.alt = product.name;
            previewName.textContent = product.name;
            preview.classList.add('active');
        }
    }

    /**
     * Load returns from Supabase database
     */
    async loadReturnsFromDatabase() {
        try {
            const { data: returns, error } = await this.supabase
                .from('returns')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching returns:', error);
                this.returns = [];
                this.render();
                return;
            }

            // Transform Supabase data to match expected format
            this.returns = (returns || []).map(returnItem => this.transformReturn(returnItem));
            this.render();
        } catch (error) {
            console.error('Error loading returns from database:', error);
            this.returns = [];
            this.render();
        }
    }

    /**
     * Transform Supabase return to display format
     * @param {Object} returnItem - Return from Supabase
     * @returns {Object} Transformed return object
     */
    transformReturn(returnItem) {
        const dateStr = returnItem.created_at 
            ? new Date(returnItem.created_at).toISOString().split('T')[0] 
            : new Date().toISOString().split('T')[0];

        return {
            id: returnItem.id,
            customerName: returnItem.client_name || returnItem.customer_name || 'Unknown Customer',
            customerNumber: returnItem.client_number || returnItem.customer_phone || '',
            clothItem: returnItem.cloth_item || returnItem.product_name || 'Unknown Item',
            comment: returnItem.comment || '',
            resolved: returnItem.resolved || false,
            date: dateStr
        };
    }

    /**
     * Initialize event listeners
     */
    initEventListeners() {
        const addReturnBtn = document.getElementById('add-return-btn');
        const cancelReturnBtn = document.getElementById('cancel-return-btn');

        if (addReturnBtn) {
            addReturnBtn.addEventListener('click', () => this.openModal());
        }

        if (cancelReturnBtn) {
            cancelReturnBtn.addEventListener('click', () => this.closeModal());
        }

        if (this.form) {
            this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        }

        if (this.modal) {
            this.modal.addEventListener('click', (e) => {
                if (e.target.id === 'add-return-modal') {
                    this.closeModal();
                }
            });
        }
    }

    /**
     * Load returns into the service
     * @param {Array} returns - Array of return objects
     */
    loadReturns(returns) {
        this.returns = returns || [];
        this.render();
    }

    /**
     * Render returns in the container
     */
    render() {
        if (!this.container) return;

        this.container.innerHTML = '';

        this.returns.forEach(returnItem => {
            const returnBubble = this.createReturnBubble(returnItem);
            this.container.appendChild(returnBubble);
        });
    }

    /**
     * Create return bubble element
     * @param {Object} returnItem - Return object
     * @returns {HTMLElement} Return bubble element
     */
    createReturnBubble(returnItem) {
        const bubble = document.createElement('div');
        bubble.className = `order-bubble return-item ${returnItem.resolved ? 'resolved' : ''}`;
        bubble.innerHTML = `
            <div class="order-header">
                <div class="order-info" style="flex: 1;">
                    <div class="customer-name">${returnItem.customerName}</div>
                    <div class="product-name">Phone: ${returnItem.customerNumber}</div>
                    <div class="product-name">Item: ${returnItem.clothItem}</div>
                    <div class="product-color" style="margin-top: 8px; display: block;">${returnItem.comment}</div>
                </div>
            </div>
            <div class="return-status">
                <input type="checkbox" 
                       id="return-${returnItem.id}" 
                       class="return-resolved-checkbox" 
                       ${returnItem.resolved ? 'checked' : ''}
                       data-id="${returnItem.id}">
                <label for="return-${returnItem.id}" class="return-status-label">
                    ${returnItem.resolved ? 'Issue Resolved' : 'Mark as Resolved'}
                </label>
            </div>
        `;

        // Add checkbox change handler
        const checkbox = bubble.querySelector('.return-resolved-checkbox');
        checkbox.addEventListener('change', () => {
            this.toggleResolved(returnItem.id);
        });

        return bubble;
    }

    /**
     * Toggle resolved status of a return
     * @param {string} returnId - Return ID (UUID)
     */
    async toggleResolved(returnId) {
        const returnItem = this.returns.find(r => r.id === returnId);
        if (!returnItem) {
            console.error('Return not found:', returnId);
            return;
        }

        const newResolvedStatus = !returnItem.resolved;

        try {
            const { error } = await this.supabase
                .from('returns')
                .update({ resolved: newResolvedStatus })
                .eq('id', returnId);

            if (error) {
                console.error('Error updating return:', error);
                alert('Failed to update return status. Please try again.');
                return;
            }

            // Update local data
            returnItem.resolved = newResolvedStatus;
            this.render();
        } catch (error) {
            console.error('Error toggling return resolved status:', error);
            alert('Failed to update return status. Please try again.');
        }
    }

    /**
     * Open add return modal
     */
    async openModal() {
        if (this.modal) {
            this.modal.classList.remove('hidden');
            // Reload products when modal opens
            await this.loadProductsFromDatabase();
            console.log('✅ Products loaded for search:', this.products.length);
        }
        // Reset selected product
        this.selectedProduct = null;
        if (this.productSearchInput) {
            this.productSearchInput.value = '';
        }
        if (this.productSearchResults) {
            this.productSearchResults.classList.remove('active');
        }
        const hiddenInput = document.getElementById('return-selected-product-id');
        if (hiddenInput) {
            hiddenInput.value = '';
        }
        
        // Hide selected product preview
        const preview = document.getElementById('return-selected-product-preview');
        if (preview) {
            preview.classList.remove('active');
        }
        
        // Initialize phone number field handlers
        this.initPhoneNumberFields();
    }

    /**
     * Initialize phone number field handlers (similar to order form)
     */
    initPhoneNumberFields() {
        const countryCodeField = document.getElementById('return-country-code');
        const phoneNumberField = document.getElementById('return-phone-number');

        if (!countryCodeField || !phoneNumberField) return;

        // Remove existing listeners by cloning and replacing
        const newCountryCodeField = countryCodeField.cloneNode(true);
        const newPhoneNumberField = phoneNumberField.cloneNode(true);
        countryCodeField.parentNode.replaceChild(newCountryCodeField, countryCodeField);
        phoneNumberField.parentNode.replaceChild(newPhoneNumberField, phoneNumberField);

        // Country code field - only digits, auto-add + prefix
        newCountryCodeField.addEventListener('input', function(e) {
            let value = this.value.replace(/[^0-9]/g, '');
            if (value && !this.value.startsWith('+')) {
                this.value = '+' + value;
            } else if (!value) {
                this.value = '+';
            } else {
                this.value = '+' + value;
            }
        });
        
        newCountryCodeField.addEventListener('keypress', function(e) {
            const allowedKeys = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
            if (this.value === '+' && e.key === '+') {
                e.preventDefault();
                return;
            }
            if (!/[0-9]/.test(e.key) && !allowedKeys.includes(e.key)) {
                e.preventDefault();
            }
        });

        // Initialize country code with + on focus
        newCountryCodeField.addEventListener('focus', function() {
            if (!this.value) {
                this.value = '+';
            }
        });

        // Phone number field - only digits
        newPhoneNumberField.addEventListener('input', function(e) {
            this.value = this.value.replace(/[^0-9]/g, '');
        });
        
        newPhoneNumberField.addEventListener('keypress', function(e) {
            const allowedKeys = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
            if (!/[0-9]/.test(e.key) && !allowedKeys.includes(e.key)) {
                e.preventDefault();
            }
        });
    }

    /**
     * Close add return modal
     */
    closeModal() {
        if (this.modal) {
            this.modal.classList.add('hidden');
        }
        if (this.form) {
            this.form.reset();
        }
        // Reset product search
        this.selectedProduct = null;
        if (this.productSearchInput) {
            this.productSearchInput.value = '';
        }
        if (this.productSearchResults) {
            this.productSearchResults.classList.remove('active');
        }
        const hiddenInput = document.getElementById('return-selected-product-id');
        if (hiddenInput) {
            hiddenInput.value = '';
        }
        
        // Hide selected product preview
        const preview = document.getElementById('return-selected-product-preview');
        if (preview) {
            preview.classList.remove('active');
        }
        
        // Reset phone number fields
        const countryCodeField = document.getElementById('return-country-code');
        const phoneNumberField = document.getElementById('return-phone-number');
        if (countryCodeField) countryCodeField.value = '+';
        if (phoneNumberField) phoneNumberField.value = '';
    }

    /**
     * Handle form submission
     * @param {Event} e - Form submit event
     */
    async handleSubmit(e) {
        e.preventDefault();

        const clientName = document.getElementById('return-client-name')?.value.trim();
        const countryCode = document.getElementById('return-country-code')?.value.trim();
        const phoneNumber = document.getElementById('return-phone-number')?.value.trim();
        const clothItemInput = document.getElementById('return-cloth-item')?.value.trim();
        const comment = document.getElementById('return-comment')?.value.trim();

        if (!clientName || !countryCode || !phoneNumber || !clothItemInput || !comment) {
            alert('Please fill in all fields');
            return;
        }

        // Validate that a product was selected from search
        if (!this.selectedProduct) {
            alert('Please select a cloth item from the search results');
            return;
        }

        // Validate and combine phone number
        let countryCodeClean = countryCode.replace(/^\+/, '');
        if (!countryCodeClean || countryCodeClean === '') {
            alert('Please enter your country code (e.g., 254 for Kenya)');
            return;
        }
        
        if (!/^\d+$/.test(countryCodeClean)) {
            alert('Country code must contain only numbers');
            return;
        }

        // Remove leading 0 from phone number if present
        let phoneNumberClean = phoneNumber;
        if (phoneNumberClean.startsWith('0')) {
            phoneNumberClean = phoneNumberClean.substring(1);
        }
        
        if (!/^\d+$/.test(phoneNumberClean)) {
            alert('Phone number must contain only numbers');
            return;
        }

        // Combine: +countryCode + phoneNumber
        const customerPhone = '+' + countryCodeClean + phoneNumberClean;

        const clothItem = this.selectedProduct.name;

        try {
            // First, find or create customer in customers table (customer_id is REQUIRED)
            let customerId;
            const { data: existingCustomer, error: findError } = await this.supabase
                .from('customers')
                .select('id')
                .eq('phone', customerPhone)
                .maybeSingle(); // Use maybeSingle() to handle no results gracefully

            // Handle customer lookup - use maybeSingle() to avoid errors when not found
            if (existingCustomer) {
                customerId = existingCustomer.id;
                // Update customer name if it changed
                await this.supabase
                    .from('customers')
                    .update({ name: clientName })
                    .eq('id', customerId);
            }
            
            // If customer not found or lookup failed, create a new one
            if (!customerId) {
                // Create new customer (required for customer_id foreign key)
                const { data: newCustomer, error: customerError } = await this.supabase
                    .from('customers')
                    .insert({
                        name: clientName,
                        phone: customerPhone
                    })
                    .select()
                    .single();

                if (customerError) {
                    console.error('Error creating customer:', customerError);
                    alert(`Failed to create customer: ${customerError.message}. Please try again.`);
                    return;
                }
                
                if (!newCustomer || !newCustomer.id) {
                    alert('Failed to create customer. Please try again.');
                    return;
                }
                
                customerId = newCustomer.id;
            }
            
            // Ensure customerId is set before proceeding
            if (!customerId) {
                alert('Failed to get or create customer. Please try again.');
                return;
            }

            // Validate all required fields before insert
            if (!clientName || !customerPhone || !clothItem || !comment) {
                alert('Please fill in all required fields.');
                return;
            }

            // Insert new return into Supabase
            // The database has both client_name/client_number AND customer_name/customer_phone
            // Both sets need to be filled based on the schema
            const insertData = {
                customer_id: customerId, // REQUIRED - foreign key to customers table
                client_name: clientName.trim(), // Main column for client name
                client_number: customerPhone.trim(), // Main column for client number
                customer_name: clientName.trim(), // Also required (NOT NULL constraint)
                customer_phone: customerPhone.trim(), // Also required (NOT NULL constraint)
                cloth_item: clothItem.trim(),
                comment: comment.trim(),
                resolved: false
            };

            console.log('📝 Inserting return with data:', insertData);

            const { data, error } = await this.supabase
                .from('returns')
                .insert(insertData)
                .select()
                .single();

            if (error) {
                console.error('Error creating return:', error);
                alert(`Failed to add return: ${error.message || 'Unknown error'}. Please try again.`);
                return;
            }

            // Transform and add to local array
            const newReturn = this.transformReturn(data);
            this.returns.unshift(newReturn);

            // Re-render returns
            this.render();

            // Close modal and reset form
            this.closeModal();

            // Show success message
            alert('✓ Return added successfully!');
        } catch (error) {
            console.error('Error submitting return:', error);
            alert('Failed to add return. Please try again.');
        }
    }

    /**
     * Reload returns from database
     */
    async reloadReturns() {
        await this.loadReturnsFromDatabase();
    }

    /**
     * Get all returns
     * @returns {Array} Array of all returns
     */
    getReturns() {
        return [...this.returns];
    }

    /**
     * Get unresolved returns
     * @returns {Array} Array of unresolved returns
     */
    getUnresolvedReturns() {
        return this.returns.filter(r => !r.resolved);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReturnsService;
}

// Make available globally
if (typeof window !== 'undefined') {
    window.ReturnsService = ReturnsService;
}

