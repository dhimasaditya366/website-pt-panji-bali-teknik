// Admin dashboard logic. Reads the merged SiteStore data into an in-memory
// `state` object, lets the user edit it through plain form fields, and only
// writes back to localStorage when "Simpan Perubahan" is clicked.
//
// IMPORTANT (read before changing ADMIN_PASSPHRASE_HASH): this login gate
// runs entirely in the browser. The password itself is never stored in this
// file — only its SHA-256 hash — so reading this source (or view-source on
// the published page) does not hand someone the plaintext password. It is
// still not real access control: a hash can be brute-forced offline, and
// nothing stops someone from reading SiteStore's data directly via the
// browser console once the page has loaded. Real protection for a static
// site means restricting access to admin.html at the hosting layer
// (host-level password protection, a Cloudflare Access rule, etc.).
//
// To change the password, compute a new hash and replace the value below:
//   crypto.subtle.digest('SHA-256', new TextEncoder().encode('your-new-password'))
//     .then(buf => console.log(Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')));
const ADMIN_PASSPHRASE_HASH = '67e45bdcbf1e328f35410448aa3cee7e04803426824577831e9bd499ca57c780';

async function sha256Hex(text) {
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

let state = null;

document.addEventListener('DOMContentLoaded', () => {
    setupLoginGate();
    setupPasswordToggles();
});

// Session expires after 1 hour of no mouse/keyboard/touch activity. Closing
// the tab/window already logs the admin out on its own — sessionStorage
// (unlike localStorage) is cleared automatically by the browser when the
// tab closes, so no extra code is needed for that case.
const SESSION_TIMEOUT_MS = 60 * 60 * 1000;
const LAST_ACTIVITY_KEY = 'pbt_admin_last_activity';
let sessionTimeoutInterval = null;

function setupLoginGate() {
    const gate = document.getElementById('loginGate');
    const dashboard = document.getElementById('dashboard');
    const form = document.getElementById('loginForm');
    const passwordInput = document.getElementById('loginPassword');
    const errorMsg = document.getElementById('loginError');

    const alreadyAuthed = sessionStorage.getItem('pbt_admin_authed') === 'yes';
    if (alreadyAuthed) {
        gate.classList.add('hidden');
        dashboard.classList.remove('hidden');
        initDashboard();
        return;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;
        const inputHash = await sha256Hex(passwordInput.value);
        if (submitBtn) submitBtn.disabled = false;

        if (inputHash === ADMIN_PASSPHRASE_HASH) {
            sessionStorage.setItem('pbt_admin_authed', 'yes');
            errorMsg.classList.add('hidden');
            gate.classList.add('hidden');
            dashboard.classList.remove('hidden');
            initDashboard();
        } else {
            errorMsg.classList.remove('hidden');
            passwordInput.value = '';
            passwordInput.focus();
        }
    });
}

function forceLogout(message) {
    if (sessionTimeoutInterval) clearInterval(sessionTimeoutInterval);
    sessionStorage.removeItem('pbt_admin_authed');
    sessionStorage.removeItem(LAST_ACTIVITY_KEY);
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('loginGate').classList.remove('hidden');
    document.getElementById('loginPassword').value = '';
    const errorMsg = document.getElementById('loginError');
    if (message && errorMsg) {
        errorMsg.textContent = message;
        errorMsg.classList.remove('hidden');
    }
}

function setupSessionTimeout() {
    const touch = () => sessionStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    touch();
    ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach((evt) => {
        window.addEventListener(evt, touch, { passive: true });
    });

    if (sessionTimeoutInterval) clearInterval(sessionTimeoutInterval);
    sessionTimeoutInterval = setInterval(() => {
        const last = Number(sessionStorage.getItem(LAST_ACTIVITY_KEY) || 0);
        if (Date.now() - last > SESSION_TIMEOUT_MS) {
            forceLogout('Sesi berakhir karena tidak ada aktivitas selama 1 jam. Silakan masuk kembali.');
        }
    }, 30 * 1000);
}

function setupPasswordToggles() {
    document.querySelectorAll('[data-toggle-password]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const input = document.getElementById(btn.dataset.togglePassword);
            if (!input) return;
            const icon = btn.querySelector('.material-symbols-outlined');
            const willShow = input.type === 'password';
            input.type = willShow ? 'text' : 'password';
            if (icon) icon.textContent = willShow ? 'visibility_off' : 'visibility';
            btn.setAttribute('aria-label', willShow ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi');
        });
    });
}

// ---- Toast notifications ----
function showToast(message, type) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const isError = type === 'error';
    const toast = document.createElement('div');
    toast.className = (isError ? 'bg-error text-on-error' : 'bg-secondary text-on-primary')
        + ' px-md py-3 rounded-lg shadow-2xl text-sm font-medium flex items-center gap-xs max-w-sm pointer-events-auto hero-enter';
    const icon = document.createElement('span');
    icon.className = 'material-symbols-outlined text-lg';
    icon.textContent = isError ? 'error' : 'check_circle';
    const text = document.createElement('span');
    text.textContent = message;
    toast.appendChild(icon);
    toast.appendChild(text);
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.transition = 'opacity 300ms ease, transform 300ms ease';
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(8px)';
        setTimeout(() => toast.remove(), 320);
    }, 3500);
}

// ---- Reusable confirm modal (save / reset / logout all use this) ----
function showConfirmModal(opts) {
    const modal = document.getElementById('confirmModal');
    if (!modal) {
        if (opts.onConfirm) opts.onConfirm();
        return;
    }
    const titleEl = document.getElementById('confirmModalTitle');
    const msgEl = document.getElementById('confirmModalMessage');
    const iconEl = document.getElementById('confirmModalIcon');
    const cancelBtn = document.getElementById('confirmModalCancel');
    const confirmBtn = document.getElementById('confirmModalConfirm');

    titleEl.textContent = opts.title || 'Konfirmasi';
    msgEl.textContent = opts.message || 'Apakah Anda yakin?';
    confirmBtn.textContent = opts.confirmLabel || 'Ya, Lanjutkan';
    iconEl.textContent = opts.danger ? 'warning' : 'help';
    confirmBtn.className = 'px-md py-2 rounded-lg font-bold transition text-sm '
        + (opts.danger ? 'bg-error text-on-error hover:brightness-110' : 'bg-secondary text-on-primary hover:brightness-110');

    modal.classList.remove('hidden');

    function cleanup() {
        modal.classList.add('hidden');
        confirmBtn.removeEventListener('click', onConfirmClick);
        cancelBtn.removeEventListener('click', onCancelClick);
    }
    function onConfirmClick() {
        cleanup();
        if (opts.onConfirm) opts.onConfirm();
    }
    function onCancelClick() {
        cleanup();
    }
    confirmBtn.addEventListener('click', onConfirmClick);
    cancelBtn.addEventListener('click', onCancelClick);
}

function initDashboard() {
    state = window.SiteStore.get();
    setStatus(window.SiteStore.hasOverrides()
        ? 'Menampilkan perubahan tersimpan di browser ini.'
        : 'Menampilkan konten bawaan (belum ada perubahan tersimpan).');

    setupTabs();
    populateSimpleFields();
    bindSimpleFieldListeners();
    bindImageUploads();
    renderStats();
    renderCategories();
    renderProducts();
    bindActionButtons();
    setupGithubSyncSettings();
    setupSessionTimeout();
}

function setStatus(text) {
    const el = document.getElementById('statusText');
    if (el) el.textContent = text;
}

// ---- path helpers (supports "company.hours.weekday" and "company.taglines.0") ----
function getPath(obj, path) {
    return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}
function setPath(obj, path, value) {
    const keys = path.split('.');
    let cur = obj;
    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (cur[key] == null) cur[key] = /^\d+$/.test(keys[i + 1]) ? [] : {};
        cur = cur[key];
    }
    cur[keys[keys.length - 1]] = value;
}

// ---- Tabs ----
function setupTabs() {
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach((btn) => {
        btn.addEventListener('click', () => {
            buttons.forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('[data-tab-panel]').forEach((panel) => {
                panel.classList.toggle('hidden', panel.dataset.tabPanel !== btn.dataset.tab);
            });
        });
    });
}

// ---- Simple [data-field] inputs (text/textarea, dot-path bound) ----
function populateSimpleFields() {
    document.querySelectorAll('[data-field]').forEach((el) => {
        const value = getPath(state, el.dataset.field);
        el.value = value == null ? '' : value;
    });
    updateImagePreviews();
}

function bindSimpleFieldListeners() {
    document.querySelectorAll('[data-field]').forEach((el) => {
        el.addEventListener('input', () => {
            setPath(state, el.dataset.field, el.value);
            updateImagePreviews();
        });
    });
}

function updateImagePreviews() {
    const logoPreview = document.getElementById('logoPreview');
    if (logoPreview && state.company.logo) logoPreview.src = state.company.logo;
    const heroPreview = document.getElementById('heroImgPreview');
    if (heroPreview && state.hero.image) heroPreview.src = state.hero.image;

    // Generic convention used by the "Foto Halaman Lain" tab: an <img
    // id="preview_<data-field-path>"> next to any [data-image-field]/[data-field]
    // pair automatically reflects that field's current value.
    document.querySelectorAll('[data-image-field]').forEach((input) => {
        const path = input.dataset.imageField;
        const preview = document.getElementById('preview_' + path);
        const value = getPath(state, path);
        if (preview && value) preview.src = value;
    });
}

// ---- Image uploads: convert to base64 data URI, store directly in state ----
function bindImageUploads() {
    document.querySelectorAll('[data-image-field]').forEach((input) => {
        input.addEventListener('change', () => {
            const file = input.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                const path = input.dataset.imageField;
                setPath(state, path, reader.result);
                const sibling = input.parentElement.parentElement.querySelector(`[data-field="${path}"]`);
                if (sibling) sibling.value = reader.result;
                updateImagePreviews();
            };
            reader.readAsDataURL(file);
        });
    });
}

// ---- Stats (fixed length 4) ----
function renderStats() {
    const container = document.getElementById('statsFields');
    const tpl = document.getElementById('tplStat');
    container.innerHTML = '';
    (state.stats || []).forEach((stat, index) => {
        const node = tpl.content.cloneNode(true);
        const inputs = node.querySelectorAll('[data-stat-field]');
        inputs.forEach((input) => {
            const field = input.dataset.statField;
            input.value = stat[field] || '';
            input.addEventListener('input', () => {
                state.stats[index][field] = input.value;
            });
        });
        container.appendChild(node);
    });
}

// ---- Categories (add/remove, icon = symbol name or uploaded image) ----
function renderCategories() {
    const container = document.getElementById('categoryFields');
    const tpl = document.getElementById('tplCategory');
    container.innerHTML = '';
    (state.categories || []).forEach((cat, index) => {
        if (!cat.iconType) cat.iconType = 'symbol';
        const node = tpl.content.cloneNode(true);
        const card = node.querySelector('[data-category-card]');
        const preview = node.querySelector('[data-cat-icon-preview]');
        const symbolWrap = node.querySelector('[data-cat-icon-symbol-wrap]');
        const imageWrap = node.querySelector('[data-cat-icon-image-wrap]');

        function refreshPreview() {
            if (state.categories[index].iconType === 'image' && state.categories[index].icon) {
                preview.innerHTML = `<img alt="" class="w-full h-full object-cover" src="${state.categories[index].icon}"/>`;
            } else {
                preview.innerHTML = `<span class="material-symbols-outlined text-lg text-secondary">${state.categories[index].icon || 'category'}</span>`;
            }
        }

        function toggleIconInputs() {
            const isImage = state.categories[index].iconType === 'image';
            symbolWrap.classList.toggle('hidden', isImage);
            imageWrap.classList.toggle('hidden', !isImage);
        }

        node.querySelectorAll('[data-cat-field]').forEach((input) => {
            const field = input.dataset.catField;
            input.value = cat[field] || (field === 'iconType' ? 'symbol' : '');
            input.addEventListener('input', () => {
                state.categories[index][field] = input.value;
                if (field === 'icon') refreshPreview();
            });
            if (input.tagName === 'SELECT') {
                input.addEventListener('change', () => {
                    state.categories[index][field] = input.value;
                    if (field === 'iconType') {
                        toggleIconInputs();
                        refreshPreview();
                    }
                });
            }
        });

        const iconUpload = node.querySelector('[data-cat-icon-upload]');
        iconUpload.addEventListener('change', () => {
            const file = iconUpload.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                state.categories[index].icon = reader.result;
                refreshPreview();
            };
            reader.readAsDataURL(file);
        });

        node.querySelector('[data-action="remove-category"]').addEventListener('click', () => {
            const usedByProducts = (state.products || []).filter((p) => p.category === state.categories[index].id).length;
            const warning = usedByProducts
                ? `\n\n${usedByProducts} produk masih memakai kategori ini — produk tersebut tidak akan terhapus, hanya kehilangan jangkar link kategorinya.`
                : '';
            if (!confirm(`Hapus kategori "${state.categories[index].label || state.categories[index].id}"?${warning}`)) return;
            state.categories.splice(index, 1);
            renderCategories();
        });

        toggleIconInputs();
        refreshPreview();
        container.appendChild(card);
    });
}

// ---- Products (full CRUD) ----
function renderProducts() {
    const container = document.getElementById('productList');
    const tpl = document.getElementById('tplProduct');
    container.innerHTML = '';
    (state.products || []).forEach((product, index) => {
        const node = tpl.content.cloneNode(true);
        const card = node.querySelector('[data-product-card]');

        const skuLabel = node.querySelector('[data-product-field="skuLabel"]');
        if (skuLabel) skuLabel.textContent = product.sku || '(SKU baru)';

        const preview = node.querySelector('[data-product-field="imagePreview"]');
        if (preview && product.image) preview.src = product.image;

        const categorySelect = node.querySelector('[data-product-field="category"]');
        if (categorySelect) {
            categorySelect.innerHTML = (state.categories || []).map((c) =>
                `<option value="${c.id}">${c.label}</option>`).join('');
            categorySelect.value = product.category || '';
            categorySelect.addEventListener('change', () => {
                state.products[index].category = categorySelect.value;
            });
        }

        const priceWraps = node.querySelectorAll('[data-price-field-wrap]');
        function togglePriceFields() {
            const hidden = !!state.products[index].hidePrice;
            priceWraps.forEach((wrap) => {
                wrap.classList.toggle('opacity-40', hidden);
                wrap.querySelectorAll('input').forEach((inp) => { inp.disabled = hidden; });
            });
        }

        node.querySelectorAll('[data-product-field]').forEach((el) => {
            const field = el.dataset.productField;
            if (field === 'skuLabel' || field === 'imagePreview' || field === 'category') return;
            if (field === 'hidePrice') {
                el.checked = !!product.hidePrice;
                el.addEventListener('change', () => {
                    state.products[index].hidePrice = el.checked;
                    togglePriceFields();
                });
                return;
            }
            const currentVal = product[field];
            el.value = currentVal == null ? '' : currentVal;
            if (field === 'status') el.value = product.status || 'tersedia';
            el.addEventListener('input', () => {
                let value = el.value;
                if (field === 'price') value = Number(value) || 0;
                state.products[index][field] = value;
                if (field === 'sku' && skuLabel) skuLabel.textContent = value || '(SKU baru)';
                if (field === 'image' && preview) preview.src = value;
            });
            if (el.tagName === 'SELECT') {
                el.addEventListener('change', () => {
                    state.products[index][field] = el.value;
                });
            }
        });
        togglePriceFields();

        const imageUpload = node.querySelector('[data-product-image-upload]');
        if (imageUpload) {
            imageUpload.addEventListener('change', () => {
                const file = imageUpload.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                    state.products[index].image = reader.result;
                    if (preview) preview.src = reader.result;
                    const imageTextInput = imageUpload.parentElement.querySelector('[data-product-field="image"]');
                    if (imageTextInput) imageTextInput.value = reader.result;
                };
                reader.readAsDataURL(file);
            });
        }

        // Specs (dynamic key/value rows)
        const specsList = node.querySelector('[data-specs-list]');
        function renderSpecs() {
            specsList.innerHTML = '';
            const specs = state.products[index].specs || {};
            Object.keys(specs).forEach((key) => {
                addSpecRow(specsList, key, specs[key], index);
            });
        }
        renderSpecs();

        const addSpecBtn = node.querySelector('[data-action="add-spec"]');
        addSpecBtn.addEventListener('click', () => {
            if (!state.products[index].specs) state.products[index].specs = {};
            addSpecRow(specsList, '', '', index);
        });

        const removeBtn = node.querySelector('[data-action="remove-product"]');
        removeBtn.addEventListener('click', () => {
            if (!confirm(`Hapus produk "${state.products[index].name || state.products[index].sku}"?`)) return;
            state.products.splice(index, 1);
            renderProducts();
        });

        container.appendChild(card);
    });
}

function addSpecRow(specsList, key, value, productIndex) {
    const tpl = document.getElementById('tplSpecRow');
    const node = tpl.content.cloneNode(true);
    const row = node.querySelector('[data-spec-row]');
    const keyInput = node.querySelector('[data-spec-field="key"]');
    const valueInput = node.querySelector('[data-spec-field="value"]');
    keyInput.value = key;
    valueInput.value = value;

    function syncSpecsFromRows() {
        const newSpecs = {};
        specsList.querySelectorAll('[data-spec-row]').forEach((r) => {
            const k = r.querySelector('[data-spec-field="key"]').value.trim();
            const v = r.querySelector('[data-spec-field="value"]').value;
            if (k) newSpecs[k] = v;
        });
        state.products[productIndex].specs = Object.keys(newSpecs).length ? newSpecs : null;
    }

    keyInput.addEventListener('input', syncSpecsFromRows);
    valueInput.addEventListener('input', syncSpecsFromRows);
    node.querySelector('[data-action="remove-spec"]').addEventListener('click', () => {
        row.remove();
        syncSpecsFromRows();
    });
    specsList.appendChild(node);
}

// ---- Local dev-server write-back ----
// Only succeeds when running via dev-server.py (python dev-server.py), which
// exposes POST /api/save-data. On real static hosting this endpoint doesn't
// exist, so this simply fails fast and callers fall back to localStorage +
// the manual "Unduh data.js" flow.
async function tryWriteLocalFile(dataObj) {
    try {
        const res = await fetch('/api/save-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dataObj)
        });
        return res.ok;
    } catch (e) {
        return false;
    }
}

// ---- PHP save endpoint write-back (production hosting, e.g. Hostinger) ----
// Once this project is deployed to shared PHP hosting (api/save-data.php
// uploaded alongside the rest of the site), this succeeds automatically —
// no per-device setup, no token to paste anywhere. The endpoint lives
// server-side and writes assets/js/data.js directly, so every device that
// logs into admin.html publishes immediately for every visitor. On GitHub
// Pages (no PHP) this simply 404s and callers fall through to the next
// option below.
//
// SAVE_ENDPOINT_SECRET must match the SAVE_SECRET constant in
// api/save-data.php exactly. It only stops random visitors from finding
// this URL and overwriting the site's content — like the admin password,
// it lives in a public JS file, so it is not real access control.
const SAVE_ENDPOINT_SECRET = '272eff041649aebf6e7ec501cc6995ee2aaf7b34562b8a4e';

async function tryWritePhpEndpoint(dataObj) {
    try {
        const res = await fetch('api/save-data.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Save-Secret': SAVE_ENDPOINT_SECRET
            },
            body: JSON.stringify(dataObj)
        });
        if (!res.ok) return false;
        // On hosts that don't execute PHP (GitHub Pages, static-only
        // Netlify, etc.), requesting this path still returns HTTP 200 —
        // it just serves the .php file's raw source as plain text instead
        // of running it. Only trust a real, well-formed { ok: true } JSON
        // reply as proof the script actually executed and wrote the file.
        const json = await res.json().catch(() => null);
        return !!(json && json.ok === true);
    } catch (e) {
        return false;
    }
}

// ---- GitHub Contents API write-back ----
// Lets "Simpan Perubahan" publish straight to the live GitHub Pages site
// (no local dev server needed) by committing an updated assets/js/data.js
// through GitHub's REST API. Only active once a technical admin has filled
// in the "Pengaturan sinkronisasi otomatis ke GitHub" panel once on this
// browser/device — everyone else who logs in afterward just clicks "Simpan
// Perubahan" as normal and it silently publishes for them.
const GH_CONFIG_KEY = 'pbt_github_sync_config';

function getGithubConfig() {
    try {
        return JSON.parse(localStorage.getItem(GH_CONFIG_KEY) || 'null');
    } catch (e) {
        return null;
    }
}

function utf8ToBase64(str) {
    return btoa(unescape(encodeURIComponent(str)));
}

async function tryWriteGithub(dataObj) {
    const cfg = getGithubConfig();
    if (!cfg || !cfg.owner || !cfg.repo || !cfg.token) return { ok: false, configured: false };

    const branch = cfg.branch || 'master';
    const path = cfg.path || 'assets/js/data.js';
    const apiUrl = `https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/${path}`;
    const headers = {
        Authorization: `token ${cfg.token}`,
        Accept: 'application/vnd.github+json'
    };

    try {
        const getRes = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, { headers });
        if (!getRes.ok) {
            return { ok: false, configured: true, error: `Tidak bisa membaca file di GitHub (HTTP ${getRes.status}). Cek nama repo/branch/token.` };
        }
        const getJson = await getRes.json();

        const fileContent = 'window.SITE_DEFAULTS = ' + JSON.stringify(dataObj, null, 4) + ';\n';
        const putRes = await fetch(apiUrl, {
            method: 'PUT',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: 'Update konten via Admin Dashboard (' + new Date().toLocaleString('id-ID') + ')',
                content: utf8ToBase64(fileContent),
                sha: getJson.sha,
                branch: branch
            })
        });
        if (!putRes.ok) {
            const errJson = await putRes.json().catch(() => ({}));
            return { ok: false, configured: true, error: errJson.message || `Gagal menyimpan ke GitHub (HTTP ${putRes.status}).` };
        }
        return { ok: true, configured: true };
    } catch (e) {
        return { ok: false, configured: true, error: 'Tidak bisa terhubung ke GitHub: ' + e.message };
    }
}

function setupGithubSyncSettings() {
    const ownerInput = document.getElementById('ghOwner');
    const repoInput = document.getElementById('ghRepo');
    const branchInput = document.getElementById('ghBranch');
    const tokenInput = document.getElementById('ghToken');
    const saveBtn = document.getElementById('btnSaveGhConfig');
    const clearBtn = document.getElementById('btnClearGhConfig');
    const statusEl = document.getElementById('ghConfigStatus');
    const autoInfo = document.getElementById('publishInfoAuto');
    if (!ownerInput || !saveBtn) return;

    function refreshAutoInfo() {
        const cfg = getGithubConfig();
        const isConfigured = !!(cfg && cfg.owner && cfg.repo && cfg.token);
        if (autoInfo) autoInfo.classList.toggle('hidden', !isConfigured);
    }

    const existing = getGithubConfig();
    if (existing) {
        ownerInput.value = existing.owner || '';
        repoInput.value = existing.repo || '';
        branchInput.value = existing.branch || '';
        // Token intentionally left blank on reload — re-entering it to
        // change/confirm avoids leaving it visible in the input by default.
    }
    refreshAutoInfo();

    saveBtn.addEventListener('click', () => {
        const owner = ownerInput.value.trim();
        const repo = repoInput.value.trim();
        const branch = branchInput.value.trim() || 'master';
        const token = tokenInput.value.trim();
        if (!owner || !repo || !token) {
            statusEl.textContent = 'Isi username, nama repo, dan token terlebih dahulu.';
            statusEl.className = 'text-xs text-error';
            return;
        }
        localStorage.setItem(GH_CONFIG_KEY, JSON.stringify({ owner, repo, branch, token }));
        tokenInput.value = '';
        statusEl.textContent = 'Pengaturan tersimpan di browser ini. Coba klik "Simpan Perubahan" untuk menguji koneksinya.';
        statusEl.className = 'text-xs text-secondary';
        refreshAutoInfo();
    });

    clearBtn.addEventListener('click', () => {
        localStorage.removeItem(GH_CONFIG_KEY);
        ownerInput.value = '';
        repoInput.value = '';
        branchInput.value = '';
        tokenInput.value = '';
        statusEl.textContent = 'Pengaturan sinkronisasi otomatis dihapus.';
        statusEl.className = 'text-xs text-on-surface-variant';
        refreshAutoInfo();
    });
}

// ---- Action buttons ----
function bindActionButtons() {
    document.getElementById('btnAddProduct').addEventListener('click', () => {
        state.products.push({
            sku: 'SKU-' + Math.floor(1000 + Math.random() * 9000),
            name: 'Produk Baru',
            model: null,
            category: (state.categories[0] && state.categories[0].id) || '',
            price: 0,
            priceLabel: 'Rp 0',
            status: 'tersedia',
            hidePrice: false,
            description: '',
            image: 'assets/img/placeholder.svg',
            specs: null
        });
        renderProducts();
        document.querySelector('.tab-btn[data-tab="produk"]').click();
    });

    document.getElementById('btnAddCategory').addEventListener('click', () => {
        if (!state.categories) state.categories = [];
        state.categories.push({
            id: 'kategori-' + Math.floor(100 + Math.random() * 900),
            label: 'Kategori Baru',
            iconType: 'symbol',
            icon: 'category'
        });
        renderCategories();
    });

    document.getElementById('btnSave').addEventListener('click', () => {
        showConfirmModal({
            title: 'Simpan Perubahan',
            message: 'Simpan semua perubahan yang sudah Anda buat sekarang?',
            confirmLabel: 'Ya, Simpan',
            onConfirm: async () => {
                const savedLocally = window.SiteStore.save(state);
                const btn = document.getElementById('btnSave');
                btn.disabled = true;

                // Priority: local dev server (python dev-server.py) -> PHP
                // endpoint (production hosting like Hostinger, zero setup
                // per device) -> GitHub API (only if manually configured,
                // for the interim GitHub Pages phase) -> localStorage only.
                const wroteFile = await tryWriteLocalFile(state);
                let wrotePhp = false;
                if (!wroteFile) wrotePhp = await tryWritePhpEndpoint(state);
                let githubResult = { ok: false, configured: false };
                if (!wroteFile && !wrotePhp) githubResult = await tryWriteGithub(state);
                btn.disabled = false;

                if (wroteFile) {
                    setStatus('Tersimpan langsung ke assets/js/data.js (server dev lokal aktif) pada ' + new Date().toLocaleTimeString('id-ID') + '. Refresh tab situs untuk melihat perubahan — siapa pun yang membuka situs ini juga langsung melihatnya.');
                    showToast('Perubahan berhasil disimpan.', 'success');
                } else if (wrotePhp) {
                    setStatus('Tersimpan & langsung terpublikasi ke situs pada ' + new Date().toLocaleTimeString('id-ID') + '. Semua pengunjung langsung melihat perubahan ini.');
                    showToast('Perubahan berhasil disimpan & dipublikasikan.', 'success');
                } else if (githubResult.ok) {
                    setStatus('Tersimpan & dipublikasikan ke GitHub pada ' + new Date().toLocaleTimeString('id-ID') + '. Situs akan menampilkan perubahan ini untuk semua pengunjung dalam 1–2 menit.');
                    showToast('Perubahan berhasil disimpan & dipublikasikan.', 'success');
                } else if (githubResult.configured) {
                    setStatus('Tersimpan di browser ini saja — publikasi otomatis ke GitHub gagal: ' + (githubResult.error || 'kesalahan tidak diketahui') + ' Cek pengaturan sinkronisasi di bawah kotak info publikasi.');
                    showToast('Tersimpan di browser, tapi publikasi ke GitHub gagal.', 'error');
                } else if (savedLocally) {
                    setStatus('Tersimpan di browser ini saja pada ' + new Date().toLocaleTimeString('id-ID') + ' (belum ada sinkronisasi otomatis — atur di "Pengaturan sinkronisasi otomatis ke GitHub", jalankan "python dev-server.py", atau gunakan "Unduh data.js" untuk publish manual).');
                    showToast('Perubahan berhasil disimpan di browser ini.', 'success');
                } else {
                    setStatus('Gagal menyimpan — kemungkinan penyimpanan browser penuh (gambar terlalu besar/banyak).');
                    showToast('Gagal menyimpan perubahan.', 'error');
                }
            }
        });
    });

    document.getElementById('btnReset').addEventListener('click', () => {
        showConfirmModal({
            title: 'Batalkan Perubahan',
            message: 'Semua perubahan yang belum disimpan akan hilang, dan konten akan kembali ke kondisi terakhir kali Anda klik "Simpan Perubahan". Lanjutkan?',
            confirmLabel: 'Ya, Kembalikan',
            danger: true,
            onConfirm: () => {
                // Reloading from SiteStore.get() (defaults merged with the
                // last SAVED override) rather than wiping localStorage means
                // this button now undoes in-progress edits back to the last
                // save point, instead of factory-resetting everything.
                state = window.SiteStore.get();
                populateSimpleFields();
                renderStats();
                renderCategories();
                renderProducts();
                setStatus('Dikembalikan ke kondisi terakhir kali disimpan.');
                showToast('Perubahan yang belum disimpan telah dibatalkan.', 'success');
            }
        });
    });

    document.getElementById('btnLogout').addEventListener('click', () => {
        showConfirmModal({
            title: 'Keluar dari Admin',
            message: 'Anda akan keluar dari dashboard admin. Perubahan yang sudah disimpan tetap aman. Lanjutkan?',
            confirmLabel: 'Ya, Keluar',
            danger: true,
            onConfirm: () => {
                forceLogout(null);
            }
        });
    });

    document.getElementById('btnBackup').addEventListener('click', () => {
        window.SiteStore.downloadBackupJSON();
    });

    document.getElementById('btnImport').addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.addEventListener('change', () => {
            const file = input.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    window.SiteStore.importJSON(reader.result);
                    state = window.SiteStore.get();
                    populateSimpleFields();
                    renderStats();
                    renderCategories();
                    renderProducts();
                    setStatus('Berhasil mengimpor data dari file backup.');
                    showToast('Data berhasil diimpor.', 'success');
                } catch (e) {
                    showToast('Gagal mengimpor: file bukan JSON yang valid.', 'error');
                }
            };
            reader.readAsText(file);
        });
        input.click();
    });

    // Add a "Unduh data.js" button dynamically at the bottom of the page
    // (kept separate from the header action row since it's the one truly
    // destructive-feeling action: it's the actual publish step).
    const publishBar = document.createElement('div');
    publishBar.className = 'px-margin-mobile md:px-margin-desktop max-w-6xl mx-auto pb-xl';
    publishBar.innerHTML = `
<div class="bg-primary text-white rounded-xl p-lg flex flex-wrap items-center justify-between gap-md">
<div>
<h3 class="font-headline-md text-lg mb-1">Siap dipublikasikan?</h3>
<p class="text-sm text-primary-fixed/80">Unduh <code>data.js</code> lalu ganti file yang sama di folder <code>assets/js/</code> pada hosting Anda, kemudian redeploy.</p>
</div>
<button class="bg-secondary-fixed text-on-secondary-fixed px-lg py-3 rounded-lg font-button hover:brightness-110 transition flex items-center gap-2 active:scale-95 motion-reduce:active:scale-100" id="btnDownloadData" type="button">
<span class="material-symbols-outlined">download</span> Unduh data.js
</button>
</div>`;
    document.getElementById('dashboard').appendChild(publishBar);
    document.getElementById('btnDownloadData').addEventListener('click', () => {
        window.SiteStore.save(state);
        window.SiteStore.downloadDataFile();
        setStatus('data.js diunduh. Ganti file assets/js/data.js di hosting Anda dengan file ini untuk mempublikasikan perubahan.');
    });
}
