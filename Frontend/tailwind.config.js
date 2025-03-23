/** @type {import('tailwindcss').Config} */
export const content = [
  "./index.html",
  "./src/**/*.{js,jsx,ts,tsx}"
];
export const theme = {
  extend: {
    colors: {
      'primary': '#7209b7',
      'secondary': '#3a0ca3',
      'accent-color': '#4cc9f0',
      'background': '#222222',
      'surface': '#2a2a2a',
      'surface-secondary': '#333333',
      'text': '#f8f9fa',
      'dark-square': '#534c64',
      'light-square': '#b8b5c8',
      'positive-eval': '#4ade80',
      'negative-eval': '#f87171',
    },
    borderRadius: {
      'bento': '12px',
    },
    boxShadow: {
      'neumorphic': '5px 5px 10px rgba(0, 0, 0, 0.3), -5px -5px 10px rgba(255, 255, 255, 0.05)',
      'neumorphic-inset': 'inset 2px 2px 5px rgba(0, 0, 0, 0.3), inset -2px -2px 5px rgba(255, 255, 255, 0.05)',
      'glow': '0 0 15px rgba(76, 201, 240, 0.3)',
    },
    animation: {
      'logo-reveal': 'logoReveal 1.5s ease forwards',
      'letter-wave': 'letterWave 2s ease infinite',
    },
    keyframes: {
      logoReveal: {
        '0%': { 'clip-path': 'inset(0 100% 0 0)', opacity: 0 },
        '100%': { 'clip-path': 'inset(0 0 0 0)', opacity: 1 },
      },
      letterWave: {
        '0%, 100%': { transform: 'translateY(0)' },
        '50%': { transform: 'translateY(-5px)' },
      },
    },
  },
};
export const plugins = [];