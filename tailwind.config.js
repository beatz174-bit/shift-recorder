/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f5f3ff',
          100: '#ebe8ff',
          200: '#cec8ff',
          300: '#b0a7ff',
          400: '#9286ff',
          500: '#7c6dff',
          600: '#6a55f6',
          700: '#563edb',
          800: '#402eb3',
          900: '#2d1f80',
          950: '#1d1454',
          DEFAULT: '#6755f5',
          foreground: '#f9f8ff',
          emphasis: '#4d36ce',
          muted: '#efeafd',
          ring: '#cfc6ff'
        },
        neutral: {
          50: '#f6f7fb',
          100: '#eceef6',
          200: '#d9ddea',
          300: '#bfc4d4',
          400: '#9ea5b8',
          500: '#7b8296',
          600: '#61687d',
          700: '#4c5163',
          800: '#343945',
          900: '#1f2331',
          950: '#121421'
        },
        midnight: {
          50: '#eef3ff',
          100: '#d5defc',
          200: '#b3c4f8',
          300: '#8099f0',
          400: '#5273e7',
          500: '#2f50d9',
          600: '#253fb7',
          700: '#1e338f',
          800: '#182871',
          900: '#121f56',
          950: '#080e2b'
        }
      }
    }
  },
  plugins: []
};
