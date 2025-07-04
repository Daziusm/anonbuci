<?php
// includes/functions.php - Functions for loader system

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../api/Auth.php';

// Create PDO connection
$database = new Database();
$pdo = $database->getConnection();

function requireAuth() {
    global $pdo;
    
    // Option 1: Check for authentication tokens (priority method)
    $token = $_COOKIE['session_token'] ?? $_COOKIE['geni'] ?? null;
    
    if (!$token) {
        // Check Authorization header as fallback
        $headers = getallheaders();
        $authHeader = $headers['Authorization'] ?? '';
        if (str_starts_with($authHeader, 'Bearer ')) {
            $token = substr($authHeader, 7);
        }
    }
    
    if ($token) {
        // Validate session using the existing Auth system
        $auth = new Auth();
        $user = $auth->validateSession($token);
        
        if ($user) {
            return $user;
        }
    }
    
    // Option 2: Fallback to PHP sessions (traditional session system)
    session_start();
    
    if (isset($_SESSION['user_id']) && $_SESSION['user_id']) {
        try {
            $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ? AND is_banned = 0");
            $stmt->execute([$_SESSION['user_id']]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($user) {
                // Remove sensitive data and return user
                unset($user['password_hash']);
                return $user;
            }
        } catch (PDOException $e) {
            error_log("Session auth error: " . $e->getMessage());
        }
    }
    
    // If no authentication method worked, redirect to login
    header('Location: login.php?error=auth_required');
    exit;
}

function getUserByToken($token) {
    global $pdo;
    
    try {
        // Query user by session token
        $stmt = $pdo->prepare("
            SELECT u.* FROM users u 
            JOIN user_sessions s ON u.id = s.user_id 
            WHERE s.session_token = ? AND s.expires_at > NOW()
            LIMIT 1
        ");
        $stmt->execute([$token]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($user) {
            // Convert some fields to match expected format
            $user['is_admin'] = ($user['account_type'] === 'admin' || $user['account_type'] === 'owner') ? 1 : 0;
            $user['is_alpha'] = ($user['account_type'] === 'premium' || $user['account_type'] === 'admin' || $user['account_type'] === 'owner' || $user['account_type'] === 'femboy') ? 1 : 0;
            $user['is_banned'] = $user['is_banned'] ? 1 : 0;
            $user['check_data'] = $user['hwid']; // Map hwid to check_data field
        }
        
        return $user;
        
    } catch (PDOException $e) {
        error_log("getUserByToken error: " . $e->getMessage());
        return false;
    }
}

function recordHwid($userId, $hwid) {
    global $pdo;
    
    try {
        $stmt = $pdo->prepare("UPDATE users SET hwid = ? WHERE id = ?");
        $stmt->execute([$hwid, $userId]);
    } catch (PDOException $e) {
        error_log("recordHwid error: " . $e->getMessage());
    }
}

function updateExtraInfo($userId, $steamId) {
    global $pdo;
    
    try {
        // Store steam IDs in a simple way - you might want to create a separate table for this
        $stmt = $pdo->prepare("
            INSERT INTO activity_logs (user_id, activity_type, description) 
            VALUES (?, 'steam_id', ?) 
            ON DUPLICATE KEY UPDATE description = VALUES(description)
        ");
        $stmt->execute([$userId, $steamId]);
    } catch (PDOException $e) {
        error_log("updateExtraInfo error: " . $e->getMessage());
    }
}

function updateTelemetryInfo($userId, $info) {
    global $pdo;
    
    try {
        // Store telemetry info in activity logs
        $stmt = $pdo->prepare("
            INSERT INTO activity_logs (user_id, activity_type, description) 
            VALUES (?, 'telemetry', ?)
        ");
        $stmt->execute([$userId, $info]);
    } catch (PDOException $e) {
        error_log("updateTelemetryInfo error: " . $e->getMessage());
    }
}

function sanitize_input($input) {
    return htmlspecialchars(strip_tags(trim($input)), ENT_QUOTES, 'UTF-8');
}
?> 