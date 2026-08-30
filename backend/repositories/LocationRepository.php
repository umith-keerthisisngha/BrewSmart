<?php
declare(strict_types=1);
final class LocationRepository {
    public function __construct(private PDO $pdo) {}
    public function lockById(int $id): ?array { $st=$this->pdo->prepare('SELECT * FROM warehouse_locations WHERE location_id=? FOR UPDATE'); $st->execute([$id]); $row=$st->fetch(); return $row ?: null; }
    public function available(): array {
        return $this->pdo->query("SELECT wl.*,r.rack_code,r.rack_name,(GREATEST(0,LEAST(wl.capacity_bags,10)-wl.occupied_bags)) free_bags,(wl.max_weight_capacity-wl.current_weight) free_weight FROM warehouse_locations wl JOIN racks r ON r.rack_id=wl.rack_id WHERE wl.status<>'BLOCKED' AND wl.active=1 AND wl.blocked=0 AND wl.reserved=0 AND (LEAST(wl.capacity_bags,10)-wl.occupied_bags)>0 AND (wl.max_weight_capacity-wl.current_weight)>0 ORDER BY wl.location_id")->fetchAll();
    }
}
