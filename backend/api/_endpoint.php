<?php
declare(strict_types=1);
require_once __DIR__ . '/../lib/bootstrap.php';

$action = defined('BREWSMART_ACTION') ? BREWSMART_ACTION : ($_GET['action'] ?? '');
$method = $_SERVER['REQUEST_METHOD'];

function normalizeLevelList(?string $csv): array {
    if ($csv === null || trim($csv) === '') return [];
    $out = [];
    foreach (preg_split('/\s*,\s*/', strtoupper(trim($csv))) as $level) {
        if (preg_match('/^[A-F]$/', $level)) $out[$level] = true;
    }
    return array_keys($out);
}

function locationBagCapacity(array $location): int {
    // BrewSmart physical rule: one storage location can hold a maximum of 10 tea bags/chests.
    // Keep this backend guard even if an older database row still contains a larger capacity.
    $dbCapacity = isset($location['capacity_bags']) ? (int)$location['capacity_bags'] : 10;
    return max(0, min(10, $dbCapacity));
}

function invoiceAllocationProfile(array $d, ?PDO $pdo = null): array {
    $pdo ??= db();
    $bags = max(0, (int)($d['chests'] ?? $d['bags'] ?? 0));
    $bagWeightRaw = $d['netWeightEach'] ?? $d['net_weight_each'] ?? $d['weightPerChest'] ?? $d['weight_per_chest'] ?? null;
    $bagWeight = ($bagWeightRaw !== null && $bagWeightRaw !== '') ? (float)$bagWeightRaw : 0.0;
    $gradeCode = trim((string)($d['grade'] ?? $d['grade_code'] ?? ''));
    $packingCode = trim((string)($d['packingType'] ?? $d['packing_type'] ?? ''));
    $mark = trim((string)($d['mark'] ?? ''));

    $gradeId = null;
    if ($gradeCode !== '') {
        $st = $pdo->prepare('SELECT grade_id FROM tea_grades WHERE grade_code=? LIMIT 1');
        $st->execute([$gradeCode]);
        $v = $st->fetchColumn();
        if ($v !== false) $gradeId = (int)$v;
    }
    $packingId = null;
    if ($packingCode !== '') {
        $st = $pdo->prepare('SELECT packing_type_id FROM packing_types WHERE packing_code=? LIMIT 1');
        $st->execute([$packingCode]);
        $v = $st->fetchColumn();
        if ($v !== false) $packingId = (int)$v;
    }

    $allowed = ['A','B','C','D','E','F'];
    $prohibited = [];
    $rulesApplied = [];

    try {
        $sql = "SELECT rule_name,allowed_levels,prohibited_levels,priority,mandatory
                FROM location_rules
                WHERE active=1
                  AND (min_bag_weight IS NULL OR ? >= min_bag_weight)
                  AND (max_bag_weight IS NULL OR ? <= max_bag_weight)
                  AND (grade_id IS NULL OR grade_id = ?)
                  AND (packing_type_id IS NULL OR packing_type_id = ?)
                ORDER BY priority ASC, rule_id ASC";
        $st = $pdo->prepare($sql);
        $st->execute([$bagWeight, $bagWeight, $gradeId, $packingId]);
        foreach ($st->fetchAll() as $rule) {
            if (!(int)$rule['mandatory']) continue;
            $ruleAllowed = normalizeLevelList($rule['allowed_levels']);
            $ruleProhibited = normalizeLevelList($rule['prohibited_levels']);
            if ($ruleAllowed) $allowed = array_values(array_intersect($allowed, $ruleAllowed));
            if ($ruleProhibited) $prohibited = array_values(array_unique(array_merge($prohibited, $ruleProhibited)));
            $rulesApplied[] = $rule['rule_name'];
        }
    } catch (Throwable $e) {
        // Existing installations that have not yet run the migration still get the critical safety fallback.
    }

    // Critical safety fallback. The migration creates this as a configurable DB rule;
    // this guard prevents unsafe recommendations on an installation that has not migrated yet.
    if ($bagWeight >= 50 && $bagWeight <= 65) {
        $allowed = array_values(array_intersect($allowed, ['A','B','C']));
        $prohibited = array_values(array_unique(array_merge($prohibited, ['D','E','F'])));
        if (!$rulesApplied) $rulesApplied[] = 'Heavy tea bag lower-level safety rule';
    }
    $allowed = array_values(array_diff($allowed, $prohibited));

    return [
        'bags' => $bags,
        'bag_weight' => $bagWeight,
        'total_weight' => round($bags * $bagWeight, 2),
        'grade_code' => $gradeCode,
        'packing_code' => $packingCode,
        'mark' => $mark,
        'grade_id' => $gradeId,
        'packing_type_id' => $packingId,
        'allowed_levels' => $allowed,
        'prohibited_levels' => $prohibited,
        'rules_applied' => $rulesApplied,
    ];
}

function recommendInvoiceLocations(array $d, int $limit = 12): array {
    $pdo = db();
    $p = invoiceAllocationProfile($d, $pdo);
    if ($p['bags'] <= 0) return ['profile'=>$p,'candidates'=>[],'plan'=>[],'can_allocate'=>false,'remaining_bags'=>$p['bags']];
    if ($p['bag_weight'] <= 0) return ['profile'=>$p,'candidates'=>[],'plan'=>[],'can_allocate'=>false,'remaining_bags'=>$p['bags']];
    if (!$p['allowed_levels']) return ['profile'=>$p,'candidates'=>[],'plan'=>[],'can_allocate'=>false,'remaining_bags'=>$p['bags']];

    $st = $pdo->query("SELECT wl.*,r.rack_code,r.rack_name,
            (GREATEST(0,LEAST(wl.capacity_bags,10)-wl.occupied_bags)) free_bags,
            (wl.max_weight_capacity-wl.current_weight) free_weight
        FROM warehouse_locations wl
        JOIN racks r ON r.rack_id=wl.rack_id
        WHERE wl.status <> 'BLOCKED' AND wl.active=1 AND wl.blocked=0 AND wl.reserved=0
          AND (LEAST(wl.capacity_bags,10)-wl.occupied_bags) > 0
          AND (wl.max_weight_capacity-wl.current_weight) > 0
        ORDER BY wl.location_id");
    $raw = $st->fetchAll();

    $rackStats = $pdo->query("SELECT rack_id,SUM(LEAST(capacity_bags,10)) cap,SUM(occupied_bags) occ FROM warehouse_locations WHERE active=1 AND blocked=0 GROUP BY rack_id")->fetchAll();
    $rackUtil = [];
    foreach ($rackStats as $r) $rackUtil[(int)$r['rack_id']] = (float)$r['cap'] > 0 ? (float)$r['occ']/(float)$r['cap'] : 0.0;

    $same = [];
    try {
        $st = $pdo->prepare("SELECT ila.location_id,
                    SUM(CASE WHEN wi.grade=? AND wi.mark=? THEN ila.chests_allocated ELSE 0 END) same_stock,
                    SUM(ila.chests_allocated) all_stock
                FROM invoice_location_allocations ila
                JOIN warehouse_invoices wi ON wi.invoice_id=ila.invoice_id
                GROUP BY ila.location_id");
        $st->execute([$p['grade_code'], $p['mark']]);
        foreach ($st->fetchAll() as $row) $same[(int)$row['location_id']] = $row;
    } catch (Throwable $e) {}

    $candidates = [];
    foreach ($raw as $loc) {
        $level = strtoupper((string)($loc['level_code'] ?? ''));
        if (!in_array($level, $p['allowed_levels'], true)) continue;
        if (in_array($level, $p['prohibited_levels'], true)) continue;

        $freeBags = max(0, (int)$loc['free_bags']);
        $freeWeight = max(0.0, (float)$loc['free_weight']);
        $weightBagCapacity = (int)floor($freeWeight / max($p['bag_weight'], 0.01));
        $usableBags = min($freeBags, $weightBagCapacity);
        if ($usableBags <= 0) continue;

        $targetHere = min($p['bags'], $usableBags);
        $fitScore = $targetHere / max($usableBags, 1);
        $weightFitScore = ($targetHere * $p['bag_weight']) / max($freeWeight, 0.01);
        $util = $rackUtil[(int)$loc['rack_id']] ?? 0.0;
        $balanceScore = max(0.0, 1.0 - $util);
        $levelIndex = array_search($level, ['A','B','C','D','E','F'], true);
        $accessScore = $levelIndex === false ? 0.5 : max(0.45, 1.0 - ($levelIndex * 0.1));

        $sameInfo = $same[(int)$loc['location_id']] ?? null;
        if ($sameInfo && (int)$sameInfo['same_stock'] > 0) {
            $consolidationScore = 1.0;
            $consolidationNote = 'same grade/mark stock is already stored here';
        } elseif ((int)$loc['occupied_bags'] === 0) {
            $consolidationScore = 0.72;
            $consolidationNote = 'clean empty location';
        } else {
            $consolidationScore = 0.45;
            $consolidationNote = 'partially occupied location';
        }

        $total = (0.30*$fitScore) + (0.20*$weightFitScore) + (0.25*$consolidationScore) + (0.15*$balanceScore) + (0.10*$accessScore);
        $score = round(max(0,min(1,$total))*100,1);
        $reasons = [
            "Level {$level} passes all mandatory rules",
            "{$usableBags} bags usable capacity",
            $consolidationNote,
            'rack utilization '.round($util*100,1).'%',
        ];

        $candidates[] = [
            'location_id'=>(int)$loc['location_id'],
            'location_code'=>$loc['location_code'],
            'rack_code'=>$loc['rack_code'],
            'level_code'=>$level,
            'status'=>$loc['status'],
            'free_bags'=>$freeBags,
            'free_weight'=>round($freeWeight,2),
            'usable_bags'=>$usableBags,
            'score'=>$score,
            'reason'=>implode('; ', $reasons).'.',
        ];
    }

    usort($candidates, function($a,$b){
        $cmp = $b['score'] <=> $a['score'];
        if ($cmp !== 0) return $cmp;
        return strcmp($a['location_code'],$b['location_code']);
    });

    $remaining = $p['bags'];
    $plan = [];
    foreach ($candidates as $cand) {
        if ($remaining <= 0) break;
        $qty = min($remaining, (int)$cand['usable_bags']);
        if ($qty <= 0) continue;
        $plan[] = [
            'location_id'=>$cand['location_id'],
            'location_code'=>$cand['location_code'],
            'rack_code'=>$cand['rack_code'],
            'level_code'=>$cand['level_code'],
            'chests_allocated'=>$qty,
            'weight_allocated'=>round($qty*$p['bag_weight'],2),
            'score'=>$cand['score'],
            'reason'=>$cand['reason'],
        ];
        $remaining -= $qty;
    }

    return [
        'profile'=>$p,
        'model_version'=>'INVOICE-WEIGHTED-2026.2',
        'rule_version'=>'RULE-2026.2',
        'candidates'=>array_slice($candidates,0,max(1,$limit)),
        'plan'=>$plan,
        'can_allocate'=>$remaining===0,
        'remaining_bags'=>$remaining,
    ];
}

function reserveInvoiceAllocation(PDO $pdo, int $invoiceId, array $plan, array $profile, int $userId, string $allocationType='AI'): void {
    foreach ($plan as $part) {
        $st = $pdo->prepare('SELECT * FROM warehouse_locations WHERE location_id=? FOR UPDATE');
        $st->execute([(int)$part['location_id']]);
        $loc = $st->fetch();
        if (!$loc) throw new RuntimeException('Recommended location not found');
        $level = strtoupper((string)($loc['level_code'] ?? ''));
        if ($loc['status']==='BLOCKED' || !empty($loc['blocked']) || !empty($loc['reserved']) || isset($loc['active']) && (int)$loc['active']!==1) throw new RuntimeException('Location '.$loc['location_code'].' is unavailable');
        if (!in_array($level,$profile['allowed_levels'],true) || in_array($level,$profile['prohibited_levels'],true)) throw new RuntimeException('Location '.$loc['location_code'].' violates a mandatory location rule');
        $qty = (int)$part['chests_allocated'];
        $weight = round($qty*(float)$profile['bag_weight'],2);
        $effectiveCapacity = locationBagCapacity($loc);
        if (($effectiveCapacity-(int)$loc['occupied_bags']) < $qty) throw new RuntimeException('Location '.$loc['location_code'].' can hold a maximum of 10 bags and does not have enough remaining capacity');
        if (((float)$loc['max_weight_capacity']-(float)$loc['current_weight']) < $weight) throw new RuntimeException('Location '.$loc['location_code'].' does not have enough weight capacity');

        $pdo->prepare('INSERT INTO invoice_location_allocations(invoice_id,location_id,chests_allocated,weight_allocated,allocation_type,score,allocated_by) VALUES(?,?,?,?,?,?,?)')
            ->execute([$invoiceId,(int)$loc['location_id'],$qty,$weight,$allocationType,$part['score']??null,$userId]);
        $newOcc=(int)$loc['occupied_bags']+$qty;
        $newWeight=(float)$loc['current_weight']+$weight;
        $newStatus=$newOcc >= $effectiveCapacity ? 'FULL' : 'PARTIAL';
        $pdo->prepare('UPDATE warehouse_locations SET occupied_bags=?,current_weight=?,status=? WHERE location_id=?')
            ->execute([$newOcc,$newWeight,$newStatus,(int)$loc['location_id']]);
    }
}

function releaseInvoiceAllocations(PDO $pdo, int $invoiceId): void {
    $st=$pdo->prepare('SELECT ila.*,wl.occupied_bags,wl.current_weight,wl.capacity_bags,wl.status FROM invoice_location_allocations ila JOIN warehouse_locations wl ON wl.location_id=ila.location_id WHERE ila.invoice_id=? FOR UPDATE');
    $st->execute([$invoiceId]);
    foreach($st->fetchAll() as $a){
        $newOcc=max(0,(int)$a['occupied_bags']-(int)$a['chests_allocated']);
        $newWeight=max(0.0,(float)$a['current_weight']-(float)$a['weight_allocated']);
        $effectiveCapacity=locationBagCapacity($a);
        $newStatus=$a['status']==='BLOCKED'?'BLOCKED':($newOcc===0?'EMPTY':($newOcc>=$effectiveCapacity?'FULL':'PARTIAL'));
        $pdo->prepare('UPDATE warehouse_locations SET occupied_bags=?,current_weight=?,status=? WHERE location_id=?')->execute([$newOcc,$newWeight,$newStatus,(int)$a['location_id']]);
    }
    $pdo->prepare('DELETE FROM invoice_location_allocations WHERE invoice_id=?')->execute([$invoiceId]);
}

switch ($action) {
case 'login':
    $d=body(); $username=trim((string)($d['username']??'')); $password=(string)($d['password']??'');
    if($username===''||$password==='') fail('Username and password are required');
    $st=db()->prepare('SELECT user_id,username,full_name,email,password_hash,role,status FROM users WHERE username=? LIMIT 1'); $st->execute([$username]); $u=$st->fetch();
    if(!$u || $u['status']!=='ACTIVE' || !password_verify($password,$u['password_hash'])) fail('Invalid username or password',401);
    session_regenerate_id(true); $_SESSION['user_id']=(int)$u['user_id']; $_SESSION['user']=$u['username']; $_SESSION['display_name']=$u['full_name']; $_SESSION['role']=$u['role'];
    unset($u['password_hash']); logActivity('LOGIN','AUTH','User logged in');
    ok(['user'=>$u['username'],'display_name'=>$u['full_name'],'role'=>$u['role'],'email'=>$u['email']],'Login successful');
case 'logout':
    if(session_status()===PHP_SESSION_ACTIVE) { $_SESSION=[]; if(ini_get('session.use_cookies')) { $p=session_get_cookie_params(); setcookie(session_name(),'',['expires'=>time()-42000,'path'=>$p['path'],'domain'=>$p['domain'],'secure'=>$p['secure'],'httponly'=>$p['httponly'],'samesite'=>$p['samesite']??'Lax']); } session_destroy(); }
    ok([], 'Logged out');
case 'session':
    if(empty($_SESSION['user_id'])) fail('Not logged in',401);
    echo json_encode(['loggedIn'=>true,'user'=>$_SESSION['user'],'display_name'=>$_SESSION['display_name'],'role'=>$_SESSION['role']]); exit;
case 'dashboard':
    requireLogin(); $pdo=db();
    $dashboard=$pdo->query("SELECT (SELECT COALESCE(SUM(available_bags),0) FROM tea_inventory WHERE status<>'COMPLETED') available_bags,(SELECT COUNT(*) FROM tea_inventory WHERE status<>'COMPLETED') tea_lots,(SELECT COALESCE(SUM(LEAST(capacity_bags,10)),0) FROM warehouse_locations WHERE status<>'BLOCKED') total_capacity,(SELECT COALESCE(SUM(occupied_bags),0) FROM warehouse_locations WHERE status<>'BLOCKED') occupied_bags,(SELECT COUNT(*) FROM warehouse_locations WHERE status='EMPTY') available_locations,(SELECT COUNT(*) FROM warehouse_locations WHERE status='BLOCKED') blocked_locations")->fetch();
    $recent=$pdo->query('SELECT log_id,action,module,description,created_at FROM activity_logs ORDER BY log_id DESC LIMIT 10')->fetchAll();
    ok(['summary'=>$dashboard,'recent_activity'=>$recent]);
case 'inventory_list':
    requireLogin(); $q=trim((string)($_GET['q']??'')); $limit=min(200,max(1,intParam('limit',100))); $sql="SELECT i.*,s.supplier_name,t.tea_name,g.grade_code,g.grade_name,COALESCE(SUM(il.bags_allocated),0) allocated_to_locations FROM tea_inventory i LEFT JOIN suppliers s ON s.supplier_id=i.supplier_id JOIN tea_types t ON t.tea_type_id=i.tea_type_id LEFT JOIN tea_grades g ON g.grade_id=i.grade_id LEFT JOIN inventory_locations il ON il.inventory_id=i.inventory_id"; $params=[]; if($q!==''){ $sql.=' WHERE i.lot_number LIKE ? OR t.tea_name LIKE ? OR g.grade_code LIKE ?'; $like="%$q%"; $params=[$like,$like,$like]; } $sql.=' GROUP BY i.inventory_id ORDER BY i.inventory_id DESC LIMIT '.$limit; $st=db()->prepare($sql);$st->execute($params);ok($st->fetchAll());
case 'inventory_get':
    requireLogin(); $id=intParam('id'); if(!$id) fail('Inventory id is required'); $st=db()->prepare("SELECT i.*,s.supplier_name,t.tea_name,g.grade_code,g.grade_name FROM tea_inventory i LEFT JOIN suppliers s ON s.supplier_id=i.supplier_id JOIN tea_types t ON t.tea_type_id=i.tea_type_id LEFT JOIN tea_grades g ON g.grade_id=i.grade_id WHERE i.inventory_id=?");$st->execute([$id]);$row=$st->fetch();if(!$row)fail('Inventory not found',404);$a=db()->prepare("SELECT il.*,wl.location_code FROM inventory_locations il JOIN warehouse_locations wl ON wl.location_id=il.location_id WHERE il.inventory_id=? ORDER BY il.allocation_id");$a->execute([$id]);$row['allocations']=$a->fetchAll();ok($row);
case 'inventory_create':
    $u=requireRole(['ADMIN','MANAGER','WAREHOUSE_STAFF']); $d=body(); $lot=trim((string)($d['lot_number']??$d['invoice_no']??''));$tea=(int)($d['tea_type_id']??0);$bags=(int)($d['total_bags']??$d['chests']??0);$grade=isset($d['grade_id'])?(int)$d['grade_id']:null;$supplier=isset($d['supplier_id'])?(int)$d['supplier_id']:null;$date=$d['received_date']??date('Y-m-d'); if($lot===''||!$tea||$bags<=0)fail('lot_number, tea_type_id and total_bags are required');
    $pdo=db();$pdo->beginTransaction();try{$st=$pdo->prepare('INSERT INTO tea_inventory(lot_number,supplier_id,tea_type_id,grade_id,received_date,total_bags,available_bags,status,notes,created_by) VALUES(?,?,?,?,?,?,?,\'RECEIVED\',?,?)');$st->execute([$lot,$supplier,$tea,$grade,$date,$bags,$bags,$d['notes']??null,$u['user_id']]);$id=(int)$pdo->lastInsertId();$pdo->commit();logActivity('CREATE','INVENTORY','Created inventory '.$lot);ok(['inventory_id'=>$id]);}catch(Throwable $e){$pdo->rollBack();fail($e->getCode()==='23000'?'Lot number already exists':$e->getMessage(),400);}
case 'inventory_update':
    $u=requireRole(['ADMIN','MANAGER','WAREHOUSE_STAFF']);$d=body();$id=(int)($d['inventory_id']??$d['id']??0);if(!$id)fail('Inventory id is required');$allowed=['lot_number','supplier_id','tea_type_id','grade_id','received_date','total_bags','notes','status'];$sets=[];$params=[];foreach($allowed as $k){if(array_key_exists($k,$d)){ $sets[]="$k=?";$params[]=$d[$k]===''?null:$d[$k]; }}if(!$sets)fail('No fields to update');$params[]=$id;$st=db()->prepare('UPDATE tea_inventory SET '.implode(',',$sets).' WHERE inventory_id=?');$st->execute($params);logActivity('UPDATE','INVENTORY','Updated inventory #'.$id);ok([],'Inventory updated');
case 'inventory_delete':
    requireRole(['ADMIN','MANAGER']);$id=(int)(body()['inventory_id']??$_GET['id']??0);if(!$id)fail('Inventory id is required');$st=db()->prepare('DELETE FROM tea_inventory WHERE inventory_id=?');$st->execute([$id]);if(!$st->rowCount())fail('Inventory not found',404);logActivity('DELETE','INVENTORY','Deleted inventory #'.$id);ok([],'Inventory deleted');
case 'racks': requireLogin(); ok(db()->query('SELECT r.*,COUNT(DISTINCT wl.location_id) location_count,COALESCE(SUM(wl.occupied_bags),0) occupied_bags FROM racks r LEFT JOIN warehouse_locations wl ON wl.rack_id=r.rack_id GROUP BY r.rack_id ORDER BY r.rack_code')->fetchAll());
case 'levels': requireLogin(); $rack=intParam('rack_id');$sql='SELECT wl.*,r.rack_code,r.rack_name FROM warehouse_locations wl JOIN racks r ON r.rack_id=wl.rack_id';$p=[];if($rack){$sql.=' WHERE wl.rack_id=?';$p[]=$rack;}$sql.=' ORDER BY r.rack_code,wl.location_number';$st=db()->prepare($sql);$st->execute($p);ok($st->fetchAll());
case 'locations': requireLogin(); $status=$_GET['status']??'';$sql="SELECT wl.*,r.rack_code,r.rack_name,COUNT(il.allocation_id) allocations FROM warehouse_locations wl JOIN racks r ON r.rack_id=wl.rack_id LEFT JOIN inventory_locations il ON il.location_id=wl.location_id";$p=[];if($status!==''){ $sql.=' WHERE wl.status=?';$p[]=$status;}$sql.=' GROUP BY wl.location_id ORDER BY r.rack_code,wl.location_number';$st=db()->prepare($sql);$st->execute($p);ok($st->fetchAll());
case 'search_location':
    requireLogin();
    $q=trim((string)($_GET['q']??''));if($q==='')fail('Search term is required');$like="%$q%";
    $sql="SELECT wl.*,r.rack_code,r.rack_name,
      (SELECT GROUP_CONCAT(DISTINCT wi.invoice_no ORDER BY wi.invoice_no SEPARATOR ', ') FROM invoice_location_allocations ila JOIN warehouse_invoices wi ON wi.invoice_id=ila.invoice_id WHERE ila.location_id=wl.location_id) invoice_no,
      (SELECT GROUP_CONCAT(DISTINCT wi.grade ORDER BY wi.grade SEPARATOR ', ') FROM invoice_location_allocations ila JOIN warehouse_invoices wi ON wi.invoice_id=ila.invoice_id WHERE ila.location_id=wl.location_id) invoice_grade,
      (SELECT COALESCE(SUM(ila.chests_allocated),0) FROM invoice_location_allocations ila WHERE ila.location_id=wl.location_id) invoice_chests,
      (SELECT GROUP_CONCAT(DISTINCT i.lot_number ORDER BY i.lot_number SEPARATOR ', ') FROM inventory_locations il JOIN tea_inventory i ON i.inventory_id=il.inventory_id WHERE il.location_id=wl.location_id) lot_number,
      (SELECT COALESCE(SUM(il.bags_allocated),0) FROM inventory_locations il WHERE il.location_id=wl.location_id) bags_allocated
      FROM warehouse_locations wl JOIN racks r ON r.rack_id=wl.rack_id
      WHERE wl.location_code LIKE ?
         OR EXISTS(SELECT 1 FROM invoice_location_allocations ila JOIN warehouse_invoices wi ON wi.invoice_id=ila.invoice_id WHERE ila.location_id=wl.location_id AND wi.invoice_no LIKE ?)
         OR EXISTS(SELECT 1 FROM inventory_locations il JOIN tea_inventory i ON i.inventory_id=il.inventory_id WHERE il.location_id=wl.location_id AND i.lot_number LIKE ?)
      ORDER BY wl.location_code LIMIT 200";
    $st=db()->prepare($sql);$st->execute([$like,$like,$like]);ok($st->fetchAll());
case 'location_set_status':
    $u=requireRole(['ADMIN','MANAGER','WAREHOUSE_STAFF']);$d=body();$id=(int)($d['location_id']??0);$status=strtoupper((string)($d['status']??''));if(!$id||!in_array($status,['EMPTY','PARTIAL','FULL','BLOCKED'],true))fail('location_id and a valid status are required');$st=db()->prepare('SELECT * FROM warehouse_locations WHERE location_id=?');$st->execute([$id]);$l=$st->fetch();if(!$l)fail('Location not found',404);if($status!=='BLOCKED'&&$l['occupied_bags']>0)fail('Location has allocated stock; use allocation/dispatch to clear it first');if($status==='BLOCKED'&&$l['occupied_bags']>0)fail('Cannot block a location that has stock allocated');db()->prepare('UPDATE warehouse_locations SET status=? WHERE location_id=?')->execute([$status,$id]);logActivity('UPDATE','WAREHOUSE',"Set location {$l['location_code']} to {$status}");ok([],'Location status updated');
case 'allocate':
    $u=requireRole(['ADMIN','MANAGER','WAREHOUSE_STAFF']);$d=body();$inventory=(int)($d['inventory_id']??0);$location=(int)($d['location_id']??0);$bags=(int)($d['bags_allocated']??$d['bags']??0);if(!$inventory||!$location||$bags<=0)fail('inventory_id, location_id and bags_allocated are required');$pdo=db();$pdo->beginTransaction();try{$st=$pdo->prepare('SELECT * FROM tea_inventory WHERE inventory_id=? FOR UPDATE');$st->execute([$inventory]);$i=$st->fetch();if(!$i)fail('Inventory not found',404);if($i['available_bags']<$bags)fail('Not enough available bags');$st=$pdo->prepare('SELECT * FROM warehouse_locations WHERE location_id=? FOR UPDATE');$st->execute([$location]);$l=$st->fetch();if(!$l)fail('Location not found',404);if($l['status']==='BLOCKED'||!empty($l['blocked'])||!empty($l['reserved'])||isset($l['active'])&&(int)$l['active']!==1||(locationBagCapacity($l)-$l['occupied_bags'])<$bags)fail('Location is unavailable or does not have enough capacity');$bagWeight=isset($i['bag_weight'])&&$i['bag_weight']!==null?(float)$i['bag_weight']:null;if($bagWeight!==null&&$bagWeight>=50&&$bagWeight<=65&&!in_array((string)($l['level_code']??''),['A','B','C'],true))fail('Cannot allocate '.$bagWeight.'kg package to Level '.($l['level_code']??'?').'. Allowed levels: A, B, C.');if($bagWeight!==null&&isset($l['max_weight_capacity'],$l['current_weight'])&&((float)$l['current_weight']+$bagWeight*$bags)>(float)$l['max_weight_capacity'])fail('Location weight capacity would be exceeded');$pdo->prepare('INSERT INTO inventory_locations(inventory_id,location_id,bags_allocated,allocation_type,allocated_by) VALUES(?,?,?,?,?)')->execute([$inventory,$location,$bags,($d['allocation_type']??'MANUAL'),$u['user_id']]);$newAvail=$i['available_bags']-$bags;$newAlloc=$i['allocated_bags']+$bags;$status=$newAvail===0?'STORED':'PARTIALLY_ALLOCATED';$pdo->prepare('UPDATE tea_inventory SET available_bags=?,allocated_bags=?,status=? WHERE inventory_id=?')->execute([$newAvail,$newAlloc,$status,$inventory]);$newOcc=$l['occupied_bags']+$bags;$newStatus=$newOcc>=locationBagCapacity($l)?'FULL':'PARTIAL';$newWeight=(float)($l['current_weight']??0)+(($bagWeight??0)*$bags);$pdo->prepare('UPDATE warehouse_locations SET occupied_bags=?,current_weight=?,status=? WHERE location_id=?')->execute([$newOcc,$newWeight,$newStatus,$location]);$pdo->commit();logActivity('ALLOCATE','WAREHOUSE',"Allocated {$bags} bags to location {$l['location_code']}");ok(['remaining_bags'=>$newAvail]);}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();fail($e->getMessage(),400);}
case 'recommend':
    requireLogin();$bags=max(1,intParam('bags',10));$st=db()->prepare("SELECT wl.*,r.rack_code,r.rack_name,(GREATEST(0,LEAST(wl.capacity_bags,10)-wl.occupied_bags)) available_capacity FROM warehouse_locations wl JOIN racks r ON r.rack_id=wl.rack_id WHERE wl.status<>'BLOCKED' AND LEAST(wl.capacity_bags,10)-wl.occupied_bags>=? ORDER BY (LEAST(wl.capacity_bags,10)-wl.occupied_bags) ASC,r.rack_code,wl.location_number LIMIT 20");$st->execute([$bags]);ok($st->fetchAll());
case 'ai_recommend':
    requireLogin();
    $pdo = db();
    $bags = max(1, intParam('bags', 10));
    $inventoryId = intParam('inventory_id', 0);

    $sourceLot = null;
    if ($inventoryId) {
        $st = $pdo->prepare('SELECT i.*, pt.packing_name FROM tea_inventory i LEFT JOIN packing_types pt ON pt.packing_type_id=i.packing_type_id WHERE i.inventory_id=?');
        $st->execute([$inventoryId]);
        $sourceLot = $st->fetch();
        if (!$sourceLot) fail('Inventory lot not found', 404);
        if ($bags > (int)$sourceLot['available_bags']) fail('Requested bags exceed available bags on this lot');
    }

    // Candidate locations with enough free capacity.
    $st = $pdo->prepare("SELECT wl.*, r.rack_code, r.rack_name,
            (GREATEST(0,LEAST(wl.capacity_bags,10) - wl.occupied_bags)) AS available_capacity
        FROM warehouse_locations wl
        JOIN racks r ON r.rack_id = wl.rack_id
        WHERE wl.status <> 'BLOCKED' AND wl.active=1 AND wl.blocked=0 AND wl.reserved=0
          AND (LEAST(wl.capacity_bags,10) - wl.occupied_bags) >= ?
          AND (? IS NULL OR (wl.max_weight_capacity - wl.current_weight) >= (? * ?))
          AND (? IS NULL OR ? < 50 OR ? > 65 OR wl.level_code IN ('A','B','C'))
        ORDER BY wl.location_id");
    $bagWeight = $sourceLot && $sourceLot['bag_weight'] !== null ? (float)$sourceLot['bag_weight'] : null;
    $st->execute([$bags,$bagWeight,$bagWeight,$bags,$bagWeight,$bagWeight,$bagWeight]);
    $candidates = $st->fetchAll();
    if (!$candidates) ok([], 'No locations currently have enough free capacity for this quantity');

    // What's already sitting in each candidate location (for consolidation scoring).
    $locIds = array_column($candidates, 'location_id');
    $placeholders = implode(',', array_fill(0, count($locIds), '?'));
    $st = $pdo->prepare("SELECT il.location_id, i.tea_type_id, i.grade_id, i.lot_number
        FROM inventory_locations il
        JOIN tea_inventory i ON i.inventory_id = il.inventory_id
        WHERE il.location_id IN ($placeholders)");
    $st->execute($locIds);
    $contents = [];
    foreach ($st->fetchAll() as $row) {
        $contents[$row['location_id']][] = $row;
    }

    // Rack-level utilization for load-balancing.
    $rackStats = $pdo->query('SELECT rack_id, SUM(LEAST(capacity_bags,10)) cap, SUM(occupied_bags) occ FROM warehouse_locations GROUP BY rack_id')->fetchAll();
    $rackUtil = [];
    foreach ($rackStats as $r) {
        $rackUtil[$r['rack_id']] = $r['cap'] > 0 ? $r['occ'] / $r['cap'] : 0;
    }

    $scored = [];
    foreach ($candidates as $loc) {
        $available = (int)$loc['available_capacity'];

        // 1) Fit score: reward locations where this quantity leaves little wasted space.
        $waste = $available - $bags;
        $fitScore = 1 - ($waste / max($available, 1));
        $fitScore = max(0, min(1, $fitScore));

        // 2) Consolidation score: prefer placing stock next to the same tea type/grade,
        //    stay neutral on empty locations, penalize mixing different tea in one slot.
        $here = $contents[$loc['location_id']] ?? [];
        if (!$here) {
            $consolidationScore = 0.5;
            $consolidationNote = 'empty location';
        } elseif ($sourceLot && $here[0]['tea_type_id'] == $sourceLot['tea_type_id'] && $here[0]['grade_id'] == $sourceLot['grade_id']) {
            $consolidationScore = 1.0;
            $consolidationNote = 'already holds the same tea type & grade';
        } elseif (!$sourceLot) {
            $consolidationScore = 0.5;
            $consolidationNote = 'already occupied';
        } else {
            $consolidationScore = 0.0;
            $consolidationNote = 'holds a different tea type/grade';
        }

        // 3) Balance score: prefer racks that are, overall, less full — spreads load
        //    instead of piling everything into one rack.
        $util = $rackUtil[$loc['rack_id']] ?? 0;
        $balanceScore = 1 - $util;

        $total = (0.4 * $fitScore) + (0.35 * $consolidationScore) + (0.25 * $balanceScore);

        $reasons = [];
        if ($fitScore >= 0.8) $reasons[] = 'tight fit, minimal wasted space';
        elseif ($fitScore < 0.4) $reasons[] = 'leaves a lot of unused capacity';
        $reasons[] = $consolidationNote;
        if ($balanceScore >= 0.7) $reasons[] = 'rack is under-utilized (' . round($util * 100) . '% full)';
        elseif ($balanceScore < 0.3) $reasons[] = 'rack is heavily utilized (' . round($util * 100) . '% full)';

        $scored[] = [
            'location_id' => (int)$loc['location_id'],
            'location_code' => $loc['location_code'],
            'rack_code' => $loc['rack_code'],
            'rack_name' => $loc['rack_name'],
            'status' => $loc['status'],
            'capacity_bags' => locationBagCapacity($loc),
            'occupied_bags' => (int)$loc['occupied_bags'],
            'available_capacity' => $available,
            'score' => round($total * 100, 1),
            'fit_score' => round($fitScore * 100, 1),
            'consolidation_score' => round($consolidationScore * 100, 1),
            'balance_score' => round($balanceScore * 100, 1),
            'rack_utilization_pct' => round($util * 100, 1),
            'reason' => ucfirst(implode('; ', $reasons)) . '.',
        ];
    }

    usort($scored, fn($a, $b) => $b['score'] <=> $a['score']);
    ok(array_slice($scored, 0, 10));
case 'movement_list': requireLogin(); $st=db()->query("SELECT sm.*,i.lot_number,wl.location_code,u.username FROM stock_movements sm JOIN tea_inventory i ON i.inventory_id=sm.inventory_id LEFT JOIN warehouse_locations wl ON wl.location_id=sm.location_id LEFT JOIN users u ON u.user_id=sm.created_by ORDER BY sm.movement_id DESC LIMIT 200");ok($st->fetchAll());
case 'movement_create':
    $u=requireRole(['ADMIN','MANAGER','WAREHOUSE_STAFF']);$d=body();$inventory=(int)($d['inventory_id']??0);$qty=(int)($d['quantity_bags']??$d['bags']??0);$type=strtoupper((string)($d['movement_type']??'IN'));if(!$inventory||$qty<=0)fail('inventory_id and quantity_bags are required');$pdo=db();$pdo->beginTransaction();try{$st=$pdo->prepare('SELECT * FROM tea_inventory WHERE inventory_id=? FOR UPDATE');$st->execute([$inventory]);$i=$st->fetch();if(!$i)fail('Inventory not found',404);$delta=$type==='OUT'?- $qty:$qty;if($delta<0&&$i['available_bags']<$qty)fail('Insufficient available stock');$new=max(0,$i['available_bags']+$delta);$pdo->prepare('INSERT INTO stock_movements(inventory_id,location_id,movement_type,quantity_bags,reference_no,notes,created_by) VALUES(?,?,?,?,?,?,?)')->execute([$inventory,$d['location_id']??null,$type,$qty,$d['reference_no']??null,$d['notes']??null,$u['user_id']]);$pdo->prepare('UPDATE tea_inventory SET available_bags=? WHERE inventory_id=?')->execute([$new,$inventory]);$pdo->commit();logActivity('MOVEMENT','INVENTORY',"{$type} {$qty} bags for {$i['lot_number']}");ok(['available_bags'=>$new]);}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();fail($e->getMessage(),400);}
case 'dispatch_list': requireLogin(); ok(db()->query("SELECT d.*,u.username FROM dispatches d LEFT JOIN users u ON u.user_id=d.created_by ORDER BY d.dispatch_id DESC LIMIT 200")->fetchAll());
case 'dispatch_create':
    $u=requireRole(['ADMIN','MANAGER','WAREHOUSE_STAFF']);$d=body();$invoice=trim((string)($d['invoice_no']??''));$bags=(int)($d['bags']??0);if($invoice===''||$bags<=0)fail('invoice_no and bags are required');$pdo=db();$pdo->beginTransaction();try{$st=$pdo->prepare("SELECT * FROM tea_inventory WHERE lot_number=? OR lot_number LIKE ? LIMIT 1 FOR UPDATE");$st->execute([$invoice,$invoice.'%']);$i=$st->fetch();if(!$i)fail('Inventory/invoice not found',404);if($i['available_bags']<$bags)fail('Insufficient available bags');$pdo->prepare('INSERT INTO dispatches(invoice_no,buyer,delivery_order_no,bags,vehicle_no,dispatch_date,status,created_by) VALUES(?,?,?,?,?,?,?,?)')->execute([$invoice,$d['buyer']??null,$d['delivery_order_no']??null,$bags,$d['vehicle_no']??null,$d['dispatch_date']??date('Y-m-d'),'DISPATCHED',$u['user_id']]);$pdo->prepare('UPDATE tea_inventory SET available_bags=available_bags-?,status=IF(available_bags-?=0,\'SOLD\',status) WHERE inventory_id=?')->execute([$bags,$bags,$i['inventory_id']]);$pdo->prepare('INSERT INTO stock_movements(inventory_id,movement_type,quantity_bags,reference_no,notes,created_by) VALUES(?,?,?,?,?,?)')->execute([$i['inventory_id'],'OUT',$bags,$invoice,'Dispatch',$u['user_id']]);$pdo->commit();logActivity('DISPATCH','WAREHOUSE',"Dispatched {$bags} bags for {$invoice}");ok([],'Dispatch created');}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();fail($e->getMessage(),400);}
case 'reports_inventory': requirePermission('warehousing.reports');$rows=db()->query("SELECT t.tea_name,g.grade_code,SUM(i.total_bags) total_bags,SUM(i.available_bags) available_bags,SUM(i.allocated_bags) allocated_bags,COUNT(*) lots FROM tea_inventory i JOIN tea_types t ON t.tea_type_id=i.tea_type_id LEFT JOIN tea_grades g ON g.grade_id=i.grade_id GROUP BY t.tea_type_id,g.grade_id ORDER BY t.tea_name,g.grade_code")->fetchAll();ok($rows);
case 'reports_warehouse': requirePermission('warehousing.reports');$rows=db()->query("SELECT r.rack_code,COUNT(wl.location_id) locations,SUM(LEAST(wl.capacity_bags,10)) capacity_bags,SUM(wl.occupied_bags) occupied_bags,SUM(GREATEST(0,LEAST(wl.capacity_bags,10)-wl.occupied_bags)) free_bags FROM racks r LEFT JOIN warehouse_locations wl ON wl.rack_id=r.rack_id GROUP BY r.rack_id ORDER BY r.rack_code")->fetchAll();ok($rows);
case 'reports_movements': requirePermission('warehousing.reports');$rows=db()->query("SELECT DATE(created_at) movement_date,movement_type,SUM(quantity_bags) bags,COUNT(*) transactions FROM stock_movements GROUP BY DATE(created_at),movement_type ORDER BY movement_date DESC LIMIT 90")->fetchAll();ok($rows);
case 'reports_invoice_register':
    requirePermission('warehousing.reports');
    $q=trim((string)($_GET['q']??''));$from=trim((string)($_GET['from']??''));$to=trim((string)($_GET['to']??''));
    $sql="SELECT wi.invoice_id,wi.invoice_date,wi.invoice_no,wi.mark,wi.selling_mark,wi.grade,wi.packing_type,wi.broker,wi.chests,wi.net_weight_each,wi.total_net_weight,wi.total_gross_weight,wi.allocation_model,wi.allocation_score,COALESCE(GROUP_CONCAT(CONCAT(wl.location_code,' (',ila.chests_allocated,')') ORDER BY wl.location_code SEPARATOR ', '),wi.location_code) allocated_locations FROM warehouse_invoices wi LEFT JOIN invoice_location_allocations ila ON ila.invoice_id=wi.invoice_id LEFT JOIN warehouse_locations wl ON wl.location_id=ila.location_id WHERE 1=1";$p=[];
    if($from!==''){$sql.=' AND wi.invoice_date>=?';$p[]=$from;}if($to!==''){$sql.=' AND wi.invoice_date<=?';$p[]=$to;}if($q!==''){$like="%$q%";$sql.=' AND (wi.invoice_no LIKE ? OR wi.mark LIKE ? OR wi.grade LIKE ? OR wi.broker LIKE ? OR wi.packing_type LIKE ?)';$p=array_merge($p,[$like,$like,$like,$like,$like]);}
    $sql.=' GROUP BY wi.invoice_id ORDER BY wi.invoice_date DESC,wi.invoice_id DESC LIMIT 1000';$st=db()->prepare($sql);$st->execute($p);ok($st->fetchAll());
case 'reports_daily_arrivals':
    requirePermission('warehousing.reports');
    $rows=db()->query("SELECT invoice_date,COALESCE(NULLIF(broker,''),'(Not set)') broker,COUNT(*) invoices,SUM(chests) chests,ROUND(SUM(total_net_weight),2) total_net_weight FROM warehouse_invoices GROUP BY invoice_date,broker ORDER BY invoice_date DESC,broker LIMIT 365")->fetchAll();ok($rows);
case 'permissions_get':
    requireRole(['ADMIN']);
    echo json_encode(['success'=>true,'permissions'=>db()->query('SELECT role,page_key,has_access FROM role_permissions ORDER BY role,page_key')->fetchAll()]); exit;
case 'permissions_check':
    $u=requireLogin();$page=trim((string)($_GET['page_key']??''));
    if($page==='')fail('page_key is required');
    echo json_encode(['success'=>true,'hasAccess'=>hasPermission($u,$page),'permission_key'=>$page]); exit;
case 'permissions_current':
    $u=requireLogin();
    try {
        $rows=db()->query("SELECT permission_key,module_name,group_name,permission_label,route_path,sort_order FROM permission_catalog WHERE active=1 ORDER BY sort_order,permission_label")->fetchAll();
        foreach($rows as &$row){$row['has_access']=hasPermission($u,$row['permission_key']);}
        unset($row);
        ok(['role'=>$u['role'],'permissions'=>$rows]);
    } catch(Throwable $e) {
        // Compatibility before migration: return broad module permissions only.
        $rows=[];foreach(['brokering.home'=>'brokering','warehousing.home'=>'warehousing','master.access_manager'=>'master'] as $key=>$base){$rows[]=['permission_key'=>$key,'has_access'=>hasPermission($u,$base)];}
        ok(['role'=>$u['role'],'permissions'=>$rows]);
    }
case 'permissions_users':
    $actor=requireRole(['ADMIN','MANAGER']);
    if($actor['role']==='MANAGER'){
        $st=db()->query("SELECT user_id,username,full_name,email,role,status FROM users WHERE role NOT IN ('ADMIN','MANAGER') ORDER BY full_name,username");
    }else{
        $st=db()->query("SELECT user_id,username,full_name,email,role,status FROM users ORDER BY FIELD(role,'ADMIN','MANAGER','WAREHOUSE_STAFF','BROKER'),full_name,username");
    }
    ok($st->fetchAll());
case 'permissions_catalog':
    requireRole(['ADMIN','MANAGER']);
    ok(db()->query("SELECT permission_key,module_name,group_name,permission_label,route_path,sort_order FROM permission_catalog WHERE active=1 ORDER BY module_name,group_name,sort_order,permission_label")->fetchAll());
case 'permissions_user_get':
    $actor=requireRole(['ADMIN','MANAGER']);$targetId=(int)($_GET['user_id']??0);if(!$targetId)fail('user_id is required');
    $st=db()->prepare('SELECT user_id,username,full_name,email,role,status FROM users WHERE user_id=?');$st->execute([$targetId]);$target=$st->fetch();if(!$target)fail('User not found',404);
    if(!canManageTargetUser($actor,$target) && $actor['role']!=='ADMIN')fail('Managers can only manage Warehouse Staff or Broker users',403);
    $catalog=db()->query("SELECT permission_key,module_name,group_name,permission_label,route_path,sort_order FROM permission_catalog WHERE active=1 ORDER BY module_name,group_name,sort_order,permission_label")->fetchAll();
    $ov=db()->prepare('SELECT permission_key,has_access,granted_by,updated_at FROM user_permissions WHERE user_id=?');$ov->execute([$targetId]);$overrides=[];foreach($ov->fetchAll() as $r){$overrides[$r['permission_key']]=$r;}
    $targetAuth=['user_id'=>(int)$target['user_id'],'username'=>$target['username'],'display_name'=>$target['full_name'],'role'=>$target['role']];
    foreach($catalog as &$row){$row['has_access']=hasPermission($targetAuth,$row['permission_key']);$row['is_override']=isset($overrides[$row['permission_key']]);$row['override_value']=isset($overrides[$row['permission_key']])?(bool)$overrides[$row['permission_key']]['has_access']:null;}unset($row);
    ok(['user'=>$target,'permissions'=>$catalog]);
case 'permissions_user_update':
    $actor=requireRole(['ADMIN','MANAGER']);$d=body();$targetId=(int)($d['user_id']??0);$key=trim((string)($d['permission_key']??''));$access=!empty($d['has_access'])?1:0;if(!$targetId||$key==='')fail('user_id and permission_key are required');
    $st=db()->prepare('SELECT user_id,username,full_name,email,role,status FROM users WHERE user_id=?');$st->execute([$targetId]);$target=$st->fetch();if(!$target)fail('User not found',404);
    if(!canManageTargetUser($actor,$target) && $actor['role']!=='ADMIN')fail('Managers can only manage Warehouse Staff or Broker users',403);
    if($target['role']==='ADMIN')fail('Administrator permissions are always full access and cannot be overridden',400);
    if($key==='master.access_manager' && !in_array($target['role'],['ADMIN','MANAGER'],true))fail('Access Manager can only be assigned to an Admin or Manager',400);
    $cat=db()->prepare('SELECT permission_key FROM permission_catalog WHERE permission_key=? AND active=1');$cat->execute([$key]);if(!$cat->fetch())fail('Unknown permission key',400);
    $up=db()->prepare('INSERT INTO user_permissions(user_id,permission_key,has_access,granted_by) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE has_access=VALUES(has_access),granted_by=VALUES(granted_by),updated_at=CURRENT_TIMESTAMP');$up->execute([$targetId,$key,$access,$actor['user_id']]);
    logActivity('PERMISSION','ACCESS',"Set {$key}=".$access." for user #{$targetId}");
    ok(['user_id'=>$targetId,'permission_key'=>$key,'has_access'=>(bool)$access],'User access updated');
case 'permissions_user_reset':
    $actor=requireRole(['ADMIN','MANAGER']);$d=body();$targetId=(int)($d['user_id']??0);if(!$targetId)fail('user_id is required');
    $st=db()->prepare('SELECT user_id,username,full_name,email,role,status FROM users WHERE user_id=?');$st->execute([$targetId]);$target=$st->fetch();if(!$target)fail('User not found',404);if(!canManageTargetUser($actor,$target) && $actor['role']!=='ADMIN')fail('Managers can only manage Warehouse Staff or Broker users',403);
    db()->prepare('DELETE FROM user_permissions WHERE user_id=?')->execute([$targetId]);logActivity('PERMISSION','ACCESS',"Reset user access for #{$targetId}");ok([],'User access reset to role defaults');
case 'permissions_update':
    requireRole(['ADMIN']);$d=body();$role=(string)($d['role']??'');$page=(string)($d['page_key']??'');$access=(int)!empty($d['has_access']);if($role===''||$page==='')fail('role and page_key are required');$st=db()->prepare('INSERT INTO role_permissions(role,page_key,has_access) VALUES(?,?,?) ON DUPLICATE KEY UPDATE has_access=VALUES(has_access)');$st->execute([$role,$page,$access]);ok([],'Role permission updated');
case 'users_list':
    requirePermission('master.user_account');
    ok(db()->query("SELECT user_id,username,full_name,email,role,status,created_at FROM users ORDER BY user_id DESC")->fetchAll());
case 'users_create':
    $actor=requirePermission('master.user_account');$d=body();$username=trim((string)($d['username']??''));$name=trim((string)($d['full_name']??''));$email=trim((string)($d['email']??''));$password=(string)($d['password']??'');$role=strtoupper(trim((string)($d['role']??'WAREHOUSE_STAFF')));
    if($username===''||$name===''||$email===''||$password==='')fail('username, full_name, email and password are required');if(!in_array($role,['ADMIN','MANAGER','WAREHOUSE_STAFF','BROKER'],true))fail('Invalid role');if($actor['role']==='MANAGER'&&in_array($role,['ADMIN','MANAGER'],true))fail('Managers can only create Warehouse Staff or Broker users',403);
    $hash=password_hash($password,PASSWORD_DEFAULT);$st=db()->prepare("INSERT INTO users(username,full_name,email,password_hash,role,status) VALUES(?,?,?,?,?,'ACTIVE')");try{$st->execute([$username,$name,$email,$hash,$role]);}catch(Throwable $e){fail($e->getCode()==='23000'?'Username or email already exists':$e->getMessage(),400);}logActivity('CREATE','USER',"Created user {$username}");ok(['user_id'=>(int)db()->lastInsertId()],'User created');
case 'users_update':
    $actor=requirePermission('master.user_account');$d=body();$id=(int)($d['user_id']??0);if(!$id)fail('user_id is required');$st=db()->prepare('SELECT user_id,username,full_name,email,role,status FROM users WHERE user_id=?');$st->execute([$id]);$target=$st->fetch();if(!$target)fail('User not found',404);if($actor['role']==='MANAGER'&&!canManageTargetUser($actor,$target))fail('Managers can only update Warehouse Staff or Broker users',403);
    $role=strtoupper(trim((string)($d['role']??$target['role'])));if($actor['role']==='MANAGER'&&in_array($role,['ADMIN','MANAGER'],true))fail('Managers cannot assign Admin or Manager roles',403);$status=strtoupper(trim((string)($d['status']??$target['status'])));if(!in_array($status,['ACTIVE','INACTIVE'],true))fail('Invalid status');
    $fields=['full_name'=>$d['full_name']??$target['full_name'],'email'=>($d['email']??$target['email'])?:null,'role'=>$role,'status'=>$status];$params=[$fields['full_name'],$fields['email'],$fields['role'],$fields['status']];$sql='UPDATE users SET full_name=?,email=?,role=?,status=?';if(!empty($d['password'])){$sql.=',password_hash=?';$params[]=password_hash((string)$d['password'],PASSWORD_DEFAULT);}$sql.=' WHERE user_id=?';$params[]=$id;db()->prepare($sql)->execute($params);logActivity('UPDATE','USER',"Updated user #{$id}");ok([],'User updated');
case 'meta': requireLogin(); ok(['tea_types'=>db()->query('SELECT * FROM tea_types ORDER BY tea_name')->fetchAll(),'grades'=>db()->query('SELECT * FROM tea_grades ORDER BY grade_code')->fetchAll(),'suppliers'=>db()->query('SELECT * FROM suppliers WHERE status=\'ACTIVE\' ORDER BY supplier_name')->fetchAll(),'marks'=>db()->query('SELECT * FROM marks WHERE status=\'ACTIVE\' ORDER BY mark_name')->fetchAll(),'packing_types'=>db()->query('SELECT * FROM packing_types WHERE status=\'ACTIVE\' ORDER BY packing_name')->fetchAll()]);
case 'marks_list': requireLogin(); ok(db()->query("SELECT * FROM marks WHERE status='ACTIVE' ORDER BY mark_name")->fetchAll());
case 'marks_create':
    $u=requirePermission('master.mark');$d=body();$code=trim((string)($d['mark_code']??$d['code']??''));$name=trim((string)($d['mark_name']??$d['name']??''));if($code==='')fail('Mark code is required');if($name==='')$name=$code;$st=db()->prepare('INSERT INTO marks(mark_code,mark_name) VALUES(?,?)');try{$st->execute([$code,$name]);}catch(Throwable $e){fail($e->getCode()==='23000'?'That mark already exists':$e->getMessage(),400);}logActivity('CREATE','MASTER',"Added mark {$code}");ok(['mark_id'=>(int)db()->lastInsertId()],'Mark added');
case 'packing_list': requireLogin(); ok(db()->query("SELECT * FROM packing_types WHERE status='ACTIVE' ORDER BY packing_name")->fetchAll());
case 'packing_create':
    $u=requirePermission('master.packing_type');$d=body();$code=trim((string)($d['packing_code']??$d['code']??''));$name=trim((string)($d['packing_name']??$d['name']??''));if($code==='')fail('Packing type code is required');if($name==='')$name=$code;$st=db()->prepare('INSERT INTO packing_types(packing_code,packing_name) VALUES(?,?)');try{$st->execute([$code,$name]);}catch(Throwable $e){fail($e->getCode()==='23000'?'That packing type already exists':$e->getMessage(),400);}logActivity('CREATE','MASTER',"Added packing type {$code}");ok(['packing_type_id'=>(int)db()->lastInsertId()],'Packing type added');
case 'grade_create':
    $u=requirePermission('master.grade');$d=body();$code=trim((string)($d['grade_code']??$d['code']??''));$name=trim((string)($d['grade_name']??$d['name']??''));if($code==='')fail('Grade code is required');if($name==='')$name=$code;$st=db()->prepare('INSERT INTO tea_grades(grade_code,grade_name) VALUES(?,?)');try{$st->execute([$code,$name]);}catch(Throwable $e){fail($e->getCode()==='23000'?'That grade already exists':$e->getMessage(),400);}logActivity('CREATE','MASTER',"Added grade {$code}");ok(['grade_id'=>(int)db()->lastInsertId()],'Grade added');
case 'grn_create':
    $u=requirePermission('warehousing.grn_add_edit');$d=body();$no=trim((string)($d['grn_no']??''));if($no==='')$no='GRN-'.date('YmdHis');$st=db()->prepare('INSERT INTO grns(grn_no,grn_date,vehicle_no,supplier,chests,remarks,created_by) VALUES(?,?,?,?,?,?,?)');$st->execute([$no,$d['date']??date('Y-m-d'),$d['vehicleNo']??null,$d['supplier']??null,(int)($d['chests']??0),$d['remarks']??null,$u['user_id']]);logActivity('CREATE','GRN',$no);ok(['grn_no'=>$no]);
case 'gin_create':
    $u=requirePermission('warehousing.gin_add');$d=body();$no=trim((string)($d['gin_no']??''));if($no==='')$no='GIN-'.date('YmdHis');$st=db()->prepare('INSERT INTO gins(gin_no,gin_date,buyer,invoice_no,chests,created_by) VALUES(?,?,?,?,?,?)');$st->execute([$no,$d['date']??date('Y-m-d'),$d['buyer']??null,$d['invoiceNo']??null,(int)($d['chests']??0),$u['user_id']]);logActivity('CREATE','GIN',$no);ok(['gin_no'=>$no]);
case 'invoice_ai_recommend':
    requireAnyPermission(['warehousing.invoice_add','warehousing.invoice_edit','warehousing.ai_allocation']);
    $d = $method === 'POST' ? body() : $_GET;
    $result = recommendInvoiceLocations($d, 12);
    if (!$result['candidates']) {
        ok($result, 'No safe location candidates are available for the entered details');
    }
    ok($result, $result['can_allocate'] ? 'AI allocation plan ready' : 'Only a partial allocation plan is currently possible');
case 'invoice_create':
    $u=requirePermission('warehousing.invoice_add');
    $d=body();
    $no=trim((string)($d['invoiceNo']??''));
    $chests=max(0,(int)($d['chests']??0));
    $netEachRaw=$d['netWeightEach']??null;
    $netEach=($netEachRaw!==null&&$netEachRaw!=='')?(float)$netEachRaw:0.0;
    if($no==='')fail('Invoice number is required');
    if($chests<=0)fail('Chests must be greater than 0');
    if($netEach<=0)fail('Net Weight Each must be greater than 0 so net weight and safe location can be calculated');
    $totalNetWeight=round($chests*$netEach,2); // authoritative backend calculation
    $autoAllocate=!empty($d['autoAllocate']);
    $selectedLocation=(int)($d['locationId']??0);
    $recommendation=recommendInvoiceLocations($d, 8000);
    $plan=[];
    $allocationType='MANUAL';

    if($autoAllocate){
        if(!$recommendation['can_allocate']){
            fail('Automatic location allocation could not fit the full invoice safely. Remaining chests: '.(int)$recommendation['remaining_bags'],400,['recommendation'=>$recommendation]);
        }
        $plan=$recommendation['plan'];
        $allocationType='AI';
    }elseif($selectedLocation){
        $candidate=null;
        foreach($recommendation['candidates'] as $c){if((int)$c['location_id']===$selectedLocation){$candidate=$c;break;}}
        if(!$candidate)fail('Selected location does not pass the current capacity/safety rules');
        if((int)$candidate['usable_bags']<$chests)fail('Selected location cannot hold all chests. Enable AI Auto Allocate to split across safe locations.');
        $plan=[[ 'location_id'=>$candidate['location_id'],'location_code'=>$candidate['location_code'],'rack_code'=>$candidate['rack_code'],'level_code'=>$candidate['level_code'],'chests_allocated'=>$chests,'weight_allocated'=>$totalNetWeight,'score'=>$candidate['score'],'reason'=>$candidate['reason'] ]];
    }

    $primary=$plan[0]??null;
    $explanation=$primary ? ($primary['reason']??'') : null;
    $pdo=db();
    $pdo->beginTransaction();
    try{
        $st=$pdo->prepare('INSERT INTO warehouse_invoices(invoice_year,invoice_no,mark,selling_mark,grade,packing_type,chest_type,broker,chests,weight_per_chest,net_weight_each,total_net_weight,total_gross_weight,moisture_content,mfd_date,sample_drawn,reprint,exportable,colour_separated,store,invoice_date,location_id,location_code,allocation_score,allocation_model,allocation_explanation,allocation_type,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
        $st->execute([
            (int)($d['invoiceYear']??date('Y')),$no,$d['mark']??null,$d['sellingMark']??null,$d['grade']??null,
            $d['packingType']??null,$d['chestType']??null,$d['broker']??null,$chests,
            (float)($d['weightPerChest']??0),$netEach,$totalNetWeight,
            isset($d['totalGrossWeight'])&&$d['totalGrossWeight']!==''?(float)$d['totalGrossWeight']:null,
            isset($d['moistureContent'])&&$d['moistureContent']!==''?(float)$d['moistureContent']:null,
            $d['mfdDate']??null,!empty($d['sampleDrawn'])?1:0,!empty($d['reprint'])?1:0,!empty($d['exportable'])?1:0,!empty($d['colourSeparated'])?1:0,
            $d['store']??null,$d['date']??date('Y-m-d'),
            $primary['location_id']??null,$primary['location_code']??null,$primary['score']??null,
            $autoAllocate?($recommendation['model_version']??'INVOICE-WEIGHTED-2026.2'):($selectedLocation?'MANUAL':null),
            $explanation,$plan?$allocationType:null,$u['user_id']
        ]);
        $id=(int)$pdo->lastInsertId();
        if($plan){
            reserveInvoiceAllocation($pdo,$id,$plan,$recommendation['profile'],$u['user_id'],$allocationType);
        }
        if($autoAllocate && $primary){
            $pdo->prepare('INSERT INTO invoice_ai_recommendations(invoice_id,requested_chests,bag_weight,total_net_weight,recommended_location_id,score,allocation_plan_json,alternatives_json,explanation,rule_version,model_version,decision,final_location_id,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
                ->execute([$id,$chests,$netEach,$totalNetWeight,$primary['location_id'],$primary['score'],json_encode($plan),json_encode(array_slice($recommendation['candidates'],0,5)),$explanation,$recommendation['rule_version'],$recommendation['model_version'],'ACCEPTED',$primary['location_id'],$u['user_id']]);
        }
        $pdo->commit();
        logActivity('CREATE','INVOICE',$no.($plan?' | Auto allocated '.implode(', ',array_map(fn($x)=>$x['location_code'].' x'.$x['chests_allocated'],$plan)):' | Saved without allocation'));
        ok(['invoice_id'=>$id,'invoice_no'=>$no,'total_net_weight'=>$totalNetWeight,'allocation_plan'=>$plan,'model_version'=>$recommendation['model_version']??null],$plan?'Invoice saved and location allocated successfully':'Invoice saved successfully');
    }catch(Throwable $e){
        if($pdo->inTransaction())$pdo->rollBack();
        fail($e->getCode()==='23000'?'Invoice number already exists':$e->getMessage(),400);
    }
case 'invoice_list':
    requireAnyPermission(['warehousing.invoice_edit','warehousing.invoice_download','warehousing.inquiry','warehousing.reports']);
    $year=trim((string)($_GET['year']??''));
    $no=trim((string)($_GET['invoice_no']??''));
    $q=trim((string)($_GET['q']??''));
    $sql="SELECT wi.*,COALESCE(GROUP_CONCAT(CONCAT(wl.location_code,' (',ila.chests_allocated,')') ORDER BY wl.location_code SEPARATOR ', '),wi.location_code) allocated_locations,COALESCE(SUM(ila.chests_allocated),0) allocated_chests
          FROM warehouse_invoices wi
          LEFT JOIN invoice_location_allocations ila ON ila.invoice_id=wi.invoice_id
          LEFT JOIN warehouse_locations wl ON wl.location_id=ila.location_id
          WHERE 1=1";
    $p=[];
    if($year!==''){$sql.=' AND wi.invoice_year=?';$p[]=(int)$year;}
    if($no!==''){$sql.=' AND wi.invoice_no LIKE ?';$p[]="%$no%";}
    if($q!==''){$like="%$q%";$sql.=' AND (wi.invoice_no LIKE ? OR wi.mark LIKE ? OR wi.selling_mark LIKE ? OR wi.grade LIKE ? OR wi.packing_type LIKE ? OR wi.broker LIKE ? OR wi.store LIKE ? OR wi.location_code LIKE ? OR EXISTS(SELECT 1 FROM invoice_location_allocations qila JOIN warehouse_locations qwl ON qwl.location_id=qila.location_id WHERE qila.invoice_id=wi.invoice_id AND qwl.location_code LIKE ?))';$p=array_merge($p,[$like,$like,$like,$like,$like,$like,$like,$like,$like]);}
    $sql.=' GROUP BY wi.invoice_id ORDER BY wi.invoice_id DESC LIMIT 200';
    $st=db()->prepare($sql);$st->execute($p);ok($st->fetchAll());
case 'invoice_get':
    requireAnyPermission(['warehousing.invoice_edit','warehousing.invoice_download','warehousing.inquiry']);
    $id=intParam('id');$no=trim((string)($_GET['invoice_no']??''));if(!$id&&$no==='')fail('id or invoice_no is required');
    $sql="SELECT wi.*,COALESCE(GROUP_CONCAT(CONCAT(wl.location_code,' (',ila.chests_allocated,')') ORDER BY wl.location_code SEPARATOR ', '),wi.location_code) allocated_locations,COALESCE(SUM(ila.chests_allocated),0) allocated_chests
          FROM warehouse_invoices wi LEFT JOIN invoice_location_allocations ila ON ila.invoice_id=wi.invoice_id LEFT JOIN warehouse_locations wl ON wl.location_id=ila.location_id
          WHERE ".($id?'wi.invoice_id=?':'wi.invoice_no=?')." GROUP BY wi.invoice_id";
    $st=db()->prepare($sql);$st->execute([$id?:$no]);$row=$st->fetch();if(!$row)fail('Invoice not found',404);ok($row);
case 'invoice_update':
    $u=requirePermission('warehousing.invoice_edit');$d=body();$id=(int)($d['invoice_id']??$d['invoiceId']??0);if(!$id)fail('invoice_id is required');
    $curSt=db()->prepare('SELECT * FROM warehouse_invoices WHERE invoice_id=?');$curSt->execute([$id]);$cur=$curSt->fetch();if(!$cur)fail('Invoice not found',404);
    $map=['invoiceYear'=>'invoice_year','mark'=>'mark','sellingMark'=>'selling_mark','grade'=>'grade','packingType'=>'packing_type','chestType'=>'chest_type','broker'=>'broker','chests'=>'chests','weightPerChest'=>'weight_per_chest','netWeightEach'=>'net_weight_each','totalGrossWeight'=>'total_gross_weight','moistureContent'=>'moisture_content','mfdDate'=>'mfd_date','store'=>'store','date'=>'invoice_date'];
    $sets=[];$params=[];
    foreach($map as $k=>$col){if(array_key_exists($k,$d)){$sets[]="$col=?";$val=$d[$k];$params[]=($val==='')?null:$val;}}
    foreach(['sampleDrawn'=>'sample_drawn','reprint'=>'reprint','exportable'=>'exportable','colourSeparated'=>'colour_separated'] as $k=>$col){if(array_key_exists($k,$d)){$sets[]="$col=?";$params[]=!empty($d[$k])?1:0;}}
    if(array_key_exists('chests',$d)||array_key_exists('netWeightEach',$d)){
        $calcChests=(int)($d['chests']??$cur['chests']);$calcEach=(float)($d['netWeightEach']??$cur['net_weight_each']??0);$sets[]='total_net_weight=?';$params[]=round($calcChests*$calcEach,2);
    }
    if(!$sets)fail('No fields to update');
    $params[]=$id;$st=db()->prepare('UPDATE warehouse_invoices SET '.implode(',',$sets).' WHERE invoice_id=?');$st->execute($params);
    logActivity('UPDATE','INVOICE','Updated invoice #'.$id);ok([],'Invoice updated');
case 'invoice_location_allocate':
    $u=requireAnyPermission(['warehousing.invoice_add','warehousing.invoice_edit','warehousing.ai_allocation']);$d=body();$id=(int)($d['invoice_id']??$d['invoiceId']??0);$loc=(int)($d['location_id']??$d['locationId']??0);
    if(!$id||!$loc)fail('invoice_id and location_id are required');
    $pdo=db();$pdo->beginTransaction();
    try{
        $li=$pdo->prepare('SELECT * FROM warehouse_invoices WHERE invoice_id=? FOR UPDATE');$li->execute([$id]);$inv=$li->fetch();if(!$inv)throw new RuntimeException('Invoice not found');
        $input=['chests'=>$inv['chests'],'netWeightEach'=>$inv['net_weight_each'],'weightPerChest'=>$inv['weight_per_chest'],'grade'=>$inv['grade'],'packingType'=>$inv['packing_type'],'mark'=>$inv['mark']];
        $rec=recommendInvoiceLocations($input,8000);$candidate=null;foreach($rec['candidates'] as $c){if((int)$c['location_id']===$loc){$candidate=$c;break;}}
        if(!$candidate)throw new RuntimeException('Selected location does not pass capacity/safety rules');
        if((int)$candidate['usable_bags']<(int)$inv['chests'])throw new RuntimeException('Selected location cannot hold all chests');
        releaseInvoiceAllocations($pdo,$id);
        $plan=[[ 'location_id'=>$candidate['location_id'],'location_code'=>$candidate['location_code'],'rack_code'=>$candidate['rack_code'],'level_code'=>$candidate['level_code'],'chests_allocated'=>(int)$inv['chests'],'weight_allocated'=>(float)$inv['total_net_weight'],'score'=>$candidate['score'],'reason'=>$candidate['reason'] ]];
        reserveInvoiceAllocation($pdo,$id,$plan,$rec['profile'],$u['user_id'],'MANUAL');
        $pdo->prepare('UPDATE warehouse_invoices SET location_id=?,location_code=?,allocation_score=?,allocation_model=?,allocation_explanation=?,allocation_type=? WHERE invoice_id=?')->execute([$loc,$candidate['location_code'],$candidate['score'],'MANUAL',$candidate['reason'],'MANUAL',$id]);
        $pdo->commit();
        logActivity('ALLOCATE','INVOICE',"Allocated location {$candidate['location_code']} to invoice {$inv['invoice_no']}");
        ok(['location_id'=>$loc,'location_code'=>$candidate['location_code']],'Location allocated');
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();fail($e->getMessage(),400);}
case 'location_unallocate':
    $u=requireRole(['ADMIN','MANAGER','WAREHOUSE_STAFF']);$d=body();$id=(int)($d['location_id']??0);if(!$id)fail('location_id is required');
    $pdo=db();$pdo->beginTransaction();
    try{
        $lst=$pdo->prepare('SELECT * FROM warehouse_locations WHERE location_id=? FOR UPDATE');$lst->execute([$id]);$loc=$lst->fetch();
        if(!$loc){$pdo->rollBack();fail('Location not found',404);}
        $ilst=$pdo->prepare('SELECT * FROM inventory_locations WHERE location_id=?');$ilst->execute([$id]);$allocs=$ilst->fetchAll();
        foreach($allocs as $a){
            $ist=$pdo->prepare('SELECT * FROM tea_inventory WHERE inventory_id=? FOR UPDATE');$ist->execute([$a['inventory_id']]);$inv=$ist->fetch();
            if($inv){
                $newAvail=$inv['available_bags']+$a['bags_allocated'];$newAlloc=max(0,$inv['allocated_bags']-$a['bags_allocated']);
                $status=$newAlloc===0?'RECEIVED':'PARTIALLY_ALLOCATED';
                $pdo->prepare('UPDATE tea_inventory SET available_bags=?,allocated_bags=?,status=? WHERE inventory_id=?')->execute([$newAvail,$newAlloc,$status,$inv['inventory_id']]);
            }
            $pdo->prepare('DELETE FROM inventory_locations WHERE allocation_id=?')->execute([$a['allocation_id']]);
        }
        $pdo->prepare('UPDATE warehouse_locations SET occupied_bags=0,status=? WHERE location_id=?')->execute([$loc['status']==='BLOCKED'?'BLOCKED':'EMPTY',$id]);
        $pdo->prepare('UPDATE warehouse_invoices SET location_id=NULL,location_code=NULL WHERE location_id=?')->execute([$id]);
        $pdo->commit();
        logActivity('UNALLOCATE','WAREHOUSE',"Released location {$loc['location_code']}");
        ok([],'Location released');
    }catch(Throwable $e){ if($pdo->inTransaction())$pdo->rollBack(); fail($e->getMessage(),400); }
case 'grn_list':
    requireAnyPermission(['warehousing.grn_print','warehousing.grn_add_edit']);$date=trim((string)($_GET['date']??''));$no=trim((string)($_GET['grn_no']??''));
    $sql='SELECT * FROM grns WHERE 1=1';$p=[];
    if($date!==''){$sql.=' AND grn_date=?';$p[]=$date;}
    if($no!==''){$sql.=' AND grn_no LIKE ?';$p[]="%$no%";}
    $sql.=' ORDER BY grn_id DESC LIMIT 200';$st=db()->prepare($sql);$st->execute($p);ok($st->fetchAll());
default: fail('Unknown API action',404);
}
