import type { Config } from 'tailwindcss'
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Cormorant Garamond', 'Georgia', 'serif'],
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
      },
      colors: {
        wine: {
          50: '#fdf2f2',
          100: '#fce4e4',
          200: '#f9c0c0',
          400: '#e06060',
          600: '#8B1A1A',
          700: '#6B1414',
          800: '#4A0E0E',
          900: '#2D0808',
        }
      }
    },
  },
  plugins: [],
}
export default config
