<?php
declare(strict_types=1);
require_once __DIR__ . '/../../backend/services/WarehouseRuleService.php';
function expectTrue(bool $value, string $message): void { if (!$value) { fwrite(STDERR,"FAIL: $message\n"); exit(1); } }
function expectFalse(bool $value, string $message): void { expectTrue(!$value,$message); }
function expectSame($a,$b,string $message): void { expectTrue($a===$b,$message.' expected '.var_export($b,true).' got '.var_export($a,true)); }
expectSame(WarehouseRuleService::effectiveBagCapacity(['capacity_bags'=>20]),10,'capacity must be capped at ten');
expectSame(WarehouseRuleService::effectiveBagCapacity(['capacity_bags'=>7]),7,'smaller configured capacity must be preserved');
foreach(['A','B','C'] as $level) expectTrue(WarehouseRuleService::validatesLevel(58,$level),"58kg should allow $level");
foreach(['D','E','F'] as $level) expectFalse(WarehouseRuleService::validatesLevel(58,$level),"58kg must reject $level");
expectTrue(WarehouseRuleService::validatesLevel(45,'F'),'45kg may use F when no other DB rule prohibits it');
echo "WarehouseRuleServiceTest: PASS\n";
