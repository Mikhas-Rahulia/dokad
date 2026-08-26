import { t } from '../i18n/translations.js';

const DISMISS_KEY = 'dokad_pwa_install_dismissed_until_v1';

export class PWAInstallPrompt {
  constructor() {
    this.deferredPrompt = null;
    this.currentLang = this.detectLanguage();

    this.banner = document.getElementById('pwa-install-banner');
    this.btnInstall = document.getElementById('btn-pwa-install-action');
    this.btnDismiss = document.getElementById('btn-pwa-install-dismiss');
    this.titleEl = document.getElementById('pwa-install-title');
    this.subtitleEl = document.getElementById('pwa-install-subtitle');
    this.iosModal = document.getElementById('modal-pwa-ios-instructions');
    this.iosCloseBtn = document.getElementById('modal-pwa-ios-close');
    this.iosStep1El = document.getElementById('pwa-ios-step1');
    this.iosStep2El = document.getElementById('pwa-ios-step2');

    this.init();
  }

  detectLanguage() {
    const navLang = (navigator.language || 'ru').toLowerCase();
    if (navLang.startsWith('pl')) return 'pl';
    if (navLang.startsWith('be')) return 'be';
    if (navLang.startsWith('nl')) return 'nl';
    if (navLang.startsWith('ru')) return 'ru';
    return 'en';
  }

  isStandalone() {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      document.referrer.includes('android-app://')
    );
  }

  isIos() {
    const ua = window.navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(ua);
  }

  isDismissed() {
    const dismissedUntil = localStorage.getItem(DISMISS_KEY);
    if (!dismissedUntil) return false;
    return Date.now() < Number(dismissedUntil);
  }

  init() {
    if (this.isStandalone()) {
      return; // Already running as installed PWA
    }

    this.bindEvents();
    this.updateLanguageStrings();

    // Listen for Chromium / Android install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      if (!this.isDismissed()) {
        this.showBanner();
      }
    });

    // iOS Safari or Firefox/Desktop fallback prompt
    if (this.isIos() && !this.isDismissed()) {
      setTimeout(() => this.showBanner(), 2500);
    }

    window.addEventListener('appinstalled', () => {
      this.hideBanner();
      this.deferredPrompt = null;
      console.log('🎉 Dokąd PWA installed successfully!');
    });
  }

  bindEvents() {
    if (this.btnInstall) {
      this.btnInstall.addEventListener('click', () => this.handleInstallClick());
    }
    if (this.btnDismiss) {
      this.btnDismiss.addEventListener('click', () => this.dismiss());
    }
    if (this.iosCloseBtn) {
      this.iosCloseBtn.addEventListener('click', () => {
        if (this.iosModal) this.iosModal.classList.remove('active');
      });
    }
  }

  updateLanguage(lang) {
    this.currentLang = lang;
    this.updateLanguageStrings();
  }

  updateLanguageStrings() {
    const lang = this.currentLang;
    if (this.titleEl) this.titleEl.textContent = t('pwaInstallTitle', lang);
    if (this.subtitleEl) this.subtitleEl.textContent = t('pwaInstallSubtitle', lang);
    if (this.btnInstall) this.btnInstall.textContent = t('pwaInstallButton', lang);
    if (this.btnDismiss) this.btnDismiss.textContent = t('pwaDismiss', lang);
    if (this.iosStep1El) this.iosStep1El.textContent = t('pwaIosStep1', lang);
    if (this.iosStep2El) this.iosStep2El.textContent = t('pwaIosStep2', lang);
  }

  showBanner() {
    if (this.banner) {
      this.banner.style.display = 'flex';
      setTimeout(() => this.banner.classList.add('visible'), 50);
    }
  }

  hideBanner() {
    if (this.banner) {
      this.banner.classList.remove('visible');
      setTimeout(() => {
        this.banner.style.display = 'none';
      }, 300);
    }
  }

  async handleInstallClick() {
    if (this.deferredPrompt) {
      // Chromium, Android Chrome, Edge, Desktop Chrome
      this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        this.hideBanner();
      }
      this.deferredPrompt = null;
    } else if (this.isIos()) {
      // iOS Safari Add to Home Screen Instructions Modal
      if (this.iosModal) {
        this.iosModal.classList.add('active');
      }
    } else {
      // Firefox or other browser fallback
      if (this.iosModal) {
        this.iosModal.classList.add('active');
      }
    }
  }

  dismiss() {
    this.hideBanner();
    // Dismiss for 2 days
    const twoDaysLater = Date.now() + 2 * 24 * 60 * 60 * 1000;
    localStorage.setItem(DISMISS_KEY, String(twoDaysLater));
  }
}
