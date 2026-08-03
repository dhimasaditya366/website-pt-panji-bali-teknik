// Hydrates every public page straight from window.SITE_DEFAULTS (data.js) —
// the published, server-side truth. Deliberately does NOT go through
// SiteStore's localStorage overrides: those exist only so admin.html can
// preview an in-progress edit on the same device before it's saved. Public
// pages reading them too meant the admin's own browser could get stuck
// showing a stale local snapshot indefinitely, even after the real publish
// succeeded and every other visitor already saw the update.
// Safe to include on every page: each render function checks whether its
// target element(s) exist before touching anything, so a script tag that's
// identical on all 8 pages can still do page-specific work.
document.addEventListener('DOMContentLoaded', () => {
    const data = window.SITE_DEFAULTS;
    if (!data) return;

    const formatRupiah = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el != null && value != null) el.textContent = value;
    };
    const setAttr = (id, attr, value) => {
        const el = document.getElementById(id);
        if (el != null && value != null) el.setAttribute(attr, value);
    };
    const setBg = (id, url) => {
        const el = document.getElementById(id);
        if (el != null && url) el.style.backgroundImage = `url('${url}')`;
    };
    const escapeHtml = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    // Sets the text of a nav/footer link without clobbering an icon child
    // (footer links wrap an arrow_forward <span> before the label text) or
    // the logo anchor (wraps an <img> instead of being a plain text link).
    function setLinkText(a, text) {
        if (!text || !a) return;
        if (a.querySelector('img')) return;
        const icon = a.querySelector('span.material-symbols-outlined');
        if (icon) {
            let node = a.lastChild;
            while (node && node.nodeType !== Node.TEXT_NODE) node = node.previousSibling;
            if (node) node.textContent = ' ' + text;
            else a.appendChild(document.createTextNode(' ' + text));
        } else {
            a.textContent = text;
        }
    }

    // Defensive fallback: normalizes a legacy plain-string hours value (the
    // schema before the per-day "closed" toggle existed) into the current
    // { text, closed, dayLabel } shape, so a stale cached data.js or an
    // unmigrated override never renders as "undefined" instead of the
    // actual hours.
    function normalizeHourEntry(hourData) {
        if (typeof hourData === 'string') {
            return { text: hourData, closed: hourData.trim().toLowerCase() === 'tutup' };
        }
        return hourData;
    }

    // Renders one hours.{weekday|saturday|sunday} entry ({text, closed,
    // dayLabel}) into the footer's compact list (shared markup on every page).
    function applyFooterHoursRow(labelId, valueId, hourDataRaw) {
        const labelEl = document.getElementById(labelId);
        const valueEl = document.getElementById(valueId);
        const hourData = normalizeHourEntry(hourDataRaw);
        if (!valueEl || !hourData) return;
        const closed = !!hourData.closed;
        valueEl.textContent = closed ? (hourData.text || 'Tutup') : hourData.text;
        valueEl.className = closed
            ? 'px-2 py-0.5 bg-error/20 text-error rounded text-[10px] font-bold uppercase tracking-wider'
            : 'font-bold text-secondary-fixed';
        if (labelEl) {
            if (hourData.dayLabel) labelEl.textContent = hourData.dayLabel;
            labelEl.className = closed ? 'font-bold text-error/80' : 'font-medium text-primary-fixed/70';
        }
    }

    // Renders the same hours entry into kontak.html's full "Jam Operasional"
    // table row (icon + note only show when that day is marked closed).
    function applyTableHoursRow(dayLabelId, cellId, iconId, textId, noteId, hourDataRaw, closedNote) {
        const dayLabelEl = document.getElementById(dayLabelId);
        const cell = document.getElementById(cellId);
        const icon = document.getElementById(iconId);
        const text = document.getElementById(textId);
        const note = document.getElementById(noteId);
        const hourData = normalizeHourEntry(hourDataRaw);
        if (!cell || !text || !hourData) return;
        if (dayLabelEl && hourData.dayLabel) dayLabelEl.textContent = hourData.dayLabel;
        const closed = !!hourData.closed;
        text.textContent = closed ? (hourData.text || 'Tutup') : hourData.text + ' WIB';
        cell.classList.toggle('text-error', closed);
        if (icon) icon.classList.toggle('hidden', !closed);
        if (note) {
            note.classList.toggle('hidden', !closed);
            if (closedNote) note.textContent = closedNote;
        }
    }

    // Turns whatever URL an admin pasted from Google Maps' "Share" button
    // into a src for a live, interactive embed — with no API key, since a
    // real Maps Embed API key needs a billed Google Cloud project, which
    // isn't reasonable to ask a non-technical admin to set up. Google's
    // plain "/maps?q=...&output=embed" endpoint (unlike the regular
    // maps.google.com pages) doesn't send an X-Frame-Options header, so it
    // can be iframed directly — this is the same trick sites have used for
    // years to embed a map without a key. We just need a "q" value (ideally
    // coordinates) pulled out of whatever link shape the admin pasted.
    //
    // Google's mobile "Share" button gives a shortened maps.app.goo.gl link
    // by default. A browser can't read where that redirects to (no CORS
    // header on goo.gl's response), so there's no way to recover
    // coordinates from it client-side — passing the short link itself as
    // "q" makes Google fail to geocode anything and fall back to a
    // zoomed-out world view. Rather than show that broken state, fall back
    // to searching the company's own street address, which always
    // geocodes to a reasonable nearby view even when the pasted link can't
    // be read.
    function buildMapsEmbedSrc(shareUrl, fallbackAddress) {
        let q = null;
        const source = shareUrl || '';
        // Precise pin coords (from the data blob in a full share link) beat
        // the @lat,lng in the URL, which is only the map's viewport center.
        const preciseMatch = source.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
        const coordMatch = source.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (preciseMatch) {
            q = preciseMatch[1] + ',' + preciseMatch[2];
        } else if (coordMatch) {
            q = coordMatch[1] + ',' + coordMatch[2];
        } else {
            let hostname = '';
            try { hostname = new URL(source).hostname; } catch (e) { /* not an absolute URL */ }
            const isShortLink = hostname === 'maps.app.goo.gl' || hostname === 'goo.gl';
            if (!isShortLink) {
                try {
                    const url = new URL(source);
                    q = url.searchParams.get('query') || url.searchParams.get('q');
                } catch (e) { /* fall through */ }
                if (!q) {
                    const placeMatch = source.match(/\/place\/([^/@]+)/);
                    if (placeMatch) q = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
                }
            }
        }
        if (!q) q = fallbackAddress || source;
        if (!q) return null;
        return 'https://www.google.com/maps?q=' + encodeURIComponent(q) + '&output=embed';
    }

    function categoryIconHtml(c, size) {
        // Material Symbols glyphs scale with font-size (text-*), while an
        // uploaded icon image needs an actual box size (w-*/h-*) — same
        // "size" keyword maps to the right utility for whichever type it is.
        const symbolSizeClass = size === 'sm' ? 'text-base' : 'text-2xl';
        const imageSizeClass = size === 'sm' ? 'w-4 h-4' : 'w-6 h-6';
        if (c.iconType === 'image' && c.icon) {
            return `<img alt="" class="${imageSizeClass} object-contain inline-block" src="${c.icon}"/>`;
        }
        return `<span class="material-symbols-outlined ${symbolSizeClass}">${c.icon || 'category'}</span>`;
    }

    function priceBlockHtml(p, variant) {
        if (p.hidePrice) {
            return variant === 'home'
                ? `<div class="flex flex-col"><span class="text-secondary font-bold text-sm">Hubungi untuk harga</span></div>`
                : `<div class="flex flex-col gap-xs pt-xs border-t border-outline-variant"><span class="font-label-md text-label-md text-on-surface-variant uppercase">Harga</span><span class="text-secondary font-bold text-base">Hubungi Kami</span></div>`;
        }
        if (variant === 'home') {
            return `
<div class="flex flex-col">
<span class="text-xs text-outline uppercase tracking-tighter">Mulai Dari</span>
<span class="text-secondary font-bold text-lg tabular-nums">${escapeHtml(p.priceLabel)} <span class="text-[10px] text-outline font-normal">/hari</span></span>
</div>`;
        }
        const priceDigits = formatRupiah(p.price).replace('Rp ', '');
        return `
<div class="flex flex-col gap-xs pt-xs border-t border-outline-variant">
<span class="font-label-md text-label-md text-on-surface-variant uppercase">Mulai Dari</span>
<div class="flex items-baseline gap-xs text-secondary font-bold tabular-nums">
<span class="text-body-md">Rp</span>
<span class="text-headline-lg">${priceDigits}</span>
<span class="text-on-surface-variant font-normal">/ hari</span>
</div>
</div>`;
    }

    // ---- Shared chrome: nav logo/name, nav/footer links, footer, WA FAB ----
    setAttr('navLogo', 'src', data.company.logo);
    setText('navCompanyName', data.company.name);
    setText('navCompanyTagline', data.company.navTagline);

    if (data.nav) {
        const n = data.nav;
        // Scoped to nav.site-nav (covers desktop + mobile links, since the
        // mobile menu lives inside that same <nav>) and footer, so hero/
        // in-page CTA buttons that happen to share a target href (e.g. the
        // hero's own "Hubungi Kami" button, or "Lihat Semua Produk") are
        // never touched by this generic pass — those have their own ids.
        const linkContainers = document.querySelectorAll('nav.site-nav, footer');
        linkContainers.forEach((container) => {
            container.querySelectorAll('a[href="index.html"]').forEach((a) => setLinkText(a, n.beranda));
            container.querySelectorAll('a[href="katalog.html"]:not(.bg-secondary)').forEach((a) => setLinkText(a, n.produk));
            container.querySelectorAll('a[href="layanan.html"]').forEach((a) => setLinkText(a, n.layanan));
            container.querySelectorAll('a[href="tentang-kami.html"]').forEach((a) => setLinkText(a, n.tentangKami));
            container.querySelectorAll('a[href="kontak.html"]').forEach((a) => setLinkText(a, n.kontak));
        });
        document.querySelectorAll('nav.site-nav a.bg-secondary').forEach((a) => setLinkText(a, n.ctaButton));
    }

    setAttr('footerLogo', 'src', data.company.logo);
    setText('footerCompanyName', data.company.name);
    setText('footerDescription', data.company.description);
    setText('footerAddress', data.company.address);
    setText('footerPhone', data.company.phoneDisplay);
    setAttr('footerPhone', 'href', 'tel:' + data.company.phone);
    setText('footerEmail', data.company.email);
    setText('footerCopyrightName', data.company.name);
    if (data.footer) {
        setText('footerCopyrightSuffix', data.footer.copyrightSuffix);
        // Footer section headings ("Navigasi"/"Jam Operasional"/"Info
        // Kontak") match by their known source text rather than an id,
        // since matching the static HTML text (never rewritten) is stable
        // across saves regardless of what the heading currently displays.
        document.querySelectorAll('footer h4').forEach((h4) => {
            let node = h4.lastChild;
            while (node && node.nodeType !== Node.TEXT_NODE) node = node.previousSibling;
            if (!node) return;
            const trimmed = node.textContent.trim();
            if (trimmed === 'Navigasi' && data.footer.navHeading) node.textContent = ' ' + data.footer.navHeading;
            else if (trimmed === 'Jam Operasional' && data.footer.hoursHeading) node.textContent = ' ' + data.footer.hoursHeading;
            else if (trimmed === 'Info Kontak' && data.footer.contactHeading) node.textContent = ' ' + data.footer.contactHeading;
        });
    }
    const closedNote = data.company.hours && data.company.hours.closedNote;
    applyFooterHoursRow('footerHoursWeekdayLabel', 'footerHoursWeekday', data.company.hours.weekday);
    applyFooterHoursRow('footerHoursSaturdayLabel', 'footerHoursSaturday', data.company.hours.saturday);
    applyFooterHoursRow('footerHoursSundayLabel', 'footerHoursSunday', data.company.hours.sunday);
    if (Array.isArray(data.company.taglines)) {
        setText('footerTagline1', data.company.taglines[0]);
        setText('footerTagline2', data.company.taglines[1]);
    }

    const waNumber = String(data.company.phone || '').replace(/[^\d]/g, '');
    document.querySelectorAll('a[href^="https://wa.me/"]').forEach((a) => {
        const url = new URL(a.href);
        const query = url.search; // preserve any ?text= already on the link
        a.href = 'https://wa.me/' + waNumber + query;
    });
    document.querySelectorAll('a[href^="tel:"]').forEach((a) => {
        a.href = 'tel:' + data.company.phone;
    });
    document.querySelectorAll('a[href^="mailto:"]').forEach((a) => {
        a.href = 'mailto:' + data.company.email;
    });

    // ---- SEO title/description (per page, via <body data-page="...">) ----
    if (data.seo) {
        const pageKey = document.body.dataset.page;
        const seo = data.seo[pageKey];
        if (seo) {
            setText('seoTitle', seo.title);
            setAttr('seoDescription', 'content', seo.description);
        }
    }

    // ---- index.html: hero, stats, why-choose, catalog section, product preview ----
    setText('heroBadgeText', data.hero.badge);
    setText('heroTitlePrefix', data.hero.titlePrefix + ' ');
    setText('heroTitleHighlight', data.hero.titleHighlight);
    setText('heroSubtitle', data.hero.subtitle);
    setAttr('heroImage', 'src', data.hero.image);
    setText('heroButtonPrimaryText', data.hero.primaryButtonText);
    setText('heroButtonSecondary', data.hero.secondaryButtonText);

    const statsGrid = document.getElementById('statsGrid');
    if (statsGrid && Array.isArray(data.stats)) {
        statsGrid.innerHTML = data.stats.map((s, i) => `
<div class="text-center group border-r border-white/10 last:border-none reveal-on-scroll" style="transition-delay:${i * 80}ms">
<div class="font-display-lg text-4xl md:text-5xl text-secondary-fixed mb-base tabular-nums">${s.value}</div>
<div class="font-label-md text-xs md:text-sm text-primary-fixed/70 uppercase tracking-widest group-hover:text-primary-fixed transition-colors">${s.label}</div>
</div>`).join('');
    }

    if (data.homeWhyChoose) {
        const w = data.homeWhyChoose;
        setText('whyChooseHeading', w.heading);
        setText('whyChooseSubtext', w.subtext);
        if (Array.isArray(w.cards)) {
            w.cards.forEach((card, i) => {
                const n = i + 1;
                setText('whyChooseCard' + n + 'Icon', card.icon);
                setText('whyChooseCard' + n + 'Title', card.title);
                setText('whyChooseCard' + n + 'Desc', card.description);
            });
        }
    }
    if (data.homeCatalog) {
        setText('homeCatalogEyebrow', data.homeCatalog.eyebrow);
        setText('homeCatalogHeading', data.homeCatalog.heading);
        setText('homeCatalogViewAllText', data.homeCatalog.viewAllText);
    }

    function productBadge(status) {
        return status === 'tersedia'
            ? { cls: 'bg-secondary text-on-primary', label: 'Tersedia' }
            : { cls: 'bg-error text-on-error', label: 'Disewa Proyek' };
    }

    // sku is admin-entered free text and can be left blank or duplicated
    // across products; falling back to the array index keeps every "Sewa
    // Sekarang" link unique even then. Must match the same fallback used in
    // detail-penyewaan.html's lookup, and i must be the product's index in
    // the full data.products array (not a filtered/sliced copy) for the two
    // to agree.
    function productKey(p, i) {
        return p.sku ? p.sku : 'idx-' + i;
    }

    const homeProductGrid = document.getElementById('homeProductGrid');
    if (homeProductGrid && Array.isArray(data.products)) {
        const preview = data.products.slice(0, 3);
        homeProductGrid.innerHTML = preview.map((p, i) => {
            const badge = productBadge(p.status);
            const action = p.status === 'tersedia'
                ? `<a class="bg-primary text-white p-3 rounded-lg hover:bg-secondary transition shadow-md active:scale-95 motion-reduce:active:scale-100" href="detail-penyewaan.html?sku=${encodeURIComponent(productKey(p, i))}"><span class="material-symbols-outlined">add_shopping_cart</span></a>`
                : `<button aria-label="Sedang disewa, tidak tersedia" class="bg-outline-variant text-on-surface-variant p-3 rounded-lg cursor-not-allowed opacity-60" disabled><span class="material-symbols-outlined">calendar_month</span></button>`;
            return `
<div class="bg-white border border-outline-variant rounded-xl overflow-hidden group hover:shadow-2xl transition duration-500 flex flex-col reveal-on-scroll" style="transition-delay:${i * 80}ms">
<div class="relative h-72 overflow-hidden bg-surface-container">
<img alt="${p.name}" class="w-full h-full object-cover group-hover:scale-110 motion-reduce:group-hover:scale-100 transition-transform duration-700" src="${p.image}"/>
<div class="absolute top-4 left-4 ${badge.cls} px-3 py-1 text-xs font-bold rounded-full shadow-lg uppercase">${badge.label}</div>
</div>
<div class="p-md flex flex-col flex-grow">
<h3 class="font-headline-md text-xl text-primary mb-2">${p.name}</h3>
<p class="text-on-surface-variant text-sm line-clamp-2 mb-md leading-relaxed">${p.description}</p>
<div class="mt-auto pt-md border-t border-outline-variant flex justify-between items-center">
${priceBlockHtml(p, 'home')}
${action}
</div>
</div>
</div>`;
        }).join('');
    }

    // ---- tentang-kami.html: mini stats row ----
    // Reuses data.stats[i].label directly (rather than a separate hardcoded
    // label list) so it can never drift out of sync with the home page's
    // stats, and stays admin-editable via the same Beranda > Statistik tab.
    const miniStats = document.getElementById('miniStats');
    if (miniStats && Array.isArray(data.stats)) {
        miniStats.innerHTML = data.stats.slice(0, 3).map((s) => `
<div class="bg-surface-container-low p-md border border-outline-variant">
<div class="font-headline-md text-headline-md text-primary tabular-nums">${s.value}</div>
<div class="font-label-md text-label-md text-on-surface-variant">${s.label}</div>
</div>`).join('');
    }

    // ---- katalog.html: sidebar/hero/toolbar labels, category nav, grid ----
    if (data.katalogPage) {
        const k = data.katalogPage;
        setText('katalogSideLabel1', k.sideLabel1);
        setText('katalogSideLabel2', k.sideLabel2);
        setText('katalogAllToolsLabel', k.allToolsLabel);
        setText('katalogAllToolsLabelMobile', k.allToolsLabel);
        setText('katalogTechnicalServiceLabel1', k.technicalServiceLabel);
        setText('katalogTechnicalServiceLabel2', k.technicalServiceLabel);
        setText('katalogHelpButtonText', k.helpButtonText);
        setText('katalogBreadcrumbHome', k.breadcrumbHome);
        setText('katalogBreadcrumbCurrent', k.breadcrumbCurrent);
        setText('katalogEyebrow', k.eyebrow);
        setText('katalogHeading', k.heading);
        setText('katalogIntro', k.intro);
        setText('sortAllBtn', k.sortAllText);
        setText('sortPopularBtn', k.sortPopularText);
        setText('sortNewestBtn', k.sortNewestText);
        setText('sortPriceLowBtn', k.sortPriceLowText);
    }

    const categorySidebar = document.getElementById('categorySidebar');
    if (categorySidebar && Array.isArray(data.categories)) {
        categorySidebar.innerHTML = data.categories.map((c) => `
<a class="flex items-center gap-sm p-sm text-on-surface-variant hover:bg-surface-container-high transition" data-category-filter="${c.id}" href="katalog.html#${c.id}">
${categoryIconHtml(c, 'lg')}
<span class="font-label-md text-label-md">${c.label}</span>
</a>`).join('');
    }

    const categoryChipsMobile = document.getElementById('categoryChipsMobile');
    if (categoryChipsMobile && Array.isArray(data.categories)) {
        categoryChipsMobile.innerHTML = data.categories.map((c) => `
<a class="shrink-0 flex items-center gap-1 px-md py-xs bg-surface-container-high text-on-surface-variant rounded-full font-label-md text-label-md whitespace-nowrap" data-category-filter="${c.id}" href="katalog.html#${c.id}">
${categoryIconHtml(c, 'sm')} ${c.label}
</a>`).join('');
    }

    const productGrid = document.getElementById('productGrid');
    if (productGrid && Array.isArray(data.products)) {
        const seenCategory = {};
        productGrid.innerHTML = data.products.map((p, i) => {
            const badge = productBadge(p.status);
            const isFirstOfCategory = p.category && !seenCategory[p.category];
            if (p.category) seenCategory[p.category] = true;
            const anchorId = isFirstOfCategory ? ` id="${p.category}"` : '';
            const action = p.status === 'tersedia'
                ? `<a class="w-full bg-secondary text-on-primary py-md rounded-lg font-button text-button uppercase tracking-widest hover:brightness-110 active:scale-95 motion-reduce:active:scale-100 transition flex items-center justify-center" href="detail-penyewaan.html?sku=${encodeURIComponent(productKey(p, i))}">Sewa Sekarang</a>`
                : `<button class="w-full bg-outline-variant text-on-surface-variant py-md rounded-lg font-button text-button uppercase tracking-widest cursor-not-allowed opacity-60" disabled>Sedang Disewa</button>`;
            return `
<div class="equipment-card bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden group hover:border-secondary transition duration-300" data-category="${p.category || ''}" data-price="${p.price}" data-status="${p.status}"${anchorId}>
<div class="relative h-64 overflow-hidden bg-surface-container">
<img alt="${p.name}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 motion-reduce:group-hover:scale-100" src="${p.image}"/>
<div class="absolute top-4 left-4 ${badge.cls} px-sm py-xs rounded font-label-md text-label-md uppercase">${badge.label}</div>
</div>
<div class="p-md space-y-sm">
<div class="flex justify-between items-start">
<h3 class="font-headline-md text-headline-md text-primary">${p.name}</h3>
<span class="font-label-md text-label-md text-on-surface-variant bg-surface-container px-xs py-1 rounded">${p.sku}</span>
</div>
<p class="font-body-md text-body-md text-on-surface-variant line-clamp-2">${p.description}</p>
${priceBlockHtml(p, 'grid')}
${action}
</div>
</div>`;
        }).join('');
    }
    const productCountTemplate = (data.katalogPage && data.katalogPage.countTemplate) || 'Menampilkan {n} Produk';
    setText('productCount', productCountTemplate.replace('{n}', data.products ? data.products.length : 0));
    const productCountEl = document.getElementById('productCount');
    // Stashed so site.js's category filter can update this count without
    // needing to know the (possibly admin-customized) template text itself.
    if (productCountEl) productCountEl.dataset.countTemplate = productCountTemplate;

    // ---- kontak.html: hero, contact cards, hours table, banner, map, CTA ----
    if (data.pages && data.pages.kontak) {
        const kp = data.pages.kontak;
        setText('kontakHeroBadge', kp.heroBadge);
        setText('kontakHeroHeading', kp.heroHeading);
        setText('kontakHeroParagraph', kp.heroParagraph);
        setText('kontakAddressHeading', kp.addressHeading);
        setText('kontakPhoneHeading', kp.phoneHeading);
        setText('kontakPhoneSubtext', kp.phoneSubtext);
        setText('kontakEmailHeading', kp.emailHeading);
        setText('kontakEmailSubtext', kp.emailSubtext);
        setText('kontakWebsiteHeading', kp.websiteHeading);
        setText('kontakWebsiteSubtext', kp.websiteSubtext);
        setText('kontakHoursHeading', kp.hoursHeading);
        setText('kontakHoursSubtext', kp.hoursSubtext);
        setText('kontakHoursDayHeader', kp.hoursTableDayHeader);
        setText('kontakHoursTimeHeader', kp.hoursTableTimeHeader);
        setText('kontakLocationHeading', kp.locationHeading);
        setText('kontakMapOverlayTitle', kp.mapOverlayTitle);
        setText('kontakMapOverlaySubtitle', kp.mapOverlaySubtitle);
        setText('kontakEmailButton', kp.emailButtonText);
        const banner = document.getElementById('kontakInfoBanner');
        if (banner) {
            const taglines = Array.isArray(data.company.taglines) ? data.company.taglines.join(', ') : '';
            banner.textContent = [data.company.name, data.company.slogan].filter(Boolean).join(' ') + (taglines ? ' — ' + taglines : '');
        }
    }
    setText('contactAddress', data.company.address);
    setText('contactPhoneText', data.company.phoneDisplay);
    setAttr('contactPhone', 'href', 'https://wa.me/' + waNumber);
    setText('contactEmailText', data.company.email);
    setText('contactWebsite', data.company.website);
    applyTableHoursRow('hoursWeekdayLabel', 'hoursWeekdayCell', 'hoursWeekdayIcon', 'hoursWeekday', 'hoursWeekdayNote', data.company.hours.weekday, closedNote);
    applyTableHoursRow('hoursSaturdayLabel', 'hoursSaturdayCell', 'hoursSaturdayIcon', 'hoursSaturday', 'hoursSaturdayNote', data.company.hours.saturday, closedNote);
    applyTableHoursRow('hoursSundayLabel', 'hoursSundayCell', 'hoursSundayIcon', 'hoursSunday', 'hoursSundayNote', data.company.hours.sunday, closedNote);
    setAttr('mapLink', 'href', data.company.mapsShareUrl);
    const mapEmbedSrc = buildMapsEmbedSrc(data.company.mapsShareUrl, data.company.address);
    if (mapEmbedSrc) setAttr('kontakMapEmbed', 'src', mapEmbedSrc);

    // ---- Other pages' hero photos + hero text (tentang-kami, layanan, layanan-teknis, kontak) ----
    if (data.pages) {
        const p = data.pages;
        if (p.tentangKami) {
            setBg('tentangHeroImage', p.tentangKami.heroImage);
            setAttr('tentangProfileImage', 'src', p.tentangKami.profileImage);
            setAttr('tentangVisiMisiImage', 'src', p.tentangKami.visiMisiImage);
        }
        if (p.layanan) {
            setBg('layananHeroImage', p.layanan.heroImage);
            setText('layananHeroHeading', p.layanan.heroHeading);
            setText('layananHeroParagraph', p.layanan.heroParagraph);
        }
        if (p.layananTeknis) {
            setBg('layananTeknisHeroImage', p.layananTeknis.heroImage);
            setAttr('layananTeknisPreventiveImage', 'src', p.layananTeknis.preventiveImage);
            setAttr('layananTeknisPartsImage', 'src', p.layananTeknis.partsImage);
            setAttr('layananTeknisCtaImage', 'src', p.layananTeknis.ctaImage);
            setText('layananTeknisHeroEyebrow', p.layananTeknis.heroEyebrow);
            setText('layananTeknisHeroHeading', p.layananTeknis.heroHeading);
            setText('layananTeknisHeroParagraph', p.layananTeknis.heroParagraph);
        }
    }

    // ---- CTA sections (index, layanan, layanan-teknis, tentang-kami, kontak) ----
    if (data.ctas) {
        const c = data.ctas;
        if (c.home) {
            setText('ctaHomeHeading', c.home.heading);
            setText('ctaHomeText', c.home.text);
            setText('ctaHomeButton1Text', c.home.button1Text);
            setText('ctaHomeButton2Text', c.home.button2Text);
        }
        if (c.layanan) {
            setText('ctaLayananHeading', c.layanan.heading);
            setText('ctaLayananText', c.layanan.text);
            setText('ctaLayananButtonText', c.layanan.buttonText);
        }
        if (c.layananTeknis) {
            setText('ctaLayananTeknisHeading', c.layananTeknis.heading);
            setText('ctaLayananTeknisText', c.layananTeknis.text);
            setText('ctaLayananTeknisButton1Text', c.layananTeknis.button1Text);
            setText('ctaLayananTeknisButton2Text', c.layananTeknis.button2Text);
        }
        if (c.tentangKami) {
            setText('ctaTentangHeading', c.tentangKami.heading);
            setText('ctaTentangText', c.tentangKami.text);
            setText('ctaTentangButtonText', c.tentangKami.buttonText);
        }
        if (c.kontak) {
            setText('ctaKontakHeading', c.kontak.heading);
            setText('ctaKontakText', c.kontak.text);
            setText('ctaKontakButtonText', c.kontak.buttonText);
        }
    }

    // ---- index.html: "Tentang Kami" teaser section ----
    if (data.homeAbout) {
        const a = data.homeAbout;
        setText('homeAboutEyebrow', a.eyebrow);
        setText('homeAboutHeading', a.heading);
        setText('homeAboutParagraph', a.paragraph);
        setText('homeAboutQuote', a.quote);
        setText('homeAboutLinkText', a.linkText);
        setAttr('homeAboutImage', 'src', a.image);
        setAttr('homeAboutImage', 'alt', a.imageAlt);
        if (Array.isArray(a.highlights)) {
            setText('homeAboutHighlight1Icon', a.highlights[0] && a.highlights[0].icon);
            setText('homeAboutHighlight1Text', a.highlights[0] && a.highlights[0].text);
            setText('homeAboutHighlight2Icon', a.highlights[1] && a.highlights[1].icon);
            setText('homeAboutHighlight2Text', a.highlights[1] && a.highlights[1].text);
        }
    }

    // ---- layanan.html: section heading + 3 service cards + workflow ----
    if (data.layananSection) {
        setText('layananSectionEyebrow', data.layananSection.eyebrow);
        setText('layananSectionHeading', data.layananSection.heading);
    }
    if (Array.isArray(data.layananCards)) {
        data.layananCards.forEach((card, i) => {
            const n = i + 1;
            setText('layananCard' + n + 'Icon', card.icon);
            setText('layananCard' + n + 'Title', card.title);
            setText('layananCard' + n + 'Desc', card.description);
            setText('layananCard' + n + 'LinkText', card.linkText);
        });
    }
    if (data.layananWorkflow) {
        setText('layananWorkflowHeading', data.layananWorkflow.heading);
        setText('layananWorkflowSubtext', data.layananWorkflow.subtext);
        if (Array.isArray(data.layananWorkflow.steps)) {
            data.layananWorkflow.steps.forEach((step, i) => {
                const n = i + 1;
                setText('workflowStep' + n + 'Number', step.number);
                setText('workflowStep' + n + 'Title', step.title);
                setText('workflowStep' + n + 'Desc', step.description);
            });
        }
    }

    // ---- layanan-teknis.html: bento grid (4) + "why choose us" (4) ----
    if (Array.isArray(data.layananTeknisBento)) {
        data.layananTeknisBento.forEach((card, i) => {
            const n = i + 1;
            setText('bentoCard' + n + 'Title', card.title);
            setText('bentoCard' + n + 'Desc', card.description);
        });
        const b0 = data.layananTeknisBento[0];
        if (b0 && Array.isArray(b0.checklist)) {
            setText('bentoCard1Checklist1', b0.checklist[0]);
            setText('bentoCard1Checklist2', b0.checklist[1]);
            setText('bentoCard1Checklist3', b0.checklist[2]);
        }
        const b1 = data.layananTeknisBento[1];
        if (b1) setText('bentoCard2LinkText', b1.linkText);
        const b2 = data.layananTeknisBento[2];
        if (b2) {
            setText('bentoCard3Stat1Label', b2.stat1Label);
            setText('bentoCard3Stat1Value', b2.stat1Value);
            setText('bentoCard3Stat2Label', b2.stat2Label);
            setText('bentoCard3Stat2Value', b2.stat2Value);
        }
        const b3 = data.layananTeknisBento[3];
        if (b3) {
            setText('bentoCard4Stat1Value', b3.stat1Value);
            setText('bentoCard4Stat1Label', b3.stat1Label);
            setText('bentoCard4Stat2Value', b3.stat2Value);
            setText('bentoCard4Stat2Label', b3.stat2Label);
        }
    }
    if (data.layananTeknisWhySection) {
        setText('layananTeknisWhyHeading', data.layananTeknisWhySection.heading);
        setText('layananTeknisWhySubtext', data.layananTeknisWhySection.subtext);
    }
    if (Array.isArray(data.layananTeknisWhy)) {
        data.layananTeknisWhy.forEach((card, i) => {
            const n = i + 1;
            setText('whyCard' + n + 'Icon', card.icon);
            setText('whyCard' + n + 'Title', card.title);
            setText('whyCard' + n + 'Desc', card.description);
        });
    }

    // ---- tentang-kami.html: hero, profil perusahaan, visi & misi, nilai-nilai ----
    if (data.pages && data.pages.tentangKami) {
        setText('tentangHeroHeading', data.pages.tentangKami.heroHeading);
        setText('tentangHeroParagraph', data.pages.tentangKami.heroParagraph);
    }
    if (data.tentangProfil) {
        setText('tentangProfilEyebrow', data.tentangProfil.eyebrow);
        setText('tentangProfilHeading', data.tentangProfil.heading);
        setText('tentangProfilParagraph', data.tentangProfil.paragraph);
    }
    if (data.tentangVisiMisi) {
        setText('tentangVisiHeading', data.tentangVisiMisi.visiHeading);
        setText('tentangMisiHeading', data.tentangVisiMisi.misiHeading);
        setText('tentangVisiText', data.tentangVisiMisi.visiText);
        if (Array.isArray(data.tentangVisiMisi.misiItems)) {
            data.tentangVisiMisi.misiItems.forEach((item, i) => {
                setText('tentangMisiItem' + (i + 1), item);
            });
        }
    }
    if (data.tentangValuesSection) {
        setText('tentangValuesHeading', data.tentangValuesSection.heading);
        setText('tentangValuesSubtext', data.tentangValuesSection.subtext);
    }
    if (Array.isArray(data.tentangNilai)) {
        data.tentangNilai.forEach((card, i) => {
            const n = i + 1;
            setText('nilaiCard' + n + 'Icon', card.icon);
            setText('nilaiCard' + n + 'Title', card.title);
            setText('nilaiCard' + n + 'Desc', card.description);
        });
    }

    // ---- detail-penyewaan.html: static form labels/placeholders/errors/banners ----
    if (data.detailPenyewaan) {
        const dp = data.detailPenyewaan;
        setText('detailBreadcrumbCurrent', dp.breadcrumbCurrent);
        setText('specFallback', dp.specFallbackText);
        setText('detailFormHeading', dp.formHeading);
        setText('detailStartDateLabel', dp.startDateLabel);
        setText('detailEndDateLabel', dp.endDateLabel);
        setText('detailLokasiLabel', dp.lokasiLabel);
        setAttr('lokasi', 'placeholder', dp.lokasiPlaceholder);
        setText('detailKebutuhanLabel', dp.kebutuhanLabel);
        setAttr('kebutuhan', 'placeholder', dp.kebutuhanPlaceholder);
        setText('detailContactHeading', dp.contactHeading);
        setText('detailNamaLabel', dp.namaLabel);
        setAttr('nama', 'placeholder', dp.namaPlaceholder);
        setText('namaError', dp.namaError);
        setText('detailNoWaLabel', dp.noWaLabel);
        setAttr('noWa', 'placeholder', dp.noWaPlaceholder);
        setText('noWaError', dp.noWaError);
        setText('detailSummaryHeading', dp.summaryHeading);
        setText('detailUnitLabel', dp.unitLabel);
        setText('detailDurationLabel', dp.durationLabel);
        setText('detailDailyRateLabel', dp.dailyRateLabel);
        setText('detailTotalLabel', dp.totalLabel);
        setText('detailHidePriceNoticeText', dp.hidePriceNoticeText);
        setText('detailFeeNoticeText', dp.feeNoticeText);
        setText('detailSubmitButtonText', dp.submitButtonText);
        setText('detailFooterBadgeText', dp.footerBadgeText);
        setText('detailAssistanceHeading', dp.assistanceHeading);
        setText('detailAssistanceLink', dp.assistanceLinkText);
    }

    // ---- 404.html ----
    if (data.notFound) {
        setText('notFoundHeading', data.notFound.heading);
        setText('notFoundParagraph', data.notFound.paragraph);
        setText('notFoundHomeButtonText', data.notFound.homeButtonText);
        setText('notFoundCatalogButtonText', data.notFound.catalogButtonText);
    }
});
