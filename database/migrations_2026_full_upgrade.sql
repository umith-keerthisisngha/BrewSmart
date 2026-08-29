USE brewsMart_db;

-- BrewSmart 2026 warehouse architecture upgrade. Run after database.sql.
ALTER TABLE tea_grades
  ADD COLUMN IF NOT EXISTS packing_density VARCHAR(30) NULL,
  ADD COLUMN IF NOT EXISTS density_value DECIMAL(10,3) NULL,
  ADD COLUMN IF NOT EXISTS average_bag_weight DECIMAL(10,2) NULL,
  ADD COLUMN IF NOT EXISTS minimum_bag_weight DECIMAL(10,2) NULL,
  ADD COLUMN IF NOT EXISTS maximum_bag_weight DECIMAL(10,2) NULL,
  ADD COLUMN IF NOT EXISTS preferred_levels VARCHAR(30) NULL,
  ADD COLUMN IF NOT EXISTS handling_category VARCHAR(60) NULL,
  ADD COLUMN IF NOT EXISTS storage_notes TEXT NULL,
  ADD COLUMN IF NOT EXISTS active TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

ALTER TABLE packing_types
  ADD COLUMN IF NOT EXISTS standard_weight DECIMAL(10,2) NULL,
  ADD COLUMN IF NOT EXISTS min_weight DECIMAL(10,2) NULL,
  ADD COLUMN IF NOT EXISTS max_weight DECIMAL(10,2) NULL,
  ADD COLUMN IF NOT EXISTS length_cm DECIMAL(10,2) NULL,
  ADD COLUMN IF NOT EXISTS width_cm DECIMAL(10,2) NULL,
  ADD COLUMN IF NOT EXISTS height_cm DECIMAL(10,2) NULL,
  ADD COLUMN IF NOT EXISTS calculated_volume DECIMAL(12,3) NULL,
  ADD COLUMN IF NOT EXISTS stackable TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS maximum_stack INT NULL,
  ADD COLUMN IF NOT EXISTS handling_notes TEXT NULL;

CREATE TABLE IF NOT EXISTS warehouses (
  warehouse_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  warehouse_code VARCHAR(30) NOT NULL UNIQUE,
  warehouse_name VARCHAR(150) NOT NULL,
  address VARCHAR(255), active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
INSERT IGNORE INTO warehouses(warehouse_id,warehouse_code,warehouse_name) VALUES (1,'WH-01','BrewSmart Warehouse');
UPDATE warehouses SET warehouse_name='BrewSmart Warehouse' WHERE warehouse_id=1;

CREATE TABLE IF NOT EXISTS location_rules (
  rule_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  rule_name VARCHAR(150) NOT NULL,
  min_bag_weight DECIMAL(10,2) NULL,
  max_bag_weight DECIMAL(10,2) NULL,
  packing_density VARCHAR(30) NULL,
  grade_id INT UNSIGNED NULL,
  packing_type_id INT UNSIGNED NULL,
  allowed_levels VARCHAR(30) NULL,
  prohibited_levels VARCHAR(30) NULL,
  max_location_weight DECIMAL(12,2) NULL,
  priority INT NOT NULL DEFAULT 100,
  mandatory TINYINT(1) NOT NULL DEFAULT 1,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (grade_id) REFERENCES tea_grades(grade_id) ON DELETE SET NULL,
  FOREIGN KEY (packing_type_id) REFERENCES packing_types(packing_type_id) ON DELETE SET NULL
) ENGINE=InnoDB;
INSERT INTO location_rules(rule_name,min_bag_weight,max_bag_weight,allowed_levels,prohibited_levels,priority,mandatory,active)
SELECT 'Heavy tea bag lower-level safety rule',50,65,'A,B,C','D,E,F',1,1,1
WHERE NOT EXISTS (SELECT 1 FROM location_rules WHERE rule_name='Heavy tea bag lower-level safety rule');

ALTER TABLE tea_inventory
  ADD COLUMN IF NOT EXISTS bag_weight DECIMAL(10,2) NULL,
  ADD COLUMN IF NOT EXISTS packing_type_id INT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS packing_density VARCHAR(30) NULL,
  ADD COLUMN IF NOT EXISTS original_weight DECIMAL(14,2) NULL,
  ADD COLUMN IF NOT EXISTS current_weight DECIMAL(14,2) NULL;

-- Rebuild physical slots correctly: 20 racks x 6 levels x 60 positions = 7,200.
DELETE FROM inventory_locations;
DELETE FROM warehouse_locations;
DELETE FROM warehouse_levels;
INSERT INTO warehouse_levels(rack_id,level_number)
SELECT rack_id,n FROM racks CROSS JOIN (
 SELECT 1 n UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6
) x;

ALTER TABLE warehouse_locations
  ADD COLUMN IF NOT EXISTS warehouse_id INT UNSIGNED NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS level_code CHAR(1) NULL,
  ADD COLUMN IF NOT EXISTS position_number TINYINT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS max_weight_capacity DECIMAL(12,2) NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS max_volume_capacity DECIMAL(12,3) NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS current_weight DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_volume DECIMAL(12,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS heavy_load_allowed TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reserved TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS blocked TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS blocked_reason VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS active TINYINT(1) NOT NULL DEFAULT 1;

INSERT INTO warehouse_locations(
 location_code,rack_id,level_id,location_number,capacity_bags,status,warehouse_id,level_code,position_number,
 max_weight_capacity,max_volume_capacity,current_weight,current_volume,heavy_load_allowed,reserved,blocked,active
)
SELECT CONCAT(LPAD(r.rack_id,2,'0'), CHAR(64+l.level_number), LPAD(p.n,2,'0')),
       r.rack_id,l.level_id,p.n,10,'EMPTY',1,CHAR(64+l.level_number),p.n,
       CASE WHEN l.level_number<=3 THEN 1300 ELSE 850 END,10,0,0,
       CASE WHEN l.level_number<=3 THEN 1 ELSE 0 END,0,0,1
FROM racks r
JOIN warehouse_levels l ON l.rack_id=r.rack_id
JOIN (
 SELECT ones.n + tens.n*10 AS n
 FROM (SELECT 1 n UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10) ones
 CROSS JOIN (SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5) tens
) p ON p.n BETWEEN 1 AND 60;

CREATE TABLE IF NOT EXISTS ai_recommendations (
 recommendation_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 inventory_id BIGINT UNSIGNED NOT NULL,
 requested_bags INT UNSIGNED NOT NULL,
 bag_weight DECIMAL(10,2) NULL,
 recommended_location_id INT UNSIGNED NULL,
 score DECIMAL(5,2) NULL,
 alternatives_json JSON NULL,
 explanation TEXT NULL,
 rule_version VARCHAR(30) NOT NULL DEFAULT 'RULE-2026.1',
 model_version VARCHAR(30) NOT NULL DEFAULT 'WEIGHTED-2026.1',
 decision ENUM('PENDING','ACCEPTED','REJECTED','OVERRIDDEN') DEFAULT 'PENDING',
 final_location_id INT UNSIGNED NULL,
 override_reason VARCHAR(255) NULL,
 created_by INT UNSIGNED NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(inventory_id) REFERENCES tea_inventory(inventory_id),
 FOREIGN KEY(recommended_location_id) REFERENCES warehouse_locations(location_id),
 FOREIGN KEY(final_location_id) REFERENCES warehouse_locations(location_id),
 FOREIGN KEY(created_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS location_blocks (
 block_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, location_id INT UNSIGNED NOT NULL,
 reason VARCHAR(255) NOT NULL, blocked_by INT UNSIGNED NULL, blocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 unblocked_by INT UNSIGNED NULL, unblocked_at TIMESTAMP NULL,
 FOREIGN KEY(location_id) REFERENCES warehouse_locations(location_id), FOREIGN KEY(blocked_by) REFERENCES users(user_id) ON DELETE SET NULL,
 FOREIGN KEY(unblocked_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS audit_logs (
 audit_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, user_id INT UNSIGNED NULL, action VARCHAR(80) NOT NULL,
 entity VARCHAR(80) NOT NULL, record_id VARCHAR(80) NULL, old_value JSON NULL, new_value JSON NULL,
 ip_address VARCHAR(45) NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE SET NULL, INDEX(created_at), INDEX(entity,record_id)
) ENGINE=InnoDB;

-- Verification: must return 7200.
SELECT COUNT(*) AS generated_locations FROM warehouse_locations;


-- ============================================================
-- USER-BY-USER FUNCTION ACCESS CONTROL
-- ============================================================

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
('warehousing.grn_print','WAREHOUSING','GRN','Unloading / GRN Print','/warehousing/bin-operation/grn/print',250),
('warehousing.grn_add_edit','WAREHOUSING','GRN','Invoice Chest Receiving / GRN','/warehousing/bin-operation/grn/add-edit',260),
('warehousing.chest_location','WAREHOUSING','GRN','Chest Location Details','/warehousing/bin-operation/grn/chest-location',270),
('warehousing.turn_number','WAREHOUSING','GRN','Turn Number Allocation','/warehousing/bin-operation/grn/turn-number',280),
('warehousing.gin_add','WAREHOUSING','GIN','Invoice Chest Issuing / GIN','/warehousing/bin-operation/gin/add',290),
('warehousing.gin_picking','WAREHOUSING','GIN','Loading / Picking / GIN Print','/warehousing/bin-operation/gin/picking-list',300),
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

-- ============================================================
-- INVOICE / AI AUTO-ALLOCATION / REPORTING UPGRADE
-- ============================================================
-- BrewSmart invoice visibility + automatic AI allocation upgrade.
ALTER TABLE warehouse_invoices
  ADD COLUMN IF NOT EXISTS total_net_weight DECIMAL(12,2) NULL AFTER net_weight_each,
  ADD COLUMN IF NOT EXISTS allocation_score DECIMAL(5,2) NULL AFTER location_code,
  ADD COLUMN IF NOT EXISTS allocation_model VARCHAR(50) NULL AFTER allocation_score,
  ADD COLUMN IF NOT EXISTS allocation_explanation TEXT NULL AFTER allocation_model,
  ADD COLUMN IF NOT EXISTS allocation_type VARCHAR(20) NULL AFTER allocation_explanation;

-- Backfill total net weight for invoices saved before this migration.
UPDATE warehouse_invoices
SET total_net_weight = ROUND(COALESCE(chests,0) * COALESCE(net_weight_each,0),2)
WHERE total_net_weight IS NULL;

CREATE TABLE IF NOT EXISTS invoice_location_allocations (
  allocation_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  invoice_id BIGINT UNSIGNED NOT NULL,
  location_id INT UNSIGNED NOT NULL,
  chests_allocated INT UNSIGNED NOT NULL,
  weight_allocated DECIMAL(12,2) NOT NULL DEFAULT 0,
  allocation_type ENUM('AI','MANUAL') NOT NULL DEFAULT 'AI',
  score DECIMAL(5,2) NULL,
  allocated_by INT UNSIGNED NULL,
  allocated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_invoice_location_invoice FOREIGN KEY (invoice_id) REFERENCES warehouse_invoices(invoice_id) ON DELETE CASCADE,
  CONSTRAINT fk_invoice_location_location FOREIGN KEY (location_id) REFERENCES warehouse_locations(location_id),
  CONSTRAINT fk_invoice_location_user FOREIGN KEY (allocated_by) REFERENCES users(user_id) ON DELETE SET NULL,
  INDEX idx_invoice_location_invoice (invoice_id),
  INDEX idx_invoice_location_location (location_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS invoice_ai_recommendations (
  recommendation_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  invoice_id BIGINT UNSIGNED NOT NULL,
  requested_chests INT UNSIGNED NOT NULL,
  bag_weight DECIMAL(10,2) NOT NULL,
  total_net_weight DECIMAL(12,2) NOT NULL,
  recommended_location_id INT UNSIGNED NULL,
  score DECIMAL(5,2) NULL,
  allocation_plan_json JSON NULL,
  alternatives_json JSON NULL,
  explanation TEXT NULL,
  rule_version VARCHAR(30) NOT NULL DEFAULT 'RULE-2026.2',
  model_version VARCHAR(50) NOT NULL DEFAULT 'INVOICE-WEIGHTED-2026.2',
  decision ENUM('PENDING','ACCEPTED','REJECTED','OVERRIDDEN') DEFAULT 'PENDING',
  final_location_id INT UNSIGNED NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_invoice_ai_invoice FOREIGN KEY (invoice_id) REFERENCES warehouse_invoices(invoice_id) ON DELETE CASCADE,
  CONSTRAINT fk_invoice_ai_recommended_location FOREIGN KEY (recommended_location_id) REFERENCES warehouse_locations(location_id) ON DELETE SET NULL,
  CONSTRAINT fk_invoice_ai_final_location FOREIGN KEY (final_location_id) REFERENCES warehouse_locations(location_id) ON DELETE SET NULL,
  CONSTRAINT fk_invoice_ai_user FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,
  INDEX idx_invoice_ai_invoice (invoice_id),
  INDEX idx_invoice_ai_created (created_at)
) ENGINE=InnoDB;

-- Make previously saved single-location invoices visible to the new allocation table
-- without changing warehouse capacity. Capacity is only changed by new/edited allocations.
INSERT INTO invoice_location_allocations(invoice_id,location_id,chests_allocated,weight_allocated,allocation_type,score,allocated_by)
SELECT wi.invoice_id,wi.location_id,wi.chests,COALESCE(wi.total_net_weight,0),'MANUAL',wi.allocation_score,wi.created_by
FROM warehouse_invoices wi
WHERE wi.location_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM invoice_location_allocations ila WHERE ila.invoice_id=wi.invoice_id);



-- RECEIVING / ISSUING WORKFLOW 2026.3

-- BrewSmart Receiving / Unloading / Issuing / Loading workflow upgrade.
-- Run after database.sql and migrations_2026_full_upgrade.sql on an existing installation.

ALTER TABLE warehouse_invoices
  ADD COLUMN IF NOT EXISTS buyer VARCHAR(150) NULL AFTER broker;

ALTER TABLE grns
  ADD COLUMN IF NOT EXISTS store VARCHAR(180) NULL AFTER grn_date,
  ADD COLUMN IF NOT EXISTS turn_no VARCHAR(80) NULL AFTER store,
  ADD COLUMN IF NOT EXISTS driver_name VARCHAR(120) NULL AFTER vehicle_no,
  ADD COLUMN IF NOT EXISTS driver_nic VARCHAR(60) NULL AFTER driver_name,
  ADD COLUMN IF NOT EXISTS source_type ENUM('BROKER','BUYER') NOT NULL DEFAULT 'BROKER' AFTER supplier,
  ADD COLUMN IF NOT EXISTS broker VARCHAR(150) NULL AFTER source_type,
  ADD COLUMN IF NOT EXISTS buyer VARCHAR(150) NULL AFTER broker,
  ADD COLUMN IF NOT EXISTS mark VARCHAR(100) NULL AFTER buyer,
  ADD COLUMN IF NOT EXISTS amalgamation TINYINT(1) NOT NULL DEFAULT 0 AFTER mark,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;

CREATE TABLE IF NOT EXISTS grn_items (
  grn_item_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  grn_id BIGINT UNSIGNED NOT NULL,
  invoice_id BIGINT UNSIGNED NOT NULL,
  received_chests INT UNSIGNED NOT NULL,
  short_weight DECIMAL(12,2) NOT NULL DEFAULT 0,
  remarks VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_grn_invoice (invoice_id),
  INDEX idx_grn_items_grn (grn_id),
  CONSTRAINT fk_grn_items_grn FOREIGN KEY (grn_id) REFERENCES grns(grn_id) ON DELETE CASCADE,
  CONSTRAINT fk_grn_items_invoice FOREIGN KEY (invoice_id) REFERENCES warehouse_invoices(invoice_id)
) ENGINE=InnoDB;

ALTER TABLE gins
  ADD COLUMN IF NOT EXISTS store VARCHAR(180) NULL AFTER gin_date,
  ADD COLUMN IF NOT EXISTS turn_no VARCHAR(80) NULL AFTER store,
  ADD COLUMN IF NOT EXISTS collection_person VARCHAR(120) NULL AFTER buyer,
  ADD COLUMN IF NOT EXISTS collection_nic VARCHAR(60) NULL AFTER collection_person,
  ADD COLUMN IF NOT EXISTS vehicle_no VARCHAR(60) NULL AFTER collection_nic,
  ADD COLUMN IF NOT EXISTS sale_type VARCHAR(80) NULL AFTER vehicle_no,
  ADD COLUMN IF NOT EXISTS other_broker TINYINT(1) NOT NULL DEFAULT 0 AFTER sale_type,
  ADD COLUMN IF NOT EXISTS remarks TEXT NULL AFTER other_broker,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;

CREATE TABLE IF NOT EXISTS gin_items (
  gin_item_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  gin_id BIGINT UNSIGNED NOT NULL,
  invoice_id BIGINT UNSIGNED NOT NULL,
  location_id INT UNSIGNED NOT NULL,
  chests_issued INT UNSIGNED NOT NULL,
  net_weight_each DECIMAL(10,2) NOT NULL DEFAULT 0,
  weight_issued DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_gin_items_gin (gin_id),
  INDEX idx_gin_items_invoice (invoice_id),
  INDEX idx_gin_items_location (location_id),
  CONSTRAINT fk_gin_items_gin FOREIGN KEY (gin_id) REFERENCES gins(gin_id) ON DELETE CASCADE,
  CONSTRAINT fk_gin_items_invoice FOREIGN KEY (invoice_id) REFERENCES warehouse_invoices(invoice_id),
  CONSTRAINT fk_gin_items_location FOREIGN KEY (location_id) REFERENCES warehouse_locations(location_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS invoice_stock_movements (
  movement_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  invoice_id BIGINT UNSIGNED NOT NULL,
  location_id INT UNSIGNED NULL,
  movement_type ENUM('IN','OUT','TRANSFER','ADJUSTMENT') NOT NULL,
  quantity_bags INT UNSIGNED NOT NULL,
  weight DECIMAL(12,2) NOT NULL DEFAULT 0,
  reference_type VARCHAR(30) NULL,
  reference_no VARCHAR(80) NULL,
  notes VARCHAR(255) NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_invoice_movement_invoice (invoice_id),
  INDEX idx_invoice_movement_location (location_id),
  INDEX idx_invoice_movement_date (created_at),
  CONSTRAINT fk_invoice_movement_invoice FOREIGN KEY (invoice_id) REFERENCES warehouse_invoices(invoice_id) ON DELETE CASCADE,
  CONSTRAINT fk_invoice_movement_location FOREIGN KEY (location_id) REFERENCES warehouse_locations(location_id) ON DELETE SET NULL,
  CONSTRAINT fk_invoice_movement_user FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;



-- BROKER MASTER + LOCATION INQUIRY 2026.4

-- BrewSmart Broker Master + Location Inquiry + default warehouse update
CREATE TABLE IF NOT EXISTS brokers (
  broker_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  broker_code VARCHAR(30) NOT NULL UNIQUE,
  broker_name VARCHAR(150) NOT NULL,
  contact_person VARCHAR(120) NULL,
  phone VARCHAR(30) NULL,
  email VARCHAR(150) NULL,
  status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT INTO brokers(broker_code,broker_name) VALUES
('JK','John Keells')
ON DUPLICATE KEY UPDATE broker_name=VALUES(broker_name),status='ACTIVE';

INSERT INTO permission_catalog(permission_key,module_name,group_name,permission_label,route_path,sort_order,active) VALUES
('master.broker','BROKERING MASTER','Master Data','Broker Master','/master/broker',115,1),
('warehousing.location_inquiry','WAREHOUSING','Information','Location Inquiry','/warehousing/inquiry/location',325,1)
ON DUPLICATE KEY UPDATE
 module_name=VALUES(module_name),group_name=VALUES(group_name),permission_label=VALUES(permission_label),
 route_path=VALUES(route_path),sort_order=VALUES(sort_order),active=1;

INSERT INTO role_permissions(role,page_key,has_access) VALUES
('ADMIN','master.broker',1),('ADMIN','warehousing.location_inquiry',1),
('MANAGER','master.broker',1),('MANAGER','warehousing.location_inquiry',1),
('WAREHOUSE_STAFF','warehousing.location_inquiry',1),
('BROKER','master.broker',0),('BROKER','warehousing.location_inquiry',0)
ON DUPLICATE KEY UPDATE has_access=VALUES(has_access);

-- Standardize the default warehouse/store name.
UPDATE warehouses SET warehouse_name='BrewSmart Warehouse' WHERE warehouse_id=1;
UPDATE warehouse_invoices SET store='BrewSmart Warehouse' WHERE store IS NULL OR TRIM(store)='' OR store='BrewSmart Main Warehouse';
UPDATE grns SET store='BrewSmart Warehouse' WHERE store IS NULL OR TRIM(store)='' OR store='BrewSmart Main Warehouse';
UPDATE gins SET store='BrewSmart Warehouse' WHERE store IS NULL OR TRIM(store)='' OR store='BrewSmart Main Warehouse';
