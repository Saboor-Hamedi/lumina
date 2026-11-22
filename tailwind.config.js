/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: 'var(--text-accent)',
          100: 'var(--text-accent)',
          200: 'var(--text-accent)',
          300: 'var(--text-accent)',
          400: 'var(--text-accent)',
          500: 'var(--text-accent)',
          600: 'var(--text-accent-hover)',
          700: 'var(--text-accent-hover)',
          800: 'var(--text-accent-hover)',
          900: 'var(--text-accent-hover)'
        },
        slate: {
          50: 'var(--bg-sidebar)',
          100: 'var(--bg-panel)',
          800: 'var(--bg-panel)',
          900: 'var(--bg-app)'
        },
        red: {
          50: '#ff938a',
          100: '#ff7f75',
          200: '#ff6a60',
          300: '#ff554c',
          400: '#ff4037',
          500: '#ff2b23',
          600: '#e6241f',
          700: '#b31c18',
          800: '#801210',
          900: '#4c0808'
        }
      },
      fontSize: {
        large: '1.125rem', // 18px (or any value you want)
        medium: '1rem', // 16px example
        small: '0.875rem', // 14px example
        xsmall: '0.75rem', // 12px example
        tiny: '0.625rem' // 10px example
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideIn: {
          '0%': { transform: 'translateX(-10px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' }
        }
      }
    }
  },
  plugins: []
}
