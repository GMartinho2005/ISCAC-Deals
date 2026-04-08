/** @type {import('tailwindcss').Config} */
module.exports = {
  // O content diz ao Tailwind onde estão os teus ficheiros
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {},
  },
  plugins: [],
}