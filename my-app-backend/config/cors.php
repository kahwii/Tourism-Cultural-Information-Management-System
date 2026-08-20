<?php
// Shared CORS + JSON headers. Include this at the top of every API file.

// Only allow the app's own front-end origins.
$ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

// Allow explicit origins above, plus any Vercel deployment (production + preview builds).
$allowed = in_array($origin, $ALLOWED_ORIGINS, true)
    || (bool) preg_match('/^https:\/\/[a-z0-9-]+\.vercel\.app$/i', $origin);

if ($allowed) {
    header("Access-Control-Allow-Origin: $origin");
    header("Vary: Origin");
    header("Access-Control-Allow-Credentials: true");
}
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Content-Type: application/json");

// Preflight request — respond OK and stop.
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}
