<?php
/*
  Database connection.

  Supports three environments from one file:

   1. Cloud (Render + TiDB Cloud, or any managed MySQL)
      Configured entirely through environment variables. Chosen automatically
      whenever DB_HOST is set, so nothing has to be edited at deploy time and
      no credentials live in the repository.

   2. Local XAMPP
      Falls back to db_credentials.php (gitignored). Unchanged behaviour —
      local development keeps working exactly as before.

   3. Legacy shared hosting (InfinityFree)
      Also via db_credentials.php, selected by hostname as it always was.

  TLS: TiDB Cloud REFUSES plaintext connections. A plain mysqli_connect()
  against it fails with a connection error that gives no hint about TLS, so
  the SSL path below is required, not optional.
*/

// ---------------------------------------------------------------
// 1. Cloud: environment variables win if they are present.
// ---------------------------------------------------------------
$envHost = getenv('DB_HOST') ?: ($_ENV['DB_HOST'] ?? '');

if ($envHost !== '') {
    $DB_HOST = $envHost;
    $DB_PORT = (int) (getenv('DB_PORT') ?: 4000);   // TiDB's default is 4000, MySQL's is 3306
    $DB_NAME = getenv('DB_NAME') ?: '';
    $DB_USER = getenv('DB_USER') ?: '';
    $DB_PASS = getenv('DB_PASS') ?: '';

    // Managed providers require TLS. Opt out only for a deliberately plaintext
    // host by setting DB_SSL=0 (e.g. a local docker-compose MySQL).
    $useSsl = (getenv('DB_SSL') ?: '1') !== '0';

    $conn = mysqli_init();
    if (!$conn) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => "Database driver unavailable."]);
        exit;
    }

    mysqli_options($conn, MYSQLI_OPT_CONNECT_TIMEOUT, 10);

    $flags = 0;
    if ($useSsl) {
        // No client cert/key — only the CA bundle, to verify the server.
        // DB_SSL_CA lets a different bundle be supplied; the default is the
        // system store installed by the Dockerfile.
        $ca = getenv('DB_SSL_CA') ?: '/etc/ssl/certs/ca-certificates.crt';
        mysqli_ssl_set($conn, null, null, is_readable($ca) ? $ca : null, null, null);
        $flags = MYSQLI_CLIENT_SSL;
    }

    $ok = @mysqli_real_connect($conn, $DB_HOST, $DB_USER, $DB_PASS, $DB_NAME, $DB_PORT, null, $flags);
    if (!$ok) {
        http_response_code(500);
        echo json_encode([
            "success" => false,
            // Say TLS out loud: the raw driver message for a TLS-required host
            // is unhelpful, and this is the single most likely cause.
            "error"   => "Database connection failed: " . mysqli_connect_error()
                       . ($useSsl ? "" : " (DB_SSL is off — managed databases such as TiDB Cloud require TLS)"),
        ]);
        exit;
    }

    mysqli_set_charset($conn, "utf8mb4");
    return;
}

// ---------------------------------------------------------------
// 2 & 3. Local XAMPP / legacy shared hosting.
// ---------------------------------------------------------------
// db_credentials.php is gitignored and excluded from the Docker image, so on a
// cloud deploy this file is genuinely absent. Reaching here means DB_HOST was
// never set — say that plainly instead of dying with "failed to open stream".
if (!file_exists(__DIR__ . "/db_credentials.php")) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "error"   => "Database is not configured. Set DB_HOST, DB_PORT, DB_NAME, DB_USER and DB_PASS "
                   . "in the hosting environment, or provide config/db_credentials.php for local development.",
    ]);
    exit;
}

require_once __DIR__ . "/db_credentials.php";

$host = $_SERVER['HTTP_HOST'] ?? '';
$isLocal = (strpos($host, 'localhost') !== false) || (strpos($host, '127.0.0.1') !== false);

if ($isLocal) {
    $DB_HOST = $DB_HOST_LOCAL;
    $DB_USER = $DB_USER_LOCAL;
    $DB_PASS = $DB_PASS_LOCAL;
    $DB_NAME = $DB_NAME_LOCAL;
} else {
    $DB_HOST = $DB_HOST_LIVE;
    $DB_USER = $DB_USER_LIVE;
    $DB_PASS = $DB_PASS_LIVE;
    $DB_NAME = $DB_NAME_LIVE;
}

$conn = mysqli_connect($DB_HOST, $DB_USER, $DB_PASS, $DB_NAME);

if (!$conn) {
    http_response_code(500);
    echo json_encode(["success" => false, "error" => "Database connection failed: " . mysqli_connect_error()]);
    exit;
}
mysqli_set_charset($conn, "utf8mb4");
