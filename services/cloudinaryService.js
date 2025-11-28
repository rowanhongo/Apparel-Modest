/**
 * Cloudinary Service
 * Handles image uploads to Cloudinary
 */

class CloudinaryService {
    constructor() {
        this.config = null;
    }

    /**
     * Initialize Cloudinary service
     */
    init() {
        this.config = getCloudinaryConfig();
        if (!this.config) {
            console.error('❌ Cloudinary service initialization failed');
            return false;
        }
        console.log('✅ Cloudinary service initialized');
        return true;
    }

    /**
     * Compress and optimize image before upload
     * Preserves original format (JPEG/PNG) to match Cloudinary settings
     * @param {File} file - Original image file
     * @param {Object} options - Compression options
     * @returns {Promise<File>} Compressed image file
     */
    async compressImage(file, options = {}) {
        return new Promise((resolve, reject) => {
            const maxWidth = options.maxWidth || 1920; // Max width for product images
            const maxHeight = options.maxHeight || 1920; // Max height
            const quality = options.quality || 0.85; // Compression quality (0.85 = 85%)
            const maxFileSize = options.maxFileSize || 2 * 1024 * 1024; // 2MB target

            // Determine output format based on original file type
            // Preserve JPEG/PNG format (don't convert to WebP)
            let outputFormat = 'image/jpeg'; // Default to JPEG
            let outputMimeType = 'image/jpeg';
            
            if (file.type === 'image/png') {
                outputFormat = 'image/png';
                outputMimeType = 'image/png';
            } else if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
                outputFormat = 'image/jpeg';
                outputMimeType = 'image/jpeg';
            }

            // If file is already small enough and in correct format, return as-is
            if (file.size <= maxFileSize && (file.type === 'image/jpeg' || file.type === 'image/jpg' || file.type === 'image/png')) {
                resolve(file);
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    // Calculate new dimensions
                    if (width > maxWidth || height > maxHeight) {
                        const ratio = Math.min(maxWidth / width, maxHeight / height);
                        width = width * ratio;
                        height = height * ratio;
                    }

                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // Convert to blob with compression, preserving original format
                    canvas.toBlob((blob) => {
                        if (!blob) {
                            reject(new Error('Failed to compress image'));
                            return;
                        }

                        // If still too large, reduce quality further (only for JPEG)
                        if (blob.size > maxFileSize && quality > 0.5 && outputFormat === 'image/jpeg') {
                            canvas.toBlob((smallerBlob) => {
                                if (!smallerBlob) {
                                    resolve(new File([blob], file.name, { type: outputMimeType }));
                                    return;
                                }
                                resolve(new File([smallerBlob], file.name, { type: outputMimeType }));
                            }, outputFormat, quality * 0.7);
                        } else {
                            resolve(new File([blob], file.name, { type: outputMimeType }));
                        }
                    }, outputFormat, quality);
                };
                img.onerror = () => reject(new Error('Failed to load image'));
                img.src = e.target.result;
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }

    /**
     * Upload image to Cloudinary with optimizations
     * @param {File} file - Image file to upload
     * @param {Object} options - Upload options (folder, transformation, etc.)
     * @returns {Promise<Object>} { success: boolean, url: string, publicId: string, error: string }
     */
    async uploadImage(file, options = {}) {
        try {
            if (!this.config) {
                throw new Error('Cloudinary not initialized. Call init() first.');
            }

            if (!file) {
                throw new Error('No file provided');
            }

            // Validate file type
            const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
            if (!validTypes.includes(file.type)) {
                throw new Error('Invalid file type. Please upload an image (JPEG, PNG, GIF, or WebP)');
            }

            // Validate file size (max 10MB before compression)
            const maxSize = 10 * 1024 * 1024; // 10MB
            if (file.size > maxSize) {
                throw new Error('File size too large. Maximum size is 10MB');
            }

            // Compress image before upload (unless disabled)
            let fileToUpload = file;
            if (options.compress !== false) {
                try {
                    fileToUpload = await this.compressImage(file, {
                        maxWidth: options.maxWidth || 1920,
                        maxHeight: options.maxHeight || 1920,
                        quality: options.quality || 0.85
                    });
                    console.log(`✅ Image compressed: ${(file.size / 1024).toFixed(0)}KB → ${(fileToUpload.size / 1024).toFixed(0)}KB`);
                } catch (compressionError) {
                    console.warn('⚠️ Compression failed, uploading original:', compressionError);
                    // Continue with original file if compression fails
                }
            }

            // Create form data
            const formData = new FormData();
            formData.append('file', fileToUpload);
            if (!this.config.uploadPreset) {
                throw new Error('Cloudinary upload preset not configured. Set CLOUDINARY_UPLOAD_PRESET in Netlify environment variables.');
            }
            formData.append('upload_preset', this.config.uploadPreset);
            formData.append('cloud_name', this.config.cloudName);

            // Note: For unsigned uploads, we cannot use 'eager' or 'eager_async' parameters
            // Transformations will be applied when displaying images using getOptimizedUrl()

            // Add optional parameters (allowed for unsigned uploads)
            if (options.folder) {
                formData.append('folder', options.folder);
            }

            if (options.publicId) {
                formData.append('public_id', options.publicId);
            }

            // Note: 'transformation' parameter is also not allowed for unsigned uploads
            // We'll apply transformations when retrieving images instead

            // Show upload progress if callback provided
            if (options.onProgress) {
                // Note: XMLHttpRequest is needed for progress tracking
                return this.uploadWithProgress(fileToUpload, formData, options);
            }

            // Upload using fetch
            const response = await fetch(this.config.apiUrl, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || 'Upload failed');
            }

            const data = await response.json();

            // For unsigned uploads, we get the basic URL
            // Transformations will be applied when displaying using getOptimizedUrl()
            return {
                success: true,
                url: data.secure_url,
                publicId: data.public_id,
                width: data.width,
                height: data.height,
                format: data.format,
                bytes: data.bytes
            };

        } catch (error) {
            console.error('❌ Error uploading image to Cloudinary:', error);
            return {
                success: false,
                url: null,
                publicId: null,
                error: error.message || 'Failed to upload image'
            };
        }
    }

    /**
     * Upload with progress tracking
     * @param {File} file - Image file
     * @param {FormData} formData - Form data
     * @param {Object} options - Options including onProgress callback
     * @returns {Promise<Object>}
     */
    uploadWithProgress(file, formData, options) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable && options.onProgress) {
                    const percentComplete = (e.loaded / e.total) * 100;
                    options.onProgress(percentComplete);
                }
            });

            xhr.addEventListener('load', () => {
                if (xhr.status === 200) {
                    try {
                        const data = JSON.parse(xhr.responseText);
                        resolve({
                            success: true,
                            url: data.secure_url,
                            publicId: data.public_id,
                            width: data.width,
                            height: data.height,
                            format: data.format,
                            bytes: data.bytes
                        });
                    } catch (error) {
                        reject(new Error('Failed to parse response'));
                    }
                } else {
                    try {
                        const errorData = JSON.parse(xhr.responseText);
                        reject(new Error(errorData.error?.message || 'Upload failed'));
                    } catch {
                        reject(new Error('Upload failed'));
                    }
                }
            });

            xhr.addEventListener('error', () => {
                reject(new Error('Network error during upload'));
            });

            xhr.open('POST', this.config.apiUrl);
            xhr.send(formData);
        });
    }

    /**
     * Delete image from Cloudinary
     * Note: This requires server-side implementation with API secret
     * For client-side, you can only delete if using unsigned uploads with specific settings
     * @param {string} publicId - Public ID of the image to delete
     * @returns {Promise<Object>} { success: boolean, message: string }
     */
    async deleteImage(publicId) {
        // Note: Deletion typically requires server-side implementation
        // This is a placeholder for future server-side implementation
        console.warn('⚠️ Image deletion requires server-side implementation');
        return {
            success: false,
            message: 'Image deletion requires server-side implementation'
        };
    }

    /**
     * Get optimized image URL with transformations
     * @param {string} publicId - Public ID of the image
     * @param {Object} transformations - Cloudinary transformation options
     * @returns {string} Optimized image URL
     */
    getOptimizedUrl(publicId, transformations = {}) {
        if (!this.config) {
            return null;
        }

        const baseUrl = `https://res.cloudinary.com/${this.config.cloudName}/image/upload`;
        const transformString = this.buildTransformString(transformations);
        
        return `${baseUrl}/${transformString}/${publicId}`;
    }

    /**
     * Build transformation string from options
     * @param {Object} transformations - Transformation options
     * @returns {string} Transformation string
     */
    buildTransformString(transformations) {
        const parts = [];

        if (transformations.width) parts.push(`w_${transformations.width}`);
        if (transformations.height) parts.push(`h_${transformations.height}`);
        if (transformations.crop) parts.push(`c_${transformations.crop}`);
        if (transformations.quality) parts.push(`q_${transformations.quality}`);
        if (transformations.format) parts.push(`f_${transformations.format}`);

        return parts.length > 0 ? parts.join(',') : '';
    }
}

// Create global instance
const cloudinaryService = new CloudinaryService();

