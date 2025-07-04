// Loader Management Functions - New Card-Based System
async function loadLoaderManagement() {
    await loadCheatsGrid();
}

// Define all available cheats with their information
const AVAILABLE_CHEATS = {
    'compkiller': {
        name: 'CS:2 Compkiller',
        type: 'Counter-Strike 2',
        icon: './images/cheats/compkiller.png',
        description: 'Advanced CS:2 cheat with aimbot and ESP'
    },
    'neverlose': {
        name: 'CS:2 Neverlose', 
        type: 'Counter-Strike 2',
        icon: './images/cheats/neverlose.png',
        description: 'Premium CS:2 cheat with HvH features'
    },
    'onetap': {
        name: 'CS:GO Onetap',
        type: 'Counter-Strike GO',
        icon: './images/cheats/onetap.png',
        description: 'Classic CS:GO cheat for HvH'
    },
    'fatality': {
        name: 'CS:2 Fatality',
        type: 'Counter-Strike 2', 
        icon: './images/cheats/fatality.png',
        description: 'High-performance CS:2 cheat'
    }
};

async function loadCheatsGrid() {
    const cheatsGrid = document.getElementById('cheatsGrid');
    if (!cheatsGrid) return;
    
    try {
        cheatsGrid.innerHTML = '<div style="text-align: center; padding: 40px; color: #81a1c1;">Loading cheats...</div>';
        
        // Check if user is logged in first
        if (!window.anonteamAPI.sessionToken) {
            throw new Error('You must be logged in as an admin to manage loaders');
        }
        
        // Load loader information from API
        const response = await window.anonteamAPI.getLoaders();
        const loadersData = response.success ? response.data : [];
        
        // Create a map of existing loaders by cheat name
        const loaderMap = {};
        loadersData.forEach(loader => {
            loaderMap[loader.cheat_name] = loader;
        });
        
        // Generate cards for all cheats
        const cardsHTML = Object.keys(AVAILABLE_CHEATS).map(cheatKey => 
            createCheatCard(cheatKey, AVAILABLE_CHEATS[cheatKey], loaderMap[cheatKey])
        ).join('');
        
        cheatsGrid.innerHTML = cardsHTML;
        
        // Setup event listeners for all cards
        setupCheatCardListeners();
        
    } catch (error) {
        console.error('Failed to load cheats grid:', error);
        
        let errorMessage = error.message;
        
        // Handle specific authentication errors
        if (error.message && error.message.includes('Authentication required')) {
            errorMessage = 'You must be logged in as an admin to access the loader management system.';
        } else if (error.message && error.message.includes('Admin access required')) {
            errorMessage = 'Only administrators can manage loaders.';
        }
        
        cheatsGrid.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #bf616a;">
                <div style="margin-bottom: 20px;">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="opacity: 0.5;">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                        <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" stroke-width="2"/>
                        <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" stroke-width="2"/>
                    </svg>
                </div>
                <div style="margin-bottom: 10px; font-weight: 500;">Failed to load loader management</div>
                <div style="opacity: 0.8; font-size: 14px;">${errorMessage}</div>
                ${!window.anonteamAPI.sessionToken ? `
                    <div style="margin-top: 20px;">
                        <button onclick="showLogin()" style="padding: 8px 16px; background: #5e81ac; color: white; border: none; border-radius: 4px; cursor: pointer;">
                            Login
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }
}

function createCheatCard(cheatKey, cheatInfo, loaderData) {
    const hasLoader = !!loaderData;
    const isActive = hasLoader && loaderData.is_active;
    const loaderId = hasLoader ? loaderData.id : null;
    
    // Status indicator
    let statusClass, statusText;
    if (!hasLoader) {
        statusClass = 'no-loader';
        statusText = 'No Loader';
    } else if (isActive) {
        statusClass = 'has-loader';
        statusText = 'Active';
    } else {
        statusClass = 'inactive';
        statusText = 'Inactive';
    }
    
    // Format dates and user info
    let lastUpdated = 'Never';
    let uploadedBy = 'N/A';
    let downloadCount = 0;
    let fileSize = 'N/A';
    
    if (hasLoader) {
        lastUpdated = new Date(loaderData.upload_date).toLocaleDateString();
        uploadedBy = `${loaderData.uploaded_by}`;
        downloadCount = loaderData.download_count || 0;
        fileSize = formatFileSize(loaderData.file_size);
    }
    
    return `
        <div class="cheat-card" data-cheat="${cheatKey}"${loaderId ? ` data-loader-id="${loaderId}"` : ''}>
            <div class="loader-status-indicator ${statusClass}">${statusText}</div>
            
            <div class="cheat-card-header">
                <div class="cheat-icon">
                    <img src="${cheatInfo.icon}" alt="${cheatInfo.name}" onerror="console.error('Failed to load ${cheatInfo.name} icon'); this.style.display='none';" />
                </div>
                <div class="cheat-info">
                    <div class="cheat-name">${cheatInfo.name}</div>
                    <div class="cheat-type">${cheatInfo.type}</div>
                </div>
            </div>
            
            <div class="cheat-card-details">
                <div class="detail-row">
                    <span class="detail-label">Loader Status:</span>
                    <span class="detail-value ${hasLoader ? 'highlight' : 'muted'}">${hasLoader ? 'Available' : 'Not uploaded'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Last Updated:</span>
                    <span class="detail-value">${lastUpdated}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Uploaded By:</span>
                    <span class="detail-value">${uploadedBy}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Downloads:</span>
                    <span class="detail-value highlight">${downloadCount}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">File Size:</span>
                    <span class="detail-value">${fileSize}</span>
                </div>
            </div>
            
            <div class="cheat-card-actions">
                <button class="admin-btn cheat-btn select-cheat-file-btn" onclick="selectCheatFile('${cheatKey}')">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <polyline points="14,2 14,8 20,8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    Select File
                </button>
                
                ${hasLoader ? `
                    <button class="admin-btn cheat-btn ${isActive ? 'disable-cheat-btn' : 'enable-cheat-btn'}" onclick="toggleCheatLoader('${cheatKey}', ${!isActive})">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M17 3C17.5304 3 18.0391 3.21071 18.4142 3.58579C18.7893 3.96086 19 4.46957 19 5V19C19 19.5304 18.7893 20.0391 18.4142 20.4142C18.0391 20.7893 17.5304 21 17 21H7C6.46957 21 5.96086 20.7893 5.58579 20.4142C5.21071 20.0391 5 19.5304 5 19V5C5 4.46957 5.21071 3.96086 5.58579 3.58579C5.96086 3.21071 6.46957 3 7 3H17Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M9 9L11 11L15 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        ${isActive ? 'Disable' : 'Enable'}
                    </button>
                    <button class="admin-btn cheat-btn delete-cheat-btn" onclick="deleteCheatLoader('${cheatKey}')">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M3 6H5H21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M8 6V4C8 3.44772 8.44772 3 9 3H15C15.5523 3 16 3.44772 16 4V6M19 6V20C19 20.5523 18.5523 21 18 21H6C5.44772 21 5 20.5523 5 20V6H19Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        Delete
                    </button>
                ` : ''}
            </div>
            
            <input type="file" class="cheat-file-input" id="fileInput_${cheatKey}" accept=".exe" style="display: none;">
            <div class="cheat-selected-file" id="selectedFile_${cheatKey}" style="display: none;"></div>
            <div class="cheat-upload-actions" id="uploadActions_${cheatKey}">
                <button class="admin-btn cheat-btn upload-cheat-btn" onclick="uploadCheatLoader('${cheatKey}')" disabled>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M17 8L12 3L7 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M12 3V15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    Upload Loader
                </button>
                <button class="admin-btn cheat-btn cancel-cheat-btn" onclick="cancelCheatFileSelection('${cheatKey}')">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2"/>
                        <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    Cancel
                </button>
            </div>
        </div>
    `;
}

function setupCheatCardListeners() {
    // Setup file input listeners for all cheats
    Object.keys(AVAILABLE_CHEATS).forEach(cheatKey => {
        const fileInput = document.getElementById(`fileInput_${cheatKey}`);
        if (fileInput) {
            fileInput.addEventListener('change', (e) => handleCheatFileSelection(cheatKey, e));
        }
    });
}

function selectCheatFile(cheatKey) {
    const fileInput = document.getElementById(`fileInput_${cheatKey}`);
    if (fileInput) {
        fileInput.click();
    }
}

function handleCheatFileSelection(cheatKey, event) {
    const file = event.target.files[0];
    const selectedFileDiv = document.getElementById(`selectedFile_${cheatKey}`);
    const uploadActions = document.getElementById(`uploadActions_${cheatKey}`);
    const uploadBtn = uploadActions.querySelector('.upload-cheat-btn');
    
    if (file) {
        // Validate file
        if (!file.name.toLowerCase().endsWith('.exe')) {
            showNotification('Only .exe files are allowed', 'error');
            event.target.value = '';
            return;
        }
        
        // Check file size (50MB limit)
        const maxSize = 50 * 1024 * 1024;
        if (file.size > maxSize) {
            showNotification('File size must be less than 50MB', 'error');
            event.target.value = '';
            return;
        }
        
        // Show selected file and upload actions
        selectedFileDiv.textContent = `Selected: ${file.name} (${formatFileSize(file.size)})`;
        selectedFileDiv.style.display = 'block';
        uploadActions.classList.add('show');
        uploadBtn.disabled = false;
    } else {
        // Hide file selection
        selectedFileDiv.style.display = 'none';
        uploadActions.classList.remove('show');
        uploadBtn.disabled = true;
    }
}

function cancelCheatFileSelection(cheatKey) {
    const fileInput = document.getElementById(`fileInput_${cheatKey}`);
    const selectedFileDiv = document.getElementById(`selectedFile_${cheatKey}`);
    const uploadActions = document.getElementById(`uploadActions_${cheatKey}`);
    
    fileInput.value = '';
    selectedFileDiv.style.display = 'none';
    uploadActions.classList.remove('show');
}

async function uploadCheatLoader(cheatKey) {
    const fileInput = document.getElementById(`fileInput_${cheatKey}`);
    const file = fileInput.files[0];
    
    if (!file) {
        showNotification('Please select a file first', 'error');
        return;
    }
    
    try {
        const cheatName = AVAILABLE_CHEATS[cheatKey].name;
        showNotification(`Uploading ${cheatName} loader... (This will replace any existing loader)`, 'info');
        
        // Pass the cheat key (not display name) to the API
        const response = await window.anonteamAPI.uploadLoader(cheatKey, file);
        
        if (response.success) {
            showNotification(`${cheatName} loader uploaded successfully! Previous loader replaced.`, 'success');
            
            // Reset file selection
            cancelCheatFileSelection(cheatKey);
            
            // Reload the entire grid to show updated information
            await loadCheatsGrid();
        } else {
            throw new Error(response.message || 'Upload failed');
        }
    } catch (error) {
        console.error('Loader upload failed:', error);
        let errorMsg = error.message || 'Failed to upload loader';
        
        // Add helpful context for common errors
        if (errorMsg.includes('constraint')) {
            errorMsg = 'Upload failed due to database constraint. Please try again.';
        } else if (errorMsg.includes('Duplicate')) {
            errorMsg = 'Upload failed due to duplicate entry. Refreshing and trying again...';
            // Auto-refresh and retry might help with race conditions
            setTimeout(() => loadCheatsGrid(), 1000);
        }
        
        showNotification(errorMsg, 'error');
    }
}

async function toggleCheatLoader(cheatKey, isActive) {
    try {
        // Get loader ID from the card data
        const cheatCard = document.querySelector(`.cheat-card[data-cheat="${cheatKey}"]`);
        let loaderId = cheatCard ? cheatCard.dataset.loaderId : null;
        
        // Fallback: Try to find loader ID from API data directly
        if (!loaderId || loaderId === '' || loaderId === 'null' || loaderId === 'undefined') {
            try {
                const response = await window.anonteamAPI.getLoaders();
                const loadersData = response.success ? response.data : [];
                
                // Try to find by cheat key first
                let loaderMatch = loadersData.find(loader => loader.cheat_name === cheatKey);
                
                // If not found by cheat key, try to find by cheat display name
                if (!loaderMatch) {
                    const cheatDisplayName = AVAILABLE_CHEATS[cheatKey]?.name;
                    loaderMatch = loadersData.find(loader => 
                        loader.cheat_name === cheatDisplayName ||
                        loader.display_name === cheatDisplayName ||
                        loader.original_filename?.toLowerCase().includes(cheatKey.toLowerCase())
                    );
                }
                
                if (loaderMatch) {
                    loaderId = loaderMatch.id;
                }
            } catch (fallbackError) {
                console.error('Toggle: Fallback API call failed:', fallbackError);
            }
        }
        
        if (!loaderId || loaderId === '' || loaderId === 'null' || loaderId === 'undefined') {
            throw new Error('No loader found for this cheat');
        }
        
        const cheatName = AVAILABLE_CHEATS[cheatKey].name;
        showNotification(`${isActive ? 'Enabling' : 'Disabling'} ${cheatName} loader...`, 'info');
        
        const response = await window.anonteamAPI.toggleLoaderStatus(parseInt(loaderId), isActive);
        
        if (response.success) {
            showNotification(`${cheatName} loader ${isActive ? 'enabled' : 'disabled'} successfully`, 'success');
            await loadCheatsGrid();
        } else {
            throw new Error(response.message || 'Failed to toggle loader status');
        }
    } catch (error) {
        console.error('Failed to toggle loader status:', error);
        showNotification(error.message || 'Failed to toggle loader status', 'error');
    }
}

async function deleteCheatLoader(cheatKey) {
    const cheatName = AVAILABLE_CHEATS[cheatKey].name;
    
    if (!confirm(`Are you sure you want to delete the ${cheatName} loader? This action cannot be undone.`)) {
        return;
    }
    
    try {
        // Get loader ID from the card data
        const cheatCard = document.querySelector(`.cheat-card[data-cheat="${cheatKey}"]`);
        let loaderId = cheatCard ? cheatCard.dataset.loaderId : null;
        
        // Fallback: Try to find loader ID from API data directly
        if (!loaderId || loaderId === '' || loaderId === 'null' || loaderId === 'undefined') {
            try {
                const response = await window.anonteamAPI.getLoaders();
                const loadersData = response.success ? response.data : [];
                
                // Try to find by cheat key first
                let loaderMatch = loadersData.find(loader => loader.cheat_name === cheatKey);
                
                // If not found by cheat key, try to find by cheat display name
                if (!loaderMatch) {
                    const cheatDisplayName = AVAILABLE_CHEATS[cheatKey]?.name;
                    loaderMatch = loadersData.find(loader => 
                        loader.cheat_name === cheatDisplayName ||
                        loader.display_name === cheatDisplayName ||
                        loader.original_filename?.toLowerCase().includes(cheatKey.toLowerCase())
                    );
                }
                
                if (loaderMatch) {
                    loaderId = loaderMatch.id;
                }
            } catch (fallbackError) {
                console.error('Fallback API call failed:', fallbackError);
            }
        }
        
        if (!loaderId || loaderId === '' || loaderId === 'null' || loaderId === 'undefined') {
            throw new Error('No loader found for this cheat');
        }
        
        showNotification(`Deleting ${cheatName} loader...`, 'info');
        
        const response = await window.anonteamAPI.deleteLoader(parseInt(loaderId));
        
        if (response.success) {
            showNotification(`${cheatName} loader deleted successfully`, 'success');
            await loadCheatsGrid();
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

// Legacy functions for backward compatibility
async function loadCurrentLoaders() {
    await loadCheatsGrid();
}

function displayLoaders(loaders) {
    // This function is now handled by loadCheatsGrid()
    loadCheatGrid();
}

function toggleLoaderStatus(cheatName, isActive) {
    // Redirect to new function
    return toggleCheatLoader(cheatName, isActive);
}

function deleteLoader(cheatName) {
    // Redirect to new function
    return deleteCheatLoader(cheatName);
}