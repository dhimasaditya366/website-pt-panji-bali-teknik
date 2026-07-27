try {
    tailwind.config = {
        darkMode: "class",
        theme: {
            extend: {
                colors: {
                    "primary": "#001736",
                    "on-primary": "#ffffff",
                    "primary-container": "#002b5b",
                    "on-primary-container": "#7594ca",
                    "primary-fixed": "#d6e3ff",
                    "primary-fixed-dim": "#a9c7ff",
                    "on-primary-fixed": "#001b3d",
                    "on-primary-fixed-variant": "#264778",
                    "secondary": "#416900",
                    "on-secondary": "#ffffff",
                    "secondary-container": "#acf847",
                    "on-secondary-container": "#457000",
                    "secondary-fixed": "#acf847",
                    "secondary-fixed-dim": "#91db2a",
                    "on-secondary-fixed": "#102000",
                    "on-secondary-fixed-variant": "#304f00",
                    "tertiary": "#390002",
                    "on-tertiary": "#ffffff",
                    "tertiary-container": "#600005",
                    "on-tertiary-container": "#ff5a50",
                    "tertiary-fixed": "#ffdad6",
                    "tertiary-fixed-dim": "#ffb4ab",
                    "on-tertiary-fixed": "#410002",
                    "on-tertiary-fixed-variant": "#93000b",
                    "surface": "#f9f9ff",
                    "on-surface": "#111c2d",
                    "surface-variant": "#d8e3fb",
                    "on-surface-variant": "#43474f",
                    "surface-dim": "#cfdaf2",
                    "surface-bright": "#f9f9ff",
                    "surface-container-lowest": "#ffffff",
                    "surface-container-low": "#f0f3ff",
                    "surface-container": "#e7eeff",
                    "surface-container-high": "#dee8ff",
                    "surface-container-highest": "#d8e3fb",
                    "surface-tint": "#405f91",
                    "inverse-surface": "#263143",
                    "inverse-on-surface": "#ecf1ff",
                    "inverse-primary": "#a9c7ff",
                    "outline": "#747780",
                    "outline-variant": "#c4c6d0",
                    "background": "#f9f9ff",
                    "on-background": "#111c2d",
                    "error": "#ba1a1a",
                    "on-error": "#ffffff",
                    "error-container": "#ffdad6",
                    "on-error-container": "#93000a"
                },
                borderRadius: {
                    "DEFAULT": "0.125rem",
                    "lg": "0.25rem",
                    "xl": "0.5rem",
                    "full": "0.75rem"
                },
                spacing: {
                    "base": "4px",
                    "xs": "8px",
                    "sm": "16px",
                    "gutter": "16px",
                    "md": "24px",
                    "lg": "40px",
                    "xl": "64px",
                    "margin-mobile": "16px",
                    "margin-desktop": "80px"
                },
                fontFamily: {
                    "display-lg": ["Hanken Grotesk"],
                    "headline-lg": ["Hanken Grotesk"],
                    "headline-lg-mobile": ["Hanken Grotesk"],
                    "headline-md": ["Hanken Grotesk"],
                    "button": ["Hanken Grotesk"],
                    "body-lg": ["Inter"],
                    "body-md": ["Inter"],
                    "label-md": ["JetBrains Mono"]
                },
                fontSize: {
                    "display-lg": ["48px", {"lineHeight": "56px", "letterSpacing": "-0.02em", "fontWeight": "800"}],
                    "headline-lg": ["32px", {"lineHeight": "40px", "fontWeight": "700"}],
                    "headline-lg-mobile": ["28px", {"lineHeight": "34px", "fontWeight": "700"}],
                    "headline-md": ["24px", {"lineHeight": "32px", "fontWeight": "600"}],
                    "body-lg": ["18px", {"lineHeight": "28px", "fontWeight": "400"}],
                    "body-md": ["16px", {"lineHeight": "24px", "fontWeight": "400"}],
                    "label-md": ["14px", {"lineHeight": "20px", "letterSpacing": "0.05em", "fontWeight": "500"}],
                    "button": ["16px", {"lineHeight": "24px", "fontWeight": "600"}]
                },
                transitionTimingFunction: {
                    "out-strong": "cubic-bezier(0.23, 1, 0.32, 1)",
                    "in-out-strong": "cubic-bezier(0.77, 0, 0.175, 1)"
                }
            }
        }
    };
} catch (_e) {}
