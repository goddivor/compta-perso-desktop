/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}'
  ],
  theme: {
    extend: {
      colors: {
        base:       '#161311',
        surface:    '#211C1A',
        surface2:   '#2A2421',
        edge:       '#352E2A',
        ink:        '#F5F1EC',
        content:    '#D8D2CA',
        muted:      '#A89E92',
        faint:      '#807669',
        primary:    '#FFD200',
        primary600: '#E6BD00',
        primaryInk: '#1A1714',
      },
      fontFamily: {
        sans: ['Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      }
    }
  },
  plugins: []
}
