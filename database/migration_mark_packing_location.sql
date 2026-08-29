-- Migration: adds Mark / Packing Type master tables, extra Invoice Entry fields,
-- and a warehouse location link on invoices (for the "Location Allocate" feature).
--
-- Run this ONCE against an existing brewsMart_db database that was created
-- from an older copy of database.sql. If you are setting up a brand new
-- database, just run database.sql — it already includes these changes.

USE brewsMart_db;

CREATE TABLE IF NOT EXISTS marks (
  mark_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  mark_code VARCHAR(50) NOT NULL UNIQUE,
  mark_name VARCHAR(150) NOT NULL,
  status ENUM('ACTIVE','INACTIVE') DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS packing_types (
  packing_type_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  packing_code VARCHAR(50) NOT NULL UNIQUE,
  packing_name VARCHAR(150) NOT NULL,
  status ENUM('ACTIVE','INACTIVE') DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT IGNORE INTO marks(mark_code,mark_name) VALUES
  ('KEELLS','John Keells'),('FOREST','Forest Mark'),('HAYLEYS','Hayleys Mark');

INSERT IGNORE INTO packing_types(packing_code,packing_name) VALUES
  ('MWPS','MWPS - MW-P/S'),('PC','PC - Paper Cartons'),('PP','PP - Poly Pockets');

-- Add the new invoice columns only if they don't already exist.
SET @db := DATABASE();

SET @sql := (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='warehouse_invoices' AND COLUMN_NAME='packing_type') = 0,
  'ALTER TABLE warehouse_invoices ADD COLUMN packing_type VARCHAR(100) AFTER grade',
  'SELECT 1'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='warehouse_invoices' AND COLUMN_NAME='chest_type') = 0,
  'ALTER TABLE warehouse_invoices ADD COLUMN chest_type VARCHAR(20) AFTER packing_type',
  'SELECT 1'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='warehouse_invoices' AND COLUMN_NAME='net_weight_each') = 0,
  'ALTER TABLE warehouse_invoices ADD COLUMN net_weight_each DECIMAL(10,2) DEFAULT NULL',
  'SELECT 1'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='warehouse_invoices' AND COLUMN_NAME='total_gross_weight') = 0,
  'ALTER TABLE warehouse_invoices ADD COLUMN total_gross_weight DECIMAL(12,2) DEFAULT NULL',
  'SELECT 1'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='warehouse_invoices' AND COLUMN_NAME='moisture_content') = 0,
  'ALTER TABLE warehouse_invoices ADD COLUMN moisture_content DECIMAL(5,2) DEFAULT NULL',
  'SELECT 1'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='warehouse_invoices' AND COLUMN_NAME='mfd_date') = 0,
  'ALTER TABLE warehouse_invoices ADD COLUMN mfd_date DATE DEFAULT NULL',
  'SELECT 1'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='warehouse_invoices' AND COLUMN_NAME='sample_drawn') = 0,
  'ALTER TABLE warehouse_invoices ADD COLUMN sample_drawn TINYINT(1) DEFAULT 0',
  'SELECT 1'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='warehouse_invoices' AND COLUMN_NAME='reprint') = 0,
  'ALTER TABLE warehouse_invoices ADD COLUMN reprint TINYINT(1) DEFAULT 0',
  'SELECT 1'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='warehouse_invoices' AND COLUMN_NAME='exportable') = 0,
  'ALTER TABLE warehouse_invoices ADD COLUMN exportable TINYINT(1) DEFAULT 0',
  'SELECT 1'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='warehouse_invoices' AND COLUMN_NAME='colour_separated') = 0,
  'ALTER TABLE warehouse_invoices ADD COLUMN colour_separated TINYINT(1) DEFAULT 0',
  'SELECT 1'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='warehouse_invoices' AND COLUMN_NAME='location_id') = 0,
  'ALTER TABLE warehouse_invoices ADD COLUMN location_id INT UNSIGNED NULL, ADD COLUMN location_code VARCHAR(30) NULL, ADD FOREIGN KEY(location_id) REFERENCES warehouse_locations(location_id) ON DELETE SET NULL',
  'SELECT 1'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
