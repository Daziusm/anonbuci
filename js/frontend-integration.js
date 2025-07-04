// Frontend Integration Examples
// This file shows how to update your existing JavaScript to use the API backend

// Example: Update the login function to use the API
async function handleLoginWithAPI(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        showLoadingScreen();
        
        const response = await anonteamAPI.login(email, password);
        
        if (response.success) {
            // Update current user data
            currentUser = response.data.user;
            
            // Store user data in localStorage for compatibility
            localStorage.setItem('anonteamUser', JSON.stringify(currentUser));
            
            // Update UI
            updateAdminVisibility();
            showDashboard();
            loadUserSubscriptionsFromAPI();
            
            apiUtils.showNotification('Login successful!', 'success');
        }
    } catch (error) {
        apiUtils.handleError(error, 'Login failed');
    } finally {
        hideLoadingScreen();
    }
}

// Example: Update registration function
async function handleSignupWithAPI(e) {
    e.preventDefault();
    
    const username = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    
    try {
        showLoadingScreen();
        
        const response = await anonteamAPI.register(username, email, password);
        
        if (response.success) {
            apiUtils.showNotification('Registration successful! Please log in.', 'success');
            
            // Switch to login tab
            switchTab('login');
        }
    } catch (error) {
        apiUtils.handleError(error, 'Registration failed');
    } finally {
        hideLoadingScreen();
    }
}

// Example: Load user subscriptions from API
async function loadUserSubscriptionsFromAPI() {
    try {
        const response = await anonteamAPI.getUserSubscriptions();
        
        if (response.success) {
            const subscriptions = response.data;
            
            // Update the UI with real subscription data
            updateSubscriptionUIWithAPI(subscriptions);
        }
    } catch (error) {
        apiUtils.handleError(error, 'Failed to load subscriptions');
    }
}

// Example: Update subscription UI with API data
function updateSubscriptionUIWithAPI(subscriptions) {
    // Clear existing subscription items
    const subscriptionsList = document.querySelector('.subscriptions-list');
    if (!subscriptionsList) return;
    
    subscriptionsList.innerHTML = '';
    
    // Get all products to show all available cheats
    anonteamAPI.getProducts().then(response => {
        if (response.success) {
            const products = response.data;
            const alphaProducts = ['neverlose', 'onetap'];
            const isUserAdmin = isAdmin(currentUser);
            const isUserAlpha = isAlpha(currentUser);
            products.forEach(product => {
                            // Always show all products - will hide purchase button for regular users later
            const isAlphaProduct = product.display_name && product.display_name.includes('[Alpha]');
                // FORCE product state overrides for demo/testing
                let isFrozen = false;
                let isBroken = false;
                if (product.name === 'compkiller') {
                    isFrozen = true;
                    isBroken = false;
                } else if (product.name === 'neverlose') {
                    isFrozen = false;
                    isBroken = true;
                } else {
                    isFrozen = false;
                    isBroken = false;
                }
                // Fatality and Onetap are always purchasable
                const subscription = subscriptions.find(sub => sub.product_name === product.name);
                const item = document.createElement('div');
                item.className = 'subscription-item';
                const isActive = subscription && subscription.is_active && new Date(subscription.end_date) > new Date();
                let statusText = 'No active subscription';
                let statusClass = 'inactive';
                if (isFrozen) {
                    statusText = 'Product is currently FROZEN<br>(Cannot subscribe)';
                    statusClass = 'frozen';
                } else if (isBroken) {
                    statusText = 'Product is currently Under Maintenance<br>(Cannot subscribe)';
                    statusClass = 'broken';
                } else if (isActive) {
                    const daysLeft = apiUtils.getDaysRemaining(subscription.end_date);
                    statusText = `${daysLeft} days remaining`;
                    statusClass = 'active';
                }
                item.innerHTML = `
                    <div class="sub-info">
                        <div class="cheat-header">
                            <div class="sub-icon">
                                <img src="${product.icon_url || 'images/cheats/' + product.name + '.png'}" alt="${product.name}" />
                            </div>
                            <div class="sub-name">${product.display_name}</div>
                        </div>
                        <div class="sub-status ${statusClass}">${statusText}</div>
                    </div>
                    <div class="sub-action">
                        ${isActive ? `
                            <span class="lightning-icon">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <polygon points="13,2 3,14 12,14 11,22 21,10 12,10" fill="currentColor"/>
                                </svg>
                            </span>
                        ` : (isFrozen || isBroken) ? '' : (
                            // Show purchase button based on product and user type
                            (product.name === 'fatality' || product.name === 'onetap') ||
                            (isAlphaProduct && (isUserAdmin || isUserAlpha)) ||
                            (isUserAdmin) // Admins can always purchase
                        ) ? `
                            <button class="shop-btn purchase-btn" onclick="handlePurchase('${product.name}')">
                                <span class="shop-icon">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M6 2L3 6V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V6L18 2H6Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                        <path d="M3 6H21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                        <path d="M16 10C16 12.2091 14.2091 14 12 14C9.79086 14 8 12.2091 8 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                </span>
                                <span>Purchase</span>
                            </button>
                        ` : ''}
                    </div>
                `;
                subscriptionsList.appendChild(item);
            });
        }
    }).catch(error => {
        apiUtils.handleError(error, 'Failed to load products');
    });
}

// Example: Create subscription item element
function createSubscriptionItem(product, subscription) {
    const item = document.createElement('div');
    item.className = 'subscription-item';
    
    const isActive = subscription && subscription.is_active && new Date(subscription.end_date) > new Date();
    const isFrozen = product.is_frozen;
    const isAlphaOnly = product.is_alpha_only;
    
    let statusText = 'No active subscription';
    let statusClass = 'inactive';
    
    if (isFrozen) {
        statusText = 'Product is currently FROZEN<br>(Cannot subscribe)';
        statusClass = 'frozen';
    } else if (isActive) {
        const daysLeft = apiUtils.getDaysRemaining(subscription.end_date);
        statusText = `${daysLeft} days remaining`;
        statusClass = 'active';
    }
    
    item.innerHTML = `
        <div class="sub-info">
            <div class="cheat-header">
                <div class="sub-icon">
                    <img src="${product.icon_url || 'images/cheats/' + product.name + '.png'}" alt="${product.name}" />
                </div>
                <div class="sub-name">${product.display_name}</div>
            </div>
            <div class="sub-status ${statusClass}">${statusText}</div>
        </div>
        <div class="sub-action">
            ${isActive ? `
                <span class="lightning-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <polygon points="13,2 3,14 12,14 11,22 21,10 12,10" fill="currentColor"/>
                    </svg>
                </span>
            ` : `
                <button class="shop-btn purchase-btn" onclick="handlePurchase('${product.name}')">
                    <span class="shop-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M6 2L3 6V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V6L18 2H6Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M3 6H21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M16 10C16 12.2091 14.2091 14 12 14C9.79086 14 8 12.2091 8 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </span>
                    <span>Purchase</span>
                </button>
            `}
        </div>
    `;
    
    return item;
}

// Example: Handle license key activation
async function activateLicenseKeyWithAPI(keyCode) {
    try {
        const response = await anonteamAPI.activateLicenseKey(keyCode);
        
        if (response.success) {
            apiUtils.showNotification(`License activated for ${response.data.display_name}!`, 'success');
            
            // Reload subscriptions
            loadUserSubscriptionsFromAPI();
            
            // Clear the input
            document.querySelector('.key-input').value = '';
        }
    } catch (error) {
        apiUtils.handleError(error, 'License activation failed');
    }
}

// Example: Handle HWID reset
async function requestHwidResetWithAPI(reason = '') {
    try {
        const response = await anonteamAPI.requestHwidReset(reason);
        
        if (response.success) {
            apiUtils.showNotification('HWID reset successful!', 'success');
        }
    } catch (error) {
        apiUtils.handleError(error, 'HWID reset failed');
    }
}

// Example: Admin function - Generate license key
async function generateLicenseKeyWithAPI(productId, durationDays) {
    try {
        const response = await anonteamAPI.generateLicenseKey(productId, durationDays);
        
        if (response.success) {
            apiUtils.showNotification(`License key generated: ${response.data.key_code}`, 'success');
            
            // You might want to display this in a modal or copy to clipboard
            
        }
    } catch (error) {
        apiUtils.handleError(error, 'Key generation failed');
    }
}

// Example: Admin function - Get all users
async function loadAllUsersWithAPI(search = '', page = 1) {
    try {
        const response = await anonteamAPI.getAllUsers(search, page, 20);
        
        if (response.success) {
            // Update your admin panel with real user data
            updateAdminUsersList(response.data.users);
        }
    } catch (error) {
        apiUtils.handleError(error, 'Failed to load users');
    }
}

// Example: Update admin users list
function updateAdminUsersList(users) {
    const usersContainer = document.getElementById('adminUsersList');
    if (!usersContainer) return;
    usersContainer.innerHTML = '';
    users.forEach(user => {
        const userElement = document.createElement('div');
        userElement.className = 'admin-user-item';
        userElement.innerHTML = `
            <div class="user-info">
                <span class="username">${user.username}</span>
                <span class="email">${user.email}</span>
                <span class="account-type">${user.accountType}</span>
            </div>
            <div class="user-actions">
                <button class="admin-btn details-btn" style="margin-right:8px; padding:6px 14px; border-radius:6px; background:#6366f1; color:#fff; border:none; font-weight:500; cursor:pointer;" onclick="showUserDetailsModal(${user.id})">Details</button>
                <button class="admin-btn ban-btn" style="padding:6px 14px; border-radius:6px; background:#ef4444; color:#fff; border:none; font-weight:500; cursor:pointer;" onclick="banUserConfirm(${user.id}, '${user.username}')">Ban</button>
            </div>
        `;
        usersContainer.appendChild(userElement);
    });
}

// Show user details modal
window.showUserDetailsModal = async function(userId) {
    try {
        const response = await anonteamAPI.getUserDetails(userId);
        if (response.success && response.data && response.data.user) {
            const user = response.data.user;
            let modal = document.getElementById('userDetailsModal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'userDetailsModal';
                modal.style.position = 'fixed';
                modal.style.top = '50%';
                modal.style.left = '50%';
                modal.style.transform = 'translate(-50%, -50%)';
                modal.style.background = '#18181b';
                modal.style.color = '#fff';
                modal.style.padding = '32px 32px 24px 32px';
                modal.style.borderRadius = '12px';
                modal.style.zIndex = '9999';
                modal.style.minWidth = '340px';
                modal.style.boxShadow = '0 8px 32px rgba(0,0,0,0.25)';
                document.body.appendChild(modal);
            }
            modal.innerHTML = `
                <h2 style="margin-bottom:18px;">User Details</h2>
                <div style="margin-bottom:10px;"><b>Username:</b> ${user.username}</div>
                <div style="margin-bottom:10px;"><b>Email:</b> ${user.email}</div>
                <div style="margin-bottom:10px;"><b>Account Type:</b> ${user.accountType}</div>
                <div style="margin-bottom:10px;"><b>UID:</b> ${user.id}</div>
                <div style="margin-bottom:10px;"><b>Join Date:</b> ${user.joinDate || user.createdAt}</div>
                <div style="margin-bottom:10px;"><b>Last Login:</b> ${user.lastLogin || 'Never'}</div>
                <div style="margin-bottom:10px;"><b>Status:</b> ${user.isBanned ? 'Banned' : 'Active'}</div>
                <button onclick="document.getElementById('userDetailsModal').remove()" style="margin-top:18px; padding:6px 18px; border-radius:6px; background:#6366f1; color:#fff; border:none; font-weight:500; cursor:pointer;">Close</button>
            `;
        }
    } catch (e) {
        alert('Failed to load user details.');
    }
}

// Ban user with confirmation
window.banUserConfirm = function(userId, username) {
    if (confirm(`Are you sure you want to ban user '${username}'?`)) {
        anonteamAPI.banUser(userId, 'Banned by admin').then(() => {
            updateAdminUsersList([]); // Optionally reload users from backend
            loadAdminUsers();
            alert('User banned successfully.');
        }).catch(() => {
            alert('Failed to ban user.');
        });
    }
}

// Example: Check if user is logged in on page load
async function checkLoginStatus() {
    const sessionToken = localStorage.getItem('anonteamSessionToken');
    
    if (sessionToken) {
        try {
            // Try to validate the session
            const response = await anonteamAPI.getUserSubscriptions();
            
            if (response.success) {
                // User is logged in, show dashboard
                showDashboard();
                loadUserSubscriptionsFromAPI();
            } else {
                // Session expired, clear token
                anonteamAPI.clearSessionToken();
                showLogin();
            }
        } catch (error) {
            // Session invalid, clear token
            anonteamAPI.clearSessionToken();
            showLogin();
        }
    } else {
        showLogin();
    }
}

// Example: Logout function
async function handleLogoutWithAPI() {
    try {
        await anonteamAPI.logout();
        
        // Clear local data
        currentUser = null;
        localStorage.removeItem('anonteamUser');
        
        // Show login page
        showLogin();
        
        apiUtils.showNotification('Logged out successfully', 'success');
    } catch (error) {
        apiUtils.handleError(error, 'Logout failed');
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Check login status when page loads
    checkLoginStatus();
    
    // Update your existing event listeners to use API functions
    // Example:
    // document.getElementById('loginForm').addEventListener('submit', handleLoginWithAPI);
    // document.getElementById('signupForm').addEventListener('submit', handleSignupWithAPI);
    // document.getElementById('logoutBtn').addEventListener('click', handleLogoutWithAPI);
}); 

// Unified Product State Management System
// Single source of truth using database via API

class ProductStateManager {
    constructor() {
        this.products = [];
        this.isLoaded = false;
        this.updateCallbacks = [];
    }

    // Load all products from database
    async loadProducts() {

        
        // Check cache first (5 minute cache for speed)
        const cached = localStorage.getItem('cachedProducts');
        if (cached) {
            try {
                const cachedData = JSON.parse(cached);
                const cacheAge = Date.now() - cachedData.timestamp;
                if (cacheAge < 300000) { // 5 minutes
                    this.products = cachedData.data;
        
                    this.notifyUpdates();
                    return;
                }
            } catch (e) {
                console.warn('Cache parse error:', e);
            }
        }
        
        try {
            // Single API call with 3 second timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            
            const response = await window.anonteamAPI.getProductsWithStatus();
            clearTimeout(timeoutId);
            
            if (response.success && response.data && Array.isArray(response.data)) {
                this.products = response.data.map(product => ({
                    id: product.id,
                    name: product.name,
                    display_name: product.display_name || product.name,
                    is_frozen: !!(product.is_frozen || product.is_frozen === 1 || product.is_frozen === '1'),
                    is_broken: !!(product.is_broken || product.is_broken === 1 || product.is_broken === '1'),
                    is_alpha_only: !!(product.is_alpha_only || product.is_alpha_only === 1 || product.is_alpha_only === '1'),
                    icon_url: product.icon_url || `images/cheats/${product.name}.png`
                }));
                
                // Cache the results for 5 minutes
                localStorage.setItem('cachedProducts', JSON.stringify({
                    timestamp: Date.now(),
                    data: this.products
                }));
                
    
                this.notifyUpdates();
                return;
            }
        } catch (error) {
            console.warn('⚠️ API timeout/failed, using emergency fallback...', error);
        }

        // Emergency fallback with current database state - all active for testing
        this.products = [
            { id: 1, name: 'compkiller', display_name: '[CS:2] Compkiller', is_frozen: false, is_broken: false, is_alpha_only: false },
            { id: 2, name: 'neverlose', display_name: '[CS:2] Neverlose', is_frozen: false, is_broken: false, is_alpha_only: false },
            { id: 3, name: 'onetap', display_name: '[CS:GO] Onetap', is_frozen: false, is_broken: false, is_alpha_only: false },
            { id: 4, name: 'fatality', display_name: '[CS:2] Fatality', is_frozen: false, is_broken: false, is_alpha_only: false }
        ];
        
        
        this.notifyUpdates();
    }

    // Get product by name
    getProduct(productName) {
        return this.products.find(p => p.name === productName);
    }

    // Get all products
    getAllProducts() {
        return this.products;
    }

    // Update product status (admin only)
    async updateProductStatus(productName, isFrozen, isBroken, isAlphaOnly) {
        const product = this.getProduct(productName);
        if (!product) {
            throw new Error(`Product ${productName} not found`);
        }

        try {
            const response = await anonteamAPI.updateProductStatus(
                product.id, 
                isFrozen, 
                isBroken, 
                isAlphaOnly
            );
            
            if (response.success) {
                // Update local cache
                product.is_frozen = isFrozen;
                product.is_broken = isBroken;
                product.is_alpha_only = isAlphaOnly;
                
                this.notifyUpdates();
                return true;
            }
        } catch (error) {
            console.error('Failed to update product status:', error);
            throw error;
        }
        return false;
    }

    // Register callback for state updates
    onUpdate(callback) {
        this.updateCallbacks.push(callback);
    }

    // Notify all callbacks of updates
    notifyUpdates() {
        this.updateCallbacks.forEach(callback => callback(this.products));
    }

    // Convenience methods
    isProductFrozen(productName) {
        const product = this.getProduct(productName);
        return product ? !!product.is_frozen : false;
    }

    isProductBroken(productName) {
        const product = this.getProduct(productName);
        return product ? !!product.is_broken : false;
    }

    isProductAlphaOnly(productName) {
        const product = this.getProduct(productName);
        return product ? !!product.is_alpha_only : false;
    }

    getProductDisplayName(productName) {
        const product = this.getProduct(productName);
        return product ? product.display_name : productName;
    }

    // Clear cached data to force fresh load
    clearCache() {
        localStorage.removeItem('cachedProducts');

    }

    // Force reload from database (for admin actions)
    async forceReload() {
        this.clearCache();
        await this.loadProducts();
    }

    // Admin utility: Clear cache and force refresh
    static clearCacheAndReload() {
        if (window.productStateManager) {
            window.productStateManager.clearCache();
            window.productStateManager.loadProducts();
    
            if (typeof showNotification === 'function') {
                showNotification('Product cache refreshed', 'success');
            }
        }
    }
}

// Global instance
const productStateManager = new ProductStateManager();

// Unified Subscription UI Manager
class SubscriptionUIManager {
    constructor() {
        this.userSubscriptions = [];
        this.currentUser = null;
    }

    async initialize() {

        
        // Check if user is authenticated first
        const sessionToken = localStorage.getItem('anonteamSessionToken');
        const currentUser = JSON.parse(localStorage.getItem('anonteamCurrentUser') || 'null');
        
        if (sessionToken && currentUser) {
            this.setCurrentUser(currentUser);
            
            // Update sidebar immediately
            const sidebarUsername = document.getElementById('sidebarUsername');
            if (sidebarUsername) {
                sidebarUsername.textContent = currentUser.username || currentUser.name || 'User';
        
            }
            
            try {
                // Load products first - force API call for admin users
                await productStateManager.loadProducts();
        
                
                // Load user subscriptions
                await this.loadUserSubscriptions();
        
            } catch (error) {
                console.warn('⚠️ Failed to load data from API:', error);
            }
        } else {
            // Check if we're on the login page or need to redirect
            const isOnLoginPage = document.getElementById('loginPage')?.classList.contains('active');
            if (!isOnLoginPage) {
                if (typeof window.showLogin === 'function') {
                    window.showLogin();
                }
                return;
            }
        }
        
        // Register for product updates
        productStateManager.onUpdate(() => this.updateUI());
        
        // Initial UI update
        await this.updateUI();

    }

    async loadUserSubscriptions() {
        try {
            const response = await anonteamAPI.getUserSubscriptions();
            if (response.success) {
                this.userSubscriptions = response.data;
                
                // Sync with global userSubscriptions for compatibility with downloadCheat function
                this.syncWithGlobalUserSubscriptions();
            }
        } catch (error) {
            console.error('Failed to load user subscriptions:', error);
            this.userSubscriptions = [];
        }
    }

    // Sync unified system data with global userSubscriptions for compatibility
    syncWithGlobalUserSubscriptions() {
        if (typeof window.userSubscriptions === 'undefined') {
            window.userSubscriptions = {};
        }

        // Clear existing data
        Object.keys(window.userSubscriptions).forEach(key => {
            window.userSubscriptions[key] = { active: false };
        });

        // Update with current subscription data
        this.userSubscriptions.forEach(subscription => {
            const cheatName = subscription.product_name;
            const isActive = subscription.is_active && new Date(subscription.end_date) > new Date();
            
            window.userSubscriptions[cheatName] = {
                active: isActive,
                expiry: subscription.end_date ? new Date(subscription.end_date) : null,
                status: isActive ? 'active' : 'inactive',
                end_date: subscription.end_date
            };
        });


    }

    setCurrentUser(user) {
        this.currentUser = user;
    }

    async updateUI() {
        await this.updateSubscriptionView();
        this.updateAdminPanel();
    }

    async updateSubscriptionView() {
        const subscriptionsList = document.querySelector('.subscriptions-list');
        if (!subscriptionsList) return;

        let products = productStateManager.getAllProducts();
        
        // Fallback: if no products loaded from API, try to reload or use minimal defaults
        if (!products || products.length === 0) {
            console.warn('🔄 No products available, attempting reload...');
            
            // Try one more reload if we're authenticated
            const sessionToken = localStorage.getItem('anonteamSessionToken');
            if (sessionToken) {
                try {
                    await productStateManager.loadProducts();
                    products = productStateManager.getAllProducts();
                } catch (error) {
                    console.error('❌ Reload failed:', error);
                }
            }
            
            // Final fallback if still no products
            if (!products || products.length === 0) {
                products = [
                    { id: 1, name: 'compkiller', display_name: '[CS:2] Compkiller', is_frozen: false, is_broken: false, is_alpha_only: false },
                    { id: 2, name: 'neverlose', display_name: '[CS:2] Neverlose', is_frozen: false, is_broken: false, is_alpha_only: false },
                    { id: 3, name: 'onetap', display_name: '[CS:GO] Onetap', is_frozen: false, is_broken: false, is_alpha_only: false },
                    { id: 4, name: 'fatality', display_name: '[CS:2] Fatality', is_frozen: false, is_broken: false, is_alpha_only: false }
                ];
                console.warn('⚠️ Using basic fallback data');
            }
        }

        // Simple session-based user check
        const userType = this.currentUser?.account_type || this.currentUser?.accountType || 'guest';
        const hasAlphaAccess = ['admin', 'owner', 'premium'].includes(userType);

        // Clear existing items
        subscriptionsList.innerHTML = '';

        products.forEach(product => {
            const subscription = this.userSubscriptions.find(sub => sub.product_name === product.name);
            const item = this.createSubscriptionItem(product, subscription);
            subscriptionsList.appendChild(item);
        });
        
        // Ensure global userSubscriptions is synced for download functionality
        this.syncWithGlobalUserSubscriptions();
        

    }

    createSubscriptionItem(product, subscription) {
        const item = document.createElement('div');
        item.className = 'subscription-item';
        item.setAttribute('data-cheat', product.name);

        const isActive = subscription && subscription.is_active && new Date(subscription.end_date) > new Date();
        const isFrozen = !!(product.is_frozen || product.is_frozen === 1 || product.is_frozen === '1');
        const isBroken = !!(product.is_broken || product.is_broken === 1 || product.is_broken === '1');
        const isAlphaOnly = !!(product.is_alpha_only || product.is_alpha_only === 1 || product.is_alpha_only === '1');

        let statusText = 'No active subscription';
        let statusClass = 'inactive';
        let showPurchaseButton = true;

        // Use fast purchase check
        const purchaseCheck = canUserPurchase(product, this.currentUser);
        
        if (isFrozen || purchaseCheck.reason === 'FROZEN') {
            statusText = 'Product is currently FROZEN<br>(Cannot subscribe)';
            statusClass = 'frozen';
            showPurchaseButton = false;
        } else if (isBroken || purchaseCheck.reason === 'BROKEN') {
            statusText = 'Product is currently Under Maintenance<br>(Cannot subscribe)';
            statusClass = 'broken';
            showPurchaseButton = false;
        } else if (isActive) {
            const endDate = new Date(subscription.end_date);
            const daysLeft = Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24));
            statusText = `Active subscription<br>Expires in ${daysLeft} days`;
            statusClass = 'active';
            showPurchaseButton = false;
        } else {
            // Show purchase button based on fast check
            showPurchaseButton = purchaseCheck.canPurchase;
            if (!showPurchaseButton && purchaseCheck.reason === 'NO_ALPHA_ACCESS') {

            }
        }

        const displayName = isAlphaOnly ? 
            `${product.display_name} <span class="alpha">[Alpha]</span>` : 
            product.display_name;

        item.innerHTML = `
            <div class="sub-info">
                <div class="cheat-header">
                    <div class="sub-icon">
                        <img src="${product.icon_url || 'images/cheats/' + product.name + '.png'}" 
                             alt="${product.name}" 
                             onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\'width:40px;height:40px;border-radius:8px;background:#2a2a2a;display:flex;align-items:center;justify-content:center;color:#888;font-weight:bold;font-size:12px;\'>' + this.alt.substring(0,2).toUpperCase() + '</div>'" />
                    </div>
                    <div class="sub-name">${displayName}</div>
                </div>
                <div class="sub-status ${statusClass}">${statusText}</div>
            </div>
            <div class="sub-action">
                ${isActive ? `
                    <span class="lightning-icon" onclick="downloadCheat('${product.name}')" style="cursor: pointer; color: #ffd700;" title="Download ${product.display_name} loader">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <polygon points="13,2 3,14 12,14 11,22 21,10 12,10" fill="currentColor"/>
                        </svg>
                    </span>
                ` : showPurchaseButton ? `
                    <button class="shop-btn purchase-btn" onclick="handlePurchase('${product.name}')">
                        <span class="shop-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M6 2L3 6V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V6L18 2H6Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M3 6H21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M16 10C16 12.2091 14.2091 14 12 14C9.79086 14 8 12.2091 8 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </span>
                        <span>Purchase</span>
                    </button>
                ` : ''}
            </div>
        `;

        return item;
    }

    updateAdminPanel() {
        if (!this.currentUser || !['admin', 'owner'].includes(this.currentUser.accountType || this.currentUser.account_type)) {
            return;
        }

        this.updateProductStatusCards();
        this.updateGlobalManagement();
    }

    updateProductStatusCards() {

        const products = productStateManager.getAllProducts();
        
        products.forEach(product => {

            
            const card = document.querySelector(`[data-product="${product.name}"]`);
            if (!card) {

                return;
            }

            // Update status badge - look for both .status-badge and #productStatus patterns
            const statusElement = card.querySelector('.status-badge') || document.getElementById(`${product.name}Status`);
            const activeUsersElement = card.querySelector('.stat-value') || document.getElementById(`${product.name}ActiveUsers`);
            const totalSubsElement = card.querySelectorAll('.stat-value')[1] || document.getElementById(`${product.name}TotalSubs`);

            // Update freeze/unfreeze buttons
            const freezeBtn = card.querySelector('.freeze-product-btn');
            const unfreezeBtn = card.querySelector('.unfreeze-product-btn');

            if (statusElement) {
                let statusText = 'ACTIVE';
                let statusClass = 'active';

                // Determine status based on product state
                if (product.is_frozen) {
                    statusText = 'FROZEN';
                    statusClass = 'frozen';
                } else if (product.is_broken) {
                    statusText = 'MAINTENANCE';
                    statusClass = 'broken';
                } else if (product.is_alpha_only) {
                    statusText = 'ALPHA ONLY';
                    statusClass = 'alpha-only';
                } else {
                    statusText = 'ACTIVE';
                    statusClass = 'active';
                }

                statusElement.textContent = statusText;
                statusElement.className = `status-badge ${statusClass}`;

            }

            // Update freeze/unfreeze button visibility
            if (freezeBtn && unfreezeBtn) {
                if (product.is_frozen) {
                    freezeBtn.style.display = 'none';
                    unfreezeBtn.style.display = 'inline-flex';

                } else {
                    freezeBtn.style.display = 'inline-flex';
                    unfreezeBtn.style.display = 'none';

                }
            }

            // Update stats (these would come from API in real implementation)
            if (activeUsersElement) activeUsersElement.textContent = '0';
            if (totalSubsElement) totalSubsElement.textContent = '0';
        });
        

    }

    updateGlobalManagement() {
        const select = document.getElementById('globalProductSelect');
        if (!select) return;

        const products = productStateManager.getAllProducts();
        select.innerHTML = '<option value="">Select Product</option>';
        
        products.forEach(product => {
            const option = document.createElement('option');
            option.value = product.name;
            option.textContent = product.display_name;
            select.appendChild(option);
        });
    }
}

// Global instance
const subscriptionUIManager = new SubscriptionUIManager();

// Admin Panel Functions (simplified and unified)
window.handleGlobalFreeze = async function() {
    const productSelect = document.getElementById('globalProductSelect');
    const productName = productSelect.value;
    
    if (!productName) {
        showNotification('Please select a product to freeze', 'error');
        return;
    }
    
    try {
        const product = productStateManager.getProduct(productName);
        if (!product) {
            showNotification('Product not found', 'error');
            return;
        }
        
        await productStateManager.updateProductStatus(productName, true, !!product.is_broken, !!product.is_alpha_only);
        
        // Refresh the UI to show updated state
        await window.refreshAdminUI();
        
        showNotification(`${productStateManager.getProductDisplayName(productName)} has been frozen globally`, 'success');
    } catch (error) {
        console.error('Freeze error:', error);
        showNotification('Failed to freeze product: ' + error.message, 'error');
    }
};

window.handleGlobalUnfreeze = async function() {
    const productSelect = document.getElementById('globalProductSelect');
    const productName = productSelect.value;
    
    if (!productName) {
        showNotification('Please select a product to unfreeze', 'error');
        return;
    }
    
    try {
        const product = productStateManager.getProduct(productName);
        if (!product) {
            showNotification('Product not found', 'error');
            return;
        }
        
        await productStateManager.updateProductStatus(productName, false, !!product.is_broken, !!product.is_alpha_only);
        
        // Refresh the UI to show updated state
        await window.refreshAdminUI();
        
        showNotification(`${productStateManager.getProductDisplayName(productName)} has been unfrozen`, 'success');
    } catch (error) {
        console.error('Unfreeze error:', error);
        showNotification('Failed to unfreeze product: ' + error.message, 'error');
    }
};

window.handleGlobalAlphaOnly = async function() {
    const productSelect = document.getElementById('globalProductSelect');
    const productName = productSelect.value;
    
    if (!productName) {
        showNotification('Please select a product', 'error');
        return;
    }
    
    try {
        const product = productStateManager.getProduct(productName);
        if (!product) {
            showNotification('Product not found', 'error');
            return;
        }
        
        await productStateManager.updateProductStatus(productName, !!product.is_frozen, !!product.is_broken, true);
        
        // Refresh the UI to show updated state
        await window.refreshAdminUI();
        
        showNotification(`${productStateManager.getProductDisplayName(productName)} set to Alpha only`, 'success');
    } catch (error) {
        console.error('Alpha-only error:', error);
        showNotification('Failed to set Alpha only: ' + error.message, 'error');
    }
};

window.handleGlobalRemoveAlpha = async function() {
    const productSelect = document.getElementById('globalProductSelect');
    const productName = productSelect.value;
    
    if (!productName) {
        showNotification('Please select a product', 'error');
        return;
    }
    
    try {
        const product = productStateManager.getProduct(productName);
        if (!product) {
            showNotification('Product not found', 'error');
            return;
        }
        
        await productStateManager.updateProductStatus(productName, !!product.is_frozen, !!product.is_broken, false);
        
        // Refresh the UI to show updated state
        await window.refreshAdminUI();
        
        showNotification(`${productStateManager.getProductDisplayName(productName)} Alpha restriction removed`, 'success');
    } catch (error) {
        console.error('Remove alpha error:', error);
        showNotification('Failed to remove Alpha restriction: ' + error.message, 'error');
    }
};

// Update admin check to handle both field name formats
function isUserAdmin(user) {
    return user && ['admin', 'owner'].includes(user.accountType || user.account_type);
}

function isUserAlpha(user) {
    if (!user) return false;
    return ['admin', 'owner', 'premium', 'femboy'].includes(user.accountType || user.account_type);
}

// Debug Tools
window.debugStates = function() {
    
};

window.forceSync = function() {
    subscriptionUIManager.updateUI();
    showNotification('UI synchronized with database', 'success');
};

window.reloadFromDatabase = async function() {
    await productStateManager.loadProducts();
    await subscriptionUIManager.loadUserSubscriptions();
    subscriptionUIManager.updateUI();
    showNotification('Reloaded from database', 'success');
};

// Global admin refresh function - call this after any admin action
window.refreshAdminUI = async function() {
    try {

        
        // Clear cache to force fresh data (much faster than reloading everything)
        productStateManager.clearCache();
        
        // Quick reload with 2 second timeout
        await Promise.race([
            productStateManager.loadProducts(),
            new Promise((_, reject) => setTimeout(reject, 2000))
        ]);
        
        // Update UI (don't reload subscriptions unless needed)
        subscriptionUIManager.updateUI();
        

    } catch (error) {
        console.error('❌ Fast refresh failed, using cache:', error);
        subscriptionUIManager.updateUI(); // Use whatever data we have
    }
};

// Debug function to check current states
window.debugCurrentStates = async function() {
    try {

        
        // Check database state
        const dbResponse = await fetch('/anonteam/debug_api.php?action=states');
        const dbData = await dbResponse.json();

        
        // Check ProductStateManager
        const localProducts = productStateManager.getAllProducts();

        
        // Check localStorage
        const localStorageData = localStorage.getItem('productStates');

        
        // Check specific product
        const fatality = productStateManager.getProduct('fatality');

        

        
        return { database: dbData, local: localProducts, localStorage: localStorageData, fatality };
    } catch (error) {
        console.error('❌ Debug failed:', error);
        return { error: error.message };
    }
};

// Quick fix function
window.fixFatalityState = async function() {
    try {
        
        
        // Force reset Fatality to normal state
        await window.anonteamAPI.updateProductStatus(4, false, false, false);
        
        
        // Force full refresh
        await window.refreshAdminUI();
        
        
        // Check result
        const fatality = productStateManager.getProduct('fatality');
        
        
        return 'Fatality state fixed!';
    } catch (error) {
        console.error('❌ Fix failed:', error);
        return 'Fix failed: ' + error.message;
    }
};

// Individual product freeze/unfreeze handlers
window.freezeProductCard = async function(productName) {
    try {
        const product = productStateManager.getProduct(productName);
        if (!product) {
            showNotification('Product not found', 'error');
            return;
        }
        
        
        await productStateManager.updateProductStatus(productName, true, !!product.is_broken, !!product.is_alpha_only);
        await window.refreshAdminUI();
        showNotification(`${productStateManager.getProductDisplayName(productName)} has been frozen`, 'success');
    } catch (error) {
        console.error('Freeze error:', error);
        showNotification('Failed to freeze product: ' + error.message, 'error');
    }
};

window.unfreezeProductCard = async function(productName) {
    try {
        const product = productStateManager.getProduct(productName);
        if (!product) {
            showNotification('Product not found', 'error');
            return;
        }
        
        
        await productStateManager.updateProductStatus(productName, false, !!product.is_broken, !!product.is_alpha_only);
        await window.refreshAdminUI();
        showNotification(`${productStateManager.getProductDisplayName(productName)} has been unfrozen`, 'success');
    } catch (error) {
        console.error('Unfreeze error:', error);
        showNotification('Failed to unfreeze product: ' + error.message, 'error');
    }
};

// Setup event listeners for product cards
function setupProductCardEventListeners() {
    
    
    // Freeze buttons
    document.querySelectorAll('.freeze-product-btn').forEach(btn => {
        const productName = btn.getAttribute('data-product');
        btn.addEventListener('click', () => window.freezeProductCard(productName));
    });
    
    // Unfreeze buttons
    document.querySelectorAll('.unfreeze-product-btn').forEach(btn => {
        const productName = btn.getAttribute('data-product');
        btn.addEventListener('click', () => window.unfreezeProductCard(productName));
    });
    
    
}

// Initialize when everything is ready
function initializeUnifiedSystem() {
    
    
    // Initialize API client
    if (!window.anonteamAPI) {
        window.anonteamAPI = new AnonteamAPI();
    }
    
    // Set current user if available (check both locations)
    const currentUser = window.currentUser || JSON.parse(localStorage.getItem('anonteamCurrentUser') || 'null');
    if (currentUser) {
        subscriptionUIManager.setCurrentUser(currentUser);
        
        
        // Also update the sidebar immediately
        const sidebarUsername = document.getElementById('sidebarUsername');
        if (sidebarUsername) {
            sidebarUsername.textContent = currentUser.username || currentUser.name || 'User';
        }
    } else {
        console.warn('❌ No current user found in localStorage or window.currentUser');
    }
    
    // Setup product card event listeners
    setupProductCardEventListeners();
    
    // Initialize subscription manager (will handle API failures gracefully)
    subscriptionUIManager.initialize().then(() => {

    }).catch(error => {
        console.error('❌ Failed to initialize subscription manager:', error);
        // Force basic UI update with fallback data
        subscriptionUIManager.updateUI();
    });
}

// Multiple initialization points to ensure it works
document.addEventListener('DOMContentLoaded', function() {
    
    
    // Try immediate initialization
    if (window.AnonteamAPI) {
        initializeUnifiedSystem();
    } else {
        // Wait for API to load
        const apiCheck = setInterval(() => {
            if (window.AnonteamAPI) {
                clearInterval(apiCheck);
                initializeUnifiedSystem();
            }
        }, 50);
        
        // Fallback timeout
        setTimeout(() => {
            clearInterval(apiCheck);
            console.warn('⚠️ API not found, initializing anyway...');
            initializeUnifiedSystem();
        }, 2000);
    }
});

// Also initialize when user logs in
window.addEventListener('userLoggedIn', function(event) {
    
    if (window.subscriptionUIManager) {
        subscriptionUIManager.setCurrentUser(event.detail.user);
        subscriptionUIManager.initialize();
    }
});

// Manual initialization function for debugging
window.initUnifiedSystem = initializeUnifiedSystem;

// Test function that can be called from browser console
window.testUnifiedSystem = function() {
    
    
    // Force cleanup of old system
    const keysToRemove = [
        'productStates',
        'anonteamFrozenProducts', 
        'anonteamAlphaOnlyProducts',
        'frozenProducts',
        'anonteamBrokenProducts',
        'brokenProducts',
        'alphaOnlyProducts'
    ];
    
    keysToRemove.forEach(key => {
        if (localStorage.getItem(key)) {

            localStorage.removeItem(key);
        }
    });
    
    // Force re-initialization
    initializeUnifiedSystem();
    
};

// Export for global access
window.productStateManager = productStateManager;
window.subscriptionUIManager = subscriptionUIManager;

// Fast purchase button logic - just check session data
function canUserPurchase(product, currentUser) {
    // Check if product is available
    if (product.is_frozen || product.is_frozen === 1 || product.is_frozen === '1') {
        return { canPurchase: false, reason: 'FROZEN' };
    }
    if (product.is_broken || product.is_broken === 1 || product.is_broken === '1') {
        return { canPurchase: false, reason: 'BROKEN' };
    }
    
    // Check alpha access for alpha products
    if (product.is_alpha_only || product.is_alpha_only === 1 || product.is_alpha_only === '1') {
        const userType = currentUser?.account_type || currentUser?.accountType;
        const hasAlphaAccess = ['admin', 'owner', 'premium', 'femboy'].includes(userType);
        
        if (!hasAlphaAccess) {
            return { canPurchase: false, reason: 'NO_ALPHA_ACCESS' };
        }
    }
    
    return { canPurchase: true, reason: 'OK' };
}

// Purchase handling - redirect to enhanced checkout page
window.handlePurchase = function(productName) {
    // Check authentication first
    const sessionToken = localStorage.getItem('anonteamSessionToken');
    const currentUser = JSON.parse(localStorage.getItem('anonteamCurrentUser') || 'null');
    
    if (!sessionToken || !currentUser) {
        // Not logged in - show notification and stay on current page
        if (typeof showNotification === 'function') {
            showNotification('Please log in to purchase subscriptions', 'warning');
        }
        return;
    }
    
    // User is authenticated - redirect to checkout page with product pre-selected
    window.location.href = `checkout.html?product=${productName}`;
}; 