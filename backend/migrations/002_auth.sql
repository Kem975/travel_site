-- 002_auth.sql — login throttling table (plan §15.7, PLAN_REVIEW rate limiting)
-- Sessions, users, and site_settings already exist from 001_init.sql.

SET NAMES utf8mb4;

CREATE TABLE login_attempts (
    id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
    ip_hash    CHAR(64) NOT NULL,
    scope      ENUM('visitor','admin') NOT NULL,
    success    TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_attempts_ip_scope_time (ip_hash, scope, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
