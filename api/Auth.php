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

class Auth {
    private $conn;

    public function __construct() {
        $database = new Database();
        $this->conn = $database->getConnection();
    }

    public function register($username, $email, $password, $inviteCode) {
        // Validate input
        $errors = [];
        
        if (empty($username) || strlen($username) < 3) {
            $errors['username'] = 'Username must be at least 3 characters long';
        }
        
        if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $errors['email'] = 'Valid email is required';
        }
        
        if (empty($password) || strlen($password) < 6) {
            $errors['password'] = 'Password must be at least 6 characters long';
        }

        if (empty($inviteCode)) {
            $errors['invite_code'] = 'Invitation code is required';
        }

        // Check if username or email already exists
        $stmt = $this->conn->prepare("SELECT id FROM users WHERE username = ? OR email = ?");
        $stmt->execute([$username, $email]);
        
        if ($stmt->rowCount() > 0) {
            $errors['general'] = 'Username or email already exists';
        }

        if (!empty($errors)) {
            ApiResponse::validationError($errors);
        }

        // Hash password
        $passwordHash = password_hash($password, PASSWORD_DEFAULT);
        
        try {
            $stmt = $this->conn->prepare("
                INSERT INTO users (username, email, password_hash) 
                VALUES (?, ?, ?)
            ");
            
            if ($stmt->execute([$username, $email, $passwordHash])) {
                $userId = $this->conn->lastInsertId();
                
                // Mark invitation code as used
                require_once 'Admin.php';
                $admin = new Admin();
                $admin->useInviteCode($inviteCode, $userId);
                
                // Registration logging disabled for cleaner activity logs
                
                return $this->getUserById($userId);
            }
        } catch (PDOException $e) {
            ApiResponse::error('Registration failed: ' . $e->getMessage());
        }
    }

    public function login($email, $password) {
        if (empty($email) || empty($password)) {
            ApiResponse::error('Email and password are required');
        }

        // Basic rate limiting
        $this->checkRateLimit($email);

        try {
            $stmt = $this->conn->prepare("
                SELECT * FROM users 
                WHERE (email = ? OR username = ?)
            ");
            $stmt->execute([$email, $email]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$user) {
                $this->recordFailedLogin($email);
                ApiResponse::error('Account does not exist');
            }

            // Check if user is banned AFTER finding them
            if ($user['is_banned']) {
                ApiResponse::error('Your account has been banned. Reason: ' . ($user['ban_reason'] ?: 'No reason provided'), 403, [
                    'banned' => true,
                    'ban_reason' => $user['ban_reason'],
                    'banned_by' => $user['banned_by'],
                    'banned_at' => $user['banned_at']
                ]);
            }
            if (!password_verify($password, $user['password_hash'])) {
                $this->recordFailedLogin($email);
                ApiResponse::error('Invalid credentials');
            }

            // Clear failed attempts on successful login
            $this->clearFailedAttempts($email);

            // Update last login
            $stmt = $this->conn->prepare("UPDATE users SET last_login = NOW() WHERE id = ?");
            $stmt->execute([$user['id']]);

            // Create session
            $sessionToken = $this->createSession($user['id']);
            
            // Login logging disabled for cleaner activity logs

            // Remove sensitive data
            unset($user['password_hash']);
            
            $user = toCamelCaseArray($user);
            return [
                'user' => $user,
                'session_token' => $sessionToken
            ];

        } catch (PDOException $e) {
            ApiResponse::error('Login failed: ' . $e->getMessage());
        }
    }

    public function logout($sessionToken) {
        try {
            $stmt = $this->conn->prepare("DELETE FROM user_sessions WHERE session_token = ?");
            $stmt->execute([$sessionToken]);
            
            ApiResponse::success(null, 'Logged out successfully');
        } catch (PDOException $e) {
            ApiResponse::error('Logout failed: ' . $e->getMessage());
        }
    }

    public function validateSession($sessionToken) {
        if (empty($sessionToken)) {
            return false;
        }
        try {
            $stmt = $this->conn->prepare("
                SELECT u.* FROM users u 
                JOIN user_sessions s ON u.id = s.user_id 
                WHERE s.session_token = ? AND s.expires_at > NOW()
            ");
            $stmt->execute([$sessionToken]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($user) {
                if ($user['is_banned']) {
                    ApiResponse::error('You are banned', 403, ['banned' => true]);
                }
                unset($user['password_hash']);
                $user = toCamelCaseArray($user);
                return $user;
            }
            return false;
        } catch (PDOException $e) {
            // Log securely without exposing details
            error_log('Session validation error: ' . $e->getMessage());
            return false;
        }
    }

    public function changePassword($userId, $currentPassword, $newPassword) {
        if (empty($currentPassword) || empty($newPassword)) {
            ApiResponse::error('Current and new password are required');
        }

        if (strlen($newPassword) < 6) {
            ApiResponse::error('New password must be at least 6 characters long');
        }

        try {
            // Verify current password
            $stmt = $this->conn->prepare("SELECT password_hash FROM users WHERE id = ?");
            $stmt->execute([$userId]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$user || !password_verify($currentPassword, $user['password_hash'])) {
                ApiResponse::error('Current password is incorrect');
            }

            // Update password
            $newPasswordHash = password_hash($newPassword, PASSWORD_DEFAULT);
            $stmt = $this->conn->prepare("UPDATE users SET password_hash = ? WHERE id = ?");
            $stmt->execute([$newPasswordHash, $userId]);

            // Password change logging disabled for cleaner activity logs

            ApiResponse::success(null, 'Password changed successfully');

        } catch (PDOException $e) {
            ApiResponse::error('Password change failed: ' . $e->getMessage());
        }
    }

    private function createSession($userId) {
        $token = bin2hex(random_bytes(32));
        $expiresAt = date('Y-m-d H:i:s', strtotime('+30 days'));
        
        $stmt = $this->conn->prepare("
            INSERT INTO user_sessions (user_id, session_token, ip_address, user_agent, expires_at) 
            VALUES (?, ?, ?, ?, ?)
        ");
        
        $stmt->execute([
            $userId,
            $token,
            $_SERVER['REMOTE_ADDR'] ?? 'unknown',
            $_SERVER['HTTP_USER_AGENT'] ?? 'unknown',
            $expiresAt
        ]);

        return $token;
    }

    private function getUserById($userId) {
        $stmt = $this->conn->prepare("SELECT * FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($user) {
            unset($user['password_hash']);
            $user = toCamelCaseArray($user);
        }
        
        return $user;
    }

    public function updateProfileImage($userId, $imageData) {
        try {
            error_log("updateProfileImage called with userId: $userId, imageData: " . ($imageData ? 'has_data' : 'null'));
            
            // Start transaction to ensure commit
            $this->conn->beginTransaction();
            
            // Explicitly handle null/empty values for removing profile image
            if (is_null($imageData) || $imageData === '') {
                error_log("Setting profile_image to NULL for user $userId");
                $stmt = $this->conn->prepare("UPDATE users SET profile_image = NULL WHERE id = ?");
                $success = $stmt->execute([$userId]);
                error_log("NULL update result: " . ($success ? 'success' : 'failed'));
                error_log("Rows affected: " . $stmt->rowCount());
                $message = 'Profile image removed successfully';
            } else {
                error_log("Setting profile_image to data for user $userId");
                $stmt = $this->conn->prepare("UPDATE users SET profile_image = ? WHERE id = ?");
                $success = $stmt->execute([$imageData, $userId]);
                error_log("Rows affected: " . $stmt->rowCount());
                $message = 'Profile image updated successfully';
            }
            
            if ($success && $stmt->rowCount() > 0) {
                // Commit the transaction
                $this->conn->commit();
                error_log("Transaction committed - Profile image operation successful: $message");
                ApiResponse::success(null, $message);
            } else {
                // Rollback on failure
                if ($this->conn->inTransaction()) {
                    $this->conn->rollback();
                }
                error_log("Profile image operation failed - no rows affected or execution failed");
                ApiResponse::error('Failed to update profile image - user not found or no changes made');
            }
        } catch (PDOException $e) {
            // Rollback on exception if transaction is active
            if ($this->conn->inTransaction()) {
                $this->conn->rollback();
            }
            error_log("Profile image PDO error: " . $e->getMessage());
            ApiResponse::error('Profile image update failed: ' . $e->getMessage());
        }
    }

    public function updateBannerImage($userId, $imageData) {
        try {
            error_log("updateBannerImage called with userId: $userId, imageData: " . ($imageData ? 'has_data' : 'null'));
            
            // Start transaction to ensure commit
            $this->conn->beginTransaction();
            
            // Explicitly handle null/empty values for removing banner image
            if (is_null($imageData) || $imageData === '') {
                error_log("Setting banner_image to NULL for user $userId");
                $stmt = $this->conn->prepare("UPDATE users SET banner_image = NULL WHERE id = ?");
                $success = $stmt->execute([$userId]);
                error_log("NULL update result: " . ($success ? 'success' : 'failed'));
                error_log("Rows affected: " . $stmt->rowCount());
                $message = 'Banner image removed successfully';
            } else {
                error_log("Setting banner_image to data for user $userId");
                $stmt = $this->conn->prepare("UPDATE users SET banner_image = ? WHERE id = ?");
                $success = $stmt->execute([$imageData, $userId]);
                error_log("Rows affected: " . $stmt->rowCount());
                $message = 'Banner image updated successfully';
            }
            
            if ($success && $stmt->rowCount() > 0) {
                // Commit the transaction
                $this->conn->commit();
                error_log("Transaction committed - Banner image operation successful: $message");
                ApiResponse::success(null, $message);
            } else {
                // Rollback on failure
                if ($this->conn->inTransaction()) {
                    $this->conn->rollback();
                }
                error_log("Banner image operation failed - no rows affected or execution failed");
                ApiResponse::error('Failed to update banner image - user not found or no changes made');
            }
        } catch (PDOException $e) {
            // Rollback on exception if transaction is active
            if ($this->conn->inTransaction()) {
                $this->conn->rollback();
            }
            error_log("Banner image PDO error: " . $e->getMessage());
            ApiResponse::error('Banner image update failed: ' . $e->getMessage());
        }
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

    private function checkRateLimit($email) {
        $clientIp = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        
        try {
            // Check failed attempts in last 15 minutes
            $stmt = $this->conn->prepare("
                SELECT COUNT(*) as attempts 
                FROM failed_logins 
                WHERE (email = ? OR ip_address = ?) 
                AND created_at > DATE_SUB(NOW(), INTERVAL 15 MINUTE)
            ");
            $stmt->execute([$email, $clientIp]);
            $result = $stmt->fetch();
            
            if ($result['attempts'] >= 5) {
                ApiResponse::error('Too many login attempts. Please try again in 15 minutes.', 429);
            }
        } catch (PDOException $e) {
            // If table doesn't exist, continue without rate limiting
            error_log('Rate limit check failed: ' . $e->getMessage());
        }
    }

    private function recordFailedLogin($email) {
        $clientIp = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        
        try {
            $stmt = $this->conn->prepare("
                INSERT INTO failed_logins (email, ip_address, created_at) 
                VALUES (?, ?, NOW())
            ");
            $stmt->execute([$email, $clientIp]);
        } catch (PDOException $e) {
            // If table doesn't exist, continue silently
            error_log('Failed to record login attempt: ' . $e->getMessage());
        }
    }

    private function clearFailedAttempts($email) {
        $clientIp = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        
        try {
            $stmt = $this->conn->prepare("
                DELETE FROM failed_logins 
                WHERE email = ? OR ip_address = ?
            ");
            $stmt->execute([$email, $clientIp]);
        } catch (PDOException $e) {
            // If table doesn't exist, continue silently
            error_log('Failed to clear login attempts: ' . $e->getMessage());
        }
    }
}
?> 