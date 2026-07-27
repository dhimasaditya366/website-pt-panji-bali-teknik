// Hydrates every public page from SiteStore (defaults + admin overrides).
// Safe to include on every page: each render function checks whether its
// target element(s) exist before touching anything, so a script tag that's
// identical on all 8 pages can still do page-specific work.
document.addEventListener('DOMContentLoaded', () => {
    if (!window.SiteStore) return;
    const data = window.SiteStore.get();

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

    // ---- Shared chrome: nav logo/name, footer, WhatsApp FAB (all pages) ----
    setAttr('navLogo', 'src', data.company.logo);
    setText('navCompanyName', data.company.name);

    setAttr('footerLogo', 'src', data.company.logo);
    setText('footerCompanyName', data.company.name);
    setText('footerDescription', data.company.description);
    setText('footerAddress', data.company.address);
    setText('footerPhone', data.company.phoneDisplay);
    setAttr('footerPhone', 'href', 'tel:' + data.company.phone);
    setText('footerEmail', data.company.email);
    setText('footerHoursWeekday', data.company.hours.weekday);
    setText('footerHoursSaturday', data.company.hours.saturday);
    setText('footerHoursSunday', data.company.hours.sunday);
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

    // ---- index.html: hero, stats, product preview ----
    setText('heroBadgeText', data.hero.badge);
    setText('heroTitlePrefix', data.hero.titlePrefix + ' ');
    setText('heroTitleHighlight', data.hero.titleHighlight);
    setText('heroSubtitle', data.hero.subtitle);
    setAttr('heroImage', 'src', data.hero.image);

    const statsGrid = document.getElementById('statsGrid');
    if (statsGrid && Array.isArray(data.stats)) {
        statsGrid.innerHTML = data.stats.map((s, i) => `
<div class="text-center group border-r border-white/10 last:border-none reveal-on-scroll" style="transition-delay:${i * 80}ms">
<div class="font-display-lg text-4xl md:text-5xl text-secondary-fixed mb-base tabular-nums">${s.value}</div>
<div class="font-label-md text-xs md:text-sm text-primary-fixed/70 uppercase tracking-widest group-hover:text-primary-fixed transition-colors">${s.label}</div>
</div>`).join('');
    }

    function productBadge(status) {
        return status === 'tersedia'
            ? { cls: 'bg-secondary text-on-primary', label: 'Tersedia' }
            : { cls: 'bg-error text-on-error', label: 'Disewa Proyek' };
    }

    const homeProductGrid = document.getElementById('homeProductGrid');
    if (homeProductGrid && Array.isArray(data.products)) {
        const preview = data.products.slice(0, 3);
        homeProductGrid.innerHTML = preview.map((p, i) => {
            const badge = productBadge(p.status);
            const action = p.status === 'tersedia'
                ? `<a class="bg-primary text-white p-3 rounded-lg hover:bg-secondary transition shadow-md active:scale-95 motion-reduce:active:scale-100" href="detail-penyewaan.html?sku=${p.sku}"><span class="material-symbols-outlined">add_shopping_cart</span></a>`
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
    const miniStats = document.getElementById('miniStats');
    if (miniStats && Array.isArray(data.stats)) {
        const labels = ['Tahun Pengalaman', 'Unit Tersedia', 'Proyek Selesai'];
        miniStats.innerHTML = data.stats.slice(0, 3).map((s, i) => `
<div class="bg-surface-container-low p-md border border-outline-variant">
<div class="font-headline-md text-headline-md text-primary tabular-nums">${s.value}</div>
<div class="font-label-md text-label-md text-on-surface-variant">${labels[i] || s.label}</div>
</div>`).join('');
    }

    // ---- katalog.html: category nav, mobile chips, product grid, count ----
    const categorySidebar = document.getElementById('categorySidebar');
    if (categorySidebar && Array.isArray(data.categories)) {
        categorySidebar.innerHTML = data.categories.map((c) => `
<a class="flex items-center gap-sm p-sm text-on-surface-variant hover:bg-surface-container-high transition" href="katalog.html#${c.id}">
${categoryIconHtml(c, 'lg')}
<span class="font-label-md text-label-md">${c.label}</span>
</a>`).join('');
    }

    const categoryChipsMobile = document.getElementById('categoryChipsMobile');
    if (categoryChipsMobile && Array.isArray(data.categories)) {
        categoryChipsMobile.innerHTML = data.categories.map((c) => `
<a class="shrink-0 flex items-center gap-1 px-md py-xs bg-surface-container-high text-on-surface-variant rounded-full font-label-md text-label-md whitespace-nowrap" href="katalog.html#${c.id}">
${categoryIconHtml(c, 'sm')} ${c.label}
</a>`).join('');
    }

    const productGrid = document.getElementById('productGrid');
    if (productGrid && Array.isArray(data.products)) {
        const seenCategory = {};
        productGrid.innerHTML = data.products.map((p) => {
            const badge = productBadge(p.status);
            const isFirstOfCategory = p.category && !seenCategory[p.category];
            if (p.category) seenCategory[p.category] = true;
            const anchorId = isFirstOfCategory ? ` id="${p.category}"` : '';
            const action = p.status === 'tersedia'
                ? `<a class="w-full bg-secondary text-on-primary py-md rounded-lg font-button text-button uppercase tracking-widest hover:brightness-110 active:scale-95 motion-reduce:active:scale-100 transition flex items-center justify-center" href="detail-penyewaan.html?sku=${p.sku}">Sewa Sekarang</a>`
                : `<button class="w-full bg-outline-variant text-on-surface-variant py-md rounded-lg font-button text-button uppercase tracking-widest cursor-not-allowed opacity-60" disabled>Sedang Disewa</button>`;
            return `
<div class="equipment-card bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden group hover:border-secondary transition duration-300" data-price="${p.price}" data-status="${p.status}"${anchorId}>
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
    setText('productCount', 'Menampilkan ' + (data.products ? data.products.length : 0) + ' Produk');

    // ---- kontak.html: contact cards, hours table, map link ----
    setText('contactAddress', data.company.address);
    setText('contactPhoneText', data.company.phoneDisplay);
    setAttr('contactPhone', 'href', 'https://wa.me/' + waNumber);
    setText('contactEmailText', data.company.email);
    setText('contactWebsite', data.company.website);
    setText('hoursWeekday', data.company.hours.weekday + ' WIB');
    setText('hoursSaturday', data.company.hours.saturday + ' WIB');
    setAttr('mapLink', 'href', 'https://maps.google.com/?q=' + encodeURIComponent(data.company.mapsQuery));

    // ---- Other pages' photos (tentang-kami, layanan, layanan-teknis, kontak) ----
    if (data.pages) {
        const p = data.pages;
        if (p.tentangKami) {
            setBg('tentangHeroImage', p.tentangKami.heroImage);
            setAttr('tentangProfileImage', 'src', p.tentangKami.profileImage);
            setAttr('tentangVisiMisiImage', 'src', p.tentangKami.visiMisiImage);
        }
        if (p.layanan) {
            setBg('layananHeroImage', p.layanan.heroImage);
        }
        if (p.layananTeknis) {
            setBg('layananTeknisHeroImage', p.layananTeknis.heroImage);
            setAttr('layananTeknisPreventiveImage', 'src', p.layananTeknis.preventiveImage);
            setAttr('layananTeknisPartsImage', 'src', p.layananTeknis.partsImage);
            setAttr('layananTeknisCtaImage', 'src', p.layananTeknis.ctaImage);
        }
        if (p.kontak) {
            setBg('kontakMapImage', p.kontak.mapImage);
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
        if (Array.isArray(a.highlights)) {
            setText('homeAboutHighlight1Icon', a.highlights[0] && a.highlights[0].icon);
            setText('homeAboutHighlight1Text', a.highlights[0] && a.highlights[0].text);
            setText('homeAboutHighlight2Icon', a.highlights[1] && a.highlights[1].icon);
            setText('homeAboutHighlight2Text', a.highlights[1] && a.highlights[1].text);
        }
    }

    // ---- layanan.html: 3 service cards ----
    if (Array.isArray(data.layananCards)) {
        data.layananCards.forEach((card, i) => {
            const n = i + 1;
            setText('layananCard' + n + 'Icon', card.icon);
            setText('layananCard' + n + 'Title', card.title);
            setText('layananCard' + n + 'Desc', card.description);
            setText('layananCard' + n + 'LinkText', card.linkText);
        });
    }

    // ---- layanan-teknis.html: bento grid (4) + "why choose us" (4) ----
    if (Array.isArray(data.layananTeknisBento)) {
        data.layananTeknisBento.forEach((card, i) => {
            const n = i + 1;
            setText('bentoCard' + n + 'Title', card.title);
            setText('bentoCard' + n + 'Desc', card.description);
        });
    }
    if (Array.isArray(data.layananTeknisWhy)) {
        data.layananTeknisWhy.forEach((card, i) => {
            const n = i + 1;
            setText('whyCard' + n + 'Icon', card.icon);
            setText('whyCard' + n + 'Title', card.title);
            setText('whyCard' + n + 'Desc', card.description);
        });
    }

    // ---- tentang-kami.html: profil perusahaan, visi & misi, nilai-nilai ----
    if (data.tentangProfil) {
        setText('tentangProfilEyebrow', data.tentangProfil.eyebrow);
        setText('tentangProfilHeading', data.tentangProfil.heading);
        setText('tentangProfilParagraph', data.tentangProfil.paragraph);
    }
    if (data.tentangVisiMisi) {
        setText('tentangVisiText', data.tentangVisiMisi.visiText);
        if (Array.isArray(data.tentangVisiMisi.misiItems)) {
            data.tentangVisiMisi.misiItems.forEach((item, i) => {
                setText('tentangMisiItem' + (i + 1), item);
            });
        }
    }
    if (Array.isArray(data.tentangNilai)) {
        data.tentangNilai.forEach((card, i) => {
            const n = i + 1;
            setText('nilaiCard' + n + 'Icon', card.icon);
            setText('nilaiCard' + n + 'Title', card.title);
            setText('nilaiCard' + n + 'Desc', card.description);
        });
    }
});
