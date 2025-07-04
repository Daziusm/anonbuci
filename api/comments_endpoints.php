<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS, DELETE');
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

// Validate session for all operations
$sessionToken = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
$sessionToken = str_replace('Bearer ', '', $sessionToken);

if (empty($sessionToken)) {
    ApiResponse::error('Session token is required', 401);
}

$user = $auth->validateSession($sessionToken);
if (!$user) {
    ApiResponse::unauthorized('Invalid session');
}

$database = new Database();
$conn = $database->getConnection();

switch ($method) {
    case 'GET':
        switch ($action) {
            case 'get_comments':
                getComments($conn);
                break;
            default:
                ApiResponse::error('Invalid action', 404);
        }
        break;
        
    case 'POST':
        $input = json_decode(file_get_contents('php://input'), true);
        
        switch ($action) {
            case 'post_comment':
                postComment($conn, $user, $input);
                break;
            case 'like_comment':
                likeComment($conn, $user, $input);
                break;
            case 'unlike_comment':
                unlikeComment($conn, $user, $input);
                break;
            default:
                ApiResponse::error('Invalid action', 404);
        }
        break;
        
    case 'DELETE':
        switch ($action) {
            case 'delete_comment':
                $commentId = $_GET['comment_id'] ?? '';
                deleteComment($conn, $user, $commentId);
                break;
            default:
                ApiResponse::error('Invalid action', 404);
        }
        break;
        
    default:
        ApiResponse::error('Method not allowed', 405);
}

function getComments($conn) {
    try {
        // Get profile filter from query parameter
        $profileUser = $_GET['profile_user'] ?? '';
        $userId = getCurrentUserId();
        
        if (!empty($profileUser)) {
            // Get profile-specific comments
            $stmt = $conn->prepare("
                SELECT 
                    c.id,
                    c.content,
                    c.parent_id,
                    c.likes_count,
                    c.created_at,
                    c.target_user_id,
                    u.username,
                    u.profile_image,
                    u.account_type,
                    (SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = c.id AND cl.user_id = ?) as user_liked
                FROM comments c
                JOIN users u ON c.user_id = u.id
                JOIN users target_u ON c.target_user_id = target_u.id
                WHERE target_u.username = ?
                ORDER BY c.created_at DESC
                LIMIT 50
            ");
            $stmt->execute([$userId, $profileUser]);
        } else {
            // Get all comments (for own profile or general view)
            $stmt = $conn->prepare("
                SELECT 
                    c.id,
                    c.content,
                    c.parent_id,
                    c.likes_count,
                    c.created_at,
                    c.target_user_id,
                    u.username,
                    u.profile_image,
                    u.account_type,
                    (SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = c.id AND cl.user_id = ?) as user_liked
                FROM comments c
                JOIN users u ON c.user_id = u.id
                WHERE c.target_user_id IS NULL
                ORDER BY c.created_at DESC
                LIMIT 50
            ");
            $stmt->execute([$userId]);
        }
        
        $comments = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Format comments with camelCase and add time ago
        $formattedComments = array_map(function($comment) {
            return [
                'id' => (int)$comment['id'],
                'content' => $comment['content'],
                'parentId' => $comment['parent_id'] ? (int)$comment['parent_id'] : null,
                'likesCount' => (int)$comment['likes_count'],
                'userLiked' => (bool)$comment['user_liked'],
                'createdAt' => $comment['created_at'],
                'timeAgo' => timeAgo($comment['created_at']),
                'user' => [
                    'username' => $comment['username'],
                    'profileImage' => $comment['profile_image'],
                    'accountType' => $comment['account_type']
                ]
            ];
        }, $comments);
        
        ApiResponse::success($formattedComments, 'Comments retrieved successfully');
        
    } catch (PDOException $e) {
        ApiResponse::error('Failed to retrieve comments: ' . $e->getMessage());
    }
}

function postComment($conn, $user, $input) {
    if (!isset($input['content']) || empty(trim($input['content']))) {
        ApiResponse::error('Comment content is required');
    }
    
    $content = trim($input['content']);
    $parentId = isset($input['parent_id']) ? (int)$input['parent_id'] : null;
    $targetUser = isset($input['target_user']) ? trim($input['target_user']) : null;
    
    if (strlen($content) > 1000) {
        ApiResponse::error('Comment too long (max 1000 characters)');
    }
    
    // Get target user ID if target_user is provided
    $targetUserId = null;
    if ($targetUser) {
        $stmt = $conn->prepare("SELECT id FROM users WHERE username = ?");
        $stmt->execute([$targetUser]);
        $targetUserData = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($targetUserData) {
            $targetUserId = $targetUserData['id'];
        }
    }
    
    try {
        $stmt = $conn->prepare("
            INSERT INTO comments (user_id, content, parent_id, target_user_id)
            VALUES (?, ?, ?, ?)
        ");
        
        $stmt->execute([$user['id'], $content, $parentId, $targetUserId]);
        $commentId = $conn->lastInsertId();
        
        // Get the created comment with user info
        $stmt = $conn->prepare("
            SELECT 
                c.id,
                c.content,
                c.parent_id,
                c.likes_count,
                c.created_at,
                u.username,
                u.profile_image,
                u.account_type
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.id = ?
        ");
        
        $stmt->execute([$commentId]);
        $comment = $stmt->fetch(PDO::FETCH_ASSOC);
        
        $formattedComment = [
            'id' => (int)$comment['id'],
            'content' => $comment['content'],
            'parentId' => $comment['parent_id'] ? (int)$comment['parent_id'] : null,
            'likesCount' => (int)$comment['likes_count'],
            'userLiked' => false,
            'createdAt' => $comment['created_at'],
            'timeAgo' => timeAgo($comment['created_at']),
            'user' => [
                'username' => $comment['username'],
                'profileImage' => $comment['profile_image'],
                'accountType' => $comment['account_type']
            ]
        ];
        
        ApiResponse::success($formattedComment, 'Comment posted successfully');
        
    } catch (PDOException $e) {
        ApiResponse::error('Failed to post comment: ' . $e->getMessage());
    }
}

function likeComment($conn, $user, $input) {
    if (!isset($input['comment_id'])) {
        ApiResponse::error('Comment ID is required');
    }
    
    $commentId = (int)$input['comment_id'];
    
    try {
        // Check if already liked
        $stmt = $conn->prepare("
            SELECT id FROM comment_likes 
            WHERE comment_id = ? AND user_id = ?
        ");
        $stmt->execute([$commentId, $user['id']]);
        
        if ($stmt->fetch()) {
            ApiResponse::error('Comment already liked');
        }
        
        // Add like
        $conn->beginTransaction();
        
        $stmt = $conn->prepare("
            INSERT INTO comment_likes (comment_id, user_id)
            VALUES (?, ?)
        ");
        $stmt->execute([$commentId, $user['id']]);
        
        // Update likes count
        $stmt = $conn->prepare("
            UPDATE comments 
            SET likes_count = likes_count + 1
            WHERE id = ?
        ");
        $stmt->execute([$commentId]);
        
        $conn->commit();
        
        ApiResponse::success(null, 'Comment liked successfully');
        
    } catch (PDOException $e) {
        $conn->rollback();
        ApiResponse::error('Failed to like comment: ' . $e->getMessage());
    }
}

function unlikeComment($conn, $user, $input) {
    if (!isset($input['comment_id'])) {
        ApiResponse::error('Comment ID is required');
    }
    
    $commentId = (int)$input['comment_id'];
    
    try {
        $conn->beginTransaction();
        
        // Remove like
        $stmt = $conn->prepare("
            DELETE FROM comment_likes 
            WHERE comment_id = ? AND user_id = ?
        ");
        $stmt->execute([$commentId, $user['id']]);
        
        if ($stmt->rowCount() === 0) {
            $conn->rollback();
            ApiResponse::error('Comment not liked by user');
        }
        
        // Update likes count
        $stmt = $conn->prepare("
            UPDATE comments 
            SET likes_count = likes_count - 1
            WHERE id = ?
        ");
        $stmt->execute([$commentId]);
        
        $conn->commit();
        
        ApiResponse::success(null, 'Comment unliked successfully');
        
    } catch (PDOException $e) {
        $conn->rollback();
        ApiResponse::error('Failed to unlike comment: ' . $e->getMessage());
    }
}

function deleteComment($conn, $user, $commentId) {
    if (empty($commentId)) {
        ApiResponse::error('Comment ID is required');
    }
    
    $commentId = (int)$commentId;
    
    try {
        // Check if user owns the comment or is admin
        $stmt = $conn->prepare("
            SELECT user_id FROM comments WHERE id = ?
        ");
        $stmt->execute([$commentId]);
        $comment = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$comment) {
            ApiResponse::error('Comment not found', 404);
        }
        
        if ($comment['user_id'] != $user['id'] && $user['accountType'] !== 'admin') {
            ApiResponse::error('Permission denied', 403);
        }
        
        // Delete comment (cascades to likes and replies)
        $stmt = $conn->prepare("DELETE FROM comments WHERE id = ?");
        $stmt->execute([$commentId]);
        
        ApiResponse::success(null, 'Comment deleted successfully');
        
    } catch (PDOException $e) {
        ApiResponse::error('Failed to delete comment: ' . $e->getMessage());
    }
}

function getCurrentUserId() {
    global $user;
    return $user['id'];
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