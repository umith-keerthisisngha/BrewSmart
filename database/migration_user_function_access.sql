USE brewsMart_db;

-- BrewSmart user-by-user function access control.
-- Run after database.sql (and after migrations_2026_full_upgrade.sql if you use it).

CREATE TABLE IF NOT EXISTS permission_catalog (
  permission_key VARCHAR(80) PRIMARY KEY,
  module_name VARCHAR(40) NOT NULL,
  group_name VARCHAR(80) NOT NULL,
  permission_label VARCHAR(120) NOT NULL,
  route_path VARCHAR(180) NULL,
  sort_order INT NOT NULL DEFAULT 100,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_permissions (
  user_permission_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  permission_key VARCHAR(80) NOT NULL,
  has_access TINYINT(1) NOT NULL DEFAULT 0,
  granted_by INT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_permission (user_id, permission_key),
  INDEX idx_user_permissions_user (user_id),
  INDEX idx_user_permissions_key (permission_key),
  CONSTRAINT fk_user_permissions_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_user_permissions_granted_by FOREIGN KEY (granted_by) REFERENCES users(user_id) ON DELETE SET NULL,
  CONSTRAINT fk_user_permissions_catalog FOREIGN KEY (permission_key) REFERENCES permission_catalog(permission_key) ON DELETE CASCADE
) ENGINE=InnoDB;

INSERT INTO permission_catalog(permission_key,module_name,group_name,permission_label,route_path,sort_order) VALUES
('brokering.home','BROKERING','General','Brokering Home','/brokering',10),
('brokering.bin_operation','BROKERING','Operations','Bin Operation',NULL,20),
('brokering.auction_sale','BROKERING','Operations','Auction Sale',NULL,30),
('brokering.private_sale','BROKERING','Operations','Private Sale',NULL,40),
('brokering.payment_settlement','BROKERING','Operations','Payment & Settlement',NULL,50),
('brokering.data_upload','BROKERING','Operations','Data Upload',NULL,60),
('brokering.monthly_process','BROKERING','Operations','Monthly Process',NULL,70),
('brokering.dr_cr','BROKERING','Operations','DR/CR',NULL,80),
('brokering.inquiries','BROKERING','Inquiry','Inquiries',NULL,90),
('brokering.sms','BROKERING','Communication','SMS',NULL,100),

('master.access_manager','BROKERING MASTER','Administration','Access Manager','/master/access-manager',110),
('master.mark','BROKERING MASTER','Master Data','Mark Master','/master/mark',120),
('master.grade','BROKERING MASTER','Master Data','Grade Master','/master/grade',130),
('master.packing_type','BROKERING MASTER','Master Data','Packing Type Master','/master/packing-type',140),
('master.user_account','BROKERING MASTER','Administration','User Account','/master/user-account',150),

('warehousing.home','WAREHOUSING','General','Warehousing Home','/warehousing',210),
('warehousing.invoice_add','WAREHOUSING','Invoice Entry','Invoice Entry - Add New','/warehousing/bin-operation/invoice-entry/add',220),
('warehousing.invoice_edit','WAREHOUSING','Invoice Entry','Invoice Entry - Edit','/warehousing/bin-operation/invoice-entry/edit',230),
('warehousing.invoice_download','WAREHOUSING','Invoice Entry','Invoice Entry - Download','/warehousing/bin-operation/invoice-entry/download',240),
('warehousing.grn_print','WAREHOUSING','GRN','GRN Print / Unloading List','/warehousing/bin-operation/grn/print',250),
('warehousing.grn_add_edit','WAREHOUSING','GRN','Add / Edit GRN','/warehousing/bin-operation/grn/add-edit',260),
('warehousing.chest_location','WAREHOUSING','GRN','Chest Location Details','/warehousing/bin-operation/grn/chest-location',270),
('warehousing.turn_number','WAREHOUSING','GRN','Turn Number Allocation','/warehousing/bin-operation/grn/turn-number',280),
('warehousing.gin_add','WAREHOUSING','GIN','Add GIN','/warehousing/bin-operation/gin/add',290),
('warehousing.gin_picking','WAREHOUSING','GIN','Picking List / GIN Print','/warehousing/bin-operation/gin/picking-list',300),
('warehousing.reports','WAREHOUSING','Information','Reports','/warehousing/reports',310),
('warehousing.inquiry','WAREHOUSING','Information','Inquiry','/warehousing/inquiry',320),
('warehousing.ai_allocation','WAREHOUSING','Optimization','AI Location Allocation','/warehousing/ai-allocation',330),
('warehousing.master','WAREHOUSING','Administration','Warehouse Master','/warehousing/master',340)
ON DUPLICATE KEY UPDATE
  module_name=VALUES(module_name),
  group_name=VALUES(group_name),
  permission_label=VALUES(permission_label),
  route_path=VALUES(route_path),
  sort_order=VALUES(sort_order),
  active=1;

-- Build fine-grained defaults from the existing broad role permissions.
INSERT IGNORE INTO role_permissions(role,page_key,has_access)
SELECT rp.role, pc.permission_key, rp.has_access
FROM permission_catalog pc
JOIN role_permissions rp
  ON rp.page_key = CASE
    WHEN pc.permission_key LIKE 'brokering.%' THEN 'brokering'
    WHEN pc.permission_key LIKE 'master.%' THEN 'master'
    WHEN pc.permission_key LIKE 'warehousing.%' THEN 'warehousing'
    ELSE ''
  END;

-- Managers and administrators are the Access Manager operators.
INSERT INTO role_permissions(role,page_key,has_access) VALUES
('MANAGER','master.access_manager',1)
ON DUPLICATE KEY UPDATE has_access=1;

-- Admin is always allowed by backend policy, but this keeps role reports clear.
INSERT INTO role_permissions(role,page_key,has_access) VALUES
('ADMIN','master.access_manager',1),
('ADMIN','master.mark',1),
('ADMIN','master.grade',1),
('ADMIN','master.packing_type',1),
('ADMIN','master.user_account',1)
ON DUPLICATE KEY UPDATE has_access=1;
