<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once 'Subscriptions.php';
require_once 'Auth.php';
require_once 'ApiResponse.php';

$subscriptions = new Subscriptions();
$auth = new Auth();

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// Get session token from Authorization header or cookies
$sessionToken = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
$sessionToken = str_replace('Bearer ', '', $sessionToken);

// If no Authorization header, try to get from cookies
if (empty($sessionToken)) {
    session_start();
    $sessionToken = $_COOKIE['anonteam_session'] ?? $_SESSION['session_token'] ?? '';
}

// Validate session for protected endpoints
$user = null;
if (!empty($sessionToken)) {
    $user = $auth->validateSession($sessionToken);
}

if ($method === 'GET') {
    switch ($action) {
        case 'products':
            $products = $subscriptions->getAllProducts();
            ApiResponse::success($products, 'Products retrieved successfully');
            break;
            
        case 'user_subscriptions':
            if (!$user) {
                ApiResponse::unauthorized('Authentication required');
            }
            
            $userSubs = $subscriptions->getUserSubscriptions($user['id']);
            ApiResponse::success($userSubs, 'User subscriptions retrieved successfully');
            break;
            
        case 'hwid_status':
            if (!$user) {
                ApiResponse::unauthorized('Authentication required');
            }
            
            $status = $subscriptions->getHwidResetStatus($user['id']);
            ApiResponse::success($status, 'HWID status retrieved successfully');
            break;
            
        case 'test':
            ApiResponse::success([
                'message' => 'Subscription API is working',
                'method' => $method,
                'action' => $action,
                'timestamp' => date('Y-m-d H:i:s')
            ], 'Subscription API test successful');
            break;
            
        case 'generated_keys':
            // Check admin privileges - handle both field naming conventions
            $accountType = $user['account_type'] ?? $user['accountType'] ?? 'user';
            if (!$user || !in_array($accountType, ['admin', 'owner', 'femboy'])) {
                ApiResponse::forbidden('Admin privileges required');
            }
            $keys = $subscriptions->getAllLicenseKeys();
            ApiResponse::success(['keys' => $keys], 'License keys retrieved successfully');
            break;
            
        default:
            ApiResponse::error('Invalid action', 404);
    }
} elseif ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    switch ($action) {
        case 'activate_key':
            if (!$user) {
                ApiResponse::unauthorized('Authentication required');
            }
            
            if (!isset($input['key_code'])) {
                ApiResponse::error('License key is required');
            }
            
            $result = $subscriptions->activateLicenseKey($input['key_code'], $user['id']);
            ApiResponse::success($result, 'License key activated successfully');
            break;
            
        case 'hwid_reset':
            if (!$user) {
                ApiResponse::unauthorized('Authentication required');
            }
            
            $reason = $input['reason'] ?? '';
            $subscriptions->requestHwidReset($user['id'], $reason);
            break;
            
        case 'update_hwid':
            if (!$user) {
                ApiResponse::unauthorized('Authentication required');
            }
            
            if (!isset($input['hwid'])) {
                ApiResponse::error('HWID is required');
            }
            
            $subscriptions->updateHwid($user['id'], $input['hwid']);
            break;
            
        case 'generate_key':
            if (!$user) {
                ApiResponse::unauthorized('Authentication required');
            }
            
            // Check if user is admin - handle both field naming conventions
            $accountType = $user['account_type'] ?? $user['accountType'] ?? 'user';
            if (!in_array($accountType, ['admin', 'owner', 'femboy'])) {
                ApiResponse::forbidden('Admin privileges required');
            }
            
            if (!isset($input['product_id']) || !isset($input['duration_days'])) {
                ApiResponse::error('Product ID and duration are required');
            }
            
            $result = $subscriptions->generateLicenseKey($input['product_id'], $input['duration_days'], $user['id']);
            ApiResponse::success($result, 'License key generated successfully');
            break;
            
        default:
            ApiResponse::error('Invalid action', 404);
    }
} else {
    ApiResponse::error('Method not allowed', 405);
}
?> 