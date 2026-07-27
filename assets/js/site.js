document.addEventListener('DOMContentLoaded', () => {
    // Sticky nav shadow on scroll
    const nav = document.querySelector('nav.site-nav');
    if (nav) {
        const onScroll = () => {
            if (window.scrollY > 50) {
                nav.classList.add('shadow-xl', 'py-3');
                nav.classList.remove('py-4');
            } else {
                nav.classList.remove('shadow-xl', 'py-3');
                nav.classList.add('py-4');
            }
        };
        window.addEventListener('scroll', onScroll);
        onScroll();
    }

    // Mobile menu toggle
    // Open/close is driven by the .mobile-menu-open class; the height/opacity
    // animation itself lives in assets/css/motion.css (.mobile-menu-collapse).
    const menuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    if (menuBtn && mobileMenu) {
        const setMenuOpen = (open) => {
            mobileMenu.classList.toggle('mobile-menu-open', open);
            menuBtn.setAttribute('aria-expanded', String(open));
            const openIcon = menuBtn.querySelector('.icon-open');
            const closeIcon = menuBtn.querySelector('.icon-close');
            if (openIcon && closeIcon) {
                openIcon.classList.toggle('hidden', open);
                closeIcon.classList.toggle('hidden', !open);
            }
        };
        menuBtn.addEventListener('click', () => {
            setMenuOpen(!mobileMenu.classList.contains('mobile-menu-open'));
        });
        mobileMenu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => setMenuOpen(false));
        });
        // Collapse the mobile menu automatically when resizing up to desktop
        window.addEventListener('resize', () => {
            if (window.innerWidth >= 768) setMenuOpen(false);
        });
    }

    // Smooth scroll for in-page anchor links
    document.querySelectorAll('a[href^="#"]:not([href="#"])').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    // Fallback to local placeholder image when a remote image fails to load
    document.querySelectorAll('img').forEach(img => {
        img.addEventListener('error', function handler() {
            this.removeEventListener('error', handler);
            this.src = 'assets/img/placeholder.svg';
        });
    });

    // Dynamic copyright year
    document.querySelectorAll('.js-year').forEach(el => {
        el.textContent = new Date().getFullYear();
    });

    // Scroll-triggered reveal for below-the-fold sections/cards/images.
    // CSS lives in assets/css/motion.css (.reveal-on-scroll/.reveal-init/.reveal-visible).
    const revealEls = document.querySelectorAll('.reveal-on-scroll');
    if (revealEls.length && 'IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('reveal-visible');
                    entry.target.classList.remove('reveal-init');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });

        revealEls.forEach(el => {
            el.classList.add('reveal-init');
            observer.observe(el);
        });
    }
});
