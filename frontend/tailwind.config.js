/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#000000',
          800: '#111111',
          700: '#2a2a2a',
        },
        primary: {
          500: '#c0c0c0',
          600: '#a0a0a0',
        },
        accent: {
          500: '#e5e7eb',
          600: '#d1d5db',
        },
        danger: '#ef4444',
        safe: '#10b981',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
