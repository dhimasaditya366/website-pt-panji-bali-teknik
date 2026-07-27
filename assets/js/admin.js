// Admin dashboard logic. Reads the merged SiteStore data into an in-memory
// `state` object, lets the user edit it through plain form fields, and only
// writes back to localStorage when "Simpan Perubahan" is clicked.
//
// IMPORTANT (read before changing ADMIN_PASSPHRASE): this login gate runs
// entirely in the browser. It stops a casual visitor from stumbling into
// edit mode; it does NOT stop anyone who views this page's source. Real
// protection for a static site means restricting access to admin.html at
// the hosting layer (host-level password protection, .htaccess, a
// Cloudflare Access rule, etc.), not a stronger client-side password.
const ADMIN_PASSPHRASE = 'panjibali2026';

let state = null;

document.addEventListener('DOMContentLoaded', () => {
    setupLoginGate();
});

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

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (passwordInput.value === ADMIN_PASSPHRASE) {
            sessionStorage.setItem('pbt_admin_authed', 'yes');
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

    document.getElementById('btnSave').addEventListener('click', async () => {
        const savedLocally = window.SiteStore.save(state);
        const btn = document.getElementById('btnSave');
        btn.disabled = true;
        const wroteFile = await tryWriteLocalFile(state);
        btn.disabled = false;

        if (wroteFile) {
            setStatus('Tersimpan langsung ke assets/js/data.js (server dev lokal aktif) pada ' + new Date().toLocaleTimeString('id-ID') + '. Refresh tab situs untuk melihat perubahan — siapa pun yang membuka situs ini juga langsung melihatnya.');
        } else if (savedLocally) {
            setStatus('Tersimpan di browser ini saja pada ' + new Date().toLocaleTimeString('id-ID') + ' (endpoint simpan otomatis tidak terdeteksi — jalankan "python dev-server.py", atau gunakan "Unduh data.js" untuk publish manual).');
        } else {
            setStatus('Gagal menyimpan — kemungkinan penyimpanan browser penuh (gambar terlalu besar/banyak).');
        }
    });

    document.getElementById('btnReset').addEventListener('click', () => {
        if (!confirm('Kembalikan semua konten ke bawaan pabrik? Perubahan yang belum diunduh sebagai backup akan hilang dari browser ini.')) return;
        window.SiteStore.reset();
        state = window.SiteStore.get();
        populateSimpleFields();
        renderStats();
        renderCategories();
        renderProducts();
        setStatus('Direset ke konten bawaan.');
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
                } catch (e) {
                    alert('Gagal mengimpor: file bukan JSON yang valid.');
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
