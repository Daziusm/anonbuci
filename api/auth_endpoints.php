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

require_once 'Auth.php';

$auth = new Auth();

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    switch ($action) {
        case 'register':
            if (!isset($input['username']) || !isset($input['email']) || !isset($input['password']) || !isset($input['invite_code'])) {
                ApiResponse::error('Username, email, password, and invitation code are required');
            }
            
            // Validate invitation code first
            require_once 'Admin.php';
            $admin = new Admin();
            
            if (!$admin->validateInviteCode($input['invite_code'])) {
                ApiResponse::error('Invalid or already used invitation code');
            }
            
            $user = $auth->register($input['username'], $input['email'], $input['password'], $input['invite_code']);
            ApiResponse::success($user, 'Registration successful');
            break;
            
        case 'login':
            if (!isset($input['email']) || !isset($input['password'])) {
                ApiResponse::error('Email and password are required');
            }
            
            $result = $auth->login($input['email'], $input['password']);
            ApiResponse::success($result, 'Login successful');
            break;
            
        case 'logout':
            $sessionToken = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
            $sessionToken = str_replace('Bearer ', '', $sessionToken);
            
            if (empty($sessionToken)) {
                ApiResponse::error('Session token is required');
            }
            
            $auth->logout($sessionToken);
            break;
            
        case 'change_password':
            $sessionToken = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
            $sessionToken = str_replace('Bearer ', '', $sessionToken);
            
            if (empty($sessionToken)) {
                ApiResponse::error('Session token is required');
            }
            
            $user = $auth->validateSession($sessionToken);
            if (!$user) {
                ApiResponse::unauthorized('Invalid session');
            }
            
            if (!isset($input['current_password']) || !isset($input['new_password'])) {
                ApiResponse::error('Current and new password are required');
            }
            
            $auth->changePassword($user['id'], $input['current_password'], $input['new_password']);
            break;
            
        case 'update_profile_image':
            $sessionToken = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
            $sessionToken = str_replace('Bearer ', '', $sessionToken);
            
            if (empty($sessionToken)) {
                error_log("Profile image update: No session token");
                ApiResponse::error('Session token is required');
            }
            
            $user = $auth->validateSession($sessionToken);
            if (!$user) {
                error_log("Profile image update: Invalid session for token: $sessionToken");
                ApiResponse::unauthorized('Invalid session');
            }
            
            error_log("Profile image update: Valid user found - ID: " . $user['id'] . ", Username: " . $user['username']);
            
            if (!array_key_exists('image_data', $input)) {
                error_log("Profile image update: No image_data in input");
                ApiResponse::error('Image data parameter is required');
            }
            
            error_log("Profile image update: Calling updateProfileImage with data: " . ($input['image_data'] ? 'has_data' : 'null'));
            $auth->updateProfileImage($user['id'], $input['image_data']);
            break;
            
        case 'update_banner_image':
            $sessionToken = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
            $sessionToken = str_replace('Bearer ', '', $sessionToken);
            
            if (empty($sessionToken)) {
                error_log("Banner image update: No session token");
                ApiResponse::error('Session token is required');
            }
            
            $user = $auth->validateSession($sessionToken);
            if (!$user) {
                error_log("Banner image update: Invalid session for token: $sessionToken");
                ApiResponse::unauthorized('Invalid session');
            }
            
            error_log("Banner image update: Valid user found - ID: " . $user['id'] . ", Username: " . $user['username']);
            
            if (!array_key_exists('image_data', $input)) {
                error_log("Banner image update: No image_data in input");
                ApiResponse::error('Image data parameter is required');
            }
            
            error_log("Banner image update: Calling updateBannerImage with data: " . ($input['image_data'] ? 'has_data' : 'null'));
            $auth->updateBannerImage($user['id'], $input['image_data']);
            break;
            
        default:
            ApiResponse::error('Invalid action', 404);
    }
} elseif ($method === 'GET') {
    // Handle GET requests for testing
    switch ($action) {
        case 'test':
            ApiResponse::success([
                'message' => 'Auth API is working',
                'method' => $method,
                'action' => $action,
                'timestamp' => date('Y-m-d H:i:s')
            ], 'Auth API test successful');
            break;
            
        case 'status':
            ApiResponse::success([
                'status' => 'Auth API is running',
                'available_actions' => ['register', 'login', 'logout', 'change_password', 'update_profile_image', 'update_banner_image', 'get_user'],
                'method' => $method
            ], 'Auth API status');
            break;
            
        case 'get_user':
            $sessionToken = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
            $sessionToken = str_replace('Bearer ', '', $sessionToken);
            
            if (empty($sessionToken)) {
                ApiResponse::error('Session token is required');
            }
            
            $user = $auth->validateSession($sessionToken);
            if (!$user) {
                ApiResponse::unauthorized('Invalid session');
            }
            
            ApiResponse::success(['user' => $user], 'User data retrieved successfully');
            break;
            
        default:
            ApiResponse::error('Invalid action for GET method. Use POST for authentication actions.', 405);
    }
} else {
    ApiResponse::error('Method not allowed. Use POST for authentication actions.', 405);
}
?> 