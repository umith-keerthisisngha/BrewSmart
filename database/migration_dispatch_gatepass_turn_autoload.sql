USE brewsMart_db;

-- 1) Arrival/turn details are stored with each incoming invoice/arrival line.
ALTER TABLE warehouse_invoices
  ADD COLUMN IF NOT EXISTS arrival_turn_no VARCHAR(80) NULL AFTER invoice_date,
  ADD COLUMN IF NOT EXISTS arrival_vehicle_no VARCHAR(60) NULL AFTER arrival_turn_no,
  ADD COLUMN IF NOT EXISTS arrival_driver_name VARCHAR(120) NULL AFTER arrival_vehicle_no,
  ADD COLUMN IF NOT EXISTS arrival_driver_nic VARCHAR(60) NULL AFTER arrival_driver_name;

-- Helpful lookup index for GRN auto-load by Turn Number.
SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'warehouse_invoices' AND index_name = 'idx_invoice_arrival_turn'
);
SET @idx_sql := IF(@idx_exists = 0,
  'CREATE INDEX idx_invoice_arrival_turn ON warehouse_invoices(arrival_turn_no)',
  'SELECT 1'
);
PREPARE stmt FROM @idx_sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2) GIN becomes a reservation/picking document first. Warehouse stock is only
--    deducted when the Gate Pass is confirmed.
ALTER TABLE gins
  ADD COLUMN IF NOT EXISTS dispatch_status ENUM('PENDING','DISPATCHED','CANCELLED') NOT NULL DEFAULT 'PENDING' AFTER chests,
  ADD COLUMN IF NOT EXISTS gate_pass_no VARCHAR(80) NULL AFTER dispatch_status,
  ADD COLUMN IF NOT EXISTS gate_passed_at DATETIME NULL AFTER gate_pass_no,
  ADD COLUMN IF NOT EXISTS gate_passed_by INT UNSIGNED NULL AFTER gate_passed_at;

-- Existing GINs from the previous BrewSmart version already deducted stock at
-- GIN save time, so mark those legacy records as DISPATCHED to prevent a second deduction.
UPDATE gins
SET dispatch_status='DISPATCHED',
    gate_pass_no=COALESCE(gate_pass_no, CONCAT('LEGACY-GP-', gin_id)),
    gate_passed_at=COALESCE(gate_passed_at, created_at)
WHERE dispatch_status='PENDING' AND created_at < NOW();

SET @idx2_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'gins' AND index_name = 'idx_gin_dispatch_status'
);
SET @idx2_sql := IF(@idx2_exists = 0,
  'CREATE INDEX idx_gin_dispatch_status ON gins(dispatch_status)',
  'SELECT 1'
);
PREPARE stmt2 FROM @idx2_sql; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;

SET @idx3_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'gins' AND index_name = 'idx_gin_gate_pass'
);
SET @idx3_sql := IF(@idx3_exists = 0,
  'CREATE INDEX idx_gin_gate_pass ON gins(gate_pass_no)',
  'SELECT 1'
);
PREPARE stmt3 FROM @idx3_sql; EXECUTE stmt3; DEALLOCATE PREPARE stmt3;
