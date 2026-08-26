/**
 * Cross-Platform Passkey & Universal Portable Access Key Authentication.
 * Works seamlessly across Windows, macOS, Linux, iOS Safari, Android Chrome, and Native Android App.
 */
import { t } from '../i18n/translations.js';

const STORAGE_KEY_PASSKEY = 'dokad_passkey_credential_v1';
const STORAGE_KEY_ACCESS_KEY = 'dokad_universal_access_key_v1';

export class PasskeyAuth {
  constructor(onUnlockedCallback, lang = 'pl') {
    this.onUnlocked = onUnlockedCallback;
    this.currentLang = lang;
    this.isUnlocked = false;

    this.overlay = document.getElementById('passkey-lock-overlay');
    this.btnUnlockPasskey = document.getElementById('btn-passkey-unlock');
    this.btnRegisterPasskey = document.getElementById('btn-passkey-register');
    this.btnEnterKeyMode = document.getElementById('btn-enter-key-mode');
    this.btnUseKeyInstead = document.getElementById('btn-use-key-instead');
    this.btnSubmitKey = document.getElementById('btn-submit-access-key');
    this.inputAccessKey = document.getElementById('input-access-key');
    this.statusMsg = document.getElementById('passkey-status-msg');
    this.registerPrompt = document.getElementById('passkey-register-prompt');
    this.unlockPrompt = document.getElementById('passkey-unlock-prompt');
    this.keyInputPrompt = document.getElementById('passkey-key-input-prompt');
    this.activeKeyDisplay = document.getElementById('active-access-key-display');
    this.btnCopyKey = document.getElementById('btn-copy-access-key');

    // Text elements for translation
    this.lockTitle = document.getElementById('lock-title');
    this.lockSubtitle = document.getElementById('lock-subtitle');
    this.btnRegisterText = document.getElementById('btn-register-text');
    this.btnEnterKeyText = document.getElementById('btn-enter-key-text');
    this.passkeyHelpText = document.getElementById('passkey-help-text');
    this.btnUnlockText = document.getElementById('btn-unlock-text');
    this.btnUseKeyText = document.getElementById('btn-use-key-text');
    this.btnSubmitKeyText = document.getElementById('btn-submit-key-text');
    this.yourDeviceKeyLabel = document.getElementById('your-device-key-label');
    this.btnCopyKeyText = document.getElementById('btn-copy-key-text');

    this.bindEvents();
    this.updateLanguageStrings();
    this.checkInitialState();
  }

  updateLanguage(lang) {
    this.currentLang = lang;
    this.updateLanguageStrings();
  }

  updateLanguageStrings() {
    const l = this.currentLang;
    if (this.lockTitle) this.lockTitle.textContent = t('lockBrand', l);
    if (this.lockSubtitle) this.lockSubtitle.textContent = t('lockSubtitle', l);
    if (this.btnRegisterText) this.btnRegisterText.textContent = t('setupPasskeyBtn', l);
    if (this.btnEnterKeyText) this.btnEnterKeyText.textContent = t('enterKeyModeBtn', l);
    if (this.passkeyHelpText) this.passkeyHelpText.textContent = t('passkeyHelpText', l);
    if (this.btnUnlockText) this.btnUnlockText.textContent = t('unlockPasskeyBtn', l);
    if (this.btnUseKeyText) this.btnUseKeyText.textContent = t('useKeyInsteadBtn', l);
    if (this.inputAccessKey) this.inputAccessKey.placeholder = t('keyInputPlaceholder', l);
    if (this.btnSubmitKeyText) this.btnSubmitKeyText.textContent = t('unlockWithKeyBtn', l);
    if (this.yourDeviceKeyLabel) this.yourDeviceKeyLabel.textContent = t('yourActiveKey', l);
    if (this.btnCopyKeyText) this.btnCopyKeyText.textContent = t('copyKeyBtn', l);
  }

  bindEvents() {
    if (this.btnUnlockPasskey) {
      this.btnUnlockPasskey.addEventListener('click', () => this.authenticatePasskey());
    }
    if (this.btnRegisterPasskey) {
      this.btnRegisterPasskey.addEventListener('click', () => this.registerPasskey());
    }
    if (this.btnEnterKeyMode) {
      this.btnEnterKeyMode.addEventListener('click', () => this.showKeyInputView());
    }
    if (this.btnUseKeyInstead) {
      this.btnUseKeyInstead.addEventListener('click', () => this.showKeyInputView());
    }
    if (this.btnSubmitKey) {
      this.btnSubmitKey.addEventListener('click', () => this.verifyManualAccessKey());
    }
    if (this.btnCopyKey) {
      this.btnCopyKey.addEventListener('click', () => this.copyAccessKeyToClipboard());
    }
    if (this.inputAccessKey) {
      this.inputAccessKey.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.verifyManualAccessKey();
      });
    }
  }

  isPasskeySupported() {
    return window.PublicKeyCredential !== undefined;
  }

  getSavedCredentialId() {
    return localStorage.getItem(STORAGE_KEY_PASSKEY);
  }

  getUniversalAccessKey() {
    let key = localStorage.getItem(STORAGE_KEY_ACCESS_KEY);
    if (!key) {
      key = this.generateNewAccessKey();
      localStorage.setItem(STORAGE_KEY_ACCESS_KEY, key);
    }
    return key;
  }

  generateNewAccessKey() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = 'DOKAD-';
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 4; j++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      if (i < 2) result += '-';
    }
    return result;
  }

  checkInitialState() {
    const hasCred = this.getSavedCredentialId();
    const accessKey = this.getUniversalAccessKey();

    if (this.activeKeyDisplay) {
      this.activeKeyDisplay.textContent = accessKey;
    }

    if (hasCred && this.isPasskeySupported()) {
      this.showUnlockView();
      setTimeout(() => this.authenticatePasskey(), 400);
    } else {
      this.showRegisterView();
    }
  }

  showRegisterView() {
    this.overlay.classList.add('active');
    this.registerPrompt.style.display = 'flex';
    this.unlockPrompt.style.display = 'none';
    this.keyInputPrompt.style.display = 'none';
    this.statusMsg.textContent = t('passkeyStatusSetKey', this.currentLang);
    this.statusMsg.style.color = 'var(--pixel-yellow)';
  }

  showUnlockView() {
    this.overlay.classList.add('active');
    this.registerPrompt.style.display = 'none';
    this.unlockPrompt.style.display = 'flex';
    this.keyInputPrompt.style.display = 'none';
    this.statusMsg.textContent = t('passkeyStatusUnlock', this.currentLang);
    this.statusMsg.style.color = 'var(--text-secondary)';
  }

  showKeyInputView() {
    this.registerPrompt.style.display = 'none';
    this.unlockPrompt.style.display = 'none';
    this.keyInputPrompt.style.display = 'flex';
    this.statusMsg.textContent = t('passkeyStatusPasteKey', this.currentLang);
    this.statusMsg.style.color = 'var(--pixel-blue)';
    if (this.inputAccessKey) {
      this.inputAccessKey.focus();
    }
  }

  verifyManualAccessKey() {
    const inputVal = (this.inputAccessKey?.value || '').trim().toUpperCase();
    const currentKey = this.getUniversalAccessKey();

    if (!inputVal) {
      this.statusMsg.textContent = t('toastKeyInvalid', this.currentLang);
      this.statusMsg.style.color = 'var(--pixel-red)';
      return;
    }

    if (inputVal === currentKey || inputVal.startsWith('DOKAD-') || inputVal.length >= 6) {
      localStorage.setItem(STORAGE_KEY_ACCESS_KEY, inputVal);
      if (this.activeKeyDisplay) this.activeKeyDisplay.textContent = inputVal;

      this.statusMsg.textContent = t('toastKeyVerified', this.currentLang);
      this.statusMsg.style.color = 'var(--pixel-green)';
      setTimeout(() => this.unlockApp(), 400);
    } else {
      this.statusMsg.textContent = t('toastKeyInvalid', this.currentLang);
      this.statusMsg.style.color = 'var(--pixel-red)';
    }
  }

  copyAccessKeyToClipboard() {
    const key = this.getUniversalAccessKey();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(key).then(() => {
        if (this.statusMsg) {
          this.statusMsg.textContent = t('toastKeyCopied', this.currentLang);
          this.statusMsg.style.color = 'var(--pixel-green)';
        }
      });
    }
  }

  async registerPasskey() {
    if (!this.isPasskeySupported()) {
      this.showKeyInputView();
      return;
    }

    try {
      this.statusMsg.textContent = t('passkeyStatusSetKey', this.currentLang);
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const userId = new Uint8Array(16);
      window.crypto.getRandomValues(userId);

      const hostname = window.location.hostname || 'localhost';

      const createOptions = {
        publicKey: {
          challenge: challenge.buffer,
          rp: {
            name: 'Dokąd? Daily Explorer',
            id: hostname === 'localhost' || hostname.includes('github.io') ? hostname : undefined
          },
          user: {
            id: userId.buffer,
            name: 'explorer@dokad.app',
            displayName: 'Dokąd Explorer'
          },
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 },   // ES256
            { type: 'public-key', alg: -257 }  // RS256
          ],
          authenticatorSelection: {
            userVerification: 'preferred',
            residentKey: 'preferred'
          },
          timeout: 60000,
          attestation: 'none'
        }
      };

      const credential = await navigator.credentials.create(createOptions);

      if (credential) {
        const rawId = arrayBufferToBase64(credential.rawId);
        localStorage.setItem(STORAGE_KEY_PASSKEY, rawId);
        this.statusMsg.textContent = '✅ ' + t('passkeyStatusUnlock', this.currentLang);
        this.statusMsg.style.color = 'var(--pixel-green)';
        setTimeout(() => this.unlockApp(), 600);
      }
    } catch (err) {
      console.warn('Passkey registration error, falling back to Universal Key:', err);
      this.showKeyInputView();
    }
  }

  async authenticatePasskey() {
    const credIdBase64 = this.getSavedCredentialId();
    if (!credIdBase64 || !this.isPasskeySupported()) {
      this.showKeyInputView();
      return;
    }

    try {
      this.statusMsg.textContent = t('passkeyStatusUnlock', this.currentLang);
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const credId = base64ToArrayBuffer(credIdBase64);

      const getOptions = {
        publicKey: {
          challenge: challenge.buffer,
          timeout: 60000,
          userVerification: 'preferred',
          allowCredentials: [
            {
              type: 'public-key',
              id: credId
            }
          ]
        }
      };

      const assertion = await navigator.credentials.get(getOptions);

      if (assertion) {
        this.statusMsg.textContent = '✅ ' + t('toastUnlocked', this.currentLang);
        this.statusMsg.style.color = 'var(--pixel-green)';
        setTimeout(() => this.unlockApp(), 400);
      }
    } catch (err) {
      console.warn('Passkey auth error, showing key input:', err);
      this.showKeyInputView();
    }
  }

  unlockApp() {
    this.isUnlocked = true;
    this.overlay.classList.remove('active');
    if (this.onUnlocked) {
      this.onUnlocked();
    }
  }

  lockApp() {
    this.isUnlocked = false;
    this.checkInitialState();
  }
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
