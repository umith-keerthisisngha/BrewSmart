<?php
$host="localhost";$db="brewsmart";$user="root";$pass="";
$conn=new mysqli($host,$user,$pass,$db);
if($conn->connect_error){http_response_code(500);die("Database connection failed.");}
$conn->set_charset("utf8mb4");
?>