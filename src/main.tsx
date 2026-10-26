import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter/wght.css';
import '@fontsource/barlow-condensed/latin-500.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import './index.css';
import { App } from './App';

const root = document.getElementById('root');
if (!root) throw new Error('Elemento #root ausente');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
