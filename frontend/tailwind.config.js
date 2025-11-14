/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        voyage: {
          primary: '#23424A',
          accent: '#57A5B8',
          light: '#E8EEEA',
          secondary: '#A2C4E0',
          red: {
            50: '#E8EEEA',
            100: '#A2C4E0',
            200: '#57A5B8',
            300: '#57A5B8',
            400: '#57A5B8',
            500: '#57A5B8',
            600: '#57A5B8',
            700: '#23424A',
            800: '#23424A',
            900: '#23424A',
          },
        },
      },
      fontFamily: {
        display: ['Poppins', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}