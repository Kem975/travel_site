-- 001_init.sql — Our Journey initial schema
-- utf8mb4 + InnoDB throughout. Reflects PLAN_REVIEW corrections:
--   A2/A4 sessions table (visitor gate + admin, DB-token), C1 photo category,
--   C3 variants-by-convention, C4 nullable destination_id, C5 no aspect_ratio,
--   C6 article 1:1 destination, C7 hashed comment IP.

SET NAMES utf8mb4;

CREATE TABLE users (
    id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
    email         VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name  VARCHAR(120) NOT NULL,
    role          ENUM('admin','editor') NOT NULL DEFAULT 'editor',
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE trips (
    id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
    title          VARCHAR(180) NOT NULL,
    slug           VARCHAR(180) NOT NULL,
    description    TEXT NULL,
    cover_photo_id INT UNSIGNED NULL,
    start_date     DATE NULL,
    end_date       DATE NULL,
    status         ENUM('draft','published','archived') NOT NULL DEFAULT 'draft',
    visibility     ENUM('private','password_protected','public') NOT NULL DEFAULT 'password_protected',
    created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_trips_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE destinations (
    id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
    trip_id        INT UNSIGNED NOT NULL,
    title          VARCHAR(180) NOT NULL,
    slug           VARCHAR(180) NOT NULL,
    country        VARCHAR(120) NULL,
    latitude       DECIMAL(9,6) NULL,
    longitude      DECIMAL(9,6) NULL,
    arrival_date   DATE NULL,
    departure_date DATE NULL,
    excerpt        VARCHAR(500) NULL,
    cover_photo_id INT UNSIGNED NULL,
    status         ENUM('planned','visited','current','cancelled','hidden') NOT NULL DEFAULT 'planned',
    sort_order     INT NOT NULL DEFAULT 0,
    published_at   DATETIME NULL,
    created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_destinations_trip_slug (trip_id, slug),
    KEY idx_destinations_trip (trip_id),
    CONSTRAINT fk_destinations_trip FOREIGN KEY (trip_id) REFERENCES trips (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE articles (
    id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
    destination_id INT UNSIGNED NOT NULL,
    title          VARCHAR(200) NULL,
    subtitle       VARCHAR(300) NULL,
    status         ENUM('draft','scheduled','published','archived') NOT NULL DEFAULT 'draft',
    published_at   DATETIME NULL,
    created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_articles_destination (destination_id),
    CONSTRAINT fk_articles_destination FOREIGN KEY (destination_id) REFERENCES destinations (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE article_blocks (
    id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
    article_id   INT UNSIGNED NOT NULL,
    block_type   VARCHAR(40) NOT NULL,
    content_json JSON NOT NULL,
    sort_order   INT NOT NULL DEFAULT 0,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_blocks_article (article_id, sort_order),
    CONSTRAINT fk_blocks_article FOREIGN KEY (article_id) REFERENCES articles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE photos (
    id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
    destination_id    INT UNSIGNED NULL,
    trip_id           INT UNSIGNED NULL,
    filename          VARCHAR(255) NOT NULL,
    storage_path      VARCHAR(500) NOT NULL,
    original_filename VARCHAR(255) NULL,
    mime_type         VARCHAR(80) NULL,
    width             INT UNSIGNED NULL,
    height            INT UNSIGNED NULL,
    alt_text          VARCHAR(300) NULL,
    caption           VARCHAR(500) NULL,
    category          VARCHAR(40) NULL,
    taken_at          DATETIME NULL,
    latitude          DECIMAL(9,6) NULL,
    longitude         DECIMAL(9,6) NULL,
    sort_order        INT NOT NULL DEFAULT 0,
    is_featured       TINYINT(1) NOT NULL DEFAULT 0,
    created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_photos_destination (destination_id),
    KEY idx_photos_trip (trip_id),
    KEY idx_photos_category (category),
    CONSTRAINT fk_photos_destination FOREIGN KEY (destination_id) REFERENCES destinations (id) ON DELETE SET NULL,
    CONSTRAINT fk_photos_trip FOREIGN KEY (trip_id) REFERENCES trips (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE comments (
    id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
    destination_id INT UNSIGNED NOT NULL,
    parent_id      INT UNSIGNED NULL,
    author_name    VARCHAR(120) NOT NULL,
    author_email   VARCHAR(255) NULL,
    body           TEXT NOT NULL,
    status         ENUM('pending','published','rejected','spam') NOT NULL DEFAULT 'pending',
    ip_hash        CHAR(64) NULL,
    created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_comments_destination (destination_id, status),
    KEY idx_comments_parent (parent_id),
    CONSTRAINT fk_comments_destination FOREIGN KEY (destination_id) REFERENCES destinations (id) ON DELETE CASCADE,
    CONSTRAINT fk_comments_parent FOREIGN KEY (parent_id) REFERENCES comments (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE sessions (
    id                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
    scope              ENUM('visitor','admin') NOT NULL,
    user_id            INT UNSIGNED NULL,
    session_token_hash CHAR(64) NOT NULL,
    expires_at         DATETIME NOT NULL,
    created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at       DATETIME NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_sessions_token (session_token_hash),
    KEY idx_sessions_expiry (expires_at),
    CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE site_settings (
    setting_key   VARCHAR(80) NOT NULL,
    setting_value TEXT NULL,
    updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Cover-photo FKs added after photos exists (avoids a circular create order).
ALTER TABLE trips        ADD CONSTRAINT fk_trips_cover        FOREIGN KEY (cover_photo_id) REFERENCES photos (id) ON DELETE SET NULL;
ALTER TABLE destinations ADD CONSTRAINT fk_destinations_cover FOREIGN KEY (cover_photo_id) REFERENCES photos (id) ON DELETE SET NULL;

-- Default settings (real values set later via the admin UI).
INSERT INTO site_settings (setting_key, setting_value) VALUES
    ('site_title', 'Our Journey'),
    ('trip_password_hash', NULL),
    ('session_duration_days', '30'),
    ('comments_enabled', '1'),
    ('comments_require_approval', '1'),
    ('future_destinations_visible', '0');
