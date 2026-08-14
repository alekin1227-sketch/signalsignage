/** @type {import('tailwindcss').Config} */
export default { darkMode: ['class'], content: ['./index.html','./src/**/*.{ts,tsx}'], theme: { extend: { colors: {
  border:'hsl(var(--border))', background:'hsl(var(--background))', foreground:'hsl(var(--foreground))',
  card:'hsl(var(--card))', primary:'hsl(var(--primary))', muted:'hsl(var(--muted))', accent:'hsl(var(--accent))'
}, borderRadius: { xl: '1rem' } } }, plugins: [] };
