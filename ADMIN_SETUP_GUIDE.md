# Admin Setup Guide - Secure Loader System

## 🔒 Overview

This project now uses a **secure database-only loader storage system** with **one-time download tokens** for maximum security. No loader files are stored on the file system - everything is in the database.

## 📋 Prerequisites

- **PHP 7.4+** with PDO MySQL extension
- **MySQL/MariaDB** database
- **Apache/Nginx** web server
- **File upload support** (50MB max)

## 🛠️ Initial Setup

### 1. Database Configuration

Update your database credentials in `config/database.php`:

```php
private $host = "localhost";       // Your database host
private $db_name = "your_db_name"; // Your database name  
private $username = "your_user";   // Your database user
private $password = "your_pass";   // Your database password
```

### 2. Required Database Tables

The system requires these tables. If missing, create them:

#### Download Tokens Table (CRITICAL)
```sql
CREATE TABLE download_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    token VARCHAR(64) NOT NULL UNIQUE,
    user_id INT NOT NULL,
    loader_id INT NOT NULL,
    cheat_name VARCHAR(100) NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_token (token),
    INDEX idx_user_id (user_id),
    INDEX idx_expires_at (expires_at),
    INDEX idx_cheat_name (cheat_name),
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (loader_id) REFERENCES loaders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### Loaders Table (should exist)
```sql
-- Ensure loaders table has file_data LONGBLOB column
ALTER TABLE loaders ADD COLUMN file_data LONGBLOB AFTER file_hash;
```

**Note**: Payment processor tables (orders, crypto_payments, payment_logs, discount_codes) have been removed since payments are handled externally.

### 3. File Permissions

Set proper permissions:
```bash
chmod 755 api/
chmod 644 api/*.php
chmod 755 config/
chmod 644 config/*.php
```

## 🔐 Security Features

### Database-Only Storage
- ✅ **No files on disk** - loaders stored as database BLOBs
- ✅ **No web access** - files cannot be accessed directly via URL
- ✅ **Original preservation** - files stored exactly as uploaded

### One-Time Download Tokens  
- ✅ **30-minute expiration** - tokens expire automatically
- ✅ **Single use** - tokens become invalid after download
- ✅ **User-specific** - tokens tied to authenticated accounts
- ✅ **IP tracking** - security audit trail maintained

### Authentication Requirements
- ✅ **Session validation** - all requests require valid session
- ✅ **Role-based access** - upload restricted to femboy/admin/owner roles
- ✅ **Rate limiting** - prevents abuse and enumeration

## 👥 User Roles & Permissions

### Admin Roles (Can Upload/Manage Loaders)
- `femboy` - Full loader management access
- `admin` - Full loader management access  
- `owner` - Full loader management access

### User Roles (Can Download Only)
- All authenticated users can download with valid subscriptions

## 📁 How It Works

### Upload Process
1. Admin uploads loader via web interface
2. File stored as BLOB in database (never on disk)
3. Original filename and metadata preserved
4. Upload logged for audit trail

### Download Process
1. User requests download for a cheat
2. System generates one-time token (30min expiration)
3. User downloads using token URL
4. Token consumed and becomes invalid
5. Download logged for tracking

### Token Generation
```javascript
// Frontend API call
const response = await api.generateDownloadToken('onetap');
const downloadUrl = `/api/loader_endpoints.php?action=download&token=${response.data.token}`;
```

## 🛡️ Security Considerations

### For Production
1. **Enable HTTPS** - Set `session.cookie_secure = 1` in php.ini
2. **Update .htaccess** - Ensure security headers are active
3. **Database backups** - Regular backups of loader BLOBs
4. **Monitor logs** - Check activity_logs for suspicious behavior

### Token Security
- Tokens are cryptographically secure (64 random bytes)
- Each user can have one active token per cheat
- Expired tokens cleaned up automatically
- Full audit trail of all downloads

## 🔧 Admin Operations

### Upload New Loader
1. Go to admin panel
2. Select cheat from dropdown
3. Upload .exe file
4. System stores in database automatically

### View Downloads
- Check `activity_logs` table for download tracking
- Monitor `download_tokens` table for active tokens

### Troubleshooting
- Enable error logging: `error_log()` calls throughout code
- Check MySQL error logs for database issues
- Verify file upload limits in php.ini

## 📈 Monitoring

### Key Metrics to Track
- Download count per cheat
- Token generation rate
- Failed authentication attempts
- File upload success/failure

### Log Files to Monitor
- PHP error logs
- MySQL error logs  
- Apache/Nginx access logs
- Custom activity logs in database

## ⚠️ Important Notes

1. **Database Size** - Loaders are stored as BLOBs, monitor database size
2. **Backup Strategy** - Include BLOB data in database backups
3. **Old Files** - No cleanup needed (everything in database)
4. **Token Cleanup** - Expired tokens cleaned automatically
5. **Binary Integrity** - Files preserved exactly as uploaded (no PE modification)
6. **Payment Processing** - Payment processor tables removed (orders, crypto_payments, etc.) - handle payments externally
7. **Core Features Kept** - Telemetry, logs, subscription history, and all security features preserved

## 🚀 Ready to Go!

The system is now secure and ready for production use. Your loaders are:
- ✅ Protected from direct web access
- ✅ Only downloadable with valid authentication  
- ✅ Time-limited and single-use downloads
- ✅ Fully audited and logged

**No additional setup required** - just ensure your database connection works and you're ready! 