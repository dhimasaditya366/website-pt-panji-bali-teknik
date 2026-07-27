# Admin auto-publish proxy

Deployed at `https://panji-admin-proxy.panjibaliteknik.workers.dev`. Called by
`assets/js/admin.js` (`tryWriteProxy`) so the admin dashboard can publish
changes while hosted on GitHub Pages (which has no backend of its own)
without any admin ever entering a GitHub token.

Holds two secrets, set once via `wrangler secret put <NAME>` and never
committed anywhere:
- `GITHUB_TOKEN` — a fine-grained GitHub PAT scoped to only this repo,
  Contents: Read and write.
- `APP_SECRET` — a random value that must match `PROXY_APP_SECRET` in
  `assets/js/admin.js`. It only gates this one narrow action (overwrite
  `assets/js/data.js` in this one repo) — same trust model as
  `SAVE_ENDPOINT_SECRET` for the PHP endpoint.

## Redeploy after editing worker.js

```
cd cloudflare-worker
CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... npx wrangler deploy
```

## Rotate secrets

```
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put APP_SECRET   # also update PROXY_APP_SECRET in admin.js to match
```

## Once this site moves to Hostinger (or any real PHP host)

`api/save-data.php` takes over automatically (higher priority in the write
chain in admin.js) and this proxy is no longer needed for that host — it can
stay deployed as a harmless unused fallback, or be torn down via
`npx wrangler delete`.
