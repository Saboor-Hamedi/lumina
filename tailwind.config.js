/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: 'var(--ev-c-accent)', // Using accent for all for now to ensure visibility
          100: 'var(--ev-c-accent)',
          200: 'var(--ev-c-accent)',
          300: 'var(--ev-c-accent)',
          400: 'var(--ev-c-accent)',
          500: 'var(--ev-c-accent)', // Main primary color
          600: 'var(--ev-c-accent-hover)',
          700: 'var(--ev-c-accent-hover)',
          800: 'var(--ev-c-accent-hover)',
          900: 'var(--ev-c-accent-hover)'
        },
        // We can also map slate/backgrounds if we want full control
        slate: {
          50: 'var(--color-background-soft)',
          100: 'var(--color-background-mute)',
          800: 'var(--color-background-mute)',
          900: 'var(--color-background)'
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
