/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#005e97',
        primaryContainer: '#0077be',
        secondary: '#455f88',
        tertiary: '#8b4800',
        surface: '#f7f9fc',
        surfaceContainerLow: '#f2f4f7',
        onSurface: '#191c1e',
      },
      fontFamily: {
        manrope: ['Manrope', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
        grotesk: ['Space Grotesk', 'sans-serif'],
      },
      keyframes: {
        // Parpadeo de alerta critica: pulso suave, no destello duro
        parpadeoAlerta: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.45' },
        },
      },
      animation: {
        parpadeoAlerta: 'parpadeoAlerta 1.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}