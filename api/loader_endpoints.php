<?php
// Fix path issue by using absolute path
$rootPath = dirname(__DIR__);
require_once 'Auth.php';
require_once 'ApiResponse.php';
require_once $rootPath . '/config/database.php';

class LoaderManager {
    private $conn;
    
    public function __construct($conn) {
        $this->conn = $conn;
        // No longer need upload directory for BLOB storage
    }
    
    public function uploadLoader($cheatName, $file, $uploaderEmail) {
        try {
            // Validate file upload
            if ($file['error'] !== UPLOAD_ERR_OK) {
                throw new Exception('File upload failed: ' . $this->getUploadErrorMessage($file['error']));
            }
            
            // Validate file size (50MB max)
            $maxSize = 50 * 1024 * 1024; // 50MB
            if ($file['size'] > $maxSize) {
                throw new Exception('File size exceeds 50MB limit');
            }
            
            // Check if product exists
            $stmt = $this->conn->prepare("SELECT id FROM products WHERE name = ?");
            $stmt->execute([$cheatName]);
            $product = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$product) {
                throw new Exception('Product not found. Please create the product first.');
            }
            
            // Read uploaded file directly into memory
            $originalName = $file['name'];
            $fileData = file_get_contents($file['tmp_name']);
            
            if ($fileData === false) {
                throw new Exception('Failed to read uploaded file');
            }
            
            // PRESERVE ORIGINAL FILE - NO MODIFICATIONS
            // Calculate file hash from original, unmodified data
            $fileHash = hash('sha256', $fileData);
            
            // Get uploader user ID
            $stmt = $this->conn->prepare("SELECT id FROM users WHERE email = ?");
            $stmt->execute([$uploaderEmail]);
            $uploader = $stmt->fetch(PDO::FETCH_ASSOC);
            $uploaderId = $uploader ? $uploader['id'] : null;
            
            // Delete existing loaders for this cheat (database records only)
            $stmt = $this->conn->prepare("DELETE FROM loaders WHERE cheat_name = ?");
            $stmt->execute([$cheatName]);
            
            // SECURE DATABASE-ONLY STORAGE
            // Files are stored ONLY in database BLOB - never on file system
            
            // Preserve original filename for download
            $secureFilename = $originalName;
            
            // Insert new loader record with BLOB data only
            $stmt = $this->conn->prepare("
                INSERT INTO loaders (cheat_name, filename, original_filename, file_path, file_size, file_hash, file_data, uploaded_by, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
            ");
            $stmt->execute([
                $cheatName,
                $secureFilename,
                $originalName,
                'database_blob', // Indicate secure database-only storage
                strlen($fileData),
                $fileHash,
                $fileData, // Store file data securely in database BLOB
                $uploaderId
            ]);
            
            $loaderId = $this->conn->lastInsertId();
            
            // Log the upload 
            $logMessage = "Uploaded loader for {$cheatName} (SECURE database-only storage)";
            $this->logActivity('loader_upload', $logMessage, $uploaderEmail);
            
            return [
                'success' => true,
                'message' => 'Loader uploaded successfully to secure database storage',
                'data' => [
                    'loader_id' => $loaderId,
                    'cheat_name' => $cheatName,
                    'filename' => $secureFilename,
                    'original_filename' => $originalName,
                    'file_size' => strlen($fileData),
                    'file_hash' => $fileHash,
                    'storage_type' => 'database_only',
                    'pe_modified' => false,
                    'preserved_original' => true,
                    'secure_storage' => true
                ]
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => $e->getMessage()
            ];
        }
    }
    
    public function downloadLoader($cheatName, $userEmail) {
        try {
            // Get active loader for this cheat
            $stmt = $this->conn->prepare("
                SELECT l.*, p.display_name 
                FROM loaders l 
                JOIN products p ON l.cheat_name = p.name 
                WHERE l.cheat_name = ? AND l.is_active = 1 
                ORDER BY l.upload_date DESC 
                LIMIT 1
            ");
            $stmt->execute([$cheatName]);
            $loader = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$loader) {
                throw new Exception('No active loader found for this cheat');
            }
            
            // SECURE DATABASE-ONLY DOWNLOAD
            // Files are ONLY served from secure database BLOB storage
            
            if (empty($loader['file_data'])) {
                throw new Exception('Loader file data not found in secure database storage');
            }
            
            $fileData = $loader['file_data'];
            $storageType = 'database_blob';
            
            // Update download count
            $stmt = $this->conn->prepare("
                UPDATE loaders 
                SET download_count = download_count + 1, last_downloaded_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            ");
            $stmt->execute([$loader['id']]);
            
            // Also update products table download count for compatibility
            $stmt = $this->conn->prepare("
                UPDATE products 
                SET download_count = download_count + 1 
                WHERE name = ?
            ");
            $stmt->execute([$cheatName]);
            
            // Log download activity
            $this->logActivity('loader_download', "Downloaded {$cheatName} loader from secure database storage", $userEmail);
            
            return [
                'success' => true,
                'file_data' => $fileData,
                'filename' => $loader['filename'],
                'original_filename' => $loader['original_filename'],
                'file_size' => strlen($fileData),
                'mime_type' => 'application/octet-stream',
                'storage_type' => $storageType
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => $e->getMessage()
            ];
        }
    }
    
    public function listLoaders() {
        try {
            $stmt = $this->conn->prepare("
                SELECT 
                    l.id,
                    l.cheat_name,
                    l.filename,
                    l.original_filename,
                    l.file_size,
                    l.upload_date,
                    l.uploaded_by,
                    l.is_active,
                    l.download_count,
                    l.last_downloaded_at,
                    p.display_name,
                    p.is_frozen,
                    p.is_broken,
                    p.is_alpha_only,
                    u.username as uploaded_by_username,
                    CASE WHEN l.file_data IS NOT NULL THEN 1 ELSE 0 END as has_blob_data
                FROM loaders l
                LEFT JOIN products p ON l.cheat_name = p.name
                LEFT JOIN users u ON l.uploaded_by = u.id
                ORDER BY l.upload_date DESC
            ");
            $stmt->execute();
            $loaders = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Format data
            foreach ($loaders as &$loader) {
                // Format uploaded_by
                if ($loader['uploaded_by_username']) {
                    $loader['uploaded_by'] = $loader['uploaded_by_username'];
                } else {
                    $loader['uploaded_by'] = 'System';
                }
                
                // Add secure database storage info
                $loader['storage_type'] = $loader['has_blob_data'] ? 'database_only' : 'missing';
                $loader['file_exists'] = (bool)$loader['has_blob_data'];
                $loader['secure_storage'] = true;
                
                // Add product status
                $loader['product_status'] = 'active';
                if ($loader['is_frozen']) {
                    $loader['product_status'] = 'frozen';
                } elseif ($loader['is_broken']) {
                    $loader['product_status'] = 'broken';
                } elseif ($loader['is_alpha_only']) {
                    $loader['product_status'] = 'alpha_only';
                }
                
                // Clean up the response
                unset($loader['uploaded_by_username'], $loader['has_blob_data']);
            }
            
            return [
                'success' => true,
                'data' => $loaders
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => $e->getMessage()
            ];
        }
    }
    
    public function deleteLoader($loaderId, $userEmail) {
        try {
            // Get loader info
            $stmt = $this->conn->prepare("SELECT * FROM loaders WHERE id = ?");
            $stmt->execute([$loaderId]);
            $loader = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$loader) {
                throw new Exception('Loader not found');
            }
            
            // Delete from secure database storage only
            $stmt = $this->conn->prepare("DELETE FROM loaders WHERE id = ?");
            $stmt->execute([$loaderId]);
            
            // Log the deletion
            $this->logActivity('loader_delete', "Deleted loader {$loader['filename']} for {$loader['cheat_name']} (secure database-only storage)", $userEmail);
            
            return [
                'success' => true,
                'message' => 'Loader deleted successfully from secure database storage'
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => $e->getMessage()
            ];
        }
    }
    
    public function toggleLoaderStatus($loaderId, $isActive, $userEmail) {
        try {
            // Update loader status
            $stmt = $this->conn->prepare("UPDATE loaders SET is_active = ? WHERE id = ?");
            $stmt->execute([$isActive ? 1 : 0, $loaderId]);
            
            if ($stmt->rowCount() === 0) {
                throw new Exception('Loader not found');
            }
            
            // Get loader info for logging
            $stmt = $this->conn->prepare("SELECT cheat_name, filename FROM loaders WHERE id = ?");
            $stmt->execute([$loaderId]);
            $loader = $stmt->fetch(PDO::FETCH_ASSOC);
            
            $status = $isActive ? 'activated' : 'deactivated';
            $this->logActivity('loader_status_change', "Loader {$loader['filename']} for {$loader['cheat_name']} {$status}", $userEmail);
            
            return [
                'success' => true,
                'message' => "Loader {$status} successfully"
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => $e->getMessage()
            ];
        }
    }
    
    private function logActivity($type, $description, $username) {
        try {
            $stmt = $this->conn->prepare("
                INSERT INTO activity_logs (type, description, username, timestamp)
                VALUES (?, ?, ?, NOW())
            ");
            $stmt->execute([$type, $description, $username]);
        } catch (Exception $e) {
            // Log activity failure shouldn't break the main operation
            error_log("Failed to log activity: " . $e->getMessage());
        }
    }

    /**
     * Generate a secure one-time download token
     */
    public function generateDownloadToken($cheatName, $userId, $userEmail, $ipAddress, $userAgent) {
        try {
            // Get active loader for this cheat
            $stmt = $this->conn->prepare("
                SELECT l.*, p.display_name 
                FROM loaders l 
                JOIN products p ON l.cheat_name = p.name 
                WHERE l.cheat_name = ? AND l.is_active = 1 
                ORDER BY l.upload_date DESC 
                LIMIT 1
            ");
            $stmt->execute([$cheatName]);
            $loader = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$loader) {
                throw new Exception('No active loader found for this cheat');
            }

            // Clean up expired tokens for this user (housekeeping)
            $this->cleanupExpiredTokens();

            // Check if user already has a valid token for this loader
            $stmt = $this->conn->prepare("
                SELECT token, expires_at FROM download_tokens 
                WHERE user_id = ? AND loader_id = ? AND used_at IS NULL AND expires_at > NOW()
                ORDER BY created_at DESC LIMIT 1
            ");
            $stmt->execute([$userId, $loader['id']]);
            $existingToken = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($existingToken) {
                // Return existing valid token instead of creating new one
                return [
                    'success' => true,
                    'data' => [
                        'token' => $existingToken['token'],
                        'cheat_name' => $cheatName,
                        'loader_id' => $loader['id'],
                        'expires_at' => $existingToken['expires_at'],
                        'filename' => $loader['original_filename'],
                        'file_size' => $loader['file_size'],
                        'reused_token' => true
                    ],
                    'message' => 'Using existing download token'
                ];
            }

            // Generate cryptographically secure token
            $token = bin2hex(random_bytes(32)); // 64 character hex string
            
            // Token expires in 30 minutes for security - use database time for consistency
            $stmt = $this->conn->prepare("SELECT DATE_ADD(NOW(), INTERVAL 30 MINUTE) as expires_time");
            $stmt->execute();
            $timeData = $stmt->fetch(PDO::FETCH_ASSOC);
            $expiresAt = $timeData['expires_time'];

            // Store token in database
            $stmt = $this->conn->prepare("
                INSERT INTO download_tokens (token, user_id, loader_id, cheat_name, expires_at, ip_address, user_agent)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $token,
                $userId,
                $loader['id'],
                $cheatName,
                $expiresAt,
                $ipAddress,
                $userAgent
            ]);

            // Log token generation
            $this->logActivity('download_token_generated', "Generated one-time download token for {$cheatName}", $userEmail);

            return [
                'success' => true,
                'data' => [
                    'token' => $token,
                    'cheat_name' => $cheatName,
                    'loader_id' => $loader['id'],
                    'expires_at' => $expiresAt,
                    'filename' => $loader['original_filename'],
                    'file_size' => $loader['file_size'],
                    'reused_token' => false
                ],
                'message' => 'Secure one-time download token generated'
            ];

        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => $e->getMessage()
            ];
        }
    }

    /**
     * Validate and consume a one-time download token
     */
    public function validateDownloadToken($token, $userEmail) {
        try {
            // Clean token validation without debug noise
            
            // Find valid token
            $stmt = $this->conn->prepare("
                SELECT dt.*, l.*, u.email as user_email
                FROM download_tokens dt
                JOIN loaders l ON dt.loader_id = l.id
                JOIN users u ON dt.user_id = u.id
                WHERE dt.token = ? AND dt.used_at IS NULL AND dt.expires_at > NOW()
            ");
            $stmt->execute([$token]);
            $tokenData = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$tokenData) {
                throw new Exception('Invalid, expired, or already used download token');
            }

            // Verify the user matches (additional security)
            if ($tokenData['user_email'] !== $userEmail) {
                $this->logActivity('download_token_security_violation', "Token {$token} used by wrong user: {$userEmail} (token belongs to {$tokenData['user_email']})", $userEmail);
                throw new Exception('Token does not belong to this user');
            }

            // Check if loader file exists
            if (empty($tokenData['file_data'])) {
                throw new Exception('Loader file data not found in secure database storage');
            }

            // Mark token as used (ONE-TIME USE!)
            $stmt = $this->conn->prepare("
                UPDATE download_tokens 
                SET used_at = NOW() 
                WHERE token = ?
            ");
            $stmt->execute([$token]);

            // Update download counts
            $stmt = $this->conn->prepare("
                UPDATE loaders 
                SET download_count = download_count + 1, last_downloaded_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            ");
            $stmt->execute([$tokenData['loader_id']]);

            // Also update products table for compatibility
            $stmt = $this->conn->prepare("
                UPDATE products 
                SET download_count = download_count + 1 
                WHERE name = ?
            ");
            $stmt->execute([$tokenData['cheat_name']]);

            // Log successful download
            $this->logActivity('download_token_used', "One-time token consumed for {$tokenData['cheat_name']} download", $userEmail);

            return [
                'success' => true,
                'file_data' => $tokenData['file_data'],
                'filename' => $tokenData['filename'],
                'original_filename' => $tokenData['original_filename'],
                'file_size' => strlen($tokenData['file_data']),
                'mime_type' => 'application/octet-stream',
                'cheat_name' => $tokenData['cheat_name']
            ];

        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => $e->getMessage()
            ];
        }
    }

    /**
     * Clean up expired download tokens
     */
    private function cleanupExpiredTokens() {
        try {
            $stmt = $this->conn->prepare("DELETE FROM download_tokens WHERE expires_at < NOW()");
            $stmt->execute();
        } catch (Exception $e) {
            error_log("Failed to cleanup expired tokens: " . $e->getMessage());
        }
    }
    

    
    /**
     * Get human-readable upload error message
     */
    private function getUploadErrorMessage($error) {
        $uploadErrors = [
            UPLOAD_ERR_OK => 'No error',
            UPLOAD_ERR_INI_SIZE => 'File exceeds upload_max_filesize',
            UPLOAD_ERR_FORM_SIZE => 'File exceeds MAX_FILE_SIZE',
            UPLOAD_ERR_PARTIAL => 'File was only partially uploaded',
            UPLOAD_ERR_NO_FILE => 'No file was uploaded',
            UPLOAD_ERR_NO_TMP_DIR => 'Missing temporary folder',
            UPLOAD_ERR_CANT_WRITE => 'Failed to write file to disk',
            UPLOAD_ERR_EXTENSION => 'File upload stopped by extension'
        ];
        
        return $uploadErrors[$error] ?? 'Unknown upload error';
    }
    
    // REMOVED: All PE modification functions - files are now preserved exactly as uploaded
}

// Prevent any output before headers
error_reporting(E_ALL & ~E_NOTICE & ~E_WARNING);
ini_set('display_errors', 0);

// Check if this is a download request first to avoid JSON headers
$isDownload = isset($_GET['action']) && $_GET['action'] === 'download';

if (!$isDownload) {
    // Only start output buffering for non-download requests
    ob_start();
    
    // Handle API requests - set headers early (but NOT for downloads)
    if (!headers_sent()) {
        header('Content-Type: application/json');
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization');
    }
} else {
    // For downloads: ensure no output buffering interferes with binary data
    while (ob_get_level()) {
        ob_end_clean();
    }
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    exit(0);
}

try {
    $database = new Database();
    $conn = $database->getConnection();
    
    $auth = new Auth();
    $loaderManager = new LoaderManager($conn);
    
    // Get request data
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $path = $_GET['action'] ?? '';
    
                    // Debug: Log the parsed action and method  
    // error_log("Loader API - Method: $method, Action: '$path', GET params: " . json_encode($_GET));
    
    // Authentication check for all operations
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    $token = $headers['Authorization'] ?? $_COOKIE['session_token'] ?? null;
    
    if ($token) {
        $token = str_replace('Bearer ', '', $token);
    }
    
    $user = $auth->validateSession($token);
    if (!$user) {
        ApiResponse::error('Authentication required', 401);
        exit;
    }
    
    // Debug logging
    error_log("Loader API - User data: " . json_encode($user));
    error_log("Loader API - Account type: " . ($user['accountType'] ?? 'not_set'));
    
    // Admin check for most operations (except download) - allow femboy, admin, owner roles
    $allowedRoles = ['femboy', 'admin', 'owner'];
    if ($path !== 'download' && !in_array($user['accountType'], $allowedRoles)) {
        ApiResponse::error('Admin access required', 403);
        exit;
    }
    
    switch ($path) {
        case 'upload':
            if ($method !== 'POST') {
                ApiResponse::error('Method not allowed', 405);
                break;
            }
            
            $cheatName = $_POST['cheat_name'] ?? null;
            if (!$cheatName || !isset($_FILES['loader'])) {
                ApiResponse::error('Missing cheat name or file', 400);
                break;
            }
            
            $result = $loaderManager->uploadLoader($cheatName, $_FILES['loader'], $user['email']);
            
            if ($result['success']) {
                ApiResponse::success($result['data'], $result['message']);
            } else {
                ApiResponse::error($result['message'], 400);
            }
            break;
            
        case 'generate_token':
            if ($method !== 'POST') {
                ApiResponse::error('Method not allowed', 405);
                break;
            }
            
            $input = json_decode(file_get_contents('php://input'), true);
            $cheatName = $input['cheat_name'] ?? null;
            
            if (!$cheatName) {
                ApiResponse::error('Missing cheat name', 400);
                break;
            }

            // Get user IP and user agent for security tracking
            $ipAddress = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown';
            $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? 'unknown';

            $result = $loaderManager->generateDownloadToken($cheatName, $user['id'], $user['email'], $ipAddress, $userAgent);
            
            if ($result['success']) {
                ApiResponse::success($result['data'], $result['message']);
            } else {
                ApiResponse::error($result['message'], 400);
            }
            break;

        case 'download':
            if ($method !== 'GET') {
                ApiResponse::error('Method not allowed', 405);
                break;
            }
            
            $token = $_GET['token'] ?? null;
            if (!$token) {
                ApiResponse::error('Missing download token', 400);
                break;
            }
            
            $result = $loaderManager->validateDownloadToken($token, $user['email']);
            
            if ($result['success']) {
                // CRITICAL: Binary download - output buffers already cleaned at script start
                
                // Disable any compression/encoding that might interfere with binary data
                if (function_exists('apache_setenv')) {
                    apache_setenv('no-gzip', '1');
                }
                ini_set('zlib.output_compression', 'Off');
                
                // Set binary-safe headers - clear any previous headers first
                header_remove();
                header('Content-Type: application/octet-stream');
                header('Content-Transfer-Encoding: binary');
                header('Cache-Control: no-cache, no-store, must-revalidate');
                header('Pragma: no-cache');
                header('Expires: 0');
                
                // Properly escape filename for Content-Disposition header
                $safeFilename = addslashes($result['original_filename']);
                header('Content-Disposition: attachment; filename="' . $safeFilename . '"');
                header('Content-Length: ' . strlen($result['file_data']));
                
                // Send binary data directly - no output buffering active
                echo $result['file_data'];
                
                // Immediately exit to prevent any additional output
                exit();
            } else {
                ApiResponse::error($result['message'], 404);
            }
            break;
            
        case 'list':
            if ($method !== 'GET') {
                ApiResponse::error('Method not allowed', 405);
                break;
            }
            
            $result = $loaderManager->listLoaders();
            
            if ($result['success']) {
                ApiResponse::success($result['data']);
            } else {
                ApiResponse::error($result['message'], 500);
            }
            break;
            
        case 'delete':
            if ($method !== 'DELETE') {
                ApiResponse::error('Method not allowed', 405);
                break;
            }
            
            $input = json_decode(file_get_contents('php://input'), true);
            $loaderId = $input['loader_id'] ?? null;
            
            if (!$loaderId) {
                ApiResponse::error('Missing loader ID', 400);
                break;
            }
            
            $result = $loaderManager->deleteLoader($loaderId, $user['email']);
            
            if ($result['success']) {
                ApiResponse::success(null, $result['message']);
            } else {
                ApiResponse::error($result['message'], 400);
            }
            break;
            
        case 'toggle':
            if ($method !== 'POST') {
                ApiResponse::error('Method not allowed', 405);
                break;
            }
            
            $input = json_decode(file_get_contents('php://input'), true);
            $loaderId = $input['loader_id'] ?? null;
            $isActive = isset($input['is_active']) ? (bool)$input['is_active'] : null;
            
            if (!$loaderId || $isActive === null) {
                ApiResponse::error('Missing required parameters', 400);
                break;
            }
            
            $result = $loaderManager->toggleLoaderStatus($loaderId, $isActive, $user['email']);
            
            if ($result['success']) {
                ApiResponse::success(null, $result['message']);
            } else {
                ApiResponse::error($result['message'], 400);
            }
            break;
            
        default:
            error_log("Default case reached - Action: '$path', Available actions: upload, generate_token, download, list, delete, toggle");
            ApiResponse::error('Invalid action', 404);
            break;
    }
    
} catch (Exception $e) {
    // Clean any previous output before sending error response
    if (ob_get_level()) {
        ob_clean();
    }
    ApiResponse::error('Server error: ' . $e->getMessage(), 500);
}

// Clean any unwanted output before final response
if (ob_get_level()) {
    $content = ob_get_contents();
    if (trim($content) === '') {
        ob_end_clean();
    }
}
?> 