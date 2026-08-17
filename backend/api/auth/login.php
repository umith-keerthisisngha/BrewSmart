<?php
header("Access-Control-Allow-Origin: http://localhost:5173");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

session_start();

// Hardcoded credentials (temporary)
$VALID_USERNAME = "admin";
$VALID_PASSWORD = "password";
$DISPLAY_NAME = "Umith Keerthisingha";

$data = json_decode(file_get_contents("php://input"), true);

$username = $data['username'] ?? '';
$password = $data['password'] ?? '';

if ($username === $VALID_USERNAME && $password === $VALID_PASSWORD) {
    $_SESSION['user'] = $username;
    $_SESSION['display_name'] = $DISPLAY_NAME;

    echo json_encode([
        "success" => true,
        "message" => "Login successful",
        "user" => $username,
        "display_name" => $DISPLAY_NAME
    ]);
} else {
    http_response_code(401);
    echo json_encode([
        "success" => false,
        "message" => "Invalid username or password"
    ]);
}