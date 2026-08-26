import { MapController } from './components/MapController.js';
import { AppUI } from './components/UI.js';

document.addEventListener('DOMContentLoaded', () => {
  const mapController = new MapController('map');
  
  const ui = new AppUI({
    mapController
  });

  // Register PWA Service Worker for offline capability
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => {
          console.log('ServiceWorker registered with scope:', reg.scope);
        })
        .catch((err) => {
          console.warn('ServiceWorker registration failed:', err);
        });
    });
  }
});
