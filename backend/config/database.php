<?php
declare(strict_types=1);

function db(): PDO {
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;
    $host = getenv('BREWSMART_DB_HOST') ?: '127.0.0.1';
    $port = getenv('BREWSMART_DB_PORT') ?: '3306';
    $name = getenv('BREWSMART_DB_NAME') ?: 'brewsMart_db';
    $user = getenv('BREWSMART_DB_USER') ?: 'root';
    $pass = getenv('BREWSMART_DB_PASS') ?: '';
    $dsn = "mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4";
    try {
        $pdo = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
        return $pdo;
    } catch (PDOException $e) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['success'=>false,'message'=>'Database connection failed. Check MySQL/database settings.']);
        exit;
    }
}
