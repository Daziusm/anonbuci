    // DOM Elements
const loginPage = document.getElementById('loginPage');
const dashboard = document.getElementById('dashboard');
const loginTab = document.getElementById('loginTab');
const signupTab = document.getElementById('signupTab');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const logoutBtn = document.getElementById('logoutBtn');
const sidebarUsername = document.getElementById('sidebarUsername');
const sidebarUID = document.getElementById('sidebarUID');
const joinDate = document.getElementById('joinDate');

// Current user data
let currentUser = null;
let viewedUser = null; // Track currently viewed user's profile

// Utility function to escape JavaScript strings for onclick attributes
function escapeForJavaScript(str) {
    if (!str) return '';
    return str.toString()
        .replace(/\\/g, '\\\\')  // Escape backslashes
        .replace(/'/g, "\\'")    // Escape single quotes
        .replace(/"/g, '\\"')    // Escape double quotes
        .replace(/\n/g, '\\n')   // Escape newlines
        .replace(/\r/g, '\\r')   // Escape carriage returns
        .replace(/\t/g, '\\t');  // Escape tabs
}

// Account types with their colors
const accountTypes = {
    user: { name: 'User', color: '#9ca3af', bgColor: 'rgba(156, 163, 175, 0.1)' }, // grey
    premium: { name: 'Premium', color: '#8b5cf6', bgColor: 'rgba(139, 92, 246, 0.1)' }, // purple
    admin: { name: 'Admin', color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.1)' }, // red
    owner: { name: 'Owner', color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.1)' }, // gold
    femboy: { name: 'Femboy', color: 'linear-gradient(45deg, #ec4899, #ffffff)', bgColor: 'rgba(236, 72, 153, 0.1)' } // pink to white
};

// Get account type for user
function getUserAccountType(username) {
    // Handle undefined or null username
    if (!username) return 'user';
    
    // First check if this is the current user and we have their actual account type
    if (currentUser && (username === currentUser.name || username === currentUser.username)) {
        return currentUser.accountType || currentUser.account_type || 'user';
    }
    
    // Default type mappings for hardcoded usernames
    const typeMap = {
        'admin': 'admin',
        'admin.1': 'admin',
        'administrator': 'admin',
        'owner': 'owner',
        'premium': 'premium',
        'femboy': 'femboy',
        'analteam': 'bot'
    };
    
    const lowerUsername = username.toLowerCase();
    return typeMap[lowerUsername] || 'user';
}

// Get account type color
function getAccountTypeColor(accountType) {
    return accountTypes[accountType] || accountTypes.user;
}

// Check if user has admin privileges
function isAdmin(user = currentUser) {
    if (!user) return false;
    // Support both camelCase and snake_case field names for compatibility
    const accountType = user.accountType || user.account_type;
    return accountType === 'admin' || accountType === 'owner' || accountType === 'femboy';
}

// Get default avatar SVG (globally accessible)
function getDefaultAvatar() {
    return 'data:image/svg+xml;base64,' + btoa(`
        <svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#2a2a2a;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#1a1a1a;stop-opacity:1" />
                </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="50" fill="url(#bgGrad)"/>
            <svg x="25" y="25" width="50" height="50" viewBox="0 0 448 512" xmlns="http://www.w3.org/2000/svg">
                <path d="M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm-45.7 48C79.8 304 0 383.8 0 482.3C0 498.7 13.3 512 29.7 512l388.6 0c16.4 0 29.7-13.3 29.7-29.7C448 383.8 368.2 304 269.7 304l-91.4 0z" fill="#888888"/>
            </svg>
        </svg>
    `);
}

// Make getDefaultAvatar globally accessible for HTML onerror handlers
window.getDefaultAvatar = getDefaultAvatar;

// Initialize all default avatars
function initializeDefaultAvatars() {
    const avatarElements = [
        'profileImage',
        'profileAvatarLarge', 
        'commentUserAvatar',
        'shoutboxUserAvatar'
    ];
    
    avatarElements.forEach(id => {
        const element = document.getElementById(id);
        if (element && (!element.src || element.src === window.location.href)) {
            element.src = getDefaultAvatar();
        }
    });
}

// Show/hide admin elements based on user privileges
function updateAdminVisibility() {
    const adminElements = document.querySelectorAll('.admin-only');
    const isUserAdmin = isAdmin();
    
    adminElements.forEach(element => {
        if (isUserAdmin) {
            element.classList.add('visible');
            element.style.display = element.classList.contains('nav-item') ? 'flex' : 'block';
        } else {
            element.classList.remove('visible');
            element.style.display = 'none';
        }
    });
}

// Ban management (using database now)

async function banUser(userId, reason) {
    try {
        const response = await anonteamAPI.banUser(userId, reason);
        if (response.success) {
            // If the banned user is currently logged in, log them out immediately
            if (currentUser && currentUser.id === userId) {
                showNotification('You have been banned from the platform', 'error');
                setTimeout(() => {
                    handleLogout();
                }, 2000);
            }
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error banning user:', error);
        return false;
    }
}

async function unbanUser(userId) {
    try {
        const response = await anonteamAPI.unbanUser(userId);
        return response.success;
    } catch (error) {
        console.error('Error unbanning user:', error);
        return false;
    }
}

async function isUserBanned(userEmail) {
    // Check if current user is banned (from login response)
    return currentUser && currentUser.is_banned === true;
}

async function getBanInfo(userEmail) {
    // Return ban info from current user data
    if (currentUser && currentUser.is_banned) {
        return {
            reason: currentUser.ban_reason || 'No reason provided',
            banned_by: currentUser.banned_by || 'System',
            banned_at: currentUser.banned_at || new Date().toISOString()
        };
    }
    return null;
}

// Handle banned user login with popup
async function handleBannedUserLogin() {
    if (!currentUser || currentUser.is_banned !== true) {
        return;
    }
    
    const banInfo = await getBanInfo(currentUser.email);
    const reason = banInfo ? banInfo.reason : 'No reason provided';
    const bannedBy = banInfo ? banInfo.banned_by : 'System';
    const banDate = banInfo && banInfo.banned_at ? new Date(banInfo.banned_at).toLocaleDateString() : new Date().toLocaleDateString();
    
    // Show ban popup
    showBanPopup(reason, bannedBy, banDate);
}

// Show ban popup modal
function showBanPopup(reason, bannedBy, banDate) {
    const banPopup = document.getElementById('banPopup');
    const banReasonText = document.getElementById('banReasonText');
    const bannedByText = document.getElementById('bannedByText');
    const banDateText = document.getElementById('banDateText');
    const countdownTimer = document.getElementById('countdownTimer');
    const banLogoutBtn = document.getElementById('banLogoutBtn');
    
    // Populate popup content
    banReasonText.textContent = reason;
    bannedByText.textContent = bannedBy;
    banDateText.textContent = banDate;
    
    // Show popup and disable interactions
    banPopup.style.display = 'flex';
    document.body.classList.add('ban-popup-active');
    
    // Check if ban timer already exists
    const banTimerKey = `banTimer_${currentUser.email}`;
    let banStartTime = localStorage.getItem(banTimerKey);
    
    if (!banStartTime) {
        // First time showing ban popup, store current time
        banStartTime = Date.now();
        localStorage.setItem(banTimerKey, banStartTime);
    } else {
        banStartTime = parseInt(banStartTime);
    }
    
    // Calculate remaining time
    const elapsed = Math.floor((Date.now() - banStartTime) / 1000);
    let countdown = Math.max(0, 60 - elapsed);
    
    // If time already expired, logout immediately
    if (countdown <= 0) {
        localStorage.removeItem(banTimerKey);
        handleLogout();
        return;
    }
    
    countdownTimer.textContent = countdown;
    
    const countdownInterval = setInterval(() => {
        countdown--;
        countdownTimer.textContent = countdown;
        
        if (countdown <= 0) {
            clearInterval(countdownInterval);
            localStorage.removeItem(banTimerKey);
            handleLogout();
        }
    }, 1000);
    
    // Manual logout button
    banLogoutBtn.onclick = () => {
        clearInterval(countdownInterval);
        localStorage.removeItem(banTimerKey);
        handleLogout();
    };
    
    // Store interval for cleanup
    banPopup.countdownInterval = countdownInterval;
}

// Change user account type
function changeUserAccountType(userEmail, newAccountType) {
    const user = registeredUsers.find(u => u.email === userEmail);
    if (!user) return false;
    
    user.accountType = newAccountType;
    localStorage.setItem('anonteamRegisteredUsers', JSON.stringify(registeredUsers));
    
    // Update current user if they're the one being changed
    if (currentUser && currentUser.email === userEmail) {
        currentUser.accountType = newAccountType;
        localStorage.setItem('anonteamUser', JSON.stringify(currentUser));
        updateAdminVisibility();
        updateProfileView();
    }
    
    return true;
}

// Grant subscription to user
function grantSubscriptionToUser(userEmail, cheatName, days) {
    const user = registeredUsers.find(u => u.email === userEmail);
    if (!user) return false;
    
    // Create subscription for the user
    const subscriptionKey = `anonteamSubscriptions_${userEmail}`;
    let userSubs = JSON.parse(localStorage.getItem(subscriptionKey) || '{}');
    
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + parseInt(days));
    
    userSubs[cheatName] = {
        active: true,
        expiry: expiryDate.toISOString(),
        grantedBy: currentUser.name,
        grantedAt: new Date().toISOString()
    };
    
    localStorage.setItem(subscriptionKey, JSON.stringify(userSubs));
    
    // Update current user's subscriptions if they're the recipient
    if (currentUser && currentUser.email === userEmail) {
        loadUserSubscriptions();
        updateSubscriptionUI();
    }
    
    return true;
}

// Initialize admin panel
function initializeAdminPanel() {
    setupAdminTabs();
    loadAdminUsers('', 1);
    loadBannedUsers();
    loadInviteStats();
    loadKeyStats();
    loadGeneratedKeys();
    loadActivityLogs();
    setupAdminEventListeners();
    loadSubscriptionManagement();
    setupTrollFeatures();
    
    // Start real-time activity log updates
    startActivityLogUpdates();
}

// Setup admin tab switching
function setupAdminTabs() {
    const adminTabs = document.querySelectorAll('.admin-tab');
    const adminPanels = document.querySelectorAll('.admin-panel');
    
    adminTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;
            
            // Remove active class from all tabs and panels
            adminTabs.forEach(t => t.classList.remove('active'));
            adminPanels.forEach(p => p.classList.remove('active'));
            
            // Add active class to clicked tab and corresponding panel
            tab.classList.add('active');
            const targetPanel = document.getElementById(targetTab + 'Panel');
            if (targetPanel) {
                targetPanel.classList.add('active');
                
                // Load tab-specific data when switching
                if (targetTab === 'keys') {
                    loadKeyStats();
                    loadGeneratedKeys();
                } else if (targetTab === 'invites') {
                    loadInviteStats();
                    loadInviteCodesList();
                } else if (targetTab === 'activity') {
                    loadActivityLogs();
                } else if (targetTab === 'loaders') {
                    loadLoaderManagement();
                } else if (targetTab === 'troll') {
                    setupTrollFeatures();
                    // Also explicitly reload the user lists when switching to troll tab
                    setTimeout(() => {
                        loadFlashbangTargets();
                        loadJobAppTargets();
                    }, 100);
                }
            }
        });
    });
}

// Pagination state
let currentUsersPage = 1;
const USERS_PER_PAGE = 3;
let totalUsers = 0;
let allUsers = [];
let currentSearchTerm = '';

// Load users for admin management (backend database)
async function loadAdminUsers(searchTerm = '', page = 1) {
    const usersList = document.getElementById('adminUsersList');
    if (!usersList) return;
    
    usersList.innerHTML = '<div>Loading...</div>';
    currentSearchTerm = searchTerm;
    currentUsersPage = page;
    
    try {
        // Load all users first, then paginate on frontend
        const response = await anonteamAPI.getAllUsers(searchTerm, 1, 1000);
        if (response.success && response.data && response.data.users.length > 0) {
            allUsers = response.data.users;
            totalUsers = allUsers.length;
            
            // Calculate pagination
            const startIndex = (page - 1) * USERS_PER_PAGE;
            const endIndex = startIndex + USERS_PER_PAGE;
            const paginatedUsers = allUsers.slice(startIndex, endIndex);
            
            updateAdminUsersList(paginatedUsers);
            updateUsersPagination();
        } else {
            usersList.innerHTML = `<div class="user-item"><div class="user-info"><div class="user-details"><div class="user-name">${searchTerm ? 'No users found matching search' : 'No users found'}</div><div class="user-email">${searchTerm ? 'Try a different search term' : 'Register some users to see them here'}</div></div></div></div>`;
            updateUsersPagination();
        }
    } catch (error) {
        console.error('Error loading users:', error);
        usersList.innerHTML = '<div>Error loading users. Please check console.</div>';
        updateUsersPagination();
    }
}

function updateUsersPagination() {
    let paginationContainer = document.getElementById('usersPagination');
    if (!paginationContainer) {
        // Create pagination container if it doesn't exist
        const usersSection = document.querySelector('#usersPanel .admin-section');
        if (usersSection) {
            const paginationDiv = document.createElement('div');
            paginationDiv.id = 'usersPagination';
            paginationDiv.className = 'users-pagination';
            usersSection.appendChild(paginationDiv);
        } else {
            return;
        }
        paginationContainer = document.getElementById('usersPagination');
    }

    const totalPages = Math.ceil(totalUsers / USERS_PER_PAGE);
    
    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }

    let paginationHTML = `
        <div class="pagination-info">
            <span>Page ${currentUsersPage} of ${totalPages} (${totalUsers} total users)</span>
        </div>
        <div class="pagination-controls">
    `;

    // Previous button
    if (currentUsersPage > 1) {
        paginationHTML += `
            <button class="pagination-btn" onclick="loadAdminUsers('${currentSearchTerm}', ${currentUsersPage - 1})">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Previous
            </button>
        `;
    }

    // Page numbers (show max 5 pages)
    const startPage = Math.max(1, currentUsersPage - 2);
    const endPage = Math.min(totalPages, startPage + 4);

    if (startPage > 1) {
        paginationHTML += `<button class="pagination-btn" onclick="loadAdminUsers('${currentSearchTerm}', 1)">1</button>`;
        if (startPage > 2) {
            paginationHTML += `<span class="pagination-dots">...</span>`;
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `
            <button class="pagination-btn ${i === currentUsersPage ? 'active' : ''}" 
                    onclick="loadAdminUsers('${currentSearchTerm}', ${i})">${i}</button>
        `;
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            paginationHTML += `<span class="pagination-dots">...</span>`;
        }
        paginationHTML += `<button class="pagination-btn" onclick="loadAdminUsers('${currentSearchTerm}', ${totalPages})">${totalPages}</button>`;
    }

    // Next button
    if (currentUsersPage < totalPages) {
        paginationHTML += `
            <button class="pagination-btn" onclick="loadAdminUsers('${currentSearchTerm}', ${currentUsersPage + 1})">
                Next
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
        `;
    }

    paginationHTML += `</div>`;
    paginationContainer.innerHTML = paginationHTML;
}

// Update admin users list (backend database)
function updateAdminUsersList(users) {
    const usersContainer = document.getElementById('adminUsersList');
    if (!usersContainer) return;
    usersContainer.innerHTML = '';
    users.forEach(user => {
        const userElement = document.createElement('div');
        userElement.className = 'modern-user-card';
        
        // Get account type styling
        const roleInfo = getRoleInfo(user.accountType || user.account_type);
        
        // Add or update escapeHtml function at the top if not present
        function escapeHtml(text) {
            if (typeof text !== 'string') return text;
            return text.replace(/[&<>"']/g, function(m) {
                return ({
                    '&': '&amp;',
                    '<': '&lt;',
                    '>': '&gt;',
                    '"': '&quot;',
                    "'": '&#39;'
                })[m];
            });
        }
        
        // Example patch for userElement.innerHTML (repeat for all similar usages):
        userElement.innerHTML = `
            <div class="user-card-header">
                <div class="user-avatar">
                    <img src="${escapeHtml(user.profile_image || user.profileImage || getDefaultAvatar())}"
                         alt="${escapeHtml(user.username)}"
                         style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover;"
                         onerror="this.src=getDefaultAvatar();" />
                </div>
                <div class="user-basic-info">
                    <div class="user-name-row">
                        <h4 class="user-display-name">${escapeHtml(user.username)}</h4>
                        <span class="user-role-badge ${roleInfo.class}">${roleInfo.name}</span>
                    </div>
                    <div class="user-meta">
                        <span class="user-email">${escapeHtml(user.email)}</span>
                        <span class="user-id">UID: ${escapeHtml(user.id)}</span>
                    </div>
                </div>
            </div>
            
            <div class="user-card-actions">
                <button class="modern-btn details-btn" onclick="showUserDetailsModal(${escapeHtml(user.id)})">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
                        <path d="M12 1v6m0 8v6m11-7h-6M6 12H0" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    Details
                </button>
                <button class="modern-btn role-btn" onclick="showRoleChangeModal(${escapeHtml(user.id)}, '${escapeHtml(user.username)}', '${escapeHtml(user.accountType || user.account_type)}')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M21 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3" stroke="currentColor" stroke-width="2"/>
                        <path d="M3 12c1 0 3-1 3-3s-2-3-3-3-3 1-3 3 2 3 3 3" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    Role
                </button>
                <button class="modern-btn ban-btn" onclick="banUserConfirm(${escapeHtml(user.id)}, '${escapeHtml(user.username)}')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                        <path d="m4.93 4.93 14.14 14.14" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    Ban
                </button>
            </div>
        `;
        usersContainer.appendChild(userElement);
    });
}

// Helper function for role styling
function getRoleInfo(accountType) {
    const roles = {
        'owner': { name: 'Owner', class: 'role-owner' },
        'admin': { name: 'Admin', class: 'role-admin' },
        'premium': { name: 'Premium', class: 'role-premium' },
        'femboy': { name: 'Femboy', class: 'role-femboy' },
        'bot': { name: 'Bot', class: 'role-bot' },
        'user': { name: 'User', class: 'role-user' }
    };
    return roles[accountType] || { name: 'User', class: 'role-user' };
}

// Show user details modal (backend only)
window.showUserDetailsModal = async function(userId) {
    try {
        const response = await anonteamAPI.getUserDetails(userId);
        if (response.success && response.data && response.data.user) {
            const user = response.data.user;
            const subscriptions = response.data.subscriptions || [];
            
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
                modal.style.minWidth = '700px';
                modal.style.maxWidth = '90vw';
                modal.style.maxHeight = '90vh';
                modal.style.overflow = 'auto';
                modal.style.boxShadow = '0 8px 32px rgba(0,0,0,0.25)';
                document.body.appendChild(modal);
            }
            
            // Build subscriptions HTML
            let subscriptionsHTML = '';
            if (subscriptions.length > 0) {
                subscriptionsHTML = subscriptions.map(sub => {
                    const endDate = new Date(sub.end_date);
                    const now = new Date();
                    const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
                    const isActive = sub.is_active && daysLeft > 0;
                    const statusColor = isActive ? '#10b981' : '#ef4444';
                    const statusText = isActive ? `${daysLeft} days left` : 'Expired';
                    
                    return `
                        <div style="display:flex; align-items:center; justify-content:space-between; padding:12px; background:#1f2937; border-radius:8px; margin-bottom:8px;">
                            <div>
                                <div style="font-weight:600; color:#fff;">${sub.display_name}</div>
                                <div style="font-size:12px; color:${statusColor};">${statusText}</div>
                                <div style="font-size:11px; color:#9ca3af;">Expires: ${endDate.toLocaleDateString()}</div>
                            </div>
                            <div style="display:flex; gap:8px;">
                                                            <button onclick="showExtendSubscriptionModal(${user.id}, ${sub.product_id}, '${sub.display_name.replace(/'/g, "\\'").replace(/"/g, '\\"')}')" 
                                    style="padding:6px 12px; background:#3b82f6; color:#fff; border:none; border-radius:4px; font-size:12px; cursor:pointer;">
                                Extend
                            </button>
                            <button onclick="revokeSubscriptionConfirm(${user.id}, ${sub.product_id}, '${sub.display_name.replace(/'/g, "\\'").replace(/"/g, '\\"')}')" 
                                    style="padding:6px 12px; background:#ef4444; color:#fff; border:none; border-radius:4px; font-size:12px; cursor:pointer;">
                                Revoke
                            </button>
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                subscriptionsHTML = '<div style="padding:20px; text-align:center; color:#9ca3af; font-style:italic;">No subscriptions found</div>';
            }
            
            modal.innerHTML = `
                <h2 style="margin-bottom:20px; border-bottom:1px solid #333; padding-bottom:12px;">User Details</h2>
                
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-bottom:20px;">
                    <div>
                        <h3 style="margin-bottom:12px; color:#a1a1aa;">Basic Information</h3>
                        <div style="margin-bottom:8px;"><b>Username:</b> ${user.username}</div>
                        <div style="margin-bottom:8px;"><b>Email:</b> ${user.email}</div>
                        <div style="margin-bottom:8px;"><b>Account Type:</b> ${user.accountType}</div>
                        <div style="margin-bottom:8px;"><b>UID:</b> ${user.id}</div>
                        <div style="margin-bottom:8px;"><b>Join Date:</b> ${user.joinDate || user.createdAt}</div>
                        <div style="margin-bottom:8px;"><b>Last Login:</b> ${user.lastLogin || 'Never'}</div>
                        <div style="margin-bottom:8px;"><b>Status:</b> ${user.isBanned ? 'Banned' : 'Active'}</div>
                    </div>
                    
                    <div>
                        <h3 style="margin-bottom:12px; color:#a1a1aa;">Telemetry Information</h3>
                        <div style="margin-bottom:8px;"><b>HWID Hash:</b> <span style="font-family:monospace; color:#10b981;">${user.hwidHash || 'Not available'}</span></div>
                        <div style="margin-bottom:8px;"><b>IP Address:</b> <span style="font-family:monospace; color:#3b82f6;">${user.ipAddress || 'Not available'}</span></div>
                        <div style="margin-bottom:8px;"><b>CPU:</b> <span style="font-family:monospace; color:#10b981;">${user.cpuInfo || 'Not available'}</span></div>
                        <div style="margin-bottom:8px;"><b>GPU:</b> <span style="font-family:monospace; color:#10b981;">${user.gpuInfo || 'Not available'}</span></div>
                        <div style="margin-bottom:8px;"><b>Motherboard:</b> <span style="font-family:monospace; color:#10b981;">${user.motherboard || 'Not available'}</span></div>
                        <div style="margin-bottom:8px;"><b>RAM:</b> <span style="font-family:monospace; color:#10b981;">${user.ramInfo || 'Not available'}</span></div>
                        <div style="margin-bottom:8px;"><b>Windows:</b> <span style="font-family:monospace; color:#f59e0b;">${user.windowsVersion || 'Not available'}</span></div>
                        <div style="margin-bottom:8px;"><b>Drive Hash:</b> <span style="font-family:monospace; color:#10b981;">${user.driveHash || 'Not available'}</span></div>
                        <div style="margin-bottom:8px;"><b>HWID Resets:</b> <span style="color:#a855f7;">${user.hwidResetCount !== null && user.hwidResetCount !== undefined ? user.hwidResetCount : (user.hwid_reset_count || user.hwidResets || '0')} total</span></div>
                        <div><b>Last HWID Reset:</b> <span style="color:#7c3aed;">${user.lastHwidReset ? new Date(user.lastHwidReset).toLocaleDateString() : (user.last_hwid_reset ? new Date(user.last_hwid_reset).toLocaleDateString() : 'Never')}</span></div>
                    </div>
                </div>
                
                <!-- Subscription Management Section -->
                <div style="margin-bottom:20px;">
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
                        <h3 style="color:#a1a1aa; margin:0;">Subscriptions</h3>
                        <button onclick="showAddSubscriptionModal(${user.id}, '${user.username}')" 
                                style="padding:8px 16px; background:#10b981; color:#fff; border:none; border-radius:6px; font-size:14px; cursor:pointer;">
                            Grant Subscription
                        </button>
                    </div>
                    <div style="background:#111827; border-radius:8px; padding:12px; max-height:200px; overflow-y:auto;">
                        ${subscriptionsHTML}
                    </div>
                </div>
                
                <!-- Admin Actions Section -->
                <div style="margin-bottom:20px;">
                    <h3 style="color:#a1a1aa; margin-bottom:12px;">Admin Actions</h3>
                    <div style="display:flex; gap:10px; flex-wrap:wrap;">
                        <button onclick="forceHwidResetConfirm(${user.id}, '${user.username}')" 
                                style="padding:10px 16px; background:#f59e0b; color:#fff; border:none; border-radius:6px; font-size:14px; cursor:pointer;">
                            🔄 Force HWID Reset
                        </button>
                        ${user.isBanned ? 
                            `<button onclick="unbanUserConfirm(${user.id}, '${user.username}')" style="padding:10px 16px; background:#10b981; color:#fff; border:none; border-radius:6px; font-size:14px; cursor:pointer;">✅ Unban User</button>` : 
                            `<button onclick="banUserConfirm(${user.id}, '${user.username}')" style="padding:10px 16px; background:#ef4444; color:#fff; border:none; border-radius:6px; font-size:14px; cursor:pointer;">🚫 Ban User</button>`
                        }
                        <button onclick="showRoleChangeModal(${user.id}, '${user.username}', '${user.accountType}')" 
                                style="padding:10px 16px; background:#8b5cf6; color:#fff; border:none; border-radius:6px; font-size:14px; cursor:pointer;">
                            👑 Change Role
                        </button>
                    </div>
                </div>
                
                <button onclick="document.getElementById('userDetailsModal').remove()" style="width:100%; padding:10px; background:#6366f1; color:#fff; border:none; border-radius:6px; font-weight:500; cursor:pointer;">Close</button>
            `;
        }
    } catch (e) {
        console.error('Error loading user details:', e);
        alert('Failed to load user details.');
    }
}

// Subscription management functions (backend only)
window.showAddSubscriptionModal = function(userId, username) {
    let modal = document.getElementById('addSubscriptionModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'addSubscriptionModal';
        modal.style.position = 'fixed';
        modal.style.top = '50%';
        modal.style.left = '50%';
        modal.style.transform = 'translate(-50%, -50%)';
        modal.style.background = '#18181b';
        modal.style.color = '#fff';
        modal.style.padding = '32px';
        modal.style.borderRadius = '12px';
        modal.style.zIndex = '10000';
        modal.style.minWidth = '400px';
        modal.style.boxShadow = '0 8px 32px rgba(0,0,0,0.25)';
        document.body.appendChild(modal);
    }
    
    modal.innerHTML = `
        <h3 style="margin-bottom:20px; border-bottom:1px solid #333; padding-bottom:12px;">Grant Subscription</h3>
        <div style="margin-bottom:15px;"><b>User:</b> ${username}</div>
        
        <label style="display:block; margin-bottom:8px; font-weight:500;">Product:</label>
        <select id="productSelect" style="width:100%; padding:10px; background:#111; color:#fff; border:1px solid #333; border-radius:6px; margin-bottom:15px;">
            <option value="1">Compkiller</option>
            <option value="2">Neverlose</option>
            <option value="3">Onetap</option>
            <option value="4">Fatality</option>
        </select>
        
        <label style="display:block; margin-bottom:8px; font-weight:500;">Duration (days):</label>
        <input type="number" id="durationInput" value="30" min="1" max="365" 
               style="width:100%; padding:10px; background:#111; color:#fff; border:1px solid #333; border-radius:6px; margin-bottom:20px;">
        
        <div style="display:flex; gap:10px;">
            <button onclick="confirmAddSubscription(${userId})" 
                    style="flex:1; padding:10px; background:#10b981; color:#fff; border:none; border-radius:6px; font-weight:500; cursor:pointer;">
                Grant Subscription
            </button>
            <button onclick="document.getElementById('addSubscriptionModal').remove()" 
                    style="flex:1; padding:10px; background:#6b7280; color:#fff; border:none; border-radius:6px; font-weight:500; cursor:pointer;">
                Cancel
            </button>
        </div>
    `;
}

window.confirmAddSubscription = async function(userId) {
    const productId = document.getElementById('productSelect').value;
    const days = document.getElementById('durationInput').value;
    
    if (!productId || !days || days < 1) {
        apiUtils.showNotification('Please select a product and enter valid duration.', 'error');
        return;
    }
    
    try {
        await anonteamAPI.addUserSubscription(userId, parseInt(productId), parseInt(days));
        document.getElementById('addSubscriptionModal').remove();
        showUserDetailsModal(userId); // Refresh the user details
        apiUtils.showNotification('Subscription granted successfully.', 'success');
    } catch (error) {
        apiUtils.showNotification('Failed to grant subscription.', 'error');
    }
}

window.showExtendSubscriptionModal = function(userId, productId, productName) {
    let modal = document.getElementById('extendSubscriptionModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'extendSubscriptionModal';
        modal.style.position = 'fixed';
        modal.style.top = '50%';
        modal.style.left = '50%';
        modal.style.transform = 'translate(-50%, -50%)';
        modal.style.background = '#18181b';
        modal.style.color = '#fff';
        modal.style.padding = '32px';
        modal.style.borderRadius = '12px';
        modal.style.zIndex = '10000';
        modal.style.minWidth = '400px';
        modal.style.boxShadow = '0 8px 32px rgba(0,0,0,0.25)';
        document.body.appendChild(modal);
    }
    
    modal.innerHTML = `
        <h3 style="margin-bottom:20px; border-bottom:1px solid #333; padding-bottom:12px;">Extend Subscription</h3>
        <div style="margin-bottom:15px;"><b>Product:</b> ${productName}</div>
        
        <label style="display:block; margin-bottom:8px; font-weight:500;">Extend by (days):</label>
        <input type="number" id="extendDurationInput" value="30" min="1" max="365" 
               style="width:100%; padding:10px; background:#111; color:#fff; border:1px solid #333; border-radius:6px; margin-bottom:20px;">
        
        <div style="display:flex; gap:10px;">
            <button onclick="confirmExtendSubscription(${userId}, ${productId})" 
                    style="flex:1; padding:10px; background:#3b82f6; color:#fff; border:none; border-radius:6px; font-weight:500; cursor:pointer;">
                Extend Subscription
            </button>
            <button onclick="document.getElementById('extendSubscriptionModal').remove()" 
                    style="flex:1; padding:10px; background:#6b7280; color:#fff; border:none; border-radius:6px; font-weight:500; cursor:pointer;">
                Cancel
            </button>
        </div>
    `;
}

window.confirmExtendSubscription = async function(userId, productId) {
    const days = document.getElementById('extendDurationInput').value;
    
    if (!days || days < 1) {
        apiUtils.showNotification('Please enter valid duration.', 'error');
        return;
    }
    
    try {
        await anonteamAPI.extendUserSubscription(userId, productId, parseInt(days));
        document.getElementById('extendSubscriptionModal').remove();
        showUserDetailsModal(userId); // Refresh the user details
        apiUtils.showNotification('Subscription extended successfully.', 'success');
    } catch (error) {
        apiUtils.showNotification('Failed to extend subscription.', 'error');
    }
}

window.revokeSubscriptionConfirm = function(userId, productId, productName) {
    if (confirm(`Are you sure you want to revoke the ${productName} subscription?`)) {
        anonteamAPI.revokeUserSubscription(userId, productId).then(() => {
            showUserDetailsModal(userId); // Refresh the user details
            apiUtils.showNotification('Subscription revoked successfully.', 'success');
        }).catch(() => {
            apiUtils.showNotification('Failed to revoke subscription.', 'error');
        });
    }
}

window.forceHwidResetConfirm = function(userId, username) {
    if (confirm(`Are you sure you want to force reset HWID for user '${username}'?\n\nThis will:\n- Clear their current HWID\n- Increment their reset count\n- Allow them to login from a new device`)) {
        anonteamAPI.forceHwidReset(userId).then(() => {
            showUserDetailsModal(userId); // Refresh the user details
            apiUtils.showNotification('HWID reset successfully.', 'success');
        }).catch(() => {
            apiUtils.showNotification('Failed to reset HWID.', 'error');
        });
    }
}

// Ban user with confirmation (backend only)
window.banUserConfirm = function(userId, username) {
    if (confirm(`Are you sure you want to ban user '${username}'?`)) {
        anonteamAPI.banUser(userId, 'Banned by admin').then(() => {
            loadAdminUsers(currentSearchTerm, currentUsersPage);
            apiUtils.showNotification('User banned successfully.', 'success');
        }).catch(() => {
            apiUtils.showNotification('Failed to ban user.', 'error');
        });
    }
}

// Role change modal (backend only)
window.showRoleChangeModal = function(userId, username, currentRole) {
    let modal = document.getElementById('roleChangeModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'roleChangeModal';
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
        <h2 style="margin-bottom:18px;">Change User Role</h2>
        <div style="margin-bottom:15px;"><b>User:</b> ${username}</div>
        <div style="margin-bottom:15px;"><b>Current Role:</b> ${currentRole}</div>
        <label style="display:block; margin-bottom:8px; font-weight:500;">New Role:</label>
        <select id="newRoleSelect" style="width:100%; padding:8px; background:#111; color:#fff; border:1px solid #333; border-radius:6px; margin-bottom:20px;">
            <option value="user" ${currentRole === 'user' ? 'selected' : ''}>User</option>
            <option value="premium" ${currentRole === 'premium' ? 'selected' : ''}>Premium</option>
            <option value="admin" ${currentRole === 'admin' ? 'selected' : ''}>Admin</option>
            <option value="owner" ${currentRole === 'owner' ? 'selected' : ''}>Owner</option>
            <option value="femboy" ${currentRole === 'femboy' ? 'selected' : ''}>Femboy</option>
        </select>
        <div style="display:flex; gap:10px;">
            <button onclick="confirmRoleChange(${userId}, '${username}')" style="flex:1; padding:8px; background:#10b981; color:#fff; border:none; border-radius:6px; font-weight:500; cursor:pointer;">Change Role</button>
            <button onclick="document.getElementById('roleChangeModal').remove()" style="flex:1; padding:8px; background:#6b7280; color:#fff; border:none; border-radius:6px; font-weight:500; cursor:pointer;">Cancel</button>
        </div>
    `;
}

// Confirm role change (backend only)
window.confirmRoleChange = function(userId, username) {
    const newRole = document.getElementById('newRoleSelect').value;
    
    anonteamAPI.changeUserRole(userId, newRole).then(() => {
        // Force reload users with cache bust
        loadAdminUsers(currentSearchTerm || '', currentUsersPage || 1);
        document.getElementById('roleChangeModal').remove();
        apiUtils.showNotification(`User role changed to ${newRole} successfully.`, 'success');
    }).catch(() => {
        apiUtils.showNotification('Failed to change user role.', 'error');
    });
}

// Ban Management: Filter banned users from all users
async function loadBannedUsers() {
    const bannedList = document.getElementById('bannedUsersList');
    if (!bannedList) return;
    bannedList.innerHTML = '<div>Loading...</div>';
    
    try {
        const response = await anonteamAPI.getAllUsers('', 1, 100);
        if (response.success && response.data && response.data.users.length > 0) {
            // Filter only banned users (using camelCase field name from API)
            const bannedUsers = response.data.users.filter(user => user.isBanned || user.is_banned);
            
            if (bannedUsers.length > 0) {
                bannedList.innerHTML = '';
                bannedUsers.forEach(banInfo => {
                    const banDate = new Date(banInfo.bannedAt || banInfo.banned_at || new Date());
                    const formattedDate = banDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
                    const userItem = document.createElement('div');
                    userItem.className = 'ban-card';
                    userItem.innerHTML = `
                        <div class="ban-header">
                            <div class="ban-user-info">
                                <div class="ban-avatar"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M4.93 4.93L19.07 19.07" stroke="currentColor" stroke-width="2"/></svg></div>
                                <div class="ban-details"><div class="ban-username">${banInfo.username}</div><div class="ban-email">${banInfo.email}</div></div>
                            </div>
                            <div class="ban-status"><span class="ban-badge">BANNED</span></div>
                        </div>
                        <div class="ban-content"><div class="ban-reason-section"><label class="ban-label">Reason:</label><p class="ban-reason">${banInfo.banReason || banInfo.ban_reason || 'No reason provided'}</p></div><div class="ban-meta"><div class="ban-meta-item"><span class="ban-meta-label">Banned by:</span><span class="ban-meta-value">${banInfo.bannedBy || banInfo.banned_by || 'Unknown'}</span></div><div class="ban-meta-item"><span class="ban-meta-label">Date:</span><span class="ban-meta-value">${formattedDate}</span></div></div></div><div class="ban-actions"><button class="admin-btn unban-btn" onclick="unbanUserConfirm(${banInfo.id}, '${banInfo.username}')"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 12L11 14L15 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>Unban User</button></div>`;
                    bannedList.appendChild(userItem);
                });
            } else {
                bannedList.innerHTML = `<div class="ban-card empty-state"><div class="ban-icon-large"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 6V12L16 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></div><div class="empty-state-text"><h4>No Active Bans</h4><p>All users are currently in good standing</p></div></div>`;
            }
        } else {
            bannedList.innerHTML = `<div class="ban-card empty-state"><div class="ban-icon-large"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 6V12L16 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></div><div class="empty-state-text"><h4>No Active Bans</h4><p>All users are currently in good standing</p></div></div>`;
        }
    } catch (error) {
        console.error('Error loading banned users:', error);
        bannedList.innerHTML = '<div>Error loading banned users</div>';
    }
}

// Unban user (backend only)
window.unbanUserConfirm = function(userId, username) {
    if (confirm(`Are you sure you want to unban ${username}?`)) {
        anonteamAPI.unbanUser(userId).then(() => {
            loadAdminUsers();
            loadBannedUsers();
            apiUtils.showNotification('User unbanned successfully.', 'success');
        }).catch(() => {
            apiUtils.showNotification('Failed to unban user.', 'error');
        });
    }
}

// Setup admin event listeners
function setupAdminEventListeners() {
    const grantSubBtn = document.getElementById('grantSubBtn');
    if (grantSubBtn) {
        grantSubBtn.addEventListener('click', handleGrantSubscription);
    }
    
    const createInvitesBtn = document.getElementById('createInvitesBtn');
    if (createInvitesBtn) {
        createInvitesBtn.addEventListener('click', handleCreateInvites);
    }
    
    const refreshActivityBtn = document.getElementById('refreshActivityBtn');
    if (refreshActivityBtn) {
        refreshActivityBtn.addEventListener('click', loadActivityLogs);
    }
    
    const activityFilter = document.getElementById('activityFilter');
    if (activityFilter) {
        activityFilter.addEventListener('change', loadActivityLogs);
    }
    
    const generateKeysBtn = document.getElementById('generateKeysBtn');
    if (generateKeysBtn) {
        generateKeysBtn.addEventListener('click', handleGenerateKeys);
    }
    
    const refreshKeysBtn = document.getElementById('refreshKeysBtn');
    if (refreshKeysBtn) {
        refreshKeysBtn.addEventListener('click', loadGeneratedKeys);
    }
    
    // User search functionality
    const searchUsersBtn = document.getElementById('searchUsersBtn');
    const userSearchInput = document.getElementById('userSearchInput');
    const refreshUsersBtn = document.getElementById('refreshUsersBtn');
    
    if (searchUsersBtn && userSearchInput) {
        searchUsersBtn.addEventListener('click', () => {
            const searchTerm = userSearchInput.value.trim();
            // Reset to page 1 when searching
            loadAdminUsers(searchTerm, 1);
        });
        
        userSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const searchTerm = userSearchInput.value.trim();
                // Reset to page 1 when searching
                loadAdminUsers(searchTerm, 1);
            }
        });
    }
    
    if (refreshUsersBtn) {
        refreshUsersBtn.addEventListener('click', () => {
            if (userSearchInput) userSearchInput.value = '';
            // Reset to page 1 when refreshing
            loadAdminUsers('', 1);
        });
    }
    

    
    // Product management
    const globalFreezeBtn = document.getElementById('globalFreezeBtn');
    const globalUnfreezeBtn = document.getElementById('globalUnfreezeBtn');
    const globalAlphaOnlyBtn = document.getElementById('globalAlphaOnlyBtn');
    const globalRemoveAlphaBtn = document.getElementById('globalRemoveAlphaBtn');
    
    if (globalFreezeBtn) {
        globalFreezeBtn.addEventListener('click', handleGlobalFreeze);
    }
    
    if (globalUnfreezeBtn) {
        globalUnfreezeBtn.addEventListener('click', handleGlobalUnfreeze);
    }
    
    if (globalAlphaOnlyBtn) {
        globalAlphaOnlyBtn.addEventListener('click', handleGlobalAlphaOnly);
    }
    
    if (globalRemoveAlphaBtn) {
        globalRemoveAlphaBtn.addEventListener('click', handleGlobalRemoveAlpha);
    }
    
    // Product select dropdown
    const globalProductSelect = document.getElementById('globalProductSelect');
    if (globalProductSelect) {
        globalProductSelect.addEventListener('change', updateGlobalAlphaButtons);
    }
    
    // Individual product freeze/unfreeze buttons
    document.querySelectorAll('.freeze-product-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const product = btn.getAttribute('data-product');
            freezeProduct(product);
        });
    });
    
    document.querySelectorAll('.unfreeze-product-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const product = btn.getAttribute('data-product');
            unfreezeProduct(product);
        });
    });
    
    // Initialize product status
    updateProductStatus();
}

// Handle subscription granting
function handleGrantSubscription() {
    const userSelect = document.getElementById('grantUserSelect');
    const cheatSelect = document.getElementById('grantCheatSelect');
    const daysInput = document.getElementById('grantDays');
    
    const userEmail = userSelect.value;
    const cheatName = cheatSelect.value;
    const days = parseInt(daysInput.value);
    
    if (!userEmail || !cheatName || !days || days < 1 || days > 365) {
        showNotification('Please fill all fields with valid values', 'error');
        return;
    }
    
    const user = registeredUsers.find(u => u.email === userEmail);
    if (!user) {
        showNotification('User not found', 'error');
        return;
    }
    
    if (grantSubscriptionToUser(userEmail, cheatName, days)) {
        showNotification(`Successfully granted ${days}-day ${cheatName} subscription to ${user.name}`, 'success');
        
        // Reset form
        userSelect.value = '';
        cheatSelect.value = '';
        daysInput.value = '';
    } else {
        showNotification('Failed to grant subscription', 'error');
    }
}

// Show ban dialog
function showBanDialog(userEmail, userName) {
    const reason = prompt(`Enter ban reason for ${userName}:`);
    if (reason && reason.trim()) {
        if (banUser(userEmail, reason.trim())) {
            showNotification(`${userName} has been banned`, 'success');
            loadAdminUsers();
            loadBannedUsers();
        } else {
            showNotification('Failed to ban user', 'error');
        }
    }
}

// Show role change dialog
function showRoleChangeDialog(userEmail, userName) {
    const newRole = prompt(`Enter new role for ${userName}:\n\nOptions: user, premium, admin, owner, femboy`);
    if (newRole && accountTypes[newRole.toLowerCase()]) {
        if (changeUserAccountType(userEmail, newRole.toLowerCase())) {
            showNotification(`${userName}'s role changed to ${newRole}`, 'success');
            loadAdminUsers(currentSearchTerm, currentUsersPage);
        } else {
            showNotification('Failed to change user role', 'error');
        }
    } else if (newRole !== null) {
        showNotification('Invalid role. Use: user, premium, admin, owner, or femboy', 'error');
    }
}

// Confirm unban user
function unbanUserConfirm(userEmail, userName) {
    if (confirm(`Are you sure you want to unban ${userName}?`)) {
        unbanUser(userEmail);
        showNotification(`${userName} has been unbanned`, 'success');
        loadAdminUsers(currentSearchTerm, currentUsersPage);
        loadBannedUsers();
        // Log activity
        logActivity('ban', `${userName} unbanned by ${currentUser.name}`, currentUser.name);
    }
}

// Load invite statistics
async function loadInviteStats() {
    const activeCount = document.getElementById('activeInviteCount');
    const usedCount = document.getElementById('usedInviteCount');
    
    try {
        const response = await anonteamAPI.getInviteCodes();
        
        if (response.success && response.data && response.data.codes) {
            const codes = response.data.codes;
            const unusedCodes = codes.filter(code => !code.used_by);
            const usedCodes = codes.filter(code => code.used_by);
    
    if (activeCount) {
                activeCount.textContent = unusedCodes.length;
    }
    
    if (usedCount) {
                usedCount.textContent = usedCodes.length;
            }
        } else {
            if (activeCount) activeCount.textContent = '0';
            if (usedCount) usedCount.textContent = '0';
        }
    } catch (error) {
        console.error('Error loading invite stats:', error);
        if (activeCount) activeCount.textContent = '-';
        if (usedCount) usedCount.textContent = '-';
    }
    
    loadInviteCodesList();
}

// Load invite codes list (backend database)
async function loadInviteCodesList() {
    const codesList = document.getElementById('inviteCodesList');
    if (!codesList) return;
    codesList.innerHTML = '<div>Loading...</div>';
    
    try {
        const response = await anonteamAPI.getInviteCodes();
        if (response.success && response.data && response.data.codes.length > 0) {
            codesList.innerHTML = '';
            
            // Separate unused and used codes
            const codes = response.data.codes;
            const unusedCodes = codes.filter(code => !code.used_by);
            const usedCodes = codes.filter(code => code.used_by);
            
            // Display unused codes first
            if (unusedCodes.length > 0) {
                const unusedHeader = document.createElement('div');
                unusedHeader.innerHTML = '<h4 style="color: #22c55e; margin: 10px 0; font-size: 14px;">Available Codes</h4>';
                codesList.appendChild(unusedHeader);
                
                unusedCodes.forEach(code => {
                const codeItem = document.createElement('div');
                codeItem.className = 'invite-code-item';
                codeItem.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span class="invite-code">${code.code}</span>
                            <span style="color: #22c55e; font-size: 12px; font-weight: 500;">UNUSED</span>
                        </div>
                        <button class="admin-btn" onclick="copyInviteCode('${code.code}')">Copy</button>
                `;
                codesList.appendChild(codeItem);
            });
            }
            
            // Display used codes
            if (usedCodes.length > 0) {
                const usedHeader = document.createElement('div');
                usedHeader.innerHTML = '<h4 style="color: #ef4444; margin: 15px 0 10px 0; font-size: 14px;">Used Codes</h4>';
                codesList.appendChild(usedHeader);
                
                usedCodes.forEach(code => {
                    const codeItem = document.createElement('div');
                    codeItem.className = 'invite-code-item';
                    codeItem.style.opacity = '0.6';
                    codeItem.innerHTML = `
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <span class="invite-code" style="color: #666;">${code.code}</span>
                                <span style="color: #ef4444; font-size: 12px; font-weight: 500;">USED</span>
                            </div>
                            <div style="font-size: 11px; color: #888;">
                                Used by: ${code.used_by_username || 'Unknown'} 
                                ${code.used_at ? '• ' + new Date(code.used_at).toLocaleDateString() : ''}
                            </div>
                        </div>
                        <span style="color: #666; font-size: 12px;">Used</span>
                    `;
                    codesList.appendChild(codeItem);
                });
            }
            
        } else {
            codesList.innerHTML = `
                <div class="invite-code-item">
                    <span style="color: #888888;">No invitation codes found</span>
                    <span style="color: #666; font-size: 12px;">Create some codes to get started</span>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading invite codes:', error);
        codesList.innerHTML = '<div style="color: #ef4444;">Error loading invite codes</div>';
    }
}

// Handle invite creation
async function handleCreateInvites() {
    const countInput = document.getElementById('inviteCount');
    const count = parseInt(countInput.value);
    
    if (!count || count < 1 || count > 100) {
        showNotification('Please enter a valid number between 1-100', 'error');
        return;
    }
    
    try {
        const response = await anonteamAPI.createInviteCodes(count);
        
        if (response.success) {
            showNotification(`Successfully created ${count} invitation code(s)!`, 'success');
            
            // Refresh the invite codes list and stats
            loadInviteStats();
            loadInviteCodesList();
            
            // Clear the input
            countInput.value = 1;
        } else {
            showNotification(response.message || 'Failed to create invite codes', 'error');
        }
    } catch (error) {
        console.error('Error creating invite codes:', error);
        showNotification('Failed to create invite codes. Please try again.', 'error');
    }
}

// Copy invite code to clipboard
function copyInviteCode(code) {
    navigator.clipboard.writeText(code).then(() => {
        showNotification('Invite code copied to clipboard!', 'success');
    }).catch(() => {
        showNotification('Failed to copy code', 'error');
    });
}

// Key generation system (using database now)

// Handle key generation
async function handleGenerateKeys() {
    const cheatSelect = document.getElementById('keyCheatSelect');
    const durationSelect = document.getElementById('keyDurationSelect');
    const countInput = document.getElementById('keyCount');
    const productId = cheatSelect.value;
    const duration = parseInt(durationSelect.value);
    const count = parseInt(countInput.value);
    
    if (!productId || !duration || !count || count < 1 || count > 50) {
        showNotification('Please fill all fields with valid values (max 50 keys)', 'error');
        return;
    }
    
    try {
        for (let i = 0; i < count; i++) {
            await anonteamAPI.generateLicenseKey(productId, duration);
        }
        showNotification(`Successfully generated ${count} keys (${duration} days)`, 'success');
        loadGeneratedKeys();
    } catch (error) {
        console.error('Error generating keys:', error);
        showNotification('Failed to generate keys', 'error');
    }
}

// Generate subscription key
function generateSubscriptionKey(cheatName, duration) {
    const prefix = getCheatPrefix(cheatName);
    const keyId = generateRandomKey();
    const fullKey = `${prefix}-${keyId}`;
    
    return {
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        key: fullKey,
        cheat: cheatName,
        duration: duration,
        isUsed: false,
        usedBy: null,
        usedAt: null,
        createdBy: currentUser.name,
        createdAt: new Date().toISOString()
    };
}

// Get cheat prefix for key
function getCheatPrefix(cheatName) {
    const prefixes = {
        'compkiller': 'CK',
        'neverlose': 'NL', 
        'onetap': 'OT',
        'fatality': 'FT'
    };
    return prefixes[cheatName] || 'GEN';
}

// Load key statistics (using database now)
async function loadKeyStats() {
    try {
        const response = await anonteamAPI.getGeneratedKeys();
        if (response.success && response.data) {
            const keys = response.data.keys;
            const totalKeys = keys.length;
            const usedKeys = keys.filter(key => key.is_used).length;
            const availableKeys = totalKeys - usedKeys;
            
            const totalCount = document.getElementById('totalKeysCount');
            const usedCount = document.getElementById('usedKeysCount');
            const availableCount = document.getElementById('availableKeysCount');
            
            if (totalCount) totalCount.textContent = totalKeys;
            if (usedCount) usedCount.textContent = usedKeys;
            if (availableCount) availableCount.textContent = availableKeys;
        }
    } catch (error) {
        console.error('Error loading key stats:', error);
    }
}

// Load generated keys list
async function loadGeneratedKeys() {
    const keysList = document.getElementById('generatedKeysList');
    if (!keysList) {
        return;
    }
    
    keysList.innerHTML = '<div>Loading keys...</div>';
    
    try {
        const response = await anonteamAPI.getGeneratedKeys();
        if (response.success && response.data && response.data.keys.length > 0) {
            keysList.innerHTML = '';
            response.data.keys.forEach(key => {
                const keyItem = document.createElement('div');
                keyItem.className = 'key-item';
                const isUsed = Boolean(key.is_used); // Convert to boolean
                const statusClass = isUsed ? 'used' : 'available';
                const statusText = isUsed ? 'Used' : 'Available';
                const usedInfo = isUsed ? `<div class="key-used-info">Used by: ${key.used_by || 'Unknown'} on ${key.used_at ? new Date(key.used_at).toLocaleString() : 'Unknown date'}</div>` : '';
                
                keyItem.innerHTML = `
                    <div class="key-header">
                        <div class="key-product">${key.display_name}</div>
                        <div class="key-status ${statusClass}">${statusText}</div>
                    </div>
                    <div class="key-code ${isUsed ? 'key-code-used' : ''}">${key.key_code}</div>
                    <div class="key-details">
                        <span class="key-duration">${key.duration_days} days</span>
                        <span class="key-created">Created: ${new Date(key.created_at).toLocaleDateString()}</span>
                    </div>
                    ${usedInfo}
                    <div class="key-actions">
                        <button onclick="copyKey('${key.key_code}')" class="copy-key-btn ${isUsed ? 'copy-key-btn-disabled' : ''}" ${isUsed ? 'disabled' : ''}>${isUsed ? 'Key Used' : 'Copy Key'}</button>
                        ${isUsed ? '<span class="key-invalid-badge">⚠️ Invalid</span>' : ''}
                    </div>
                `;
                keysList.appendChild(keyItem);
            });
        } else {
    keysList.innerHTML = `
        <div class="empty-keys-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" stroke-width="2"/>
                <circle cx="12" cy="16" r="1" fill="currentColor"/>
                <path d="M7 11V7C7 4.79086 9.23858 3 12 3C14.7614 3 17 4.79086 17 7V11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
                    <h4>No License Keys Found</h4>
                    <p>Generate some keys to see them here</p>
        </div>
    `;
        }
    } catch (error) {
        console.error('Error loading generated keys:', error);
        keysList.innerHTML = `
            <div class="error-state">
                <h4>Error Loading Keys</h4>
                <p>${error.message || 'Failed to load license keys'}</p>
            </div>
        `;
    }
}

// Get display name for cheat
function getCheatDisplayName(cheat) {
    const names = {
        'compkiller': 'CS:2 Compkiller',
        'neverlose': 'CS:2 Neverlose',
        'onetap': 'CS:GO Onetap',
        'fatality': 'CS:2 Fatality'
    };
    return names[cheat] || cheat;
}

// Copy key to clipboard
function copyKey(key) {
    // Check if the button is disabled (for used keys)
    const button = event.target;
    if (button.disabled || button.classList.contains('copy-key-btn-disabled')) {
        showNotification('Cannot copy used/invalid key!', 'warning');
        return;
    }
    
    navigator.clipboard.writeText(key).then(() => {
        showNotification('Key copied to clipboard!', 'success');
    }).catch(() => {
        showNotification('Failed to copy key', 'error');
    });
}

// Delete unused key (removed - using database now)
function deleteKey(keyId) {
    showNotification('Key deletion is now managed through the database', 'info');
}

// Key validation (using database now)
async function validateSubscriptionKey(keyCode) {
    try {
        const response = await anonteamAPI.validateLicenseKey(keyCode);
        return response.success ? response.data : null;
    } catch (error) {
        console.error('Error validating key:', error);
        return null;
    }
}

// Use a subscription key (using database now)
async function useSubscriptionKey(keyCode, userEmail) {
    try {
        const response = await anonteamAPI.redeemLicenseKey(keyCode);
        return response.success ? response.data : null;
    } catch (error) {
        console.error('Error using key:', error);
        return null;
    }
}

// Activity logging system (using database now)

// Log activity (using database now)
async function logActivity(type, description, username) {
    try {
        await anonteamAPI.logActivity(type, description, username);
    } catch (error) {
        console.error('Error logging activity:', error);
    }
}

// Load activity logs
async function loadActivityLogs() {
    const logsList = document.getElementById('activityLogsList');
    if (!logsList) return;
    logsList.innerHTML = '<div>Loading...</div>';
    
    try {
        const response = await anonteamAPI.getActivityLogs();
        if (response.success && response.data && response.data.logs.length > 0) {
            logsList.innerHTML = '';
            response.data.logs.forEach(log => {
                const logItem = document.createElement('div');
                logItem.className = 'activity-log-item';
                const icon = getActivityIcon(log.activity_type);
                const timeAgo = getTimeAgo(log.created_at);
                logItem.innerHTML = `
                    <div class="activity-icon ${log.activity_type}">${icon}</div>
                    <div class="activity-details">
                        <div class="activity-title">${getActivityTitle(log.activity_type)}</div>
                        <div class="activity-description">${log.description}</div>
                    </div>
                    <div class="activity-time">${timeAgo}</div>
                `;
                logsList.appendChild(logItem);
            });
        } else {
            logsList.innerHTML = `
                <div class="activity-log-item">
                    <div class="activity-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                            <path d="M12 6V12L16 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                    </div>
                    <div class="activity-details">
                        <div class="activity-title">No activity logs</div>
                        <div class="activity-description">No activities found</div>
                    </div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading activity logs:', error);
        logsList.innerHTML = '<div>Error loading activity logs</div>';
    }
}

// Get activity icon based on type
function getActivityIcon(type) {
    const icons = {
        hwid: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 1L3 5V11C3 16.55 6.84 21.74 12 23C17.16 21.74 21 16.55 21 11V5L12 1Z" stroke="currentColor" stroke-width="2"/></svg>',
        password: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 10V8C6 5.79086 7.79086 4 10 4H14C16.2091 4 18 5.79086 18 8V10C19.1046 10 20 10.8954 20 12V20C20 21.1046 19.1046 22 18 22H6C4.89543 22 4 21.1046 4 20V12C4 10.8954 4.89543 10 6 10Z" stroke="currentColor" stroke-width="2"/></svg>',
        login: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15 3H19C20.1046 3 21 3.89543 21 5V19C21 20.1046 20.1046 21 19 21H15" stroke="currentColor" stroke-width="2"/><path d="M10 17L15 12L10 7" stroke="currentColor" stroke-width="2"/><path d="M15 12H3" stroke="currentColor" stroke-width="2"/></svg>',
        registration: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 21V19C16 16.7909 14.2091 15 12 15H5C2.79086 15 1 16.7909 1 19V21" stroke="currentColor" stroke-width="2"/><circle cx="8.5" cy="7" r="4" stroke="currentColor" stroke-width="2"/><path d="M20 8V14" stroke="currentColor" stroke-width="2"/><path d="M23 11H17" stroke="currentColor" stroke-width="2"/></svg>',
        ban: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M4.93 4.93L19.07 19.07" stroke="currentColor" stroke-width="2"/></svg>',
        subscription: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2"/><path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2"/><path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2"/></svg>',
        key: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 2L19 4L15 8L10.5 13.5L8.5 11.5L9 11L7 9L5 11L13 19L15 17L14 16L18.5 11.5L23 7L21 5L21 2Z" stroke="currentColor" stroke-width="2"/></svg>'
    };
    
    return icons[type] || icons.login;
}

// Get activity title based on type
function getActivityTitle(type) {
    const titles = {
        hwid: 'HWID Reset',
        password: 'Password Change',
        login: 'User Login',
        registration: 'Registration Activity',
        ban: 'Ban Activity',
        subscription: 'Subscription Management',
        key: 'Key Generation'
    };
    
    return titles[type] || 'System Activity';
}

// Real-time activity log updates
let activityLogInterval = null;

function startActivityLogUpdates() {
    // Clear any existing interval
    if (activityLogInterval) {
        clearInterval(activityLogInterval);
    }
    
    // Update activity logs every 10 seconds
    activityLogInterval = setInterval(() => {
        // Only update if we're on the admin panel and activity logs tab is active
        const adminView = document.getElementById('adminView');
        const activityPanel = document.getElementById('activityPanel');
        if (adminView && adminView.classList.contains('active') && 
            activityPanel && activityPanel.classList.contains('active')) {
            loadActivityLogs();
        }
    }, 10000); // 10 seconds
}

function stopActivityLogUpdates() {
    if (activityLogInterval) {
        clearInterval(activityLogInterval);
        activityLogInterval = null;
    }
}

// Remove subscription from user
function removeSubscriptionFromUser(userEmail, cheatName) {
    const userIndex = registeredUsers.findIndex(user => user.email === userEmail);
    if (userIndex !== -1) {
        const user = registeredUsers[userIndex];
        let removed = false;
        
        // Remove from user.subscriptions if it exists
        if (user.subscriptions && user.subscriptions[cheatName]) {
            delete user.subscriptions[cheatName];
            removed = true;
        }
        
        // Remove from global userSubscriptions if this is the current user
        if (currentUser && currentUser.email === userEmail && userSubscriptions[cheatName]) {
            userSubscriptions[cheatName].active = false;
            userSubscriptions[cheatName].expiry = null;
            userSubscriptions[cheatName].status = 'inactive';
            localStorage.setItem('anonteamUserSubscriptions', JSON.stringify(userSubscriptions));
            removed = true;
        }
        
        if (removed) {
            // Update localStorage
            localStorage.setItem('anonteamRegisteredUsers', JSON.stringify(registeredUsers));
            
            // Update current user if it's the same user
            if (currentUser && currentUser.email === userEmail) {
                currentUser = user;
                localStorage.setItem('anonteamUser', JSON.stringify(currentUser));
            }
            
            // Log activity
            logActivity('subscription', `Subscription removed: ${getCheatDisplayName(cheatName)} for ${user.name}`, currentUser.name);
            
            showNotification(`Subscription removed: ${getCheatDisplayName(cheatName)} for ${user.name}`, 'success');
            
            // Refresh admin users list and subscription UI
            loadAdminUsers();
            updateSubscriptionUI();
            
            return true;
        }
    }
    return false;
}

// Load subscription management
function loadSubscriptionManagement() {
    const subscriptionsPanel = document.getElementById('subscriptionsPanel');
    
    if (!subscriptionsPanel) return;
    
    let html = `
        <div class="admin-section">
            <h3>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2"/>
                    <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2"/>
                    <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2"/>
                </svg>
                User Subscriptions
            </h3>
            <div class="users-list">
    `;
    
    let hasSubscriptions = false;
    
    // Check all registered users for active subscriptions
    registeredUsers.forEach(user => {
        const userActiveSubscriptions = [];
        
        // Check if this user has any active subscriptions 
        // For current logged-in user, check their userSubscriptions
        if (currentUser && user.email === currentUser.email) {
            Object.entries(userSubscriptions).forEach(([cheatName, subscription]) => {
                if (subscription.active && subscription.expiry) {
                    const expiry = new Date(subscription.expiry);
                    const now = new Date();
                    if (expiry > now) {
                        userActiveSubscriptions.push({ cheatName, subscription });
                    }
                }
            });
        }
        
        // Also check user.subscriptions if it exists (for other users)
        if (user.subscriptions && Object.keys(user.subscriptions).length > 0) {
            Object.entries(user.subscriptions).forEach(([cheatName, subscription]) => {
                if (subscription.active && subscription.expiry) {
                    const expiry = new Date(subscription.expiry);
                    const now = new Date();
                    if (expiry > now) {
                        userActiveSubscriptions.push({ cheatName, subscription });
                    }
                }
            });
        }
        
        if (userActiveSubscriptions.length > 0) {
            hasSubscriptions = true;
            const accountType = user.accountType || getUserAccountType(user.name);
            const accountColors = getAccountTypeColor(accountType);
            const isGradient = accountType === 'femboy';
            
            html += `
                <div class="user-item">
                    <div class="user-info">
                        <img class="user-avatar" src="${user.profilePicture || getDefaultAvatar()}" alt="${user.name}" />
                        <div class="user-details">
                            <div class="user-name" style="${isGradient ? `background: ${accountColors.color}; -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;` : `color: ${accountColors.color};`}">${user.name}</div>
                            <div class="user-email">${user.email}</div>
                            <div class="user-uid">UID: ${user.id || 'No ID'}</div>
                        </div>
                    </div>
                    <div class="user-actions" style="flex-direction: column; align-items: flex-end; gap: 8px;">
            `;
            
            userActiveSubscriptions.forEach(({ cheatName, subscription }) => {
                const expiry = new Date(subscription.expiry);
                const now = new Date();
                const daysLeft = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
                const cheatLogos = {
                    'compkiller': '/assets/compkiller-logo.png',
                    'neverlose': '/assets/neverlose-logo.png', 
                    'onetap': '/assets/onetap-logo.png',
                    'fatality': '/assets/fatality-logo.png'
                };
                
                html += `
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px; padding: 8px; background: #2a2a2a; border-radius: 8px; border: 1px solid #333;">
                        <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
                            <div style="width: 24px; height: 24px; background: #1a1a1a; border-radius: 4px; display: flex; align-items: center; justify-content: center; border: 1px solid #444;">
                                <span style="font-size: 10px; font-weight: bold; color: #4f46e5;">${cheatName.substring(0, 2).toUpperCase()}</span>
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 2px;">
                                <span style="color: #ffffff; font-weight: 600; font-size: 13px;">${getCheatDisplayName(cheatName)}</span>
                                <span style="color: #888; font-size: 11px;">${daysLeft} days remaining</span>
                            </div>
                        </div>
                        <button class="admin-btn ban-btn" style="padding: 6px 10px; font-size: 11px;" onclick="removeSubscriptionConfirm('${user.email}', '${cheatName}', '${user.name}')">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                                <path d="M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            </svg>
                            Remove
                        </button>
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        }
    });
    
    if (!hasSubscriptions) {
        html += `
            <div class="activity-log-item" style="text-align: center; padding: 40px;">
                <div class="activity-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2"/>
                        <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2"/>
                        <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2"/>
                    </svg>
                </div>
                <div class="activity-details">
                    <div class="activity-title">No Active Subscriptions</div>
                    <div class="activity-description">No users currently have active subscriptions</div>
                </div>
            </div>
        `;
    }
    
    html += `
            </div>
        </div>
    `;
    
    subscriptionsPanel.innerHTML = html;
}

// Confirm subscription removal
function removeSubscriptionConfirm(userEmail, cheatName, userName) {
    const cheatDisplayName = getCheatDisplayName(cheatName);
    
    if (confirm(`Are you sure you want to remove ${cheatDisplayName} subscription from ${userName}?`)) {
        if (removeSubscriptionFromUser(userEmail, cheatName)) {
            loadSubscriptionManagement(); // Refresh the list
        } else {
            showNotification('Failed to remove subscription', 'error');
        }
    }
}

// HWID Reset tracking (user-specific)
let userHwidResets = JSON.parse(localStorage.getItem('anonteamUserHwidResets') || '{}');

// User registration system
let registeredUsers = JSON.parse(localStorage.getItem('anonteamRegisteredUsers') || '[]');
let usedInviteCodes = JSON.parse(localStorage.getItem('anonteamUsedInviteCodes') || '[]');

// Valid invite codes (dynamically managed)
let validInviteCodes = JSON.parse(localStorage.getItem('anonteamValidInviteCodes') || '[]');

// User subscriptions system
let userSubscriptions = {
    compkiller: { active: false, expiry: null, status: 'frozen' },
    neverlose: { active: false, expiry: null, status: 'broken' },
    onetap: { active: false, expiry: null, status: 'inactive' },
    fatality: { active: false, expiry: null, status: 'inactive' }
};

// Frozen products list (products that are temporarily unavailable)
const frozenProducts = ['compkiller'];

// Broken products list (products that are currently under maintenance)
const brokenProducts = ['neverlose'];

// Check if a product is frozen - now uses unified system
function isProductFrozen(cheatName) {
    return window.productStateManager ? window.productStateManager.isProductFrozen(cheatName) : false;
}

// Check if a product is broken - now uses unified system
function isProductBroken(cheatName) {
    return window.productStateManager ? window.productStateManager.isProductBroken(cheatName) : false;
}


// Download URLs for each cheat
const downloadUrls = {
    compkiller: 'https://example.com/downloads/compkiller-loader.exe',
    neverlose: 'https://example.com/downloads/neverlose-loader.exe', 
    onetap: 'https://example.com/downloads/onetap-loader.exe',
    fatality: 'https://example.com/downloads/fatality-loader.exe'
};

// Initialize app
document.addEventListener('DOMContentLoaded', async function() {
    // Check for URL parameters (like login required from checkout)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('login_required') === '1') {
        setTimeout(() => {
            showNotification('Please log in to access the checkout page', 'warning');
            // Clear the URL parameter
            window.history.replaceState({}, document.title, window.location.pathname);
        }, 500);
    }
    
    // Check if user is already logged in (check both old and new keys)
    const savedUser = localStorage.getItem('anonteamCurrentUser') || localStorage.getItem('anonteamUser');
    const savedToken = localStorage.getItem('anonteamSessionToken');
    
    if (savedUser && savedToken) {
        currentUser = JSON.parse(savedUser);
        
        // Ensure consistent storage
        localStorage.setItem('anonteamCurrentUser', JSON.stringify(currentUser));
        if (localStorage.getItem('anonteamUser')) {
            localStorage.removeItem('anonteamUser'); // Remove old key
        }
        
        // Update sidebar username immediately
        const sidebarUsername = document.getElementById('sidebarUsername');
        if (sidebarUsername) {
            sidebarUsername.textContent = currentUser.username || currentUser.name || 'User';
        }
        
        // Restore session token to API client
        if (window.anonteamAPI) {
            window.anonteamAPI.setSessionToken(savedToken);
        }
        
        // Add slight delay to ensure smooth transition for returning users
        setTimeout(() => {
            showDashboard();
        }, 100);
    } else {
        // Clear any partial data if either user or token is missing
            localStorage.removeItem('anonteamUser');
        localStorage.removeItem('anonteamCurrentUser');
        if (!savedUser && savedToken) {
            localStorage.removeItem('anonteamSessionToken');
        }
        
        // Initialize Vanta Waves on login page
        initVantaWaves();
    }
    
    setupEventListeners();
    initializeDefaultAvatars(); // Initialize all default avatar images
    generateLicenseKeys();
    loadGeneratedKeys();
    loadUserSubscriptions();
    await initializeProductStates(); // Initialize product states
    
    // Initialize purchase manager - DISABLED - Using checkout.html instead
    // purchaseManager = new PurchaseManager();
    // purchaseManager.init();
    
    // Update UI after loading subscriptions
    setTimeout(() => {
        updateSubscriptionUI();
    }, 100);
    
    // Add image loading debug for subscription icons
    const subscriptionImages = document.querySelectorAll('.sub-icon img');
    subscriptionImages.forEach((img, index) => {
        const originalSrc = img.src;
        
        img.addEventListener('load', () => {
            
        });
        
        img.addEventListener('error', () => {
            console.error(`Failed to load image ${index}:`, originalSrc);
            // Try alternative path
            const altSrc = originalSrc.replace('images/', './images/');
            if (img.src !== altSrc) {
                
                img.src = altSrc;
            }
        });
    });
});

// Event Listeners
function setupEventListeners() {
    // Tab switching
    loginTab.addEventListener('click', () => switchTab('login'));
    signupTab.addEventListener('click', () => switchTab('signup'));
    
    // Form submissions
    loginForm.addEventListener('submit', handleLogin);
    signupForm.addEventListener('submit', handleSignup);
    
    // Logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
    
            handleLogout(e);
        });
    } else {
        console.error('Logout button not found!');
    }
    
    // Password toggle functionality
    setupPasswordToggles();
    
    // Form switching links
    setupFormSwitching();
    
    // Setup security form
    setupSecurityForm();
    
    // Dashboard interactions
    setupDashboardInteractions();
    
    // Setup comment form functionality (once)
    setupCommentForm();
    
    // Setup ASCII input filtering
    setupASCIIFiltering();
    
    // SECURITY: Hidden command system removed
    
    // Setup mobile sidebar toggle
    setupMobileSidebar();
}

// Tab switching functionality
function switchTab(tab) {
    if (tab === 'login') {
        loginTab.classList.add('active');
        signupTab.classList.remove('active');
        loginForm.classList.add('active');
        signupForm.classList.remove('active');
    } else {
        signupTab.classList.add('active');
        loginTab.classList.remove('active');
        signupForm.classList.add('active');
        loginForm.classList.remove('active');
    }
}

    // Handle login with API
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    if (!email || !password) {
        showNotification('Please fill in all fields', 'error');
        return;
    }
    
    try {
    showLoadingScreen();
    
        const response = await anonteamAPI.login(email, password);
        
        if (response.success) {
            currentUser = response.data.user;
        
            localStorage.setItem('anonteamCurrentUser', JSON.stringify(currentUser));
            
            // Trigger unified system initialization
            window.dispatchEvent(new CustomEvent('userLoggedIn', { 
                detail: { user: currentUser } 
            }));
                
            // Refresh shoutbox if it exists
            if (window.shoutboxManager) {
                window.shoutboxManager.refreshForNewUser();
            }
            
            showNotification(`Welcome back, ${currentUser.username || currentUser.name}!`, 'success');
                    showDashboard();
            
            // Initialize admin panel if user is admin
            if (isAdmin()) {
                initializeAdminPanel();
            }
        } else {
            showNotification(response.message, 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        
        // Check if this is a banned user error
        if (error.banned || (error.statusCode === 403 && error.data?.banned)) {
            const banData = error.data || {};
            showBanPopup(
                banData.ban_reason || banData.banReason || 'No reason provided',
                banData.banned_by || banData.bannedBy || 'Unknown',
                banData.banned_at || banData.bannedAt || new Date().toISOString()
            );
        } else {
            showNotification(error.message || 'Login failed. Please try again.', 'error');
        }
    } finally {
        hideLoadingScreen();
    }
}

// Handle signup with API
async function handleSignup(e) {
    e.preventDefault();
    
    const username = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const inviteCode = document.getElementById('signupInviteCode').value;
    
    // Validation
    if (!username || !email || !password || !inviteCode) {
        showNotification('Please fill all fields', 'error');
        return;
    }
    
    if (password.length < 6) {
        showNotification('Password must be at least 6 characters', 'error');
        return;
    }
    
    // Validate invite code format (XXXX-XXXX-XXXX)
    const inviteCodePattern = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
    if (!inviteCodePattern.test(inviteCode.toUpperCase())) {
        showNotification('Invalid invitation code format. Use format: ABCD-EFGH-IJKL', 'error');
        return;
    }
    
    // ASCII validation
    if (!isValidName(username)) {
        if (username.length < 3) {
            showNotification('Username must be at least 3 characters long.', 'error');
        } else {
        showNotification('Username contains invalid characters. Only letters, numbers, spaces, dots, hyphens, and underscores allowed.', 'error');
        }
        return;
    }
    
    if (!isValidEmail(email)) {
        showNotification('Email contains invalid characters. Only standard ASCII characters allowed.', 'error');
        return;
    }
    
    if (!isValidPassword(password)) {
        showNotification('Password contains invalid characters. Only standard ASCII characters allowed.', 'error');
        return;
    }
    
    // Show loading screen with skull animation
    showLoadingScreen();
    
    try {
        // Use the API to register
        const response = await fetch('api/auth_endpoints.php?action=register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                username: username,
                email: email, 
                password: password,
                invite_code: inviteCode.toUpperCase()
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('Registration successful! Please log in.', 'success');
            
            // Switch to login tab
            switchTab('login');
            
            // Clear signup form
            document.getElementById('signupForm').reset();
            
        } else {
            showNotification(result.message || 'Registration failed', 'error');
        }
        
    } catch (error) {
        console.error('Registration error:', error);
        showNotification('Registration failed. Please try again.', 'error');
    } finally {
        hideLoadingScreen();
    }
}

// Handle logout with API
async function handleLogout() {
    // Clean up ban popup if active
    const banPopup = document.getElementById('banPopup');
    if (banPopup && banPopup.style.display !== 'none') {
        // Clear any active countdown interval
        if (banPopup.countdownInterval) {
            clearInterval(banPopup.countdownInterval);
            banPopup.countdownInterval = null;
        }
        // Hide popup and re-enable interactions
        banPopup.style.display = 'none';
        document.body.classList.remove('ban-popup-active');
    }
    
    // Clean up ban timer from localStorage if user exists
    if (currentUser) {
        const banTimerKey = `banTimer_${currentUser.email}`;
        localStorage.removeItem(banTimerKey);
    }
    
    // Call API to logout
    const sessionToken = localStorage.getItem('anonteamSessionToken');
    if (sessionToken) {
        try {
            await fetch('api/auth_endpoints.php?action=logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + sessionToken
                }
            });
        } catch (error) {
            console.error('Logout API error:', error);
        }
    }
    
    // Clear local data and reset image elements
    currentUser = null;
    viewedUser = null; // Reset viewed user when logging out
    localStorage.removeItem('anonteamUser');
    localStorage.removeItem('anonteamCurrentUser');
    localStorage.removeItem('anonteamSessionToken');
    
    // Clear cached images from DOM to prevent persistence
    const profileImage = document.getElementById('profileImage');
    const bannerImage = document.getElementById('bannerImage');
    const bannerUpload = document.getElementById('bannerUpload');
    
    if (profileImage) {
        profileImage.src = getDefaultAvatar();
    }
    
    if (bannerImage && bannerUpload) {
        bannerImage.style.display = 'none';
        bannerImage.src = '';
        bannerUpload.style.display = 'block';
    }
    
    // Clear profile background
    const sidebarHeader = document.querySelector('.sidebar-header');
    if (sidebarHeader) {
        sidebarHeader.style.removeProperty('--profile-bg');
    }

    // Refresh shoutbox to remove "YOU" badges
    if (window.shoutboxManager) {
        window.shoutboxManager.renderShouts();
    }

    setTimeout(showLogin, 500);
}

// Show dashboard
function showDashboard() {
    loginPage.classList.remove('active');
    loginPage.classList.remove('fade-out');
    dashboard.classList.add('active');
    
    // Add fade-in animation
    const dashboardLayout = document.querySelector('.dashboard-layout');
    if (dashboardLayout) {
        // Ensure it starts hidden, then fade in
        dashboardLayout.classList.remove('fade-in');
        setTimeout(() => {
            dashboardLayout.classList.add('fade-in');
        }, 50);
    }
    
    if (currentUser) {
        sidebarUsername.textContent = currentUser.username || currentUser.name || 'User';
        sidebarUID.textContent = currentUser.id || 'N/A';
        
        // Update join date if available
        if (currentUser.joinDate && joinDate) {
            joinDate.textContent = currentUser.joinDate;
        }
        
        // Clear any existing image data first to prevent persistence from previous accounts
        const profileImage = document.getElementById('profileImage');
        const bannerImage = document.getElementById('bannerImage');
        const bannerUpload = document.getElementById('bannerUpload');
        const sidebarHeader = document.querySelector('.sidebar-header');
        
        // Reset profile image to default first
        if (profileImage) {
            profileImage.src = getDefaultAvatar();
        }
        
        // Reset banner to default first
        if (bannerImage && bannerUpload) {
            bannerImage.style.display = 'none';
            bannerImage.src = '';
            bannerUpload.style.display = 'block';
        }
        
        // Clear profile background
        if (sidebarHeader) {
            sidebarHeader.style.removeProperty('--profile-bg');
        }
        
        // Now load current user's images from database (if they exist)
        const profilePicture = currentUser.profileImage || currentUser.profile_image;
        
        if (profileImage && profilePicture) {
            profileImage.src = profilePicture;
            
            // Set profile background with opacity
            if (sidebarHeader) {
                sidebarHeader.style.setProperty('--profile-bg', `url(${profilePicture})`);
            }
            
            // Update currentUser object to maintain consistency (use camelCase as primary)
            currentUser.profileImage = profilePicture;
            currentUser.profilePicture = profilePicture; // Keep legacy for compatibility
        }
        
        // Load saved banner if it exists (from database fields)
        const bannerSrc = currentUser.bannerImage || currentUser.banner_image;
        
        if (bannerImage && bannerUpload && bannerSrc) {
            bannerImage.src = bannerSrc;
            bannerImage.style.display = 'block';
            bannerUpload.style.display = 'none';
            
            // Update currentUser object to maintain consistency (use camelCase as primary)
            currentUser.bannerImage = bannerSrc;
            currentUser.banner = bannerSrc; // Keep legacy for compatibility
        }
        
        // Set join date to current date
        const joinDateObj = new Date();
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        joinDate.textContent = joinDateObj.toLocaleDateString('en-US', options);
        
        // Update all avatars for the new user
        setTimeout(() => {
            updateAllAvatars();
        }, 100);
        
        // Ban check is already handled in login flow - no need to check again here
    }
    
    // Load HWID reset status
    loadHwidResetStatus();
    
    // Setup admin panel after DOM is ready (dashboard interactions already called above)
    setTimeout(() => {
        // Update admin visibility and initialize admin panel after DOM is ready
        updateAdminVisibility();
        if (isAdmin()) {
            initializeAdminPanel();
            setTimeout(() => updateProductStatusCards(), 200); // Update admin product cards
            
            // Force show admin nav item directly
            const adminNavItem = document.querySelector('.nav-item[data-section="admin"]');
            if (adminNavItem) {
                adminNavItem.style.display = 'flex';

            } else {

            }
        }
    }, 100);
    
    // Animate status bars
    setTimeout(animateStatusBars, 500);
}

// Show login page
function showLogin() {
    dashboard.classList.remove('active');
    loginPage.classList.remove('fade-out');
    loginPage.classList.add('active');
    
    // Reset dashboard animation
    const dashboardLayout = document.querySelector('.dashboard-layout');
    if (dashboardLayout) {
        dashboardLayout.classList.remove('fade-in');
    }
    
    // Reset forms
    loginForm.reset();
    signupForm.reset();
    
    // Reinitialize Vanta Waves
    setTimeout(initVantaWaves, 100);
}

// Dashboard interactions
let dashboardInteractionsSetup = false;
function setupDashboardInteractions() {
    // Prevent duplicate setup
    if (dashboardInteractionsSetup) {

        return;
    }
    dashboardInteractionsSetup = true;

    
    // Key activation button
    const activateBtn = document.querySelector('.activate-btn');
    if (activateBtn) {
        activateBtn.addEventListener('click', redeemLicenseKey);
    }
    
    // HWID reset button
    const hwidResetBtn = document.getElementById('hwidResetBtn');
    if (hwidResetBtn) {
        hwidResetBtn.addEventListener('click', requestHwidReset);
    }
    
    // Extend subscription button
    const extendBtn = document.querySelector('.extend-btn');
    if (extendBtn) {
        extendBtn.addEventListener('click', extendSubscription);
    }
    
    // Download buttons (lightning icons)
    setupDownloadButtons();

    // Navigation items - Enhanced with profile and shoutbox
    const subscriptionsNav = document.querySelector('[data-section="subscriptions"]');
    const profileNav = document.querySelector('[data-section="profile"]');
    const shoutboxNav = document.querySelector('[data-section="shoutbox"]');
    const securityNav = document.querySelector('[data-section="security"]');
    const adminNav = document.querySelector('[data-section="admin"]');
    const subscriptionsView = document.getElementById('subscriptionsView');
    const profileView = document.getElementById('profileView');
    const shoutboxView = document.getElementById('shoutboxView');
    const securityView = document.getElementById('securityView');
    const adminView = document.getElementById('adminView');
    
    
    
    // Function to switch views
    function switchToView(targetView, activeNav) {
        // Stop activity log updates if leaving admin panel
        if (targetView !== adminView) {
            stopActivityLogUpdates();
        }
        
        // Hide all views
        [subscriptionsView, profileView, shoutboxView, securityView, adminView].forEach(view => {
            if (view) {
                view.classList.remove('active');
                // For non-admin views, use inline display
                if (!view.classList.contains('admin-only')) {
                    view.style.display = 'none';
                }
            }
        });
        
        // Remove active class from all nav items
        [subscriptionsNav, profileNav, shoutboxNav, securityNav, adminNav].forEach(nav => {
            if (nav) nav.classList.remove('active');
        });
        
        // Show target view and activate nav
        if (targetView) {
            targetView.classList.add('active');
            // For non-admin views, use inline display
            if (!targetView.classList.contains('admin-only')) {
                targetView.style.display = 'block';
            }
        }
        if (activeNav) activeNav.classList.add('active');
        
        // Close mobile sidebar if open
        const sidebar = document.querySelector('.sidebar');
        if (window.innerWidth <= 768 && sidebar && sidebar.classList.contains('mobile-visible')) {
            setTimeout(() => {
                sidebar.classList.remove('mobile-visible');
                document.body.style.overflow = '';
            }, 300);
        }
    }
    
    if (subscriptionsNav && profileNav && shoutboxNav && securityNav && subscriptionsView && profileView && shoutboxView && securityView) {
        // Show subscriptions by default
        switchToView(subscriptionsView, subscriptionsNav);
        
        subscriptionsNav.addEventListener('click', (e) => {

            e.preventDefault();
            e.stopPropagation();
            document.body.classList.remove('security-active');
            document.body.classList.remove('profile-active');
            switchToView(subscriptionsView, subscriptionsNav);
        });
        
        profileNav.addEventListener('click', (e) => {

            e.preventDefault();
            e.stopPropagation();
            document.body.classList.remove('security-active');
            document.body.classList.add('profile-active');
            switchToView(profileView, profileNav);
            viewedUser = null; // Reset viewed user when clicking Profile nav directly
            updateProfileView(); // This will show current user's profile (no targetUsername)
        });
        
        shoutboxNav.addEventListener('click', (e) => {

            e.preventDefault();
            e.stopPropagation();
            document.body.classList.remove('security-active');
            document.body.classList.remove('profile-active');
            switchToView(shoutboxView, shoutboxNav);
            
            // Initialize/refresh shoutbox when entered
            if (shoutboxManager) {
                shoutboxManager.refreshForNewUser();
            } else {
                setTimeout(() => {
                    shoutboxManager = new ShoutboxManager();
                    window.shoutboxManager = shoutboxManager; // Make it globally accessible
                }, 100);
            }
        });
        
        securityNav.addEventListener('click', (e) => {

            e.preventDefault();
            e.stopPropagation();
            document.body.classList.add('security-active');
            document.body.classList.remove('profile-active');
            switchToView(securityView, securityNav);
        });
        
        // Admin navigation (always set up, check permissions on click)
        if (adminNav) {
            adminNav.addEventListener('click', (e) => {
    
                e.preventDefault();
                e.stopPropagation();
                
                // Check admin permissions before allowing access
                if (!isAdmin()) {
                    showNotification('You do not have admin permissions', 'error');
                    return;
                }
                
                document.body.classList.remove('security-active');
                document.body.classList.remove('profile-active');
                switchToView(adminView, adminNav);
                
                // Refresh admin data when entering
                    loadAdminUsers();
                    loadBannedUsers();
                    loadSubscriptionManagement();
                    startActivityLogUpdates();
            });
        }
        
        // Make username clickable to go to profile
        const usernameElement = document.getElementById('sidebarUsername');
        if (usernameElement) {
            usernameElement.addEventListener('click', (e) => {

                e.preventDefault();
                e.stopPropagation();
                document.body.classList.remove('security-active');
                document.body.classList.add('profile-active');
                switchToView(profileView, profileNav);
                updateProfileView();
                
                // Simulate URL change for profile page
                if (currentUser) {
                    const profileUrl = `https://domain.com/profile/user/${currentUser.name || currentUser.username}`;
    
        
                }
            });
        }
    } else {
        console.error('Navigation elements not found:', {
            subscriptionsNav, profileNav, shoutboxNav, securityNav, subscriptionsView, profileView, shoutboxView, securityView
        });
    }
    
    // Image compression and validation utilities
    function compressImage(file, maxSizeKB = 500, quality = 0.8, forceSquare = false) {
        return new Promise((resolve, reject) => {
            // Enhanced validation
            if (!file) {
                reject(new Error('No file provided'));
                return;
            }
            
            if (!file.type.startsWith('image/')) {
                reject(new Error('File is not an image'));
                return;
            }
            
            // Try FileReader first for better compatibility
            const reader = new FileReader();
            
            reader.onload = function(e) {
                const img = new Image();
                
                // Add timeout to prevent hanging
                const timeout = setTimeout(() => {
                    reject(new Error('Image processing timeout - try a smaller image'));
                }, 30000);
                
                img.onload = function() {
                    clearTimeout(timeout);
                    
                    try {
                        // Check if image is valid
                        if (img.naturalWidth === 0 || img.naturalHeight === 0) {
                            reject(new Error('Invalid or corrupted image file'));
                            return;
                        }
                        
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        
                        if (!ctx) {
                            reject(new Error('Canvas not supported in this browser'));
                            return;
                        }
                        
                        // Limit maximum dimensions to prevent memory issues
                        if (img.width > 4000 || img.height > 4000) {
                            reject(new Error('Image is too large. Please use an image smaller than 4000x4000 pixels.'));
                            return;
                        }
                        
                        // For profile pictures, always create square canvas
                        if (forceSquare) {
                            const targetSize = 600; // Fixed size for profile pictures
                            canvas.width = targetSize;
                            canvas.height = targetSize;
                        } else {
                            // For banners, calculate dimensions normally
                            let { width, height } = img;
                            const maxDimension = 800;
                            
                            if (width > height) {
                                if (width > maxDimension) {
                                    height = (height * maxDimension) / width;
                                    width = maxDimension;
                                }
                            } else {
                                if (height > maxDimension) {
                                    width = (width * maxDimension) / height;
                                    height = maxDimension;
                                }
                            }
                            
                            canvas.width = Math.round(width);
                            canvas.height = Math.round(height);
                        }
                        
                        // Set better image rendering
                        ctx.imageSmoothingEnabled = true;
                        ctx.imageSmoothingQuality = 'high';
                        
                        if (forceSquare) {
                            // For profile pictures: create a perfect square crop
                            const sourceSize = Math.min(img.width, img.height);
                            const sourceX = (img.width - sourceSize) / 2;
                            const sourceY = (img.height - sourceSize) / 2;
                            
                            // Fill background with white for JPEG
                            ctx.fillStyle = '#FFFFFF';
                            ctx.fillRect(0, 0, canvas.width, canvas.height);
                            
                            // Draw square crop perfectly centered
                            ctx.drawImage(
                                img,
                                sourceX, sourceY, sourceSize, sourceSize,  // Source: center square from original
                                0, 0, canvas.width, canvas.height          // Target: full canvas (already square)
                            );
                        } else {
                            // For banners: maintain aspect ratio and fit within bounds
                            const imgAspect = img.width / img.height;
                            const canvasAspect = canvas.width / canvas.height;
                            
                            let drawWidth, drawHeight, drawX, drawY;
                            
                            if (imgAspect > canvasAspect) {
                                // Image is wider - fit to canvas width
                                drawWidth = canvas.width;
                                drawHeight = drawWidth / imgAspect;
                                drawX = 0;
                                drawY = (canvas.height - drawHeight) / 2;
                            } else {
                                // Image is taller - fit to canvas height
                                drawHeight = canvas.height;
                                drawWidth = drawHeight * imgAspect;
                                drawX = (canvas.width - drawWidth) / 2;
                                drawY = 0;
                            }
                            
                            // Fill background with white for JPEG
                            ctx.fillStyle = '#FFFFFF';
                            ctx.fillRect(0, 0, canvas.width, canvas.height);
                            
                            // Draw image maintaining aspect ratio
                            ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
                        }
                        
                        // Try different quality levels until size is acceptable
                        const tryCompress = (currentQuality) => {
                            try {
                                // Add memory check before compression
                                if (performance.memory && performance.memory.usedJSHeapSize > 50 * 1024 * 1024) {
                                    reject(new Error('Insufficient memory for image processing. Please try a smaller image.'));
                                    return;
                                }
                                
                                const compressedDataUrl = canvas.toDataURL('image/jpeg', currentQuality);
                                
                                // Validate compression result
                                if (!compressedDataUrl || compressedDataUrl === 'data:,' || compressedDataUrl.length < 100) {
                                    reject(new Error('Image compression failed - invalid result'));
                                    return;
                                }
                                
                                const sizeKB = (compressedDataUrl.length * 0.75) / 1024; // Rough base64 size
                                
                                if (sizeKB <= maxSizeKB || currentQuality <= 0.2) {
                                    resolve(compressedDataUrl);
                                } else if (currentQuality > 0.2) {
                                    // Reduce quality more gradually to prevent artifacts
                                    setTimeout(() => tryCompress(Math.max(0.2, currentQuality - 0.05)), 10);
                                } else {
                                    // Final fallback to PNG
                                    const pngDataUrl = canvas.toDataURL('image/png');
                                    const pngSizeKB = (pngDataUrl.length * 0.75) / 1024;
                                    
                                    if (pngSizeKB <= maxSizeKB * 1.5) {
                                        resolve(pngDataUrl);
                                    } else {
                                        reject(new Error('Unable to compress image to required size. Please use a smaller image.'));
                                    }
                                }
                            } catch (compressionError) {
                                console.error('Compression error:', compressionError);
                                reject(new Error('Image compression failed: ' + compressionError.message));
                            }
                        };
                        
                        tryCompress(quality);
                        
                    } catch (processingError) {
                        clearTimeout(timeout);
                        console.error('Image processing error:', processingError);
                        reject(new Error('Image processing failed: ' + processingError.message));
                    }
                };
                
                img.onerror = function(errorEvent) {
                    clearTimeout(timeout);
                    console.error('Image load error details:', errorEvent);
                    reject(new Error('Unable to load image. The file may be corrupted, in an unsupported format, or too large.'));
                };
                
                // Set the image source to trigger loading
                img.src = e.target.result;
            };
            
            reader.onerror = function(readerError) {
                console.error('FileReader error:', readerError);
                reject(new Error('Unable to read file. Please try a different image.'));
            };
            
            // Read the file as data URL
            try {
                reader.readAsDataURL(file);
            } catch (readError) {
                console.error('File read error:', readError);
                reject(new Error('Failed to read image file: ' + readError.message));
            }
        });
    }

    function validateImageFile(file) {
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        const maxSize = 10 * 1024 * 1024; // 10MB original file limit
        
        if (!validTypes.includes(file.type)) {
            throw new Error('Please select a valid image file (JPEG, PNG, GIF, or WebP)');
        }
        
        if (file.size > maxSize) {
            throw new Error('Image file too large. Please select an image under 10MB');
        }
        
        return true;
    }


    
    // Profile picture upload
    const profileAvatar = document.getElementById('profileAvatar');
    const profileUpload = document.getElementById('profileUpload');
    const profileImage = document.getElementById('profileImage');
    
    if (profileAvatar && profileUpload && profileImage) {
        profileAvatar.addEventListener('click', () => {
            if (currentUser) {
                profileUpload.click();
            }
        });
        
        profileUpload.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    // Basic file validation
                    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
                    if (!validTypes.includes(file.type)) {
                        throw new Error('Please select a valid image file (JPEG, PNG, GIF, or WebP)');
                    }
                    
                    if (file.size > 50 * 1024 * 1024) { // 50MB limit
                        throw new Error('Image file too large. Please select an image under 50MB');
                    }
                    
                    showNotification('Uploading image...', 'info');
                    
                    // Convert to base64 directly (no compression)
                    const reader = new FileReader();
                    reader.onload = async function(e) {
                        const imageUrl = e.target.result;
                        
                        // Update UI immediately
                        profileImage.src = imageUrl;
                        
                        // Set profile background with opacity
                        const sidebarHeader = document.querySelector('.sidebar-header');
                        if (sidebarHeader) {
                            sidebarHeader.style.setProperty('--profile-bg', `url(${imageUrl})`);
                        }
                        
                        // Save image to database
                        if (currentUser) {
                            try {
                                await anonteamAPI.updateProfileImage(imageUrl);
                                
                                // Update local data after successful API save
                                currentUser.profileImage = imageUrl;
                                currentUser.profilePicture = imageUrl; // Keep legacy compatibility
                                localStorage.setItem('anonteamCurrentUser', JSON.stringify(currentUser));
                            
                            // Also update the registered users array
                            const userIndex = registeredUsers.findIndex(user => user.email === currentUser.email);
                            if (userIndex !== -1) {
                                    registeredUsers[userIndex].profilePicture = imageUrl;
                                localStorage.setItem('anonteamRegisteredUsers', JSON.stringify(registeredUsers));
                            }
                            
                            showNotification('Profile picture updated successfully!', 'success');
                            } catch (error) {
                                console.error('Failed to update profile picture:', error);
                                showNotification('Failed to update profile picture: ' + error.message, 'error');
                                // Revert the image on error
                                const previousImage = currentUser.profileImage || currentUser.profilePicture;
                                profileImage.src = previousImage || getDefaultAvatar();
                            }
                        }
                    };
                    
                    reader.onerror = function() {
                        showNotification('Failed to read image file', 'error');
                    };
                    
                    reader.readAsDataURL(file);
                    
                } catch (error) {
                    showNotification(error.message, 'error');
                }
            }
        });
    }
    
    // Banner upload
    const bannerBackground = document.getElementById('bannerBackground');
    const bannerUpload = document.getElementById('bannerUpload');
    const bannerFileInput = document.getElementById('bannerFileInput');
    const bannerImage = document.getElementById('bannerImage');
    
    if (bannerBackground && bannerFileInput && bannerImage) {
        bannerBackground.addEventListener('click', () => {
            if (currentUser) {
                bannerFileInput.click();
            }
        });
        
        bannerFileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    // Basic file validation
                    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
                    if (!validTypes.includes(file.type)) {
                        throw new Error('Please select a valid image file (JPEG, PNG, GIF, or WebP)');
                    }
                    
                    if (file.size > 50 * 1024 * 1024) { // 50MB limit
                        throw new Error('Image file too large. Please select an image under 50MB');
                    }
                    
                    showNotification('Uploading banner image...', 'info');
                    
                    // Convert to base64 directly (no compression)
                    const reader = new FileReader();
                    reader.onload = async function(e) {
                        const imageUrl = e.target.result;
                        
                        // Update UI immediately
                        bannerImage.src = imageUrl;
                        bannerImage.style.display = 'block';
                        bannerUpload.style.display = 'none';
                        
                        // Save banner to database
                        if (currentUser) {
                            try {
                                await anonteamAPI.updateBannerImage(imageUrl);
                                
                                // Update local data after successful API save
                                currentUser.bannerImage = imageUrl;
                                currentUser.banner = imageUrl; // Keep legacy compatibility
                                localStorage.setItem('anonteamCurrentUser', JSON.stringify(currentUser));
                            
                            // Also update the registered users array
                            const userIndex = registeredUsers.findIndex(user => user.email === currentUser.email);
                            if (userIndex !== -1) {
                                    registeredUsers[userIndex].banner = imageUrl;
                                localStorage.setItem('anonteamRegisteredUsers', JSON.stringify(registeredUsers));
                            }
                            
                            showNotification('Banner updated successfully!', 'success');
                            } catch (error) {
                                console.error('Failed to update banner:', error);
                                showNotification('Failed to update banner: ' + error.message, 'error');
                                // Revert the banner on error
                                bannerImage.style.display = 'none';
                                bannerUpload.style.display = 'flex';
                            }
                        }
                    };
                    
                    reader.onerror = function() {
                        showNotification('Failed to read banner file', 'error');
                    };
                    
                    reader.readAsDataURL(file);
                    
                } catch (error) {
                    showNotification(error.message, 'error');
                }
            }
        });
    }
}

// Setup comment form functionality (only once to prevent duplicates)
function setupCommentForm() {
    const postCommentBtn = document.getElementById('postCommentBtn');
    const commentInput = document.getElementById('commentInput');
    const commentsList = document.getElementById('commentsList');
    const commentUserAvatar = document.getElementById('commentUserAvatar');
    
    // Update comment avatar with user's profile picture
    const profilePicture = currentUser?.profileImage || currentUser?.profilePicture;
    if (commentUserAvatar && currentUser && profilePicture) {
        commentUserAvatar.src = profilePicture;
    }
    
    if (postCommentBtn && commentInput && commentsList) {
        // Remove any existing event listeners to prevent duplicates
        const newPostBtn = postCommentBtn.cloneNode(true);
        postCommentBtn.parentNode.replaceChild(newPostBtn, postCommentBtn);
        
        newPostBtn.addEventListener('click', () => {
            const commentText = commentInput.value.trim();
            if (commentText && currentUser) {
                addComment(commentText, currentUser.name || currentUser.username);
                commentInput.value = '';
                updateCommentCount();
            } else if (!commentText) {
                showNotification('Please write a comment before posting', 'error');
            }
        });
        
        // Allow posting with Enter key (Shift+Enter for new line)
        commentInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                newPostBtn.click();
            }
        });
    }
}

// Update profile view with current user data
function updateProfileView(targetUsername = null) {
    if (!currentUser) return;
    
    // Determine which user's profile to show
    let profileUser = currentUser;
    let isViewingOwnProfile = true;
    
    if (targetUsername && targetUsername !== (currentUser.name || currentUser.username)) {
        // Viewing someone else's profile - create mock user data based on available info
        isViewingOwnProfile = false;
        
        // Try to get actual avatar from shoutbox data if available
        let userAvatar = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiByeD0iMjAiIGZpbGw9IiMzNzM3M2IiLz4KPHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4PSI4IiB5PSI4Ij4KPHBhdGggZD0iTTEyIDEyQzE0LjIwOTEgMTIgMTYgMTAuMjA5MSAxNiA4QzE2IDUuNzkwODYgMTQuMjA5MSA0IDEyIDRDOS43OTA4NiA0IDggNS43OTA4NiA4IDhDOCAxMC4yMDkxIDkuNzkwODYgMTIgMTIgMTJaIiBmaWxsPSIjOTY5Njk2Ci8+CjxwYXRoIGQ9Ik0xMiAxNEM5LjMzIDI0IDQuNjcgMTQuMzMgNCAyMkM0IDE2LjY3IDkuMzMgMTQgMTIgMTRDMTQuNjcgMTQgMjAgMTYuNjcgMjAgMjJDMjAgMTQuMzMgMTQuNjcgMTQgMTIgMTRaIiBmaWxsPSIjOTY5Njk2Ii8+Cjwvc3ZnPgo8L3N2Zz4K';
        
        // Check if we have shoutbox data for this user
        if (window.shoutboxManager && window.shoutboxManager.shouts) {
            const userShout = window.shoutboxManager.shouts.find(shout => 
                shout.username === targetUsername
            );
            if (userShout && userShout.avatar) {
                userAvatar = userShout.avatar;
            }
        }
        
        profileUser = {
            name: targetUsername,
            username: targetUsername,
            id: 'N/A', // Unknown for other users
            joinDate: 'Unknown',
            accountType: getUserAccountType(targetUsername),
            profileImage: userAvatar,
            bannerImage: null // No banner for other users unless we can get it from somewhere
        };
    }
    
    // Store the viewed user globally
    viewedUser = profileUser;
    
    // Update page title/header
    const userProfileHeader = document.querySelector('#profileView h2');
    if (userProfileHeader) {
        userProfileHeader.textContent = isViewingOwnProfile ? 'User Profile' : `${profileUser.name}'s Profile`;
    }
    
    // Update profile header section with banner (only for own profile)
    const profileHeaderSection = document.getElementById('profileHeaderSection');
    if (profileHeaderSection) {
        if (isViewingOwnProfile) {
            const bannerSrc = profileUser.bannerImage || profileUser.banner;
            if (bannerSrc) {
                profileHeaderSection.style.setProperty('--profile-banner-bg', `url(${bannerSrc})`);
            } else {
                profileHeaderSection.style.removeProperty('--profile-banner-bg');
            }
        } else {
            // Remove banner for other users
            profileHeaderSection.style.removeProperty('--profile-banner-bg');
        }
    }
    
    // Update large profile avatar
    const profileAvatarLarge = document.getElementById('profileAvatarLarge');
    const profilePicture = profileUser.profileImage || profileUser.profilePicture;
    if (profileAvatarLarge) {
                    profileAvatarLarge.src = profilePicture || getDefaultAvatar();
    }
    
    // Update profile details
    const profileUsername = document.getElementById('profileUsername');
    if (profileUsername) {
        profileUsername.textContent = profileUser.name || profileUser.username;
    }
    
    const profileJoinDate = document.getElementById('profileJoinDate');
    if (profileJoinDate) {
        profileJoinDate.textContent = isViewingOwnProfile ? (profileUser.joinDate || 'June 27, 2025') : 'Unknown';
    }
    
    const profileUID = document.getElementById('profileUID');
    if (profileUID) {
        profileUID.textContent = isViewingOwnProfile ? (profileUser.id || 'N/A') : 'N/A';
    }
    
    // Update last seen
    const lastSeen = document.getElementById('lastSeen');
    if (lastSeen) {
        if (isViewingOwnProfile) {
        lastSeen.textContent = 'Online now';
        lastSeen.style.color = '#4f46e5';
        lastSeen.style.fontWeight = '600';
        } else {
            lastSeen.textContent = 'Unknown';
            lastSeen.style.color = '#888888';
            lastSeen.style.fontWeight = '400';
        }
    }
    
    // Setup activity tabs
    const activityTabs = document.querySelectorAll('.activity-tab');
    const activityPanels = document.querySelectorAll('.activity-panel');
    
    activityTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;
            
            // Remove active class from all tabs and panels
            activityTabs.forEach(t => t.classList.remove('active'));
            activityPanels.forEach(p => p.classList.remove('active'));
            
            // Add active class to clicked tab and corresponding panel
            tab.classList.add('active');
            const targetPanel = document.getElementById(targetTab + 'Panel');
            if (targetPanel) {
                targetPanel.classList.add('active');
            }
        });
    });
    
    // Update account type in profile overview
    const accountType = profileUser.accountType || getUserAccountType(profileUser.name || profileUser.username);
    const accountColors = getAccountTypeColor(accountType);
    const isGradient = accountType === 'femboy';
    
    // Update account type badge in overview
    const accountTypeBadge = document.querySelector('.overview-item .status-badge.premium');
    if (accountTypeBadge) {
        accountTypeBadge.textContent = accountColors.name;
        accountTypeBadge.className = `status-badge account-type-${accountType}`;
        if (isGradient) {
            accountTypeBadge.style.cssText = `
                background: ${accountColors.color}; 
                -webkit-background-clip: text; 
                -webkit-text-fill-color: transparent; 
                background-clip: text;
                border: 1px solid ${accountColors.bgColor};
            `;
        } else {
            accountTypeBadge.style.cssText = `
                background: ${accountColors.bgColor}; 
                color: ${accountColors.color};
            `;
        }
    }

    // Show/hide comment form based on whether viewing own profile
    const commentForm = document.querySelector('.comment-form-container');
    if (commentForm) {
        if (isViewingOwnProfile) {
            commentForm.style.display = 'none'; // Hide comment form on own profile
        } else {
            commentForm.style.display = 'block'; // Show comment form for other users
            // Always update all avatars for current user when switching profiles
            setTimeout(() => {
                updateAllAvatars();
                setupCommentForm();
            }, 50); // Small delay to ensure DOM is ready
        }
    }
    
    // Load saved comments for the viewed user (always use the target username)
    const commentTargetUser = targetUsername || (currentUser.name || currentUser.username);
    loadSavedComments(commentTargetUser);
    
    // Update subscription statistics (only for own profile)
    if (isViewingOwnProfile) {
    updateProfileSubscriptionStats();
    } else {
        // Hide subscription stats for other users or show generic message
        updateStatElements(0, 'Private', 'Private');
    }
}

// Update comment avatar for current user
function updateCommentAvatar() {
    const commentUserAvatar = document.getElementById('commentUserAvatar');
    if (commentUserAvatar && currentUser) {
        const profilePicture = currentUser.profileImage || currentUser.profilePicture;
        if (profilePicture) {
            commentUserAvatar.src = profilePicture;
        } else {
            // Set default avatar if no profile picture
            commentUserAvatar.src = getDefaultAvatar();
        }
    }
}

// Update all avatars throughout the interface when switching accounts
function updateAllAvatars() {
    if (!currentUser) return;
    
    const profilePicture = currentUser.profileImage || currentUser.profilePicture;
    const defaultAvatar = getDefaultAvatar();
    const avatarSrc = profilePicture || defaultAvatar;
    
    // Update comment form avatar
    const commentUserAvatar = document.getElementById('commentUserAvatar');
    if (commentUserAvatar) {
        commentUserAvatar.src = avatarSrc;
    }
    
    // Update any reply form avatars that might be open
    const replyAvatars = document.querySelectorAll('.comment-avatar');
    replyAvatars.forEach(avatar => {
        if (avatar) {
            avatar.src = avatarSrc;
        }
    });
    
    // Update shoutbox avatar if it exists
    if (window.shoutboxManager && window.shoutboxManager.updateUserAvatar) {
        window.shoutboxManager.updateUserAvatar();
    }
}

// Update profile subscription statistics
function updateProfileSubscriptionStats() {
    let activeSubsCount = 0;
    let totalActiveTime = 0; // Total days remaining across all active subs
    let firstPurchaseDate = null;
    let earliestPurchase = null;
    
    // Get current user's subscriptions from stored data
    if (!currentUser || !currentUser.subscriptions) {
        // No subscriptions
        updateStatElements(0, '0 days', 'N/A');
        return;
    }
    
    // Check each subscription
    Object.entries(currentUser.subscriptions).forEach(([cheatName, subscription]) => {
        if (subscription.active && new Date(subscription.expiryDate) > new Date()) {
            activeSubsCount++;
            
            // Calculate days remaining
            const daysLeft = Math.ceil((new Date(subscription.expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
            totalActiveTime += daysLeft;
            
            // Track earliest purchase date
            if (subscription.startDate) {
                const purchaseDate = new Date(subscription.startDate);
                if (!earliestPurchase || purchaseDate < earliestPurchase) {
                    earliestPurchase = purchaseDate;
                }
            }
        }
    });
    
    // Format first purchase date
    if (earliestPurchase) {
        firstPurchaseDate = earliestPurchase.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    }
    
    // Format total active time
    let timeText = totalActiveTime > 0 ? `${totalActiveTime} days` : '0 days';
    
    updateStatElements(activeSubsCount, timeText, firstPurchaseDate || 'N/A');
}

function updateStatElements(activeCount, timeText, purchaseDate) {
    // Update active subscriptions count
    const activeSubsElement = document.querySelector('.overview-section:nth-child(2) .overview-item:nth-child(2) .overview-value');
    if (activeSubsElement) {
        activeSubsElement.textContent = activeCount.toString();
        activeSubsElement.style.color = activeCount > 0 ? '#22c55e' : '#888888';
    }
    
    // Update total active time instead of spending
    const totalSpentElement = document.querySelector('.overview-section:nth-child(2) .overview-item:nth-child(3) .overview-value');
    if (totalSpentElement) {
        totalSpentElement.textContent = timeText;
        totalSpentElement.style.color = timeText !== '0 days' ? '#22c55e' : '#888888';
    }
    
    // Update first purchase date
    const firstPurchaseElement = document.querySelector('.overview-section:nth-child(2) .overview-item:nth-child(4) .overview-value');
    if (firstPurchaseElement) {
        firstPurchaseElement.textContent = purchaseDate;
        firstPurchaseElement.style.color = purchaseDate !== 'N/A' ? '#ffffff' : '#888888';
    }
}

// Add a new comment via API
async function addComment(text, username, isReply = false, parentId = null) {
    if (!currentUser || !text.trim()) {
        showNotification('Please enter a valid comment', 'error');
        return;
    }
    
    try {
        // ALWAYS set target user to the profile being viewed (including own profile)
        const targetUser = viewedUser ? viewedUser.username : (currentUser.name || currentUser.username);
            
        const response = await anonteamAPI.postComment(text.trim(), parentId, targetUser);
        
        // Add comment to UI
        displayComment(response.data);
        
        // Clear form inputs
        const commentInput = document.getElementById('commentInput');
        if (commentInput) {
            commentInput.value = '';
        }
        
        showNotification('Comment posted successfully!', 'success');
        updateCommentCount();
        
        // Successfully posted via API - return early
        return;
        
    } catch (error) {
        console.error('Failed to post comment:', error);
        showNotification('Failed to post comment: ' + error.message, 'error');
        return; // Don't continue with localStorage fallback
    }
}

// Create comment DOM element
function createCommentElement(comment, container, isReply = false) {
    const commentItem = document.createElement('div');
    commentItem.className = isReply ? 'comment-item reply-item' : 'comment-item';
    commentItem.setAttribute('data-comment-id', comment.id);
    
    const timeAgo = getTimeAgo(comment.timestamp);
    const currentUsername = currentUser.name || currentUser.username;
    const isLiked = comment.likedBy.includes(currentUsername);
    const isOwnComment = comment.username === currentUsername;
    
    // Get account type and colors for the comment user
    const accountType = comment.username === (currentUser?.name || currentUser?.username) ? 
        (currentUser.accountType || getUserAccountType(comment.username)) : 
        getUserAccountType(comment.username);
    const accountColors = getAccountTypeColor(accountType);
    const isGradient = accountType === 'femboy';
    
    commentItem.innerHTML = `
        <div class="comment-avatar-wrapper">
            <img src="${comment.avatar}" alt="User" />
        </div>
        <div class="comment-content">
            <div class="comment-header">
                <span class="comment-username" style="${isGradient ? `background: ${accountColors.color}; -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;` : `color: ${accountColors.color};`}">${comment.username}</span>
                ${isOwnComment ? '<span class="comment-badge">YOU</span>' : ''}
                <span class="comment-badge account-type-badge" style="background: ${accountColors.bgColor}; color: ${isGradient ? '#ec4899' : accountColors.color};">${accountColors.name.toUpperCase()}</span>
                <span class="comment-date">${timeAgo}</span>
            </div>
            <div class="comment-text">${comment.text}</div>
            <div class="comment-actions-row">
                ${!isReply ? `<span class="comment-action reply-action" data-comment-id="${comment.id}">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M7 10V12C7 13.1046 7.89543 14 9 14H12V17L17 12L12 7V10H7Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    Reply
                </span>` : ''}
                <span class="comment-action like-action ${isLiked ? 'liked' : ''}" data-comment-id="${comment.id}">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M20.84 4.61A5.5 5.5 0 0 0 7.04 7.04L12 12L7.04 16.96A5.5 5.5 0 1 0 12 21.96H20.84A5.5 5.5 0 0 0 20.84 4.61Z" ${isLiked ? 'fill="currentColor"' : 'stroke="currentColor" stroke-width="2"'} stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    Like ${comment.likes > 0 ? `(${comment.likes})` : ''}
                </span>
                ${isOwnComment ? `<span class="comment-action delete-action" data-comment-id="${comment.id}">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 6H5H21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M8 6V4C8 3.44772 8.44772 3 9 3H15C15.5523 3 16 3.44772 16 4V6M19 6V20C19 20.5523 18.5523 21 18 21H6C5.44772 21 5 20.5523 5 20V6H19Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    Delete
                </span>` : ''}
            </div>
            <div class="replies-container" id="replies-${comment.id}"></div>
        </div>
    `;
    
    // Insert at the beginning of comments list or after parent comment
    if (isReply && comment.parentId) {
        const parentReplies = document.getElementById(`replies-${comment.parentId}`);
        if (parentReplies) {
            parentReplies.appendChild(commentItem);
        }
    } else {
        container.insertBefore(commentItem, container.firstChild);
    }
    
    // Add event listeners for actions
    setupCommentActions(commentItem);
    
    return commentItem;
}

// Setup comment action event listeners
function setupCommentActions(commentElement) {
    const replyAction = commentElement.querySelector('.reply-action');
    const likeAction = commentElement.querySelector('.like-action');
    const deleteAction = commentElement.querySelector('.delete-action');
    
    if (replyAction) {
        replyAction.addEventListener('click', () => {
            const commentId = replyAction.getAttribute('data-comment-id');
            showReplyForm(commentId, commentElement);
        });
    }
    
    if (likeAction) {
        likeAction.addEventListener('click', () => {
            const commentId = likeAction.getAttribute('data-comment-id');
            toggleLike(commentId);
        });
    }
    
    if (deleteAction) {
        deleteAction.addEventListener('click', () => {
            const commentId = deleteAction.getAttribute('data-comment-id');
            deleteComment(commentId);
        });
    }
}

// Show reply form
function showReplyForm(parentId) {
    // Find the parent comment element
    const parentElement = document.querySelector(`[data-comment-id="${parentId}"]`);
    if (!parentElement) {
        showNotification('Could not find comment to reply to', 'error');
        return;
    }
    
    // Remove any existing reply forms
    const existingForms = document.querySelectorAll('.reply-form');
    existingForms.forEach(form => form.remove());
    
    const replyForm = document.createElement('div');
    replyForm.className = 'reply-form';
    replyForm.innerHTML = `
        <div class="comment-compose">
            <div class="comment-input-row">
                <img class="comment-avatar" src="${currentUser.profileImage || currentUser.profilePicture || getDefaultAvatar()}" alt="Your Avatar" />
                <div class="comment-input-area">
                    <textarea class="reply-input" placeholder="Write a reply..."></textarea>
                    <div class="comment-actions">
                        <button class="cancel-comment-btn">Cancel</button>
                        <button class="post-comment-btn reply-submit-btn">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M2 21L23 12L2 3V10L17 12L2 14V21Z" fill="currentColor"/>
                            </svg>
                            Reply
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    parentElement.querySelector('.comment-content').appendChild(replyForm);
    
    // Focus on reply input
    const replyInput = replyForm.querySelector('.reply-input');
    replyInput.focus();
    
    // Add event listeners
    const submitBtn = replyForm.querySelector('.reply-submit-btn');
    const cancelBtn = replyForm.querySelector('.cancel-comment-btn');
    
    submitBtn.addEventListener('click', () => {
        const replyText = replyInput.value.trim();
        if (replyText) {
                            addComment(replyText, currentUser.name || currentUser.username, true, parentId);
            replyForm.remove();
            updateCommentCount();
        }
    });
    
    cancelBtn.addEventListener('click', () => {
        replyForm.remove();
    });
    
    // Submit on Enter
    replyInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submitBtn.click();
        }
    });
}

// Toggle like on comment via API
async function toggleLike(commentId) {
    if (!currentUser) {
        showNotification('Please log in to like comments', 'error');
        return;
    }
    
    try {
        const likeButton = document.querySelector(`[data-comment-id="${commentId}"] .like-btn`);
        const isLiked = likeButton?.classList.contains('liked');
        
        if (isLiked) {
            await anonteamAPI.unlikeComment(commentId);
            likeButton.classList.remove('liked');
            likeButton.innerHTML = '<i class="fas fa-heart"></i> <span class="like-count">' + (parseInt(likeButton.querySelector('.like-count').textContent) - 1) + '</span>';
        } else {
            await anonteamAPI.likeComment(commentId);
            likeButton.classList.add('liked');
            likeButton.innerHTML = '<i class="fas fa-heart"></i> <span class="like-count">' + (parseInt(likeButton.querySelector('.like-count').textContent) + 1) + '</span>';
        }
        
    } catch (error) {
        console.error('Failed to toggle like:', error);
        showNotification('Failed to update like: ' + error.message, 'error');
    }
}

// Update like UI
function updateLikeUI(commentId, comment) {
    const likeAction = document.querySelector(`[data-comment-id="${commentId}"].like-action`);
    if (likeAction) {
        const isLiked = comment.likedBy.includes(currentUser.name || currentUser.username);
        const svg = likeAction.querySelector('svg path');
        
        likeAction.classList.toggle('liked', isLiked);
        
        if (isLiked) {
            svg.setAttribute('fill', 'currentColor');
            svg.removeAttribute('stroke');
            svg.removeAttribute('stroke-width');
        } else {
            svg.removeAttribute('fill');
            svg.setAttribute('stroke', 'currentColor');
            svg.setAttribute('stroke-width', '2');
        }
        
        likeAction.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20.84 4.61A5.5 5.5 0 0 0 7.04 7.04L12 12L7.04 16.96A5.5 5.5 0 1 0 12 21.96H20.84A5.5 5.5 0 0 0 20.84 4.61Z" ${isLiked ? 'fill="currentColor"' : 'stroke="currentColor" stroke-width="2"'} stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Like ${comment.likes > 0 ? `(${comment.likes})` : ''}
        `;
    }
}

// Legacy function - no longer needed (replaced by API calls)
function saveComment(comment, targetUsername = null) {
    // No longer used - comments now saved via API
    return;
}

// DISABLED: Get comments (was localStorage only - not shared between users)
function getStoredComments(targetUsername = null) {
    return []; // Always return empty - feature disabled
}

// Find comment by ID (including in replies)
function findCommentById(comments, id) {
    for (const comment of comments) {
        if (comment.id === id) {
            return comment;
        }
        if (comment.replies) {
            const found = findCommentById(comment.replies, id);
            if (found) return found;
        }
    }
    return null;
}

// Get time ago string
function getTimeAgo(timestamp) {
    const now = new Date();
    const commentTime = new Date(timestamp);
    const diffMs = now - commentTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return commentTime.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
    });
}

// Delete comment via API
async function deleteComment(commentId) {
    if (!currentUser) {
        showNotification('Please log in to delete comments', 'error');
        return;
    }
    
    if (!confirm('Are you sure you want to delete this comment?')) {
        return;
    }
    
    try {
        await anonteamAPI.deleteComment(commentId);
        
        // Remove comment from UI
            const commentElement = document.querySelector(`[data-comment-id="${commentId}"]`);
            if (commentElement) {
                    commentElement.remove();
                }
                
        showNotification('Comment deleted successfully!', 'success');
                updateCommentCount();
                
    } catch (error) {
        console.error('Failed to delete comment:', error);
        showNotification('Failed to delete comment: ' + error.message, 'error');
    }
}

// Remove comment from localStorage (user-specific)
function removeCommentFromStorage(commentId) {
    if (!currentUser) return;
    
    // Use the target username if viewing someone else's profile
    const targetUsername = viewedUser && viewedUser !== currentUser ? 
        (viewedUser.name || viewedUser.username) : null;
    
    let profileKey;
    if (targetUsername) {
        profileKey = `profileComments_${targetUsername}`;
    } else {
        profileKey = `profileComments_${currentUser.name || currentUser.username}`;
    }
    
    const comments = getStoredComments(targetUsername);
    
    // Function to recursively remove comment from nested structure
    function removeFromArray(array, id) {
        for (let i = 0; i < array.length; i++) {
            if (array[i].id === id) {
                array.splice(i, 1);
                return true;
            }
            if (array[i].replies && array[i].replies.length > 0) {
                if (removeFromArray(array[i].replies, id)) {
                    return true;
                }
            }
        }
        return false;
    }
    
    removeFromArray(comments, commentId);
    localStorage.setItem(profileKey, JSON.stringify(comments));
}

// Load comments from database
async function loadSavedComments(targetUsername = null) {
    const commentsList = document.getElementById('commentsList');
    if (!commentsList) return;
    
    try {
        const response = await anonteamAPI.getComments(targetUsername);
        const comments = response.data || [];
        
        // Clear existing comments
    commentsList.innerHTML = '';
    
    if (comments.length > 0) {
        // Sort comments: parent comments first, then their replies
        const parentComments = comments.filter(c => !c.parentId);
        const replyComments = comments.filter(c => c.parentId);
        
    
        
        // Display parent comments first
        parentComments.forEach(comment => {
            displayComment(comment);
            
            // Then display any replies to this parent
            const replies = replyComments.filter(reply => reply.parentId == comment.id);
            replies.forEach(reply => {
                displayComment(reply);
            });
        });
        } else {
            commentsList.innerHTML = `
                <div class="no-comments">
                    <div class="no-comments-icon">💬</div>
                    <h4>No Comments Yet</h4>
                    <p>Be the first to leave a comment!</p>
                </div>
            `;
        }
        
        updateCommentCount();
        
    } catch (error) {
        console.error('Failed to load comments:', error);
        commentsList.innerHTML = `
            <div class="no-comments">
                <div class="no-comments-icon">⚠️</div>
                <h4>Failed to Load Comments</h4>
                <p>Please try refreshing the page.</p>
            </div>
        `;
    }
}

// Display a single comment in the UI
function displayComment(comment) {
    const commentsList = document.getElementById('commentsList');
    if (!commentsList) return;
    
    // Remove "No Comments Yet" message if it exists
    const noCommentsMsg = commentsList.querySelector('.no-comments');
    if (noCommentsMsg) {
        noCommentsMsg.remove();
    }
    
    // Better avatar handling for comments - check multiple sources  
    const defaultAvatar = getDefaultAvatar();
    let userAvatar = defaultAvatar;
    
    if (comment.user && comment.user.profileImage) {
        userAvatar = comment.user.profileImage;
    } else if (comment.user && comment.user.profilePicture) {
        userAvatar = comment.user.profilePicture;
    } else if (comment.user && comment.user.username && currentUser && (comment.user.username === (currentUser.name || currentUser.username))) {
        // This is the current user's comment - use their profile picture
        userAvatar = currentUser.profileImage || currentUser.profilePicture || defaultAvatar;
    }
    const isOwner = currentUser && comment.user.username === (currentUser.name || currentUser.username);
            const isAdmin = currentUser && (currentUser.accountType === 'admin' || currentUser.accountType === 'owner' || currentUser.accountType === 'femboy');
    const canDelete = isOwner || isAdmin;
    
    const commentElement = document.createElement('div');
    commentElement.className = 'comment-item';
    commentElement.setAttribute('data-comment-id', comment.id);
    commentElement.setAttribute('data-account-type', comment.user.accountType || 'user');
    
    // Add parent ID for reply styling
    if (comment.parentId) {
        commentElement.setAttribute('data-parent-id', comment.parentId);
        commentElement.classList.add('reply-comment');
        // Add inline CSS as fallback
        commentElement.style.marginLeft = '40px';
        commentElement.style.paddingLeft = '16px';
        commentElement.style.borderLeft = '3px solid #ef4444';
        commentElement.style.background = 'rgba(239, 68, 68, 0.1)';
        
    } else {

    }
    
    // Get account type colors matching shoutbox style
    const accountColors = getAccountTypeColor(comment.user.accountType);
    const isGradient = comment.user.accountType === 'femboy';
    
    commentElement.innerHTML = `
        <div class="comment-content">
            <div class="comment-header">
                <img class="comment-avatar" src="${userAvatar}" 
                     onerror="this.src='${defaultAvatar}'" alt="${comment.user.username}">
                <div class="comment-info">
                    <span class="comment-author" style="${isGradient ? `background: ${accountColors.color}; -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;` : `color: ${accountColors.color};`}">
                        ${comment.user.username}
                    </span>
                    ${isOwner ? '<span class="shout-badge">YOU</span>' : ''}
                    <span class="shout-badge account-type-badge" style="background: ${accountColors.bgColor}; color: ${isGradient ? '#ec4899' : accountColors.color};">${accountColors.name.toUpperCase()}</span>
                    <span class="comment-time">${comment.timeAgo}</span>
                </div>
                ${canDelete ? `<button class="delete-comment-btn" onclick="deleteComment(${comment.id})" title="Delete comment">×</button>` : ''}
            </div>
            <div class="comment-text">${escapeHtml(comment.content)}</div>
            <div class="comment-actions">
                <button class="like-btn ${comment.userLiked ? 'liked' : ''}" onclick="toggleLike(${comment.id})">
                    <span class="like-count">${comment.likesCount}</span>
                </button>
                <button class="reply-btn" onclick="showReplyForm(${comment.id})">
                    Reply
                </button>
            </div>
        </div>
    `;
    
    commentsList.appendChild(commentElement);
}

// Update comment count in the UI
function updateCommentCount() {
    const commentsList = document.getElementById('commentsList');
    const commentsCount = document.getElementById('commentsCount');
    const totalComments = document.getElementById('totalComments');
    
    if (commentsList && commentsCount && totalComments) {
        const commentItems = commentsList.querySelectorAll('.comment-item');
        const count = commentItems.length;
        
        commentsCount.textContent = count;
        totalComments.textContent = count;
    }
}

// Setup download buttons functionality
function setupDownloadButtons() {
    const lightningIcons = document.querySelectorAll('.lightning-icon');
    
    lightningIcons.forEach((icon, index) => {
        const cheatNames = ['compkiller', 'neverlose', 'onetap', 'fatality'];
        const cheatName = cheatNames[index];
        
        if (cheatName) {
            icon.style.cursor = 'pointer';
            icon.title = `Download ${cheatName} loader`;
            
            icon.addEventListener('click', () => {
                downloadCheat(cheatName);
            });
        }
    });
}

// Download cheat function - make it globally accessible
window.downloadCheat = async function downloadCheat(cheatName) {

    
    // Check if product is frozen - no downloads allowed
    if (isProductFrozen(cheatName)) {
        showNotification(`${cheatName} is currently frozen and unavailable for download`, 'error');
        return;
    }
    
    // Check if product is broken - no downloads allowed
    if (isProductBroken(cheatName)) {
        showNotification(`${cheatName} is currently under maintenance and unavailable for download`, 'error');
        return;
    }
    
    // Check subscription - handle both legacy and unified systems
    let hasActiveSubscription = false;
    
    // First try legacy userSubscriptions
    const subscription = userSubscriptions[cheatName];
    if (subscription && subscription.active) {
        hasActiveSubscription = true;
        
    } else {
        // Try unified system as fallback
        if (window.subscriptionUIManager && window.subscriptionUIManager.userSubscriptions) {
            const unifiedSub = window.subscriptionUIManager.userSubscriptions.find(sub => sub.product_name === cheatName);
    
            
            if (unifiedSub && unifiedSub.is_active && new Date(unifiedSub.end_date) > new Date()) {
                hasActiveSubscription = true;

                
                // Sync this data back to legacy system for future use
                if (typeof userSubscriptions === 'undefined') {
                    window.userSubscriptions = {};
                }
                userSubscriptions[cheatName] = {
                    active: true,
                    expiry: new Date(unifiedSub.end_date),
                    status: 'active',
                    end_date: unifiedSub.end_date
                };
            }
        }
    }
    
    if (!hasActiveSubscription) {

        showNotification('You need an active subscription to download this cheat', 'error');
        return;
    }
    
    try {
        showNotification(`🔐 Generating secure download token for ${cheatName}...`, 'info');
        
        // Secure one-time download through API
        const response = await window.anonteamAPI.downloadLoader(cheatName);
        
        showNotification(`📥 Downloading ${cheatName} loader securely...`, 'info');
        
        // Convert response to blob
        const blob = await response.blob();
        
        // Get filename from Content-Disposition header - preserve original name
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = `${cheatName}-loader.exe`; // Last resort fallback
        
        if (contentDisposition) {
            console.log('Content-Disposition header:', contentDisposition);
            
            // Try multiple filename extraction methods
            const filenameMatch = contentDisposition.match(/filename[*]?=['"]?([^'";\r\n]+)['"]?/i);
            if (filenameMatch) {
                filename = filenameMatch[1].trim();
                console.log('✅ Extracted original filename:', filename);
            } else {
                console.error('❌ Could not extract filename from header:', contentDisposition);
                console.error('Using fallback filename which will be WRONG');
            }
        } else {
            console.error('❌ No Content-Disposition header found!');
            console.error('This means the server is not sending the original filename properly');
            console.error('Using fallback filename which will be WRONG');
        }
        
        // Create download link
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up blob URL
        window.URL.revokeObjectURL(url);
        
        showNotification(`🔒 ${cheatName} loader downloaded securely! (One-time token consumed)`, 'success');

        
    } catch (error) {
        console.error('Download failed:', error);
        showNotification(error.message || 'Download failed. Please try again.', 'error');
    }
}

// Update subscription UI - now handled by unified system
function updateSubscriptionUI() {
    // This function is now handled by the unified SubscriptionUIManager
    // Call the new system instead
    if (window.subscriptionUIManager) {
        window.subscriptionUIManager.updateUI();
        }
}

// Activate license key for specific cheat
function activateLicenseForCheat(licenseKey, cheatName, customDuration = 30) {
    // Simulate license activation
    const subscription = userSubscriptions[cheatName];
    
    if (subscription) {
        subscription.active = true;
        subscription.expiry = new Date(Date.now() + (customDuration * 24 * 60 * 60 * 1000)); // Custom duration in days
        subscription.status = 'active';
        
        // Save to localStorage
        localStorage.setItem('anonteamUserSubscriptions', JSON.stringify(userSubscriptions));
        
        // Update UI
        updateSubscriptionUI();
        updateProfileSubscriptionStats();
        
        showNotification(`${cheatName} subscription activated! Expires in ${customDuration} days.`, 'success');
        return true;
    }
    
    return false;
}

// Redeem/Activate license key
async function redeemLicenseKey() {
    const keyInput = document.querySelector('.key-input');
    const licenseKey = keyInput.value.trim();
    
    if (!licenseKey) {
        showNotification('Please enter a license key', 'error');
        return;
    }
    
    // Check if it's a generated admin key first (local storage)
    // Only check localStorage, don't call API validation which would consume the key
    const storedKeys = JSON.parse(localStorage.getItem('anonteamKeys') || '[]');
    const localKey = storedKeys.find(key => key.code === licenseKey && !key.used);
    
    if (localKey) {
        // Use the local generated key
        const usedKey = useSubscriptionKey(licenseKey, currentUser.email);
        if (usedKey) {
            // Clear input
            keyInput.value = '';
            
            // Activate subscription with duration
            if (activateLicenseForCheat(licenseKey, usedKey.cheat, usedKey.duration)) {
                showNotification(`License activated: ${usedKey.duration}d ${getCheatDisplayName(usedKey.cheat)}!`, 'success');
                loadGeneratedKeys(); // Refresh keys display in admin panel
            } else {
                showNotification('Failed to activate license key', 'error');
            }
            return;
        } else {
            showNotification('This license key has already been used', 'error');
            keyInput.value = '';
            return;
        }
    }
    
    // Try to activate via API (database-stored keys)
    try {
        showNotification('Activating license key...', 'info');
        const response = await anonteamAPI.activateLicenseKey(licenseKey);
        
        if (response.success) {
    // Clear input
    keyInput.value = '';
    
            // Show success message
            showNotification(`License activated: ${response.data.duration_days}d ${response.data.display_name}!`, 'success');
            
            // Refresh user subscriptions
            if (typeof updateSubscriptionUI === 'function') {
                updateSubscriptionUI();
            }
            
            // Refresh keys display in admin panel if admin
            if (isAdmin() && typeof loadGeneratedKeys === 'function') {
                loadGeneratedKeys();
            }
    } else {
            throw new Error(response.message || 'License activation failed');
        }
        
    } catch (error) {
        console.error('License activation error:', error);
        showNotification(error.message || 'Failed to activate license key', 'error');
        
        // Don't clear input on error so user can try again
    }
}

// Request HWID Reset (using proper API client)
async function requestHwidReset() {
    if (!currentUser) {
        showNotification('Please log in to reset HWID', 'error');
        return;
    }
    
    const hwidBtn = document.getElementById('hwidResetBtn');
    const reasonInput = document.querySelector('.reason-input');
    
    if (hwidBtn.disabled) {
        showNotification('HWID reset not available yet', 'error');
        return;
    }
    
    const reason = reasonInput ? reasonInput.value.trim() : '';
    
    // Update UI to show processing
    hwidBtn.innerHTML = '<span class="btn-icon">⏳</span><span>Processing...</span>';
    hwidBtn.disabled = true;
    
    try {
        // Use the existing API client which handles authentication
        const response = await window.anonteamAPI.requestHwidReset(reason);
        
        if (response.success) {
            showNotification('HWID reset successful!', 'success');
    
    // Clear reason input
    if (reasonInput) {
        reasonInput.value = '';
    }
    
            // Refresh HWID status from backend
            await loadHwidResetStatusFromAPI();
            
        } else {
            throw new Error(response.message || 'HWID reset failed');
        }
        
    } catch (error) {
        console.error('HWID reset error:', error);
        showNotification(error.message || 'HWID reset failed', 'error');
        
        // Re-enable button on error
        hwidBtn.innerHTML = '<span class="btn-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 4V10H7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M23 20V14H17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14L18.36 18.36A9 9 0 0 1 3.51 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span>Reset</span>';
        hwidBtn.disabled = false;
    }
}

// Extend subscription
function extendSubscription() {
    window.open('https://anonteam.store/', '_blank');
}

// Generate user UID with sequential numbering
function generateUserUID(username) {
    const cleanUsername = username.toLowerCase().replace(/[^a-z0-9]/g, '');
    // Fix: Start UIDs from 1, not 2
    const nextUID = registeredUsers.length === 0 ? 1 : registeredUsers.length + 1;
    return `/${cleanUsername}.${nextUID}`;
}

function getNextUserNumber() {
    return registeredUsers.length === 0 ? 1 : registeredUsers.length + 1;
}



// ASCII validation functions
function isValidASCII(text) {
    // Only allow printable ASCII characters (32-126) plus common whitespace
    return /^[\x20-\x7E\s]*$/.test(text);
}

function isValidName(name) {
    // Only letters, numbers, spaces, dots, hyphens, underscores with minimum 3 characters
    return name.length >= 3 && /^[a-zA-Z0-9\s._-]+$/.test(name) && isValidASCII(name);
}

function isValidEmail(email) {
    // Basic email validation with ASCII only
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email) && isValidASCII(email);
}

function isValidPassword(password) {
    // ASCII printable characters only, no control characters
    return /^[\x20-\x7E]+$/.test(password);
}



// Setup real-time ASCII filtering for input fields
function setupASCIIFiltering() {
    const inputFields = [
        'signupName',
        'signupEmail', 
        'signupPassword',
        'signupInviteCode',
        'loginEmail',
        'loginPassword'
    ];
    
    inputFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('input', function(e) {
                const originalValue = e.target.value;
                let filteredValue = '';
                
                // Filter out non-ASCII characters
                for (let i = 0; i < originalValue.length; i++) {
                    const char = originalValue[i];
                    const charCode = char.charCodeAt(0);
                    
                    // Allow printable ASCII (32-126) and common whitespace
                    if ((charCode >= 32 && charCode <= 126) || char === '\t' || char === '\n') {
                        // Additional filtering for name field
                        if (fieldId === 'signupName') {
                            if (/[a-zA-Z0-9\s._-]/.test(char)) {
                                filteredValue += char;
                            }
                        } else {
                            filteredValue += char;
                        }
                    }
                }
                
                // Update field if value changed
                if (filteredValue !== originalValue) {
                    e.target.value = filteredValue;
                    
                    // Show warning for first non-ASCII character attempt
                    if (!field.hasAttribute('data-ascii-warned')) {
                        field.setAttribute('data-ascii-warned', 'true');
                        showNotification('Only standard ASCII characters are allowed', 'warning');
                        
                        // Reset warning after 5 seconds
                        setTimeout(() => {
                            field.removeAttribute('data-ascii-warned');
                        }, 5000);
                    }
                }
                
                // Add real-time username validation feedback
                if (fieldId === 'signupName') {
                    const username = e.target.value;
                    
                    // Remove previous validation classes
                    e.target.classList.remove('username-valid', 'username-invalid', 'username-too-short');
                    
                    if (username.length === 0) {
                        // No styling for empty field
                    } else if (username.length < 3) {
                        e.target.classList.add('username-too-short');
                    } else if (isValidName(username)) {
                        e.target.classList.add('username-valid');
                    } else {
                        e.target.classList.add('username-invalid');
                    }
                }
                

            });
            
            // Also prevent paste of non-ASCII content
            field.addEventListener('paste', function(e) {
                setTimeout(() => {
                    const event = new Event('input', { bubbles: true });
                    field.dispatchEvent(event);
                }, 0);
            });
        }
    });
}

// Load HWID reset status for current user (from backend API)
async function loadHwidResetStatus() {
    if (!currentUser) return;
    
    try {
        await loadHwidResetStatusFromAPI();
    } catch (error) {
        console.error('Failed to load HWID status:', error);
        // Fallback to localStorage if API fails
    const userEmail = currentUser.email;
    const lastReset = userHwidResets[userEmail];
        updateHwidResetStatus(lastReset, 0);
    }
}

// Load HWID reset status from backend API
async function loadHwidResetStatusFromAPI() {
    try {
        const response = await window.anonteamAPI.getHwidStatus();
        
        if (response.success && response.data) {
            const statusData = response.data;
            updateHwidResetStatus(statusData.last_reset, statusData.reset_count, statusData.can_reset);
        } else {
            throw new Error(response.message || 'Failed to get HWID status');
        }
        
    } catch (error) {
        console.error('API HWID status error:', error);
        throw error;
    }
}

// Update HWID reset status for current user
function updateHwidResetStatus(lastReset, resetCount = 0, canReset = null) {
    const hwidBtn = document.getElementById('hwidResetBtn');
    
    if (!hwidBtn) return;
    
    // If we have explicit canReset info from API, use it
    if (canReset !== null) {
        if (canReset) {
            hwidBtn.innerHTML = '<span class="btn-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 4V10H7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M23 20V14H17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14L18.36 18.36A9 9 0 0 1 3.51 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span>Reset</span>';
            hwidBtn.disabled = false;
        } else {
            // Calculate days until next reset
            if (lastReset) {
                const lastResetDate = new Date(lastReset);
                const nextResetDate = new Date(lastResetDate.getTime() + (14 * 24 * 60 * 60 * 1000));
                const daysLeft = Math.ceil((nextResetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                hwidBtn.innerHTML = `<span class="btn-icon">⏳</span><span>Available in ${daysLeft} days</span>`;
            } else {
                hwidBtn.innerHTML = '<span class="btn-icon">⏳</span><span>Available in 14 days</span>';
            }
            hwidBtn.disabled = true;
        }
        return;
    }
    
    // Fallback to timestamp calculation
    if (!lastReset) {
        hwidBtn.innerHTML = '<span class="btn-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 4V10H7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M23 20V14H17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14L18.36 18.36A9 9 0 0 1 3.51 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span>Reset</span>';
        hwidBtn.disabled = false;
        return;
    }
    
    const lastResetTime = typeof lastReset === 'string' ? new Date(lastReset).getTime() : lastReset;
    const daysSinceReset = Math.floor((Date.now() - lastResetTime) / (1000 * 60 * 60 * 24));
    
    if (daysSinceReset >= 14) {
        hwidBtn.innerHTML = '<span class="btn-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 4V10H7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M23 20V14H17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14L18.36 18.36A9 9 0 0 1 3.51 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span>Reset</span>';
        hwidBtn.disabled = false;
    } else {
        const daysLeft = 14 - daysSinceReset;
        hwidBtn.innerHTML = `<span class="btn-icon">⏳</span><span>Available in ${daysLeft} days</span>`;
        hwidBtn.disabled = true;
    }
}

// Animate status bars on dashboard load
function animateStatusBars() {
    // Animation for modern dashboard layout - can be used for future enhancements
}

// Generate random license key
function generateRandomKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const segments = [];
    
    for (let i = 0; i < 4; i++) {
        let segment = '';
        for (let j = 0; j < 4; j++) {
            segment += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        segments.push(segment);
    }
    
    return segments.join('-');
}

// Generate initial license keys
function generateLicenseKeys() {
    // This function can be used to populate initial data
    // Keys are already in HTML, but this could be used for dynamic loading
}

// Enhanced Notification System
function showNotification(message, type = 'info') {
    // Get or create notification stack container (top-right)
    let notificationStack = document.querySelector('.notification-stack');
    if (!notificationStack) {
        notificationStack = document.createElement('div');
        notificationStack.className = 'notification-stack';
        notificationStack.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1000;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 12px;
            pointer-events: none;
        `;
        document.body.appendChild(notificationStack);
    }
    
    // Get icon and colors for notification type
    const notificationConfig = {
        success: {
            icon: '✓',
            bgColor: '#1a1a1a',
            accentColor: '#4f46e5',
            textColor: '#ffffff'
        },
        error: {
            icon: '✕',
            bgColor: '#1a1a1a',
            accentColor: '#e53e3e',
            textColor: '#ffffff'
        },
        info: {
            icon: 'ℹ',
            bgColor: '#1a1a1a',
            accentColor: '#4f46e5',
            textColor: '#ffffff'
        },
        warning: {
            icon: '⚠',
            bgColor: '#1a1a1a',
            accentColor: '#d69e2e',
            textColor: '#ffffff'
        }
    };
    
    const config = notificationConfig[type] || notificationConfig.info;
    
    // Create center animation container (covers full screen for animation)
    const centerAnimationContainer = document.createElement('div');
    centerAnimationContainer.className = 'center-animation-container';
    centerAnimationContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        z-index: 999;
        pointer-events: none;
        display: flex;
        justify-content: center;
        align-items: center;
    `;
    
    // Create animated symbol that appears first (center screen)
    const symbol = document.createElement('div');
    symbol.className = 'notification-symbol';
    symbol.textContent = config.icon;
    symbol.style.cssText = `
        position: absolute;
        width: 80px;
        height: 80px;
        background: ${config.accentColor};
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 32px;
        font-weight: bold;
        color: white;
        transform: scale(0);
        animation: symbolPopScreen 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
        z-index: 3;
    `;
    
    // Create single ripple wave effect
    const createRipple = (delay, maxSize, duration) => {
        const ripple = document.createElement('div');
        ripple.className = 'notification-ripple';
        ripple.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            width: 0;
            height: 0;
            background: ${config.accentColor};
            border-radius: 50%;
            opacity: 0.25;
            transform: translate(-50%, -50%);
            animation: rippleExpand ${duration}s ease-out ${delay}s forwards;
            --max-size: ${maxSize}px;
            z-index: 1;
        `;
        return ripple;
    };
    
    // Create single ripple for cleaner effect
    const ripple1 = createRipple(0.4, 400, 1.0);
    
    // Assemble center animation
    centerAnimationContainer.appendChild(symbol);
    centerAnimationContainer.appendChild(ripple1);
    document.body.appendChild(centerAnimationContainer);
    
    // Add fade out animation to center container
    setTimeout(() => {
        centerAnimationContainer.style.animation = 'fadeOutCenter 0.5s ease-out forwards';
    }, 1300);
    
    // Create the actual notification that slides to top-right
    const notificationBox = document.createElement('div');
    notificationBox.className = 'notification-box';
    notificationBox.innerHTML = `
        <div class="notification-content">
            <div class="notification-icon">${config.icon}</div>
            <div class="notification-text">
                <div class="notification-title">${type.charAt(0).toUpperCase() + type.slice(1)}</div>
                <div class="notification-message">${message}</div>
            </div>
            <button class="notification-close">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
            </button>
        </div>
        <div class="notification-progress"></div>
    `;
    
    notificationBox.style.cssText = `
        background: ${config.bgColor};
        color: ${config.textColor};
        border-radius: 8px;
        border: 1px solid #2a2a2a;
        border-left: 2px solid ${config.accentColor};
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.25);
        backdrop-filter: blur(20px);
        min-width: 320px;
        max-width: 400px;
        overflow: hidden;
        opacity: 0;
        transform: translateX(400px) scale(0.8);
        animation: slideInFromRight 0.6s ease-out 1.8s forwards;
        pointer-events: auto;
    `;
    
    // Style the notification content
    const content = notificationBox.querySelector('.notification-content');
    content.style.cssText = `
        display: flex;
        align-items: flex-start;
        padding: 16px 20px;
        gap: 12px;
    `;
    
    // Style the icon
    const icon = notificationBox.querySelector('.notification-icon');
    icon.style.cssText = `
        width: 32px;
        height: 32px;
        background: ${config.accentColor};
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        font-weight: bold;
        flex-shrink: 0;
        color: white;
    `;
    
    // Style the text container
    const textContainer = notificationBox.querySelector('.notification-text');
    textContainer.style.cssText = `
        flex: 1;
        min-width: 0;
    `;
    
    // Style the title
    const title = notificationBox.querySelector('.notification-title');
    title.style.cssText = `
        font-size: 14px;
        font-weight: 600;
        margin-bottom: 2px;
        color: #ffffff;
    `;
    
    // Style the message
    const messageEl = notificationBox.querySelector('.notification-message');
    messageEl.style.cssText = `
        font-size: 13px;
        font-weight: 400;
        line-height: 1.4;
        color: #cccccc;
    `;
    
    // Style the close button
    const closeBtn = notificationBox.querySelector('.notification-close');
    closeBtn.style.cssText = `
        background: rgba(255, 255, 255, 0.1);
        border: none;
        color: #9ca3af;
        width: 28px;
        height: 28px;
        border-radius: 6px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: all 0.2s ease;
    `;
    
    // Style the progress bar
    const progress = notificationBox.querySelector('.notification-progress');
    progress.style.cssText = `
        position: absolute;
        bottom: 0;
        left: 0;
        height: 2px;
        background: #444444;
        width: 100%;
        animation: progressBar 4s linear 2.4s forwards;
    `;
    
    // Add notification to stack
    notificationStack.appendChild(notificationBox);
    
    // Close button functionality
    closeBtn.addEventListener('mouseenter', () => {
        closeBtn.style.background = 'rgba(255, 255, 255, 0.2)';
        closeBtn.style.color = '#ffffff';
    });
    
    closeBtn.addEventListener('mouseleave', () => {
        closeBtn.style.background = 'rgba(255, 255, 255, 0.1)';
        closeBtn.style.color = '#9ca3af';
    });
    
    const removeNotification = () => {
        notificationBox.style.animation = 'slideOutToRight 0.4s ease-in forwards';
        setTimeout(() => {
            if (notificationBox.parentNode) {
                notificationBox.remove();
                // Remove stack if empty
                if (notificationStack.children.length === 0) {
                    notificationStack.remove();
                }
            }
        }, 400);
    };
    
    closeBtn.addEventListener('click', removeNotification);
    
    // Remove center animation after fade out completes
    setTimeout(() => {
        if (centerAnimationContainer.parentNode) {
            centerAnimationContainer.remove();
        }
    }, 1800);
    
    // Auto remove notification after 6 seconds total
    setTimeout(() => {
        if (notificationBox.parentNode) {
            removeNotification();
        }
    }, 6000);
}

// Add notification animations to CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes symbolPop {
        0% {
            transform: scale(0) rotate(0deg);
            opacity: 0;
        }
        50% {
            transform: scale(1.2) rotate(180deg);
            opacity: 1;
        }
        100% {
            transform: scale(1) rotate(360deg);
            opacity: 1;
        }
    }
    
    @keyframes waveExpand {
        0% {
            width: 0;
            height: 0;
            opacity: 0.3;
        }
        50% {
            opacity: 0.2;
        }
        100% {
            width: 200px;
            height: 200px;
            margin-top: -100px;
            margin-right: -100px;
            opacity: 0;
        }
    }
    
    @keyframes slideInNotification {
        0% {
            transform: translateX(400px);
            opacity: 0;
        }
        100% {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutNotification {
        0% {
            transform: translateX(0);
            opacity: 1;
        }
        100% {
            transform: translateX(400px);
            opacity: 0;
        }
    }
    
    @keyframes progressBar {
        0% {
            width: 100%;
        }
        100% {
            width: 0%;
        }
    }
    
    .notification-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    
    .notification-close {
        background: none;
        border: none;
        color: white;
        font-size: 1.2em;
        cursor: pointer;
        margin-left: 15px;
        padding: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .notification-close:hover {
        opacity: 0.7;
    }
`;
document.head.appendChild(style);

// Initialize Vanta Waves background
function initVantaWaves() {
    if (typeof VANTA !== 'undefined' && document.getElementById('vanta-bg')) {
        VANTA.WAVES({
            el: "#vanta-bg",
            color: 0x111111,
            shininess: 50,
            waveHeight: 20,
            waveSpeed: 1,
            zoom: 0.85
        });
    }
}

// Setup password toggle functionality
function setupPasswordToggles() {
    const loginToggle = document.getElementById('loginPasswordToggle');
    const signupToggle = document.getElementById('signupPasswordToggle');
    
    if (loginToggle) {
        loginToggle.addEventListener('click', () => {
            const passwordInput = document.getElementById('loginPassword');
            const toggleIcon = loginToggle.querySelector('.toggle-icon');
            
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                toggleIcon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
            } else {
                passwordInput.type = 'password';
                toggleIcon.innerHTML = '<path d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
            }
        });
    }
    
    if (signupToggle) {
        signupToggle.addEventListener('click', () => {
            const passwordInput = document.getElementById('signupPassword');
            const toggleIcon = signupToggle.querySelector('.toggle-icon');
            
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                toggleIcon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
            } else {
                passwordInput.type = 'password';
                toggleIcon.innerHTML = '<path d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
            }
        });
    }
}

// Setup form switching functionality
function setupFormSwitching() {
    const switchFormLinks = document.querySelectorAll('.switch-form');
    
    switchFormLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = link.dataset.target;
            if (target === 'login') {
                switchTab('login');
            } else if (target === 'signup') {
                switchTab('signup');
            }
        });
    });
    
    // Forgot password functionality
    const forgotPasswordLink = document.querySelector('.forgot-password');
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();

        });
    }
}

// Loading screen functions
function showLoadingScreen() {
    const loadingScreen = document.getElementById('loadingScreen');
    const loginContainer = document.querySelector('.login-container');
    const loginFooter = document.querySelector('.login-footer');
    
    if (loadingScreen) {
        loadingScreen.classList.add('active');
    }
    
    // Hide login elements
    if (loginContainer) {
        loginContainer.style.opacity = '0';
        loginContainer.style.transform = 'scale(0.9)';
        loginContainer.style.transition = 'all 0.3s ease';
    }
    if (loginFooter) {
        loginFooter.style.opacity = '0';
        loginFooter.style.transition = 'all 0.3s ease';
    }
}

function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loadingScreen');
    const loginContainer = document.querySelector('.login-container');
    const loginFooter = document.querySelector('.login-footer');
    
    if (loadingScreen) {
        loadingScreen.classList.remove('active');
    }
    
    // Restore login elements (in case user goes back)
    if (loginContainer) {
        loginContainer.style.opacity = '1';
        loginContainer.style.transform = 'scale(1)';
    }
    if (loginFooter) {
        loginFooter.style.opacity = '1';
    }
}

// Setup security form functionality
function setupSecurityForm() {
    // Password toggles for security form
    const toggles = ['oldPasswordToggle', 'newPasswordToggle', 'confirmPasswordToggle'];
    const inputs = ['oldPassword', 'newPassword', 'confirmPassword'];
    
    toggles.forEach((toggleId, index) => {
        const toggle = document.getElementById(toggleId);
        const input = document.getElementById(inputs[index]);
        
        if (toggle && input) {
            toggle.addEventListener('click', () => {
                const toggleIcon = toggle.querySelector('.toggle-icon');
                
                if (input.type === 'password') {
                    input.type = 'text';
                    toggleIcon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
                } else {
                    input.type = 'password';
                    toggleIcon.innerHTML = '<path d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
                }
            });
        }
    });
    
    // Change password functionality
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', handlePasswordChange);
    }
    
    // Image removal functionality
    const removePfpBtn = document.getElementById('removePfpBtn');
    const removeBannerBtn = document.getElementById('removeBannerBtn');
    
    if (removePfpBtn) {
        removePfpBtn.addEventListener('click', handleRemoveProfilePicture);
    }
    
    if (removeBannerBtn) {
        removeBannerBtn.addEventListener('click', handleRemoveBanner);
    }
}

// Handle password change
async function handlePasswordChange() {
    const oldPassword = document.getElementById('oldPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    // Validation
    if (!oldPassword || !newPassword || !confirmPassword) {
        showNotification('Please fill in all password fields', 'error');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showNotification('New passwords do not match', 'error');
        return;
    }
    
    if (newPassword.length < 6) {
        showNotification('New password must be at least 6 characters', 'error');
        return;
    }
    
    if (oldPassword === newPassword) {
        showNotification('New password must be different from old password', 'error');
        return;
    }
    
    // ASCII validation for new password
    if (!isValidPassword(newPassword)) {
        showNotification('Password contains invalid characters. Only standard ASCII characters allowed.', 'error');
        return;
    }
    
    try {
        // Call the actual API to change password
        await anonteamAPI.changePassword(oldPassword, newPassword);
        
    showNotification('Password changed successfully!', 'success');
    
    // Clear form
    document.getElementById('oldPassword').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmPassword').value = '';
        
    } catch (error) {
        console.error('Password change error:', error);
        showNotification(error.message || 'Failed to change password', 'error');
    }
}

// Handle profile picture removal
async function handleRemoveProfilePicture() {
    if (!confirm('Are you sure you want to remove your profile picture?')) {
        return;
    }
    
    try {
        // Immediately clear UI to force removal
        const profileImage = document.getElementById('profileImage');
        const profileAvatarLarge = document.getElementById('profileAvatarLarge');
        
        if (profileImage) {
            profileImage.src = getDefaultAvatar();
        }
        
        if (profileAvatarLarge) {
            profileAvatarLarge.src = getDefaultAvatar();
        }
        
        // Update currentUser immediately
        currentUser.profileImage = null;
        currentUser.profile_image = null;
        currentUser.profilePicture = null;
        
        // Update localStorage to persist the null values
        localStorage.setItem('anonteamCurrentUser', JSON.stringify(currentUser));
        
        // Call API to remove profile image (pass null as image data)

        const apiResponse = await anonteamAPI.updateProfileImage(null);
        
        showNotification('Profile picture removed successfully!', 'success');
        
        // Update all other avatar instances throughout the app
        updateAllAvatars();
        updateCommentAvatar();
        
        const shoutboxUserAvatar = document.getElementById('shoutboxUserAvatar');
        if (shoutboxUserAvatar) {
            shoutboxUserAvatar.src = getDefaultAvatar();
        }
        
    } catch (error) {
        console.error('Profile picture removal error:', error);
        showNotification(error.message || 'Failed to remove profile picture', 'error');
    }
}

// Handle banner removal
async function handleRemoveBanner() {
    if (!confirm('Are you sure you want to remove your banner image?')) {
        return;
    }
    
    try {
        // Immediately clear banner UI to force removal
        const bannerBackground = document.querySelector('.banner-background');
        const bannerImage = document.getElementById('bannerImage');
        const bannerUpload = document.getElementById('bannerUpload');
        
        if (bannerBackground) {
            // Remove any existing banner image
            if (bannerImage) {
                bannerImage.remove();
            }
            // Clear background image if set
            bannerBackground.style.backgroundImage = '';
            bannerBackground.style.backgroundColor = '';
        }
        
        if (bannerUpload) {
            bannerUpload.style.display = 'block';
        }
        
        // Update currentUser immediately
        currentUser.bannerImage = null;
        currentUser.banner_image = null;
        
        // Update localStorage to persist the null values
        localStorage.setItem('anonteamCurrentUser', JSON.stringify(currentUser));
        
        // Call API to remove banner image (pass null as image data)
        const apiResponse = await anonteamAPI.updateBannerImage(null);
        
        showNotification('Banner image removed successfully!', 'success');
        
        // Banner removal complete - immediate clearing handled everything!
        
    } catch (error) {
        console.error('Banner removal error:', error);
        showNotification(error.message || 'Failed to remove banner image', 'error');
    }
}

// Refresh current user data from server
async function refreshCurrentUserData() {
    try {
        const sessionToken = localStorage.getItem('anonteamSessionToken');
        if (!sessionToken) {
            console.error('No session token found');
            return;
        }
        
        // Use the new get_user endpoint to get fresh user data
        const response = await fetch('/api/auth_endpoints.php?action=get_user', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to refresh user data');
        }
        
        const data = await response.json();
        if (data.success && data.data && data.data.user) {
            // Update current user with fresh data from server
            Object.assign(currentUser, data.data.user);
    
        } else {
            console.error('Invalid response format:', data);
        }
        
    } catch (error) {
        console.error('Failed to refresh user data:', error);
    }
}

// Update all profile displays with current user data
function updateUserProfileDisplay() {
    // Update sidebar profile image
    const profileImage = document.getElementById('profileImage');
    if (profileImage) {
        profileImage.src = currentUser.profileImage || currentUser.profile_image || getDefaultAvatar();
    }
    
    // Update large profile avatar
    const profileAvatarLarge = document.getElementById('profileAvatarLarge');
    if (profileAvatarLarge) {
        profileAvatarLarge.src = currentUser.profileImage || currentUser.profile_image || getDefaultAvatar();
    }
    
    // Update banner - handle removal properly
    const bannerBackground = document.querySelector('.banner-background');
    const bannerImage = document.getElementById('bannerImage');
    const bannerUpload = document.getElementById('bannerUpload');
    const bannerSrc = currentUser.bannerImage || currentUser.banner_image;
    
    if (bannerBackground) {
        if (!bannerSrc) {
            // Remove any existing banner image
            if (bannerImage) {
                bannerImage.remove();
            }
            // Clear background image if set
            bannerBackground.style.backgroundImage = '';
            bannerBackground.style.backgroundColor = '';
        } else {
            // Set banner image if exists
            bannerBackground.style.backgroundImage = `url(${bannerSrc})`;
        }
    }
    
    if (bannerUpload) {
        bannerUpload.style.display = bannerSrc ? 'none' : 'block';
    }
    
    // Update all other avatar instances
    updateAllAvatars();
    
    // Update comment avatars
    updateCommentAvatar();
    
    // Update shoutbox avatar
    const shoutboxUserAvatar = document.getElementById('shoutboxUserAvatar');
    if (shoutboxUserAvatar) {
        shoutboxUserAvatar.src = currentUser.profileImage || currentUser.profile_image || getDefaultAvatar();
    }
}

// Load user subscriptions from localStorage
function loadUserSubscriptions() {
    const savedSubscriptions = localStorage.getItem('anonteamUserSubscriptions');
    if (savedSubscriptions) {
        userSubscriptions = JSON.parse(savedSubscriptions);
    }
    
    // Check for expired subscriptions
    Object.keys(userSubscriptions).forEach(cheatName => {
        const subscription = userSubscriptions[cheatName];
        if (subscription.active && subscription.expiry) {
            const expiryDate = new Date(subscription.expiry);
            if (expiryDate < new Date()) {
                subscription.active = false;
                subscription.status = 'inactive';
                subscription.expiry = null;
            }
        }
    });
    
    // Save updated subscriptions
    localStorage.setItem('anonteamUserSubscriptions', JSON.stringify(userSubscriptions));
}



// Hidden command system
// Command variables removed for security

// SECURITY: Hidden command system completely removed

// SECURITY: Command execution system removed

function generateRandomInviteCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    
    // Generate format: XXXX-XXXX-XXXX
    for (let i = 0; i < 3; i++) {
        if (i > 0) code += '-';
        for (let j = 0; j < 4; j++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
    }
    
    return code;
}

function createInviteCodes(count) {
    const newCodes = [];
    
    for (let i = 0; i < count; i++) {
        let code;
        do {
            code = generateRandomInviteCode();
        } while (validInviteCodes.includes(code) || newCodes.includes(code));
        
        newCodes.push(code);
    }
    
    validInviteCodes.push(...newCodes);
    localStorage.setItem('anonteamValidInviteCodes', JSON.stringify(validInviteCodes));
    
    
    return newCodes;
}

function listInviteCodes() {
    const unusedCodes = validInviteCodes.filter(code => !usedInviteCodes.includes(code));

    showNotification(`${unusedCodes.length} unused codes available. Check console for details.`, 'info');
}

function clearInviteCodes() {
    validInviteCodes = [];
    localStorage.setItem('anonteamValidInviteCodes', JSON.stringify(validInviteCodes));

    showNotification('All invite codes cleared', 'warning');
}

function showInviteStats() {
    const unusedCodes = validInviteCodes.filter(code => !usedInviteCodes.includes(code));
    const stats = {
        total: validInviteCodes.length,
        used: usedInviteCodes.length,
        unused: unusedCodes.length,
        registeredUsers: registeredUsers.length
    };
    

    showNotification(`Stats: ${stats.unused}/${stats.total} codes unused, ${stats.registeredUsers} users registered`, 'info');
}

// Create license key function for admin commands
function createSubscription(cheatName, duration) {
    const validCheats = {
        'compkiller': 'CS:2 Compkiller',
        'neverlose': 'CS:2 Neverlose', 
        'onetap': 'CS:GO Onetap',
        'fatality': 'CS:2 Fatality'
    };
    
    if (!validCheats[cheatName]) {
        showNotification(`Invalid cheat name. Valid cheats: ${Object.keys(validCheats).join(', ')}`, 'error');

        return;
    }
    
    // Parse duration (e.g., "30d", "7d", "1d")
    const durationMatch = duration.match(/^(\d+)d$/);
    if (!durationMatch) {
        showNotification('Invalid duration format. Use format like: 30d, 7d, 1d', 'error');
        return;
    }
    
    const days = parseInt(durationMatch[1]);
    if (days < 1 || days > 365) {
        showNotification('Duration must be between 1 and 365 days', 'error');
        return;
    }
    
    // Generate a license key
    const licenseKey = generateLicenseKey(cheatName, days);
    
    // Store the license key for activation
    if (!window.generatedLicenseKeys) {
        window.generatedLicenseKeys = {};
    }
    
    window.generatedLicenseKeys[licenseKey] = {
        cheat: cheatName,
        duration: days,
        created: new Date().toISOString(),
        used: false
    };
    
    // Save to localStorage
    localStorage.setItem('anonteamGeneratedKeys', JSON.stringify(window.generatedLicenseKeys));
    
    const cheatDisplayName = validCheats[cheatName];
    showNotification(`✅ Generated ${days}d license key for ${cheatDisplayName}`, 'success');

    
    return licenseKey;
}

// Generate a license key
function generateLicenseKey(cheatName, days) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const cheatCodes = {
        'compkiller': 'CK',
        'neverlose': 'NL',
        'onetap': 'OT',
        'fatality': 'FT'
    };
    
    const cheatCode = cheatCodes[cheatName] || 'XX';
    const durationCode = days.toString().padStart(2, '0');
    
    // Generate random parts
    let randomPart1 = '';
    let randomPart2 = '';
    
    for (let i = 0; i < 4; i++) {
        randomPart1 += chars.charAt(Math.floor(Math.random() * chars.length));
        randomPart2 += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // Format: CHEAT-DURATION-RANDOM1-RANDOM2
    return `${cheatCode}${durationCode}-${randomPart1}-${randomPart2}`;
}



// Mobile sidebar functionality
function setupMobileSidebar() {

    const mobileSidebarToggle = document.getElementById('mobileSidebarToggle');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const sidebar = document.querySelector('.sidebar');
    

    
    if (!mobileSidebarToggle || !sidebarOverlay || !sidebar) {
        console.error('Mobile sidebar elements not found!');
        return;
    }
    
    // Toggle sidebar visibility
    function toggleSidebar() {
        const isVisible = sidebar.classList.contains('mobile-visible');
        
        if (isVisible) {
            // Hide sidebar
            sidebar.classList.remove('mobile-visible');
            // Removed overlay deactivation
            document.body.style.overflow = '';
        } else {
            // Show sidebar
            sidebar.classList.add('mobile-visible');
            // Removed overlay activation
            document.body.style.overflow = 'hidden';
        }
        
        // Update toggle button icon
        updateToggleIcon(isVisible);
    }
    
    // Update toggle button icon
    function updateToggleIcon(isClosing) {
        const svg = mobileSidebarToggle.querySelector('svg');
        if (isClosing) {
            // Show hamburger menu icon
            svg.innerHTML = `
                <line x1="3" y1="6" x2="21" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <line x1="3" y1="18" x2="21" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            `;
        } else {
            // Show close icon
            svg.innerHTML = `
                <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            `;
        }
    }
    
    // Event listeners
    mobileSidebarToggle.addEventListener('click', toggleSidebar);
    // Removed overlay click to close - was interfering with sidebar buttons
    
    // Navigation items are handled by the main setupDashboardInteractions function
    // No need for duplicate event listeners here
    
    // Handle window resize
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            // Hide mobile sidebar if window is resized to desktop
            sidebar.classList.remove('mobile-visible');
            sidebarOverlay.classList.remove('active');
            document.body.style.overflow = '';
            updateToggleIcon(true);
        }
    });
    
    // Removed escape key handler to avoid interference
}

// Shoutbox System
class ShoutboxManager {
    constructor() {
        this.shouts = [];
        this.maxShouts = 50; // Limit to 50 messages
        this.storageKey = 'anonteamShoutbox'; // Global shoutbox for all users
        this.lastClearKey = 'anonteamShoutboxLastClear';
        this.lastMessageTime = 0; // Track last message time for cooldown
        this.cooldownDuration = 3000; // 3 seconds cooldown
        this.sendDebounce = null; // Debounce timer for preventing rapid sends
        this.isSending = false; // Flag to prevent multiple sends in progress
        this.init();
    }

    init() {
        this.checkDailyClear();
        this.loadShouts();
        this.setupEventListeners();
        this.renderShouts();
        this.updateCharCount();
        this.updateUserAvatar();
    }

    checkDailyClear() {
        const today = new Date().toDateString();
        const lastClear = localStorage.getItem(this.lastClearKey);
        
        if (lastClear !== today) {
            // Clear messages if it's a new day
            localStorage.removeItem(this.storageKey);
            localStorage.setItem(this.lastClearKey, today);
            this.shouts = [];
        }
    }

    async loadShouts() {
        try {
            const response = await anonteamAPI.getShoutboxMessages();
            this.shouts = response.data || [];
            this.renderShouts();
        } catch (error) {
            console.error('Failed to load shoutbox messages:', error);
            this.shouts = [];
            const shoutboxContainer = document.getElementById('shoutboxMessages');
            if (shoutboxContainer) {
                shoutboxContainer.innerHTML = `
                    <div class="shout-message shout-error">
                        <div class="shout-avatar">
                            <div class="admin-badge">⚠️</div>
                        </div>
                        <div class="shout-content">
                            <div class="shout-username">System</div>
                            <div class="shout-text">Failed to load messages. Please refresh the page.</div>
                            <div class="shout-time">Just now</div>
                        </div>
                    </div>
                `;
            }
        }
    }

    saveShouts() {
        // DISABLED: Shoutbox was localStorage only (not shared between users) 
        return;
    }

    async addMessage(shout) {
        // This is now only used for fallback local messages
        
        // Check if message already exists (prevent duplicates)
        const exists = this.shouts.some(existingShout => existingShout.id === shout.id);
        if (exists) {
            return; // Message already exists, don't add duplicate
        }
        
        // Add the new message
        this.shouts.push(shout);
        
        // Keep only the most recent messages
        if (this.shouts.length > this.maxShouts) {
            this.shouts = this.shouts.slice(-this.maxShouts);
        }

        // Save and render
        this.saveShouts();
        this.renderShouts();
    }

    setInputState(enabled) {
        const input = document.getElementById('shoutboxInput');
        const sendBtn = document.getElementById('shoutboxSend');
        
        if (input) {
            input.disabled = !enabled;
            if (!enabled) {
                input.placeholder = 'Please wait... (cooldown)';
                input.style.opacity = '0.5';
                input.style.cursor = 'not-allowed';
            } else {
                input.placeholder = 'Type your message...';
                input.style.opacity = '1';
                input.style.cursor = 'text';
            }
        }
        
        if (sendBtn) {
            sendBtn.disabled = !enabled;
            if (!enabled) {
                sendBtn.style.opacity = '0.5';
                sendBtn.style.cursor = 'not-allowed';
            } else {
                sendBtn.style.opacity = '1';
                sendBtn.style.cursor = 'pointer';
            }
        }
    }

    startCooldown() {
        // Reset sending flag and re-enable input after full cooldown duration
        setTimeout(() => {
            this.isSending = false;
            this.setInputState(true);
        }, this.cooldownDuration);
    }

    setupEventListeners() {
        const input = document.getElementById('shoutboxInput');
        const sendBtn = document.getElementById('sendShoutBtn');

        if (!input || !sendBtn) {
            console.error('Shoutbox elements not found');
            return;
        }

        // Character count update and mention autocomplete
        input.addEventListener('input', (e) => {
            // Skip processing if input is disabled, but don't prevent the event
            if (input.disabled) {
                return;
            }
            this.updateCharCount();
            this.updateSendButton();
            this.handleMentionAutocomplete(e);
        });

        // Send on Enter key with debouncing
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                // Don't send if disabled or in cooldown
                if (input.disabled || this.isSending) {
                    return;
                }
                // Add debounce to prevent double-sending on fast key presses
                clearTimeout(this.sendDebounce);
                this.sendDebounce = setTimeout(() => {
                    this.sendShout();
                }, 150);
            }
        });

        // Send button click with debouncing
        sendBtn.addEventListener('click', (e) => {
            // Prevent sending if disabled or in cooldown
            if (sendBtn.disabled || this.isSending) {
                e.preventDefault();
                return;
            }
            // Add debounce to prevent double-clicking
            clearTimeout(this.sendDebounce);
            this.sendDebounce = setTimeout(() => {
                this.sendShout();
            }, 150);
        });
    }

    updateCharCount() {
        const input = document.getElementById('shoutboxInput');
        const charCount = document.getElementById('charCount');
        
        if (!input || !charCount) return;
        
        const length = input.value.length;
        charCount.textContent = `${length}/200`;
        
        if (length > 180) {
            charCount.style.color = '#ef4444';
        } else if (length > 150) {
            charCount.style.color = '#f59e0b';
        } else {
            charCount.style.color = '#666666';
        }
    }

    updateSendButton() {
        const input = document.getElementById('shoutboxInput');
        const sendBtn = document.getElementById('sendShoutBtn');
        
        if (!input || !sendBtn) return;
        
        const message = input.value.trim();
        const shouldDisable = message.length === 0 || message.length > 200 || this.isSending || input.disabled;
        
        sendBtn.disabled = shouldDisable;
        
        // Update visual state
        if (shouldDisable) {
            sendBtn.style.opacity = '0.5';
            sendBtn.style.cursor = 'not-allowed';
        } else {
            sendBtn.style.opacity = '1';
            sendBtn.style.cursor = 'pointer';
        }
    }

    updateUserAvatar() {
        const shoutboxUserAvatar = document.getElementById('shoutboxUserAvatar');
        if (shoutboxUserAvatar && currentUser) {
            shoutboxUserAvatar.src = currentUser.profileImage || currentUser.profilePicture || getDefaultAvatar();
        }
    }

    async sendShout() {
        if (!currentUser) {
            this.showQuietNotification('Please log in to send messages', 'error');
            return;
        }

        const input = document.getElementById('shoutboxInput');
        if (!input || this.isSending) return;
        
        const message = input.value.trim();
        if (!message) return;
        
        if (message.length > 200) {
            this.showQuietNotification('Message too long (max 200 characters)', 'error');
            return;
        }
        
        try {
            this.isSending = true;
            this.setInputState(false);
            
            const response = await anonteamAPI.sendShoutboxMessage(message);
            
            // Add the new message to display
            this.shouts.push(response.data);
            
            // Keep only recent messages
            if (this.shouts.length > this.maxShouts) {
                this.shouts = this.shouts.slice(-this.maxShouts);
            }
            
            // Clear input and update UI
            input.value = '';
            this.renderShouts();
            this.updateCharCount();
            this.updateSendButton();
            
            // Check for commands after sending the message
            if (message.toLowerCase() === '!roll') {
                // Handle roll command after the user message appears
                const username = currentUser?.name || currentUser?.username || 'Anonymous';
                this.handleRollCommand(username);
            }
            
            // Start cooldown
            this.startCooldown();
            
        } catch (error) {
            console.error('Failed to send message:', error);
            this.showQuietNotification('Failed to send message: ' + error.message, 'error');
            this.isSending = false;
            this.setInputState(true);
        }
        
        // All message handling is now done via API above - old logic removed
    }

    renderShouts() {
        const container = document.getElementById('shoutboxMessages');
        
        if (this.shouts.length === 0) {
            container.innerHTML = `
                <div class="no-shouts">
                    <div class="no-shouts-icon">💬</div>
                    <h4>No messages yet</h4>
                    <p>Be the first to send a message in the shoutbox!</p>
                </div>
            `;
            return;
        }

        // Calculate how many messages can fit in the visible area
        // Approximate height per message is 70px (including margins)
        const containerHeight = 400 - 32; // 400px height minus 32px padding
        const messageHeight = 70; // Approximate height per message
        const maxVisibleMessages = Math.floor(containerHeight / messageHeight);
        
        // Only show the most recent messages that fit in the visible area
        const visibleShouts = this.shouts.slice(-maxVisibleMessages);

        container.innerHTML = visibleShouts.map(shout => {
            // Get current user info safely
            const currentUserName = currentUser?.name || currentUser?.username;
            const currentUserType = currentUser?.accountType || currentUser?.account_type;
            
            // Handle both old localStorage format and new API format
            const shoutUsername = shout.user ? shout.user.username : shout.username;
            const shoutAccountType = shout.user ? shout.user.accountType : (shout.accountType || 'user');
            
            // Better avatar handling - check multiple sources and current user
            let shoutAvatar = getDefaultAvatar(); // Start with default
            
            if (shout.user && shout.user.profileImage) {
                // API response with user object and profile image
                shoutAvatar = shout.user.profileImage;
            } else if (shout.avatar) {
                // Direct avatar field (old format)
                shoutAvatar = shout.avatar;
            } else if (shoutUsername && currentUser && (shoutUsername === (currentUser.name || currentUser.username))) {
                // This is the current user's message - use their profile picture
                shoutAvatar = currentUser.profileImage || currentUser.profilePicture || getDefaultAvatar();
            }
            
            // Check if this message was sent by the current user
            const isCurrentUser = shoutUsername && currentUserName && (shoutUsername === currentUserName);
            
            // Get account type and colors for the user - handle undefined usernames
            const accountType = shoutUsername === 'analteam' ? 'bot' : 
                (isCurrentUser ? currentUserType || shoutAccountType : 
                shoutAccountType || getUserAccountType(shoutUsername || ''));
            const accountColors = getAccountTypeColor(accountType);
            const isGradient = accountType === 'femboy';
            
            return `
                <div class="shout-item" data-username="${shoutUsername || 'unknown'}" data-account-type="${accountType}">
                    <img class="shout-avatar" src="${shoutAvatar}" alt="${shoutUsername || 'Unknown'}" />
                    <div class="shout-content">
                        <div class="shout-header">
                            <span class="shout-username clickable-username" data-username="${shoutUsername || 'unknown'}" style="${accountType === 'femboy' ? 'background: linear-gradient(45deg, #ec4899, #db2777); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; font-weight: 600;' : (isGradient ? `background: ${accountColors.color}; -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;` : `color: ${accountColors.color};`)}">${shoutUsername || 'Unknown'}</span>
                            ${isCurrentUser ? '<span class="shout-badge">YOU</span>' : ''}
                            ${shoutUsername === 'analteam' ? '<span class="shout-badge" style="background: rgba(16, 185, 129, 0.2); color: #10b981;">BOT</span>' : 
                            `<span class="shout-badge account-type-badge" ${
                                accountType === 'femboy' ? 'style="background: linear-gradient(135deg, #ec4899, #db2777); color: #ffffff;"' :
                                accountType === 'admin' ? 'style="background: #ef4444; color: #ffffff;"' :
                                accountType === 'owner' ? 'style="background: #f59e0b; color: #ffffff;"' :
                                `style="background: ${accountColors.bgColor}; color: ${isGradient ? '#ec4899' : accountColors.color};"`
                            }>${accountColors.name.toUpperCase()}</span>`}
                            <span class="shout-time">${this.formatTime(shout.timestamp || shout.createdAt)}</span>
                        </div>
                        <div class="shout-text">${this.processMentions(shout.message)}</div>
                    </div>
                </div>
            `;
        }).join('');

        // No auto-scroll needed since we're showing only visible messages
        // Messages are automatically aligned to bottom via CSS flexbox
        
        // Add click handlers for mentions and usernames
        this.setupMentionHandlers(container);
        this.setupUsernameHandlers(container);
    }

    formatTime(timestamp) {
        const now = new Date();
        const messageTime = new Date(timestamp);
        const diffMs = now - messageTime;
        const diffMinutes = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMinutes / 60);

        if (diffMinutes < 1) return 'just now';
        if (diffMinutes < 60) return `${diffMinutes}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return messageTime.toLocaleDateString();
    }

    processMentions(text) {
        // First escape HTML to prevent XSS
        const escapedText = this.escapeHtml(text);
        
        // Process @mentions - matches @username.number or @username
        const mentionRegex = /@(\w+(?:\.\d+)?)/g;
        
        return escapedText.replace(mentionRegex, (match, username) => {
            // Only create clickable mention if user is valid
            if (this.isValidUser(username)) {
            return `<span class="mention" data-username="${username}">@${username}</span>`;
            } else {
                // Leave invalid mentions as plain text
                return match;
            }
        });
    }

    setupMentionHandlers(container) {
        const mentions = container.querySelectorAll('.mention');
        mentions.forEach(mention => {
            mention.addEventListener('click', () => {
                const username = mention.dataset.username;
                const input = document.getElementById('shoutboxInput');
                if (input) {
                    // Add mention to input if not already there
                    const currentValue = input.value;
                    const mentionText = `@${username} `;
                    
                    if (!currentValue.includes(mentionText)) {
                        input.value = currentValue + (currentValue ? ' ' : '') + mentionText;
                        input.focus();
                        this.updateCharCount();
                        this.updateSendButton();
                    }
                }
                

            });
        });
    }

    setupUsernameHandlers(container) {
        const usernames = container.querySelectorAll('.clickable-username');
        usernames.forEach(usernameElement => {
            usernameElement.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const username = usernameElement.dataset.username;

                
                // Don't navigate for bot or unknown users
                if (!username || username === 'unknown' || username === 'analteam') {
                    return;
                }
                
                // Navigate to profile section
                const profileNav = document.querySelector('[data-section="profile"]');
                const profileView = document.getElementById('profileView');
                
                if (profileNav && profileView) {
                    // Remove active state from other nav items
                    document.querySelectorAll('.nav-item.active').forEach(nav => nav.classList.remove('active'));
                    
                    // Add active state to profile nav
                    profileNav.classList.add('active');
                    
                    // Switch views
                    document.querySelectorAll('.content-view').forEach(view => view.classList.remove('active'));
                    profileView.classList.add('active');
                    
                    // Update body classes for proper styling
                    document.body.classList.remove('security-active');
                    document.body.classList.add('profile-active');
                    
                    // Update the profile view to show the clicked user's profile
                    updateProfileView(username);
                    
                    // Show quiet notification about viewing profile (no elaborate animations)
                    this.showQuietNotification(`Viewing ${username}'s profile`);
                    

                } else {
                    console.error('Profile navigation elements not found');
                }
            });
        });
    }

    showQuietNotification(message, type = 'info') {
        // Create a simple, non-intrusive notification without the full-screen animations
        let notificationStack = document.querySelector('.notification-stack');
        if (!notificationStack) {
            notificationStack = document.createElement('div');
            notificationStack.className = 'notification-stack';
            notificationStack.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 1000;
                display: flex;
                flex-direction: column;
                align-items: flex-end;
                gap: 12px;
                pointer-events: none;
            `;
            document.body.appendChild(notificationStack);
        }
        
        const config = {
            info: { icon: 'ℹ', accentColor: '#4f46e5' },
            success: { icon: '✓', accentColor: '#10b981' },
            warning: { icon: '⚠', accentColor: '#f59e0b' }
        };
        
        const notificationConfig = config[type] || config.info;
        
        // Create simple notification box (no full-screen animations)
        const notificationBox = document.createElement('div');
        notificationBox.className = 'quiet-notification-box';
        notificationBox.innerHTML = `
            <div class="quiet-notification-content">
                <div class="quiet-notification-icon">${notificationConfig.icon}</div>
                <div class="quiet-notification-text">${message}</div>
            </div>
        `;
        
        notificationBox.style.cssText = `
            background: #1a1a1a;
            color: #ffffff;
            border-radius: 6px;
            border: 1px solid #2a2a2a;
            border-left: 2px solid ${notificationConfig.accentColor};
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            min-width: 250px;
            max-width: 300px;
            overflow: hidden;
            opacity: 0;
            transform: translateX(100px);
            animation: quietSlideIn 0.3s ease-out forwards;
            pointer-events: auto;
        `;
        
        // Style the content
        const content = notificationBox.querySelector('.quiet-notification-content');
        content.style.cssText = `
            display: flex;
            align-items: center;
            padding: 10px 14px;
            gap: 8px;
        `;
        
        // Style the icon
        const icon = notificationBox.querySelector('.quiet-notification-icon');
        icon.style.cssText = `
            width: 20px;
            height: 20px;
            background: ${notificationConfig.accentColor};
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: bold;
            flex-shrink: 0;
            color: white;
        `;
        
        // Style the text
        const text = notificationBox.querySelector('.quiet-notification-text');
        text.style.cssText = `
            font-size: 12px;
            font-weight: 500;
            color: #cccccc;
        `;
        
        // Add to stack
        notificationStack.appendChild(notificationBox);
        
        // Auto remove after 2 seconds
        setTimeout(() => {
            if (notificationBox.parentNode) {
                notificationBox.style.animation = 'quietSlideOut 0.3s ease-in forwards';
                setTimeout(() => {
                    if (notificationBox.parentNode) {
                        notificationBox.remove();
                        // Remove stack if empty
                        if (notificationStack.children.length === 0) {
                            notificationStack.remove();
                        }
                    }
                }, 300);
            }
        }, 2000);
    }

    handleMentionAutocomplete(e) {
        // Enhanced autocomplete for valid usernames
        const input = e.target;
        const value = input.value;
        const cursorPos = input.selectionStart;
        
        // Find @ symbol before cursor
        const beforeCursor = value.substring(0, cursorPos);
        const atIndex = beforeCursor.lastIndexOf('@');
        
        if (atIndex !== -1) {
            const partialUsername = beforeCursor.substring(atIndex + 1);
            const validUsers = this.getValidUsers();
            
            // Find matching users
            const matches = validUsers.filter(user => 
                user.toLowerCase().startsWith(partialUsername.toLowerCase()) && 
                user.toLowerCase() !== partialUsername.toLowerCase()
            );
            
            // Auto-complete if there's exactly one match and user typed at least 2 characters
            if (matches.length === 1 && partialUsername.length >= 2) {
                const match = matches[0];
                const newValue = value.substring(0, atIndex + 1) + match + ' ' + value.substring(cursorPos);
                const newCursorPos = atIndex + 1 + match.length + 1;
                
                input.value = newValue;
                input.setSelectionRange(newCursorPos, newCursorPos);
                this.updateCharCount();
                this.updateSendButton();
            }
        }
        
        // Legacy autocomplete for @admin
        if (value.includes('@') && value.endsWith('@admin')) {
            const newValue = value.slice(0, -6) + '@admin.1 ';
            input.value = newValue;
            input.setSelectionRange(newValue.length, newValue.length);
            this.updateCharCount();
            this.updateSendButton();
        }
    }

    handleRollCommand(username) {
        // Ensure we have a valid username
        const validUsername = username || 'Anonymous';
        
        // Generate random number between 1-6 (proper dice roll)
        const rollNumber = Math.floor(Math.random() * 6) + 1;
        const botMessage = `${validUsername} rolled a dice and rolled... ${rollNumber}!`;
        
        // Add bot message with small delay to appear after user message
        setTimeout(async () => {
            await this.addBotMessage(botMessage);
        }, 500);
    }

    async addBotMessage(message) {
        try {
            // Send bot message through API instead of adding locally
            await anonteamAPI.sendBotMessage(message);
            
            // Reload messages to show the new bot message
            await this.loadShouts();
        } catch (error) {
            console.error('Failed to send bot message:', error);
            // Fallback to local message if API fails
        const botId = 'bot_' + Date.now() + Math.random().toString(36).substr(2, 9);
        const botShout = {
            id: botId,
            username: 'analteam',
            message: message,
            timestamp: new Date().toISOString(),
            avatar: 'https://raw.githubusercontent.com/Daziusm/Daziusm/refs/heads/main/skull-cigar.png'
        };
            await this.addMessage(botShout);
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Validate if a username exists (checks against shoutbox users and known users)
    isValidUser(username) {
        if (!username) return false;
        
        // Check against current user
        if (currentUser && (username === currentUser.name || username === currentUser.username)) {
            return true;
        }
        
        // Check against users who have sent messages in shoutbox
        const shoutboxUsers = new Set();
        this.shouts.forEach(shout => {
            if (shout.username && shout.username !== 'analteam') {
                shoutboxUsers.add(shout.username.toLowerCase());
            }
        });
        
        if (shoutboxUsers.has(username.toLowerCase())) {
            return true;
        }
        
        // Check against known system users
        const knownUsers = [
            'admin', 'admin.1', 'administrator', 'owner', 'analteam',
            'premium', 'femboy', 'moderator', 'mod'
        ];
        
        if (knownUsers.includes(username.toLowerCase())) {
            return true;
        }
        
        // Additional validation could check against API/database here
        // For now, return false for unknown users
        return false;
    }

    // Get list of valid users for autocomplete
    getValidUsers() {
        const users = new Set();
        
        // Add current user
        if (currentUser && (currentUser.name || currentUser.username)) {
            users.add(currentUser.name || currentUser.username);
        }
        
        // Add users from shoutbox messages
        this.shouts.forEach(shout => {
            if (shout.username && shout.username !== 'analteam') {
                users.add(shout.username);
            }
        });
        
        // Add known system users
        const knownUsers = ['admin', 'admin.1', 'owner', 'analteam'];
        knownUsers.forEach(user => users.add(user));
        
        return Array.from(users).sort();
    }

    // Add method to refresh shoutbox when user changes
    refreshForNewUser() {

        this.updateUserAvatar();
        this.renderShouts(); // Re-render to update "YOU" badges correctly
    }
}

// Initialize shoutbox when DOM is loaded
let shoutboxManager;

// Purchase Popup Functionality
// Old PurchaseManager class removed - now using checkout.html redirect system

// Enhanced Admin Panel Functions

// Toggle inline user details expansion
async function showUserDetails(userEmail) {

    
    // Force close any existing modals (safety cleanup)
    const existingModals = document.querySelectorAll('[id*="modal"], .modal, .simple-user-modal');
    existingModals.forEach(modal => {
        modal.style.display = 'none';
        modal.remove();
    });
    
    // Fetch user data from backend API instead of localStorage
    let user;
    try {
        // First try to find user ID from the admin users list
        const allUsersResponse = await anonteamAPI.getAllUsers('', 1, 100);
        let userId = null;
        
        if (allUsersResponse.success && allUsersResponse.data && allUsersResponse.data.users) {
            const foundUser = allUsersResponse.data.users.find(u => u.email === userEmail);
            if (foundUser) {
                userId = foundUser.id;
            }
        }
        
        // If we found the user ID, get their complete details
        if (userId) {
            const detailsResponse = await anonteamAPI.getUserDetails(userId);
            if (detailsResponse.success && detailsResponse.data && detailsResponse.data.user) {
                user = detailsResponse.data.user;

            }
        }
        
        if (!user) {
            // Fallback to localStorage if not found in backend
            user = registeredUsers.find(u => u.email === userEmail);

        }
    } catch (error) {
        console.error('Error fetching user from API:', error);
        // Fallback to localStorage on API error
        user = registeredUsers.find(u => u.email === userEmail);
        
    }
    
    if (!user) {
        showNotification('User not found', 'error');
        return;
    }
    
    // Find the user item element
    const userItems = document.querySelectorAll('.user-item');
    let targetUserItem = null;
    
    userItems.forEach(item => {
        const emailElement = item.querySelector('.user-email');
        if (emailElement && emailElement.textContent === userEmail) {
            targetUserItem = item;
        }
    });
    
    if (!targetUserItem) return;
    
    // Check if details are already expanded (look for sibling element after this user)
    const existingDetails = targetUserItem.nextElementSibling?.classList.contains('user-details-expanded') ? 
                           targetUserItem.nextElementSibling : null;
    if (existingDetails) {
        // Close the expansion
        existingDetails.style.maxHeight = '0px';
        setTimeout(() => {
            existingDetails.remove();
            targetUserItem.classList.remove('expanded');
        }, 300);
        return;
    }
    
    // Close any other expanded details
    document.querySelectorAll('.user-details-expanded').forEach(details => {
        details.style.maxHeight = '0px';
        setTimeout(() => {
            details.remove();
        }, 300);
    });
    document.querySelectorAll('.user-item.expanded').forEach(item => {
        item.classList.remove('expanded');
    });
    
    // Determine user account type and status
    const accountType = user.accountType || getUserAccountType(user.name);
            const isUserAdmin = accountType === 'admin' || accountType === 'owner' || accountType === 'femboy';
    const isUserAlpha = accountType === 'premium' || accountType === 'femboy' || user.isAlpha;
    const isBanned = isUserBanned(user.email);
    
    // Determine role display
    let roleDisplay = 'User';
            if (isUserAdmin) roleDisplay = accountType === 'owner' ? 'Owner' : (accountType === 'femboy' ? 'Femboy' : 'Admin');
    else if (isUserAlpha) roleDisplay = 'Alpha';
    
    // Determine status
    let statusDisplay = isBanned ? 'Banned' : 'Active';
    
    // Get active subscriptions
    let activeSubscriptions = 'None';
    if (user.subscriptions) {
        const activeSubs = Object.entries(user.subscriptions)
            .filter(([cheat, data]) => data.active && new Date(data.expiryDate) > new Date())
            .map(([cheat]) => getCheatDisplayName(cheat));
        if (activeSubs.length > 0) {
            activeSubscriptions = activeSubs.join(', ');
        }
    }
    
    // Create the expanded details element
    const detailsElement = document.createElement('div');
    detailsElement.className = 'user-details-expanded';
    const expandId = 'expand-' + Date.now();
    detailsElement.id = expandId;
    detailsElement.innerHTML = `
        <div class="user-details-content">
            <div class="details-header">
                <h4>Telemetry Information</h4>
                <button class="details-close" onclick="closeUserExpansion('${expandId}')">×</button>
                </div>
            <div class="details-grid">
                <div class="detail-item">
                    <span class="detail-label">HWID Hash:</span>
                    <span class="detail-value hwid-data">${user.telemetry?.hash || user.hwid || 'Not available'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">IP Address:</span>
                    <span class="detail-value ip-address">${user.telemetry?.ip || user.lastIP || 'Not available'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">CPU:</span>
                    <span class="detail-value hardware">${user.telemetry?.cpu || 'Not available'}</span>
            </div>
                <div class="detail-item">
                    <span class="detail-label">Motherboard:</span>
                    <span class="detail-value hardware">${user.telemetry?.mobo || 'Not available'}</span>
        </div>
                <div class="detail-item">
                    <span class="detail-label">GPU:</span>
                    <span class="detail-value hardware">${user.telemetry?.gpu || 'Not available'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">RAM:</span>
                    <span class="detail-value hardware">${user.telemetry?.ram || 'Not available'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Windows:</span>
                    <span class="detail-value system">${user.telemetry?.win_name || 'Not available'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Win Version:</span>
                    <span class="detail-value system">${user.telemetry?.winver || 'Not available'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Drive Hash:</span>
                    <span class="detail-value">${user.telemetry?.drive_serials_hash || 'Not available'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Last HWID Reset:</span>
                    <span class="detail-value reset-data">${user.lastHwidReset ? new Date(user.lastHwidReset).toLocaleDateString() : (user.last_hwid_reset ? new Date(user.last_hwid_reset).toLocaleDateString() : 'Never')}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">HWID Resets:</span>
                    <span class="detail-value reset-data">${user.hwidResetCount !== null && user.hwidResetCount !== undefined ? user.hwidResetCount : (user.hwid_reset_count !== null && user.hwid_reset_count !== undefined ? user.hwid_reset_count : (user.hwidHistory?.length || '0'))} total</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Last Seen:</span>
                    <span class="detail-value">${user.lastSeen ? new Date(user.lastSeen).toLocaleString() : 'Unknown'}</span>
                </div>
                </div>
                ${isAdmin() ? `
                <div class="admin-actions" style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #333;">
                    <h5 style="margin: 0 0 10px 0; color: #a1a1aa;">Admin Actions</h5>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <button onclick="resetUserHwid('${userEmail}')" style="padding: 6px 12px; background: #f59e0b; color: #fff; border: none; border-radius: 4px; font-size: 12px; cursor: pointer; font-weight: 500;">Reset HWID</button>
                        <button onclick="toggleUserAdmin('${userEmail}')" style="padding: 6px 12px; background: ${isUserAdmin ? '#ef4444' : '#10b981'}; color: #fff; border: none; border-radius: 4px; font-size: 12px; cursor: pointer; font-weight: 500;">${isUserAdmin ? 'Remove Admin' : 'Make Admin'}</button>
                        <button onclick="toggleUserAlpha('${userEmail}')" style="padding: 6px 12px; background: ${isUserAlpha ? '#6b7280' : '#8b5cf6'}; color: #fff; border: none; border-radius: 4px; font-size: 12px; cursor: pointer; font-weight: 500;">${isUserAlpha ? 'Remove Alpha' : 'Make Alpha'}</button>
                        <button onclick="showRoleChangeDialog('${userEmail}', '${user.username || user.name}')" style="padding: 6px 12px; background: #3b82f6; color: #fff; border: none; border-radius: 4px; font-size: 12px; cursor: pointer; font-weight: 500;">Change Role</button>
                    </div>
                </div>
                ` : ''}
            </div>
        `;
    
    // Insert the details element AFTER the user item (as a sibling, not child)
    targetUserItem.insertAdjacentElement('afterend', detailsElement);
    targetUserItem.classList.add('expanded');
    
    // Trigger animation
    setTimeout(() => {
        detailsElement.style.maxHeight = detailsElement.scrollHeight + 'px';
    }, 10);
}

// Close user expansion by ID
function closeUserExpansion(expandId) {
    const expansion = document.getElementById(expandId);
    if (!expansion) return;
    
    const userItem = expansion.previousElementSibling;
    expansion.style.maxHeight = '0px';
    
    setTimeout(() => {
        expansion.remove();
        if (userItem) {
            userItem.classList.remove('expanded');
        }
    }, 300);
}

// Helper function to get cheat display name
function getCheatDisplayName(cheatKey) {
    const cheatNames = {
        'compkiller': 'CS:2 Compkiller',
        'neverlose': 'CS:2 Neverlose',
        'onetap': 'CS:GO Onetap',
        'fatality': 'CS:2 Fatality'
    };
    return cheatNames[cheatKey] || cheatKey;
}



// Removed loadHwidHistory - no longer needed for simple modal

// Removed loadCurrentSubscriptions - no longer needed for simple modal

// Removed setupUserModalButtons - no longer needed for simple modal

// Product management functions
function updateProductStatus() {
    // Set correct frozen products: CS:2 Neverlose frozen, Onetap not frozen
    const frozenProducts = JSON.parse(localStorage.getItem('anonteamFrozenProducts') || '["neverlose"]');
    
    // Get subscription statistics
    const stats = getProductStats();
    
    // Update product cards
    updateProductCard('compkiller', stats.compkiller, frozenProducts.includes('compkiller'));
    updateProductCard('neverlose', stats.neverlose, frozenProducts.includes('neverlose'));
    updateProductCard('onetap', stats.onetap, frozenProducts.includes('onetap'));
    updateProductCard('fatality', stats.fatality, frozenProducts.includes('fatality'));
}

function getProductStats() {
    const stats = {
        compkiller: { activeUsers: 0, totalSubs: 0 },
        neverlose: { activeUsers: 0, totalSubs: 0 },
        onetap: { activeUsers: 0, totalSubs: 0 },
        fatality: { activeUsers: 0, totalSubs: 0 }
    };
    
    registeredUsers.forEach(user => {
        if (user.subscriptions) {
            Object.entries(user.subscriptions).forEach(([cheat, data]) => {
                if (stats[cheat]) {
                    stats[cheat].totalSubs++;
                    if (data.active && new Date(data.expiryDate) > new Date()) {
                        stats[cheat].activeUsers++;
                    }
                }
            });
        }
    });
    
    return stats;
}

function updateProductCard(productName, stats, isFrozen) {
    const statusElement = document.getElementById(`${productName}Status`);
    const activeUsersElement = document.getElementById(`${productName}ActiveUsers`);
    const totalSubsElement = document.getElementById(`${productName}TotalSubs`);
    const isAlphaOnly = isProductAlphaOnly(productName);
    
    if (statusElement) {
        let statusText = 'ACTIVE';
        let statusClass = 'active';
        
        if (isFrozen) {
            statusText = 'FROZEN';
            statusClass = 'frozen';
        } else if (isAlphaOnly) {
            statusText = 'ALPHA ONLY';
            statusClass = 'alpha-only';
        }
        
        statusElement.textContent = statusText;
        statusElement.className = `status-badge ${statusClass}`;
    }
    
    if (activeUsersElement) {
        activeUsersElement.textContent = stats.activeUsers;
    }
    
    if (totalSubsElement) {
        totalSubsElement.textContent = stats.totalSubs;
    }
    
    // Update product action buttons
    const productCard = document.querySelector(`[data-product="${productName}"]`);
    if (productCard) {
        const freezeBtn = productCard.querySelector('.freeze-product-btn');
        const unfreezeBtn = productCard.querySelector('.unfreeze-product-btn');
        
        if (freezeBtn && unfreezeBtn) {
            if (isFrozen) {
                freezeBtn.style.display = 'none';
                unfreezeBtn.style.display = 'flex';
            } else {
                freezeBtn.style.display = 'flex';
                unfreezeBtn.style.display = 'none';
            }
        }
    }
    
    // Update global alpha buttons visibility
    updateGlobalAlphaButtons();
}

// Update global alpha button visibility based on selected product
function updateGlobalAlphaButtons() {
    const productSelect = document.getElementById('globalProductSelect');
    const globalAlphaOnlyBtn = document.getElementById('globalAlphaOnlyBtn');
    const globalRemoveAlphaBtn = document.getElementById('globalRemoveAlphaBtn');
    
    if (!productSelect || !globalAlphaOnlyBtn || !globalRemoveAlphaBtn) return;
    
    const selectedProduct = productSelect.value;
    
    if (!selectedProduct) {
        globalAlphaOnlyBtn.style.display = 'none';
        globalRemoveAlphaBtn.style.display = 'none';
        return;
    }
    
    const isAlphaOnly = isProductAlphaOnly(selectedProduct);
    
    if (isAlphaOnly) {
        globalAlphaOnlyBtn.style.display = 'none';
        globalRemoveAlphaBtn.style.display = 'flex';
    } else {
        globalAlphaOnlyBtn.style.display = 'flex';
        globalRemoveAlphaBtn.style.display = 'none';
    }
}

// These functions are now handled by the unified frontend-integration.js system
// but kept here for backward compatibility
function handleGlobalFreeze() {
    if (window.handleGlobalFreeze) {
        window.handleGlobalFreeze();
    }
}

function handleGlobalUnfreeze() {
    if (window.handleGlobalUnfreeze) {
        window.handleGlobalUnfreeze();
    }
}

// Helper function to get product ID by name
function getProductIdByName(productName) {
    const productIds = {
        'compkiller': 1,
        'neverlose': 2,
        'onetap': 3,
        'fatality': 4
    };
    return productIds[productName] || null;
}

async function freezeProduct(productName) {
    const productId = getProductIdByName(productName);
    if (!productId) {
        console.error('Invalid product name:', productName);
        return;
    }
    
    try {
        // Update database first
        const productStates = JSON.parse(localStorage.getItem('productStates') || '{}');
        const currentState = productStates[productName] || { frozen: false, broken: false, alphaOnly: false };
        
        const response = await window.anonteamAPI.updateProductStatus(
            productId, 
            true, // is_frozen
            currentState.alphaOnly, 
            currentState.broken
        );
        
        if (response.success) {
            // Update localStorage only if database update succeeded
            if (!productStates[productName]) {
                productStates[productName] = { frozen: false, broken: false, alphaOnly: false };
            }
            productStates[productName].frozen = true;
            localStorage.setItem('productStates', JSON.stringify(productStates));
            
            // Force UI sync
            updateProductStatusCards();
            updateSubscriptionUI();
            
            
        } else {
            console.error('Failed to freeze product in database:', response.message);
            showNotification('Failed to freeze product: ' + response.message, 'error');
        }
    } catch (error) {
        console.error('Error freezing product:', error);
        showNotification('Failed to freeze product: ' + error.message, 'error');
    }
}

async function unfreezeProduct(productName) {
    const productId = getProductIdByName(productName);
    if (!productId) {
        console.error('Invalid product name:', productName);
        return;
    }
    
    try {
        // Update database first
        const productStates = JSON.parse(localStorage.getItem('productStates') || '{}');
        const currentState = productStates[productName] || { frozen: false, broken: false, alphaOnly: false };
        
        const response = await window.anonteamAPI.updateProductStatus(
            productId, 
            false, // is_frozen
            currentState.alphaOnly, 
            currentState.broken
        );
        
        if (response.success) {
            // Update localStorage only if database update succeeded
            if (!productStates[productName]) {
                productStates[productName] = { frozen: false, broken: false, alphaOnly: false };
            }
            productStates[productName].frozen = false;
            localStorage.setItem('productStates', JSON.stringify(productStates));
            
            // Force UI sync
            updateProductStatusCards();
            updateSubscriptionUI();
            
            
        } else {
            console.error('Failed to unfreeze product in database:', response.message);
            showNotification('Failed to unfreeze product: ' + response.message, 'error');
        }
    } catch (error) {
        console.error('Error unfreezing product:', error);
        showNotification('Failed to unfreeze product: ' + error.message, 'error');
    }
}

async function handleGlobalAlphaOnly() {
    const productSelect = document.getElementById('globalProductSelect');
    const productName = productSelect.value;
    
    if (!productName) {
        showNotification('Please select a product to make alpha only', 'error');
        return;
    }
    
    await setProductAlphaOnly(productName, true);
    showNotification(`${getCheatDisplayName(productName)} is now alpha only`, 'success');
    updateProductStatus();
}

async function handleGlobalRemoveAlpha() {
    const productSelect = document.getElementById('globalProductSelect');
    const productName = productSelect.value;
    
    if (!productName) {
        showNotification('Please select a product to remove alpha restriction', 'error');
        return;
    }
    
    await setProductAlphaOnly(productName, false);
    showNotification(`${getCheatDisplayName(productName)} alpha restriction removed`, 'success');
    updateProductStatus();
}

async function setProductAlphaOnly(productName, isAlphaOnly) {
    const productId = getProductIdByName(productName);
    if (!productId) {
        console.error('Invalid product name:', productName);
        return;
    }
    
    try {
        // Update database first
        const productStates = JSON.parse(localStorage.getItem('productStates') || '{}');
        const currentState = productStates[productName] || { frozen: false, broken: false, alphaOnly: false };
        
        const response = await window.anonteamAPI.updateProductStatus(
            productId, 
            currentState.frozen,
            isAlphaOnly, // is_alpha_only
            currentState.broken
        );
        
        if (response.success) {
            // Update unified productStates in localStorage
            if (!productStates[productName]) {
                productStates[productName] = { frozen: false, broken: false, alphaOnly: false };
            }
            productStates[productName].alphaOnly = isAlphaOnly;
            localStorage.setItem('productStates', JSON.stringify(productStates));
            
            // Update UI immediately
            updateSubscriptionUI();
            updateProductStatusCards();
            
            
        } else {
            console.error('Failed to update product alpha status in database:', response.message);
            showNotification('Failed to update product alpha status: ' + response.message, 'error');
        }
    } catch (error) {
        console.error('Error updating product alpha status:', error);
        showNotification('Failed to update product alpha status: ' + error.message, 'error');
    }
}

function isProductAlphaOnly(productName) {
    const productStates = JSON.parse(localStorage.getItem('productStates') || '{}');
    return productStates[productName]?.alphaOnly || false;
}

// Additional user management functions
function toggleUserAdmin(userEmail) {
    const userIndex = registeredUsers.findIndex(u => u.email === userEmail);
    if (userIndex === -1) return;
    
    const user = registeredUsers[userIndex];
    const currentType = user.accountType || getUserAccountType(user.name);
    const newType = (currentType === 'admin' || currentType === 'owner') ? 'user' : 'admin';
    
    // Update account type
    registeredUsers[userIndex].accountType = newType;
    localStorage.setItem('anonteamUsers', JSON.stringify(registeredUsers));
    
    showNotification(`${user.name} is now ${newType === 'admin' ? 'an admin' : 'a regular user'}`, 'success');
    
    // Refresh modal display
    setTimeout(() => showUserDetails(userEmail), 100);
}

function toggleUserAlpha(userEmail) {
    const userIndex = registeredUsers.findIndex(u => u.email === userEmail);
    if (userIndex === -1) return;
    
    const user = registeredUsers[userIndex];
    const currentType = user.accountType || getUserAccountType(user.name);
    const isCurrentlyAlpha = currentType === 'premium' || user.isAlpha;
    
    if (isCurrentlyAlpha) {
        // Remove alpha/premium status
        registeredUsers[userIndex].accountType = 'user';
        registeredUsers[userIndex].isAlpha = false;
    } else {
        // Grant alpha/premium status
        registeredUsers[userIndex].accountType = 'premium';
        registeredUsers[userIndex].isAlpha = true;
    }
    
    localStorage.setItem('anonteamUsers', JSON.stringify(registeredUsers));
    
    showNotification(`${user.name} is now ${isCurrentlyAlpha ? 'a regular user' : 'alpha/premium'}`, 'success');
    
    // Refresh modal display
    setTimeout(() => showUserDetails(userEmail), 100);
}

async function resetUserHwid(userEmail) {
    try {
        // Use the proper API client with authentication
        const response = await window.anonteamAPI.request('/api/admin_endpoints.php?action=reset_user_hwid', {
            method: 'POST',
            body: JSON.stringify({ 
                email: userEmail,
                reason: 'Admin reset'
            })
        });
        
        if (response.success) {
            showNotification(`HWID reset for user successful`, 'success');
            
            // Force refresh admin users list to show updated counts
            await loadAdminUsers();
            
            // Close and reopen modal to show updated data
            const expandId = `expand_${userEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
            const existingExpansion = document.getElementById(expandId);
            if (existingExpansion) {
                existingExpansion.remove();
            }
            
            // Refresh modal display with delay to ensure data is updated
            setTimeout(() => showUserDetails(userEmail), 500);
            
        } else {
            throw new Error(response.message || 'HWID reset failed');
        }
        
    } catch (error) {
        console.error('Admin HWID reset error:', error);
        
        // Fallback to localStorage method
    const userIndex = registeredUsers.findIndex(u => u.email === userEmail);
        if (userIndex === -1) {
            showNotification('User not found', 'error');
            return;
        }
    
    const user = registeredUsers[userIndex];
    const resetDate = new Date().toISOString();
    
    // Add to HWID history
    if (!user.hwidHistory) user.hwidHistory = [];
    user.hwidHistory.push({
        date: resetDate,
        reason: 'Admin reset',
        oldHwid: user.hwid || 'Unknown'
    });
    
        // Reset HWID and increment counter
    user.hwid = null;
    user.lastHwidReset = resetDate;
        user.hwid_reset_count = (user.hwid_reset_count || 0) + 1;
        user.last_hwid_reset = resetDate;
    
    localStorage.setItem('anonteamUsers', JSON.stringify(registeredUsers));
    
    showNotification(`HWID reset for ${user.name}`, 'success');
    
    // Refresh modal display
    setTimeout(() => showUserDetails(userEmail), 100);
    }
}

// Subscription management functions
function revokeUserSubscription(userEmail, cheatName) {
    const userIndex = registeredUsers.findIndex(u => u.email === userEmail);
    if (userIndex === -1) return;
    
    const user = registeredUsers[userIndex];
    if (user.subscriptions && user.subscriptions[cheatName]) {
        user.subscriptions[cheatName].active = false;
        user.subscriptions[cheatName].expiryDate = new Date().toISOString(); // Set to expired
        
        localStorage.setItem('anonteamUsers', JSON.stringify(registeredUsers));
        
        showNotification(`Revoked ${getCheatDisplayName(cheatName)} subscription for ${user.name}`, 'success');
        
        // Refresh modal display
        setTimeout(() => showUserDetails(userEmail), 100);
    }
}

function extendUserSubscription(userEmail, cheatName) {
    const days = prompt(`Enter number of days to extend ${getCheatDisplayName(cheatName)} subscription:`, '30');
    if (!days || isNaN(days) || parseInt(days) <= 0) {
        showNotification('Invalid number of days', 'error');
        return;
    }
    
    const userIndex = registeredUsers.findIndex(u => u.email === userEmail);
    if (userIndex === -1) return;
    
    const user = registeredUsers[userIndex];
    if (!user.subscriptions) user.subscriptions = {};
    
    const daysToAdd = parseInt(days);
    let newExpiry;
    
    if (user.subscriptions[cheatName] && user.subscriptions[cheatName].active && new Date(user.subscriptions[cheatName].expiryDate) > new Date()) {
        // Extend existing active subscription
        newExpiry = new Date(user.subscriptions[cheatName].expiryDate);
        newExpiry.setDate(newExpiry.getDate() + daysToAdd);
    } else {
        // Create new subscription or reactivate expired one
        newExpiry = new Date();
        newExpiry.setDate(newExpiry.getDate() + daysToAdd);
        
        if (!user.subscriptions[cheatName]) {
            user.subscriptions[cheatName] = {
                startDate: new Date().toISOString()
            };
        }
    }
    
    user.subscriptions[cheatName].active = true;
    user.subscriptions[cheatName].expiryDate = newExpiry.toISOString();
    
    localStorage.setItem('anonteamUsers', JSON.stringify(registeredUsers));
    
    showNotification(`Extended ${getCheatDisplayName(cheatName)} subscription for ${user.name} by ${daysToAdd} days`, 'success');
    
    // Refresh modal display
    setTimeout(() => showUserDetails(userEmail), 100);
}

// Role change dialog
function showRoleChangeDialog(userEmail, userName) {
    const roles = ['user', 'premium', 'femboy', 'admin', 'owner'];
    const currentUser = registeredUsers.find(u => u.email === userEmail);
    const currentRole = currentUser?.accountType || getUserAccountType(userName);
    
    let options = roles.map((role, index) => 
        `${index + 1}. ${role.charAt(0).toUpperCase() + role.slice(1)}${role === currentRole ? ' (current)' : ''}`
    ).join('\n');
    
    const choice = prompt(`Change role for ${userName}:\n${options}\n\nEnter number (1-${roles.length}):`);
    
    if (!choice || isNaN(choice) || parseInt(choice) < 1 || parseInt(choice) > roles.length) {
        return;
    }
    
    const newRole = roles[parseInt(choice) - 1];
    
    if (newRole === currentRole) {
        showNotification('No change made - same role selected', 'info');
        return;
    }
    
    // Update user role
    const userIndex = registeredUsers.findIndex(u => u.email === userEmail);
    if (userIndex !== -1) {
        registeredUsers[userIndex].accountType = newRole;
        if (newRole === 'premium' || newRole === 'femboy') {
            registeredUsers[userIndex].isAlpha = true;
        } else {
            registeredUsers[userIndex].isAlpha = false;
        }
        
        localStorage.setItem('anonteamUsers', JSON.stringify(registeredUsers));
        
        showNotification(`${userName} role changed to ${newRole}`, 'success');
        
        // Refresh modal display
        setTimeout(() => showUserDetails(userEmail), 100);
    }
}

// Product card event handlers
document.addEventListener('DOMContentLoaded', function() {
    // Setup product card event listeners
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('freeze-product-btn')) {
            const productName = e.target.getAttribute('data-product');
            if (productName) {
                freezeProduct(productName);
                showNotification(`${getCheatDisplayName(productName)} has been frozen`, 'success');
                updateProductStatus();
            }
        }
        
        if (e.target.classList.contains('unfreeze-product-btn')) {
            const productName = e.target.getAttribute('data-product');
            if (productName) {
                unfreezeProduct(productName);
                showNotification(`${getCheatDisplayName(productName)} has been unfrozen`, 'success');
                updateProductStatus();
            }
        }
        
        if (e.target.classList.contains('extend-product-btn')) {
            const productName = e.target.getAttribute('data-product');
            if (productName) {
                showBulkExtensionModal(productName);
            }
        }
    });
});

function showBulkExtensionModal(productName) {
    const modal = document.getElementById('bulkExtensionModal');
    const productNameSpan = document.getElementById('bulkProductName');
    const affectedUsersList = document.getElementById('affectedUsersList');
    
    if (productNameSpan) {
        productNameSpan.textContent = getCheatDisplayName(productName);
    }
    
    // Load affected users
    const affectedUsers = registeredUsers.filter(user => {
        return user.subscriptions && 
               user.subscriptions[productName] && 
               user.subscriptions[productName].active &&
               new Date(user.subscriptions[productName].expiryDate) > new Date();
    });
    
    if (affectedUsersList) {
        if (affectedUsers.length === 0) {
            affectedUsersList.innerHTML = '<div class="affected-user-item">No active users for this product</div>';
        } else {
            affectedUsersList.innerHTML = affectedUsers.map(user => 
                `<div class="affected-user-item">${user.name} (${user.email})</div>`
            ).join('');
        }
    }
    
    // Setup confirm button
    const confirmBtn = document.getElementById('confirmBulkExtend');
    const closeBulkModal = document.getElementById('closeBulkModal');
    
    if (confirmBtn) {
        confirmBtn.onclick = () => {
            const days = parseInt(document.getElementById('bulkExtendDays').value);
            if (days && days > 0) {
                bulkExtendSubscriptions(productName, days);
                modal.style.display = 'none';
            } else {
                showNotification('Please enter a valid number of days', 'error');
            }
        };
    }
    
    if (closeBulkModal) {
        closeBulkModal.onclick = () => {
            modal.style.display = 'none';
        };
    }
    
    modal.style.display = 'flex';
}

function bulkExtendSubscriptions(productName, days) {
    let extendedCount = 0;
    
    registeredUsers.forEach((user, index) => {
        if (user.subscriptions && 
            user.subscriptions[productName] && 
            user.subscriptions[productName].active &&
            new Date(user.subscriptions[productName].expiryDate) > new Date()) {
            
            const currentExpiry = new Date(user.subscriptions[productName].expiryDate);
            const newExpiry = new Date(currentExpiry.getTime() + (days * 24 * 60 * 60 * 1000));
            
            registeredUsers[index].subscriptions[productName].expiryDate = newExpiry.toISOString();
            extendedCount++;
        }
    });
    
    localStorage.setItem('anonteamUsers', JSON.stringify(registeredUsers));
    
    showNotification(`Extended ${extendedCount} subscriptions for ${getCheatDisplayName(productName)} by ${days} days`, 'success');
    updateProductStatus();
}

// Add test data for demonstration
function createTestUser() {
    const testUser = {
        name: 'admin',
        email: 'admin@example.com',
        password: 'admin123',
        uid: 'ANT-00001',
        accountType: 'admin',
        isAlpha: true,
        joinDate: new Date().toISOString(),
        discordId: '123456789012345678',
        hwid: 'TEST-HWID-12345',
        steamIds: 'STEAM_0:1:12345678',
        lastHwidReset: new Date('2024-01-15').toISOString(),
        hwidHistory: [
            {
                date: new Date('2024-01-15').toISOString(),
                reason: 'Admin reset',
                oldHwid: 'OLD-HWID-ABCDE'
            }
        ],
        telemetry: {
            cpu: 'Intel Core i7-12700K',
            mobo: 'ASUS ROG STRIX Z690-E',
            gpu: 'NVIDIA GeForce RTX 3080',
            ram: '32GB DDR4-3200',
            drive_serials_hash: 'abc123def456',
            win_name: 'Windows 11 Pro',
            winver: '10.0.22000',
            hash: 'user_telemetry_hash_12345',
            ip: '192.168.1.100'
        },
        subscriptions: {
            compkiller: {
                active: true,
                expiryDate: new Date(Date.now() + (4 * 24 * 60 * 60 * 1000)).toISOString(), // 4 days from now
                startDate: new Date(Date.now() - (26 * 24 * 60 * 60 * 1000)).toISOString() // 26 days ago (30 day sub)
            }
        }
    };
    
    // Check if test user already exists
    const existingUsers = JSON.parse(localStorage.getItem('anonteamUsers') || '[]');
    const testUserExists = existingUsers.find(u => u.email === 'admin@example.com');
    
    if (!testUserExists) {
        existingUsers.push(testUser);
        localStorage.setItem('anonteamUsers', JSON.stringify(existingUsers));
    } else {
        // Update existing test user with complete data
        const userIndex = existingUsers.findIndex(u => u.email === 'admin@example.com');
        if (userIndex !== -1) {
            existingUsers[userIndex] = { ...existingUsers[userIndex], ...testUser };
            localStorage.setItem('anonteamUsers', JSON.stringify(existingUsers));
        }
    }
    
    // Initialize frozen products data if needed
    const frozenProducts = JSON.parse(localStorage.getItem('frozenProducts') || '[]');
    if (!frozenProducts.includes('neverlose')) {
        frozenProducts.push('neverlose');
        localStorage.setItem('frozenProducts', JSON.stringify(frozenProducts));
    }
    
    return testUser;
}

function createAdditionalTestUsers() {
    const existingUsers = JSON.parse(localStorage.getItem('anonteamUsers') || '[]');
    
    const additionalUsers = [
        {
            name: 'testuser1',
            email: 'user1@example.com',
            password: 'pass123',
            uid: 'ANT-00002',
            accountType: 'premium',
            isAlpha: true,
            joinDate: new Date(Date.now() - (15 * 24 * 60 * 60 * 1000)).toISOString(),
            discordId: '987654321098765432',
            hwid: 'USER1-HWID-67890',
            steamIds: 'STEAM_0:0:87654321',
            lastHwidReset: new Date(Date.now() - (5 * 24 * 60 * 60 * 1000)).toISOString(),
            hwidHistory: [
                {
                    date: new Date(Date.now() - (5 * 24 * 60 * 60 * 1000)).toISOString(),
                    reason: 'Hardware upgrade',
                    oldHwid: 'OLD-USER1-HWID-12345'
                },
                {
                    date: new Date(Date.now() - (12 * 24 * 60 * 60 * 1000)).toISOString(),
                    reason: 'System reinstall',
                    oldHwid: 'OLDER-USER1-HWID-98765'
                }
            ],
            telemetry: {
                cpu: 'AMD Ryzen 7 5800X',
                mobo: 'ASUS ROG STRIX B550-F',
                gpu: 'NVIDIA GeForce RTX 3070',
                ram: '32GB DDR4-3600',
                drive_serials_hash: 'xyz456abc789',
                win_name: 'Windows 11 Pro',
                winver: '10.0.22000',
                hash: 'premium_user_hash_67890',
                ip: '192.168.1.150'
            },
            lastSeen: new Date(Date.now() - (2 * 60 * 60 * 1000)).toISOString(),
            subscriptions: {
                neverlose: {
                    active: true,
                    expiryDate: new Date(Date.now() + (10 * 24 * 60 * 60 * 1000)).toISOString(),
                    startDate: new Date(Date.now() - (20 * 24 * 60 * 60 * 1000)).toISOString()
                }
            }
        },
        {
            name: 'regularuser',
            email: 'user2@example.com',
            password: 'pass456',
            uid: 'ANT-00003',
            accountType: 'user',
            isAlpha: false,
            joinDate: new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)).toISOString(),
            discordId: '456789123456789012',
            hwid: 'USER2-HWID-11111',
            steamIds: 'STEAM_0:1:11111111',
            lastHwidReset: new Date(Date.now() - (20 * 24 * 60 * 60 * 1000)).toISOString(),
            hwidHistory: [
                {
                    date: new Date(Date.now() - (20 * 24 * 60 * 60 * 1000)).toISOString(),
                    reason: 'User request',
                    oldHwid: 'OLD-USER2-HWID-99999'
                }
            ],
            telemetry: {
                cpu: 'Intel Core i3-10100F',
                mobo: 'MSI B460M PRO-VDH',
                gpu: 'NVIDIA GeForce GTX 1050 Ti',
                ram: '8GB DDR4-2400',
                drive_serials_hash: 'mno789pqr012',
                win_name: 'Windows 10 Home',
                winver: '10.0.19043',
                hash: 'regular_user_hash_11111',
                ip: '192.168.1.75'
            },
            lastSeen: new Date(Date.now() - (6 * 60 * 60 * 1000)).toISOString(),
            subscriptions: {}
        }
    ];
    
    additionalUsers.forEach(newUser => {
        const exists = existingUsers.find(u => u.email === newUser.email);
        if (!exists) {
            existingUsers.push(newUser);
        }
    });
    
    localStorage.setItem('anonteamUsers', JSON.stringify(existingUsers));
}

// Initialize test data if needed
if (localStorage.getItem('anonteamTestDataInitialized') !== 'true') {
    createTestUser();
    createAdditionalTestUsers();
    localStorage.setItem('anonteamTestDataInitialized', 'true');
}

function isAlpha(user = currentUser) {
    return user && ['admin', 'owner', 'premium'].includes(user.accountType || user.account_type);
}

// Product management functions
function updateProductState(cheatName, frozen = false, broken = false) {
    const productStates = JSON.parse(localStorage.getItem('productStates') || '{}');
    if (!productStates[cheatName]) {
        productStates[cheatName] = {};
    }
    productStates[cheatName].frozen = frozen;
    productStates[cheatName].broken = broken;
    localStorage.setItem('productStates', JSON.stringify(productStates));
    
    // Update UI immediately
    updateSubscriptionUI();
}





// Initialize product states with defaults (all unfrozen/working)
async function initializeProductStates() {

    
    try {
        // Fetch actual product data from database
        const response = await window.anonteamAPI.getProducts();
        
        if (response.success && response.data) {
            const productStates = {};
            
            // Convert database format to our local format
            response.data.forEach(product => {
                productStates[product.name] = {
                    frozen: Boolean(product.is_frozen),
                    broken: Boolean(product.is_broken),
                    alphaOnly: Boolean(product.is_alpha_only)
                };
            });
            
            // Update localStorage with database values
            localStorage.setItem('productStates', JSON.stringify(productStates));
            
            
            // Force immediate sync to ensure both UIs show the same states
            setTimeout(() => {

                forceSync();
            }, 500);
            
        } else {
            console.warn('Failed to load products from database, using fallback defaults');
            initializeDefaultProductStates();
        }
    } catch (error) {
        console.error('Error loading products from database:', error);
        initializeDefaultProductStates();
    }
}

function initializeDefaultProductStates() {
    const existing = localStorage.getItem('productStates');
    if (!existing) {
        const defaultStates = {
            'compkiller': { frozen: false, broken: false, alphaOnly: false },
            'neverlose': { frozen: false, broken: false, alphaOnly: true },  // Default alpha
            'onetap': { frozen: false, broken: false, alphaOnly: true },     // Default alpha
            'fatality': { frozen: false, broken: false, alphaOnly: false }
        };
        localStorage.setItem('productStates', JSON.stringify(defaultStates));

    }
    
    // Force immediate sync to ensure both UIs show the same states
    setTimeout(() => {

        forceSync();
    }, 500);
}

// Product alpha management functions
function setProductAlphaOnly(productName, isAlphaOnly) {
    const productStates = JSON.parse(localStorage.getItem('productStates') || '{}');
    if (!productStates[productName]) {
        productStates[productName] = { frozen: false, broken: false };
    }
    productStates[productName].alphaOnly = isAlphaOnly;
    localStorage.setItem('productStates', JSON.stringify(productStates));
    
    // Update UI immediately
    updateSubscriptionUI();
    updateProductStatusCards();
}

function isProductAlphaOnly(productName) {
    const productStates = JSON.parse(localStorage.getItem('productStates') || '{}');
    return productStates[productName]?.alphaOnly || false;
}

// Update product state function to include alpha status
function updateProductState(cheatName, frozen = false, broken = false, alphaOnly = null) {
    const productStates = JSON.parse(localStorage.getItem('productStates') || '{}');
    if (!productStates[cheatName]) {
        productStates[cheatName] = {};
    }
    productStates[cheatName].frozen = frozen;
    productStates[cheatName].broken = broken;
    if (alphaOnly !== null) {
        productStates[cheatName].alphaOnly = alphaOnly;
    }
    localStorage.setItem('productStates', JSON.stringify(productStates));
    
    // Update UI immediately
    updateSubscriptionUI();
}

// Product status cards now handled by unified system
function updateProductStatusCards() {
    // This function is now handled by the unified SubscriptionUIManager
    if (window.subscriptionUIManager) {
        window.subscriptionUIManager.updateAdminPanel();
    }
}

// ... existing code ...

// Clear all product-related localStorage data and reset to defaults
async function resetAllProductStates() {
    // Clear ALL possible localStorage keys (including legacy ones)
    localStorage.removeItem('productStates');
    localStorage.removeItem('anonteamFrozenProducts');
    localStorage.removeItem('anonteamAlphaOnlyProducts');
    localStorage.removeItem('frozenProducts');
    localStorage.removeItem('anonteamBrokenProducts');
    localStorage.removeItem('brokenProducts');
    localStorage.removeItem('alphaOnlyProducts');
    
    // Reinitialize with defaults
    await initializeProductStates();
    
    // Force immediate UI sync
    setTimeout(() => {
        updateSubscriptionUI();
        updateProductStatusCards();
    
    }, 100);
    
    showNotification('All product states have been reset to defaults', 'success');

}

// Admin function to force UI synchronization
function syncProductStates() {
    updateSubscriptionUI();
    updateProductStatusCards();

}

// Console helper functions for debugging (admin only)
function debugProductStates() {
    const productStates = JSON.parse(localStorage.getItem('productStates') || '{}');

    console.table(productStates);
    
    // Also check for legacy keys
    const legacyFrozen = JSON.parse(localStorage.getItem('anonteamFrozenProducts') || '[]');
    const legacyAlpha = JSON.parse(localStorage.getItem('anonteamAlphaOnlyProducts') || '[]');
    if (legacyFrozen.length > 0) console.warn('Legacy frozen products found:', legacyFrozen);
    if (legacyAlpha.length > 0) console.warn('Legacy alpha products found:', legacyAlpha);
}

// Debug function to reload product states from database
async function reloadFromDatabase() {

    
    try {
        const response = await window.anonteamAPI.getProducts();
        
        if (response.success && response.data) {
            const productStates = {};
            
            response.data.forEach(product => {
                productStates[product.name] = {
                    frozen: Boolean(product.is_frozen),
                    broken: Boolean(product.is_broken),
                    alphaOnly: Boolean(product.is_alpha_only)
                };
            });
            
            localStorage.setItem('productStates', JSON.stringify(productStates));
            
            
            // Force UI update
            updateProductStatusCards();
            updateSubscriptionUI();
            
            showNotification('Product states reloaded from database', 'success');
        } else {
            console.error('Failed to reload from database:', response.message);
            showNotification('Failed to reload from database: ' + response.message, 'error');
        }
    } catch (error) {
        console.error('Error reloading from database:', error);
        showNotification('Error reloading from database: ' + error.message, 'error');
    }
}

function resetProductStates() {
    resetAllProductStates();

}

// Force a complete sync between admin panel and subscription view
function forceSync() {

    const productStates = JSON.parse(localStorage.getItem('productStates') || '{}');

    
    updateProductStatusCards();
    updateSubscriptionUI();
    

}

// Test function to verify synchronization is working
function testSync() {
    // Set fatality to frozen
    const productStates = JSON.parse(localStorage.getItem('productStates') || '{}');
    productStates.fatality = { frozen: true, broken: false, alphaOnly: false };
    localStorage.setItem('productStates', JSON.stringify(productStates));
    
    forceSync();
    
    // Wait 2 seconds then set neverlose to not alpha
    setTimeout(() => {
        const states = JSON.parse(localStorage.getItem('productStates') || '{}');
        states.neverlose = { frozen: false, broken: false, alphaOnly: false };
        localStorage.setItem('productStates', JSON.stringify(states));
        
        forceSync();
        
        // Wait 2 more seconds then reset everything
        setTimeout(() => {
            resetProductStates();
        }, 2000);
    }, 2000);
}

// HTML escaping utility for comments
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Loader Management Functions - Redirect to new system
async function loadLoaderManagement() {
    // Use the new card-based loader management system from loader-management.js
    await loadCheatsGrid();
}

function setupLoaderEventListeners() {
    // Setup file selection
    const selectFileBtn = document.getElementById('selectFileBtn');
    const loaderFileInput = document.getElementById('loaderFileInput');
    const selectedFileName = document.getElementById('selectedFileName');
    const uploadLoaderBtn = document.getElementById('uploadLoaderBtn');
    const loaderCheatSelect = document.getElementById('loaderCheatSelect');
    const refreshLoadersBtn = document.getElementById('refreshLoadersBtn');
    
    if (selectFileBtn && loaderFileInput) {
        selectFileBtn.addEventListener('click', () => {
            loaderFileInput.click();
        });
        
        loaderFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                selectedFileName.textContent = file.name;
                checkUploadReadiness();
            } else {
                selectedFileName.textContent = 'No file selected';
                checkUploadReadiness();
            }
        });
    }
    
    if (uploadLoaderBtn) {
        uploadLoaderBtn.addEventListener('click', handleLoaderUpload);
    }
    
    if (loaderCheatSelect) {
        loaderCheatSelect.addEventListener('change', checkUploadReadiness);
    }
    
    if (refreshLoadersBtn) {
        refreshLoadersBtn.addEventListener('click', loadCurrentLoaders);
    }
}

function checkUploadReadiness() {
    const loaderCheatSelect = document.getElementById('loaderCheatSelect');
    const loaderFileInput = document.getElementById('loaderFileInput');
    const uploadLoaderBtn = document.getElementById('uploadLoaderBtn');
    
    if (loaderCheatSelect && loaderFileInput && uploadLoaderBtn) {
        const hasCheat = loaderCheatSelect.value.trim() !== '';
        const hasFile = loaderFileInput.files.length > 0;
        
        uploadLoaderBtn.disabled = !hasCheat || !hasFile;
    }
}

async function handleLoaderUpload() {
    const loaderCheatSelect = document.getElementById('loaderCheatSelect');
    const loaderFileInput = document.getElementById('loaderFileInput');
    
    if (!loaderCheatSelect.value || !loaderFileInput.files[0]) {
        showNotification('Please select a cheat and file', 'error');
        return;
    }
    
    const cheatName = loaderCheatSelect.value;
    const file = loaderFileInput.files[0];
    
    // Validate file
    if (!file.name.toLowerCase().endsWith('.exe')) {
        showNotification('Only .exe files are allowed', 'error');
        return;
    }
    
    // Check file size (50MB limit)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
        showNotification('File size must be less than 50MB', 'error');
        return;
    }
    
    try {
        showNotification('Uploading loader...', 'info');
        
        const response = await window.anonteamAPI.uploadLoader(cheatName, file);
        
        if (response.success) {
            showNotification('Loader uploaded successfully!', 'success');
            
            // Reset form
            loaderCheatSelect.value = '';
            loaderFileInput.value = '';
            document.getElementById('selectedFileName').textContent = 'No file selected';
            checkUploadReadiness();
            
            // Reload loaders list
            await loadCurrentLoaders();
        } else {
            throw new Error(response.message || 'Upload failed');
        }
    } catch (error) {
        console.error('Loader upload failed:', error);
        showNotification(error.message || 'Failed to upload loader', 'error');
    }
}

async function loadCurrentLoaders() {
    const loadersList = document.getElementById('loadersList');
    if (!loadersList) return;
    
    try {
        loadersList.innerHTML = '<div style="text-align: center; padding: 20px; color: #81a1c1;">Loading loaders...</div>';
        
        const response = await window.anonteamAPI.getLoaders();
        
        if (response.success) {
            displayLoaders(response.data);
        } else {
            throw new Error(response.message || 'Failed to load loaders');
        }
    } catch (error) {
        console.error('Failed to load loaders:', error);
        loadersList.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #bf616a;">
                Failed to load loaders: ${error.message}
            </div>
        `;
    }
}

function displayLoaders(loaders) {
    const loadersList = document.getElementById('loadersList');
    if (!loadersList) return;
    
    if (!loaders || loaders.length === 0) {
        loadersList.innerHTML = `
            <div class="empty-loaders-message">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M7 10L12 15L17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <h4>No Loaders Found</h4>
                <p>Upload some loader files to get started</p>
            </div>
        `;
        return;
    }
    
    loadersList.innerHTML = loaders.map(loader => createLoaderItem(loader)).join('');
}

function createLoaderItem(loader) {
    const uploadDate = new Date(loader.upload_date).toLocaleDateString();
    const fileSize = formatFileSize(loader.file_size);
    const statusClass = loader.is_active ? 'active' : 'inactive';
    const statusText = loader.is_active ? 'Active' : 'Inactive';
    const cheatDisplayName = getCheatDisplayName(loader.cheat_name);
    
    return `
        <div class="loader-item" data-cheat="${loader.cheat_name}">
            <div class="loader-info">
                <div class="loader-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <polyline points="14,2 14,8 20,8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <div class="loader-details">
                    <div class="loader-name">${cheatDisplayName} Loader</div>
                    <div class="loader-meta">
                        <span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            ${loader.original_filename}
                        </span>
                        <span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M21 16V8C21 6.89543 20.1046 6 19 6H5C3.89543 6 3 6.89543 3 8V16C3 17.1046 3.89543 18 5 18H19C20.1046 18 21 17.1046 21 16Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            ${fileSize}
                        </span>
                        <span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                                <polyline points="12,6 12,12 16,14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            ${uploadDate}
                        </span>
                        <span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M7 10L12 15L17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            ${loader.download_count || 0} downloads
                        </span>
                        <span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            ${loader.uploaded_by}
                        </span>
                    </div>
                </div>
            </div>
            <div class="loader-actions">
                <span class="loader-status ${statusClass}">${statusText}</span>
                <button class="admin-btn toggle-btn" onclick="toggleLoaderStatus('${loader.cheat_name}', ${!loader.is_active})">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M17 3C17.5304 3 18.0391 3.21071 18.4142 3.58579C18.7893 3.96086 19 4.46957 19 5V19C19 19.5304 18.7893 20.0391 18.4142 20.4142C18.0391 20.7893 17.5304 21 17 21H7C6.46957 21 5.96086 20.7893 5.58579 20.4142C5.21071 20.0391 5 19.5304 5 19V5C5 4.46957 5.21071 3.96086 5.58579 3.58579C5.96086 3.21071 6.46957 3 7 3H17Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M9 9L11 11L15 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    ${loader.is_active ? 'Disable' : 'Enable'}
                </button>
                <button class="admin-btn delete-btn" onclick="deleteLoader('${loader.cheat_name}')">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 6H5H21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M8 6V4C8 3.44772 8.44772 3 9 3H15C15.5523 3 16 3.44772 16 4V6M19 6V20C19 20.5523 18.5523 21 18 21H6C5.44772 21 5 20.5523 5 20V6H19Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    Delete
                </button>
            </div>
        </div>
    `;
}

async function toggleLoaderStatus(cheatName, isActive) {
    try {
        showNotification(`${isActive ? 'Enabling' : 'Disabling'} loader...`, 'info');
        
        const response = await window.anonteamAPI.toggleLoaderStatus(cheatName, isActive);
        
        if (response.success) {
            showNotification(response.message || `Loader ${isActive ? 'enabled' : 'disabled'} successfully`, 'success');
            await loadCurrentLoaders();
        } else {
            throw new Error(response.message || 'Failed to toggle loader status');
        }
    } catch (error) {
        console.error('Failed to toggle loader status:', error);
        showNotification(error.message || 'Failed to toggle loader status', 'error');
    }
}

async function deleteLoader(cheatName) {
    const cheatDisplayName = getCheatDisplayName(cheatName);
    
    if (!confirm(`Are you sure you want to delete the ${cheatDisplayName} loader? This action cannot be undone.`)) {
        return;
    }
    
    try {
        showNotification('Deleting loader...', 'info');
        
        const response = await window.anonteamAPI.deleteLoader(cheatName);
        
        if (response.success) {
            showNotification(`${cheatDisplayName} loader deleted successfully`, 'success');
            await loadCurrentLoaders();
        } else {
            throw new Error(response.message || 'Failed to delete loader');
        }
    } catch (error) {
        console.error('Failed to delete loader:', error);
        showNotification(error.message || 'Failed to delete loader', 'error');
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Troll Features Functions
function setupTrollFeatures() {
    const flashbangBtn = document.getElementById('flashbangBtn');
    if (flashbangBtn) {
        flashbangBtn.addEventListener('click', triggerFlashbang);
    }
    
    const jobAppBtn = document.getElementById('jobAppBtn');
    if (jobAppBtn) {
        jobAppBtn.addEventListener('click', triggerJobApp);
    }
    
    // Set up job overlay click to close
    const jobOverlay = document.getElementById('jobOverlay');
    if (jobOverlay) {
        jobOverlay.addEventListener('click', () => {
            jobOverlay.classList.remove('active');
        });
    }
    
    // Load users for targeting
    const flashbangTarget = document.getElementById('flashbangTarget');
    const jobAppTarget = document.getElementById('jobAppTarget');
    
    if (flashbangTarget && jobAppTarget) {
        loadFlashbangTargets();
        loadJobAppTargets();
    }
}

async function loadFlashbangTargets() {
    const targetSelect = document.getElementById('flashbangTarget');
    if (!targetSelect) return;
    
    try {
        // Use the existing API wrapper function
        const response = await anonteamAPI.getAllUsers('', 1, 100);
        
        if (response.success && response.data && response.data.users) {
            const users = response.data.users;
            
            // Clear and rebuild the select
            targetSelect.innerHTML = '';
            
            // Add placeholder option
            const placeholderOption = document.createElement('option');
            placeholderOption.value = '';
            placeholderOption.textContent = 'Select a user to flashbang...';
            placeholderOption.disabled = true;
            placeholderOption.selected = true;
            targetSelect.appendChild(placeholderOption);
            
            // Add all actual users to dropdown
            users.forEach(user => {
                const option = document.createElement('option');
                option.value = user.email;
                option.textContent = `${user.username} (${user.email})`;
                targetSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Failed to load users for flashbang targeting:', error);
    }
}

async function triggerFlashbang() {
    const flashbangBtn = document.getElementById('flashbangBtn');
    const flashbangStatus = document.getElementById('flashbangStatus');
    const targetSelect = document.getElementById('flashbangTarget');
    
    if (!flashbangBtn || !flashbangStatus || !targetSelect) return;
    
    const selectedTarget = targetSelect.value;
    const targetText = targetSelect.options[targetSelect.selectedIndex].text;
    
    // Validate that a user is selected
    if (!selectedTarget || selectedTarget === '') {
        return;
    }
    
    // Update button state
    flashbangBtn.disabled = true;
    flashbangBtn.textContent = 'DEPLOYING...';
    flashbangStatus.textContent = `Flashbanging ${targetText}...`;
    flashbangStatus.style.color = '#ffc107';
    
    // Send flashbang command to backend
    try {
        const response = await anonteamAPI.request('/api/admin_endpoints.php?action=flashbang', {
            method: 'POST',
            body: JSON.stringify({
                target: selectedTarget,
                targetName: targetText
            })
        });
        
        // If flashbanging yourself, trigger the effect locally
        if (currentUser && (selectedTarget === currentUser.email || selectedTarget === currentUser.username)) {
            createFlashbangEffect();
        }
    } catch (error) {
        // If flashbanging yourself, still trigger the effect locally even if backend fails
        if (currentUser && (selectedTarget === currentUser.email || selectedTarget === currentUser.username)) {
            createFlashbangEffect();
        }
    }
    
    // Reset button after cooldown
    setTimeout(() => {
        flashbangBtn.disabled = false;
        flashbangBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
                <path d="M12 1V3M12 21V23M4.22 4.22L5.64 5.64M18.36 18.36L19.78 19.78M1 12H3M21 12H23M4.22 19.78L5.64 18.36M18.36 5.64L19.78 4.22" stroke="currentColor" stroke-width="2"/>
            </svg>
            DEPLOY FLASHBANG!
        `;
        flashbangStatus.textContent = 'Select a target to flashbang';
        flashbangStatus.style.color = '#4ade80';
    }, 3000);
}

function createFlashbangEffect() {
    const overlay = document.getElementById('flashbangOverlay');
    if (!overlay) return;
    
    // Play flashbang sound effect
    playFlashbangSound();
    
    // Make the overlay visible instantly
    overlay.classList.add('active');
    overlay.style.opacity = '1';
    
    // Start fade out after a brief moment
    setTimeout(() => {
        overlay.style.transition = 'opacity 2s ease-out';
        overlay.style.opacity = '0';
        
        // Remove the active class after fade completes
        setTimeout(() => {
            overlay.classList.remove('active');
            overlay.style.transition = 'opacity 0.1s ease';
        }, 2000);
    }, 100);
}

function playFlashbangSound() {
    try {
        const audio = new Audio('sound/Flashbang.mp3');
        audio.volume = 0.7; // Set volume to 70% to avoid being too loud
        audio.play().catch(error => {
            // Fallback: try with different audio settings
            audio.muted = false;
            audio.currentTime = 0;
            audio.play().catch(() => {
                // Continue without audio
            });
        });
    } catch (error) {
        // Flashbang audio not available - continue without audio
    }
}

// Function to receive flashbang commands (for future WebSocket implementation)
function receiveFlashbang(data = {}) {
    const adminName = data.adminName || 'An admin';
    const targetInfo = data.target === 'all' ? 'everyone' : 'you';
    
    // Create the flashbang effect
    createFlashbangEffect();
    
    // Flash effect only, no notification
}



// Job Application Troll Functions
async function loadJobAppTargets() {
    const targetSelect = document.getElementById('jobAppTarget');
    if (!targetSelect) return;
    
    try {
        // Use the existing API wrapper function
        const response = await anonteamAPI.getAllUsers('', 1, 100);
        
        if (response.success && response.data && response.data.users) {
            const users = response.data.users;
            
            // Clear and rebuild the select
            targetSelect.innerHTML = '';
            
            // Add placeholder option
            const placeholderOption = document.createElement('option');
            placeholderOption.value = '';
            placeholderOption.textContent = 'Select a user to surprise...';
            placeholderOption.disabled = true;
            placeholderOption.selected = true;
            targetSelect.appendChild(placeholderOption);
            
            // Add all actual users to dropdown
            users.forEach(user => {
                const option = document.createElement('option');
                option.value = user.email;
                option.textContent = `${user.username} (${user.email})`;
                targetSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Failed to load users for job app targeting:', error);
    }
}

async function triggerJobApp() {
    const jobAppBtn = document.getElementById('jobAppBtn');
    const jobAppStatus = document.getElementById('jobAppStatus');
    const targetSelect = document.getElementById('jobAppTarget');
    
    if (!jobAppBtn || !jobAppStatus || !targetSelect) return;
    
    const selectedTarget = targetSelect.value;
    const targetText = targetSelect.options[targetSelect.selectedIndex].text;
    
    // Validate that a user is selected
    if (!selectedTarget || selectedTarget === '') {
        return;
    }
    
    // Update button state
    jobAppBtn.disabled = true;
    jobAppBtn.textContent = 'SENDING...';
    jobAppStatus.textContent = `Sending job application to ${targetText}...`;
    jobAppStatus.style.color = '#ffc107';
    
    // Send job app command to backend
    try {
        const response = await anonteamAPI.request('/api/admin_endpoints.php?action=jobapp', {
            method: 'POST',
            body: JSON.stringify({
                target: selectedTarget,
                targetName: targetText
            })
        });
        
        // If targeting yourself, trigger the effect locally
        if (currentUser && (selectedTarget === currentUser.email || selectedTarget === currentUser.username)) {
            createJobAppEffect();
        }
    } catch (error) {
        // If targeting yourself, still trigger the effect locally even if backend fails
        if (currentUser && (selectedTarget === currentUser.email || selectedTarget === currentUser.username)) {
            createJobAppEffect();
        }
    }
    
    // Reset button after cooldown
    setTimeout(() => {
        jobAppBtn.disabled = false;
        jobAppBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M14 6V2C14 1.44772 13.5523 1 13 1H11C10.4477 1 10 1.44772 10 2V6" stroke="currentColor" stroke-width="2"/>
                <path d="M3 6H21V20C21 21.1046 20.1046 22 19 22H5C3.89543 22 3 21.1046 3 20V6Z" stroke="currentColor" stroke-width="2"/>
            </svg>
            SEND JOB APP!
        `;
        jobAppStatus.textContent = 'Select a target to surprise';
        jobAppStatus.style.color = '#4ade80';
    }, 3000);
}

function createJobAppEffect() {
    const overlay = document.getElementById('jobOverlay');
    if (!overlay) return;
    
    // Make the overlay visible with animation
    overlay.classList.add('active');
    
    // Auto-hide after 10 seconds
    setTimeout(() => {
        overlay.classList.remove('active');
    }, 10000);
}

// Function to receive job app commands (for future WebSocket implementation)
function receiveJobApp(data = {}) {
    const adminName = data.adminName || 'An admin';
    const targetInfo = data.target === 'all' ? 'everyone' : 'you';
    
    // Create the job app effect
    createJobAppEffect();
    
    // Job effect only, no notification
}




