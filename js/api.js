// API Client for Anonteam Backend
class AnonteamAPI {
    constructor() {
        // Get the correct base URL including the project directory
        const currentPath = window.location.pathname;
        const projectPath = currentPath.includes('/anonteam/') ? '/anonteam' : '';
        this.baseURL = window.location.origin + projectPath;
        this.sessionToken = localStorage.getItem('anonteamSessionToken');
    }

    // Set session token after login
    setSessionToken(token) {
        this.sessionToken = token;
        localStorage.setItem('anonteamSessionToken', token);
    }

    // Clear session token on logout
    clearSessionToken() {
        this.sessionToken = null;
        localStorage.removeItem('anonteamSessionToken');
    }

    // Generic API request method
    async request(endpoint, options = {}) {
        this.sessionToken = localStorage.getItem('anonteamSessionToken');
        const url = `${this.baseURL}${endpoint}`;
        

        
        const defaultOptions = {
            headers: {},
        };

        // Only set Content-Type for non-FormData requests
        if (!(options.body instanceof FormData)) {
            defaultOptions.headers['Content-Type'] = 'application/json';
        }

        // Add authorization header if session token exists
        if (this.sessionToken) {
            defaultOptions.headers['Authorization'] = `Bearer ${this.sessionToken}`;
        }

        const finalOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers,
            },
        };

        try {
            const response = await fetch(url, finalOptions);
            const data = await response.json();

            if (!response.ok) {
                // Create error object with full response data for banned users
                const error = new Error(data.message || `HTTP ${response.status}`);
                error.statusCode = response.status;
                error.data = data.data || null;
                error.banned = data.data?.banned || false;
                throw error;
            }

            return data;
        } catch (error) {
            console.error('API Request failed:', error);
            throw error;
        }
    }

    // Authentication endpoints
    async register(username, email, password) {
        return this.request('/api/auth_endpoints.php?action=register', {
            method: 'POST',
            body: JSON.stringify({ username, email, password }),
        });
    }

    async login(email, password) {
        const response = await this.request('/api/auth_endpoints.php?action=login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });

        // Store session token
        if (response.data && response.data.session_token) {
            this.setSessionToken(response.data.session_token);
        }

        return response;
    }

    async logout() {
        const response = await this.request('/api/auth_endpoints.php?action=logout', {
            method: 'POST',
        });

        this.clearSessionToken();
        return response;
    }

    async changePassword(currentPassword, newPassword) {
        return this.request('/api/auth_endpoints.php?action=change_password', {
            method: 'POST',
            body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
        });
    }

    async updateProfileImage(imageData) {
        return this.request('/api/auth_endpoints.php?action=update_profile_image', {
            method: 'POST',
            body: JSON.stringify({ image_data: imageData }),
        });
    }

    async updateBannerImage(imageData) {
        return this.request('/api/auth_endpoints.php?action=update_banner_image', {
            method: 'POST',
            body: JSON.stringify({ image_data: imageData }),
        });
    }

    // Subscription endpoints
    async getProducts() {
        return this.request('/api/subscription_endpoints.php?action=products', {
            method: 'GET',
        });
    }

    async getUserSubscriptions() {
        return this.request('/api/subscription_endpoints.php?action=user_subscriptions', {
            method: 'GET',
        });
    }

    async activateLicenseKey(keyCode) {
        return this.request('/api/subscription_endpoints.php?action=activate_key', {
            method: 'POST',
            body: JSON.stringify({ key_code: keyCode }),
        });
    }

    async requestHwidReset(reason = '') {
        return this.request('/api/subscription_endpoints.php?action=hwid_reset', {
            method: 'POST',
            body: JSON.stringify({ reason }),
        });
    }

    async updateHwid(hwid) {
        return this.request('/api/subscription_endpoints.php?action=update_hwid', {
            method: 'POST',
            body: JSON.stringify({ hwid }),
        });
    }

    async getHwidStatus() {
        return this.request('/api/subscription_endpoints.php?action=hwid_status', {
            method: 'GET',
        });
    }

    // Admin endpoints (require admin privileges)
    async generateLicenseKey(productId, durationDays) {
        return this.request('/api/subscription_endpoints.php?action=generate_key', {
            method: 'POST',
            body: JSON.stringify({ product_id: productId, duration_days: durationDays }),
        });
    }

    // Admin management endpoints
    async getAllUsers(search = '', page = 1, limit = 20) {
        const params = new URLSearchParams({
            search,
            page: page.toString(),
            limit: limit.toString(),
            _cache_bust: Date.now().toString(), // Force fresh data
        });
        return this.request(`/api/admin_endpoints.php?action=users&${params}`, {
            method: 'GET',
        });
    }

    async getUserDetails(userId) {
        return this.request(`/api/admin_endpoints.php?action=user_details&user_id=${userId}`, {
            method: 'GET',
        });
    }

    async banUser(userId, reason) {
        return this.request('/api/admin_endpoints.php?action=ban_user', {
            method: 'POST',
            body: JSON.stringify({ user_id: userId, reason }),
        });
    }

    async unbanUser(userId) {
        return this.request('/api/admin_endpoints.php?action=unban_user', {
            method: 'POST',
            body: JSON.stringify({ user_id: userId }),
        });
    }

    async changeUserRole(userId, newRole) {
        return this.request('/api/admin_endpoints.php?action=change_role', {
            method: 'POST',
            body: JSON.stringify({ user_id: userId, new_role: newRole }),
        });
    }

    async getActivityLogs(page = 1, limit = 50) {
        const params = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString(),
        });
        return this.request(`/api/admin_endpoints.php?action=activity_logs&${params}`, {
            method: 'GET',
        });
    }

    async getSystemStats() {
        return this.request('/api/admin_endpoints.php?action=system_stats', {
            method: 'GET',
        });
    }

    async updateProductStatus(productId, isFrozen, isBroken, isAlphaOnly) {
        return this.request('/api/admin_endpoints.php?action=update_product_status', {
            method: 'POST',
            body: JSON.stringify({
                product_id: productId,
                is_frozen: isFrozen,
                is_broken: isBroken,
                is_alpha_only: isAlphaOnly 
            }),
        });
    }

    async extendUserSubscription(userId, productId, days) {
        return this.request('/api/admin_endpoints.php?action=extend_subscription', {
            method: 'POST',
            body: JSON.stringify({
                user_id: userId,
                product_id: productId,
                days: days,
            }),
        });
    }

    async forceHwidReset(userId) {
        return this.request('/api/admin_endpoints.php?action=force_hwid_reset', {
            method: 'POST',
            body: JSON.stringify({
                user_id: userId,
            }),
        });
    }

    async addUserSubscription(userId, productId, days) {
        return this.request('/api/admin_endpoints.php?action=add_subscription', {
            method: 'POST',
            body: JSON.stringify({
                user_id: userId,
                product_id: productId,
                days: days,
            }),
        });
    }

    async revokeUserSubscription(userId, productId) {
        return this.request('/api/admin_endpoints.php?action=revoke_subscription', {
            method: 'POST',
            body: JSON.stringify({
                user_id: userId,
                product_id: productId,
            }),
        });
    }

    // Fetch all generated license keys (admin)
    async getGeneratedKeys() {
        return this.request('/api/admin_endpoints.php?action=generated_keys', {
            method: 'GET',
        });
    }

    // Fetch all invite codes (admin)
    async getInviteCodes() {
        return this.request('/api/admin_endpoints.php?action=invite_codes', {
            method: 'GET',
        });
    }

    async createInviteCodes(count) {
        return this.request('/api/admin_endpoints.php?action=create_invite_codes', {
            method: 'POST',
            body: JSON.stringify({ count }),
        });
    }

    async logActivity(type, description, username) {
        return this.request('/api/admin_endpoints.php?action=log_activity', {
            method: 'POST',
            body: JSON.stringify({ type, description, username }),
        });
    }

    async redeemLicenseKey(keyCode) {
        return this.request('/api/subscription_endpoints.php?action=activate_key', {
            method: 'POST',
            body: JSON.stringify({ key_code: keyCode }),
        });
    }

    async validateLicenseKey(keyCode) {
        // For validation, we'll use the same activate_key endpoint but handle the result differently
        // In a real scenario, you might want a separate validation endpoint
        return this.request('/api/subscription_endpoints.php?action=activate_key', {
            method: 'POST',
            body: JSON.stringify({ key_code: keyCode }),
        });
    }

    async getProductsWithStatus() {
        return this.request('/api/subscription_endpoints.php?action=products', {
            method: 'GET',
        });
    }

    // Comments API
    async getComments(profileUser = null) {
        const url = profileUser 
            ? `/api/comments_endpoints.php?action=get_comments&profile_user=${encodeURIComponent(profileUser)}`
            : '/api/comments_endpoints.php?action=get_comments';
        return this.request(url, {
            method: 'GET',
        });
    }

    async postComment(content, parentId = null, targetUser = null) {
        return this.request('/api/comments_endpoints.php?action=post_comment', {
            method: 'POST',
            body: JSON.stringify({ content, parent_id: parentId, target_user: targetUser }),
        });
    }

    async likeComment(commentId) {
        return this.request('/api/comments_endpoints.php?action=like_comment', {
            method: 'POST',
            body: JSON.stringify({ comment_id: commentId }),
        });
    }

    async unlikeComment(commentId) {
        return this.request('/api/comments_endpoints.php?action=unlike_comment', {
            method: 'POST',
            body: JSON.stringify({ comment_id: commentId }),
        });
    }

    async deleteComment(commentId) {
        return this.request(`/api/comments_endpoints.php?action=delete_comment&comment_id=${commentId}`, {
            method: 'DELETE',
        });
    }

    // Shoutbox API
    async getShoutboxMessages() {
        return this.request('/api/shoutbox_endpoints.php?action=get_messages', {
            method: 'GET',
        });
    }

    async sendShoutboxMessage(message) {
        return this.request('/api/shoutbox_endpoints.php?action=send_message', {
            method: 'POST',
            body: JSON.stringify({ message }),
        });
    }

    async sendBotMessage(message) {
        return this.request('/api/shoutbox_endpoints.php?action=send_bot_message', {
            method: 'POST',
            body: JSON.stringify({ message }),
        });
    }

    // Loader Management API
    async uploadLoader(cheatName, file) {
        const formData = new FormData();
        formData.append('cheat_name', cheatName);
        formData.append('loader', file);

        // For FormData uploads, we need special headers handling
        const headers = {};
        if (this.sessionToken) {
            headers['Authorization'] = `Bearer ${this.sessionToken}`;
        }
        // Don't set Content-Type for FormData - browser will set it with boundary

        return this.request('/api/loader_endpoints.php?action=upload', {
            method: 'POST',
            headers: headers,
            body: formData,
        });
    }

    async generateDownloadToken(cheatName) {
        return this.request('/api/loader_endpoints.php?action=generate_token', {
            method: 'POST',
            body: JSON.stringify({ cheat_name: cheatName }),
        });
    }

    async downloadLoader(cheatName, loaderId = null) {
        try {
            console.log('🔐 Starting secure one-time download for:', cheatName);
            
            // Step 1: Generate one-time download token
            const tokenResponse = await this.generateDownloadToken(cheatName);
            
            if (!tokenResponse.success) {
                throw new Error(tokenResponse.message || 'Failed to generate download token');
            }
            
            const { token, expires_at, filename, file_size, reused_token } = tokenResponse.data;
            
            console.log(`🎫 ${reused_token ? 'Reusing existing' : 'Generated new'} download token for ${cheatName}`);
            console.log('⏰ Token expires at:', expires_at);
            console.log('📁 File:', filename, `(${file_size} bytes)`);
            
            // Step 2: Use token to download file (ONE-TIME USE!)
            const downloadUrl = `${this.baseURL}/api/loader_endpoints.php?action=download&token=${encodeURIComponent(token)}`;
            
            console.log('🔍 Secure download URL:', downloadUrl);
            
            // CRITICAL FIX: Refresh session token from localStorage (like request() method does)
            this.sessionToken = localStorage.getItem('anonteamSessionToken');
            
            // Create headers with proper authentication
            const headers = {};
            if (this.sessionToken) {
                headers['Authorization'] = `Bearer ${this.sessionToken}`;
                console.log('🔐 Authentication header added with session token');
            } else {
                console.error('❌ No session token found in localStorage!');
            }
            
            const response = await fetch(downloadUrl, {
                method: 'GET',
                headers: headers,
                credentials: 'include',
            });

            console.log('📡 Download response status:', response.status);
            console.log('📋 Download headers:', Object.fromEntries(response.headers.entries()));

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Authentication required or session expired');
                } else if (response.status === 404) {
                    throw new Error('Download token expired or already used');
                }
                throw new Error('Secure download failed');
            }

            console.log('🔒 ✅ Secure one-time download successful! Token consumed.');
            return response; // Return response for blob handling

        } catch (error) {
            console.error('🔒 ❌ Secure download failed:', error);
            throw error;
        }
    }

    async getLoaders() {
        return this.request('/api/loader_endpoints.php?action=list', {
            method: 'GET',
        });
    }

    async deleteLoader(loaderId) {
        return this.request('/api/loader_endpoints.php?action=delete', {
            method: 'DELETE',
            body: JSON.stringify({ loader_id: loaderId }),
        });
    }

    async toggleLoaderStatus(loaderId, isActive) {
        return this.request('/api/loader_endpoints.php?action=toggle', {
            method: 'POST',
            body: JSON.stringify({ loader_id: loaderId, is_active: isActive }),
        });
    }
}

// Create global API instance
window.anonteamAPI = new AnonteamAPI();

// Utility functions for common operations
window.apiUtils = {
    // Show notification
    showNotification: function(message, type = 'info') {
        // Use your existing notification system
        if (typeof showNotification === 'function') {
            showNotification(message, type);
        }
    },

    // Handle API errors
    handleError: function(error, fallbackMessage = 'An error occurred') {
        console.error('API Error:', error);
        // Detect banned user error
        if ((error && (error.banned === true || (typeof error.message === 'string' && error.message.toLowerCase().includes('banned'))))) {
            this.showNotification('You have been banned from the platform', 'error');
            // Clear session and redirect to login or reload
            if (window.anonteamAPI) window.anonteamAPI.clearSessionToken();
            localStorage.removeItem('anonteamUser');
            setTimeout(() => {
                if (typeof showLogin === 'function') {
                    showLogin();
                } else {
                    window.location.reload();
                }
            }, 1500);
            return;
        }
        const message = error.message || fallbackMessage;
        this.showNotification(message, 'error');
    },

    // Format date
    formatDate: function(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    },

    // Calculate days remaining
    getDaysRemaining: function(endDate) {
        const end = new Date(endDate);
        const now = new Date();
        const diffTime = end - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return Math.max(0, diffDays);
    },
}; 