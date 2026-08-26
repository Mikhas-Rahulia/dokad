/**
 * Passkey / WebAuthn Biometric & Security Key Authentication for Dokąd PWA.
 */

const STORAGE_KEY_PASSKEY = 'dokad_passkey_credential_v1';
const STORAGE_KEY_AUTH_STATE = 'dokad_auth_unlocked_session';

export class PasskeyAuth {
  constructor(onUnlockedCallback) {
    this.onUnlocked = onUnlockedCallback;
    this.isUnlocked = false;

    this.overlay = document.getElementById('passkey-lock-overlay');
    this.btnUnlock = document.getElementById('btn-passkey-unlock');
    this.btnRegister = document.getElementById('btn-passkey-register');
    this.statusMsg = document.getElementById('passkey-status-msg');
    this.registerPrompt = document.getElementById('passkey-register-prompt');
    this.unlockPrompt = document.getElementById('passkey-unlock-prompt');

    this.bindEvents();
    this.checkInitialState();
  }

  bindEvents() {
    if (this.btnUnlock) {
      this.btnUnlock.addEventListener('click', () => this.authenticatePasskey());
    }
    if (this.btnRegister) {
      this.btnRegister.addEventListener('click', () => this.registerPasskey());
    }
  }

  isPasskeySupported() {
    return window.PublicKeyCredential !== undefined;
  }

  getSavedCredentialId() {
    return localStorage.getItem(STORAGE_KEY_PASSKEY);
  }

  checkInitialState() {
    const hasCred = this.getSavedCredentialId();

    if (!this.isPasskeySupported()) {
      // Browser doesn't support WebAuthn
      this.unlockApp();
      return;
    }

    if (hasCred) {
      this.showUnlockView();
      // Auto-trigger biometric prompt after short delay
      setTimeout(() => this.authenticatePasskey(), 400);
    } else {
      this.showRegisterView();
    }
  }

  showRegisterView() {
    this.overlay.classList.add('active');
    this.registerPrompt.style.display = 'flex';
    this.unlockPrompt.style.display = 'none';
    this.statusMsg.textContent = 'SET UP YOUR PASSKEY (TOUCH ID / FACE ID / PIN)';
    this.statusMsg.style.color = 'var(--pixel-yellow)';
  }

  showUnlockView() {
    this.overlay.classList.add('active');
    this.registerPrompt.style.display = 'none';
    this.unlockPrompt.style.display = 'flex';
    this.statusMsg.textContent = 'TOUCH ID / FACE ID REQUIRED';
    this.statusMsg.style.color = 'var(--text-secondary)';
  }

  async registerPasskey() {
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
      console.warn('Passkey registration error:', err);
      this.statusMsg.textContent = `❌ ${err.name === 'NotAllowedError' ? 'CANCELLED' : 'SETUP FAILED'}`;
      this.statusMsg.style.color = 'var(--pixel-red)';
    }
  }

  async authenticatePasskey() {
    const credIdBase64 = this.getSavedCredentialId();
    if (!credIdBase64) {
      this.showRegisterView();
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
      console.warn('Passkey auth error:', err);
      this.statusMsg.textContent = `❌ ${err.name === 'NotAllowedError' ? 'AUTH CANCELLED' : 'AUTH FAILED'}`;
      this.statusMsg.style.color = 'var(--pixel-red)';
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
