<?php
declare(strict_types=1);
require_once __DIR__ . '/../lib/bootstrap.php';

$action = defined('BREWSMART_ACTION') ? BREWSMART_ACTION : ($_GET['action'] ?? '');
$method = $_SERVER['REQUEST_METHOD'];

require_once __DIR__ . '/../services/InvoiceAllocationService.php';

switch ($action) {
case 'login':
    loginThrottleCheck();
    $d=body(); $username=trim((string)($d['username']??'')); $password=(string)($d['password']??'');
    if($username===''||$password==='') fail('Username and password are required');
    if(strlen($username)>80 || strlen($password)>255) fail('Invalid login input',422);
    $st=db()->prepare('SELECT user_id,username,full_name,email,password_hash,role,status FROM users WHERE username=? LIMIT 1'); $st->execute([$username]); $u=$st->fetch();
    if(!$u || $u['status']!=='ACTIVE' || !password_verify($password,$u['password_hash'])) { loginThrottleFail(); fail('Invalid username or password',401); }
    loginThrottleClear();
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
case 'reports_grade_stock': requirePermission('warehousing.reports'); ok((new ReportService(db()))->gradeStock());
case 'reports_broker_stock': requirePermission('warehousing.reports'); ok((new ReportService(db()))->brokerStock());
case 'reports_issued_summary': requirePermission('warehousing.reports'); ok((new ReportService(db()))->issuedSummary());
case 'reports_turn_summary': requirePermission('warehousing.reports'); ok((new ReportService(db()))->turnSummary());
case 'reports_location_utilization': requirePermission('warehousing.reports'); ok((new ReportService(db()))->locationUtilization());
case 'reports_inventory': requirePermission('warehousing.reports');$rows=db()->query("SELECT t.tea_name,g.grade_code,SUM(i.total_bags) total_bags,SUM(i.available_bags) available_bags,SUM(i.allocated_bags) allocated_bags,COUNT(*) lots FROM tea_inventory i JOIN tea_types t ON t.tea_type_id=i.tea_type_id LEFT JOIN tea_grades g ON g.grade_id=i.grade_id GROUP BY t.tea_type_id,g.grade_id ORDER BY t.tea_name,g.grade_code")->fetchAll();ok($rows);
case 'reports_warehouse': requirePermission('warehousing.reports');$rows=db()->query("SELECT r.rack_code,COUNT(wl.location_id) locations,SUM(LEAST(wl.capacity_bags,10)) capacity_bags,SUM(wl.occupied_bags) occupied_bags,SUM(GREATEST(0,LEAST(wl.capacity_bags,10)-wl.occupied_bags)) free_bags FROM racks r LEFT JOIN warehouse_locations wl ON wl.rack_id=r.rack_id GROUP BY r.rack_id ORDER BY r.rack_code")->fetchAll();ok($rows);
case 'reports_movements': requirePermission('warehousing.reports');$rows=db()->query("SELECT DATE(created_at) movement_date,movement_type,SUM(quantity_bags) bags,COUNT(*) transactions FROM stock_movements GROUP BY DATE(created_at),movement_type ORDER BY movement_date DESC LIMIT 90")->fetchAll();ok($rows);
case 'reports_invoice_register':
    requirePermission('warehousing.reports');
    $q=trim((string)($_GET['q']??''));$from=trim((string)($_GET['from']??''));$to=trim((string)($_GET['to']??''));
    $sql="SELECT wi.invoice_id,wi.invoice_date,wi.invoice_no,wi.mark,wi.selling_mark,wi.grade,wi.packing_type,wi.broker,wi.buyer,wi.chests,wi.net_weight_each,wi.total_net_weight,wi.total_gross_weight,wi.allocation_model,wi.allocation_score,COALESCE(GROUP_CONCAT(CONCAT(wl.location_code,' (',ila.chests_allocated,')') ORDER BY wl.location_code SEPARATOR ', '),wi.location_code) allocated_locations FROM warehouse_invoices wi LEFT JOIN invoice_location_allocations ila ON ila.invoice_id=wi.invoice_id LEFT JOIN warehouse_locations wl ON wl.location_id=ila.location_id WHERE 1=1";$p=[];
    if($from!==''){$sql.=' AND wi.invoice_date>=?';$p[]=$from;}if($to!==''){$sql.=' AND wi.invoice_date<=?';$p[]=$to;}if($q!==''){$like="%$q%";$sql.=' AND (wi.invoice_no LIKE ? OR wi.mark LIKE ? OR wi.grade LIKE ? OR wi.broker LIKE ? OR wi.packing_type LIKE ?)';$p=array_merge($p,[$like,$like,$like,$like,$like]);}
    $sql.=' GROUP BY wi.invoice_id ORDER BY wi.invoice_date DESC,wi.invoice_id DESC LIMIT 1000';$st=db()->prepare($sql);$st->execute($p);ok($st->fetchAll());
case 'reports_daily_arrivals':
    requirePermission('warehousing.reports');
    $rows=db()->query("SELECT invoice_date,COALESCE(NULLIF(broker,''),'(Not set)') broker,COUNT(*) invoices,SUM(chests) chests,ROUND(SUM(total_net_weight),2) total_net_weight FROM warehouse_invoices GROUP BY invoice_date,broker ORDER BY invoice_date DESC,broker LIMIT 365")->fetchAll();ok($rows);
case 'reports_daily_stock_summary':
    requirePermission('warehousing.reports');
    $from=trim((string)($_GET['from']??''));
    $to=trim((string)($_GET['to']??''));
    $arrivalSql="SELECT invoice_date report_date, SUM(chests) arrival_bags, ROUND(SUM(COALESCE(total_net_weight,chests*COALESCE(net_weight_each,0))),2) arrival_weight FROM warehouse_invoices WHERE 1=1";
    $arrivalParams=[];
    if($from!==''){$arrivalSql.=' AND invoice_date>=?';$arrivalParams[]=$from;}
    if($to!==''){$arrivalSql.=' AND invoice_date<=?';$arrivalParams[]=$to;}
    $arrivalSql.=' GROUP BY invoice_date ORDER BY invoice_date';
    $ast=db()->prepare($arrivalSql);$ast->execute($arrivalParams);$arrivals=$ast->fetchAll();

    $deliverySql="SELECT DATE(created_at) report_date, SUM(quantity_bags) delivery_bags, ROUND(SUM(weight),2) delivery_weight FROM invoice_stock_movements WHERE movement_type='OUT'";
    $deliveryParams=[];
    if($from!==''){$deliverySql.=' AND DATE(created_at)>=?';$deliveryParams[]=$from;}
    if($to!==''){$deliverySql.=' AND DATE(created_at)<=?';$deliveryParams[]=$to;}
    $deliverySql.=' GROUP BY DATE(created_at) ORDER BY report_date';
    $dst=db()->prepare($deliverySql);$dst->execute($deliveryParams);$deliveries=$dst->fetchAll();

    // Calculate opening stock before the selected period so daily closing stock remains correct.
    $openingBags=0;$openingWeight=0.0;
    if($from!==''){
        $ost=db()->prepare("SELECT COALESCE(SUM(chests),0) bags,COALESCE(SUM(COALESCE(total_net_weight,chests*COALESCE(net_weight_each,0))),0) weight FROM warehouse_invoices WHERE invoice_date<?");
        $ost->execute([$from]);$o=$ost->fetch();$openingBags+=(int)($o['bags']??0);$openingWeight+=(float)($o['weight']??0);
        $ost=db()->prepare("SELECT COALESCE(SUM(quantity_bags),0) bags,COALESCE(SUM(weight),0) weight FROM invoice_stock_movements WHERE movement_type='OUT' AND DATE(created_at)<?");
        $ost->execute([$from]);$o=$ost->fetch();$openingBags-=(int)($o['bags']??0);$openingWeight-=(float)($o['weight']??0);
    }

    $daily=[];
    foreach($arrivals as $r){$date=$r['report_date'];$daily[$date]??=['arrival_bags'=>0,'arrival_weight'=>0.0,'delivery_bags'=>0,'delivery_weight'=>0.0];$daily[$date]['arrival_bags']+=(int)$r['arrival_bags'];$daily[$date]['arrival_weight']+=(float)$r['arrival_weight'];}
    foreach($deliveries as $r){$date=$r['report_date'];$daily[$date]??=['arrival_bags'=>0,'arrival_weight'=>0.0,'delivery_bags'=>0,'delivery_weight'=>0.0];$daily[$date]['delivery_bags']+=(int)$r['delivery_bags'];$daily[$date]['delivery_weight']+=(float)$r['delivery_weight'];}
    ksort($daily);
    $stockBags=max(0,$openingBags);$stockWeight=max(0.0,$openingWeight);$rows=[];
    foreach($daily as $date=>$r){
        $stockBags=max(0,$stockBags+$r['arrival_bags']-$r['delivery_bags']);
        $stockWeight=max(0.0,$stockWeight+$r['arrival_weight']-$r['delivery_weight']);
        $rows[]=[
            'report_date'=>$date,
            'arrival_bags'=>$r['arrival_bags'],
            'arrival_weight'=>round($r['arrival_weight'],2),
            'delivery_bags'=>$r['delivery_bags'],
            'delivery_weight'=>round($r['delivery_weight'],2),
            'stock_bags'=>$stockBags,
            'stock_weight'=>round($stockWeight,2),
        ];
    }
    $rows=array_reverse($rows);
    ok($rows);
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
case 'meta': requireLogin(); ok(['tea_types'=>db()->query('SELECT * FROM tea_types ORDER BY tea_name')->fetchAll(),'grades'=>db()->query('SELECT * FROM tea_grades ORDER BY grade_code')->fetchAll(),'suppliers'=>db()->query('SELECT * FROM suppliers WHERE status=\'ACTIVE\' ORDER BY supplier_name')->fetchAll(),'brokers'=>db()->query('SELECT * FROM brokers WHERE status=\'ACTIVE\' ORDER BY broker_name')->fetchAll(),'buyers'=>db()->query('SELECT * FROM buyers WHERE status=\'ACTIVE\' ORDER BY buyer_name')->fetchAll(),'marks'=>db()->query('SELECT * FROM marks WHERE status=\'ACTIVE\' ORDER BY mark_name')->fetchAll(),'packing_types'=>db()->query('SELECT * FROM packing_types WHERE status=\'ACTIVE\' ORDER BY packing_name')->fetchAll()]);

case 'buyers_list':
    requireLogin();
    ok(db()->query("SELECT * FROM buyers WHERE status='ACTIVE' ORDER BY buyer_name")->fetchAll());
case 'buyers_create':
    $u=requirePermission('master.buyer');$d=body();$code=trim((string)($d['buyer_code']??$d['code']??''));$name=trim((string)($d['buyer_name']??$d['name']??''));
    if($code==='')fail('Buyer code is required');if($name==='')$name=$code;
    $st=db()->prepare('INSERT INTO buyers(buyer_code,buyer_name) VALUES(?,?)');
    try{$st->execute([$code,$name]);}catch(Throwable $e){fail($e->getCode()==='23000'?'That buyer already exists':$e->getMessage(),400);}
    logActivity('CREATE','MASTER',"Added buyer {$code}");ok(['buyer_id'=>(int)db()->lastInsertId()],'Buyer added');
case 'auctions_list':
    requirePermission('master.auction_calendar');
    $rows=db()->query("SELECT a.*,COALESCE(NULLIF(u.full_name,''),u.username) created_by_name FROM tea_auctions a LEFT JOIN users u ON u.user_id=a.created_by ORDER BY a.auction_date DESC,a.auction_id DESC LIMIT 200")->fetchAll();
    ok($rows);
case 'auctions_create':
    $u=requirePermission('master.auction_calendar');$d=body();
    $date=trim((string)($d['auction_date']??''));$saleNo=trim((string)($d['sale_no']??''));$notes=trim((string)($d['notes']??''));$status=strtoupper(trim((string)($d['status']??'SCHEDULED')));
    if($date===''||!preg_match('/^\d{4}-\d{2}-\d{2}$/',$date))fail('Valid auction date is required');
    if(!in_array($status,['SCHEDULED','COMPLETED','CANCELLED'],true))fail('Invalid auction status');
    $st=db()->prepare('INSERT INTO tea_auctions(auction_date,sale_no,notes,status,created_by) VALUES(?,?,?,?,?)');
    $st->execute([$date,$saleNo?:null,$notes?:null,$status,$u['user_id']]);
    logActivity('CREATE','AUCTION','Added tea auction '.$date.($saleNo?' | '.$saleNo:''));
    ok(['auction_id'=>(int)db()->lastInsertId()],'Tea auction date saved');
case 'auction_next':
    requireLogin();
    $st=db()->query("SELECT auction_id,auction_date,sale_no,notes,status,DATEDIFF(auction_date,CURDATE()) days_remaining FROM tea_auctions WHERE status='SCHEDULED' AND auction_date>=CURDATE() ORDER BY auction_date,auction_id LIMIT 1");
    ok($st->fetch() ?: null);
case 'brokering_dashboard':
    requirePermission('brokering.home');
    $pdo=db();
    $next=null;$stats=['active_brokers'=>0,'active_buyers'=>0,'active_marks'=>0,'upcoming_auctions'=>0];$recentBrokers=[];$recentBuyers=[];$upcomingAuctions=[];
    try{$next=$pdo->query("SELECT auction_id,auction_date,sale_no,notes,status,DATEDIFF(auction_date,CURDATE()) days_remaining FROM tea_auctions WHERE status='SCHEDULED' AND auction_date>=CURDATE() ORDER BY auction_date,auction_id LIMIT 1")->fetch() ?: null;}catch(Throwable $e){}
    try{$stats['active_brokers']=(int)$pdo->query("SELECT COUNT(*) FROM brokers WHERE status='ACTIVE'")->fetchColumn();$recentBrokers=$pdo->query("SELECT broker_id,broker_code,broker_name FROM brokers WHERE status='ACTIVE' ORDER BY broker_id DESC LIMIT 5")->fetchAll();}catch(Throwable $e){}
    try{$stats['active_buyers']=(int)$pdo->query("SELECT COUNT(*) FROM buyers WHERE status='ACTIVE'")->fetchColumn();$recentBuyers=$pdo->query("SELECT buyer_id,buyer_code,buyer_name FROM buyers WHERE status='ACTIVE' ORDER BY buyer_id DESC LIMIT 5")->fetchAll();}catch(Throwable $e){}
    try{$stats['active_marks']=(int)$pdo->query("SELECT COUNT(*) FROM marks WHERE status='ACTIVE'")->fetchColumn();}catch(Throwable $e){}
    try{$stats['upcoming_auctions']=(int)$pdo->query("SELECT COUNT(*) FROM tea_auctions WHERE status='SCHEDULED' AND auction_date>=CURDATE()")->fetchColumn();$upcomingAuctions=$pdo->query("SELECT auction_id,auction_date,sale_no,status FROM tea_auctions WHERE status='SCHEDULED' AND auction_date>=CURDATE() ORDER BY auction_date,auction_id LIMIT 5")->fetchAll();}catch(Throwable $e){}
    ok(['stats'=>$stats,'next_auction'=>$next,'recent_brokers'=>$recentBrokers,'recent_buyers'=>$recentBuyers,'upcoming_auctions'=>$upcomingAuctions]);
case 'warehouse_dashboard':
    requirePermission('warehousing.dashboard');
    $summary=db()->query("SELECT
        COALESCE(SUM(CASE WHEN active=1 AND blocked=0 THEN LEAST(capacity_bags,10) ELSE 0 END),0) capacity_bags,
        COALESCE(SUM(CASE WHEN active=1 AND blocked=0 THEN occupied_bags ELSE 0 END),0) stock_bags,
        COALESCE(SUM(CASE WHEN active=1 AND blocked=0 THEN current_weight ELSE 0 END),0) stock_weight,
        SUM(CASE WHEN active=1 AND blocked=0 AND occupied_bags=0 THEN 1 ELSE 0 END) available_locations,
        SUM(CASE WHEN active=1 AND blocked=0 AND occupied_bags>0 AND occupied_bags<LEAST(capacity_bags,10) THEN 1 ELSE 0 END) partial_locations,
        SUM(CASE WHEN active=1 AND blocked=0 AND occupied_bags>=LEAST(capacity_bags,10) THEN 1 ELSE 0 END) full_locations,
        SUM(CASE WHEN blocked=1 OR status='BLOCKED' THEN 1 ELSE 0 END) blocked_locations
        FROM warehouse_locations")->fetch();
    $arrivals=db()->query("SELECT COALESCE(SUM(chests),0) bags,COALESCE(SUM(COALESCE(total_net_weight,chests*COALESCE(net_weight_each,0))),0) weight,COUNT(*) invoices FROM warehouse_invoices WHERE invoice_date=CURDATE()")->fetch();
    $deliveries=db()->query("SELECT COALESCE(SUM(quantity_bags),0) bags,COALESCE(SUM(weight),0) weight,COUNT(*) movements FROM invoice_stock_movements WHERE movement_type='OUT' AND DATE(created_at)=CURDATE()")->fetch();
    $activeInvoices=(int)db()->query("SELECT COUNT(DISTINCT invoice_id) FROM invoice_location_allocations WHERE chests_allocated>0")->fetchColumn();
    $pendingGins=db()->query("SELECT COUNT(*) notes,COALESCE(SUM(chests),0) bags FROM gins WHERE dispatch_status='PENDING'")->fetch();
    $racks=db()->query("SELECT r.rack_code,r.rack_name,COALESCE(SUM(LEAST(wl.capacity_bags,10)),0) capacity_bags,COALESCE(SUM(wl.occupied_bags),0) occupied_bags,ROUND(CASE WHEN SUM(LEAST(wl.capacity_bags,10))>0 THEN 100*SUM(wl.occupied_bags)/SUM(LEAST(wl.capacity_bags,10)) ELSE 0 END,1) utilization_pct FROM racks r LEFT JOIN warehouse_locations wl ON wl.rack_id=r.rack_id AND wl.active=1 AND wl.blocked=0 GROUP BY r.rack_id ORDER BY utilization_pct DESC,r.rack_code LIMIT 20")->fetchAll();
    $recent=db()->query("SELECT m.created_at,m.movement_type,m.quantity_bags,m.weight,m.reference_no,wi.invoice_no,wl.location_code FROM invoice_stock_movements m JOIN warehouse_invoices wi ON wi.invoice_id=m.invoice_id LEFT JOIN warehouse_locations wl ON wl.location_id=m.location_id ORDER BY m.movement_id DESC LIMIT 8")->fetchAll();
    $cap=(float)($summary['capacity_bags']??0);$stock=(float)($summary['stock_bags']??0);
    $summary['utilization_pct']=$cap>0?round(($stock/$cap)*100,1):0.0;
    $summary['stock_bags']=(int)$stock;$summary['capacity_bags']=(int)$cap;$summary['stock_weight']=round((float)($summary['stock_weight']??0),2);
    ok(['summary'=>$summary,'today_arrivals'=>['bags'=>(int)$arrivals['bags'],'weight'=>round((float)$arrivals['weight'],2),'invoices'=>(int)$arrivals['invoices']], 'today_deliveries'=>['bags'=>(int)$deliveries['bags'],'weight'=>round((float)$deliveries['weight'],2),'movements'=>(int)$deliveries['movements']], 'active_invoices'=>$activeInvoices,'pending_dispatch'=>['gins'=>(int)$pendingGins['notes'],'bags'=>(int)$pendingGins['bags']], 'racks'=>$racks,'recent_movements'=>$recent]);

case 'brokers_list': requireLogin(); ok(db()->query("SELECT * FROM brokers WHERE status='ACTIVE' ORDER BY broker_name")->fetchAll());
case 'brokers_create':
    $u=requirePermission('master.broker');$d=body();$code=trim((string)($d['broker_code']??$d['code']??''));$name=trim((string)($d['broker_name']??$d['name']??''));if($code==='')fail('Broker code is required');if($name==='')$name=$code;$st=db()->prepare('INSERT INTO brokers(broker_code,broker_name) VALUES(?,?)');try{$st->execute([$code,$name]);}catch(Throwable $e){fail($e->getCode()==='23000'?'That broker already exists':$e->getMessage(),400);}logActivity('CREATE','MASTER',"Added broker {$code}");ok(['broker_id'=>(int)db()->lastInsertId()],'Broker added');
case 'marks_list': requireLogin(); ok(db()->query("SELECT * FROM marks WHERE status='ACTIVE' ORDER BY mark_name")->fetchAll());
case 'marks_create':
    $u=requirePermission('master.mark');$d=body();$code=trim((string)($d['mark_code']??$d['code']??''));$name=trim((string)($d['mark_name']??$d['name']??''));if($code==='')fail('Mark code is required');if($name==='')$name=$code;$st=db()->prepare('INSERT INTO marks(mark_code,mark_name) VALUES(?,?)');try{$st->execute([$code,$name]);}catch(Throwable $e){fail($e->getCode()==='23000'?'That mark already exists':$e->getMessage(),400);}logActivity('CREATE','MASTER',"Added mark {$code}");ok(['mark_id'=>(int)db()->lastInsertId()],'Mark added');
case 'packing_list': requireLogin(); ok(db()->query("SELECT * FROM packing_types WHERE status='ACTIVE' ORDER BY packing_name")->fetchAll());
case 'packing_create':
    $u=requirePermission('master.packing_type');$d=body();$code=trim((string)($d['packing_code']??$d['code']??''));$name=trim((string)($d['packing_name']??$d['name']??''));if($code==='')fail('Packing type code is required');if($name==='')$name=$code;$st=db()->prepare('INSERT INTO packing_types(packing_code,packing_name) VALUES(?,?)');try{$st->execute([$code,$name]);}catch(Throwable $e){fail($e->getCode()==='23000'?'That packing type already exists':$e->getMessage(),400);}logActivity('CREATE','MASTER',"Added packing type {$code}");ok(['packing_type_id'=>(int)db()->lastInsertId()],'Packing type added');
case 'grade_create':
    $u=requirePermission('master.grade');$d=body();
    $code=strtoupper(trim((string)($d['grade_code']??$d['code']??'')));
    $name=trim((string)($d['grade_name']??$d['name']??''));
    $density=(float)($d['packing_density']??0);
    $minWeight=(float)($d['min_bag_weight']??0);
    $maxWeight=(float)($d['max_bag_weight']??0);
    if($code==='') fail('Grade code is required');
    if($name==='') $name=$code;
    if($density<=0) fail('Packing Density must be greater than 0');
    if($minWeight<=0||$maxWeight<=0) fail('Minimum and Maximum Bag Weight are required');
    if($minWeight>$maxWeight) fail('Minimum Bag Weight cannot be greater than Maximum Bag Weight');
    $st=db()->prepare('INSERT INTO tea_grades(grade_code,grade_name,packing_density,min_bag_weight,max_bag_weight) VALUES(?,?,?,?,?)');
    try{$st->execute([$code,$name,$density,$minWeight,$maxWeight]);}catch(Throwable $e){fail($e->getCode()==='23000'?'That grade already exists':$e->getMessage(),400);}
    logActivity('CREATE','MASTER',"Added grade {$code} | density {$density} | {$minWeight}-{$maxWeight}kg");
    ok(['grade_id'=>(int)db()->lastInsertId()],'Grade added');
case 'grade_update':
    $u=requirePermission('master.grade');$d=body();
    $id=(int)($d['grade_id']??0);
    $density=(float)($d['packing_density']??0);
    $minWeight=(float)($d['min_bag_weight']??0);
    $maxWeight=(float)($d['max_bag_weight']??0);
    if(!$id) fail('grade_id is required');
    if($density<=0) fail('Packing Density must be greater than 0');
    if($minWeight<=0||$maxWeight<=0) fail('Minimum and Maximum Bag Weight are required');
    if($minWeight>$maxWeight) fail('Minimum Bag Weight cannot be greater than Maximum Bag Weight');
    $st=db()->prepare('UPDATE tea_grades SET packing_density=?,min_bag_weight=?,max_bag_weight=? WHERE grade_id=?');
    $st->execute([$density,$minWeight,$maxWeight,$id]);
    if(!$st->rowCount()){ $chk=db()->prepare('SELECT grade_id FROM tea_grades WHERE grade_id=?');$chk->execute([$id]);if(!$chk->fetchColumn()) fail('Grade not found',404); }
    logActivity('UPDATE','MASTER','Updated grade storage profile #'.$id);
    ok([],'Grade storage profile updated');
case 'grn_invoice_candidates':
    requirePermission('warehousing.grn_add_edit');
    $date=trim((string)($_GET['date']??''));$broker=trim((string)($_GET['broker']??''));$buyer=trim((string)($_GET['buyer']??''));$mark=trim((string)($_GET['mark']??''));$q=trim((string)($_GET['q']??''));$turnNo=trim((string)($_GET['turn_no']??''));$editingGrn=(int)($_GET['grn_id']??0);
    $sql="SELECT wi.invoice_id,wi.invoice_no,wi.invoice_date,wi.mark,wi.selling_mark,wi.grade,wi.packing_type,wi.chests,wi.net_weight_each,wi.total_net_weight,wi.broker,wi.buyer,wi.store,wi.location_code,wi.arrival_turn_no,wi.arrival_vehicle_no,wi.arrival_driver_name,wi.arrival_driver_nic,COALESCE(GROUP_CONCAT(CONCAT(wl.location_code,' (',ila.chests_allocated,')') ORDER BY wl.location_code SEPARATOR ', '),wi.location_code) allocated_locations,gi.grn_id existing_grn_id,g.grn_no existing_grn_no FROM warehouse_invoices wi LEFT JOIN invoice_location_allocations ila ON ila.invoice_id=wi.invoice_id LEFT JOIN warehouse_locations wl ON wl.location_id=ila.location_id LEFT JOIN grn_items gi ON gi.invoice_id=wi.invoice_id LEFT JOIN grns g ON g.grn_id=gi.grn_id WHERE 1=1";$params=[];
    if($date!==''){$sql.=' AND wi.invoice_date=?';$params[]=$date;}
    if($broker!==''){$sql.=' AND wi.broker LIKE ?';$params[]="%{$broker}%";}
    if($buyer!==''){$sql.=' AND wi.buyer LIKE ?';$params[]="%{$buyer}%";}
    if($mark!==''){$sql.=' AND wi.mark=?';$params[]=$mark;}
    if($turnNo!==''){$sql.=' AND wi.arrival_turn_no=?';$params[]=$turnNo;}
    if($q!==''){$like="%{$q}%";$sql.=' AND (wi.invoice_no LIKE ? OR wi.selling_mark LIKE ? OR wi.grade LIKE ? OR wi.broker LIKE ? OR wi.arrival_turn_no LIKE ?)';$params=array_merge($params,[$like,$like,$like,$like,$like]);}
    if($editingGrn>0){$sql.=' AND (gi.grn_id IS NULL OR gi.grn_id=?)';$params[]=$editingGrn;}else{$sql.=' AND gi.grn_id IS NULL';}
    $sql.=' GROUP BY wi.invoice_id,gi.grn_id,g.grn_no ORDER BY wi.invoice_date DESC,wi.invoice_id DESC LIMIT 300';$st=db()->prepare($sql);$st->execute($params);ok($st->fetchAll());
case 'grn_turn_lookup':
    requirePermission('warehousing.grn_add_edit');
    $turnNo=trim((string)($_GET['turn_no']??''));$editingGrn=(int)($_GET['grn_id']??0);
    if($turnNo==='')fail('Turn number is required');
    $sql="SELECT wi.invoice_id,wi.invoice_no,wi.invoice_date,wi.mark,wi.selling_mark,wi.grade,wi.packing_type,wi.chests,wi.net_weight_each,wi.total_net_weight,wi.broker,wi.buyer,wi.store,wi.arrival_turn_no,wi.arrival_vehicle_no,wi.arrival_driver_name,wi.arrival_driver_nic,COALESCE(GROUP_CONCAT(CONCAT(wl.location_code,' (',ila.chests_allocated,')') ORDER BY wl.location_code SEPARATOR ', '),wi.location_code) allocated_locations,gi.grn_id existing_grn_id,g.grn_no existing_grn_no
          FROM warehouse_invoices wi
          LEFT JOIN invoice_location_allocations ila ON ila.invoice_id=wi.invoice_id
          LEFT JOIN warehouse_locations wl ON wl.location_id=ila.location_id
          LEFT JOIN grn_items gi ON gi.invoice_id=wi.invoice_id
          LEFT JOIN grns g ON g.grn_id=gi.grn_id
          WHERE wi.arrival_turn_no=?";$params=[$turnNo];
    if($editingGrn>0){$sql.=' AND (gi.grn_id IS NULL OR gi.grn_id=?)';$params[]=$editingGrn;}else{$sql.=' AND gi.grn_id IS NULL';}
    $sql.=' GROUP BY wi.invoice_id,gi.grn_id,g.grn_no ORDER BY wi.invoice_id';
    $st=db()->prepare($sql);$st->execute($params);$rows=$st->fetchAll();
    if(!$rows)fail('No unreceived arrival/invoice details found for turn '.$turnNo,404);
    $first=$rows[0];
    $header=[
        'turn_no'=>$turnNo,
        'date'=>$first['invoice_date']??date('Y-m-d'),
        'store'=>$first['store']??'',
        'vehicle_no'=>$first['arrival_vehicle_no']??'',
        'driver_name'=>$first['arrival_driver_name']??'',
        'driver_nic'=>$first['arrival_driver_nic']??'',
        'broker'=>$first['broker']??'',
        'buyer'=>$first['buyer']??'',
        'mark'=>$first['mark']??'',
        'source_type'=>!empty($first['buyer']) && empty($first['broker']) ? 'BUYER' : 'BROKER'
    ];
    ok(['header'=>$header,'items'=>$rows],'Arrival details loaded for turn '.$turnNo);
case 'grn_get':
    requireAnyPermission(['warehousing.grn_print','warehousing.grn_add_edit']);$id=(int)($_GET['id']??0);$no=trim((string)($_GET['grn_no']??''));if(!$id&&$no==='')fail('id or grn_no is required');
    $st=db()->prepare('SELECT * FROM grns WHERE '.($id?'grn_id=?':'grn_no=?').' LIMIT 1');$st->execute([$id?:$no]);$grn=$st->fetch();if(!$grn)fail('GRN not found',404);
    $it=db()->prepare("SELECT gi.*,wi.invoice_no,wi.mark,wi.selling_mark,wi.grade,wi.packing_type,wi.chests invoice_chests,wi.net_weight_each,wi.total_net_weight,wi.broker,COALESCE(GROUP_CONCAT(CONCAT(wl.location_code,' (',ila.chests_allocated,')') ORDER BY wl.location_code SEPARATOR ', '),wi.location_code) allocated_locations FROM grn_items gi JOIN warehouse_invoices wi ON wi.invoice_id=gi.invoice_id LEFT JOIN invoice_location_allocations ila ON ila.invoice_id=wi.invoice_id LEFT JOIN warehouse_locations wl ON wl.location_id=ila.location_id WHERE gi.grn_id=? GROUP BY gi.grn_item_id,wi.invoice_id ORDER BY gi.grn_item_id");$it->execute([$grn['grn_id']]);ok(['grn'=>$grn,'items'=>$it->fetchAll()]);
case 'grn_create':
    $u=requirePermission('warehousing.grn_add_edit');$d=body();$grnId=(int)($d['grn_id']??0);$items=is_array($d['items']??null)?$d['items']:[];
    $no=trim((string)($d['grn_no']??$d['grnNo']??''));if($no==='')$no='BR-GRN-'.date('Ymd-His');
    $date=$d['date']??$d['grn_date']??date('Y-m-d');$store=trim((string)($d['store']??''));$turnNo=trim((string)($d['turnNo']??$d['turn_no']??''));if($turnNo==='')$turnNo='TURN-'.date('Ymd-His');
    $vehicle=trim((string)($d['vehicleNo']??$d['vehicle_no']??''));$driverName=trim((string)($d['driverName']??''));$driverNic=trim((string)($d['driverNic']??''));$sourceType=strtoupper(trim((string)($d['sourceType']??'BROKER')));if(!in_array($sourceType,['BROKER','BUYER'],true))$sourceType='BROKER';
    $broker=trim((string)($d['broker']??''));$buyer=trim((string)($d['buyer']??''));$mark=trim((string)($d['mark']??''));$supplier=trim((string)($d['supplier']??($broker?:$buyer)));$amalgamation=!empty($d['amalgamation'])?1:0;$remarks=trim((string)($d['remarks']??$d['commonRemark']??''));
    if(!$items && empty($d['chests']))fail('Select at least one invoice to receive');
    $pdo=db();$pdo->beginTransaction();
    try{
        if($grnId){$lock=$pdo->prepare('SELECT * FROM grns WHERE grn_id=? FOR UPDATE');$lock->execute([$grnId]);if(!$lock->fetch())throw new RuntimeException('GRN not found');$pdo->prepare('UPDATE grns SET grn_no=?,grn_date=?,store=?,turn_no=?,vehicle_no=?,driver_name=?,driver_nic=?,supplier=?,source_type=?,broker=?,buyer=?,mark=?,amalgamation=?,remarks=? WHERE grn_id=?')->execute([$no,$date,$store?:null,$turnNo,$vehicle?:null,$driverName?:null,$driverNic?:null,$supplier?:null,$sourceType,$broker?:null,$buyer?:null,$mark?:null,$amalgamation,$remarks?:null,$grnId]);$pdo->prepare('DELETE FROM grn_items WHERE grn_id=?')->execute([$grnId]);}
        else{$pdo->prepare('INSERT INTO grns(grn_no,grn_date,store,turn_no,vehicle_no,driver_name,driver_nic,supplier,source_type,broker,buyer,mark,amalgamation,chests,remarks,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')->execute([$no,$date,$store?:null,$turnNo,$vehicle?:null,$driverName?:null,$driverNic?:null,$supplier?:null,$sourceType,$broker?:null,$buyer?:null,$mark?:null,$amalgamation,0,$remarks?:null,$u['user_id']]);$grnId=(int)$pdo->lastInsertId();}
        $total=0;
        foreach($items as $item){$invoiceId=(int)($item['invoice_id']??0);if(!$invoiceId)throw new RuntimeException('Invalid invoice selected');$invSt=$pdo->prepare('SELECT invoice_id,invoice_no,chests FROM warehouse_invoices WHERE invoice_id=? FOR UPDATE');$invSt->execute([$invoiceId]);$inv=$invSt->fetch();if(!$inv)throw new RuntimeException('Invoice not found');$received=(int)($item['received_chests']??$item['chests']??$inv['chests']);if($received<=0||$received>(int)$inv['chests'])throw new RuntimeException('Received chests for '.$inv['invoice_no'].' must be between 1 and '.$inv['chests']);$short=(float)($item['short_weight']??0);$pdo->prepare('INSERT INTO grn_items(grn_id,invoice_id,received_chests,short_weight,remarks) VALUES(?,?,?,?,?)')->execute([$grnId,$invoiceId,$received,$short,$item['remarks']??null]);$total+=$received;}
        if(!$items)$total=max(0,(int)($d['chests']??0));$pdo->prepare('UPDATE grns SET chests=? WHERE grn_id=?')->execute([$total,$grnId]);$pdo->commit();logActivity($d['grn_id']?'UPDATE':'CREATE','GRN',$no.' | '.$total.' chests');ok(['grn_id'=>$grnId,'grn_no'=>$no,'turn_no'=>$turnNo,'chests'=>$total],$d['grn_id']?'GRN updated successfully':'GRN created successfully');
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();fail($e->getCode()==='23000'?'This invoice is already linked to another GRN or the GRN number already exists':$e->getMessage(),400);}
case 'gin_stock_search':
    requirePermission('warehousing.gin_add');$invoice=trim((string)($_GET['invoice_no']??''));$mark=trim((string)($_GET['mark']??''));$selling=trim((string)($_GET['selling_mark']??''));$q=trim((string)($_GET['q']??''));
    $sql="SELECT wi.invoice_id,wi.invoice_no,wi.invoice_date,wi.mark,wi.selling_mark,wi.grade,wi.packing_type,wi.broker,wi.buyer,wi.chests,wi.net_weight_each,wi.total_net_weight,
                 GREATEST(0,COALESCE(SUM(ila.chests_allocated),0)-COALESCE((SELECT SUM(gi2.chests_issued) FROM gin_items gi2 JOIN gins g2 ON g2.gin_id=gi2.gin_id WHERE gi2.invoice_id=wi.invoice_id AND g2.dispatch_status='PENDING'),0)) available_chests,
                 COALESCE(GROUP_CONCAT(CONCAT(wl.location_code,' (',ila.chests_allocated,')') ORDER BY ila.allocated_at,wl.location_code SEPARATOR ', '),'') allocated_locations
          FROM warehouse_invoices wi
          LEFT JOIN invoice_location_allocations ila ON ila.invoice_id=wi.invoice_id
          LEFT JOIN warehouse_locations wl ON wl.location_id=ila.location_id
          WHERE 1=1";$params=[];
    if($invoice!==''){$sql.=' AND wi.invoice_no LIKE ?';$params[]="%{$invoice}%";}if($mark!==''){$sql.=' AND wi.mark=?';$params[]=$mark;}if($selling!==''){$sql.=' AND wi.selling_mark LIKE ?';$params[]="%{$selling}%";}if($q!==''){$like="%{$q}%";$sql.=' AND (wi.invoice_no LIKE ? OR wi.mark LIKE ? OR wi.selling_mark LIKE ? OR wi.grade LIKE ? OR wi.broker LIKE ?)';$params=array_merge($params,[$like,$like,$like,$like,$like]);}$sql.=' GROUP BY wi.invoice_id HAVING available_chests>0 ORDER BY wi.invoice_date,wi.invoice_id LIMIT 200';$st=db()->prepare($sql);$st->execute($params);ok($st->fetchAll());
case 'gin_get':
    requireAnyPermission(['warehousing.gin_add','warehousing.gin_picking']);$id=(int)($_GET['id']??0);$no=trim((string)($_GET['gin_no']??''));if(!$id&&$no==='')fail('id or gin_no is required');$st=db()->prepare('SELECT * FROM gins WHERE '.($id?'gin_id=?':'gin_no=?').' LIMIT 1');$st->execute([$id?:$no]);$gin=$st->fetch();if(!$gin)fail('GIN not found',404);$it=db()->prepare("SELECT gi.*,wi.invoice_no,wi.mark,wi.selling_mark,wi.grade,wl.location_code FROM gin_items gi JOIN warehouse_invoices wi ON wi.invoice_id=gi.invoice_id JOIN warehouse_locations wl ON wl.location_id=gi.location_id WHERE gi.gin_id=? ORDER BY wi.invoice_no,wl.location_code");$it->execute([$gin['gin_id']]);ok(['gin'=>$gin,'items'=>$it->fetchAll()]);
case 'gin_list':
    requireAnyPermission(['warehousing.gin_add','warehousing.gin_picking']);$date=trim((string)($_GET['date']??''));$no=trim((string)($_GET['gin_no']??''));$buyer=trim((string)($_GET['buyer']??''));$q=trim((string)($_GET['q']??''));$sql="SELECT g.gin_id,g.gin_no,g.gin_date,g.store,g.turn_no,g.buyer,g.collection_person,g.collection_nic,g.vehicle_no,g.sale_type,g.other_broker,g.remarks,g.dispatch_status,g.gate_pass_no,g.gate_passed_at,g.created_at,COALESCE(SUM(gi.chests_issued),g.chests) chests,COUNT(DISTINCT gi.invoice_id) invoice_count,GROUP_CONCAT(DISTINCT wi.invoice_no ORDER BY wi.invoice_no SEPARATOR ', ') invoice_numbers,GROUP_CONCAT(DISTINCT wl.location_code ORDER BY wl.location_code SEPARATOR ', ') locations FROM gins g LEFT JOIN gin_items gi ON gi.gin_id=g.gin_id LEFT JOIN warehouse_invoices wi ON wi.invoice_id=gi.invoice_id LEFT JOIN warehouse_locations wl ON wl.location_id=gi.location_id WHERE 1=1";$params=[];if($date!==''){$sql.=' AND g.gin_date=?';$params[]=$date;}if($no!==''){$sql.=' AND g.gin_no LIKE ?';$params[]="%{$no}%";}if($buyer!==''){$sql.=' AND g.buyer LIKE ?';$params[]="%{$buyer}%";}if($q!==''){$like="%{$q}%";$sql.=' AND (g.gin_no LIKE ? OR g.turn_no LIKE ? OR g.vehicle_no LIKE ? OR g.buyer LIKE ? OR g.gate_pass_no LIKE ?)';$params=array_merge($params,[$like,$like,$like,$like,$like]);}$sql.=' GROUP BY g.gin_id ORDER BY g.gin_date DESC,g.gin_id DESC LIMIT 300';$st=db()->prepare($sql);$st->execute($params);ok($st->fetchAll());
case 'gin_create':
    $u=requirePermission('warehousing.gin_add');$d=body();$items=is_array($d['items']??null)?$d['items']:[];
    if(!$items && !empty($d['invoiceNo'])){$st=db()->prepare('SELECT invoice_id FROM warehouse_invoices WHERE invoice_no=? LIMIT 1');$st->execute([trim((string)$d['invoiceNo'])]);$invoiceId=(int)($st->fetchColumn()?:0);if($invoiceId)$items=[['invoice_id'=>$invoiceId,'quantity'=>(int)($d['chests']??0)]];}
    if(!$items)fail('Add at least one invoice to the issuing grid');$no=trim((string)($d['gin_no']??$d['ginNo']??''));if($no==='')$no='BR-GIN-'.date('Ymd-His');$date=$d['date']??date('Y-m-d');$store=trim((string)($d['store']??''));$turnNo=trim((string)($d['turnNo']??''));if($turnNo==='')$turnNo='OUT-'.date('Ymd-His');$buyer=trim((string)($d['buyer']??''));$person=trim((string)($d['collectionPerson']??''));$nic=trim((string)($d['collectionNic']??''));$vehicle=trim((string)($d['vehicleNo']??''));$saleType=trim((string)($d['saleType']??'Auction Sale'));$otherBroker=!empty($d['otherBroker'])?1:0;$remarks=trim((string)($d['remarks']??''));if($buyer==='')fail('Buyer is required');
    $pdo=db();$pdo->beginTransaction();
    try{
        $pdo->prepare("INSERT INTO gins(gin_no,gin_date,store,turn_no,buyer,collection_person,collection_nic,vehicle_no,sale_type,other_broker,remarks,invoice_no,chests,dispatch_status,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,'PENDING',?)")->execute([$no,$date,$store?:null,$turnNo,$buyer,$person?:null,$nic?:null,$vehicle?:null,$saleType?:null,$otherBroker,$remarks?:null,null,0,$u['user_id']]);$ginId=(int)$pdo->lastInsertId();$grandTotal=0;$invoiceNos=[];$picking=[];
        foreach($items as $item){
            $invoiceId=(int)($item['invoice_id']??0);$qty=(int)($item['quantity']??$item['chests']??0);
            if(!$invoiceId||$qty<=0)throw new RuntimeException('Each issuing item needs an invoice and quantity');
            $iv=$pdo->prepare('SELECT * FROM warehouse_invoices WHERE invoice_id=? FOR UPDATE');$iv->execute([$invoiceId]);$inv=$iv->fetch();if(!$inv)throw new RuntimeException('Invoice not found');
            $alloc=$pdo->prepare("SELECT ila.*,wl.location_code,
                         COALESCE((SELECT SUM(gi2.chests_issued) FROM gin_items gi2 JOIN gins g2 ON g2.gin_id=gi2.gin_id WHERE gi2.invoice_id=ila.invoice_id AND gi2.location_id=ila.location_id AND g2.dispatch_status='PENDING'),0) pending_qty
                         FROM invoice_location_allocations ila
                         JOIN warehouse_locations wl ON wl.location_id=ila.location_id
                         WHERE ila.invoice_id=? AND ila.chests_allocated>0
                         ORDER BY ila.allocated_at,ila.allocation_id FOR UPDATE");
            $alloc->execute([$invoiceId]);$allocs=$alloc->fetchAll();
            $available=0;foreach($allocs as $a){$available+=max(0,(int)$a['chests_allocated']-(int)$a['pending_qty']);}
            if($qty>$available)throw new RuntimeException('Only '.$available.' chest(s) are available for invoice '.$inv['invoice_no'].' after pending GIN reservations');
            $remaining=$qty;$netEach=(float)($inv['net_weight_each']??0);
            foreach($allocs as $a){
                if($remaining<=0)break;
                $free=max(0,(int)$a['chests_allocated']-(int)$a['pending_qty']);
                $take=min($remaining,$free);if($take<=0)continue;
                $weight=round($take*$netEach,2);
                $pdo->prepare('INSERT INTO gin_items(gin_id,invoice_id,location_id,chests_issued,net_weight_each,weight_issued) VALUES(?,?,?,?,?,?)')->execute([$ginId,$invoiceId,$a['location_id'],$take,$netEach,$weight]);
                $picking[]=['invoice_no'=>$inv['invoice_no'],'location_code'=>$a['location_code'],'chests'=>$take,'weight'=>$weight];
                $remaining-=$take;
            }
            $grandTotal+=$qty;$invoiceNos[]=$inv['invoice_no'];
        }
        $firstInvoice=$invoiceNos[0]??null;$pdo->prepare('UPDATE gins SET invoice_no=?,chests=? WHERE gin_id=?')->execute([$firstInvoice,$grandTotal,$ginId]);$pdo->commit();
        logActivity('CREATE','GIN',$no.' | '.$grandTotal.' chests reserved pending gate pass');
        ok(['gin_id'=>$ginId,'gin_no'=>$no,'turn_no'=>$turnNo,'chests'=>$grandTotal,'dispatch_status'=>'PENDING','picking_plan'=>$picking],'GIN saved. Stock is reserved but remains in its warehouse location until Gate Pass dispatch is confirmed.');
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();fail($e->getCode()==='23000'?'GIN number already exists':$e->getMessage(),400);}
case 'gin_dispatch':
    $u=requirePermission('warehousing.gin_picking');$d=body();$ginId=(int)($d['gin_id']??0);$ginNo=trim((string)($d['gin_no']??''));
    if(!$ginId&&$ginNo==='')fail('gin_id or gin_no is required');
    $pdo=db();$pdo->beginTransaction();
    try{
        $st=$pdo->prepare('SELECT * FROM gins WHERE '.($ginId?'gin_id=?':'gin_no=?').' FOR UPDATE');$st->execute([$ginId?:$ginNo]);$gin=$st->fetch();if(!$gin)throw new RuntimeException('GIN not found');
        $ginId=(int)$gin['gin_id'];
        if(($gin['dispatch_status']??'PENDING')==='DISPATCHED'){
            $pdo->commit();
            ok(['gin_id'=>$ginId,'gin_no'=>$gin['gin_no'],'dispatch_status'=>'DISPATCHED','gate_pass_no'=>$gin['gate_pass_no'],'gate_passed_at'=>$gin['gate_passed_at']],'Gate Pass already issued. No stock was deducted again.');
        }
        if(($gin['dispatch_status']??'PENDING')==='CANCELLED')throw new RuntimeException('Cancelled GIN cannot be dispatched');
        $items=$pdo->prepare("SELECT gi.*,wi.invoice_no,wl.location_code,wl.occupied_bags,wl.capacity_bags,wl.current_weight,wl.status,wl.blocked
                             FROM gin_items gi
                             JOIN warehouse_invoices wi ON wi.invoice_id=gi.invoice_id
                             JOIN warehouse_locations wl ON wl.location_id=gi.location_id
                             WHERE gi.gin_id=? ORDER BY gi.gin_item_id FOR UPDATE");
        $items->execute([$ginId]);$rows=$items->fetchAll();if(!$rows)throw new RuntimeException('GIN has no issuing lines');
        $touchedInvoices=[];
        foreach($rows as $row){
            $qty=(int)$row['chests_issued'];$invoiceId=(int)$row['invoice_id'];$locationId=(int)$row['location_id'];$netEach=(float)$row['net_weight_each'];
            $a=$pdo->prepare('SELECT * FROM invoice_location_allocations WHERE invoice_id=? AND location_id=? FOR UPDATE');$a->execute([$invoiceId,$locationId]);$alloc=$a->fetch();
            if(!$alloc || (int)$alloc['chests_allocated']<$qty)throw new RuntimeException('Insufficient current stock at '.$row['location_code'].' for invoice '.$row['invoice_no']);
            $left=(int)$alloc['chests_allocated']-$qty;
            if($left<=0)$pdo->prepare('DELETE FROM invoice_location_allocations WHERE allocation_id=?')->execute([$alloc['allocation_id']]);
            else $pdo->prepare('UPDATE invoice_location_allocations SET chests_allocated=?,weight_allocated=? WHERE allocation_id=?')->execute([$left,round($left*$netEach,2),$alloc['allocation_id']]);
            $newOcc=max(0,(int)$row['occupied_bags']-$qty);$newWeight=max(0,(float)$row['current_weight']-($qty*$netEach));$cap=max(1,min(10,(int)$row['capacity_bags']));
            $newStatus=(int)$row['blocked']===1?'BLOCKED':($newOcc<=0?'EMPTY':($newOcc>=$cap?'FULL':'PARTIAL'));
            $pdo->prepare('UPDATE warehouse_locations SET occupied_bags=?,current_weight=?,status=? WHERE location_id=?')->execute([$newOcc,round($newWeight,2),$newStatus,$locationId]);
            $weight=round($qty*$netEach,2);
            $pdo->prepare('INSERT INTO invoice_stock_movements(invoice_id,location_id,movement_type,quantity_bags,weight,reference_type,reference_no,notes,created_by) VALUES(?,?,?,?,?,?,?,?,?)')->execute([$invoiceId,$locationId,'OUT',$qty,$weight,'GATE_PASS',$gin['gin_no'],'Dispatched through Gate Pass',$u['user_id']]);
            $touchedInvoices[$invoiceId]=true;
        }
        foreach(array_keys($touchedInvoices) as $invoiceId){
            $next=$pdo->prepare('SELECT ila.location_id,wl.location_code FROM invoice_location_allocations ila JOIN warehouse_locations wl ON wl.location_id=ila.location_id WHERE ila.invoice_id=? AND ila.chests_allocated>0 ORDER BY ila.allocated_at,ila.allocation_id LIMIT 1');$next->execute([$invoiceId]);$primary=$next->fetch();
            $pdo->prepare('UPDATE warehouse_invoices SET location_id=?,location_code=? WHERE invoice_id=?')->execute([$primary['location_id']??null,$primary['location_code']??null,$invoiceId]);
        }
        $gatePass=trim((string)($d['gate_pass_no']??''));if($gatePass==='')$gatePass='GP-'.date('Ymd-His').'-'.$ginId;
        $pdo->prepare("UPDATE gins SET dispatch_status='DISPATCHED',gate_pass_no=?,gate_passed_at=NOW(),gate_passed_by=? WHERE gin_id=?")->execute([$gatePass,$u['user_id'],$ginId]);
        $pdo->commit();logActivity('DISPATCH','GIN',$gin['gin_no'].' | Gate Pass '.$gatePass.' | stock released from warehouse locations');
        ok(['gin_id'=>$ginId,'gin_no'=>$gin['gin_no'],'dispatch_status'=>'DISPATCHED','gate_pass_no'=>$gatePass,'gate_passed_at'=>date('Y-m-d H:i:s')],'Gate Pass issued. Dispatched stock has been removed from warehouse locations and is now visible in Issued Inquiry.');
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();fail($e->getMessage(),400);}
case 'inquiry_issued':
    requirePermission('warehousing.inquiry');$q=trim((string)($_GET['q']??''));$from=trim((string)($_GET['from']??''));$to=trim((string)($_GET['to']??''));
    $sql="SELECT m.movement_id,m.created_at issued_at,m.reference_no gin_no,g.gate_pass_no,g.gate_passed_at,g.buyer,g.vehicle_no,wi.invoice_no,wi.mark,wi.selling_mark,wi.grade,wl.location_code,m.quantity_bags,m.weight
          FROM invoice_stock_movements m
          JOIN warehouse_invoices wi ON wi.invoice_id=m.invoice_id
          LEFT JOIN warehouse_locations wl ON wl.location_id=m.location_id
          LEFT JOIN gins g ON g.gin_no=m.reference_no
          WHERE m.movement_type='OUT'";$params=[];
    if($from!==''){$sql.=' AND DATE(m.created_at)>=?';$params[]=$from;}if($to!==''){$sql.=' AND DATE(m.created_at)<=?';$params[]=$to;}
    if($q!==''){$like="%{$q}%";$sql.=' AND (m.reference_no LIKE ? OR g.gate_pass_no LIKE ? OR g.buyer LIKE ? OR g.vehicle_no LIKE ? OR wi.invoice_no LIKE ? OR wi.mark LIKE ? OR wi.grade LIKE ? OR wl.location_code LIKE ?)';$params=array_merge($params,[$like,$like,$like,$like,$like,$like,$like,$like]);}
    $sql.=' ORDER BY m.created_at DESC,m.movement_id DESC LIMIT 500';$st=db()->prepare($sql);$st->execute($params);ok($st->fetchAll());
case 'invoice_ai_recommend':
    requireAnyPermission(['warehousing.invoice_add','warehousing.invoice_edit','warehousing.ai_allocation']);
    $d = $method === 'POST' ? body() : $_GET;
    $result = recommendInvoiceLocations($d, 12);
    if (!empty($result['profile']['grade_error'])) {
        fail((string)$result['profile']['grade_error'], 422, ['data'=>$result]);
    }
    if (!$result['candidates']) {
        ok($result, 'No safe location candidates are available for the entered details');
    }
    ok($result, $result['can_allocate'] ? 'AI allocation plan ready' : 'Only a partial allocation plan is currently possible');
case 'invoice_create':
    $u=requirePermission('warehousing.invoice_add');
    $d=body();
    $pdo=db();
    $pdo->beginTransaction();
    try{
        $result=createInvoiceWithinTransaction($pdo,$u,$d);
        $pdo->commit();
        $plan=$result['allocation_plan']??[];
        logActivity('CREATE','INVOICE',$result['invoice_no'].($plan?' | Auto allocated '.implode(', ',array_map(fn($x)=>$x['location_code'].' x'.$x['chests_allocated'],$plan)):' | Saved without allocation'));
        ok($result,$plan?'Invoice saved and location allocated successfully':'Invoice saved successfully');
    }catch(Throwable $e){
        if($pdo->inTransaction())$pdo->rollBack();
        $msg=$e->getCode()==='23000'?'Invoice number already exists':$e->getMessage();
        fail($msg,400);
    }
case 'invoice_create_turn':
    $u=requirePermission('warehousing.invoice_add');
    $d=body();
    $turn=is_array($d['turn']??null)?$d['turn']:[];
    $invoices=is_array($d['invoices']??null)?$d['invoices']:[];
    if(!$invoices) fail('Add at least one invoice to the turn before saving');
    $turnNo=trim((string)($turn['turnNo']??$turn['arrivalTurnNo']??''));
    $broker=trim((string)($turn['broker']??''));
    if($turnNo==='') fail('Turn No is required');
    if($broker==='') fail('Broker is required');

    $seen=[];
    foreach($invoices as $item){
        $n=strtoupper(trim((string)($item['invoiceNo']??'')));
        if($n==='') fail('Every grid row must have an Invoice Number');
        if(isset($seen[$n])) fail('Duplicate invoice number in this turn: '.$n);
        $seen[$n]=true;
    }

    $pdo=db();
    $pdo->beginTransaction();
    try{
        $saved=[];
        foreach($invoices as $item){
            if(!is_array($item)) throw new RuntimeException('Invalid invoice row');
            // Turn/header values are authoritative for every invoice in this save.
            $payload=array_merge($item,[
                'broker'=>$broker,
                'turnNo'=>$turnNo,
                'store'=>$turn['store']??'BrewSmart Warehouse',
                'date'=>$turn['date']??date('Y-m-d'),
                'vehicleNo'=>$turn['vehicleNo']??null,
                'driverName'=>$turn['driverName']??null,
                'driverNic'=>$turn['driverNic']??null,
                'invoiceYear'=>$item['invoiceYear']??($turn['invoiceYear']??date('Y'))
            ]);
            $saved[]=createInvoiceWithinTransaction($pdo,$u,$payload);
        }
        $pdo->commit();
        $totalBags=array_sum(array_map(fn($x)=>(int)($x['chests']??0),$invoices));
        $totalWeight=array_sum(array_map(fn($x)=>(float)($x['totalNetWeight']??((float)($x['chests']??0)*(float)($x['netWeightEach']??0))),$invoices));
        logActivity('CREATE','TURN',$turnNo.' | '.count($saved).' invoices | '.$totalBags.' bags');
        ok([
            'turn_no'=>$turnNo,
            'invoice_count'=>count($saved),
            'total_bags'=>$totalBags,
            'total_net_weight'=>round($totalWeight,2),
            'invoices'=>$saved
        ],'Turn saved successfully with all invoices and warehouse allocations');
    }catch(Throwable $e){
        if($pdo->inTransaction())$pdo->rollBack();
        $msg=$e->getCode()==='23000'?'One of the invoice numbers already exists':$e->getMessage();
        fail($msg,400);
    }
case 'invoice_list':
    requireAnyPermission(['warehousing.invoice_edit','warehousing.invoice_download','warehousing.inquiry','warehousing.reports']);
    $year=trim((string)($_GET['year']??''));
    $no=trim((string)($_GET['invoice_no']??''));
    $q=trim((string)($_GET['q']??''));
    $sql="SELECT wi.*,
                 COALESCE((SELECT COALESCE(NULLIF(u1.full_name,''),u1.username) FROM users u1 WHERE u1.user_id=wi.created_by LIMIT 1),'') entry_user,
                 COALESCE((SELECT COALESCE(NULLIF(u2.full_name,''),u2.username) FROM activity_logs al JOIN users u2 ON u2.user_id=al.user_id WHERE al.action='UPDATE' AND al.module='INVOICE' AND al.description=CONCAT('Updated invoice #',wi.invoice_id) ORDER BY al.log_id DESC LIMIT 1),'') updated_user,
                 COALESCE(GROUP_CONCAT(CONCAT(wl.location_code,' (',ila.chests_allocated,')') ORDER BY wl.location_code SEPARATOR ', '),wi.location_code) allocated_locations,
                 COALESCE(SUM(ila.chests_allocated),0) allocated_chests
          FROM warehouse_invoices wi
          LEFT JOIN invoice_location_allocations ila ON ila.invoice_id=wi.invoice_id
          LEFT JOIN warehouse_locations wl ON wl.location_id=ila.location_id
          WHERE 1=1";
    $p=[];
    if($year!==''){$sql.=' AND wi.invoice_year=?';$p[]=(int)$year;}
    if($no!==''){$sql.=' AND wi.invoice_no LIKE ?';$p[]="%$no%";}
    if($q!==''){$like="%$q%";$sql.=' AND (wi.invoice_no LIKE ? OR wi.mark LIKE ? OR wi.selling_mark LIKE ? OR wi.grade LIKE ? OR wi.packing_type LIKE ? OR wi.broker LIKE ? OR wi.buyer LIKE ? OR wi.store LIKE ? OR wi.location_code LIKE ? OR EXISTS(SELECT 1 FROM invoice_location_allocations qila JOIN warehouse_locations qwl ON qwl.location_id=qila.location_id WHERE qila.invoice_id=wi.invoice_id AND qwl.location_code LIKE ?))';$p=array_merge($p,[$like,$like,$like,$like,$like,$like,$like,$like,$like,$like]);}
    $sql.=' GROUP BY wi.invoice_id ORDER BY wi.invoice_id DESC LIMIT 200';
    $st=db()->prepare($sql);$st->execute($p);ok($st->fetchAll());
case 'invoice_get':
    requireAnyPermission(['warehousing.invoice_edit','warehousing.invoice_download','warehousing.inquiry']);
    $id=intParam('id');$no=trim((string)($_GET['invoice_no']??''));if(!$id&&$no==='')fail('id or invoice_no is required');
    $sql="SELECT wi.*,
                 COALESCE((SELECT COALESCE(NULLIF(u1.full_name,''),u1.username) FROM users u1 WHERE u1.user_id=wi.created_by LIMIT 1),'') entry_user,
                 COALESCE((SELECT COALESCE(NULLIF(u2.full_name,''),u2.username) FROM activity_logs al JOIN users u2 ON u2.user_id=al.user_id WHERE al.action='UPDATE' AND al.module='INVOICE' AND al.description=CONCAT('Updated invoice #',wi.invoice_id) ORDER BY al.log_id DESC LIMIT 1),'') updated_user,
                 COALESCE(GROUP_CONCAT(CONCAT(wl.location_code,' (',ila.chests_allocated,')') ORDER BY wl.location_code SEPARATOR ', '),wi.location_code) allocated_locations,
                 COALESCE(SUM(ila.chests_allocated),0) allocated_chests
          FROM warehouse_invoices wi
          LEFT JOIN invoice_location_allocations ila ON ila.invoice_id=wi.invoice_id
          LEFT JOIN warehouse_locations wl ON wl.location_id=ila.location_id
          WHERE ".($id?'wi.invoice_id=?':'wi.invoice_no=?')." GROUP BY wi.invoice_id";
    $st=db()->prepare($sql);$st->execute([$id?:$no]);$row=$st->fetch();if(!$row)fail('Invoice not found',404);ok($row);
case 'invoice_update':
    $u=requirePermission('warehousing.invoice_edit');$d=body();$id=(int)($d['invoice_id']??$d['invoiceId']??0);if(!$id)fail('invoice_id is required');
    $curSt=db()->prepare('SELECT * FROM warehouse_invoices WHERE invoice_id=?');$curSt->execute([$id]);$cur=$curSt->fetch();if(!$cur)fail('Invoice not found',404);
    $effectiveGrade=trim((string)($d['grade']??$cur['grade']??''));
    $effectiveWeight=(float)($d['netWeightEach']??$cur['net_weight_each']??0);
    $gradeCheck=gradeStorageProfile(db(),$effectiveGrade,$effectiveWeight);
    if(empty($gradeCheck['valid'])) fail((string)$gradeCheck['error'],422);
    $map=['invoiceYear'=>'invoice_year','mark'=>'mark','sellingMark'=>'selling_mark','grade'=>'grade','packingType'=>'packing_type','chestType'=>'chest_type','broker'=>'broker','buyer'=>'buyer','chests'=>'chests','weightPerChest'=>'weight_per_chest','netWeightEach'=>'net_weight_each','totalGrossWeight'=>'total_gross_weight','moistureContent'=>'moisture_content','mfdDate'=>'mfd_date','store'=>'store','date'=>'invoice_date','turnNo'=>'arrival_turn_no','arrivalTurnNo'=>'arrival_turn_no','vehicleNo'=>'arrival_vehicle_no','arrivalVehicleNo'=>'arrival_vehicle_no','driverName'=>'arrival_driver_name','arrivalDriverName'=>'arrival_driver_name','driverNic'=>'arrival_driver_nic','arrivalDriverNic'=>'arrival_driver_nic'];
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
    requireAnyPermission(['warehousing.grn_print','warehousing.grn_add_edit']);$date=trim((string)($_GET['date']??''));$no=trim((string)($_GET['grn_no']??''));$q=trim((string)($_GET['q']??''));$amalgamation=isset($_GET['amalgamation'])?(int)$_GET['amalgamation']:null;$brokerOnly=!empty($_GET['broker_only']);
    $sql="SELECT g.grn_id,g.grn_no,g.grn_date,g.store,g.turn_no,g.vehicle_no,g.driver_name,g.driver_nic,g.supplier,g.source_type,g.broker,g.buyer,g.mark,g.amalgamation,g.remarks,g.created_at,COALESCE(SUM(gi.received_chests),g.chests) chests,COUNT(DISTINCT gi.invoice_id) invoice_count,GROUP_CONCAT(DISTINCT wi.invoice_no ORDER BY wi.invoice_no SEPARATOR ', ') invoice_numbers,GROUP_CONCAT(DISTINCT wi.selling_mark ORDER BY wi.selling_mark SEPARATOR ', ') selling_marks FROM grns g LEFT JOIN grn_items gi ON gi.grn_id=g.grn_id LEFT JOIN warehouse_invoices wi ON wi.invoice_id=gi.invoice_id WHERE 1=1";$p=[];
    if($date!==''){$sql.=' AND g.grn_date=?';$p[]=$date;}if($no!==''){$sql.=' AND g.grn_no LIKE ?';$p[]="%{$no}%";}if($amalgamation!==null){$sql.=' AND g.amalgamation=?';$p[]=$amalgamation;}if($brokerOnly){$sql.=" AND g.source_type='BROKER'";}if($q!==''){$like="%{$q}%";$sql.=' AND (g.grn_no LIKE ? OR g.turn_no LIKE ? OR g.broker LIKE ? OR g.buyer LIKE ? OR g.mark LIKE ? OR g.vehicle_no LIKE ?)';$p=array_merge($p,[$like,$like,$like,$like,$like,$like]);}$sql.=' GROUP BY g.grn_id ORDER BY g.grn_date DESC,g.grn_id DESC LIMIT 300';$st=db()->prepare($sql);$st->execute($p);ok($st->fetchAll());
default: fail('Unknown API action',404);
}
