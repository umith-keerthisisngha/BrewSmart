USE brewsMart_db;
SELECT COUNT(*) AS total_locations FROM warehouse_locations;
SELECT level_code, COUNT(*) AS locations_per_level FROM warehouse_locations GROUP BY level_code ORDER BY level_code;
SELECT MIN(location_code) first_code, MAX(location_code) last_code FROM warehouse_locations;
SELECT rule_name,min_bag_weight,max_bag_weight,allowed_levels,prohibited_levels FROM location_rules WHERE active=1 ORDER BY priority;
