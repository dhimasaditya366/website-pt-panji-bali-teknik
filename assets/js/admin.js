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
        if (opts.onCancel) opts.onCancel();
    }
    confirmBtn.addEventListener('click', onConfirmClick);
    cancelBtn.addEventListener('click', onCancelClick);
}

// Snapshot of window.SITE_DEFAULTS exactly as it was when this admin session
// started, used right before Simpan to detect whether someone else (another
// device/tab) has published a newer version in the meantime -- see the
// btnSave handler below. Comparing against this instead of the live
// window.SITE_DEFAULTS is what makes the check meaningful: this tab's own
// in-progress edits are supposed to differ from it.
let loadedServerSnapshot = null;

async function fetchFreshServerData() {
    try {
        const res = await fetch('assets/js/data.js?t=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) return null;
        const text = await res.text();
        const prefix = 'window.SITE_DEFAULTS = ';
        if (!text.startsWith(prefix)) return null;
        return JSON.parse(text.slice(prefix.length).trim().replace(/;$/, ''));
    } catch (e) {
        return null;
    }
}

function initDashboard() {
    state = window.SiteStore.get();
    loadedServerSnapshot = JSON.stringify(window.SITE_DEFAULTS || {});
    setStatus(window.SiteStore.hasOverrides()
        ? 'Menampilkan perubahan tersimpan di browser ini.'
        : 'Menampilkan konten bawaan (belum ada perubahan tersimpan).');

    // A local draft (from a previous unfinished edit on this browser) can
    // silently diverge from whatever's actually live now -- e.g. it was
    // saved before a collaborator published something newer on another
    // device. That showed up today as the admin seeing only 3 categories
    // and the wrong products with no explanation why. Flag it plainly
    // instead of blending the two without comment.
    const staleDraftBanner = document.getElementById('staleDraftBanner');
    if (staleDraftBanner) {
        const isStale = window.SiteStore.hasOverrides() && JSON.stringify(state) !== loadedServerSnapshot;
        staleDraftBanner.classList.toggle('hidden', !isStale);
    }

    setupTabs();
    populateSimpleFields();
    bindSimpleFieldListeners();
    bindImageUploads();
    renderStats();
    renderCategories();
    renderProducts();
    bindActionButtons();
    bindStaleDraftBanner();
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

// ---- Simple [data-field] inputs (text/textarea/select + checkbox, dot-path bound) ----
function populateSimpleFields() {
    document.querySelectorAll('[data-field]').forEach((el) => {
        const value = getPath(state, el.dataset.field);
        if (el.type === 'checkbox') {
            el.checked = !!value;
        } else {
            el.value = value == null ? '' : value;
        }
    });
    updateImagePreviews();
}

function bindSimpleFieldListeners() {
    document.querySelectorAll('[data-field]').forEach((el) => {
        el.addEventListener('input', () => {
            setPath(state, el.dataset.field, el.type === 'checkbox' ? el.checked : el.value);
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
        input.addEventListener('change', async () => {
            const file = input.files[0];
            if (!file) return;
            const dataUrl = await readImageFile(file, input.dataset.cropRatio);
            if (!dataUrl) { input.value = ''; return; }
            const path = input.dataset.imageField;
            setPath(state, path, dataUrl);
            const sibling = input.parentElement.parentElement.querySelector(`[data-field="${path}"]`);
            if (sibling) sibling.value = dataUrl;
            updateImagePreviews();
            input.value = '';
        });
    });
}

// ---- Shared upload helper: reads a file, and if a target crop ratio is
// given, opens the crop modal so the photo can be repositioned/zoomed to
// match the exact box it will be displayed in on the public site, instead
// of relying on CSS object-fit to blindly crop off whatever doesn't fit.
// Returns the final data URI, or null if the user cancels the crop.
async function readImageFile(file, cropRatio) {
    if (!cropRatio) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(file);
        });
    }
    return openImageCropper(file, cropRatio);
}

// ---- Crop modal: drag-to-reposition, slider-to-zoom, bake result to canvas ----
function openImageCropper(file, cropRatio) {
    return new Promise((resolve) => {
        const modal = document.getElementById('cropModal');
        const frame = document.getElementById('cropFrame');
        const img = document.getElementById('cropImage');
        const zoomSlider = document.getElementById('cropZoom');
        const btnApply = document.getElementById('cropApply');
        const btnCancel = document.getElementById('cropCancel');

        const [rw, rh] = cropRatio.split('/').map(Number);
        frame.style.aspectRatio = `${rw} / ${rh}`;

        const objectUrl = URL.createObjectURL(file);
        let coverScale = 1;
        let zoom = 1;
        let offsetX = 0;
        let offsetY = 0;
        let dragging = false;
        let dragStartX = 0;
        let dragStartY = 0;
        let dragOriginX = 0;
        let dragOriginY = 0;

        function clampOffsets() {
            const dispW = img.naturalWidth * coverScale * zoom;
            const dispH = img.naturalHeight * coverScale * zoom;
            const frameW = frame.clientWidth;
            const frameH = frame.clientHeight;
            offsetX = Math.min(0, Math.max(frameW - dispW, offsetX));
            offsetY = Math.min(0, Math.max(frameH - dispH, offsetY));
        }

        function applyTransform() {
            const dispW = img.naturalWidth * coverScale * zoom;
            const dispH = img.naturalHeight * coverScale * zoom;
            img.style.width = `${dispW}px`;
            img.style.height = `${dispH}px`;
            img.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
        }

        function onPointerDown(e) {
            dragging = true;
            const point = e.touches ? e.touches[0] : e;
            dragStartX = point.clientX;
            dragStartY = point.clientY;
            dragOriginX = offsetX;
            dragOriginY = offsetY;
        }
        function onPointerMove(e) {
            if (!dragging) return;
            const point = e.touches ? e.touches[0] : e;
            offsetX = dragOriginX + (point.clientX - dragStartX);
            offsetY = dragOriginY + (point.clientY - dragStartY);
            clampOffsets();
            applyTransform();
            e.preventDefault();
        }
        function onPointerUp() { dragging = false; }

        function onZoomInput() {
            zoom = Number(zoomSlider.value);
            clampOffsets();
            applyTransform();
        }

        function cleanup(result) {
            frame.removeEventListener('mousedown', onPointerDown);
            frame.removeEventListener('touchstart', onPointerDown);
            window.removeEventListener('mousemove', onPointerMove);
            window.removeEventListener('touchmove', onPointerMove, { passive: false });
            window.removeEventListener('mouseup', onPointerUp);
            window.removeEventListener('touchend', onPointerUp);
            zoomSlider.removeEventListener('input', onZoomInput);
            btnApply.removeEventListener('click', onApply);
            btnCancel.removeEventListener('click', onCancel);
            modal.classList.add('hidden');
            URL.revokeObjectURL(objectUrl);
            resolve(result);
        }

        function onApply() {
            const frameW = frame.clientWidth;
            const frameH = frame.clientHeight;
            const scale = coverScale * zoom;
            const sx = -offsetX / scale;
            const sy = -offsetY / scale;
            const sw = frameW / scale;
            const sh = frameH / scale;

            const outW = rw >= rh ? 1600 : Math.round(1600 * rw / rh);
            const outH = rw >= rh ? Math.round(1600 * rh / rw) : 1600;
            const canvas = document.createElement('canvas');
            canvas.width = outW;
            canvas.height = outH;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
            cleanup(canvas.toDataURL('image/jpeg', 0.85));
        }
        function onCancel() { cleanup(null); }

        img.onload = () => {
            // Frame has 0 size while the modal is display:none, so it must be
            // shown before clientWidth/clientHeight can be measured.
            modal.classList.remove('hidden');

            const frameW = frame.clientWidth;
            const frameH = frame.clientHeight;
            coverScale = Math.max(frameW / img.naturalWidth, frameH / img.naturalHeight);
            zoom = 1;
            zoomSlider.value = '1';
            offsetX = (frameW - img.naturalWidth * coverScale) / 2;
            offsetY = (frameH - img.naturalHeight * coverScale) / 2;
            applyTransform();

            frame.addEventListener('mousedown', onPointerDown);
            frame.addEventListener('touchstart', onPointerDown, { passive: true });
            window.addEventListener('mousemove', onPointerMove);
            window.addEventListener('touchmove', onPointerMove, { passive: false });
            window.addEventListener('mouseup', onPointerUp);
            window.addEventListener('touchend', onPointerUp);
            zoomSlider.addEventListener('input', onZoomInput);
            btnApply.addEventListener('click', onApply);
            btnCancel.addEventListener('click', onCancel);
        };
        img.src = objectUrl;
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
        iconUpload.addEventListener('change', async () => {
            const file = iconUpload.files[0];
            if (!file) return;
            const dataUrl = await readImageFile(file, iconUpload.dataset.cropRatio);
            iconUpload.value = '';
            if (!dataUrl) return;
            state.categories[index].icon = dataUrl;
            refreshPreview();
        });

        node.querySelector('[data-action="remove-category"]').addEventListener('click', () => {
            const usedByProducts = (state.products || []).filter((p) => p.category === state.categories[index].id).length;
            const warning = usedByProducts
                ? `\n\n${usedByProducts} produk masih memakai kategori ini — produk tersebut tidak akan terhapus, hanya kehilangan jangkar link kategorinya.`
                : '';
            if (!confirm(`Hapus kategori "${state.categories[index].label || state.categories[index].id}"?${warning}`)) return;
            state.categories.splice(index, 1);
            renderCategories();
            renderProducts();
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
            imageUpload.addEventListener('change', async () => {
                const file = imageUpload.files[0];
                if (!file) return;
                const dataUrl = await readImageFile(file, imageUpload.dataset.cropRatio);
                imageUpload.value = '';
                if (!dataUrl) return;
                state.products[index].image = dataUrl;
                if (preview) preview.src = dataUrl;
                const imageTextInput = imageUpload.parentElement.querySelector('[data-product-field="image"]');
                if (imageTextInput) imageTextInput.value = dataUrl;
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
// exist, so this simply fails fast and callers fall back to the PHP
// endpoint, then GitHub sync, then localStorage-only.
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

// ---- Zero-config auto-publish proxy (Cloudflare Worker) ----
// While this site lives on GitHub Pages (no backend of its own), publishing
// a change still has to go through GitHub's authenticated write API somehow
// — there's no way around that for a static host. Rather than making every
// admin device store a real GitHub token (the old "Pengaturan sinkronisasi
// otomatis ke GitHub" panel below), this small serverless proxy holds that
// GitHub token server-side and exposes one narrow action: "overwrite
// assets/js/data.js in this one repo". PROXY_APP_SECRET only gates that one
// action — like SAVE_ENDPOINT_SECRET above, it's fine to ship in public JS
// because it can't do anything beyond this single file write.
const PROXY_URL = 'https://panji-admin-proxy.panjibaliteknik.workers.dev';
const PROXY_APP_SECRET = '7be3c2277d4f6700cbf107247cebb8fd893cf7fd1595b4f56aac11a799df136c';

async function tryWriteProxy(dataObj) {
    try {
        const res = await fetch(PROXY_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-App-Secret': PROXY_APP_SECRET
            },
            body: JSON.stringify(dataObj)
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json && json.ok === true) return { ok: true };
        return { ok: false, error: (json && json.error) || `HTTP ${res.status}` };
    } catch (e) {
        return { ok: false, error: 'Tidak bisa terhubung ke server publikasi: ' + e.message };
    }
}

// ---- GitHub Contents API write-back (manual/advanced fallback) ----
// Kept as a backup path only — normal use no longer needs this since
// tryWriteProxy above publishes automatically with zero setup. This stays
// useful only if the proxy above is ever unreachable and a technical admin
// wants to configure a personal GitHub token as a manual alternative.
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

function githubErrorMessage(status, errJson) {
    if (status === 401) return 'Token tidak valid atau sudah kedaluwarsa. Buat token baru di panel pengaturan sinkronisasi.';
    if (status === 403) return 'Token tidak punya izin cukup (butuh "Contents: Read and write") atau batas request GitHub tercapai.';
    if (status === 404) return 'Repo/branch/path tidak ditemukan. Cek nama username, nama repo, dan branch di pengaturan sinkronisasi.';
    return (errJson && errJson.message) || `Gagal menyimpan ke GitHub (HTTP ${status}).`;
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
    const fileContent = 'window.SITE_DEFAULTS = ' + JSON.stringify(dataObj, null, 4) + ';\n';

    // The file's sha can change between our GET and PUT if another save
    // landed in between (this admin panel is used from multiple
    // devices/tabs). That only causes a 409 conflict, not a bad token — so
    // retry once with a freshly-fetched sha before giving up, instead of
    // making the admin re-enter credentials for something that isn't
    // actually wrong with them.
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const getRes = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, { headers });
            if (!getRes.ok) {
                return { ok: false, configured: true, error: githubErrorMessage(getRes.status) };
            }
            const getJson = await getRes.json();

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
            if (putRes.ok) {
                return { ok: true, configured: true };
            }
            if (putRes.status === 409 && attempt === 0) {
                continue; // sha changed since our GET — retry once with a fresh one
            }
            const errJson = await putRes.json().catch(() => ({}));
            return { ok: false, configured: true, error: githubErrorMessage(putRes.status, errJson) };
        } catch (e) {
            return { ok: false, configured: true, error: 'Tidak bisa terhubung ke GitHub: ' + e.message };
        }
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
    if (!ownerInput || !saveBtn) return;

    // The "sinkronisasi otomatis aktif" banner is now unconditional (the
    // proxy in tryWriteProxy handles publishing regardless of this panel),
    // so there's nothing left to toggle here — this manual GitHub config is
    // purely an optional fallback now.
    function refreshAutoInfo() {}

    const existing = getGithubConfig();
    if (existing) {
        ownerInput.value = existing.owner || '';
        repoInput.value = existing.repo || '';
        branchInput.value = existing.branch || '';
        // Token intentionally left blank on reload (never shown back in the
        // input) — but it IS still saved in localStorage and still used by
        // tryWriteGithub. The placeholder below makes that clear so it isn't
        // mistaken for having been reset.
        if (existing.token) {
            tokenInput.placeholder = 'Sudah tersimpan — biarkan kosong jika tidak ingin menggantinya';
        }
    }
    refreshAutoInfo();

    saveBtn.addEventListener('click', () => {
        const owner = ownerInput.value.trim();
        const repo = repoInput.value.trim();
        const branch = branchInput.value.trim() || 'master';
        const typedToken = tokenInput.value.trim();
        // Leaving the token field blank keeps the previously saved token
        // (it's never redisplayed there) instead of being treated as "no
        // token" — only require typing one the very first time it's set up.
        const current = getGithubConfig();
        const token = typedToken || (current && current.token) || '';
        if (!owner || !repo || !token) {
            statusEl.textContent = 'Isi username, nama repo, dan token terlebih dahulu.';
            statusEl.className = 'text-xs text-error';
            return;
        }
        localStorage.setItem(GH_CONFIG_KEY, JSON.stringify({ owner, repo, branch, token }));
        tokenInput.value = '';
        tokenInput.placeholder = 'Sudah tersimpan — biarkan kosong jika tidak ingin menggantinya';
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
        tokenInput.placeholder = 'github_pat_...';
        statusEl.textContent = 'Pengaturan sinkronisasi otomatis dihapus.';
        statusEl.className = 'text-xs text-on-surface-variant';
        refreshAutoInfo();
    });
}

function bindStaleDraftBanner() {
    const banner = document.getElementById('staleDraftBanner');
    if (!banner) return;

    document.getElementById('btnUseServerData').addEventListener('click', () => {
        window.SiteStore.reset();
        state = window.SiteStore.get();
        banner.classList.add('hidden');
        populateSimpleFields();
        renderStats();
        renderCategories();
        renderProducts();
        setStatus('Draf lokal dibuang — menampilkan data terbaru dari server.');
        showToast('Sekarang menampilkan data terbaru dari server.', 'success');
    });

    document.getElementById('btnKeepDraft').addEventListener('click', () => {
        banner.classList.add('hidden');
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
        // Each product card's category <select> is built from state.categories
        // at the time renderProducts() last ran, so it goes stale the moment
        // a category is added/removed here unless re-rendered too.
        renderProducts();
    });

    document.getElementById('btnSave').addEventListener('click', () => {
        showConfirmModal({
            title: 'Simpan Perubahan',
            message: 'Simpan semua perubahan yang sudah Anda buat sekarang?',
            confirmLabel: 'Ya, Simpan',
            onConfirm: async () => {
                // Catches the exact scenario that has bitten this site
                // before: someone else (another device, another tab left
                // open) publishes a change after this session loaded, and
                // this session's Simpan then silently overwrites it with
                // its own older snapshot. Compare what's live on the server
                // right now against what was live when THIS session started
                // -- if they differ, something else changed in between.
                const freshServerData = await fetchFreshServerData();
                if (freshServerData && loadedServerSnapshot !== null
                    && JSON.stringify(freshServerData) !== loadedServerSnapshot) {
                    const proceed = await new Promise((resolve) => {
                        showConfirmModal({
                            title: 'Ada Perubahan Lain di Server',
                            message: 'Sejak halaman ini dibuka, sudah ada perubahan lain tersimpan di server (mungkin dari device/tab lain). Menyimpan sekarang akan MENIMPA perubahan tersebut dan bisa menghilangkan datanya. Disarankan: batalkan, refresh halaman ini, lalu ulangi editanmu di atas data terbaru. Tetap simpan sekarang?',
                            confirmLabel: 'Tetap Simpan (Berisiko)',
                            danger: true,
                            onConfirm: () => resolve(true),
                            onCancel: () => resolve(false)
                        });
                    });
                    if (!proceed) {
                        showToast('Penyimpanan dibatalkan. Silakan refresh halaman ini dulu.', 'error');
                        return;
                    }
                }

                const savedLocally = window.SiteStore.save(state);
                const btn = document.getElementById('btnSave');
                btn.disabled = true;

                // Priority: local dev server (python dev-server.py) -> PHP
                // endpoint (production hosting like Hostinger, zero setup
                // per device) -> Cloudflare Worker proxy (zero setup, works
                // right now on GitHub Pages) -> GitHub API (only if manually
                // configured, advanced fallback) -> localStorage only.
                const wroteFile = await tryWriteLocalFile(state);
                let wrotePhp = false;
                if (!wroteFile) wrotePhp = await tryWritePhpEndpoint(state);
                let proxyResult = { ok: false };
                if (!wroteFile && !wrotePhp) proxyResult = await tryWriteProxy(state);
                let githubResult = { ok: false, configured: false };
                if (!wroteFile && !wrotePhp && !proxyResult.ok) githubResult = await tryWriteGithub(state);
                btn.disabled = false;

                if (wroteFile) {
                    setStatus('Tersimpan langsung ke assets/js/data.js (server dev lokal aktif) pada ' + new Date().toLocaleTimeString('id-ID') + '. Refresh tab situs untuk melihat perubahan — siapa pun yang membuka situs ini juga langsung melihatnya.');
                    showToast('Perubahan berhasil disimpan.', 'success');
                } else if (wrotePhp) {
                    setStatus('Tersimpan & langsung terpublikasi ke situs pada ' + new Date().toLocaleTimeString('id-ID') + '. Semua pengunjung langsung melihat perubahan ini.');
                    showToast('Perubahan berhasil disimpan & dipublikasikan.', 'success');
                } else if (proxyResult.ok) {
                    setStatus('Tersimpan & dipublikasikan otomatis pada ' + new Date().toLocaleTimeString('id-ID') + '. Situs akan menampilkan perubahan ini untuk semua pengunjung dalam 1–2 menit.');
                    showToast('Perubahan berhasil disimpan & dipublikasikan.', 'success');
                } else if (githubResult.ok) {
                    setStatus('Tersimpan & dipublikasikan ke GitHub pada ' + new Date().toLocaleTimeString('id-ID') + '. Situs akan menampilkan perubahan ini untuk semua pengunjung dalam 1–2 menit.');
                    showToast('Perubahan berhasil disimpan & dipublikasikan.', 'success');
                } else if (githubResult.configured) {
                    setStatus('Tersimpan di browser ini saja — publikasi otomatis gagal: ' + (proxyResult.error || githubResult.error || 'kesalahan tidak diketahui') + ' Cek pengaturan sinkronisasi di bawah kotak info publikasi.');
                    showToast('Tersimpan di browser, tapi publikasi gagal.', 'error');
                } else if (proxyResult.error) {
                    setStatus('Tersimpan di browser ini saja — publikasi otomatis gagal: ' + proxyResult.error);
                    showToast('Tersimpan di browser, tapi publikasi gagal.', 'error');
                } else if (savedLocally) {
                    setStatus('Tersimpan di browser ini saja pada ' + new Date().toLocaleTimeString('id-ID') + ' (belum ada sinkronisasi otomatis aktif — atur di panel "Pengaturan sinkronisasi otomatis ke GitHub", atau tunggu situs ini dipindah ke hosting PHP).');
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

}
