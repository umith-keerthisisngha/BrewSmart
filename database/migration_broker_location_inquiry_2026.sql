USE brewsMart_db;

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
