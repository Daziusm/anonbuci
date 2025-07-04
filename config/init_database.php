<?php
require_once 'database.php';

class DatabaseInitializer {
    private $conn;

    public function __construct() {
        $database = new Database();
        $this->conn = $database->getConnection();
    }

    public function createTables() {
        try {
            // Users table
            $this->conn->exec("
                CREATE TABLE IF NOT EXISTS users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(50) UNIQUE NOT NULL,
                    email VARCHAR(100) UNIQUE NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    account_type ENUM('user', 'premium', 'admin', 'owner', 'femboy') DEFAULT 'user',
                    hwid VARCHAR(255) DEFAULT NULL,
                    hwid_reset_count INT DEFAULT 0,
                    last_hwid_reset TIMESTAMP NULL,
                    join_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_login TIMESTAMP NULL,
                    is_banned BOOLEAN DEFAULT FALSE,
                    ban_reason TEXT NULL,
                    banned_by VARCHAR(50) NULL,
                    banned_at TIMESTAMP NULL,
                    profile_image TEXT NULL,
                    banner_image TEXT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");

            // Products/Cheats table
            $this->conn->exec("
                CREATE TABLE IF NOT EXISTS products (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(100) UNIQUE NOT NULL,
                    display_name VARCHAR(100) NOT NULL,
                    description TEXT NULL,
                    price DECIMAL(10,2) DEFAULT 0.00,
                    is_frozen BOOLEAN DEFAULT FALSE,
                    is_alpha_only BOOLEAN DEFAULT FALSE,
                    is_broken BOOLEAN DEFAULT FALSE,
                    icon_url TEXT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");

            // Subscriptions table
            $this->conn->exec("
                CREATE TABLE IF NOT EXISTS subscriptions (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    product_id INT NOT NULL,
                    start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    end_date DATETIME NOT NULL,
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
                    UNIQUE KEY unique_user_product (user_id, product_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");

            // License Keys table
            $this->conn->exec("
                CREATE TABLE IF NOT EXISTS license_keys (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    key_code VARCHAR(50) UNIQUE NOT NULL,
                    product_id INT NOT NULL,
                    duration_days INT NOT NULL,
                    is_used BOOLEAN DEFAULT FALSE,
                    used_by INT NULL,
                    used_at TIMESTAMP NULL,
                    created_by INT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP NULL,
                    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
                    FOREIGN KEY (used_by) REFERENCES users(id) ON DELETE SET NULL,
                    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");

            // Invite Codes table
            $this->conn->exec("
                CREATE TABLE IF NOT EXISTS invite_codes (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    code VARCHAR(20) UNIQUE NOT NULL,
                    created_by INT NOT NULL,
                    used_by INT NULL,
                    used_at TIMESTAMP NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (used_by) REFERENCES users(id) ON DELETE SET NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");

            // Activity Logs table (legacy format maintained for compatibility)
            $this->conn->exec("
                CREATE TABLE IF NOT EXISTS activity_logs (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NULL,
                    username VARCHAR(255) NULL,
                    type VARCHAR(50) NULL,
                    activity_type VARCHAR(50) NULL,
                    action TEXT NULL,
                    description TEXT NULL,
                    ip_address VARCHAR(45) NULL,
                    user_agent TEXT NULL,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_username (username),
                    INDEX idx_type (type),
                    INDEX idx_timestamp (timestamp),
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");
            
            // Alter existing activity_logs table to add missing columns if they don't exist
            try {
                $this->conn->exec("ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS username VARCHAR(255) NULL");
                $this->conn->exec("ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS type VARCHAR(50) NULL");
                $this->conn->exec("ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS action TEXT NULL");
                $this->conn->exec("ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
                $this->conn->exec("ALTER TABLE activity_logs ADD INDEX IF NOT EXISTS idx_username (username)");
                $this->conn->exec("ALTER TABLE activity_logs ADD INDEX IF NOT EXISTS idx_type (type)");
                $this->conn->exec("ALTER TABLE activity_logs ADD INDEX IF NOT EXISTS idx_timestamp (timestamp)");
            } catch(PDOException $e) {
                // Ignore errors for columns that already exist
            }

            // Shoutbox Messages table
            $this->conn->exec("
                CREATE TABLE IF NOT EXISTS shoutbox_messages (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    message TEXT NOT NULL,
                    mentions JSON NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");

            // Comments table
            $this->conn->exec("
                CREATE TABLE IF NOT EXISTS comments (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    content TEXT NOT NULL,
                    parent_id INT NULL,
                    likes_count INT DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");

            // Comment Likes table
            $this->conn->exec("
                CREATE TABLE IF NOT EXISTS comment_likes (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    comment_id INT NOT NULL,
                    user_id INT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    UNIQUE KEY unique_comment_user (comment_id, user_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");

            // Sessions table for better security
            $this->conn->exec("
                CREATE TABLE IF NOT EXISTS user_sessions (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    session_token VARCHAR(255) UNIQUE NOT NULL,
                    ip_address VARCHAR(45) NOT NULL,
                    user_agent TEXT NOT NULL,
                    expires_at TIMESTAMP NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");

            // Create loaders table with enhanced security fields
            $this->conn->exec("
                CREATE TABLE IF NOT EXISTS loaders (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    cheat_name VARCHAR(50) NOT NULL,
                    filename VARCHAR(255) NOT NULL,
                    original_filename VARCHAR(255) NOT NULL,
                    file_size INT NOT NULL,
                    file_data LONGBLOB NOT NULL,
                    file_hash VARCHAR(64) NULL,
                    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    uploaded_by VARCHAR(255) NOT NULL,
                    is_active BOOLEAN DEFAULT 1,
                    download_count INT DEFAULT 0,
                    last_downloaded_at TIMESTAMP NULL,
                    security_flags JSON NULL,
                    UNIQUE KEY unique_cheat (cheat_name),
                    INDEX idx_cheat_name (cheat_name),
                    INDEX idx_active (is_active),
                    INDEX idx_upload_date (upload_date),
                    INDEX idx_last_downloaded (last_downloaded_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");
            
            // Alter existing loaders table to add missing columns if they don't exist
            try {
                $this->conn->exec("ALTER TABLE loaders ADD COLUMN IF NOT EXISTS file_data LONGBLOB");
                $this->conn->exec("ALTER TABLE loaders ADD COLUMN IF NOT EXISTS file_hash VARCHAR(64) NULL");
                $this->conn->exec("ALTER TABLE loaders ADD COLUMN IF NOT EXISTS last_downloaded_at TIMESTAMP NULL");
                $this->conn->exec("ALTER TABLE loaders ADD COLUMN IF NOT EXISTS security_flags JSON NULL");
                $this->conn->exec("ALTER TABLE loaders ADD INDEX IF NOT EXISTS idx_upload_date (upload_date)");
                $this->conn->exec("ALTER TABLE loaders ADD INDEX IF NOT EXISTS idx_last_downloaded (last_downloaded_at)");
            } catch(PDOException $e) {
                // Ignore errors for columns that already exist
            }

            // Security logs table for enhanced monitoring
            $this->conn->exec("
                CREATE TABLE IF NOT EXISTS security_logs (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NULL,
                    event_type VARCHAR(100) NOT NULL,
                    details TEXT NULL,
                    severity ENUM('INFO', 'WARNING', 'ERROR', 'CRITICAL') DEFAULT 'INFO',
                    ip_address VARCHAR(45) NULL,
                    user_agent TEXT NULL,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_user_id (user_id),
                    INDEX idx_event_type (event_type),
                    INDEX idx_severity (severity),
                    INDEX idx_timestamp (timestamp),
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");

            // HWID Reset Requests table for download security
            $this->conn->exec("
                CREATE TABLE IF NOT EXISTS hwid_reset_requests (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    reason TEXT NULL,
                    status ENUM('pending', 'approved', 'denied') DEFAULT 'pending',
                    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    processed_at TIMESTAMP NULL,
                    processed_by INT NULL,
                    admin_notes TEXT NULL,
                    INDEX idx_user_id (user_id),
                    INDEX idx_status (status),
                    INDEX idx_requested_at (requested_at),
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");

            // One-time download tokens for maximum security
            $this->conn->exec("
                CREATE TABLE IF NOT EXISTS download_tokens (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    token VARCHAR(64) UNIQUE NOT NULL,
                    user_id INT NOT NULL,
                    loader_id INT NOT NULL,
                    cheat_name VARCHAR(50) NOT NULL,
                    expires_at TIMESTAMP NOT NULL,
                    used_at TIMESTAMP NULL,
                    ip_address VARCHAR(45) NOT NULL,
                    user_agent TEXT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_token (token),
                    INDEX idx_user_id (user_id),
                    INDEX idx_loader_id (loader_id),
                    INDEX idx_expires_at (expires_at),
                    INDEX idx_used_at (used_at),
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (loader_id) REFERENCES loaders(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");

            echo "All tables created successfully!\n";
            return true;

        } catch(PDOException $e) {
            echo "Error creating tables: " . $e->getMessage() . "\n";
            return false;
        }
    }

    public function insertDefaultData() {
        try {
            // Insert default products
            $products = [
                ['name' => 'compkiller', 'display_name' => '[CS:2] Compkiller', 'price' => 7.00],
                ['name' => 'neverlose', 'display_name' => '[CS:2] Neverlose', 'price' => 15.00],
                ['name' => 'onetap', 'display_name' => '[CS:GO] Onetap', 'price' => 50.00],
                ['name' => 'fatality', 'display_name' => '[CS:2] Fatality', 'price' => 13.80]
            ];

            $stmt = $this->conn->prepare("
                INSERT IGNORE INTO products (name, display_name, price) 
                VALUES (:name, :display_name, :price)
            ");

            foreach ($products as $product) {
                $stmt->execute($product);
            }

            // Create default admin user
            $adminPassword = password_hash('admin123', PASSWORD_DEFAULT);
            
            $stmt = $this->conn->prepare("
                INSERT IGNORE INTO users (username, email, password_hash, account_type) 
                VALUES ('admin', 'admin@anonteam.com', :password, 'admin')
            ");
            $stmt->execute(['password' => $adminPassword]);

            echo "Default data inserted successfully!\n";
            return true;

        } catch(PDOException $e) {
            echo "Error inserting default data: " . $e->getMessage() . "\n";
            return false;
        }
    }
}

// Run the initialization
if (php_sapi_name() === 'cli' || isset($_GET['init'])) {
    $initializer = new DatabaseInitializer();
    
    if ($initializer->createTables()) {
        $initializer->insertDefaultData();
        echo "Database initialization completed!\n";
        echo "Default admin credentials:\n";
        echo "Username: admin\n";
        echo "Password: admin123\n";
    }
}
?> 