// SiteStore: the only place that reads/writes site content.
//
// How persistence works:
// - Admin edits made in admin.html are saved into this browser's
//   localStorage immediately (key STORAGE_KEY below) via save(), so the
//   admin can keep editing/previewing across reloads on the SAME
//   device/browser even if no publish path is available.
// - To make edits visible to every visitor, admin.js additionally tries (in
//   order): the local dev server (dev-server.py), the PHP save endpoint
//   (api/save-data.php, once deployed to PHP hosting), then the GitHub
//   Contents API (if configured) — see admin.js for that chain. Whichever
//   one succeeds writes assets/js/data.js directly; localStorage stays the
//   fallback so nothing is ever lost even when none of those are reachable.
(function (global) {
    const STORAGE_KEY = 'pbt_site_overrides_v1';

    function deepClone(value) {
        return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
    }

    function isPlainObject(v) {
        return v && typeof v === 'object' && !Array.isArray(v);
    }

    // Shallow-per-key merge for objects; arrays (e.g. products, stats) are
    // replaced wholesale by the override so admin add/remove/reorder works
    // without needing an index-based diff.
    function mergeDeep(base, override) {
        if (!isPlainObject(base) || !isPlainObject(override)) {
            return override !== undefined ? override : base;
        }
        const result = { ...base };
        Object.keys(override).forEach((key) => {
            const baseVal = base[key];
            const overrideVal = override[key];
            if (isPlainObject(baseVal) && isPlainObject(overrideVal)) {
                result[key] = mergeDeep(baseVal, overrideVal);
            } else if (overrideVal !== undefined) {
                result[key] = overrideVal;
            }
        });
        return result;
    }

    function readOverrides() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            console.warn('SiteStore: gagal membaca localStorage, memakai default.', e);
            return {};
        }
    }

    function writeOverrides(data) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('SiteStore: gagal menyimpan ke localStorage (mungkin penuh / gambar terlalu besar).', e);
            return false;
        }
    }

    function get() {
        const defaults = deepClone(global.SITE_DEFAULTS || {});
        const overrides = readOverrides();
        return mergeDeep(defaults, overrides);
    }

    // Replaces the ENTIRE overrides blob (used by the admin dashboard, which
    // always edits a full in-memory copy of the merged data then saves it).
    function save(fullData) {
        // Store the full object as the "override" so every field (including
        // ones equal to factory defaults) is explicit and durable across a
        // future change to data.js's own defaults.
        return writeOverrides(deepClone(fullData));
    }

    function reset() {
        localStorage.removeItem(STORAGE_KEY);
    }

    function hasOverrides() {
        return localStorage.getItem(STORAGE_KEY) !== null;
    }

    global.SiteStore = {
        get,
        save,
        reset,
        hasOverrides
    };
})(window);
