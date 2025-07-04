<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);
class ApiResponse {
    public static function success($data = null, $message = 'Success') {
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'message' => $message,
            'data' => $data,
            'timestamp' => date('Y-m-d H:i:s')
        ]);
        exit;
    }

    public static function error($message = 'Error', $code = 400) {
        http_response_code($code);
        echo json_encode([
            'success' => false,
            'message' => $message,
            'timestamp' => date('Y-m-d H:i:s')
        ]);
        exit;
    }

    public static function unauthorized($message = 'Unauthorized') {
        self::error($message, 401);
    }

    public static function forbidden($message = 'Forbidden') {
        self::error($message, 403);
    }

    public static function notFound($message = 'Not found') {
        self::error($message, 404);
    }

    public static function validationError($errors) {
        http_response_code(422);
        echo json_encode([
            'success' => false,
            'message' => 'Validation failed',
            'errors' => $errors,
            'timestamp' => date('Y-m-d H:i:s')
        ]);
        exit;
    }
}
?> 