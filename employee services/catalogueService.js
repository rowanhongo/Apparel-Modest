/**
 * Catalogue Service
 * Service for managing product catalogue - add, edit, delete products, image upload
 */

class CatalogueService {
    constructor() {
        this.products = [];
        this.editingProductId = null;
        this.grid = null;
        this.form = null;
        this.imageInput = null;
        this.imagePreview = null;
        this.imageUploadArea = null;
        this.removeImageBtn = null;
        this.uploadIcon = null;
        this.uploadText = null;
        this.supabase = null;
        this.currentImageFile = null; // Store file for Cloudinary upload
        this.productsChannel = null; // Realtime subscription channel
    }

    /**
     * Initialize the catalogue service
     * @param {string} gridId - ID of the products grid element
     * @param {string} formId - ID of the add product form
     */
    async init(gridId, formId) {
        this.grid = document.getElementById(gridId);
        this.form = document.getElementById(formId);

        // Get Supabase client
        this.supabase = getSupabaseClient();
        if (!this.supabase) {
            console.error('❌ Supabase client not available');
            return;
        }

        this.initImageUpload();
        this.initForm();
        this.initFilters();

        // Load products from database
        await this.loadProductsFromDatabase();
        
        // Set up realtime subscription for products
        this.setupProductsRealtime();
    }


    /**
     * Load products from Supabase database
     */
    async loadProductsFromDatabase() {
        try {
            const { data: products, error } = await this.supabase
                .from('products')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error loading products:', error);
                this.products = [];
                this.render();
                return;
            }

            this.products = products || [];
            this.render();
        } catch (error) {
            console.error('Error in loadProductsFromDatabase:', error);
            this.products = [];
            this.render();
        }
    }

    /**
     * Initialize image upload functionality
     */
    initImageUpload() {
        this.imageInput = document.getElementById('product-image-input');
        this.imagePreview = document.getElementById('product-image-preview');
        this.imageUploadArea = document.getElementById('image-upload-area');
        this.removeImageBtn = document.getElementById('remove-image-btn');
        this.uploadIcon = document.getElementById('upload-icon');
        this.uploadText = document.getElementById('upload-text');

        if (this.imageInput && this.imagePreview && this.imageUploadArea && this.removeImageBtn) {
            this.imageInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        this.showImagePreview(e.target.result);
                    };
                    reader.readAsDataURL(file);
                }
            });

            this.removeImageBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.hideImagePreview();
            });

            // Drag and drop functionality
            this.imageUploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                this.imageUploadArea.style.borderColor = 'rgba(65, 70, 63, 0.6)';
                this.imageUploadArea.style.background = 'rgba(65, 70, 63, 0.1)';
            });

            this.imageUploadArea.addEventListener('dragleave', () => {
                this.imageUploadArea.style.borderColor = 'rgba(65, 70, 63, 0.3)';
                this.imageUploadArea.style.background = 'rgba(65, 70, 63, 0.05)';
            });

            this.imageUploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                this.imageUploadArea.style.borderColor = 'rgba(65, 70, 63, 0.3)';
                this.imageUploadArea.style.background = 'rgba(65, 70, 63, 0.05)';
                const file = e.dataTransfer.files[0];
                if (file && file.type.startsWith('image/')) {
                    this.imageInput.files = e.dataTransfer.files;
                    const event = new Event('change', { bubbles: true });
                    this.imageInput.dispatchEvent(event);
                }
            });
        }
    }

    /**
     * Initialize form submission
     */
    initForm() {
        if (this.form) {
            this.form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleFormSubmit();
            });
        }

        const cancelBtn = document.getElementById('cancel-product-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.resetForm());
        }
    }

    /**
     * Initialize search and filter functionality
     */
    initFilters() {
        const searchInput = document.getElementById('catalogue-search');
        const categoryFilter = document.getElementById('catalogue-category');
        const sortFilter = document.getElementById('catalogue-sort');

        if (searchInput) {
            searchInput.addEventListener('input', () => this.render());
        }

        if (categoryFilter) {
            categoryFilter.addEventListener('change', () => this.render());
        }

        if (sortFilter) {
            sortFilter.addEventListener('change', () => this.render());
        }
    }

    /**
     * Load products into the service
     * @param {Array} products - Array of product objects
     */
    loadProducts(products) {
        this.products = products || [];
        this.render();
    }

    /**
     * Show image preview
     * @param {string} imageSrc - Image source URL
     */
    showImagePreview(imageSrc) {
        if (this.imagePreview && this.removeImageBtn && this.uploadIcon && this.uploadText) {
            this.imagePreview.src = imageSrc;
            this.imagePreview.style.display = 'block';
            this.removeImageBtn.style.display = 'flex';
            this.uploadIcon.style.display = 'none';
            this.uploadText.style.display = 'none';
        }
    }

    /**
     * Hide image preview
     */
    hideImagePreview() {
        if (this.imagePreview && this.removeImageBtn && this.uploadIcon && this.uploadText) {
            this.imagePreview.src = '';
            this.imagePreview.style.display = 'none';
            this.removeImageBtn.style.display = 'none';
            this.uploadIcon.style.display = 'block';
            this.uploadText.style.display = 'block';
            if (this.imageInput) {
                this.imageInput.value = '';
            }
        }
    }

    /**
     * Handle form submission
     */
    async handleFormSubmit() {
        const name = document.getElementById('product-name')?.value.trim();
        const category = document.getElementById('product-category')?.value;
        const description = null; // Description field removed - always set to null
        const tags = document.getElementById('product-tags')?.value.trim();
        const stock = parseInt(document.getElementById('product-stock')?.value) || 0;
        const price = parseFloat(document.getElementById('product-price')?.value) || 0;
        const imageFile = this.imageInput?.files[0];

        if (!name || !category || !price) {
            alert('Please fill in all required fields (Name, Category, Price)');
            return;
        }

        // Disable form during submission
        const submitBtn = this.form?.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Saving...';
        }

        try {
            let imageUrl = '';

            // Upload image to Cloudinary if new image is provided
            if (imageFile) {
                // Show uploading message with progress
                if (submitBtn) {
                    submitBtn.textContent = 'Optimizing image...';
                }

                const uploadResult = await cloudinaryService.uploadImage(imageFile, {
                    folder: 'products',
                    compress: true, // Enable automatic compression
                    maxWidth: 1920,
                    maxHeight: 1920,
                    quality: 0.85,
                    onProgress: (percent) => {
                        if (submitBtn) {
                            if (percent < 100) {
                                submitBtn.textContent = `Uploading... ${percent}%`;
                            } else {
                                submitBtn.textContent = 'Processing...';
                            }
                        }
                    }
                });

                if (uploadResult.success) {
                    imageUrl = uploadResult.url;
                    console.log('✅ Image uploaded and optimized successfully');
                } else {
                    alert(`Failed to upload image: ${uploadResult.error}`);
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Save Product';
                    }
                    return;
                }
            } else if (this.editingProductId) {
                // Keep existing image if editing and no new image
                const existingProduct = this.products.find(p => p.id === this.editingProductId);
                imageUrl = existingProduct ? existingProduct.image_url : '';
            } else {
                alert('Please upload an image');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Save Product';
                }
                return;
            }

            // Save product to database
            await this.saveProduct(name, category, description, tags, stock, price, imageUrl);
        } catch (error) {
            console.error('Error in handleFormSubmit:', error);
            alert('An error occurred while saving the product');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Save Product';
            }
        }
    }

    /**
     * Save product (add or update) to Supabase
     * @param {string} name - Product name
     * @param {string} category - Product category
     * @param {string} description - Product description
     * @param {string} tags - Product tags
     * @param {number} stock - Stock quantity
     * @param {number} price - Product price
     * @param {string} imageUrl - Product image URL
     */
    async saveProduct(name, category, description, tags, stock, price, imageUrl) {
        try {
            const productData = {
                name: name,
                category: category,
                description: description || null,
                tags: tags || null,
                stock: stock,
                price: price,
                image_url: imageUrl
            };
            
            // Only add status if the column exists (check by trying to include it, but don't fail if it doesn't exist)
            // We'll calculate status dynamically in the render function instead

            if (this.editingProductId) {
                // Update existing product
                const { data, error } = await this.supabase
                    .from('products')
                    .update(productData)
                    .eq('id', this.editingProductId)
                    .select()
                    .single();

                if (error) {
                    throw error;
                }

                // Update local products array
                const index = this.products.findIndex(p => String(p.id) === String(this.editingProductId));
                if (index !== -1) {
                    this.products[index] = data;
                }

                this.editingProductId = null;
                alert('✓ Product updated successfully!');
            } else {
                // Add new product
                const { data, error } = await this.supabase
                    .from('products')
                    .insert([productData])
                    .select()
                    .single();

                if (error) {
                    throw error;
                }

                // Add to local products array
                this.products.unshift(data);
                alert('✓ Product added successfully!');
            }

            this.render();
            this.resetForm();
        } catch (error) {
            console.error('Error saving product:', error);
            alert(`Failed to save product: ${error.message || 'Unknown error'}`);
            throw error;
        }
    }

    /**
     * Edit product
     * @param {string|number} productId - Product ID
     */
    editProduct(productId) {
        // Keep productId as string (UUID) - don't convert to number
        const idString = String(productId);
        
        const product = this.products.find(p => String(p.id) === idString);
        
        if (!product) {
            console.error('Product not found with ID:', idString, 'Available IDs:', this.products.map(p => p.id));
            alert('Product not found');
            return;
        }

        this.editingProductId = idString;
        
        // Get form elements with null checks
        const nameInput = document.getElementById('product-name');
        const categoryInput = document.getElementById('product-category');
        const tagsInput = document.getElementById('product-tags');
        const stockInput = document.getElementById('product-stock');
        const priceInput = document.getElementById('product-price');
        
        // Set values only if elements exist
        if (nameInput) {
            nameInput.value = product.name || '';
        } else {
            console.error('Product name input not found');
        }
        
        if (categoryInput) {
            categoryInput.value = product.category || '';
        } else {
            console.error('Product category input not found');
        }
        
        if (tagsInput) {
            tagsInput.value = product.tags || '';
        } else {
            console.error('Product tags input not found');
        }
        
        if (stockInput) {
            stockInput.value = product.stock || 0;
        } else {
            console.error('Product stock input not found');
        }
        
        if (priceInput) {
            priceInput.value = product.price || 0;
        } else {
            console.error('Product price input not found');
        }

        // Show existing image (use image_url from database)
        if (product.image_url || product.image) {
            this.showImagePreview(product.image_url || product.image);
        }

        // Show popup notification with product name (before scrolling)
        this.showEditNotification(product.name || 'this product');

        // Scroll to form - improved for mobile
        this.scrollToForm();
    }

    /**
     * Show notification popup when editing a product
     * @param {string} productName - Name of the product being edited
     */
    showEditNotification(productName = 'this product') {
        // Remove existing notification if any
        const existingNotification = document.getElementById('edit-product-notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        // Create visual notification bubble
        const notification = document.createElement('div');
        notification.id = 'edit-product-notification';
        
        // Use very simple, direct styling that can't be overridden
        notification.setAttribute('style', 
            'position: fixed !important; ' +
            'top: 20px !important; ' +
            'left: 50% !important; ' +
            'transform: translateX(-50%) !important; ' +
            'background: #1B4D3E !important; ' +
            'color: white !important; ' +
            'padding: 16px 24px !important; ' +
            'border-radius: 12px !important; ' +
            'box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4) !important; ' +
            'z-index: 2147483647 !important; ' + // Maximum z-index value
            'font-size: 15px !important; ' +
            'font-weight: 600 !important; ' +
            'display: flex !important; ' +
            'align-items: center !important; ' +
            'gap: 12px !important; ' +
            'max-width: 90% !important; ' +
            'min-width: 280px !important; ' +
            'text-align: center !important; ' +
            'pointer-events: auto !important; ' +
            'cursor: pointer !important; ' +
            'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;'
        );

        notification.innerHTML = `
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="flex-shrink: 0;">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
            </svg>
            <span>You can now edit "${productName}"</span>
        `;

        // Append directly to body
        if (document.body) {
            document.body.appendChild(notification);
            
            // Force immediate visibility
            notification.style.display = 'flex';
            notification.style.visibility = 'visible';
            notification.style.opacity = '1';
            
            // Auto remove after 5 seconds
            setTimeout(() => {
                if (notification && notification.parentNode) {
                    notification.style.opacity = '0';
                    notification.style.transition = 'opacity 0.3s ease-out';
                    setTimeout(() => {
                        if (notification && notification.parentNode) {
                            notification.remove();
                        }
                    }, 300);
                }
            }, 5000);

            // Allow manual close on click
            notification.addEventListener('click', () => {
                if (notification && notification.parentNode) {
                    notification.style.opacity = '0';
                    notification.style.transition = 'opacity 0.3s ease-out';
                    setTimeout(() => {
                        if (notification && notification.parentNode) {
                            notification.remove();
                        }
                    }, 300);
                }
            });
        }
    }

    /**
     * Scroll to form - optimized for mobile
     */
    scrollToForm() {
        const formPanel = document.getElementById('add-product-panel');
        if (!formPanel) {
            console.warn('Form panel not found, scrolling to top');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        const isMobile = window.innerWidth <= 768;
        
        // On mobile, the form is reordered to be first, so we need a different approach
        if (isMobile) {
            // For mobile: scroll to the top of the catalogue section first
            const catalogueSection = document.getElementById('catalogue');
            if (catalogueSection) {
                // Scroll to catalogue section first
                catalogueSection.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'start',
                    inline: 'nearest'
                });
                
                // Then scroll to form with proper offset
                setTimeout(() => {
                    const rect = formPanel.getBoundingClientRect();
                    const scrollTop = window.pageYOffset || document.documentElement.scrollTop || window.scrollY;
                    const currentTop = rect.top + scrollTop;
                    
                    // Account for any fixed headers/navbars (usually around 60-80px on mobile)
                    const headerOffset = 60;
                    const targetPosition = Math.max(0, currentTop - headerOffset);
                    
                    window.scrollTo({ 
                        top: targetPosition,
                        behavior: 'smooth' 
                    });
                    
                    // Final check - ensure form is visible
                    setTimeout(() => {
                        const finalRect = formPanel.getBoundingClientRect();
                        if (finalRect.top < 0 || finalRect.top > window.innerHeight) {
                            // Form still not visible, try again with scrollIntoView
                            formPanel.scrollIntoView({ 
                                behavior: 'smooth', 
                                block: 'start',
                                inline: 'nearest'
                            });
                        }
                    }, 300);
                }, 200);
            } else {
                // Fallback: direct scroll to form
                formPanel.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'start',
                    inline: 'nearest'
                });
            }
        } else {
            // Desktop: use scrollIntoView with offset
            requestAnimationFrame(() => {
                formPanel.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'start',
                    inline: 'nearest'
                });
                
                // Fine-tune position after scroll
                setTimeout(() => {
                    const rect = formPanel.getBoundingClientRect();
                    const scrollTop = window.pageYOffset || document.documentElement.scrollTop || window.scrollY;
                    const currentTop = rect.top + scrollTop;
                    const offset = 20;
                    const targetPosition = Math.max(0, currentTop - offset);
                    
                    window.scrollTo({ 
                        top: targetPosition,
                        behavior: 'smooth' 
                    });
                }, 100);
            });
        }
    }

    /**
     * Delete product from Supabase
     * @param {string|number} productId - Product ID
     */
    async deleteProduct(productId) {
        // Keep productId as string (UUID) - don't convert to number
        const idString = String(productId);
        
        if (!confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
            return;
        }

        try {
            // First, check if there are any orders referencing this product
            const { data: orders, error: ordersError } = await this.supabase
                .from('orders')
                .select('id, status')
                .eq('product_id', idString)
                .limit(1);

            if (ordersError) {
                console.error('Error checking orders:', ordersError);
            }

            if (orders && orders.length > 0) {
                // Count total orders for this product
                const { count } = await this.supabase
                    .from('orders')
                    .select('*', { count: 'exact', head: true })
                    .eq('product_id', idString);

                const orderCount = count || orders.length;
                alert(
                    `❌ Cannot delete this product!\n\n` +
                    `This product has ${orderCount} order(s) associated with it. ` +
                    `Deleting it would violate database integrity.\n\n` +
                    `Options:\n` +
                    `1. Keep the product (recommended) - preserves order history\n` +
                    `2. Update database constraint in Supabase to allow deletion\n\n` +
                    `To allow deletion, you need to update the foreign key constraint in Supabase:\n` +
                    `Go to Supabase Dashboard > Table Editor > orders table > Foreign Keys > ` +
                    `Edit "orders_product_id_fkey" and change "On delete" to "CASCADE" or "SET NULL"`
                );
                return;
            }

            // No orders found, safe to delete
            const { error } = await this.supabase
                .from('products')
                .delete()
                .eq('id', idString);

            if (error) {
                // Check if it's a foreign key constraint error
                if (error.message && error.message.includes('foreign key constraint')) {
                    alert(
                        `❌ Cannot delete this product!\n\n` +
                        `This product is referenced by existing orders. ` +
                        `To allow deletion, update the foreign key constraint in Supabase:\n\n` +
                        `1. Go to Supabase Dashboard\n` +
                        `2. Navigate to Table Editor > orders table\n` +
                        `3. Click on Foreign Keys tab\n` +
                        `4. Find "orders_product_id_fkey"\n` +
                        `5. Edit and change "On delete" action to:\n` +
                        `   - "CASCADE" (deletes orders when product is deleted)\n` +
                        `   - "SET NULL" (sets product_id to null when product is deleted)\n\n` +
                        `⚠️ Warning: CASCADE will delete all orders for this product!`
                    );
                } else {
                    throw error;
                }
                return;
            }

            // Remove from local products array
            this.products = this.products.filter(p => String(p.id) !== idString);
            
            // Clear editing if this was the product being edited
            if (String(this.editingProductId) === idString) {
                this.resetForm();
            }
            
            this.render();
            alert('✓ Product deleted successfully!');
        } catch (error) {
            console.error('Error deleting product:', error);
            alert(`Failed to delete product: ${error.message || 'Unknown error'}`);
        }
    }

    /**
     * Reset form
     */

    resetForm() {
        this.editingProductId = null;
        
        if (this.form) {
            this.form.reset();
        }
        this.hideImagePreview();
    }

    /**
     * Render products in the grid
     */
    render() {
        if (!this.grid) return;

        let filteredProducts = [...this.products];

        // Apply search filter
        const searchTerm = document.getElementById('catalogue-search')?.value.toLowerCase() || '';
        if (searchTerm) {
            filteredProducts = filteredProducts.filter(p =>
                p.name.toLowerCase().includes(searchTerm) ||
                (p.tags && p.tags.toLowerCase().includes(searchTerm))
            );
        }

        // Apply category filter
        const categoryFilter = document.getElementById('catalogue-category')?.value || '';
        if (categoryFilter) {
            filteredProducts = filteredProducts.filter(p => p.category === categoryFilter);
        }

        // Apply sorting
        const sortValue = document.getElementById('catalogue-sort')?.value || '';
        if (sortValue === 'name-asc') {
            filteredProducts.sort((a, b) => a.name.localeCompare(b.name));
        } else if (sortValue === 'name-desc') {
            filteredProducts.sort((a, b) => b.name.localeCompare(a.name));
        } else if (sortValue === 'price-asc') {
            filteredProducts.sort((a, b) => a.price - b.price);
        } else if (sortValue === 'price-desc') {
            filteredProducts.sort((a, b) => b.price - a.price);
        }

        this.grid.innerHTML = filteredProducts.map(product => {
            const imageUrl = product.image_url || product.image || '';
            const productId = String(product.id); // Keep as string for UUID compatibility
            // Calculate status based on stock (don't rely on status column)
            const isActive = (product.stock || 0) > 0;
            const statusDisplay = isActive ? 'Active' : 'Out of Stock';
            const statusStyle = isActive 
                ? 'background: rgba(76, 175, 80, 0.2); color: #4CAF50;' 
                : 'background: rgba(244, 67, 54, 0.2); color: #F44336;';
            
            return `
            <div class="chart-card" style="padding: 0; overflow: hidden;">
                <div style="position: relative; width: 100%; padding-top: 100%; background: #f7fafc; overflow: hidden;">
                    ${imageUrl ? `<img src="${imageUrl}" alt="${product.name || 'Product'}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover;" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'400\' height=\'400\'%3E%3Crect fill=\'%23f7fafc\' width=\'400\' height=\'400\'/%3E%3Ctext fill=\'%23999\' x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\'%3ENo Image%3C/text%3E%3C/svg%3E';">` : '<div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: rgba(65, 70, 63, 0.5);">No Image</div>'}
                </div>
                <div style="padding: 16px;">
                    <h3 style="font-size: 16px; font-weight: 600; color: #41463F; margin-bottom: 8px;">${product.name || 'Unnamed Product'}</h3>
                    <p style="font-size: 18px; font-weight: 700; color: #41463F; margin-bottom: 8px;">KES ${(product.price || 0).toLocaleString()}</p>
                    <p style="font-size: 14px; color: rgba(65, 70, 63, 0.7); margin-bottom: 12px;">Stock: ${product.stock || 0} units</p>
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                        <span style="display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; ${statusStyle}">
                            ${statusDisplay}
                        </span>
                        <div style="display: flex; gap: 8px; position: relative; z-index: 100; pointer-events: auto;">
                            <button class="edit-product-btn" data-product-id="${productId}" style="background: transparent; border: none; cursor: pointer; padding: 12px; min-width: 44px; min-height: 44px; color: rgba(65, 70, 63, 0.7); transition: all 0.2s; border-radius: 4px; touch-action: manipulation; user-select: none; -webkit-tap-highlight-color: transparent; display: flex; align-items: center; justify-content: center; position: relative; z-index: 100; pointer-events: auto;" title="Edit Product" onmouseover="this.style.background='rgba(65, 70, 63, 0.1)'; this.style.color='#41463F';" onmouseout="this.style.background='transparent'; this.style.color='rgba(65, 70, 63, 0.7)';">
                                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="pointer-events: none; position: relative; z-index: -1;">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                                </svg>
                            </button>
                            <button class="delete-product-btn" data-product-id="${productId}" style="background: transparent; border: none; cursor: pointer; padding: 12px; min-width: 44px; min-height: 44px; color: rgba(244, 67, 54, 0.7); transition: all 0.2s; border-radius: 4px; touch-action: manipulation; user-select: none; -webkit-tap-highlight-color: transparent; display: flex; align-items: center; justify-content: center; position: relative; z-index: 100; pointer-events: auto;" title="Delete Product" onmouseover="this.style.background='rgba(244, 67, 54, 0.1)'; this.style.color='#F44336';" onmouseout="this.style.background='transparent'; this.style.color='rgba(244, 67, 54, 0.7)';">
                                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="pointer-events: none; position: relative; z-index: -1;">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        }).join('');

        if (filteredProducts.length === 0) {
            this.grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: rgba(65, 70, 63, 0.6);">No products found</div>';
        } else {
            // Add event listeners to edit and delete buttons after rendering
            this.attachProductActionHandlers();
        }
    }

    /**
     * Attach event handlers to edit and delete buttons
     */
    attachProductActionHandlers() {
        // Store reference to this for event handlers
        const self = this;
        
        // Helper function to handle button action (works for both click and touch)
        const handleButtonAction = function(e, actionFn) {
            // Prevent default and stop propagation to avoid conflicts
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            const productId = this.getAttribute('data-product-id');
            if (productId) {
                // Execute immediately - no delay needed
                actionFn(productId);
            }
        };
        
        // Edit buttons
        const editButtons = this.grid.querySelectorAll('.edit-product-btn');
        editButtons.forEach(btn => {
            // Remove any existing listeners by cloning and replacing
            const newBtn = btn.cloneNode(true);
            const parent = btn.parentNode;
            parent.replaceChild(newBtn, btn);
            
            // Ensure button container and button are properly styled for mobile interaction
            if (parent && parent.style) {
                parent.style.position = 'relative';
                parent.style.zIndex = '100';
                parent.style.pointerEvents = 'auto';
            }
            
            newBtn.style.position = 'relative';
            newBtn.style.zIndex = '101';
            newBtn.style.pointerEvents = 'auto';
            newBtn.style.touchAction = 'manipulation';
            newBtn.style.cursor = 'pointer';
            newBtn.style.webkitTouchCallout = 'none';
            newBtn.style.webkitUserSelect = 'none';
            
            // Remove inline event handlers that might interfere
            newBtn.removeAttribute('onmouseover');
            newBtn.removeAttribute('onmouseout');
            newBtn.removeAttribute('ontouchstart');
            newBtn.removeAttribute('ontouchend');
            
            // Add touchstart to provide immediate feedback
            newBtn.addEventListener('touchstart', function(e) {
                e.stopPropagation();
                e.stopImmediatePropagation();
                this.style.transform = 'scale(0.95)';
                this.style.background = 'rgba(65, 70, 63, 0.1)';
                this.style.color = '#41463F';
            }, { passive: false, capture: true });
            
            // Add touchmove to prevent scrolling when touching button
            newBtn.addEventListener('touchmove', function(e) {
                e.stopPropagation();
            }, { passive: false, capture: true });
            
            // Add touchend event (primary for mobile)
            newBtn.addEventListener('touchend', function(e) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                this.style.transform = '';
                this.style.background = '';
                this.style.color = '';
                handleButtonAction.call(this, e, self.editProduct.bind(self));
            }, { passive: false, capture: true });
            
            // Add click event (for desktop and as fallback)
            newBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                handleButtonAction.call(this, e, self.editProduct.bind(self));
            }, { capture: true });
        });

        // Delete buttons
        const deleteButtons = this.grid.querySelectorAll('.delete-product-btn');
        deleteButtons.forEach(btn => {
            // Remove any existing listeners by cloning and replacing
            const newBtn = btn.cloneNode(true);
            const parent = btn.parentNode;
            parent.replaceChild(newBtn, btn);
            
            // Ensure button container and button are properly styled for mobile interaction
            if (parent && parent.style) {
                parent.style.position = 'relative';
                parent.style.zIndex = '100';
                parent.style.pointerEvents = 'auto';
            }
            
            newBtn.style.position = 'relative';
            newBtn.style.zIndex = '101';
            newBtn.style.pointerEvents = 'auto';
            newBtn.style.touchAction = 'manipulation';
            newBtn.style.cursor = 'pointer';
            newBtn.style.webkitTouchCallout = 'none';
            newBtn.style.webkitUserSelect = 'none';
            
            // Remove inline event handlers that might interfere
            newBtn.removeAttribute('onmouseover');
            newBtn.removeAttribute('onmouseout');
            newBtn.removeAttribute('ontouchstart');
            newBtn.removeAttribute('ontouchend');
            
            // Add touchstart to provide immediate feedback
            newBtn.addEventListener('touchstart', function(e) {
                e.stopPropagation();
                e.stopImmediatePropagation();
                this.style.transform = 'scale(0.95)';
                this.style.background = 'rgba(244, 67, 54, 0.1)';
                this.style.color = '#F44336';
            }, { passive: false, capture: true });
            
            // Add touchmove to prevent scrolling when touching button
            newBtn.addEventListener('touchmove', function(e) {
                e.stopPropagation();
            }, { passive: false, capture: true });
            
            // Add touchend event (primary for mobile)
            newBtn.addEventListener('touchend', function(e) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                this.style.transform = '';
                this.style.background = '';
                this.style.color = '';
                handleButtonAction.call(this, e, self.deleteProduct.bind(self));
            }, { passive: false, capture: true });
            
            // Add click event (for desktop and as fallback)
            newBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                handleButtonAction.call(this, e, self.deleteProduct.bind(self));
            }, { capture: true });
        });
    }

    /**
     * Set up realtime subscription for products table
     */
    setupProductsRealtime() {
        if (!this.supabase) {
            console.warn('Supabase client not available for realtime subscription');
            return;
        }

        // Clean up existing subscription if any
        if (this.productsChannel) {
            this.supabase.removeChannel(this.productsChannel);
        }

        // Create new channel for products table
        this.productsChannel = this.supabase
            .channel('products-changes')
            .on(
                'postgres_changes',
                {
                    event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
                    schema: 'public',
                    table: 'products'
                },
                (payload) => {
                    console.log('Products realtime event:', payload.eventType, payload);
                    
                    // Reload products when any change occurs
                    this.loadProductsFromDatabase();
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('✅ Subscribed to products realtime changes');
                } else if (status === 'CHANNEL_ERROR') {
                    console.error('❌ Error subscribing to products realtime');
                }
            });
    }

    /**
     * Clean up realtime subscriptions
     */
    cleanup() {
        if (this.productsChannel && this.supabase) {
            this.supabase.removeChannel(this.productsChannel);
            this.productsChannel = null;
        }
    }

    /**
     * Get all products
     * @returns {Array} Array of all products
     */
    getProducts() {
        return [...this.products];
    }
}

// Create global instance
const catalogueService = new CatalogueService();

// Make it accessible globally for onclick handlers
if (typeof window !== 'undefined') {
    window.catalogueService = catalogueService;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CatalogueService;
}

