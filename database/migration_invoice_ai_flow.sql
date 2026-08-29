USE brewsMart_db;

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
