/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cyber: {
          dark: '#020617',
          card: '#0f172a',
          border: '#1e293b',
          accent: '#8b5cf6', // Violet
          cyan: '#06b6d4',   // Cyan
          pink: '#ec4899',   // Pink
          light: '#f8fafc',
          lightCard: '#ffffff',
          lightBorder: '#e2e8f0',
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
