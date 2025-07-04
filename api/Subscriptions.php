<?php
// Production security: Disable error display
error_reporting(0);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// Fix path issue by using absolute path
$rootPath = dirname(__DIR__);
require_once $rootPath . '/config/database.php';
require_once 'ApiResponse.php';

class Subscriptions {
    private $conn;

    public function __construct() {
        $database = new Database();
        $this->conn = $database->getConnection();
    }

    public function getUserSubscriptions($userId) {
        try {
            $stmt = $this->conn->prepare("
                SELECT s.*, p.name as product_name, p.display_name, p.is_frozen, p.is_alpha_only, p.is_broken
                FROM subscriptions s
                JOIN products p ON s.product_id = p.id
                WHERE s.user_id = ? AND s.is_active = TRUE
                ORDER BY s.end_date DESC
            ");
            $stmt->execute([$userId]);
            
            return $stmt->fetchAll();
        } catch (PDOException $e) {
            ApiResponse::error('Failed to fetch subscriptions: ' . $e->getMessage());
        }
    }

    public function getAllProducts() {
        try {
            $stmt = $this->conn->prepare("SELECT * FROM products ORDER BY name");
            $stmt->execute();
            
            return $stmt->fetchAll();
        } catch (PDOException $e) {
            ApiResponse::error('Failed to fetch products: ' . $e->getMessage());
        }
    }

    public function activateLicenseKey($keyCode, $userId) {
        if (empty($keyCode)) {
            ApiResponse::error('License key is required');
        }

        try {
            // First check if key exists at all
            $stmt = $this->conn->prepare("
                SELECT lk.*, p.name as product_name, p.display_name, p.is_frozen, p.is_alpha_only
                FROM license_keys lk
                JOIN products p ON lk.product_id = p.id
                WHERE lk.key_code = ?
            ");
            $stmt->execute([$keyCode]);
            $keyInfo = $stmt->fetch();

            if (!$keyInfo) {
                ApiResponse::error('License key not found');
            }

            if ($keyInfo['is_used']) {
                // Check who used it and when
                $stmt = $this->conn->prepare("
                    SELECT u.username, lk.used_at 
                    FROM license_keys lk 
                    LEFT JOIN users u ON lk.used_by = u.id 
                    WHERE lk.key_code = ?
                ");
                $stmt->execute([$keyCode]);
                $usageInfo = $stmt->fetch();
                
                if ($usageInfo && $usageInfo['username']) {
                    ApiResponse::error("License key already used by: {$usageInfo['username']} on " . date('Y-m-d H:i:s', strtotime($usageInfo['used_at'])));
                } else {
                    ApiResponse::error('License key has already been used');
                }
            }

            $key = $keyInfo;

            // Check if product is frozen
            if ($key['is_frozen']) {
                ApiResponse::error('This product is currently frozen and cannot be activated');
            }

            // Check if user already has any subscription for this product (active or inactive)
            $stmt = $this->conn->prepare("
                SELECT * FROM subscriptions 
                WHERE user_id = ? AND product_id = ?
            ");
            $stmt->execute([$userId, $key['product_id']]);
            $existingSub = $stmt->fetch();

            $this->conn->beginTransaction();

            // Mark key as used
            $stmt = $this->conn->prepare("
                UPDATE license_keys 
                SET is_used = TRUE, used_by = ?, used_at = NOW() 
                WHERE id = ?
            ");
            $stmt->execute([$userId, $key['id']]);

            // Calculate subscription dates
            $startDate = date('Y-m-d H:i:s');
            if ($existingSub) {
                // Update existing subscription (extend ONLY if currently active, otherwise start fresh)
                $now = date('Y-m-d H:i:s');
                $currentEndDate = $existingSub['end_date'];
                $isCurrentlyActive = $existingSub['is_active'];
                
                if ($isCurrentlyActive && $currentEndDate > $now) {
                    // Subscription is both active AND not expired - extend it
                    $endDate = date('Y-m-d H:i:s', strtotime($currentEndDate . ' + ' . $key['duration_days'] . ' days'));
                } else {
                    // Subscription is either inactive (revoked) or expired - start fresh from now
                    $endDate = date('Y-m-d H:i:s', strtotime('+ ' . $key['duration_days'] . ' days'));
                }
                
                $stmt = $this->conn->prepare("
                    UPDATE subscriptions 
                    SET start_date = ?, end_date = ?, is_active = TRUE, updated_at = NOW()
                    WHERE id = ?
                ");
                $stmt->execute([$startDate, $endDate, $existingSub['id']]);
            } else {
                // Create new subscription
                $endDate = date('Y-m-d H:i:s', strtotime('+ ' . $key['duration_days'] . ' days'));
                
                $stmt = $this->conn->prepare("
                    INSERT INTO subscriptions (user_id, product_id, start_date, end_date, is_active) 
                    VALUES (?, ?, ?, ?, TRUE)
                ");
                $stmt->execute([$userId, $key['product_id'], $startDate, $endDate]);
            }

            $this->conn->commit();

            // Log activity
            $this->logActivity($userId, 'license_activation', 'Activated license key for ' . $key['display_name']);

            return [
                'product_name' => $key['product_name'],
                'display_name' => $key['display_name'],
                'duration_days' => $key['duration_days'],
                'end_date' => $endDate
            ];

        } catch (PDOException $e) {
            if ($this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            ApiResponse::error('License activation failed: ' . $e->getMessage());
        }
    }

    public function generateLicenseKey($productId, $durationDays, $createdBy = null) {
        if (empty($productId) || empty($durationDays)) {
            ApiResponse::error('Product ID and duration are required');
        }

        try {
            // Handle both product ID and product name
            if (is_numeric($productId)) {
                // Product ID provided
                $stmt = $this->conn->prepare("SELECT id, name, display_name FROM products WHERE id = ?");
                $stmt->execute([$productId]);
            } else {
                // Product name provided
                $stmt = $this->conn->prepare("SELECT id, name, display_name FROM products WHERE name = ?");
                $stmt->execute([$productId]);
            }
            
            $product = $stmt->fetch();

            if (!$product) {
                ApiResponse::error('Product not found');
            }
            
            // Use the actual product ID for database operations
            $actualProductId = $product['id'];

            // Generate unique key
            $keyCode = $this->generateUniqueKey($product['name']);
            
            $stmt = $this->conn->prepare("
                INSERT INTO license_keys (key_code, product_id, duration_days, created_by) 
                VALUES (?, ?, ?, ?)
            ");
            $stmt->execute([$keyCode, $actualProductId, $durationDays, $createdBy]);

            if ($createdBy) {
                $this->logActivity($createdBy, 'key_generation', 'Generated license key for ' . $product['display_name']);
            }

            return [
                'key_code' => $keyCode,
                'product_name' => $product['name'],
                'display_name' => $product['display_name'],
                'duration_days' => $durationDays
            ];

        } catch (PDOException $e) {
            ApiResponse::error('Key generation failed: ' . $e->getMessage());
        }
    }

    public function requestHwidReset($userId, $reason = '') {
        try {
            // Check if user can reset HWID (every 2 weeks)
            $stmt = $this->conn->prepare("
                SELECT hwid_reset_count, last_hwid_reset 
                FROM users WHERE id = ?
            ");
            $stmt->execute([$userId]);
            $user = $stmt->fetch();

            if (!$user) {
                ApiResponse::error('User not found');
            }

            $lastReset = $user['last_hwid_reset'];
            $twoWeeksAgo = date('Y-m-d H:i:s', strtotime('-14 days'));

            if ($lastReset && $lastReset > $twoWeeksAgo) {
                $nextReset = date('Y-m-d H:i:s', strtotime($lastReset . ' + 14 days'));
                ApiResponse::error('HWID reset available in: ' . $nextReset);
            }

            // Reset HWID
            $stmt = $this->conn->prepare("
                UPDATE users 
                SET hwid = NULL, hwid_reset_count = hwid_reset_count + 1, last_hwid_reset = NOW() 
                WHERE id = ?
            ");
            $stmt->execute([$userId]);

            // Log activity
            $this->logActivity($userId, 'hwid_reset', 'HWID reset requested' . ($reason ? ': ' . $reason : ''));

            ApiResponse::success(null, 'HWID reset successful');

        } catch (PDOException $e) {
            ApiResponse::error('HWID reset failed: ' . $e->getMessage());
        }
    }

    public function updateHwid($userId, $hwid) {
        if (empty($hwid)) {
            ApiResponse::error('HWID is required');
        }

        try {
            $stmt = $this->conn->prepare("UPDATE users SET hwid = ? WHERE id = ?");
            $stmt->execute([$hwid, $userId]);

            // HWID update logging disabled for cleaner activity logs

            ApiResponse::success(null, 'HWID updated successfully');

        } catch (PDOException $e) {
            ApiResponse::error('HWID update failed: ' . $e->getMessage());
        }
    }

    public function getHwidResetStatus($userId) {
        try {
            $stmt = $this->conn->prepare("
                SELECT hwid_reset_count, last_hwid_reset 
                FROM users WHERE id = ?
            ");
            $stmt->execute([$userId]);
            $user = $stmt->fetch();

            if (!$user) {
                ApiResponse::error('User not found');
            }

            $lastReset = $user['last_hwid_reset'];
            $twoWeeksAgo = date('Y-m-d H:i:s', strtotime('-14 days'));
            $canReset = !$lastReset || $lastReset <= $twoWeeksAgo;

            return [
                'reset_count' => $user['hwid_reset_count'],
                'last_reset' => $lastReset,
                'can_reset' => $canReset,
                'next_reset' => $canReset ? null : date('Y-m-d H:i:s', strtotime($lastReset . ' + 14 days'))
            ];

        } catch (PDOException $e) {
            ApiResponse::error('Failed to get HWID reset status: ' . $e->getMessage());
        }
    }

    public function getAllLicenseKeys() {
        try {
            $stmt = $this->conn->prepare("
                SELECT lk.key_code, lk.product_id, lk.duration_days, lk.is_used, lk.used_by, lk.used_at, lk.created_by, lk.created_at, p.display_name
                FROM license_keys lk
                JOIN products p ON lk.product_id = p.id
                ORDER BY lk.created_at DESC
            ");
            $stmt->execute();
            $keys = $stmt->fetchAll(PDO::FETCH_ASSOC);
            return $keys;
        } catch (PDOException $e) {
            ApiResponse::error('Failed to fetch license keys: ' . $e->getMessage());
        }
    }

    private function generateUniqueKey($productName) {
        $prefix = strtoupper(substr($productName, 0, 3));
        $key = $prefix . '-' . strtoupper(bin2hex(random_bytes(8)));
        
        // Ensure uniqueness
        $stmt = $this->conn->prepare("SELECT id FROM license_keys WHERE key_code = ?");
        $stmt->execute([$key]);
        
        if ($stmt->rowCount() > 0) {
            return $this->generateUniqueKey($productName);
        }
        
        return $key;
    }

    private function logActivity($userId, $type, $description) {
        try {
            $stmt = $this->conn->prepare("
                INSERT INTO activity_logs (user_id, activity_type, description, ip_address, user_agent) 
                VALUES (?, ?, ?, ?, ?)
            ");
            
            $stmt->execute([
                $userId,
                $type,
                $description,
                $_SERVER['REMOTE_ADDR'] ?? 'unknown',
                $_SERVER['HTTP_USER_AGENT'] ?? 'unknown'
            ]);
        } catch (PDOException $e) {
            // Log error silently
        }
    }
}
?> 