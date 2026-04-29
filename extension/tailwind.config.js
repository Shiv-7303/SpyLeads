/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./*.html", "./*.js"],
  darkMode: "class",
  theme: {
      extend: {
          "colors": {
              "on-error": "#ffffff",
              "on-surface": "#1b1c1c",
              "on-tertiary-fixed-variant": "#3b2db8",
              "on-secondary-fixed-variant": "#0733c1",
              "on-surface-variant": "#5a4045",
              "secondary": "#2d4cd6",
              "on-secondary-fixed": "#001159",
              "tertiary-container": "#6b61e8",
              "primary-container": "#da2a67",
              "secondary-fixed": "#dee1ff",
              "on-secondary": "#ffffff",
              "surface-bright": "#fcf9f8",
              "tertiary-fixed-dim": "#c4c0ff",
              "primary-fixed-dim": "#ffb1c0",
              "on-tertiary-fixed": "#120068",
              "on-primary-container": "#fffbff",
              "tertiary": "#5146ce",
              "on-error-container": "#93000a",
              "surface-container-low": "#f6f3f2",
              "on-tertiary": "#ffffff",
              "secondary-fixed-dim": "#bac3ff",
              "surface-dim": "#dcd9d9",
              "surface-container": "#f0eded",
              "secondary-container": "#4b67f0",
              "on-tertiary-container": "#fffbff",
              "on-background": "#1b1c1c",
              "surface-tint": "#bb0452",
              "primary-fixed": "#ffd9df",
              "on-primary": "#ffffff",
              "outline-variant": "#e2bec3",
              "background": "#fcf9f8",
              "surface-variant": "#e4e2e1",
              "tertiary-fixed": "#e3dfff",
              "surface-container-highest": "#e4e2e1",
              "on-secondary-container": "#fffbff",
              "on-primary-fixed": "#3f0017",
              "primary": "#b7004f",
              "inverse-surface": "#303030",
              "error-container": "#ffdad6",
              "surface": "#fcf9f8",
              "inverse-on-surface": "#f3f0ef",
              "on-primary-fixed-variant": "#90003d",
              "inverse-primary": "#ffb1c0",
              "error": "#ba1a1a",
              "outline": "#8e6f74",
              "surface-container-high": "#eae7e7",
              "surface-container-lowest": "#ffffff"
          },
          "borderRadius": {
              "DEFAULT": "0.25rem",
              "lg": "0.5rem",
              "xl": "0.75rem",
              "full": "9999px"
          },
          "spacing": {
              "xs": "4px",
              "xl": "20px",
              "container-padding": "16px",
              "md": "12px",
              "gutter": "12px",
              "lg": "16px",
              "sm": "8px"
          },
          "fontFamily": {
              "heading": ["-apple-system", "BlinkMacSystemFont", "'Segoe UI'", "Roboto", "sans-serif"],
              "helper": ["-apple-system", "BlinkMacSystemFont", "'Segoe UI'", "Roboto", "sans-serif"],
              "label": ["-apple-system", "BlinkMacSystemFont", "'Segoe UI'", "Roboto", "sans-serif"],
              "body": ["-apple-system", "BlinkMacSystemFont", "'Segoe UI'", "Roboto", "sans-serif"]
          },
          "fontSize": {
              "heading": ["16px", { "lineHeight": "1.2", "fontWeight": "700" }],
              "helper": ["11px", { "lineHeight": "1.3", "fontWeight": "400" }],
              "label": ["12px", { "lineHeight": "1.4", "fontWeight": "500" }],
              "body": ["14px", { "lineHeight": "1.5", "fontWeight": "400" }]
          }
      }
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries'),
  ],
}
