// SiteStore: the only place that reads/writes site content.
//
// How persistence works on a static site (no server, no database):
// - Admin edits made in admin.html are saved into this browser's
//   localStorage immediately (key STORAGE_KEY below), so the admin can keep
//   editing/previewing across reloads on the SAME device/browser.
// - localStorage is per-browser and never syncs to other visitors. To make
//   edits visible to everyone, the admin must click "Unduh data.js" in the
//   dashboard and replace assets/js/data.js in the actual site files, then
//   re-publish/redeploy. That download IS the publish step.
// - "Impor data.js" lets the admin load a previously exported file back in
//   (e.g. on a new browser, or to restore a backup) before making more edits.
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

    function exportJSON() {
        return JSON.stringify(get(), null, 4);
    }

    // Downloads a ready-to-commit replacement for assets/js/data.js.
    function downloadDataFile() {
        const json = exportJSON();
        const fileContent = 'window.SITE_DEFAULTS = ' + json + ';\n';
        const blob = new Blob([fileContent], { type: 'text/javascript' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'data.js';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    function downloadBackupJSON() {
        const json = exportJSON();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'panji-bali-teknik-content-backup.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    function importJSON(text) {
        const parsed = JSON.parse(text); // throws on invalid JSON, caller should catch
        writeOverrides(parsed);
        return parsed;
    }

    global.SiteStore = {
        get,
        save,
        reset,
        hasOverrides,
        exportJSON,
        downloadDataFile,
        downloadBackupJSON,
        importJSON
    };
})(window);
