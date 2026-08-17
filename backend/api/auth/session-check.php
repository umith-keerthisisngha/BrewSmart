<?php
header("Access-Control-Allow-Origin: http://localhost:5173");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json");

session_start();

if (isset($_SESSION['user'])) {
    echo json_encode([
        "loggedIn" => true,
        "user" => $_SESSION['user'],
        "display_name" => $_SESSION['display_name']
    ]);
} else {
    http_response_code(401);
    echo json_encode(["loggedIn" => false]);
}