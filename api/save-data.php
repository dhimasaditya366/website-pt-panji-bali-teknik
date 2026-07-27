<?php
/**
 * Production save endpoint for shared PHP hosting (e.g. Hostinger).
 *
 * Mirrors what dev-server.py's /api/save-data does for local development:
 * the admin dashboard POSTs the full content object here, and this script
 * writes it straight to assets/js/data.js on the server. Because this runs
 * server-side on real hosting (not a per-browser localStorage trick), every
 * device that logs into admin.html gets automatic publishing with zero
 * per-device setup — no GitHub token, no settings panel to fill in.
 *
 * Deploy: upload this whole project (including this api/ folder) to your
 * Hostinger public_html via FTP/File Manager. Make sure assets/js/data.js
 * is writable by PHP (Hostinger's default file permissions already allow
 * this for files owned by your hosting account — no extra chmod needed in
 * most cases; if saves fail with a permission error, set assets/js/data.js
 * to 664 or 666 via File Manager > Permissions).
 *
 * Security note: SAVE_SECRET below is a shared value also present in
 * assets/js/admin.js (SAVE_ENDPOINT_SECRET). It stops random visitors from
 * finding this URL and overwriting your site's content, but — like the
 * admin login password — it lives in a public JS file, so it is not real
 * access control. If you want stronger protection, restrict this /api/
 * folder at the hosting level (e.g. an .htaccess rule limiting it to your
 * office IP), or ask your developer to move this behind real auth.
 *
 * To change the secret: pick a new long random string, update SAVE_SECRET
 * below, and update the matching SAVE_ENDPOINT_SECRET constant in
 * assets/js/admin.js to the exact same value.
 */

header('Content-Type: application/json; charset=utf-8');

const SAVE_SECRET = '272eff041649aebf6e7ec501cc6995ee2aaf7b34562b8a4e';

function respond($status, $payload) {
    http_response_code($status);
    echo json_encode($payload);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, ['ok' => false, 'error' => 'Method not allowed']);
}

$providedSecret = isset($_SERVER['HTTP_X_SAVE_SECRET']) ? $_SERVER['HTTP_X_SAVE_SECRET'] : '';
if (!hash_equals(SAVE_SECRET, $providedSecret)) {
    respond(401, ['ok' => false, 'error' => 'Unauthorized']);
}

$rawBody = file_get_contents('php://input');
$data = json_decode($rawBody, true);
if ($data === null && json_last_error() !== JSON_ERROR_NONE) {
    respond(400, ['ok' => false, 'error' => 'Invalid JSON body']);
}

$json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
if ($json === false) {
    respond(500, ['ok' => false, 'error' => 'Failed to encode data as JSON']);
}

$fileContent = "window.SITE_DEFAULTS = " . $json . ";\n";
$targetPath = __DIR__ . '/../assets/js/data.js';

$written = @file_put_contents($targetPath, $fileContent);
if ($written === false) {
    respond(500, ['ok' => false, 'error' => 'Could not write assets/js/data.js — check file permissions on the server.']);
}

respond(200, ['ok' => true]);
