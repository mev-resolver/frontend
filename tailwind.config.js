/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}','./components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        abyss:  '#0A0F1A',
        hull:   '#111827',
        sonar:  '#1F2937',
        teal:   '#2DD4BF',
        orange: '#F97316',
        safe:   '#10B981',
        danger: '#EF4444',
        muted:  '#9CA3AF',
        bright: '#F3F4F6',
        blue:   '#3B82F6',
      },
      fontFamily: {
        mono: ['Space Mono','Courier New','monospace'],
        body: ['DM Sans','system-ui','sans-serif'],
        display: ['Syne','system-ui','sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
      },
    },
  },
  plugins: [],
};
