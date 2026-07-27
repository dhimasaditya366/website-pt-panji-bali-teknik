// Cloudflare Worker: holds the GitHub write credential server-side so the
// admin browser never needs a GitHub token. Accepts the full site data
// object from admin.js (gated by a narrow shared secret, not a GitHub
// token) and writes it to assets/js/data.js via the GitHub Contents API,
// using a GITHUB_TOKEN secret that only this Worker ever sees.

const OWNER = 'dhimasaditya366';
const REPO = 'website-pt-panji-bali-teknik';
const BRANCH = 'master';
const PATH = 'assets/js/data.js';

const ALLOWED_ORIGINS = [
  'https://dhimasaditya366.github.io',
  'http://localhost:8000',
  'http://127.0.0.1:8000'
];

function corsHeaders(origin) {
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-App-Secret',
    'Vary': 'Origin'
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
  });
}

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
}

function githubErrorMessage(status, errJson) {
  if (status === 401) return 'Token GitHub proxy tidak valid/kedaluwarsa.';
  if (status === 403) return 'Token GitHub proxy tidak punya izin cukup atau batas request tercapai.';
  if (status === 404) return 'Repo/branch/path tidak ditemukan.';
  return (errJson && errJson.message) || `Gagal menyimpan ke GitHub (HTTP ${status}).`;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (request.method !== 'POST') {
      return json({ ok: false, error: 'Method not allowed' }, 405, origin);
    }

    const appSecret = request.headers.get('X-App-Secret');
    if (!appSecret || appSecret !== env.APP_SECRET) {
      return json({ ok: false, error: 'Unauthorized' }, 401, origin);
    }

    let dataObj;
    try {
      dataObj = await request.json();
    } catch (e) {
      return json({ ok: false, error: 'Invalid JSON body' }, 400, origin);
    }

    const apiUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`;
    const headers = {
      Authorization: `token ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'panji-admin-proxy-worker'
    };
    const fileContent = 'window.SITE_DEFAULTS = ' + JSON.stringify(dataObj, null, 4) + ';\n';

    // Same sha-conflict retry as the client-side GitHub path: refetch and
    // retry once if another save landed between our GET and PUT.
    for (let attempt = 0; attempt < 2; attempt++) {
      const getRes = await fetch(`${apiUrl}?ref=${BRANCH}`, { headers });
      if (!getRes.ok) {
        return json({ ok: false, error: githubErrorMessage(getRes.status) }, 502, origin);
      }
      const getJson = await getRes.json();

      const putRes = await fetch(apiUrl, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Update konten via Admin Dashboard (proxy) ' + new Date().toISOString(),
          content: utf8ToBase64(fileContent),
          sha: getJson.sha,
          branch: BRANCH
        })
      });
      if (putRes.ok) {
        return json({ ok: true }, 200, origin);
      }
      if (putRes.status === 409 && attempt === 0) {
        continue;
      }
      const errJson = await putRes.json().catch(() => ({}));
      return json({ ok: false, error: githubErrorMessage(putRes.status, errJson) }, 502, origin);
    }
  }
};
