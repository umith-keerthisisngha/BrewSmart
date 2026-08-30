-- =====================================================================
-- BrewSmart - FULL DATABASE (Fresh Install + Lecturer Demo Data)
-- Version: 2026.4
-- Database: brewsMart_db
--
-- USE:
--   phpMyAdmin -> Import -> select this file -> Go
--
-- IMPORTANT:
--   This is a FRESH-INSTALL file. It drops/recreates BrewSmart tables.
--   Do NOT import it over a database containing data you need to keep.
--
-- Default administrator:
--   Username : admin
--   Password : admin123
--
-- Warehouse structure:
--   20 racks x 6 levels (A-F) x 60 positions = 7,200 locations
--   Maximum 10 bags per physical location
--   50-65 kg safety rule: lower levels A/B/C only
-- =====================================================================

CREATE DATABASE IF NOT EXISTS brewsMart_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE brewsMart_db;
SET FOREIGN_KEY_CHECKS=0;
DROP TABLE IF EXISTS user_permissions,permission_catalog,audit_logs,location_blocks,ai_recommendations,invoice_ai_recommendations,invoice_location_allocations,invoice_stock_movements,gin_items,grn_items,activity_logs,role_permissions,system_settings,dispatches,gins,grns,warehouse_invoices,arrival_turns,stock_movements,inventory_locations,tea_inventory,location_rules,warehouse_locations,warehouse_levels,racks,warehouses,suppliers,tea_auctions,buyers,brokers,tea_grades,tea_types,marks,packing_types,users;
SET FOREIGN_KEY_CHECKS=1;

CREATE TABLE users (
 user_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 username VARCHAR(50) NOT NULL UNIQUE,
 full_name VARCHAR(120) NOT NULL,
 email VARCHAR(150) NOT NULL UNIQUE,
 password_hash VARCHAR(255) NOT NULL,
 role ENUM('ADMIN','MANAGER','WAREHOUSE_STAFF','BROKER') NOT NULL DEFAULT 'WAREHOUSE_STAFF',
 status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
CREATE TABLE arrival_turns (
 turn_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 turn_no VARCHAR(80) NOT NULL UNIQUE,
 turn_date DATE NOT NULL,
 store VARCHAR(180) NOT NULL DEFAULT 'BrewSmart Warehouse',
 vehicle_no VARCHAR(60) NULL,
 driver_name VARCHAR(120) NULL,
 driver_nic VARCHAR(60) NULL,
 created_by INT UNSIGNED NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY(created_by) REFERENCES users(user_id) ON DELETE SET NULL,
 INDEX idx_arrival_turn_date(turn_date)
) ENGINE=InnoDB;
CREATE TABLE racks (rack_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,rack_code VARCHAR(20) NOT NULL UNIQUE,rack_name VARCHAR(80) NOT NULL,status ENUM('ACTIVE','INACTIVE','MAINTENANCE') DEFAULT 'ACTIVE') ENGINE=InnoDB;
CREATE TABLE warehouse_levels (level_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,rack_id INT UNSIGNED NOT NULL,level_number TINYINT UNSIGNED NOT NULL,UNIQUE KEY uq_rack_level(rack_id,level_number),FOREIGN KEY(rack_id) REFERENCES racks(rack_id) ON DELETE CASCADE) ENGINE=InnoDB;
CREATE TABLE warehouse_locations (location_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,location_code VARCHAR(30) NOT NULL UNIQUE,rack_id INT UNSIGNED NOT NULL,level_id INT UNSIGNED NOT NULL,location_number INT UNSIGNED NOT NULL,capacity_bags INT UNSIGNED NOT NULL DEFAULT 10,occupied_bags INT UNSIGNED NOT NULL DEFAULT 0,status ENUM('EMPTY','PARTIAL','FULL','BLOCKED') DEFAULT 'EMPTY',FOREIGN KEY(rack_id) REFERENCES racks(rack_id),FOREIGN KEY(level_id) REFERENCES warehouse_levels(level_id),INDEX(status)) ENGINE=InnoDB;
CREATE TABLE brokers (broker_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,broker_code VARCHAR(30) NOT NULL UNIQUE,broker_name VARCHAR(150) NOT NULL,contact_person VARCHAR(120),phone VARCHAR(30),email VARCHAR(150),status ENUM('ACTIVE','INACTIVE') DEFAULT 'ACTIVE',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB;
CREATE TABLE buyers (buyer_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,buyer_code VARCHAR(40) NOT NULL UNIQUE,buyer_name VARCHAR(160) NOT NULL,contact_person VARCHAR(120),phone VARCHAR(40),email VARCHAR(160),status ENUM('ACTIVE','INACTIVE') DEFAULT 'ACTIVE',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB;
CREATE TABLE tea_auctions (auction_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,auction_date DATE NOT NULL,sale_no VARCHAR(60),notes VARCHAR(255),status ENUM('SCHEDULED','COMPLETED','CANCELLED') NOT NULL DEFAULT 'SCHEDULED',created_by INT UNSIGNED NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,INDEX idx_auction_date_status(auction_date,status),FOREIGN KEY(created_by) REFERENCES users(user_id) ON DELETE SET NULL) ENGINE=InnoDB;
CREATE TABLE suppliers (supplier_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,supplier_code VARCHAR(30) NOT NULL UNIQUE,supplier_name VARCHAR(150) NOT NULL,contact_person VARCHAR(120),phone VARCHAR(30),email VARCHAR(150),status ENUM('ACTIVE','INACTIVE') DEFAULT 'ACTIVE') ENGINE=InnoDB;
CREATE TABLE tea_types (tea_type_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,tea_code VARCHAR(30) NOT NULL UNIQUE,tea_name VARCHAR(100) NOT NULL,description TEXT) ENGINE=InnoDB;
CREATE TABLE tea_grades (grade_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,grade_code VARCHAR(30) NOT NULL UNIQUE,grade_name VARCHAR(100) NOT NULL,description TEXT,packing_density DECIMAL(10,3) NULL,min_bag_weight DECIMAL(10,2) NULL,max_bag_weight DECIMAL(10,2) NULL,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB;
CREATE TABLE marks (mark_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,mark_code VARCHAR(50) NOT NULL UNIQUE,mark_name VARCHAR(150) NOT NULL,status ENUM('ACTIVE','INACTIVE') DEFAULT 'ACTIVE',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB;
CREATE TABLE packing_types (packing_type_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,packing_code VARCHAR(50) NOT NULL UNIQUE,packing_name VARCHAR(150) NOT NULL,status ENUM('ACTIVE','INACTIVE') DEFAULT 'ACTIVE',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB;
CREATE TABLE tea_inventory (inventory_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,lot_number VARCHAR(50) NOT NULL UNIQUE,supplier_id INT UNSIGNED NULL,tea_type_id INT UNSIGNED NOT NULL,grade_id INT UNSIGNED NULL,received_date DATE NOT NULL,total_bags INT UNSIGNED NOT NULL DEFAULT 0,available_bags INT UNSIGNED NOT NULL DEFAULT 0,allocated_bags INT UNSIGNED NOT NULL DEFAULT 0,status ENUM('RECEIVED','STORED','PARTIALLY_ALLOCATED','SOLD','COMPLETED') DEFAULT 'RECEIVED',notes TEXT,created_by INT UNSIGNED NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(supplier_id) REFERENCES suppliers(supplier_id) ON DELETE SET NULL,FOREIGN KEY(tea_type_id) REFERENCES tea_types(tea_type_id),FOREIGN KEY(grade_id) REFERENCES tea_grades(grade_id) ON DELETE SET NULL,FOREIGN KEY(created_by) REFERENCES users(user_id) ON DELETE SET NULL,INDEX(status),INDEX(received_date)) ENGINE=InnoDB;
CREATE TABLE inventory_locations (allocation_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,inventory_id BIGINT UNSIGNED NOT NULL,location_id INT UNSIGNED NOT NULL,bags_allocated INT UNSIGNED NOT NULL,allocation_type ENUM('MANUAL','AI') DEFAULT 'MANUAL',allocated_by INT UNSIGNED NULL,allocated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(inventory_id) REFERENCES tea_inventory(inventory_id) ON DELETE CASCADE,FOREIGN KEY(location_id) REFERENCES warehouse_locations(location_id),FOREIGN KEY(allocated_by) REFERENCES users(user_id) ON DELETE SET NULL,INDEX(inventory_id),INDEX(location_id)) ENGINE=InnoDB;
CREATE TABLE stock_movements (movement_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,inventory_id BIGINT UNSIGNED NOT NULL,location_id INT UNSIGNED NULL,movement_type ENUM('IN','OUT','TRANSFER','ADJUSTMENT') NOT NULL,quantity_bags INT UNSIGNED NOT NULL,reference_no VARCHAR(80),notes TEXT,created_by INT UNSIGNED NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(inventory_id) REFERENCES tea_inventory(inventory_id) ON DELETE CASCADE,FOREIGN KEY(location_id) REFERENCES warehouse_locations(location_id) ON DELETE SET NULL,FOREIGN KEY(created_by) REFERENCES users(user_id) ON DELETE SET NULL,INDEX(created_at)) ENGINE=InnoDB;
CREATE TABLE dispatches (dispatch_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,invoice_no VARCHAR(80) NOT NULL,buyer VARCHAR(150),delivery_order_no VARCHAR(80),bags INT UNSIGNED NOT NULL,vehicle_no VARCHAR(40),dispatch_date DATE NOT NULL,status ENUM('PENDING','DISPATCHED','CANCELLED') DEFAULT 'PENDING',created_by INT UNSIGNED NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(created_by) REFERENCES users(user_id) ON DELETE SET NULL) ENGINE=InnoDB;
CREATE TABLE grns (grn_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,grn_no VARCHAR(80) NOT NULL UNIQUE,grn_date DATE NOT NULL,store VARCHAR(180),turn_no VARCHAR(80),vehicle_no VARCHAR(40),driver_name VARCHAR(120),driver_nic VARCHAR(60),supplier VARCHAR(150),source_type ENUM('BROKER','BUYER') NOT NULL DEFAULT 'BROKER',broker VARCHAR(150),buyer VARCHAR(150),mark VARCHAR(100),amalgamation TINYINT(1) NOT NULL DEFAULT 0,chests INT UNSIGNED DEFAULT 0,remarks TEXT,created_by INT UNSIGNED NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,FOREIGN KEY(created_by) REFERENCES users(user_id) ON DELETE SET NULL,INDEX(grn_date),INDEX(turn_no)) ENGINE=InnoDB;
CREATE TABLE gins (gin_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,gin_no VARCHAR(80) NOT NULL UNIQUE,gin_date DATE NOT NULL,store VARCHAR(180),turn_no VARCHAR(80),buyer VARCHAR(150),collection_person VARCHAR(120),collection_nic VARCHAR(60),vehicle_no VARCHAR(60),sale_type VARCHAR(80),other_broker TINYINT(1) NOT NULL DEFAULT 0,remarks TEXT,invoice_no VARCHAR(80),chests INT UNSIGNED DEFAULT 0,dispatch_status ENUM('PENDING','DISPATCHED','CANCELLED') NOT NULL DEFAULT 'PENDING',gate_pass_no VARCHAR(80),gate_passed_at DATETIME NULL,gate_passed_by INT UNSIGNED NULL,created_by INT UNSIGNED NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,FOREIGN KEY(created_by) REFERENCES users(user_id) ON DELETE SET NULL,FOREIGN KEY(gate_passed_by) REFERENCES users(user_id) ON DELETE SET NULL,INDEX(gin_date),INDEX(turn_no),INDEX(dispatch_status),INDEX(gate_pass_no)) ENGINE=InnoDB;
CREATE TABLE warehouse_invoices (invoice_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,invoice_year SMALLINT NOT NULL,invoice_no VARCHAR(80) NOT NULL,mark VARCHAR(100),selling_mark VARCHAR(100),grade VARCHAR(50),packing_type VARCHAR(100),chest_type VARCHAR(20),broker VARCHAR(150),buyer VARCHAR(150),chests INT UNSIGNED DEFAULT 0,weight_per_chest DECIMAL(10,2) DEFAULT 0,net_weight_each DECIMAL(10,2) DEFAULT NULL,total_net_weight DECIMAL(12,2) DEFAULT NULL,total_gross_weight DECIMAL(12,2) DEFAULT NULL,moisture_content DECIMAL(5,2) DEFAULT NULL,mfd_date DATE DEFAULT NULL,sample_drawn TINYINT(1) DEFAULT 0,reprint TINYINT(1) DEFAULT 0,exportable TINYINT(1) DEFAULT 0,colour_separated TINYINT(1) DEFAULT 0,store VARCHAR(100),invoice_date DATE NOT NULL,arrival_turn_no VARCHAR(80) NULL,arrival_vehicle_no VARCHAR(60) NULL,arrival_driver_name VARCHAR(120) NULL,arrival_driver_nic VARCHAR(60) NULL,location_id INT UNSIGNED NULL,location_code VARCHAR(30) NULL,allocation_score DECIMAL(5,2) NULL,allocation_model VARCHAR(50) NULL,allocation_explanation TEXT NULL,allocation_type VARCHAR(20) NULL,created_by INT UNSIGNED NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(created_by) REFERENCES users(user_id) ON DELETE SET NULL,FOREIGN KEY(location_id) REFERENCES warehouse_locations(location_id) ON DELETE SET NULL,UNIQUE KEY uq_invoice_mark_no(mark,invoice_no),INDEX(arrival_turn_no),INDEX idx_invoice_turn_broker(arrival_turn_no,broker)) ENGINE=InnoDB;

CREATE TABLE grn_items (grn_item_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,grn_id BIGINT UNSIGNED NOT NULL,invoice_id BIGINT UNSIGNED NOT NULL,received_chests INT UNSIGNED NOT NULL,short_weight DECIMAL(12,2) NOT NULL DEFAULT 0,remarks VARCHAR(255),created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,UNIQUE KEY uq_grn_invoice(invoice_id),FOREIGN KEY(grn_id) REFERENCES grns(grn_id) ON DELETE CASCADE,FOREIGN KEY(invoice_id) REFERENCES warehouse_invoices(invoice_id),INDEX(grn_id)) ENGINE=InnoDB;
CREATE TABLE gin_items (gin_item_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,gin_id BIGINT UNSIGNED NOT NULL,invoice_id BIGINT UNSIGNED NOT NULL,location_id INT UNSIGNED NOT NULL,chests_issued INT UNSIGNED NOT NULL,net_weight_each DECIMAL(10,2) NOT NULL DEFAULT 0,weight_issued DECIMAL(12,2) NOT NULL DEFAULT 0,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(gin_id) REFERENCES gins(gin_id) ON DELETE CASCADE,FOREIGN KEY(invoice_id) REFERENCES warehouse_invoices(invoice_id),FOREIGN KEY(location_id) REFERENCES warehouse_locations(location_id),INDEX(gin_id),INDEX(invoice_id),INDEX(location_id)) ENGINE=InnoDB;
CREATE TABLE invoice_stock_movements (movement_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,invoice_id BIGINT UNSIGNED NOT NULL,location_id INT UNSIGNED NULL,movement_type ENUM('IN','OUT','TRANSFER','ADJUSTMENT') NOT NULL,quantity_bags INT UNSIGNED NOT NULL,weight DECIMAL(12,2) NOT NULL DEFAULT 0,reference_type VARCHAR(30),reference_no VARCHAR(80),notes VARCHAR(255),created_by INT UNSIGNED NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(invoice_id) REFERENCES warehouse_invoices(invoice_id) ON DELETE CASCADE,FOREIGN KEY(location_id) REFERENCES warehouse_locations(location_id) ON DELETE SET NULL,FOREIGN KEY(created_by) REFERENCES users(user_id) ON DELETE SET NULL,INDEX(invoice_id),INDEX(location_id),INDEX(created_at)) ENGINE=InnoDB;
CREATE TABLE role_permissions (permission_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,role ENUM('ADMIN','MANAGER','WAREHOUSE_STAFF','BROKER') NOT NULL,page_key VARCHAR(80) NOT NULL,has_access TINYINT(1) NOT NULL DEFAULT 0,UNIQUE KEY uq_role_page(role,page_key)) ENGINE=InnoDB;
CREATE TABLE activity_logs (log_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,user_id INT UNSIGNED NULL,action VARCHAR(100) NOT NULL,module VARCHAR(80) NOT NULL,description TEXT,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE SET NULL,INDEX(created_at)) ENGINE=InnoDB;
CREATE TABLE system_settings (setting_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,setting_key VARCHAR(100) NOT NULL UNIQUE,setting_value VARCHAR(255),description VARCHAR(255)) ENGINE=InnoDB;

INSERT INTO users(username,full_name,email,password_hash,role,status) VALUES
('admin','System Administrator','admin@brewsmart.local','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa1n2Y1Yv7dG7i1e7W4k6jJ7h2a','ADMIN','ACTIVE');
-- The password above is the standard bcrypt hash for: password
-- Setup script below also creates a known admin password using PHP-friendly bcrypt if you prefer: admin123.
UPDATE users SET password_hash='$2y$12$CvrIo0w3BWSHNJ/MidA5ves3ZHg8AVVCW5hs26Av0GFQTqeV8gTFe' WHERE username='admin';

INSERT INTO tea_types(tea_code,tea_name,description) VALUES
('BOP','Broken Orange Pekoe','CTC/leaf tea grade'),('BOPF','Broken Orange Pekoe Fannings','Fine broken tea'),('OP','Orange Pekoe','Whole leaf tea'),('FBOP','Flowery Broken Orange Pekoe','Flowery broken tea'),('PF1','Pekoe Fannings 1','Fannings grade'),('BP1','Broken Pekoe 1','Broken leaf grade');
INSERT INTO tea_grades(grade_code,grade_name,packing_density,min_bag_weight,max_bag_weight) VALUES ('A','Grade A',NULL,NULL,NULL),('B','Grade B',NULL,NULL,NULL),('C','Grade C',NULL,NULL,NULL),('PF1','PF1',NULL,NULL,NULL),('BP1','BP1',NULL,NULL,NULL);
INSERT INTO brokers(broker_code,broker_name) VALUES ('JK','John Keells'),('BRK-002','Demo Tea Broker');
INSERT INTO buyers(buyer_code,buyer_name) VALUES ('BUY-001','Demo Tea Buyer');
INSERT INTO marks(mark_code,mark_name) VALUES ('KEELLS','John Keells'),('FOREST','Forest Mark'),('HAYLEYS','Hayleys Mark');
INSERT INTO packing_types(packing_code,packing_name) VALUES ('MWPS','MWPS - MW-P/S'),('PC','PC - Paper Cartons'),('PP','PP - Poly Pockets');
INSERT INTO suppliers(supplier_code,supplier_name) VALUES ('SUP-001','Demo Tea Factory'),('SUP-002','Sample Estate');
INSERT INTO system_settings(setting_key,setting_value,description) VALUES ('bags_per_plate','10','Maximum bags per plate'),('warehouse_racks','20','Number of racks'),('levels_per_rack','6','Levels per rack'),('low_stock_threshold','10','Low stock threshold');

INSERT INTO racks(rack_code,rack_name) VALUES
('RACK-01','Rack 01'),('RACK-02','Rack 02'),('RACK-03','Rack 03'),('RACK-04','Rack 04'),('RACK-05','Rack 05'),('RACK-06','Rack 06'),('RACK-07','Rack 07'),('RACK-08','Rack 08'),('RACK-09','Rack 09'),('RACK-10','Rack 10'),('RACK-11','Rack 11'),('RACK-12','Rack 12'),('RACK-13','Rack 13'),('RACK-14','Rack 14'),('RACK-15','Rack 15'),('RACK-16','Rack 16'),('RACK-17','Rack 17'),('RACK-18','Rack 18'),('RACK-19','Rack 19'),('RACK-20','Rack 20');
INSERT INTO warehouse_levels(rack_id,level_number) SELECT rack_id,n FROM racks CROSS JOIN (SELECT 1 n UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6) x;
INSERT INTO warehouse_locations(location_code,rack_id,level_id,location_number,capacity_bags)
SELECT CONCAT(r.rack_code,'-L',l.level_number),r.rack_id,l.level_id,l.level_number,10 FROM racks r JOIN warehouse_levels l ON l.rack_id=r.rack_id;

INSERT INTO role_permissions(role,page_key,has_access) VALUES
('MANAGER','warehousing',1),('MANAGER','brokering',1),('MANAGER','master',1),('MANAGER','reports',1),
('WAREHOUSE_STAFF','warehousing',1),('WAREHOUSE_STAFF','brokering',0),('WAREHOUSE_STAFF','master',0),('WAREHOUSE_STAFF','reports',1),
('BROKER','warehousing',0),('BROKER','brokering',1),('BROKER','master',0),('BROKER','reports',1);

INSERT INTO tea_inventory(lot_number,supplier_id,tea_type_id,grade_id,received_date,total_bags,available_bags,notes,created_by)
SELECT 'DEMO-INV-001',1,t.tea_type_id,g.grade_id,CURDATE(),20,20,'Demo inventory',1 FROM tea_types t JOIN tea_grades g ON g.grade_code='BOP' WHERE t.tea_code='BOP' LIMIT 1;

CREATE OR REPLACE VIEW vw_dashboard AS
SELECT (SELECT COALESCE(SUM(available_bags),0) FROM tea_inventory WHERE status<>'COMPLETED') available_bags,
(SELECT COUNT(*) FROM tea_inventory WHERE status<>'COMPLETED') tea_lots,
(SELECT COALESCE(SUM(capacity_bags),0) FROM warehouse_locations WHERE status<>'BLOCKED') total_capacity,
(SELECT COALESCE(SUM(occupied_bags),0) FROM warehouse_locations WHERE status<>'BLOCKED') occupied_bags,
(SELECT COUNT(*) FROM warehouse_locations WHERE status='EMPTY') available_locations,
(SELECT COUNT(*) FROM warehouse_locations WHERE status='BLOCKED') blocked_locations;
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

CREATE TABLE IF NOT EXISTS buyers (buyer_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,buyer_code VARCHAR(40) NOT NULL UNIQUE,buyer_name VARCHAR(160) NOT NULL,contact_person VARCHAR(120),phone VARCHAR(40),email VARCHAR(160),status ENUM('ACTIVE','INACTIVE') DEFAULT 'ACTIVE',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS tea_auctions (auction_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,auction_date DATE NOT NULL,sale_no VARCHAR(60),notes VARCHAR(255),status ENUM('SCHEDULED','COMPLETED','CANCELLED') NOT NULL DEFAULT 'SCHEDULED',created_by INT UNSIGNED NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,INDEX idx_auction_date_status(auction_date,status),FOREIGN KEY(created_by) REFERENCES users(user_id) ON DELETE SET NULL) ENGINE=InnoDB;

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
('master.broker','BROKERING MASTER','Master Data','Broker Master','/master/broker',115),
('master.buyer','BROKERING MASTER','Master Data','Buyer Master','/master/buyer',117),
('master.auction_calendar','BROKERING MASTER','Master Data','Tea Auction Calendar','/master/auction-calendar',118),
('master.mark','BROKERING MASTER','Master Data','Mark Master','/master/mark',120),
('master.grade','BROKERING MASTER','Master Data','Grade Master','/master/grade',130),
('master.packing_type','BROKERING MASTER','Master Data','Packing Type Master','/master/packing-type',140),
('master.user_account','BROKERING MASTER','Administration','User Account','/master/user-account',150),

('warehousing.dashboard','WAREHOUSING','Information','Warehouse Dashboard','/warehousing/dashboard',205),
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

UPDATE permission_catalog SET active=0 WHERE permission_key IN ('warehousing.master','warehousing.ai_allocation','warehousing.invoice_download','warehousing.chest_location','warehousing.turn_number');
UPDATE permission_catalog SET active=1 WHERE permission_key='warehousing.dashboard';
USE brewsMart_db;

-- BrewSmart Tea Grade storage profile upgrade.
-- Existing grades are intentionally left unconfigured (NULL) so real warehouse
-- density and weight rules can be entered from Grade Master instead of inventing values.

SET @db := DATABASE();

SET @sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='tea_grades' AND COLUMN_NAME='packing_density'),
  'SELECT 1',
  'ALTER TABLE tea_grades ADD COLUMN packing_density DECIMAL(10,3) NULL AFTER description'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='tea_grades' AND COLUMN_NAME='min_bag_weight'),
  'SELECT 1',
  'ALTER TABLE tea_grades ADD COLUMN min_bag_weight DECIMAL(10,2) NULL AFTER packing_density'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='tea_grades' AND COLUMN_NAME='max_bag_weight'),
  'SELECT 1',
  'ALTER TABLE tea_grades ADD COLUMN max_bag_weight DECIMAL(10,2) NULL AFTER min_bag_weight'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='tea_grades' AND COLUMN_NAME='updated_at'),
  'SELECT 1',
  'ALTER TABLE tea_grades ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER max_bag_weight'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Verification
SELECT grade_id,grade_code,grade_name,packing_density,min_bag_weight,max_bag_weight
FROM tea_grades
ORDER BY grade_code;
USE brewsMart_db;

-- BrewSmart: Buyer Master, Tea Auction Calendar, Warehouse Dashboard access.
CREATE TABLE IF NOT EXISTS buyers (
  buyer_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  buyer_code VARCHAR(40) NOT NULL UNIQUE,
  buyer_name VARCHAR(160) NOT NULL,
  contact_person VARCHAR(120) NULL,
  phone VARCHAR(40) NULL,
  email VARCHAR(160) NULL,
  status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tea_auctions (
  auction_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  auction_date DATE NOT NULL,
  sale_no VARCHAR(60) NULL,
  notes VARCHAR(255) NULL,
  status ENUM('SCHEDULED','COMPLETED','CANCELLED') NOT NULL DEFAULT 'SCHEDULED',
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_auction_date_status (auction_date,status),
  CONSTRAINT fk_tea_auctions_user FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Access Manager additions.
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

INSERT INTO permission_catalog(permission_key,module_name,group_name,permission_label,route_path,sort_order,active) VALUES
('master.buyer','BROKERING MASTER','Master Data','Buyer Master','/master/buyer',117,1),
('master.auction_calendar','BROKERING MASTER','Master Data','Tea Auction Calendar','/master/auction-calendar',118,1),
('warehousing.dashboard','WAREHOUSING','Information','Warehouse Dashboard','/warehousing/dashboard',205,0)
ON DUPLICATE KEY UPDATE module_name=VALUES(module_name),group_name=VALUES(group_name),permission_label=VALUES(permission_label),route_path=VALUES(route_path),sort_order=VALUES(sort_order),active=VALUES(active);

-- Old/unused warehouse menu functions are hidden from Access Manager and navigation.
UPDATE permission_catalog SET active=0 WHERE permission_key IN (
 'warehousing.master','warehousing.ai_allocation','warehousing.invoice_download','warehousing.chest_location','warehousing.turn_number'
);
UPDATE role_permissions SET has_access=0 WHERE page_key IN (
 'warehousing.master','warehousing.ai_allocation','warehousing.invoice_download','warehousing.chest_location','warehousing.turn_number'
);

INSERT INTO role_permissions(role,page_key,has_access) VALUES
('MANAGER','warehousing.dashboard',0),
('WAREHOUSE_STAFF','warehousing.dashboard',0),
('BROKER','warehousing.dashboard',0),
('MANAGER','master.buyer',1),
('MANAGER','master.auction_calendar',1),
('WAREHOUSE_STAFF','master.buyer',0),
('WAREHOUSE_STAFF','master.auction_calendar',0),
('BROKER','master.buyer',0),
('BROKER','master.auction_calendar',0),
('ADMIN','warehousing.dashboard',0),
('ADMIN','master.buyer',1),
('ADMIN','master.auction_calendar',1)
ON DUPLICATE KEY UPDATE has_access=VALUES(has_access);
USE brewsMart_db;

-- Restore Warehouse Dashboard as a permission-controlled MAIN DASHBOARD module card.
-- This does not add Dashboard to the Warehousing navigation bar.

INSERT INTO permission_catalog
(permission_key,module_name,group_name,permission_label,route_path,sort_order,active)
VALUES
('warehousing.dashboard','WAREHOUSING','Information','Warehouse Dashboard','/warehousing/dashboard',205,1)
ON DUPLICATE KEY UPDATE
  permission_label=VALUES(permission_label),
  route_path=VALUES(route_path),
  sort_order=VALUES(sort_order),
  active=1;

-- ADMIN already has full access in the application.
-- Managers can assign this permission per user from Brokering -> Master -> Access Manager.

-- Final 2026.3 integrity/index hardening
ALTER TABLE warehouse_locations
  ADD INDEX IF NOT EXISTS idx_ai_location (warehouse_id,active,blocked,reserved,status,level_code),
  ADD INDEX IF NOT EXISTS idx_location_rack_level (rack_id,level_code,position_number);

UPDATE warehouse_locations SET capacity_bags=10 WHERE capacity_bags<>10;
UPDATE warehouse_locations SET status=CASE WHEN blocked=1 THEN 'BLOCKED' WHEN occupied_bags=0 THEN 'EMPTY' WHEN occupied_bags>=10 THEN 'FULL' ELSE 'PARTIAL' END;

-- A fresh BrewSmart installation must have exactly 7,200 physical locations.
SELECT COUNT(*) AS expected_7200_locations FROM warehouse_locations;

-- =====================================================================
-- DEMONSTRATION DATA
-- The schema above is now complete. The following data gives a useful
-- lecturer/demo state instead of an all-zero dashboard.
-- =====================================================================

USE brewsMart_db;

-- Demonstration dataset for lecturer/demo use. Run AFTER database/schema.sql.
-- It intentionally exercises arrivals, AI allocations, GRN, pending dispatch,
-- completed Gate Pass stock-out, location statuses, brokers/buyers and auction data.

INSERT INTO brokers(broker_code,broker_name,status) VALUES
('JK','John Keells PLC','ACTIVE'),('ASIA','Asia Siyaka Commodities','ACTIVE'),('FORBES','Forbes & Walker Tea Brokers','ACTIVE')
ON DUPLICATE KEY UPDATE broker_name=VALUES(broker_name),status='ACTIVE';
INSERT INTO buyers(buyer_code,buyer_name,status) VALUES
('BUY-001','Ceylon Tea Exporters','ACTIVE'),('BUY-002','Global Tea Trading','ACTIVE'),('BUY-003','Island Tea Exports','ACTIVE')
ON DUPLICATE KEY UPDATE buyer_name=VALUES(buyer_name),status='ACTIVE';
INSERT INTO tea_auctions(auction_date,sale_no,notes,status,created_by)
SELECT DATE_ADD(CURDATE(),INTERVAL 5 DAY),'SALE-35','Colombo Tea Auction','SCHEDULED',1
WHERE NOT EXISTS (SELECT 1 FROM tea_auctions WHERE sale_no='SALE-35');

UPDATE tea_grades SET packing_density=350,min_bag_weight=50,max_bag_weight=60 WHERE grade_code='PF1';
UPDATE tea_grades SET packing_density=330,min_bag_weight=48,max_bag_weight=62 WHERE grade_code='BP1';
UPDATE tea_grades SET packing_density=300,min_bag_weight=45,max_bag_weight=58 WHERE grade_code='A';
UPDATE tea_grades SET packing_density=315,min_bag_weight=45,max_bag_weight=60 WHERE grade_code='B';
UPDATE tea_grades SET packing_density=325,min_bag_weight=46,max_bag_weight=62 WHERE grade_code='C';

-- Clear only prior DEMO-2026 records so this script can be re-run safely.
DELETE FROM invoice_stock_movements WHERE invoice_id IN (SELECT invoice_id FROM warehouse_invoices WHERE invoice_no LIKE 'DEMO-2026-%');
DELETE FROM gin_items WHERE invoice_id IN (SELECT invoice_id FROM warehouse_invoices WHERE invoice_no LIKE 'DEMO-2026-%');
DELETE FROM grn_items WHERE invoice_id IN (SELECT invoice_id FROM warehouse_invoices WHERE invoice_no LIKE 'DEMO-2026-%');
DELETE FROM invoice_ai_recommendations WHERE invoice_id IN (SELECT invoice_id FROM warehouse_invoices WHERE invoice_no LIKE 'DEMO-2026-%');
DELETE FROM invoice_location_allocations WHERE invoice_id IN (SELECT invoice_id FROM warehouse_invoices WHERE invoice_no LIKE 'DEMO-2026-%');
DELETE FROM gins WHERE gin_no LIKE 'DEMO-GIN-%';
DELETE FROM grns WHERE grn_no LIKE 'DEMO-GRN-%';
DELETE FROM warehouse_invoices WHERE invoice_no LIKE 'DEMO-2026-%';
UPDATE warehouse_locations SET occupied_bags=0,current_weight=0,status='EMPTY',reserved=0 WHERE location_code IN ('01A01','01A02','01B01','02A01','02B01','03C05','04A10','05B12');

INSERT INTO warehouse_invoices(invoice_year,invoice_no,mark,selling_mark,grade,packing_type,chest_type,broker,chests,net_weight_each,total_net_weight,store,invoice_date,arrival_turn_no,arrival_vehicle_no,arrival_driver_name,arrival_driver_nic,location_code,allocation_score,allocation_model,allocation_type,created_by) VALUES
(YEAR(CURDATE()),'DEMO-2026-001','KEELLS','John Keells','PF1','MWPS','B','John Keells PLC',10,58,580,'BrewSmart Warehouse',CURDATE(),'TURN-DEMO-101','WP-CAB-1010','Nimal Perera','NIC-101','01A01',91.4,'BREWSMART-MCDM-2026.3','AI',1),
(YEAR(CURDATE()),'DEMO-2026-002','FOREST','Forest Mark','BP1','MWPS','B','Asia Siyaka Commodities',8,55,440,'BrewSmart Warehouse',CURDATE(),'TURN-DEMO-101','WP-CAB-1010','Nimal Perera','NIC-101','01A02',88.7,'BREWSMART-MCDM-2026.3','AI',1),
(YEAR(CURDATE()),'DEMO-2026-003','HAYLEYS','Hayleys Mark','A','PC','B','Forbes & Walker Tea Brokers',10,52,520,'BrewSmart Warehouse',DATE_SUB(CURDATE(),INTERVAL 1 DAY),'TURN-DEMO-100','WP-TRK-2201','Sunil Silva','NIC-220','02A01',86.2,'BREWSMART-MCDM-2026.3','AI',1),
(YEAR(CURDATE()),'DEMO-2026-004','KEELLS','John Keells','B','PP','B','John Keells PLC',6,48,288,'BrewSmart Warehouse',DATE_SUB(CURDATE(),INTERVAL 2 DAY),'TURN-DEMO-099','WP-TRK-3302','Kamal Fernando','NIC-330','03C05',82.5,'BREWSMART-MCDM-2026.3','AI',1);

SET @i1=(SELECT invoice_id FROM warehouse_invoices WHERE invoice_no='DEMO-2026-001');
SET @i2=(SELECT invoice_id FROM warehouse_invoices WHERE invoice_no='DEMO-2026-002');
SET @i3=(SELECT invoice_id FROM warehouse_invoices WHERE invoice_no='DEMO-2026-003');
SET @i4=(SELECT invoice_id FROM warehouse_invoices WHERE invoice_no='DEMO-2026-004');
SET @l1=(SELECT location_id FROM warehouse_locations WHERE location_code='01A01');
SET @l2=(SELECT location_id FROM warehouse_locations WHERE location_code='01A02');
SET @l3=(SELECT location_id FROM warehouse_locations WHERE location_code='02A01');
SET @l4=(SELECT location_id FROM warehouse_locations WHERE location_code='03C05');

-- Current live stock after one 3-bag Gate Pass dispatch from DEMO-2026-003.
INSERT INTO invoice_location_allocations(invoice_id,location_id,chests_allocated,weight_allocated,allocation_type,score,allocated_by) VALUES
(@i1,@l1,10,580,'AI',91.4,1),(@i2,@l2,8,440,'AI',88.7,1),(@i3,@l3,7,364,'AI',86.2,1),(@i4,@l4,6,288,'AI',82.5,1);
UPDATE warehouse_locations SET occupied_bags=10,current_weight=580,status='FULL' WHERE location_id=@l1;
UPDATE warehouse_locations SET occupied_bags=8,current_weight=440,status='PARTIAL' WHERE location_id=@l2;
UPDATE warehouse_locations SET occupied_bags=7,current_weight=364,status='PARTIAL' WHERE location_id=@l3;
UPDATE warehouse_locations SET occupied_bags=6,current_weight=288,status='PARTIAL' WHERE location_id=@l4;
UPDATE warehouse_invoices SET location_id=@l1 WHERE invoice_id=@i1;
UPDATE warehouse_invoices SET location_id=@l2 WHERE invoice_id=@i2;
UPDATE warehouse_invoices SET location_id=@l3 WHERE invoice_id=@i3;
UPDATE warehouse_invoices SET location_id=@l4 WHERE invoice_id=@i4;

INSERT INTO grns(grn_no,grn_date,store,turn_no,vehicle_no,driver_name,driver_nic,source_type,broker,mark,chests,created_by) VALUES
('DEMO-GRN-101',CURDATE(),'BrewSmart Warehouse','TURN-DEMO-101','WP-CAB-1010','Nimal Perera','NIC-101','BROKER','John Keells PLC','KEELLS',18,1),
('DEMO-GRN-100',DATE_SUB(CURDATE(),INTERVAL 1 DAY),'BrewSmart Warehouse','TURN-DEMO-100','WP-TRK-2201','Sunil Silva','NIC-220','BROKER','Forbes & Walker Tea Brokers','HAYLEYS',10,1);
SET @g1=(SELECT grn_id FROM grns WHERE grn_no='DEMO-GRN-101'); SET @g2=(SELECT grn_id FROM grns WHERE grn_no='DEMO-GRN-100');
INSERT INTO grn_items(grn_id,invoice_id,received_chests) VALUES (@g1,@i1,10),(@g1,@i2,8),(@g2,@i3,10);

INSERT INTO gins(gin_no,gin_date,store,turn_no,buyer,collection_person,vehicle_no,sale_type,invoice_no,chests,dispatch_status,gate_pass_no,gate_passed_at,gate_passed_by,created_by) VALUES
('DEMO-GIN-001',CURDATE(),'BrewSmart Warehouse','OUT-DEMO-001','Ceylon Tea Exporters','Ruwan Jay','WP-LOR-7788','Auction Sale','DEMO-2026-003',3,'DISPATCHED','DEMO-GP-001',NOW(),1,1),
('DEMO-GIN-002',CURDATE(),'BrewSmart Warehouse','OUT-DEMO-002','Global Tea Trading','Kasun M','WP-LOR-8899','Auction Sale','DEMO-2026-002',4,'PENDING',NULL,NULL,NULL,1);
SET @gin1=(SELECT gin_id FROM gins WHERE gin_no='DEMO-GIN-001'); SET @gin2=(SELECT gin_id FROM gins WHERE gin_no='DEMO-GIN-002');
INSERT INTO gin_items(gin_id,invoice_id,location_id,chests_issued,net_weight_each,weight_issued) VALUES (@gin1,@i3,@l3,3,52,156),(@gin2,@i2,@l2,4,55,220);
INSERT INTO invoice_stock_movements(invoice_id,location_id,movement_type,quantity_bags,weight,reference_type,reference_no,notes,created_by,created_at) VALUES
(@i3,@l3,'OUT',3,156,'GIN','DEMO-GIN-001','Demo Gate Pass dispatch',1,NOW());

INSERT INTO invoice_ai_recommendations(invoice_id,requested_chests,bag_weight,total_net_weight,recommended_location_id,score,allocation_plan_json,alternatives_json,explanation,rule_version,model_version,decision,final_location_id,created_by) VALUES
(@i1,10,58,580,@l1,91.4,JSON_ARRAY(JSON_OBJECT('location_code','01A01','bags',10)),JSON_ARRAY(JSON_OBJECT('location_code','01A02','score',88.7)),'Safe lower level; strong fit and rack balance','RULE-2026.3','BREWSMART-MCDM-2026.3','ACCEPTED',@l1,1);

SELECT COUNT(*) AS locations_should_be_7200 FROM warehouse_locations;
SELECT SUM(occupied_bags) AS demo_live_stock_bags,ROUND(SUM(current_weight),2) AS demo_live_stock_weight FROM warehouse_locations;

-- =====================================================================
-- FINAL VERIFICATION
-- =====================================================================
SELECT DATABASE() AS active_database;
SELECT COUNT(*) AS users_count FROM users;
SELECT COUNT(*) AS brokers_count FROM brokers;
SELECT COUNT(*) AS buyers_count FROM buyers;
SELECT COUNT(*) AS tea_grades_count FROM tea_grades;
SELECT COUNT(*) AS warehouse_locations_should_be_7200 FROM warehouse_locations;
SELECT
    SUM(occupied_bags) AS live_stock_bags,
    ROUND(SUM(current_weight),2) AS live_stock_weight_kg
FROM warehouse_locations;
SELECT COUNT(*) AS invoice_count FROM warehouse_invoices;
SELECT COUNT(*) AS grn_count FROM grns;
SELECT COUNT(*) AS gin_count FROM gins;
SELECT COUNT(*) AS permission_catalog_count FROM permission_catalog;
SELECT 'BREWSMART FULL DATABASE IMPORT COMPLETED' AS result;
