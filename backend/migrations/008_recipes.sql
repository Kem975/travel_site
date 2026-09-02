-- 008_recipes.sql — the recipes section.
--
-- Split in two on purpose. A recipe's *identity* — which country it belongs to,
-- its slug, its cover, the stop it's pinned to — is the same in every language,
-- while its words are not. Articles get away with one table because the shared
-- half already lives on `destinations`; a recipe has no such host, so it needs
-- its own. recipe_translations is to recipes what articles is to destinations.

SET NAMES utf8mb4;

CREATE TABLE recipes (
    id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
    trip_id        INT UNSIGNED NOT NULL,
    -- Optional: pins the recipe to one stop, so that stop's page can point to it.
    destination_id INT UNSIGNED NULL,
    slug           VARCHAR(180) NOT NULL,
    cover_photo_id INT UNSIGNED NULL,
    sort_order     INT NOT NULL DEFAULT 0,
    created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_recipes_slug (slug),
    KEY idx_recipes_trip (trip_id),
    KEY idx_recipes_destination (destination_id),
    CONSTRAINT fk_recipes_trip FOREIGN KEY (trip_id) REFERENCES trips (id) ON DELETE CASCADE,
    CONSTRAINT fk_recipes_destination FOREIGN KEY (destination_id) REFERENCES destinations (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE recipe_translations (
    id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
    recipe_id    INT UNSIGNED NOT NULL,
    lang         CHAR(2) NOT NULL,
    title        VARCHAR(200) NOT NULL,
    subtitle     VARCHAR(300) NULL,
    -- Ordered lists of plain strings. No table of their own: they are never queried
    -- across recipes, only ever read and rewritten whole with their translation.
    ingredients  JSON NOT NULL,
    steps        JSON NOT NULL,
    status       ENUM('draft','published') NOT NULL DEFAULT 'draft',
    published_at DATETIME NULL,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_recipe_translation (recipe_id, lang),
    CONSTRAINT fk_recipe_translations_recipe FOREIGN KEY (recipe_id) REFERENCES recipes (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Same block model as articles, hanging off a translation: the English version can
-- illustrate a different step, or skip a photo, without disturbing the French one.
CREATE TABLE recipe_blocks (
    id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
    translation_id INT UNSIGNED NOT NULL,
    block_type     VARCHAR(40) NOT NULL,
    content_json   JSON NOT NULL,
    sort_order     INT NOT NULL DEFAULT 0,
    created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_recipe_blocks_translation (translation_id, sort_order),
    CONSTRAINT fk_recipe_blocks_translation FOREIGN KEY (translation_id) REFERENCES recipe_translations (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
