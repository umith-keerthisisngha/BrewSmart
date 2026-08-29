-- Run this in phpMyAdmin (SQL tab) on brewsMart_db if the table doesn't exist yet
CREATE TABLE IF NOT EXISTS role_permissions (
  permission_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  role ENUM('ADMIN','MANAGER','WAREHOUSE_STAFF','BROKER') NOT NULL,
  page_key VARCHAR(50) NOT NULL,
  has_access TINYINT(1) DEFAULT 0,
  UNIQUE KEY uq_role_page (role, page_key)
);

INSERT IGNORE INTO role_permissions (role, page_key, has_access) VALUES
('ADMIN','brokering',1),('ADMIN','warehousing',1),('ADMIN','master',1),
('MANAGER','brokering',0),('MANAGER','warehousing',0),('MANAGER','master',0),
('WAREHOUSE_STAFF','brokering',0),('WAREHOUSE_STAFF','warehousing',0),('WAREHOUSE_STAFF','master',0),
('BROKER','brokering',0),('BROKER','warehousing',0),('BROKER','master',0);
