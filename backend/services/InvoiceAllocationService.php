<?php
declare(strict_types=1);

// Invoice/arrival allocation domain functions. Kept outside the HTTP dispatcher
// so the endpoint file focuses on request routing and authorization.

function normalizeLevelList(?string $csv): array {
    if ($csv === null || trim($csv) === '') return [];
    $out = [];
    foreach (preg_split('/\s*,\s*/', strtoupper(trim($csv))) as $level) {
        if (preg_match('/^[A-F]$/', $level)) $out[$level] = true;
    }
    return array_keys($out);
}

function locationBagCapacity(array $location): int {
    return WarehouseRuleService::effectiveBagCapacity($location);
}

function gradeStorageProfile(PDO $pdo, string $gradeCode, float $bagWeight = 0.0): array {
    $gradeCode = trim($gradeCode);
    if ($gradeCode === '') {
        return ['valid'=>false,'error'=>'Grade is required.','grade'=>null];
    }
    try {
        $st = $pdo->prepare('SELECT grade_id,grade_code,grade_name,packing_density,min_bag_weight,max_bag_weight FROM tea_grades WHERE grade_code=? LIMIT 1');
        $st->execute([$gradeCode]);
        $grade = $st->fetch();
    } catch (Throwable $e) {
        return ['valid'=>false,'error'=>'Tea Grade storage profile is not installed. Import database/schema.sql for a fresh setup or the matching file under database/legacy_migrations for an existing setup.','grade'=>null];
    }
    if (!$grade) return ['valid'=>false,'error'=>'Selected grade does not exist in Grade Master.','grade'=>null];

    $density = $grade['packing_density'];
    $min = $grade['min_bag_weight'];
    $max = $grade['max_bag_weight'];
    if ($density === null || (float)$density <= 0 || $min === null || $max === null || (float)$min <= 0 || (float)$max <= 0) {
        return [
            'valid'=>false,
            'error'=>'Grade '.$grade['grade_code'].' is not configured. Set Packing Density and Min/Max Bag Weight in Brokering → Master → Grade.',
            'grade'=>$grade
        ];
    }
    if ((float)$min > (float)$max) {
        return ['valid'=>false,'error'=>'Grade '.$grade['grade_code'].' has an invalid weight range in Grade Master.','grade'=>$grade];
    }
    if ($bagWeight > 0 && ($bagWeight < (float)$min || $bagWeight > (float)$max)) {
        return [
            'valid'=>false,
            'error'=>sprintf('Grade %s accepts %.2f–%.2f kg per bag. Entered weight is %.2f kg.', $grade['grade_code'], (float)$min, (float)$max, $bagWeight),
            'grade'=>$grade
        ];
    }
    return ['valid'=>true,'error'=>null,'grade'=>$grade];
}

function invoiceAllocationProfile(array $d, ?PDO $pdo = null): array {
    $pdo ??= db();
    $bags = max(0, (int)($d['chests'] ?? $d['bags'] ?? 0));
    $bagWeightRaw = $d['netWeightEach'] ?? $d['net_weight_each'] ?? $d['weightPerChest'] ?? $d['weight_per_chest'] ?? null;
    $bagWeight = ($bagWeightRaw !== null && $bagWeightRaw !== '') ? (float)$bagWeightRaw : 0.0;
    $gradeCode = trim((string)($d['grade'] ?? $d['grade_code'] ?? ''));
    $packingCode = trim((string)($d['packingType'] ?? $d['packing_type'] ?? ''));
    $mark = trim((string)($d['mark'] ?? ''));

    $gradeCheck = gradeStorageProfile($pdo, $gradeCode, $bagWeight);
    $gradeRow = $gradeCheck['grade'] ?? null;
    $gradeId = $gradeRow ? (int)$gradeRow['grade_id'] : null;
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
        'packing_density' => $gradeRow && $gradeRow['packing_density'] !== null ? (float)$gradeRow['packing_density'] : null,
        'grade_min_bag_weight' => $gradeRow && $gradeRow['min_bag_weight'] !== null ? (float)$gradeRow['min_bag_weight'] : null,
        'grade_max_bag_weight' => $gradeRow && $gradeRow['max_bag_weight'] !== null ? (float)$gradeRow['max_bag_weight'] : null,
        'grade_valid' => (bool)($gradeCheck['valid'] ?? false),
        'grade_error' => $gradeCheck['error'] ?? null,
        'packing_type_id' => $packingId,
        'allowed_levels' => $allowed,
        'prohibited_levels' => $prohibited,
        'rules_applied' => $rulesApplied,
    ];
}

function recommendInvoiceLocations(array $d, int $limit = 12): array {
    $pdo = db();
    $p = invoiceAllocationProfile($d, $pdo);
    if (empty($p['grade_valid'])) return ['profile'=>$p,'candidates'=>[],'plan'=>[],'can_allocate'=>false,'remaining_bags'=>$p['bags']];
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

    // Python AI/optimization service ranks the candidates when available. The PHP
    // weighted scorer remains a deterministic fallback so warehouse operations never
    // become unavailable if the AI microservice is stopped.
    $aiFeatures = [];
    foreach ($candidates as $cand) {
        $aiFeatures[] = [
            'location_id'=>$cand['location_id'], 'location_code'=>$cand['location_code'],
            'capacity_fit'=>min(1.0, $p['bags']/max((int)$cand['usable_bags'],1)),
            'weight_fit'=>min(1.0, ($p['bags']*$p['bag_weight'])/max((float)$cand['free_weight'],0.01)),
            'consolidation'=>str_contains($cand['reason'],'same grade/mark')?1.0:(str_contains($cand['reason'],'clean empty')?0.72:0.45),
            'rack_balance'=>max(0.0,min(1.0,1.0-((float)(preg_match('/rack utilization ([0-9.]+)%/', $cand['reason'], $m)?$m[1]:50)/100.0))),
            'accessibility'=>max(0.45,1.0-(max(0,array_search($cand['level_code'],['A','B','C','D','E','F'],true))*0.1)),
            'adjacency'=>0.5,
            'fragmentation'=>min(1.0,(int)$cand['usable_bags']/max($p['bags'],1)),
        ];
    }
    $aiData=(new AIClient())->rank($aiFeatures, max(20,$limit));
    if ($aiData && !empty($aiData['ranked'])) {
        $byId=[]; foreach($candidates as $c) $byId[(int)$c['location_id']]=$c;
        $ranked=[];
        foreach($aiData['ranked'] as $r){
            $id=(int)($r['location_id']??0); if(!$id || !isset($byId[$id])) continue;
            $c=$byId[$id]; $c['score']=(float)($r['score']??$c['score']);
            $c['reason']=trim(($c['reason']??'').' AI factors: '.($r['explanation']??''));
            $c['score_breakdown']=$r['feature_scores']??null; $ranked[]=$c; unset($byId[$id]);
        }
        foreach($byId as $c) $ranked[]=$c;
        $candidates=$ranked;
        $modelVersion=(string)($aiData['model_version']??'BREWSMART-MCDM-2026.3');
    } else {
        usort($candidates, function($a,$b){
            $cmp = $b['score'] <=> $a['score'];
            if ($cmp !== 0) return $cmp;
            return strcmp($a['location_code'],$b['location_code']);
        });
        $modelVersion='PHP-MCDM-FALLBACK-2026.3';
    }

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
        'model_version'=>$modelVersion ?? 'PHP-MCDM-FALLBACK-2026.3',
        'rule_version'=>'RULE-2026.3',
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

function createInvoiceWithinTransaction(PDO $pdo, array $u, array $d): array {
    $no=trim((string)($d['invoiceNo']??''));
    $arrivalTurnNo=trim((string)($d['turnNo']??$d['arrivalTurnNo']??''));
    $chests=max(0,(int)($d['chests']??0));
    $netEachRaw=$d['netWeightEach']??null;
    $netEach=($netEachRaw!==null&&$netEachRaw!=='')?(float)$netEachRaw:0.0;
    if($no==='') throw new RuntimeException('Invoice number is required');
    if($arrivalTurnNo==='') throw new RuntimeException('Arrival / Turn Number is required so GRN can auto-load the arrival');
    if($chests<=0) throw new RuntimeException('Chests must be greater than 0');
    if($netEach<=0) throw new RuntimeException('Net Weight Each must be greater than 0 so net weight and safe location can be calculated');
    $gradeCode=trim((string)($d['grade']??''));
    $gradeCheck=gradeStorageProfile($pdo,$gradeCode,$netEach);
    if(empty($gradeCheck['valid'])) throw new RuntimeException((string)$gradeCheck['error']);

    $totalNetWeight=round($chests*$netEach,2);
    $autoAllocate=!empty($d['autoAllocate']);
    $selectedLocation=(int)($d['locationId']??0);
    $recommendation=recommendInvoiceLocations($d,8000);
    $plan=[];
    $allocationType='MANUAL';

    if($autoAllocate){
        if(!$recommendation['can_allocate']){
            throw new RuntimeException('Automatic location allocation could not fit invoice '.$no.' safely. Remaining chests: '.(int)$recommendation['remaining_bags']);
        }
        $plan=$recommendation['plan'];
        $allocationType='AI';
    }elseif($selectedLocation){
        $candidate=null;
        foreach($recommendation['candidates'] as $c){
            if((int)$c['location_id']===$selectedLocation){$candidate=$c;break;}
        }
        if(!$candidate) throw new RuntimeException('Selected location for invoice '.$no.' does not pass the current capacity/safety rules');
        if((int)$candidate['usable_bags']<$chests) throw new RuntimeException('Selected location cannot hold all chests for invoice '.$no.'. Enable AI Auto Allocate to split across safe locations.');
        $plan=[[
            'location_id'=>$candidate['location_id'],
            'location_code'=>$candidate['location_code'],
            'rack_code'=>$candidate['rack_code'],
            'level_code'=>$candidate['level_code'],
            'chests_allocated'=>$chests,
            'weight_allocated'=>$totalNetWeight,
            'score'=>$candidate['score'],
            'reason'=>$candidate['reason']
        ]];
    }

    $primary=$plan[0]??null;
    $explanation=$primary?($primary['reason']??''):null;
    $st=$pdo->prepare('INSERT INTO warehouse_invoices(invoice_year,invoice_no,mark,selling_mark,grade,packing_type,chest_type,broker,buyer,chests,weight_per_chest,net_weight_each,total_net_weight,total_gross_weight,moisture_content,mfd_date,sample_drawn,reprint,exportable,colour_separated,store,invoice_date,arrival_turn_no,arrival_vehicle_no,arrival_driver_name,arrival_driver_nic,location_id,location_code,allocation_score,allocation_model,allocation_explanation,allocation_type,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    $st->execute([
        (int)($d['invoiceYear']??date('Y')),$no,$d['mark']??null,$d['sellingMark']??null,$d['grade']??null,
        $d['packingType']??null,$d['chestType']??null,$d['broker']??null,null,$chests,
        (float)($d['weightPerChest']??0),$netEach,$totalNetWeight,
        isset($d['totalGrossWeight'])&&$d['totalGrossWeight']!==''?(float)$d['totalGrossWeight']:null,
        isset($d['moistureContent'])&&$d['moistureContent']!==''?(float)$d['moistureContent']:null,
        $d['mfdDate']??null,!empty($d['sampleDrawn'])?1:0,!empty($d['reprint'])?1:0,!empty($d['exportable'])?1:0,!empty($d['colourSeparated'])?1:0,
        $d['store']??null,$d['date']??date('Y-m-d'),
        $arrivalTurnNo,($d['vehicleNo']??$d['arrivalVehicleNo']??null)?:null,($d['driverName']??$d['arrivalDriverName']??null)?:null,($d['driverNic']??$d['arrivalDriverNic']??null)?:null,
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

    return [
        'invoice_id'=>$id,
        'invoice_no'=>$no,
        'total_net_weight'=>$totalNetWeight,
        'allocation_plan'=>$plan,
        'model_version'=>$recommendation['model_version']??null
    ];
}
