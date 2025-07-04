<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$rootPath = dirname(__DIR__);
require_once $rootPath . '/config/database.php';
require_once 'Auth.php';
require_once 'ApiResponse.php';

$auth = new Auth();
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// Skip session validation for bot endpoints
$skipAuth = ($action === 'send_bot_message');

if (!$skipAuth) {
    // Validate session for user operations
    $sessionToken = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    $sessionToken = str_replace('Bearer ', '', $sessionToken);

    if (empty($sessionToken)) {
        ApiResponse::error('Session token is required', 401);
    }

    $user = $auth->validateSession($sessionToken);
    if (!$user) {
        ApiResponse::unauthorized('Invalid session');
    }
}

$database = new Database();
$conn = $database->getConnection();

switch ($method) {
    case 'GET':
        switch ($action) {
            case 'get_messages':
                getMessages($conn);
                break;
            default:
                ApiResponse::error('Invalid action', 404);
        }
        break;
        
    case 'POST':
        $input = json_decode(file_get_contents('php://input'), true);
        
        switch ($action) {
            case 'send_message':
                if (!isset($user)) {
                    ApiResponse::unauthorized('User session required');
                }
                sendMessage($conn, $user, $input);
                break;
            case 'send_bot_message':
                sendBotMessage($conn, $input);
                break;
            default:
                ApiResponse::error('Invalid action', 404);
        }
        break;
        
    default:
        ApiResponse::error('Method not allowed', 405);
}

function getMessages($conn) {
    try {
        $stmt = $conn->prepare("
            SELECT 
                sm.id,
                sm.message,
                sm.mentions,
                sm.created_at,
                u.username,
                u.profile_image,
                u.account_type
            FROM shoutbox_messages sm
            JOIN users u ON sm.user_id = u.id
            ORDER BY sm.created_at DESC
            LIMIT 50
        ");
        
        $stmt->execute();
        $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Format messages with camelCase and add time ago
        $formattedMessages = array_map(function($message) {
            return [
                'id' => (int)$message['id'],
                'message' => $message['message'],
                'mentions' => $message['mentions'] ? json_decode($message['mentions'], true) : [],
                'createdAt' => $message['created_at'],
                'timeAgo' => timeAgo($message['created_at']),
                'timestamp' => strtotime($message['created_at']) * 1000, // JavaScript timestamp
                'user' => [
                    'username' => $message['username'],
                    'profileImage' => $message['profile_image'],
                    'accountType' => $message['account_type']
                ]
            ];
        }, $messages);
        
        // Reverse to get chronological order (oldest first)
        $formattedMessages = array_reverse($formattedMessages);
        
        ApiResponse::success($formattedMessages, 'Messages retrieved successfully');
        
    } catch (PDOException $e) {
        ApiResponse::error('Failed to retrieve messages: ' . $e->getMessage());
    }
}

function sendMessage($conn, $user, $input) {
    if (!isset($input['message']) || empty(trim($input['message']))) {
        ApiResponse::error('Message content is required');
    }
    
    $message = trim($input['message']);
    
    if (strlen($message) > 200) {
        ApiResponse::error('Message too long (max 200 characters)');
    }
    
    // Check for rate limiting (simple cooldown) - use MySQL time functions for consistency
    $stmt = $conn->prepare("
        SELECT created_at,
               TIMESTAMPDIFF(SECOND, created_at, NOW()) as seconds_since_last
        FROM shoutbox_messages 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT 1
    ");
    $stmt->execute([$user['id']]);
    $lastMessage = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($lastMessage && $lastMessage['seconds_since_last'] < 5) {
        $remainingTime = 5 - $lastMessage['seconds_since_last'];
        ApiResponse::error("Please wait {$remainingTime} more seconds before sending another message");
    }
    
    // Extract mentions from message
    $mentions = extractMentions($message);
    
    try {
        $stmt = $conn->prepare("
            INSERT INTO shoutbox_messages (user_id, message, mentions)
            VALUES (?, ?, ?)
        ");
        
        $mentionsJson = !empty($mentions) ? json_encode($mentions) : null;
        $stmt->execute([$user['id'], $message, $mentionsJson]);
        $messageId = $conn->lastInsertId();
        
        // Get the created message with user info
        $stmt = $conn->prepare("
            SELECT 
                sm.id,
                sm.message,
                sm.mentions,
                sm.created_at,
                u.username,
                u.profile_image,
                u.account_type
            FROM shoutbox_messages sm
            JOIN users u ON sm.user_id = u.id
            WHERE sm.id = ?
        ");
        
        $stmt->execute([$messageId]);
        $messageData = $stmt->fetch(PDO::FETCH_ASSOC);
        
        $formattedMessage = [
            'id' => (int)$messageData['id'],
            'message' => $messageData['message'],
            'mentions' => $messageData['mentions'] ? json_decode($messageData['mentions'], true) : [],
            'createdAt' => $messageData['created_at'],
            'timeAgo' => timeAgo($messageData['created_at']),
            'timestamp' => strtotime($messageData['created_at']) * 1000,
            'user' => [
                'username' => $messageData['username'],
                'profileImage' => $messageData['profile_image'],
                'accountType' => $messageData['account_type']
            ]
        ];
        
        ApiResponse::success($formattedMessage, 'Message sent successfully');
        
    } catch (PDOException $e) {
        ApiResponse::error('Failed to send message: ' . $e->getMessage());
    }
}

function sendBotMessage($conn, $input) {
    if (!isset($input['message']) || empty(trim($input['message']))) {
        ApiResponse::error('Bot message content is required');
    }
    
    $message = trim($input['message']);
    
    if (strlen($message) > 200) {
        ApiResponse::error('Bot message too long (max 200 characters)');
    }
    
    // Get or create the bot user
    $botUser = getBotUser($conn);
    if (!$botUser) {
        ApiResponse::error('Failed to get bot user');
    }
    
    // Extract mentions from message
    $mentions = extractMentions($message);
    
    try {
        $stmt = $conn->prepare("
            INSERT INTO shoutbox_messages (user_id, message, mentions)
            VALUES (?, ?, ?)
        ");
        
        $mentionsJson = !empty($mentions) ? json_encode($mentions) : null;
        $stmt->execute([$botUser['id'], $message, $mentionsJson]);
        $messageId = $conn->lastInsertId();
        
        // Get the created message with user info
        $stmt = $conn->prepare("
            SELECT 
                sm.id,
                sm.message,
                sm.mentions,
                sm.created_at,
                u.username,
                u.profile_image,
                u.account_type
            FROM shoutbox_messages sm
            JOIN users u ON sm.user_id = u.id
            WHERE sm.id = ?
        ");
        
        $stmt->execute([$messageId]);
        $messageData = $stmt->fetch(PDO::FETCH_ASSOC);
        
        $formattedMessage = [
            'id' => (int)$messageData['id'],
            'message' => $messageData['message'],
            'mentions' => $messageData['mentions'] ? json_decode($messageData['mentions'], true) : [],
            'createdAt' => $messageData['created_at'],
            'timeAgo' => timeAgo($messageData['created_at']),
            'timestamp' => strtotime($messageData['created_at']) * 1000,
            'user' => [
                'username' => $messageData['username'],
                'profileImage' => $messageData['profile_image'],
                'accountType' => $messageData['account_type']
            ]
        ];
        
        ApiResponse::success($formattedMessage, 'Bot message sent successfully');
        
    } catch (PDOException $e) {
        ApiResponse::error('Failed to send bot message: ' . $e->getMessage());
    }
}

function getBotUser($conn) {
    // Check if bot user exists
    $stmt = $conn->prepare("SELECT * FROM users WHERE username = 'analteam'");
    $stmt->execute();
    $botUser = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($botUser) {
        return $botUser;
    }
    
    // Create bot user if it doesn't exist
    try {
        $stmt = $conn->prepare("
            INSERT INTO users (username, email, password_hash, account_type, profile_image) 
            VALUES (?, ?, ?, ?, ?)
        ");
        
        $stmt->execute([
            'analteam',
            'bot@analteam.local',
            password_hash('bot_password_' . bin2hex(random_bytes(16)), PASSWORD_DEFAULT),
            'bot',
            'https://raw.githubusercontent.com/Daziusm/Daziusm/refs/heads/main/skull-cigar.png'
        ]);
        
        $botUserId = $conn->lastInsertId();
        
        // Get the created bot user
        $stmt = $conn->prepare("SELECT * FROM users WHERE id = ?");
        $stmt->execute([$botUserId]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
        
    } catch (PDOException $e) {
        error_log('Failed to create bot user: ' . $e->getMessage());
        return null;
    }
}

function extractMentions($message) {
    $mentions = [];
    preg_match_all('/@(\w+)/', $message, $matches);
    
    if (!empty($matches[1])) {
        $mentions = array_unique($matches[1]);
    }
    
    return $mentions;
}

function timeAgo($datetime) {
    $time = time() - strtotime($datetime);
    
    if ($time < 60) return 'just now';
    if ($time < 3600) return floor($time/60) . 'm ago';
    if ($time < 86400) return floor($time/3600) . 'h ago';
    if ($time < 2592000) return floor($time/86400) . 'd ago';
    
    return date('M j', strtotime($datetime));
}
?> 