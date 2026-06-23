/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}'
  ],
  theme: {
    extend: {
      colors: {
        base:    '#121314',
        surface: '#191A1B',
        edge:    '#2A627B',
      }
    }
  },
  plugins: []
}
