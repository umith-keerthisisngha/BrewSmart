<?php
declare(strict_types=1);
final class ReportService {
    public function __construct(private PDO $pdo) {}
    public function gradeStock(): array {
        return $this->pdo->query("SELECT wi.grade,COUNT(DISTINCT wi.invoice_id) invoices,COALESCE(SUM(ila.chests_allocated),0) stock_bags,ROUND(COALESCE(SUM(ila.weight_allocated),0),2) stock_weight FROM warehouse_invoices wi JOIN invoice_location_allocations ila ON ila.invoice_id=wi.invoice_id GROUP BY wi.grade ORDER BY stock_bags DESC,wi.grade")->fetchAll();
    }
    public function brokerStock(): array {
        return $this->pdo->query("SELECT COALESCE(NULLIF(wi.broker,''),'Unspecified') broker,COUNT(DISTINCT wi.invoice_id) invoices,COALESCE(SUM(ila.chests_allocated),0) stock_bags,ROUND(COALESCE(SUM(ila.weight_allocated),0),2) stock_weight FROM warehouse_invoices wi JOIN invoice_location_allocations ila ON ila.invoice_id=wi.invoice_id GROUP BY wi.broker ORDER BY stock_bags DESC,broker")->fetchAll();
    }
    public function issuedSummary(): array {
        return $this->pdo->query("SELECT DATE(m.created_at) issued_date,COUNT(DISTINCT m.reference_no) gins,COALESCE(SUM(m.quantity_bags),0) issued_bags,ROUND(COALESCE(SUM(m.weight),0),2) issued_weight FROM invoice_stock_movements m WHERE m.movement_type='OUT' GROUP BY DATE(m.created_at) ORDER BY issued_date DESC LIMIT 90")->fetchAll();
    }
    public function turnSummary(): array {
        return $this->pdo->query("SELECT wi.arrival_turn_no turn_no,MIN(wi.invoice_date) turn_date,MAX(wi.broker) broker,COUNT(*) invoices,SUM(wi.chests) arrival_bags,ROUND(SUM(COALESCE(wi.total_net_weight,wi.chests*COALESCE(wi.net_weight_each,0))),2) arrival_weight,COALESCE(SUM((SELECT SUM(m.quantity_bags) FROM invoice_stock_movements m WHERE m.invoice_id=wi.invoice_id AND m.movement_type='OUT')),0) issued_bags FROM warehouse_invoices wi WHERE wi.arrival_turn_no IS NOT NULL AND wi.arrival_turn_no<>'' GROUP BY wi.arrival_turn_no ORDER BY turn_date DESC,turn_no DESC LIMIT 200")->fetchAll();
    }
    public function locationUtilization(): array {
        return $this->pdo->query("SELECT r.rack_code,wl.level_code,COUNT(*) locations,SUM(LEAST(wl.capacity_bags,10)) capacity_bags,SUM(wl.occupied_bags) occupied_bags,ROUND(100*SUM(wl.occupied_bags)/NULLIF(SUM(LEAST(wl.capacity_bags,10)),0),1) utilization_pct FROM warehouse_locations wl JOIN racks r ON r.rack_id=wl.rack_id WHERE wl.active=1 AND wl.blocked=0 GROUP BY r.rack_id,wl.level_code ORDER BY r.rack_code,wl.level_code")->fetchAll();
    }
}
