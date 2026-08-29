<?php
// Optional browser setup helper. Import database/database.sql in phpMyAdmin first.
declare(strict_types=1);
require_once __DIR__ . '/config/database.php';
header('Content-Type: text/plain; charset=utf-8');
try {
    $pdo=db();
    echo "BrewSmart database connection: OK\n";
    echo "Database: brewsMart_db\n";
    echo "Default login: admin / admin123\n";
} catch(Throwable $e) { echo "Database connection failed.\n"; }
