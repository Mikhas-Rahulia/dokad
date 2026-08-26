import { t } from '../i18n/translations.js';

const PROMPT_SEEN_KEY = 'dokad_pwa_one_time_prompt_v2';
const SHOW_DELAY_MS = 10000; // Trigger after 10 seconds of usage
const CLOSE_UNLOCK_SECONDS = 3; // Closable after 3 seconds

export class PWAInstallPrompt {
  constructor() {
    this.deferredPrompt = null;
    this.currentLang = this.detectLanguage();
    this.timerId = null;
    this.closeCountdownInterval = null;
    this.isCloseUnlocked = false;

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

  hasAlreadySeenPrompt() {
    return localStorage.getItem(PROMPT_SEEN_KEY) === 'true';
  }

  markAsSeen() {
    localStorage.setItem(PROMPT_SEEN_KEY, 'true');
  }

  init() {
    // If running inside installed PWA or already seen prompt, do not show
    if (this.isStandalone() || this.hasAlreadySeenPrompt()) {
      return;
    }

    this.bindEvents();
    this.updateLanguageStrings();

    // Listen for Chromium / Android beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
    });

    // Schedule 1-time prompt to show strictly after 10 seconds of usage
    this.timerId = setTimeout(() => {
      if (!this.isStandalone() && !this.hasAlreadySeenPrompt()) {
        this.showBanner();
      }
    }, SHOW_DELAY_MS);

    window.addEventListener('appinstalled', () => {
      this.hideBanner();
      this.markAsSeen();
      this.deferredPrompt = null;
      console.log('🎉 Dokąd PWA installed!');
    });
  }

  bindEvents() {
    if (this.btnInstall) {
      this.btnInstall.addEventListener('click', () => this.handleInstallClick());
    }
    if (this.btnDismiss) {
      this.btnDismiss.addEventListener('click', () => {
        if (this.isCloseUnlocked) {
          this.dismiss();
        }
      });
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
    if (this.iosStep1El) this.iosStep1El.textContent = t('pwaIosStep1', lang);
    if (this.iosStep2El) this.iosStep2El.textContent = t('pwaIosStep2', lang);
  }

  showBanner() {
    if (!this.banner) return;

    this.banner.style.display = 'flex';
    setTimeout(() => this.banner.classList.add('visible'), 50);

    // 3-second countdown before close button becomes active
    this.startCloseCountdown();
  }

  startCloseCountdown() {
    if (!this.btnDismiss) return;

    let remaining = CLOSE_UNLOCK_SECONDS;
    this.isCloseUnlocked = false;
    this.btnDismiss.disabled = true;
    this.btnDismiss.classList.add('locked');
    this.btnDismiss.textContent = `${remaining}s`;

    if (this.closeCountdownInterval) clearInterval(this.closeCountdownInterval);

    this.closeCountdownInterval = setInterval(() => {
      remaining--;
      if (remaining > 0) {
        this.btnDismiss.textContent = `${remaining}s`;
      } else {
        clearInterval(this.closeCountdownInterval);
        this.isCloseUnlocked = true;
        this.btnDismiss.disabled = false;
        this.btnDismiss.classList.remove('locked');
        this.btnDismiss.textContent = '✕';
      }
    }, 1000);
  }

  hideBanner() {
    if (this.banner) {
      this.banner.classList.remove('visible');
      setTimeout(() => {
        this.banner.style.display = 'none';
      }, 300);
    }
    if (this.closeCountdownInterval) {
      clearInterval(this.closeCountdownInterval);
    }
  }

  async handleInstallClick() {
    this.markAsSeen();

    if (this.deferredPrompt) {
      // Chromium / Android Chrome / Edge
      this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        this.hideBanner();
      }
      this.deferredPrompt = null;
    } else if (this.isIos()) {
      // iOS Safari Add to Home Screen Modal
      if (this.iosModal) {
        this.iosModal.classList.add('active');
      }
      this.hideBanner();
    } else {
      // Other browsers
      if (this.iosModal) {
        this.iosModal.classList.add('active');
      }
      this.hideBanner();
    }
  }

  dismiss() {
    this.markAsSeen();
    this.hideBanner();
  }
}
