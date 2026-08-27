import { t } from '../i18n/translations.js';

const LAST_PROMPT_KEY = 'dokad_pwa_last_prompt_timestamp_v1';
const SHOW_DELAY_MS = 10000; // Trigger after 10 seconds of usage
const CLOSE_UNLOCK_SECONDS = 10; // Closable strictly after 10 seconds
const PROMPT_INTERVAL_MS = 5 * 24 * 60 * 60 * 1000; // Rare periodic popup: at most once every 5 days

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
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches ||
      window.navigator.standalone === true ||
      document.referrer.includes('android-app://')
    );
  }

  isIos() {
    const ua = window.navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(ua);
  }

  shouldShowPeriodicPrompt() {
    // 1. NEVER show if running as installed PWA standalone app
    if (this.isStandalone()) {
      return false;
    }

    // 2. Rare periodic interval: only show if at least 5 days have passed since last shown
    const lastPrompt = localStorage.getItem(LAST_PROMPT_KEY);
    if (!lastPrompt) return true;

    const elapsed = Date.now() - parseInt(lastPrompt, 10);
    return elapsed >= PROMPT_INTERVAL_MS;
  }

  markPromptShown() {
    localStorage.setItem(LAST_PROMPT_KEY, Date.now().toString());
  }

  init() {
    // If running inside installed PWA, abort immediately
    if (this.isStandalone()) {
      return;
    }

    this.bindEvents();
    this.updateLanguageStrings();

    // Listen for Chromium / Android beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
    });

    // Schedule prompt to show rarely after 10 seconds of active usage
    if (this.shouldShowPeriodicPrompt()) {
      this.timerId = setTimeout(() => {
        if (!this.isStandalone() && this.shouldShowPeriodicPrompt()) {
          this.showBanner();
        }
      }, SHOW_DELAY_MS);
    }

    window.addEventListener('appinstalled', () => {
      this.hideBanner();
      this.markPromptShown();
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
    this.markPromptShown();

    this.banner.style.display = 'flex';
    setTimeout(() => this.banner.classList.add('visible'), 50);

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
    this.markPromptShown();

    if (this.deferredPrompt) {
      this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        this.hideBanner();
      }
      this.deferredPrompt = null;
    } else if (this.isIos()) {
      if (this.iosModal) {
        this.iosModal.classList.add('active');
      }
      this.hideBanner();
    } else {
      if (this.iosModal) {
        this.iosModal.classList.add('active');
      }
      this.hideBanner();
    }
  }

  dismiss() {
    this.markPromptShown();
    this.hideBanner();
  }
}
