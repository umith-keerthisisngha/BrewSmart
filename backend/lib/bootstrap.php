<?php
declare(strict_types=1);
require_once __DIR__ . '/../config/database.php';

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed = ['http://localhost:5173','http://127.0.0.1:5173','http://localhost','http://127.0.0.1'];
if ($origin && in_array($origin, $allowed, true)) {
    header("Access-Control-Allow-Origin: {$origin}");
    header('Access-Control-Allow-Credentials: true');
} else {
    header('Access-Control-Allow-Origin: http://localhost:5173');
    header('Access-Control-Allow-Credentials: true');
}
header('Access-Control-Allow-Headers: Content-Type, X-Requested-With');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Content-Type: application/json; charset=utf-8');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_set_cookie_params(['httponly'=>true,'samesite'=>'Lax']);
    session_start();
}

function body(): array {
    $raw = file_get_contents('php://input');
    if (!$raw) return $_POST ?: [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : ($_POST ?: []);
}
function ok($data = [], string $message='OK', int $status=200): never {
    http_response_code($status); echo json_encode(['success'=>true,'message'=>$message,'data'=>$data], JSON_UNESCAPED_UNICODE); exit;
}
function fail(string $message, int $status=400, array $extra=[]): never {
    http_response_code($status); echo json_encode(array_merge(['success'=>false,'message'=>$message],$extra), JSON_UNESCAPED_UNICODE); exit;
}
function requireLogin(): array {
    if (empty($_SESSION['user_id'])) fail('Authentication required',401);
    return ['user_id'=>(int)$_SESSION['user_id'],'username'=>$_SESSION['user'] ?? '', 'display_name'=>$_SESSION['display_name'] ?? '', 'role'=>$_SESSION['role'] ?? 'WAREHOUSE_STAFF'];
}
function requireRole(array $roles): array {
    $u = requireLogin(); if (!in_array($u['role'],$roles,true)) fail('Access denied',403); return $u;
}

function permissionBaseKey(string $permissionKey): string {
    if (str_starts_with($permissionKey, 'brokering.')) return 'brokering';
    if (str_starts_with($permissionKey, 'warehousing.')) return 'warehousing';
    if (str_starts_with($permissionKey, 'master.')) return 'master';
    return $permissionKey;
}

function hasPermission(array $user, string $permissionKey): bool {
    if (($user['role'] ?? '') === 'ADMIN') return true;

    // Access Manager is deliberately reserved for Admin/Manager operators.
    if ($permissionKey === 'master.access_manager' && ($user['role'] ?? '') === 'MANAGER') return true;

    $pdo = db();

    // A user-specific rule always wins over the role default.
    $st = $pdo->prepare('SELECT has_access FROM user_permissions WHERE user_id=? AND permission_key=? LIMIT 1');
    try {
        $st->execute([(int)$user['user_id'], $permissionKey]);
        $value = $st->fetchColumn();
        if ($value !== false) return (bool)$value;
    } catch (Throwable $e) {
        // Allows the app to keep working before the access migration is imported.
    }

    // Fine-grained role default.
    $st = $pdo->prepare('SELECT has_access FROM role_permissions WHERE role=? AND page_key=? LIMIT 1');
    $st->execute([$user['role'], $permissionKey]);
    $value = $st->fetchColumn();
    if ($value !== false) return (bool)$value;

    // Backward-compatible broad module default (brokering / warehousing / master).
    $base = permissionBaseKey($permissionKey);
    if ($base !== $permissionKey) {
        $st = $pdo->prepare('SELECT has_access FROM role_permissions WHERE role=? AND page_key=? LIMIT 1');
        $st->execute([$user['role'], $base]);
        $value = $st->fetchColumn();
        if ($value !== false) return (bool)$value;
    }

    return false;
}

function requirePermission(string $permissionKey): array {
    $u = requireLogin();
    if (!hasPermission($u, $permissionKey)) fail('Access denied for this function', 403, ['permission_key'=>$permissionKey]);
    return $u;
}

function requireAnyPermission(array $permissionKeys): array {
    $u = requireLogin();
    foreach ($permissionKeys as $key) {
        if (hasPermission($u, $key)) return $u;
    }
    fail('Access denied for this function', 403);
}

function canManageTargetUser(array $actor, array $target): bool {
    if (($actor['role'] ?? '') === 'ADMIN') return true;
    if (($actor['role'] ?? '') !== 'MANAGER') return false;
    return !in_array(($target['role'] ?? ''), ['ADMIN','MANAGER'], true);
}
function logActivity(string $action,string $module,string $description=''): void {
    try { $st=db()->prepare('INSERT INTO activity_logs(user_id,action,module,description) VALUES(?,?,?,?)'); $st->execute([$_SESSION['user_id'] ?? null,$action,$module,$description]); } catch(Throwable $e) {}
}
function intParam(string $key, int $default=0): int { return isset($_GET[$key]) && is_numeric($_GET[$key]) ? (int)$_GET[$key] : $default; }
