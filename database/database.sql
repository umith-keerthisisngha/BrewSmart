CREATE DATABASE IF NOT EXISTS brewsMart_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE brewsMart_db;
SET FOREIGN_KEY_CHECKS=0;
DROP TABLE IF EXISTS activity_logs,role_permissions,system_settings,dispatches,gins,grns,warehouse_invoices,stock_movements,inventory_locations,tea_inventory,warehouse_locations,warehouse_levels,racks,suppliers,tea_grades,tea_types,marks,packing_types,users;
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
CREATE TABLE racks (rack_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,rack_code VARCHAR(20) NOT NULL UNIQUE,rack_name VARCHAR(80) NOT NULL,status ENUM('ACTIVE','INACTIVE','MAINTENANCE') DEFAULT 'ACTIVE') ENGINE=InnoDB;
CREATE TABLE warehouse_levels (level_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,rack_id INT UNSIGNED NOT NULL,level_number TINYINT UNSIGNED NOT NULL,UNIQUE KEY uq_rack_level(rack_id,level_number),FOREIGN KEY(rack_id) REFERENCES racks(rack_id) ON DELETE CASCADE) ENGINE=InnoDB;
CREATE TABLE warehouse_locations (location_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,location_code VARCHAR(30) NOT NULL UNIQUE,rack_id INT UNSIGNED NOT NULL,level_id INT UNSIGNED NOT NULL,location_number INT UNSIGNED NOT NULL,capacity_bags INT UNSIGNED NOT NULL DEFAULT 10,occupied_bags INT UNSIGNED NOT NULL DEFAULT 0,status ENUM('EMPTY','PARTIAL','FULL','BLOCKED') DEFAULT 'EMPTY',FOREIGN KEY(rack_id) REFERENCES racks(rack_id),FOREIGN KEY(level_id) REFERENCES warehouse_levels(level_id),INDEX(status)) ENGINE=InnoDB;
CREATE TABLE suppliers (supplier_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,supplier_code VARCHAR(30) NOT NULL UNIQUE,supplier_name VARCHAR(150) NOT NULL,contact_person VARCHAR(120),phone VARCHAR(30),email VARCHAR(150),status ENUM('ACTIVE','INACTIVE') DEFAULT 'ACTIVE') ENGINE=InnoDB;
CREATE TABLE tea_types (tea_type_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,tea_code VARCHAR(30) NOT NULL UNIQUE,tea_name VARCHAR(100) NOT NULL,description TEXT) ENGINE=InnoDB;
CREATE TABLE tea_grades (grade_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,grade_code VARCHAR(30) NOT NULL UNIQUE,grade_name VARCHAR(100) NOT NULL,description TEXT) ENGINE=InnoDB;
CREATE TABLE marks (mark_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,mark_code VARCHAR(50) NOT NULL UNIQUE,mark_name VARCHAR(150) NOT NULL,status ENUM('ACTIVE','INACTIVE') DEFAULT 'ACTIVE',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB;
CREATE TABLE packing_types (packing_type_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,packing_code VARCHAR(50) NOT NULL UNIQUE,packing_name VARCHAR(150) NOT NULL,status ENUM('ACTIVE','INACTIVE') DEFAULT 'ACTIVE',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB;
CREATE TABLE tea_inventory (inventory_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,lot_number VARCHAR(50) NOT NULL UNIQUE,supplier_id INT UNSIGNED NULL,tea_type_id INT UNSIGNED NOT NULL,grade_id INT UNSIGNED NULL,received_date DATE NOT NULL,total_bags INT UNSIGNED NOT NULL DEFAULT 0,available_bags INT UNSIGNED NOT NULL DEFAULT 0,allocated_bags INT UNSIGNED NOT NULL DEFAULT 0,status ENUM('RECEIVED','STORED','PARTIALLY_ALLOCATED','SOLD','COMPLETED') DEFAULT 'RECEIVED',notes TEXT,created_by INT UNSIGNED NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(supplier_id) REFERENCES suppliers(supplier_id) ON DELETE SET NULL,FOREIGN KEY(tea_type_id) REFERENCES tea_types(tea_type_id),FOREIGN KEY(grade_id) REFERENCES tea_grades(grade_id) ON DELETE SET NULL,FOREIGN KEY(created_by) REFERENCES users(user_id) ON DELETE SET NULL,INDEX(status),INDEX(received_date)) ENGINE=InnoDB;
CREATE TABLE inventory_locations (allocation_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,inventory_id BIGINT UNSIGNED NOT NULL,location_id INT UNSIGNED NOT NULL,bags_allocated INT UNSIGNED NOT NULL,allocation_type ENUM('MANUAL','AI') DEFAULT 'MANUAL',allocated_by INT UNSIGNED NULL,allocated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(inventory_id) REFERENCES tea_inventory(inventory_id) ON DELETE CASCADE,FOREIGN KEY(location_id) REFERENCES warehouse_locations(location_id),FOREIGN KEY(allocated_by) REFERENCES users(user_id) ON DELETE SET NULL,INDEX(inventory_id),INDEX(location_id)) ENGINE=InnoDB;
CREATE TABLE stock_movements (movement_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,inventory_id BIGINT UNSIGNED NOT NULL,location_id INT UNSIGNED NULL,movement_type ENUM('IN','OUT','TRANSFER','ADJUSTMENT') NOT NULL,quantity_bags INT UNSIGNED NOT NULL,reference_no VARCHAR(80),notes TEXT,created_by INT UNSIGNED NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(inventory_id) REFERENCES tea_inventory(inventory_id) ON DELETE CASCADE,FOREIGN KEY(location_id) REFERENCES warehouse_locations(location_id) ON DELETE SET NULL,FOREIGN KEY(created_by) REFERENCES users(user_id) ON DELETE SET NULL,INDEX(created_at)) ENGINE=InnoDB;
CREATE TABLE dispatches (dispatch_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,invoice_no VARCHAR(80) NOT NULL,buyer VARCHAR(150),delivery_order_no VARCHAR(80),bags INT UNSIGNED NOT NULL,vehicle_no VARCHAR(40),dispatch_date DATE NOT NULL,status ENUM('PENDING','DISPATCHED','CANCELLED') DEFAULT 'PENDING',created_by INT UNSIGNED NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(created_by) REFERENCES users(user_id) ON DELETE SET NULL) ENGINE=InnoDB;
CREATE TABLE grns (grn_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,grn_no VARCHAR(80) NOT NULL UNIQUE,grn_date DATE NOT NULL,vehicle_no VARCHAR(40),supplier VARCHAR(150),chests INT UNSIGNED DEFAULT 0,remarks TEXT,created_by INT UNSIGNED NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(created_by) REFERENCES users(user_id) ON DELETE SET NULL) ENGINE=InnoDB;
CREATE TABLE gins (gin_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,gin_no VARCHAR(80) NOT NULL UNIQUE,gin_date DATE NOT NULL,buyer VARCHAR(150),invoice_no VARCHAR(80),chests INT UNSIGNED DEFAULT 0,created_by INT UNSIGNED NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(created_by) REFERENCES users(user_id) ON DELETE SET NULL) ENGINE=InnoDB;
CREATE TABLE warehouse_invoices (invoice_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,invoice_year SMALLINT NOT NULL,invoice_no VARCHAR(80) NOT NULL UNIQUE,mark VARCHAR(100),selling_mark VARCHAR(100),grade VARCHAR(50),packing_type VARCHAR(100),chest_type VARCHAR(20),broker VARCHAR(150),chests INT UNSIGNED DEFAULT 0,weight_per_chest DECIMAL(10,2) DEFAULT 0,net_weight_each DECIMAL(10,2) DEFAULT NULL,total_net_weight DECIMAL(12,2) DEFAULT NULL,total_gross_weight DECIMAL(12,2) DEFAULT NULL,moisture_content DECIMAL(5,2) DEFAULT NULL,mfd_date DATE DEFAULT NULL,sample_drawn TINYINT(1) DEFAULT 0,reprint TINYINT(1) DEFAULT 0,exportable TINYINT(1) DEFAULT 0,colour_separated TINYINT(1) DEFAULT 0,store VARCHAR(100),invoice_date DATE NOT NULL,location_id INT UNSIGNED NULL,location_code VARCHAR(30) NULL,allocation_score DECIMAL(5,2) NULL,allocation_model VARCHAR(50) NULL,allocation_explanation TEXT NULL,allocation_type VARCHAR(20) NULL,created_by INT UNSIGNED NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(created_by) REFERENCES users(user_id) ON DELETE SET NULL,FOREIGN KEY(location_id) REFERENCES warehouse_locations(location_id) ON DELETE SET NULL) ENGINE=InnoDB;
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
INSERT INTO tea_grades(grade_code,grade_name) VALUES ('A','Grade A'),('B','Grade B'),('C','Grade C'),('PF1','PF1'),('BP1','BP1');
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
