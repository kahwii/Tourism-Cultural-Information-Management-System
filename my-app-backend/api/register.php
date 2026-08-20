<?php
require_once "../config/cors.php";
require_once "../config/db.php";

$data = json_decode(file_get_contents("php://input"), true) ?: [];
$roleIn = isset($data['role']) ? strtolower(trim($data['role'])) : "tourist";

// SECURITY: public sign-ups may ONLY be Tourist or Establishment.
$allowed = ["tourist" => "Tourist", "establishment" => "Establishment"];
$role = $allowed[$roleIn] ?? "Tourist";

$password = isset($data['password']) ? trim($data['password']) : "";
if ($password === "") {
    http_response_code(400);
    echo json_encode(["error" => "Password is required."]);
    exit;
}
// Password policy: min 8, upper, lower, number, special symbol.
if (strlen($password) < 8
    || !preg_match('/[A-Z]/', $password)
    || !preg_match('/[a-z]/', $password)
    || !preg_match('/[0-9]/', $password)
    || !preg_match('/[^A-Za-z0-9]/', $password)) {
    http_response_code(400);
    echo json_encode(["error" => "Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special symbol."]);
    exit;
}
$hash = password_hash($password, PASSWORD_DEFAULT);
$esc = fn($v) => mysqli_real_escape_string($conn, trim((string)$v));

// Security question (for self-service password recovery). Required.
$secQuestion = trim($data['security_question'] ?? "");
$secAnswer   = trim($data['security_answer'] ?? "");
if ($secQuestion === "" || $secAnswer === "") {
    http_response_code(400);
    echo json_encode(["error" => "A security question and answer are required (used for password recovery)."]);
    exit;
}
$secAnswerHash = password_hash(strtolower($secAnswer), PASSWORD_DEFAULT); // case-insensitive

/* ============================================================
   TOURIST — simple username/password sign-up
   ============================================================ */
if ($role === "Tourist") {
    $username = isset($data['username']) ? trim($data['username']) : "";
    $emailIn  = isset($data['email']) ? trim($data['email']) : "";
    if ($username === "") {
        http_response_code(400);
        echo json_encode(["error" => "Username is required."]);
        exit;
    }
    if ($emailIn === "" || !filter_var($emailIn, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(["error" => "A valid email address is required (used for password recovery)."]);
        exit;
    }
    // username and email must both be unique
    $stmt = mysqli_prepare($conn, "SELECT id FROM users WHERE username = ? OR email = ?");
    mysqli_stmt_bind_param($stmt, "ss", $username, $emailIn);
    mysqli_stmt_execute($stmt);
    mysqli_stmt_store_result($stmt);
    if (mysqli_stmt_num_rows($stmt) > 0) {
        http_response_code(409);
        echo json_encode(["error" => "That username or email is already registered."]);
        exit;
    }
    mysqli_stmt_close($stmt);

    $stmt = mysqli_prepare($conn, "INSERT INTO users (username, email, password, security_question, security_answer, role, status) VALUES (?, ?, ?, ?, ?, 'Tourist', 'Active')");
    mysqli_stmt_bind_param($stmt, "sssss", $username, $emailIn, $hash, $secQuestion, $secAnswerHash);
    if (mysqli_stmt_execute($stmt)) {
        echo json_encode(["success" => true, "message" => "Registered successfully."]);
    } else {
        http_response_code(500);
        echo json_encode(["error" => "Registration failed: " . mysqli_error($conn)]);
    }
    exit;
}

/* ============================================================
   ESTABLISHMENT — full DOT-style accreditation account.
   Creates: user account + profile + an "Under Review"
   accreditation application visible to the admin.
   Login username = the registered email.
   ============================================================ */
$email = isset($data['email']) ? trim($data['email']) : "";
$businessName = isset($data['business_name']) ? trim($data['business_name']) : "";

if ($email === "" || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(["error" => "A valid email address is required."]);
    exit;
}
if ($businessName === "") {
    http_response_code(400);
    echo json_encode(["error" => "Business Name is required."]);
    exit;
}

// Business/Mayor's Permit No.: letters, digits, hyphens/slashes, 5-40 chars.
$permitNo = isset($data['business_permit_no']) ? trim($data['business_permit_no']) : "";
if ($permitNo === "" || !preg_match('/^[A-Za-z0-9\/-]{5,40}$/', $permitNo)) {
    http_response_code(400);
    echo json_encode(["error" => "A valid Business/Mayor's Permit Number is required (letters, numbers, - or /, 5-40 characters)."]);
    exit;
}
// must be unique across all applications — catches duplicate/fraudulent permit numbers
$stmt = mysqli_prepare($conn, "SELECT id FROM certificates WHERE business_permit_no = ?");
mysqli_stmt_bind_param($stmt, "s", $permitNo);
mysqli_stmt_execute($stmt);
mysqli_stmt_store_result($stmt);
if (mysqli_stmt_num_rows($stmt) > 0) {
    http_response_code(409);
    echo json_encode(["error" => "This Business/Mayor's Permit Number is already registered under another application."]);
    exit;
}
mysqli_stmt_close($stmt);

// email (used as username) must be unique
$stmt = mysqli_prepare($conn, "SELECT id FROM users WHERE username = ? OR email = ?");
mysqli_stmt_bind_param($stmt, "ss", $email, $email);
mysqli_stmt_execute($stmt);
mysqli_stmt_store_result($stmt);
if (mysqli_stmt_num_rows($stmt) > 0) {
    http_response_code(409);
    echo json_encode(["error" => "An account with this email already exists."]);
    exit;
}
mysqli_stmt_close($stmt);

// 1) create the user account (username = email)
$stmt = mysqli_prepare($conn, "INSERT INTO users (username, email, password, security_question, security_answer, role, status) VALUES (?, ?, ?, ?, ?, 'Establishment', 'Active')");
mysqli_stmt_bind_param($stmt, "sssss", $email, $email, $hash, $secQuestion, $secAnswerHash);
if (!mysqli_stmt_execute($stmt)) {
    http_response_code(500);
    echo json_encode(["error" => "Registration failed: " . mysqli_error($conn)]);
    exit;
}
$uid = mysqli_insert_id($conn);

// 2) save the full profile
$firstName  = $esc($data['first_name']  ?? "");
$middleName = $esc($data['middle_name'] ?? "");
$lastName   = $esc($data['last_name']   ?? "");
$sex        = $esc($data['sex']         ?? "");
$accountType = $esc($data['account_type'] ?? "");
$bName      = $esc($businessName);
$estType    = $esc($data['establishment_type'] ?? "Tourism Business");
$region     = $esc($data['region']     ?? "");
$province   = $esc($data['province']   ?? "");
$city       = $esc($data['city']       ?? "");
$barangay   = $esc($data['barangay']   ?? "");
$bAddress   = $esc($data['business_address'] ?? "");
$zip        = $esc($data['zip_code']   ?? "");
$mobile     = $esc($data['mobile']     ?? "");
$telephone  = $esc($data['telephone']  ?? "");
$emailEsc   = $esc($email);

mysqli_query($conn, "INSERT INTO establishment_profiles
  (user_id, first_name, middle_name, last_name, sex, account_type, business_name, establishment_type,
   region, province, city, barangay, business_address, zip_code, mobile, telephone)
  VALUES ($uid, '$firstName', '$middleName', '$lastName', '$sex', '$accountType', '$bName', '$estType',
   '$region', '$province', '$city', '$barangay', '$bAddress', '$zip', '$mobile', '$telephone')");

// 3) auto-create the accreditation application the admin will see
$applicant = trim($firstName . " " . $lastName);
$fullAddr  = trim($bAddress
              . ($barangay ? ", Brgy. $barangay" : "")
              . ($city ? ", $city" : "")
              . ($province ? ", $province" : "")
              . ($zip ? " $zip" : ""));
$today = date('n/j/Y');

$permitNoEsc = $esc($permitNo);
mysqli_query($conn, "INSERT INTO certificates
  (owner_id, establishment, type, business_permit_no, applicant, contact, address, submitted_date, status)
  VALUES ($uid, '$bName', '$estType', '$permitNoEsc', '" . $esc($applicant) . "', '$mobile', '" . $esc($fullAddr) . "', '$today', 'Under Review')");

echo json_encode([
    "success" => true,
    "message" => "Registered successfully. Your application has been submitted for review.",
    "login_hint" => "Sign in using your email: $email"
]);
