class CheckoutManager {
    constructor() {
        this.selectedProduct = null;
        this.selectedDuration = 30; // Default to 1 month
        this.selectedPaymentMethod = 'stripe'; // Default to credit card
        this.products = [];
        this.currentUser = null;
        this.currentOrder = null;
        
        // Set global reference for onclick handlers
        window.checkoutManager = this;
        
        this.init();
    }
    
    async init() {
        try {
            // Disable any old purchase popups
            this.disableOldPopups();
            
            // Check authentication - redirect if not logged in
            const sessionToken = localStorage.getItem('anonteamSessionToken');
            const userData = localStorage.getItem('anonteamCurrentUser');
            
            if (!sessionToken || !userData) {
                // No authentication found - redirect to main page
                console.warn('No authentication found - redirecting to login');
                window.location.href = 'index.html?login_required=1';
                return;
            }
            
            // Load user data from authenticated session
            this.currentUser = JSON.parse(userData);
            console.log('Authenticated user:', this.currentUser.username);
            
            // Load products
            await this.loadProducts();
            
            // Handle payment returns from external providers
            await this.handlePaymentReturn();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Update initial UI
            this.updateOrderSummary();
            
        } catch (error) {
            console.error('Checkout initialization error:', error);
            this.showError('Failed to initialize checkout');
        }
    }
    
    async loadProducts() {
        try {
            // Try to load from API first using proper authentication
            try {
                const token = localStorage.getItem('anonteamSessionToken');
                
                // Set up API client with token if it exists
                if (window.anonteamAPI && token) {
                    window.anonteamAPI.setSessionToken(token);
                }
                
                const response = await anonteamAPI.getProducts();
                if (response.success) {
                    this.products = response.data;
                    this.renderProducts();
                    return;
                }
            } catch (apiError) {
                console.warn('API failed, using fallback products:', apiError);
            }
            
            // Fallback to hardcoded products for demo/testing
            this.products = [
                {
                    id: 1,
                    name: 'onetap',
                    display_name: '[CS:GO] Onetap',
                    base_price: 50,
                    is_alpha_only: 1,
                    icon_url: 'images/cheats/onetap.png'
                },
                {
                    id: 2,
                    name: 'fatality',
                    display_name: '[CS:2] Fatality',
                    base_price: 13.80,
                    is_alpha_only: 0,
                    icon_url: 'images/cheats/fatality.png'
                },
                {
                    id: 3,
                    name: 'compkiller',
                    display_name: '[CS:2] Compkiller',
                    base_price: 7,
                    is_alpha_only: 1,
                    icon_url: 'images/cheats/compkiller.png'
                },
                {
                    id: 4,
                    name: 'neverlose',
                    display_name: '[CS:2] Neverlose',
                    base_price: 15,
                    is_alpha_only: 1,
                    icon_url: 'images/cheats/neverlose.png'
                }
            ];
            
            this.renderProducts();
            
        } catch (error) {
            console.error('Error loading products:', error);
            this.showError('Failed to load products');
        }
    }
    
    renderProducts() {
        const productGrid = document.getElementById('productGrid');
        productGrid.innerHTML = '';
        
        this.products.forEach(product => {
            const productOption = document.createElement('div');
            productOption.className = 'product-option';
            productOption.dataset.productId = product.id;
            
            const basePrice = this.getProductBasePrice(product.name);
            
            productOption.innerHTML = `
                <div class="product-icon">
                    <img src="${product.icon_url || 'images/cheats/' + product.name + '.png'}" 
                         alt="${product.display_name}" 
                         onerror="this.src='images/default-cheat.png'" />
                </div>
                <div class="product-name">${product.display_name}</div>
                <div class="product-price">From €${basePrice.toFixed(2)}</div>
            `;
            
            productOption.addEventListener('click', () => this.selectProduct(product));
            productGrid.appendChild(productOption);
        });
    }
    
    setupEventListeners() {
        // Duration selection
        document.querySelectorAll('.duration-option').forEach(option => {
            option.addEventListener('click', () => {
                const duration = parseInt(option.dataset.duration);
                this.selectDuration(duration);
            });
        });
        
        // Payment method selection
        document.querySelectorAll('.payment-option').forEach(method => {
            method.addEventListener('click', () => {
                const paymentMethod = method.dataset.method;
                this.selectPaymentMethod(paymentMethod);
            });
        });
        
        // Checkout button
        document.getElementById('checkoutButton').addEventListener('click', () => {
            window.location.href = 'https://anonteam.store/';
        });
        
        // URL parameters (for direct product linking)
        const urlParams = new URLSearchParams(window.location.search);
        const productName = urlParams.get('product');
        if (productName) {
            const product = this.products.find(p => p.name === productName);
            if (product) {
                this.selectProduct(product);
            }
        }
    }
    
    selectProduct(product) {
        // Update selected product
        this.selectedProduct = product;
        
        // Update UI
        document.querySelectorAll('.product-option').forEach(option => {
            option.classList.remove('selected');
        });
        
        const selectedOption = document.querySelector(`[data-product-id="${product.id}"]`);
        if (selectedOption) {
            selectedOption.classList.add('selected');
        }
        
        // Update duration prices based on selected product
        this.updateDurationPrices();
        this.updateOrderSummary();
        this.updateCheckoutButton();
    }
    
    selectDuration(duration) {
        this.selectedDuration = duration;
        
        // Update UI
        document.querySelectorAll('.duration-option').forEach(option => {
            option.classList.remove('selected');
        });
        
        const selectedOption = document.querySelector(`[data-duration="${duration}"]`);
        if (selectedOption) {
            selectedOption.classList.add('selected');
        }
        
        this.updateOrderSummary();
    }
    
    selectPaymentMethod(method) {
        this.selectedPaymentMethod = method;
        
        // Update UI
        document.querySelectorAll('.payment-option').forEach(methodEl => {
            methodEl.classList.remove('selected');
        });
        
        const selectedMethod = document.querySelector(`[data-method="${method}"]`);
        if (selectedMethod) {
            selectedMethod.classList.add('selected');
        }
        
        this.updateOrderSummary();
    }
    
    updateDurationPrices() {
        if (!this.selectedProduct) return;
        
        const basePrice = this.getProductBasePrice(this.selectedProduct.name);
        
        const durationPrices = {
            7: basePrice * 0.5,
            30: basePrice,
            90: basePrice * 2.5,
            365: basePrice * 8
        };
        
        document.querySelectorAll('.duration-option').forEach(option => {
            const duration = parseInt(option.dataset.duration);
            const price = durationPrices[duration];
            const priceElement = option.querySelector('.duration-price');
            if (priceElement) {
                priceElement.textContent = `€${price.toFixed(2)}`;
            }
        });
    }
    
    updateOrderSummary() {
        const selectedProductEl = document.getElementById('selectedProduct');
        const selectedDurationEl = document.getElementById('selectedDuration');
        const selectedPaymentEl = document.getElementById('selectedPayment');
        const subtotalEl = document.getElementById('subtotal');
        const taxEl = document.getElementById('tax');
        const totalEl = document.getElementById('total');
        
        // Update product
        selectedProductEl.textContent = this.selectedProduct ? 
            this.selectedProduct.display_name : 'Select a product';
        
        // Update duration
        const durationText = {
            7: '1 Week',
            30: '1 Month',
            90: '3 Months',
            365: '1 Year'
        };
        selectedDurationEl.textContent = durationText[this.selectedDuration];
        
        // Update payment method
        const paymentText = {
            stripe: 'Credit Card',
            paypal: 'PayPal',
            crypto: 'Cryptocurrency'
        };
        selectedPaymentEl.textContent = paymentText[this.selectedPaymentMethod];
        
        // Calculate prices
        if (this.selectedProduct) {
            const basePrice = this.getProductBasePrice(this.selectedProduct.name);
            const subtotal = this.calculatePrice(basePrice, this.selectedDuration);
            const tax = subtotal * 0.08; // 8% tax
            const total = subtotal + tax;
            
            subtotalEl.textContent = `€${subtotal.toFixed(2)}`;
            taxEl.textContent = `€${tax.toFixed(2)}`;
            totalEl.textContent = `€${total.toFixed(2)}`;
        } else {
            subtotalEl.textContent = '€0.00';
            taxEl.textContent = '€0.00';
            totalEl.textContent = '€0.00';
        }
    }
    
    updateCheckoutButton() {
        const checkoutButton = document.getElementById('checkoutButton');
        const canCheckout = this.selectedProduct && this.selectedDuration && this.selectedPaymentMethod;
        
        checkoutButton.disabled = !canCheckout;
        checkoutButton.textContent = canCheckout ? 'Complete Purchase' : 'Select Product First';
    }
    
    redirectToStore() {
        window.location.href = 'https://anonteam.store/';
    }
    
    async handlePaymentReturn() {
        // Handle return from payment providers
        const urlParams = new URLSearchParams(window.location.search);
        const success = urlParams.get('success');
        const cancelled = urlParams.get('cancelled');
        const sessionId = urlParams.get('session_id');
        const paymentMethod = urlParams.get('payment_method');

        if (success === 'true') {
            if (sessionId) {
                // Stripe success - verify the session
                await this.verifyStripeSession(sessionId);
            } else if (paymentMethod === 'paypal') {
                // PayPal success - verify the payment
                const paymentId = urlParams.get('paymentId');
                const payerId = urlParams.get('PayerID');
                await this.verifyPayPalPayment(paymentId, payerId);
            }
        } else if (cancelled === 'true') {
            this.showError('Payment was cancelled');
        }

        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    async verifyStripeSession(sessionId) {
        try {
            const response = await fetch('api/payment_endpoints.php?action=verify-stripe-session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    token: localStorage.getItem('anonteamSessionToken'),
                    session_id: sessionId
                })
            });

            const result = await response.json();
            
            if (result.success) {
                this.showSuccessDialog(result.data);
            } else {
                throw new Error(result.message || 'Payment verification failed');
            }
        } catch (error) {
            this.showError('Payment verification failed: ' + error.message);
        }
    }

    async verifyPayPalPayment(paymentId, payerId) {
        try {
            const response = await fetch('api/payment_endpoints.php?action=verify-paypal-payment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    token: localStorage.getItem('anonteamSessionToken'),
                    payment_id: paymentId,
                    payer_id: payerId
                })
            });

            const result = await response.json();
            
            if (result.success) {
                this.showSuccessDialog(result.data);
            } else {
                throw new Error(result.message || 'Payment verification failed');
            }
        } catch (error) {
            this.showError('Payment verification failed: ' + error.message);
        }
    }

    // Utility functions
    getProductBasePrice(productName) {
        const priceMap = {
            'onetap': 50,
            'fatality': 13.80,
            'compkiller': 7,
            'neverlose': 15
        };
        return priceMap[productName] || 13.80;
    }
    
    calculatePrice(basePrice, duration) {
        switch (duration) {
            case 7:
                return basePrice * 0.5;
            case 30:
                return basePrice;
            case 90:
                return basePrice * 2.5;
            case 365:
                return basePrice * 8;
            default:
                return basePrice;
        }
    }
    
    calculateTotalPrice() {
        if (!this.selectedProduct || !this.selectedDuration) return 0;
        
        const basePrice = this.getProductBasePrice(this.selectedProduct.name);
        const subtotal = this.calculatePrice(basePrice, this.selectedDuration);
        const tax = subtotal * 0.08;
        const total = subtotal + tax;
        
        // Round to 2 decimal places to avoid floating point issues
        return Math.round(total * 100) / 100;
    }
    
    getDurationText(duration) {
        const durationText = {
            7: '1 Week',
            30: '1 Month',
            90: '3 Months',
            365: '1 Year'
        };
        return durationText[duration];
    }
    
    showSuccessDialog(orderData) {
        const modal = document.createElement('div');
        modal.className = 'success-modal';
        modal.innerHTML = `
            <div class="success-modal-overlay"></div>
            <div class="success-modal-content">
                <div class="success-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22 11.08V12C21.9988 14.1564 21.3005 16.2547 20.0093 17.9818C18.7182 19.7088 16.9033 20.9725 14.8354 21.5839C12.7674 22.1953 10.5573 22.1219 8.53447 21.3746C6.51168 20.6273 4.78465 19.2461 3.61096 17.4371C2.43727 15.628 1.87979 13.4905 2.02168 11.3363C2.16356 9.18203 2.99721 7.13214 4.39828 5.49883C5.79935 3.86553 7.69279 2.72636 9.79619 2.24223C11.8996 1.75809 14.1003 1.95185 16.07 2.79L18 4.5" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M22 4L12 14.01L9 11.01" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <h3>Payment Successful!</h3>
                <p>Your subscription has been activated successfully.</p>
                <p><strong>Order ID:</strong> ${orderData.order_id}</p>
                <p><strong>Product:</strong> ${this.selectedProduct.display_name}</p>
                <p><strong>Duration:</strong> ${this.getDurationText(this.selectedDuration)}</p>
                <div class="success-buttons">
                    <button class="dashboard-btn" onclick="window.location.href='index.html'">Go to Dashboard</button>
                    <button class="download-btn" onclick="this.downloadProduct()">Download Now</button>
                </div>
            </div>
        `;
        
        // Add styles
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;
        
        modal.querySelector('.success-modal-content').style.cssText = `
            background: #1a1a1a;
            border: 1px solid #22c55e;
            border-radius: 12px;
            padding: 32px;
            max-width: 400px;
            width: 90%;
            color: #ffffff;
            text-align: center;
        `;
        
        document.body.appendChild(modal);
    }
    
    getStripePublishableKey() {
        // In production, store this in environment variables
        // Replace with your actual Stripe publishable key
        return 'pk_test_51234567890abcdef...'; // TODO: Replace with actual key
    }
    
    showError(message) {
        // Create a simple error notification
        const error = document.createElement('div');
        error.className = 'error-notification';
        error.textContent = message;
        error.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #dc2626;
            color: white;
            padding: 16px;
            border-radius: 8px;
            z-index: 10001;
            max-width: 300px;
        `;
        
        document.body.appendChild(error);
        
        setTimeout(() => {
            error.remove();
        }, 5000);
    }
    
    disableOldPopups() {
        // Hide any existing purchase popup
        const oldPopup = document.getElementById('purchasePopup');
        if (oldPopup) {
            oldPopup.style.display = 'none';
        }
        
        // Hide ban popup if visible
        const banPopup = document.getElementById('banPopup');
        if (banPopup) {
            banPopup.style.display = 'none';
        }
        
        // Remove popup-active classes from body
        document.body.classList.remove('purchase-popup-active', 'ban-popup-active');
        
        // Prevent any future popup triggers
        window.showBanPopup = () => console.log('Purchase popups disabled on checkout page');
    }
    
}

// Initialize checkout when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new CheckoutManager();
}); 