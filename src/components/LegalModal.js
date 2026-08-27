import { t } from '../i18n/translations.js';
import { nativePlatform } from '../utils/nativePlatform.js';

export class LegalModal {
  constructor(lang = 'pl') {
    this.currentLang = lang;
    this.modal = document.getElementById('modal-legal');
    this.btnClose = document.getElementById('modal-legal-close');

    // Tabs
    this.tabBtnMission = document.getElementById('tab-btn-legal-mission');
    this.tabBtnPrivacy = document.getElementById('tab-btn-legal-privacy');
    this.tabBtnTerms = document.getElementById('tab-btn-legal-terms');

    this.tabMissionText = document.getElementById('tab-legal-mission-text');
    this.tabPrivacyText = document.getElementById('tab-legal-privacy-text');
    this.tabTermsText = document.getElementById('tab-legal-terms-text');

    // Views
    this.viewMission = document.getElementById('view-tab-legal-mission');
    this.viewPrivacy = document.getElementById('view-tab-legal-privacy');
    this.viewTerms = document.getElementById('view-tab-legal-terms');

    this.activeTab = 'mission';

    this.bindEvents();
    this.updateLanguageStrings();
  }

  updateLanguage(lang) {
    this.currentLang = lang;
    this.updateLanguageStrings();
    if (this.modal && this.modal.classList.contains('active')) {
      this.render();
    }
  }

  updateLanguageStrings() {
    const l = this.currentLang;
    if (this.tabMissionText) this.tabMissionText.textContent = t('tabMissionText', l);
    if (this.tabPrivacyText) this.tabPrivacyText.textContent = t('tabPrivacyText', l);
    if (this.tabTermsText) this.tabTermsText.textContent = t('tabTermsText', l);
  }

  bindEvents() {
    if (this.btnClose) {
      this.btnClose.addEventListener('click', () => {
        nativePlatform.playBlip();
        this.close();
      });
    }

    if (this.tabBtnMission) {
      this.tabBtnMission.addEventListener('click', () => this.switchTab('mission'));
    }
    if (this.tabBtnPrivacy) {
      this.tabBtnPrivacy.addEventListener('click', () => this.switchTab('privacy'));
    }
    if (this.tabBtnTerms) {
      this.tabBtnTerms.addEventListener('click', () => this.switchTab('terms'));
    }

    if (this.modal) {
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) {
          nativePlatform.playBlip();
          this.close();
        }
      });
    }
  }

  switchTab(tabName) {
    nativePlatform.playBlip();
    this.activeTab = tabName;

    nativePlatform.transition(() => {
      [this.tabBtnMission, this.tabBtnPrivacy, this.tabBtnTerms].forEach(b => b?.classList.remove('active'));
      [this.viewMission, this.viewPrivacy, this.viewTerms].forEach(v => {
        if (v) v.style.display = 'none';
      });

      if (tabName === 'mission') {
        this.tabBtnMission?.classList.add('active');
        if (this.viewMission) this.viewMission.style.display = 'block';
      } else if (tabName === 'privacy') {
        this.tabBtnPrivacy?.classList.add('active');
        if (this.viewPrivacy) this.viewPrivacy.style.display = 'block';
      } else if (tabName === 'terms') {
        this.tabBtnTerms?.classList.add('active');
        if (this.viewTerms) this.viewTerms.style.display = 'block';
      }
    });
  }

  open(initialTab = 'mission') {
    nativePlatform.playBlip();
    if (this.modal) {
      this.modal.classList.add('active');
      this.switchTab(initialTab);
    }
  }

  close() {
    if (this.modal) {
      this.modal.classList.remove('active');
    }
  }

  render() {
    this.switchTab(this.activeTab);
  }
}
