USE brewsMart_db;

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

