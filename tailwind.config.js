/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'umb-red': '#B91C1C',
        'umb-red-dark': '#7F1D1D',
        'umb-blue': '#2563EB',
        'umb-blue-dark': '#1D4ED8',
        'umb-gray': '#F5F6FA',
      },
      boxShadow: {
        soft: '0px 10px 25px rgba(0,0,0,0.08)',
        card: '0px 8px 20px rgba(0,0,0,0.06)',
      },
    },
  },
  plugins: [],
};
