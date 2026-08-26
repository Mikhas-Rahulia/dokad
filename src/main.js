import { MapController } from './components/MapController.js';
import { AppUI } from './components/UI.js';
import { PWAInstallPrompt } from './components/PWAInstallPrompt.js';

document.addEventListener('DOMContentLoaded', () => {
  const mapController = new MapController('map');
  
  const ui = new AppUI({
    mapController
  });

  const pwaPrompt = new PWAInstallPrompt();

  // Register PWA Service Worker for offline capability & instant auto-update
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => {
        // Check for updates
        reg.update();
      })
      .catch((err) => {
        console.warn('ServiceWorker registration failed:', err);
      });

    // Auto refresh when new SW takes control
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('New ServiceWorker active, updating app...');
    });
  }
});
