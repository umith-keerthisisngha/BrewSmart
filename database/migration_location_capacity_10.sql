USE brewsMart_db;

-- BrewSmart physical capacity correction
-- Business rule: ONE warehouse location can store a maximum of 10 bags/chests.

-- Keep the default correct for any future inserts.
ALTER TABLE warehouse_locations
  MODIFY COLUMN capacity_bags INT UNSIGNED NOT NULL DEFAULT 10;

-- Correct existing locations. Existing over-capacity stock is preserved, but the
-- location becomes FULL and receives no further allocation until stock is moved out.
UPDATE warehouse_locations
SET capacity_bags = 10;

UPDATE warehouse_locations
SET status = CASE
  WHEN status = 'BLOCKED' OR blocked = 1 THEN 'BLOCKED'
  WHEN occupied_bags = 0 THEN 'EMPTY'
  WHEN occupied_bags >= 10 THEN 'FULL'
  ELSE 'PARTIAL'
END;

INSERT INTO system_settings(setting_key,setting_value,description)
VALUES ('bags_per_location','10','Maximum tea bags/chests allowed in one physical warehouse location')
ON DUPLICATE KEY UPDATE setting_value='10',description=VALUES(description);

-- Verification. This should normally return zero rows after old over-capacity
-- test stock has been transferred/cleared.
SELECT location_code, occupied_bags, capacity_bags, status
FROM warehouse_locations
WHERE occupied_bags > 10
ORDER BY location_code;

SELECT COUNT(*) AS total_locations,
       MIN(capacity_bags) AS min_capacity,
       MAX(capacity_bags) AS max_capacity
FROM warehouse_locations;
