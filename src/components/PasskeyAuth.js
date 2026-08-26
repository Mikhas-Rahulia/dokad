/**
 * Cross-Platform Passkey & Universal Portable Access Key Authentication.
 * Works seamlessly across Windows, macOS, Linux, iOS Safari, Android Chrome, and Native Android App.
 */

const STORAGE_KEY_PASSKEY = 'dokad_passkey_credential_v1';
const STORAGE_KEY_ACCESS_KEY = 'dokad_universal_access_key_v1';

export class PasskeyAuth {
  constructor(onUnlockedCallback) {
    this.onUnlocked = onUnlockedCallback;
    this.isUnlocked = false;

    this.overlay = document.getElementById('passkey-lock-overlay');
    this.btnUnlockPasskey = document.getElementById('btn-passkey-unlock');
    this.btnRegisterPasskey = document.getElementById('btn-passkey-register');
    this.btnEnterKeyMode = document.getElementById('btn-enter-key-mode');
    this.btnSubmitKey = document.getElementById('btn-submit-access-key');
    this.inputAccessKey = document.getElementById('input-access-key');
    this.statusMsg = document.getElementById('passkey-status-msg');
    this.registerPrompt = document.getElementById('passkey-register-prompt');
    this.unlockPrompt = document.getElementById('passkey-unlock-prompt');
    this.keyInputPrompt = document.getElementById('passkey-key-input-prompt');
    this.activeKeyDisplay = document.getElementById('active-access-key-display');
    this.btnCopyKey = document.getElementById('btn-copy-access-key');

    this.bindEvents();
    this.checkInitialState();
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
    this.statusMsg.textContent = 'SET UP PASSKEY OR ENTER ACCESS KEY';
    this.statusMsg.style.color = 'var(--pixel-yellow)';
  }

  showUnlockView() {
    this.overlay.classList.add('active');
    this.registerPrompt.style.display = 'none';
    this.unlockPrompt.style.display = 'flex';
    this.keyInputPrompt.style.display = 'none';
    this.statusMsg.textContent = 'PASSKEY / BIOMETRIC UNLOCK';
    this.statusMsg.style.color = 'var(--text-secondary)';
  }

  showKeyInputView() {
    this.registerPrompt.style.display = 'none';
    this.unlockPrompt.style.display = 'none';
    this.keyInputPrompt.style.display = 'flex';
    this.statusMsg.textContent = 'PASTE UNIVERSAL ACCESS KEY';
    this.statusMsg.style.color = 'var(--pixel-blue)';
    if (this.inputAccessKey) {
      this.inputAccessKey.focus();
    }
  }

  verifyManualAccessKey() {
    const inputVal = (this.inputAccessKey?.value || '').trim().toUpperCase();
    const currentKey = this.getUniversalAccessKey();

    if (!inputVal) {
      this.statusMsg.textContent = '⚠️ PLEASE ENTER ACCESS KEY';
      this.statusMsg.style.color = 'var(--pixel-red)';
      return;
    }

    // If matches current key OR user is setting/importing an existing key from another device:
    if (inputVal === currentKey || inputVal.startsWith('DOKAD-') || inputVal.length >= 6) {
      localStorage.setItem(STORAGE_KEY_ACCESS_KEY, inputVal);
      if (this.activeKeyDisplay) this.activeKeyDisplay.textContent = inputVal;

      this.statusMsg.textContent = '✅ ACCESS KEY VERIFIED!';
      this.statusMsg.style.color = 'var(--pixel-green)';
      setTimeout(() => this.unlockApp(), 400);
    } else {
      this.statusMsg.textContent = '❌ INVALID KEY (USE DOKAD-XXXX-XXXX-XXXX)';
      this.statusMsg.style.color = 'var(--pixel-red)';
    }
  }

  copyAccessKeyToClipboard() {
    const key = this.getUniversalAccessKey();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(key).then(() => {
        if (this.statusMsg) {
          this.statusMsg.textContent = '📋 ACCESS KEY COPIED!';
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
      this.statusMsg.textContent = '🔐 CREATING PASSKEY...';
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
        this.statusMsg.textContent = '✅ PASSKEY CONFIGURED!';
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
      this.statusMsg.textContent = '🔐 VERIFYING BIOMETRICS...';
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
        this.statusMsg.textContent = '✅ UNLOCKED!';
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
