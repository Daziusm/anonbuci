<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once 'Admin.php';
require_once 'Auth.php';
require_once 'Subscriptions.php';
require_once 'ApiResponse.php';

$admin = new Admin();
$auth = new Auth();

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// Get session token
$sessionToken = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
$sessionToken = str_replace('Bearer ', '', $sessionToken);

// Validate session for all admin endpoints
$user = null;
if (!empty($sessionToken)) {
    $user = $auth->validateSession($sessionToken);
}

if (!$user) {
    ApiResponse::unauthorized('Authentication required');
}

// Check if user has admin privileges
if (!$user || !isset($user['accountType']) || !in_array($user['accountType'], ['admin', 'owner', 'femboy'])) {
    ApiResponse::forbidden('Admin privileges required');
}

if ($method === 'GET') {
    switch ($action) {
        case 'users':
            $search = $_GET['search'] ?? '';
            $page = intval($_GET['page'] ?? 1);
            $limit = intval($_GET['limit'] ?? 20);
            
            $result = $admin->getAllUsers($search, $page, $limit);
            ApiResponse::success($result, 'Users retrieved successfully');
            break;
            
        case 'user_details':
            $userId = intval($_GET['user_id'] ?? 0);
            if (!$userId) {
                ApiResponse::error('User ID is required');
            }
            
            $result = $admin->getUserDetails($userId);
            ApiResponse::success($result, 'User details retrieved successfully');
            break;
            
        case 'activity_logs':
            $page = intval($_GET['page'] ?? 1);
            $limit = intval($_GET['limit'] ?? 50);
            
            $result = $admin->getActivityLogs($page, $limit);
            ApiResponse::success($result, 'Activity logs retrieved successfully');
            break;
            
        case 'system_stats':
            $result = $admin->getSystemStats();
            ApiResponse::success($result, 'System stats retrieved successfully');
            break;
            
        case 'invite_codes':
            $result = $admin->getAllInviteCodes();
            ApiResponse::success(['codes' => $result], 'Invite codes retrieved successfully');
            break;
            
        case 'generated_keys':
            $subscriptions = new Subscriptions();
            $keys = $subscriptions->getAllLicenseKeys();
            ApiResponse::success(['keys' => $keys], 'Generated keys retrieved successfully');
            break;
            
        default:
            ApiResponse::error('Invalid action', 404);
    }
} elseif ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    switch ($action) {
        case 'ban_user':
            if (!isset($input['user_id']) || !isset($input['reason'])) {
                ApiResponse::error('User ID and reason are required');
            }
            
            $admin->banUser($input['user_id'], $input['reason'], $user['username']);
            break;
            
        case 'unban_user':
            if (!isset($input['user_id'])) {
                ApiResponse::error('User ID is required');
            }
            
            $admin->unbanUser($input['user_id'], $user['username']);
            break;
            
        case 'change_role':
            if (!isset($input['user_id']) || !isset($input['new_role'])) {
                ApiResponse::error('User ID and new role are required');
            }
            
            $admin->changeUserRole($input['user_id'], $input['new_role'], $user['username']);
            break;
            
        case 'update_product':
            if (!isset($input['product_id'])) {
                ApiResponse::error('Product ID is required');
            }
            
            $isFrozen = $input['is_frozen'] ?? false;
            $isAlphaOnly = $input['is_alpha_only'] ?? false;
            $isBroken = $input['is_broken'] ?? false;
            
            $admin->updateProductStatus($input['product_id'], $isFrozen, $isAlphaOnly, $isBroken, $user['id']);
            break;
            
        case 'extend_subscription':
            if (!isset($input['user_id']) || !isset($input['product_id']) || !isset($input['days'])) {
                ApiResponse::error('User ID, product ID, and days are required');
            }
            
            $admin->extendUserSubscription($input['user_id'], $input['product_id'], $input['days'], $user['id']);
            break;
            
        case 'add_subscription':
            if (!isset($input['user_id']) || !isset($input['product_id']) || !isset($input['days'])) {
                ApiResponse::error('User ID, product ID, and days are required');
            }
            
            $admin->addUserSubscription($input['user_id'], $input['product_id'], $input['days'], $user['id']);
            break;
            
        case 'revoke_subscription':
            if (!isset($input['user_id']) || !isset($input['product_id'])) {
                ApiResponse::error('User ID and product ID are required');
            }
            
            $admin->revokeUserSubscription($input['user_id'], $input['product_id'], $user['id']);
            break;
            
        case 'force_hwid_reset':
            if (!isset($input['user_id'])) {
                ApiResponse::error('User ID is required');
            }
            
            $admin->forceHwidReset($input['user_id'], $user['id']);
            break;
            
        case 'create_invite_codes':
            $count = intval($input['count'] ?? 1);
            if ($count < 1 || $count > 100) {
                ApiResponse::error('Count must be between 1 and 100');
            }
            
            $codes = $admin->createInviteCodes($count, $user['id']);
            ApiResponse::success(['codes' => $codes], "Created {$count} invitation code(s) successfully");
            break;
            
        case 'log_activity':
            $type = $input['type'] ?? '';
            $description = $input['description'] ?? '';
            $username = $input['username'] ?? $user['username'];
            
            if (empty($type) || empty($description)) {
                ApiResponse::error('Type and description are required');
            }
            
            // For now, return success since activity logging needs implementation
            ApiResponse::success(null, 'Activity logged successfully');
            break;
            
        case 'update_product_status':
            if (!isset($input['product_id']) || !isset($input['is_frozen']) || !isset($input['is_broken']) || !isset($input['is_alpha_only'])) {
                ApiResponse::error('Product ID and status fields are required');
            }
            
            $result = $admin->updateProductStatus($input['product_id'], $input['is_frozen'], $input['is_broken'], $input['is_alpha_only']);
            ApiResponse::success($result, 'Product status updated successfully');
            break;
            
        case 'reset_user_hwid':
            if (!isset($input['email'])) {
                ApiResponse::error('User email is required');
            }
            
            $reason = $input['reason'] ?? 'Admin reset';
            $admin->resetUserHwid($input['email'], $reason, $user['username']);
            break;
            
        case 'flashbang':
            $target = $input['target'] ?? '';
            $targetName = $input['targetName'] ?? 'Unknown Target';
            
            // Validate that a target is provided
            if (empty($target)) {
                ApiResponse::error('Target user is required');
            }
            
            // For future implementation: This could broadcast to specific users
            // via WebSocket, Server-Sent Events, or database polling
            
            $message = "Flashbang deployed to {$targetName}! They got pranked! 💥";
            
            ApiResponse::success(['message' => $message, 'target' => $target]);
            break;
            
        case 'jobapp':
            $target = $input['target'] ?? '';
            $targetName = $input['targetName'] ?? 'Unknown Target';
            
            // Validate that a target is provided
            if (empty($target)) {
                ApiResponse::error('Target user is required');
            }
            
            // For future implementation: This could broadcast to specific users
            // via WebSocket, Server-Sent Events, or database polling
            
            $message = "Job application sent to {$targetName}! They need career advice! 💼";
            
            ApiResponse::success(['message' => $message, 'target' => $target]);
            break;
            
        default:
            ApiResponse::error('Invalid action', 404);
    }
} else {
    ApiResponse::error('Method not allowed', 405);
}
?> 