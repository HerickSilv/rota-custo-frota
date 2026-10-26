import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Hosts exatos que o app pode contatar. Qualquer outro é bloqueado pelo navegador (CSP).
const CONNECT_HOSTS = [
  'https://router.project-osrm.org', // rotas (OSRM demo)
  'https://geocoding-api.open-meteo.com', // busca de cidades
  'https://api.open-meteo.com', // previsão do tempo
  'https://fipe.parallelum.com.br', // tabela FIPE
  'https://api.bcb.gov.br', // Selic (custo de capital)
  'https://tiles.openfreemap.org', // estilo, glifos, sprites e tiles do mapa
];

const csp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self' ${CONNECT_HOSTS.join(' ')}`,
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

// CSP só no build de produção: o dev server do Vite injeta scripts inline para HMR.
const injectCsp = (): Plugin => ({
  name: 'inject-csp',
  apply: 'build',
  transformIndexHtml: () => [
    { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: csp }, injectTo: 'head-prepend' },
    { tag: 'meta', attrs: { name: 'referrer', content: 'strict-origin-when-cross-origin' }, injectTo: 'head-prepend' },
  ],
});

export default defineConfig({
  // './' funciona em qualquer subcaminho do GitHub Pages; o deploy pode forçar VITE_BASE=/nome-do-repo/.
  base: process.env.VITE_BASE ?? './',
  plugins: [react(), tailwindcss(), injectCsp()],
  build: { target: 'es2022', chunkSizeWarningLimit: 1100 },
});
