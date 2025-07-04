<?php
// Production security: Disable error display
error_reporting(0);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// Fix path issue by using absolute path
$rootPath = dirname(__DIR__);
require_once $rootPath . '/config/database.php';
require_once 'ApiResponse.php';
require_once __DIR__ . '/utils.php';

class Admin {
    private $conn;

    public function __construct() {
        $database = new Database();
        $this->conn = $database->getConnection();
    }

    public function getAllUsers($search = '', $page = 1, $limit = 20) {
        try {
            $offset = ($page - 1) * $limit;
            $whereClause = '';
            $params = [];
            
            // Log admin search activity
            if (!empty($search) && isset($_SESSION['user_id'])) {
                $this->logActivity($_SESSION['user_id'], 'admin_search_users', "ADMIN ACTION: Searched users with term: '$search'");
            }
            
            if (!empty($search)) {
                $whereClause = "WHERE u.username LIKE :search1 OR u.email LIKE :search2 OR u.id LIKE :search3";
                $searchTerm = "%$search%";
            }
            
            $stmt = $this->conn->prepare("
                SELECT u.*, 
                       COUNT(s.id) as active_subscriptions,
                       COUNT(DISTINCT ic.id) as invite_codes_created,
                       COUNT(DISTINCT ic2.id) as invite_codes_used
                FROM users u
                LEFT JOIN subscriptions s ON u.id = s.user_id AND s.is_active = TRUE
                LEFT JOIN invite_codes ic ON u.id = ic.created_by
                LEFT JOIN invite_codes ic2 ON u.id = ic2.used_by
                $whereClause
                GROUP BY u.id
                ORDER BY u.created_at DESC
                LIMIT :limit OFFSET :offset
            ");
            
            // Bind all parameters using named parameters
            if (!empty($search)) {
                $stmt->bindValue(':search1', "%$search%", PDO::PARAM_STR);
                $stmt->bindValue(':search2', "%$search%", PDO::PARAM_STR);
                $stmt->bindValue(':search3', "%$search%", PDO::PARAM_STR);
            }
            $stmt->bindValue(':limit', (int)$limit, PDO::PARAM_INT);
            $stmt->bindValue(':offset', (int)$offset, PDO::PARAM_INT);
            $stmt->execute();
            
            $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
            $users = array_map('toCamelCaseArray', $users);
            
            // Get total count for pagination - also fix this query
            $countStmt = $this->conn->prepare("
                SELECT COUNT(*) as total FROM users u $whereClause
            ");
            if (!empty($search)) {
                $countStmt->bindValue(':search1', "%$search%", PDO::PARAM_STR);
                $countStmt->bindValue(':search2', "%$search%", PDO::PARAM_STR);
                $countStmt->bindValue(':search3', "%$search%", PDO::PARAM_STR);
            }
            $countStmt->execute();
            $total = $countStmt->fetch()['total'];
            
            return [
                'users' => $users,
                'total' => $total,
                'page' => $page,
                'limit' => $limit,
                'total_pages' => ceil($total / $limit)
            ];
            
        } catch (PDOException $e) {
            ApiResponse::error('Failed to fetch users: ' . $e->getMessage());
        }
    }

    public function banUser($userId, $reason, $bannedBy) {
        try {
            // Get user info for comprehensive logging
            $stmt = $this->conn->prepare("SELECT username, email FROM users WHERE id = ?");
            $stmt->execute([$userId]);
            $user = $stmt->fetch();
            
            $stmt = $this->conn->prepare("
                UPDATE users 
                SET is_banned = TRUE, ban_reason = ?, banned_by = ?, banned_at = NOW() 
                WHERE id = ?
            ");
            $stmt->execute([$reason, $bannedBy, $userId]);

            // Delete all sessions for this user
            $delStmt = $this->conn->prepare("DELETE FROM user_sessions WHERE user_id = ?");
            $delStmt->execute([$userId]);

            // Log comprehensive activity
            $this->logActivity($bannedBy, 'admin_ban_user', "ADMIN ACTION: Banned user '{$user['username']}' ({$user['email']}) - Reason: $reason");

            ApiResponse::success(null, 'User banned successfully');
        } catch (PDOException $e) {
            ApiResponse::error('Failed to ban user: ' . $e->getMessage());
        }
    }

    public function unbanUser($userId, $unbannedBy) {
        try {
            // Get user info for comprehensive logging
            $stmt = $this->conn->prepare("SELECT username, email FROM users WHERE id = ?");
            $stmt->execute([$userId]);
            $user = $stmt->fetch();
            
            $stmt = $this->conn->prepare("
                UPDATE users 
                SET is_banned = FALSE, ban_reason = NULL, banned_by = NULL, banned_at = NULL 
                WHERE id = ?
            ");
            $stmt->execute([$userId]);
            
            // Log comprehensive activity
            $this->logActivity($unbannedBy, 'admin_unban_user', "ADMIN ACTION: Unbanned user '{$user['username']}' ({$user['email']})");
            
            ApiResponse::success(null, 'User unbanned successfully');
            
        } catch (PDOException $e) {
            ApiResponse::error('Failed to unban user: ' . $e->getMessage());
        }
    }

    public function changeUserRole($userId, $newRole, $changedBy) {
        $allowedRoles = ['user', 'premium', 'admin', 'owner', 'femboy'];
        
        if (!in_array($newRole, $allowedRoles)) {
            ApiResponse::error('Invalid role');
        }
        
        try {
            // Get user info for comprehensive logging
            $stmt = $this->conn->prepare("SELECT username, email, account_type FROM users WHERE id = ?");
            $stmt->execute([$userId]);
            $user = $stmt->fetch();
            $oldRole = $user['account_type'];
            
            $stmt = $this->conn->prepare("UPDATE users SET account_type = ? WHERE id = ?");
            $stmt->execute([$newRole, $userId]);
            
            // Log comprehensive activity
            $this->logActivity($changedBy, 'admin_role_change', "ADMIN ACTION: Changed role for '{$user['username']}' ({$user['email']}) from '$oldRole' to '$newRole'");
            
            ApiResponse::success(null, 'User role changed successfully');
            
        } catch (PDOException $e) {
            ApiResponse::error('Failed to change user role: ' . $e->getMessage());
        }
    }

    public function resetUserHwid($userEmail, $reason = 'Admin reset', $resetBy = 'admin') {
        try {
            // Find user by email
            $stmt = $this->conn->prepare("SELECT id, username, hwid, hwid_reset_count FROM users WHERE email = ?");
            $stmt->execute([$userEmail]);
            $user = $stmt->fetch();
            
            if (!$user) {
                ApiResponse::error('User not found');
            }
            
            $oldResetCount = $user['hwid_reset_count'] ?? 0;
            
            // Reset HWID and increment reset count
            $stmt = $this->conn->prepare("
                UPDATE users 
                SET hwid = NULL, 
                    hwid_reset_count = COALESCE(hwid_reset_count, 0) + 1, 
                    last_hwid_reset = NOW() 
                WHERE email = ?
            ");
            $result = $stmt->execute([$userEmail]);
            $rowsAffected = $stmt->rowCount();
            
            // Verify the update worked
            $stmt = $this->conn->prepare("SELECT hwid_reset_count FROM users WHERE email = ?");
            $stmt->execute([$userEmail]);
            $updatedUser = $stmt->fetch();
            $newResetCount = $updatedUser['hwid_reset_count'] ?? 0;
            
            // Log activity with detailed info
            $this->logActivity($user['id'], 'hwid_reset', "HWID reset by admin: $resetBy. Reason: $reason. Old count: $oldResetCount, New count: $newResetCount, Rows affected: $rowsAffected");
            
            ApiResponse::success([
                'old_count' => $oldResetCount,
                'new_count' => $newResetCount,
                'rows_affected' => $rowsAffected
            ], 'HWID reset successful');
            
        } catch (PDOException $e) {
            ApiResponse::error('Failed to reset HWID: ' . $e->getMessage());
        }
    }

    public function getUserDetails($userId) {
        try {
            // Get user info
            $stmt = $this->conn->prepare("SELECT * FROM users WHERE id = ?");
            $stmt->execute([$userId]);
            $user = $stmt->fetch();
            
            if (!$user) {
                ApiResponse::error('User not found');
            }
            $user = toCamelCaseArray($user);
            
            // Log admin viewing user details (we'll get the admin ID from the session)
            if (isset($_SESSION['user_id'])) {
                $this->logActivity($_SESSION['user_id'], 'admin_view_user_details', "ADMIN ACTION: Viewed details for user '{$user['username']}'");
            }
            
            // Get user subscriptions
            $stmt = $this->conn->prepare("
                SELECT s.*, p.name as product_name, p.display_name
                FROM subscriptions s
                JOIN products p ON s.product_id = p.id
                WHERE s.user_id = ?
                ORDER BY s.end_date DESC
            ");
            $stmt->execute([$userId]);
            $subscriptions = $stmt->fetchAll();
            
            // Get user activity logs
            $stmt = $this->conn->prepare("
                SELECT * FROM activity_logs 
                WHERE user_id = ? 
                ORDER BY created_at DESC 
                LIMIT 50
            ");
            $stmt->execute([$userId]);
            $activityLogs = $stmt->fetchAll();
            
            // Get invite codes created by user
            $stmt = $this->conn->prepare("
                SELECT ic.*, u.username as used_by_username
                FROM invite_codes ic
                LEFT JOIN users u ON ic.used_by = u.id
                WHERE ic.created_by = ?
                ORDER BY ic.created_at DESC
            ");
            $stmt->execute([$userId]);
            $inviteCodes = $stmt->fetchAll();
            
            unset($user['password_hash']);
            
            return [
                'user' => $user,
                'subscriptions' => $subscriptions,
                'activity_logs' => $activityLogs,
                'invite_codes' => $inviteCodes
            ];
            
        } catch (PDOException $e) {
            ApiResponse::error('Failed to get user details: ' . $e->getMessage());
        }
    }

    public function getActivityLogs($page = 1, $limit = 50) {
        try {
            $offset = ($page - 1) * $limit;
            
            $stmt = $this->conn->prepare("
                SELECT al.*, u.username, u.account_type
                FROM activity_logs al
                LEFT JOIN users u ON al.user_id = u.id
                ORDER BY al.created_at DESC
                LIMIT :limit OFFSET :offset
            ");
            $stmt->bindValue(':limit', (int)$limit, PDO::PARAM_INT);
            $stmt->bindValue(':offset', (int)$offset, PDO::PARAM_INT);
            $stmt->execute();
            
            $logs = $stmt->fetchAll();
            
            // Get total count
            $countStmt = $this->conn->prepare("SELECT COUNT(*) as total FROM activity_logs");
            $countStmt->execute();
            $total = $countStmt->fetch()['total'];
            
            return [
                'logs' => $logs,
                'total' => $total,
                'page' => $page,
                'limit' => $limit,
                'total_pages' => ceil($total / $limit)
            ];
            
        } catch (PDOException $e) {
            ApiResponse::error('Failed to fetch activity logs: ' . $e->getMessage());
        }
    }

    public function getSystemStats() {
        try {
            // Total users
            $stmt = $this->conn->prepare("SELECT COUNT(*) as total FROM users");
            $stmt->execute();
            $totalUsers = $stmt->fetch()['total'];
            
            // Active subscriptions
            $stmt = $this->conn->prepare("SELECT COUNT(*) as total FROM subscriptions WHERE is_active = TRUE");
            $stmt->execute();
            $activeSubscriptions = $stmt->fetch()['total'];
            
            // Total products
            $stmt = $this->conn->prepare("SELECT COUNT(*) as total FROM products");
            $stmt->execute();
            $totalProducts = $stmt->fetch()['total'];
            
            // Unused license keys
            $stmt = $this->conn->prepare("SELECT COUNT(*) as total FROM license_keys WHERE is_used = FALSE");
            $stmt->execute();
            $unusedKeys = $stmt->fetch()['total'];
            
            // Recent registrations (last 7 days)
            $stmt = $this->conn->prepare("
                SELECT COUNT(*) as total FROM users 
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            ");
            $stmt->execute();
            $recentRegistrations = $stmt->fetch()['total'];
            
            // Banned users
            $stmt = $this->conn->prepare("SELECT COUNT(*) as total FROM users WHERE is_banned = TRUE");
            $stmt->execute();
            $bannedUsers = $stmt->fetch()['total'];
            
            return [
                'total_users' => $totalUsers,
                'active_subscriptions' => $activeSubscriptions,
                'total_products' => $totalProducts,
                'unused_keys' => $unusedKeys,
                'recent_registrations' => $recentRegistrations,
                'banned_users' => $bannedUsers
            ];
            
        } catch (PDOException $e) {
            ApiResponse::error('Failed to get system stats: ' . $e->getMessage());
        }
    }

    public function updateProductStatus($productId, $isFrozen, $isBroken, $isAlphaOnly) {
        try {
            $stmt = $this->conn->prepare("
                UPDATE products 
                SET is_frozen = ?, is_broken = ?, is_alpha_only = ?, updated_at = NOW()
                WHERE id = ?
            ");
            $stmt->execute([$isFrozen, $isBroken, $isAlphaOnly, $productId]);
            
            // Get product info for logging
            $stmt = $this->conn->prepare("SELECT name, display_name FROM products WHERE id = ?");
            $stmt->execute([$productId]);
            $product = $stmt->fetch();
            
            if ($product) {
                $statusText = [];
                if ($isFrozen) $statusText[] = 'frozen';
                if ($isBroken) $statusText[] = 'broken';
                if ($isAlphaOnly) $statusText[] = 'alpha-only';
                
                $status = empty($statusText) ? 'normal' : implode(', ', $statusText);
                $this->logActivity(null, 'product_update', "Updated {$product['display_name']} status to: {$status}");
            }
            
            return [
                'product_id' => $productId,
                'is_frozen' => (bool)$isFrozen,
                'is_broken' => (bool)$isBroken,
                'is_alpha_only' => (bool)$isAlphaOnly
            ];
            
        } catch (PDOException $e) {
            ApiResponse::error('Failed to update product status: ' . $e->getMessage());
        }
    }

    public function addUserSubscription($userId, $productId, $days, $addedBy) {
        try {
            // Check if user exists
            $stmt = $this->conn->prepare("SELECT username FROM users WHERE id = ?");
            $stmt->execute([$userId]);
            $user = $stmt->fetch();
            if (!$user) {
                ApiResponse::error('User not found');
            }
            
            // Check if product exists
            $stmt = $this->conn->prepare("SELECT name, display_name FROM products WHERE id = ?");
            $stmt->execute([$productId]);
            $product = $stmt->fetch();
            if (!$product) {
                ApiResponse::error('Product not found');
            }
            
            // Check if user already has any subscription for this product (active or inactive)
            $stmt = $this->conn->prepare("
                SELECT * FROM subscriptions 
                WHERE user_id = ? AND product_id = ?
            ");
            $stmt->execute([$userId, $productId]);
            $existingSub = $stmt->fetch();
            
            $startDate = date('Y-m-d H:i:s');
            $endDate = date('Y-m-d H:i:s', strtotime('+ ' . $days . ' days'));
            
            if ($existingSub) {
                // Update existing subscription (extend if active, reactivate if expired)
                $now = date('Y-m-d H:i:s');
                $currentEndDate = $existingSub['end_date'];
                
                if ($currentEndDate > $now && $existingSub['is_active']) {
                    // Subscription is still active, extend it
                    $endDate = date('Y-m-d H:i:s', strtotime($currentEndDate . ' + ' . $days . ' days'));
                }
                // If expired or inactive, use the new end date calculated above
                
                $stmt = $this->conn->prepare("
                    UPDATE subscriptions 
                    SET start_date = ?, end_date = ?, is_active = TRUE, updated_at = NOW()
                    WHERE id = ?
                ");
                $stmt->execute([$startDate, $endDate, $existingSub['id']]);
            } else {
                // Create new subscription
                $stmt = $this->conn->prepare("
                    INSERT INTO subscriptions (user_id, product_id, start_date, end_date, is_active) 
                    VALUES (?, ?, ?, ?, TRUE)
                ");
                $stmt->execute([$userId, $productId, $startDate, $endDate]);
            }
            
            // Log comprehensive activity
            $this->logActivity($addedBy, 'admin_grant_subscription', "ADMIN ACTION: Granted {$days}-day subscription for '{$product['display_name']}' to user '{$user['username']}'");
            
            ApiResponse::success(null, 'Subscription granted successfully');
            
        } catch (PDOException $e) {
            ApiResponse::error('Failed to grant subscription: ' . $e->getMessage());
        }
    }

    public function extendUserSubscription($userId, $productId, $days, $extendedBy) {
        try {
            // Check if user has active subscription
            $stmt = $this->conn->prepare("
                SELECT * FROM subscriptions 
                WHERE user_id = ? AND product_id = ? AND is_active = TRUE
            ");
            $stmt->execute([$userId, $productId]);
            $subscription = $stmt->fetch();
            
            if ($subscription) {
                // Extend existing subscription
                $newEndDate = date('Y-m-d H:i:s', strtotime($subscription['end_date'] . ' + ' . $days . ' days'));
                
                $stmt = $this->conn->prepare("
                    UPDATE subscriptions 
                    SET end_date = ? 
                    WHERE id = ?
                ");
                $stmt->execute([$newEndDate, $subscription['id']]);
            } else {
                // Create new subscription
                $startDate = date('Y-m-d H:i:s');
                $endDate = date('Y-m-d H:i:s', strtotime('+ ' . $days . ' days'));
                
                $stmt = $this->conn->prepare("
                    INSERT INTO subscriptions (user_id, product_id, start_date, end_date) 
                    VALUES (?, ?, ?, ?)
                ");
                $stmt->execute([$userId, $productId, $startDate, $endDate]);
            }
            
            // Get user and product info for comprehensive logging
            $stmt = $this->conn->prepare("SELECT username FROM users WHERE id = ?");
            $stmt->execute([$userId]);
            $user = $stmt->fetch();
            
            $stmt = $this->conn->prepare("SELECT display_name FROM products WHERE id = ?");
            $stmt->execute([$productId]);
            $product = $stmt->fetch();
            
            // Log comprehensive activity
            $this->logActivity($extendedBy, 'admin_extend_subscription', "ADMIN ACTION: Extended subscription for '{$user['username']}' - Product: '{$product['display_name']}', Extended by: $days days");
            
            ApiResponse::success(null, 'Subscription extended successfully');
            
        } catch (PDOException $e) {
            ApiResponse::error('Failed to extend subscription: ' . $e->getMessage());
        }
    }

    public function revokeUserSubscription($userId, $productId, $revokedBy) {
        try {
            // Get user and product info for comprehensive logging
            $stmt = $this->conn->prepare("SELECT username FROM users WHERE id = ?");
            $stmt->execute([$userId]);
            $user = $stmt->fetch();
            
            $stmt = $this->conn->prepare("SELECT display_name FROM products WHERE id = ?");
            $stmt->execute([$productId]);
            $product = $stmt->fetch();
            
            $stmt = $this->conn->prepare("
                UPDATE subscriptions 
                SET is_active = FALSE 
                WHERE user_id = ? AND product_id = ?
            ");
            $stmt->execute([$userId, $productId]);
            
            // Log comprehensive activity
            $this->logActivity($revokedBy, 'admin_revoke_subscription', "ADMIN ACTION: Revoked subscription for '{$user['username']}' - Product: '{$product['display_name']}'");
            
            ApiResponse::success(null, 'Subscription revoked successfully');
            
        } catch (PDOException $e) {
            ApiResponse::error('Failed to revoke subscription: ' . $e->getMessage());
        }
    }

    public function forceHwidReset($userId, $resetBy) {
        try {
            // Get user info for logging
            $stmt = $this->conn->prepare("SELECT username FROM users WHERE id = ?");
            $stmt->execute([$userId]);
            $user = $stmt->fetch();
            if (!$user) {
                ApiResponse::error('User not found');
            }
            
            // Reset HWID
            $stmt = $this->conn->prepare("
                UPDATE users 
                SET hwid = NULL, hwid_reset_count = hwid_reset_count + 1, last_hwid_reset = NOW() 
                WHERE id = ?
            ");
            $stmt->execute([$userId]);
            
            // Log comprehensive activity
            $this->logActivity($resetBy, 'admin_force_hwid_reset', "ADMIN ACTION: Force reset HWID for user '{$user['username']}' - New reset count: " . ($user['hwid_reset_count'] + 1));
            
            ApiResponse::success(null, 'HWID reset successfully');
            
        } catch (PDOException $e) {
            ApiResponse::error('Failed to reset HWID: ' . $e->getMessage());
        }
    }

    public function getAllInviteCodes() {
        try {
            $stmt = $this->conn->prepare("
                SELECT ic.*, 
                       u1.username as created_by_username,
                       u2.username as used_by_username
                FROM invite_codes ic
                LEFT JOIN users u1 ON ic.created_by = u1.id
                LEFT JOIN users u2 ON ic.used_by = u2.id
                ORDER BY ic.created_at DESC
            ");
            $stmt->execute();
            return $stmt->fetchAll();
        } catch (PDOException $e) {
            ApiResponse::error('Failed to fetch invite codes: ' . $e->getMessage());
        }
    }

    public function createInviteCodes($count, $createdBy) {
        try {
            $codes = [];
            
            for ($i = 0; $i < $count; $i++) {
                // Generate unique invite code
                do {
                    $code = $this->generateInviteCode();
                    
                    // Check if code already exists
                    $stmt = $this->conn->prepare("SELECT id FROM invite_codes WHERE code = ?");
                    $stmt->execute([$code]);
                    $exists = $stmt->fetch();
                } while ($exists);
                
                // Insert the invite code
                $stmt = $this->conn->prepare("
                    INSERT INTO invite_codes (code, created_by) 
                    VALUES (?, ?)
                ");
                $stmt->execute([$code, $createdBy]);
                
                $codes[] = [
                    'id' => $this->conn->lastInsertId(),
                    'code' => $code,
                    'created_by' => $createdBy,
                    'used_by' => null,
                    'used_at' => null,
                    'created_at' => date('Y-m-d H:i:s')
                ];
            }
            
            // Log activity
            $this->logActivity($createdBy, 'invite_codes_created', "Created {$count} invitation code(s)");
            
            return $codes;
            
        } catch (PDOException $e) {
            ApiResponse::error('Failed to create invite codes: ' . $e->getMessage());
        }
    }

    public function validateInviteCode($code) {
        try {
            $stmt = $this->conn->prepare("
                SELECT * FROM invite_codes 
                WHERE code = ? AND used_by IS NULL
            ");
            $stmt->execute([$code]);
            $inviteCode = $stmt->fetch();
            
            return $inviteCode !== false;
            
        } catch (PDOException $e) {
            return false;
        }
    }

    public function useInviteCode($code, $usedBy) {
        try {
            // First validate the code exists and is unused
            if (!$this->validateInviteCode($code)) {
                return false;
            }
            
            // Mark the code as used
            $stmt = $this->conn->prepare("
                UPDATE invite_codes 
                SET used_by = ?, used_at = NOW() 
                WHERE code = ? AND used_by IS NULL
            ");
            $stmt->execute([$usedBy, $code]);
            
            // Log activity
            $this->logActivity($usedBy, 'invite_code_used', "Used invitation code: {$code}");
            
            return $stmt->rowCount() > 0;
            
        } catch (PDOException $e) {
            return false;
        }
    }

    private function generateInviteCode() {
        $chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        $code = '';
        
        // Generate format: XXXX-XXXX-XXXX
        for ($i = 0; $i < 3; $i++) {
            if ($i > 0) $code .= '-';
            for ($j = 0; $j < 4; $j++) {
                $code .= $chars[random_int(0, strlen($chars) - 1)];
            }
        }
        
        return $code;
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