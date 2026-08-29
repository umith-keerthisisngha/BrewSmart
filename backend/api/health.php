<?php
declare(strict_types=1);
require_once __DIR__ . '/../lib/bootstrap.php';
try { db()->query('SELECT 1'); echo json_encode(['success'=>true,'status'=>'healthy','database'=>'connected']); }
catch(Throwable $e){ http_response_code(500); echo json_encode(['success'=>false,'status'=>'unhealthy','database'=>'failed']); }
