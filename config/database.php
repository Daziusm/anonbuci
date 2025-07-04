<?php
// Secure Database configuration
class Database {
    // Production: Use environment variables or separate config file
    private $host = 'localhost';   
    private $db_name = 'anonteam_db';
    private $username = 'root';
    private $password = '';
    private $conn;

    public function getConnection() {
        $this->conn = null;

        try {
            $this->conn = new PDO(
                "mysql:host=" . $this->host . ";dbname=" . $this->db_name . ";charset=utf8mb4",
                $this->username,
                $this->password,
                [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false, // Security: Use real prepared statements
                    PDO::MYSQL_ATTR_FOUND_ROWS => true,
                    PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci"
                ]
            );
            
            // Set larger timeouts for BLOB operations
            $this->conn->exec("SET SESSION wait_timeout = 300");
            $this->conn->exec("SET SESSION interactive_timeout = 300");
            
        } catch(PDOException $exception) {
            // Security: Don't expose database errors
            error_log("Database connection error: " . $exception->getMessage());
            throw new Exception("Database connection failed");
        }

        return $this->conn;
    }
}
?> 