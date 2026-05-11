/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all files that contain Nativewind classes.
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Primary
        "primary": "#00490e",
        "primary-container": "#0d631b",
        "on-primary": "#ffffff",
        "on-primary-container": "#8bdd86",
        "primary-fixed": "#a3f69c",
        "primary-fixed-dim": "#88d982",
        "on-primary-fixed-variant": "#005312",
        "on-primary-fixed": "#002203",
        // Secondary
        "secondary": "#8b5000",
        "secondary-container": "#ffb05f",
        "on-secondary": "#ffffff",
        "on-secondary-container": "#754300",
        "secondary-fixed": "#ffdcbe",
        "secondary-fixed-dim": "#ffb871",
        "on-secondary-fixed-variant": "#6a3c00",
        "on-secondary-fixed": "#2d1600",
        // Tertiary
        "tertiary": "#741a41",
        "tertiary-container": "#923258",
        "on-tertiary": "#ffffff",
        "on-tertiary-container": "#ffb6cc",
        "tertiary-fixed": "#ffd9e2",
        "tertiary-fixed-dim": "#ffb1c8",
        "on-tertiary-fixed-variant": "#7f2349",
        "on-tertiary-fixed": "#3e001d",
        // Error
        "error": "#ba1a1a",
        "error-container": "#ffdad6",
        "on-error": "#ffffff",
        "on-error-container": "#93000a",
        // Surface & Background
        "background": "#f4f4f5",
        "surface": "#f9f9f9",
        "surface-bright": "#f9f9f9",
        "surface-dim": "#dadada",
        "surface-variant": "#e2e2e2",
        "surface-tint": "#1b6d24",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f3f3f3",
        "surface-container": "#eeeeee",
        "surface-container-high": "#e8e8e8",
        "surface-container-highest": "#e2e2e2",
        // On-Surface
        "on-background": "#1a1c1c",
        "on-surface": "#1a1c1c",
        "on-surface-variant": "#40493d",
        "inverse-on-surface": "#f1f1f1",
        // Outline
        "outline": "#707a6c",
        "outline-variant": "#bfcaba",
        // Inverse
        "inverse-primary": "#88d982",
        "inverse-surface": "#2f3131",
      },
      fontFamily: {
        "jakarta-sans": ["PlusJakartaSans", "Plus Jakarta Sans", "sans-serif"],
        inter: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
