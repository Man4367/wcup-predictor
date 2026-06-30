/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'wcup-dark': '#0a0e17',
        'wcup-card': '#141b2d',
        'wcup-border': '#1e2a45',
        'wcup-orange': '#ff6b00',
        'wcup-orange-light': '#ff8c38',
        'wcup-orange-dark': '#cc5500',
        'wcup-gold': '#ffd700',
        'wcup-green': '#22c55e',
        'wcup-red': '#ef4444',
        'wcup-blue': '#3b82f6',
        'wcup-text': '#e2e8f0',
        'wcup-muted': '#64748b',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fill-bar': 'fillBar 1s ease-out forwards',
        'slide-up': 'slideUp 0.5s ease-out forwards',
        'fade-in': 'fadeIn 0.3s ease-out forwards',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        fillBar: {
          '0%': { width: '0%' },
          '100%': { width: 'var(--bar-width)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(255,107,0,0.2), 0 0 20px rgba(255,107,0,0.1)' },
          '100%': { boxShadow: '0 0 20px rgba(255,107,0,0.4), 0 0 60px rgba(255,107,0,0.2)' },
        },
      },
    },
  },
  plugins: [],
}
