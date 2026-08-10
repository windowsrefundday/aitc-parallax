/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'Inter', 'sans-serif'],
        serif: ['Playfair Display', 'Georgia', 'serif'],
      },
      colors: {
        aitc: {
          dark: '#0b0d10',
          gold: '#c5a059',
          offwhite: '#f5f5f0',
          muted: '#8e959e',
          green: '#1b2e24',
        }
      }
    },
  },
  plugins: [],
}
