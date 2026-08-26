export class CameraModal {
  constructor() {
    this.modal = document.getElementById('modal-camera');
    this.video = document.getElementById('camera-video');
    this.canvas = document.getElementById('camera-canvas');
    this.previewImg = document.getElementById('camera-preview-img');
    this.previewContainer = document.getElementById('camera-preview-container');
    this.viewfinderContainer = document.getElementById('camera-viewfinder-container');
    this.btnCapture = document.getElementById('btn-camera-capture');
    this.btnConfirm = document.getElementById('btn-camera-confirm');
    this.btnRetake = document.getElementById('btn-camera-retake');
    this.btnClose = document.getElementById('modal-camera-close');
    this.btnSwitchCam = document.getElementById('btn-camera-switch');
    this.fileInput = document.getElementById('camera-file-input');
    this.cameraTitle = document.getElementById('camera-modal-title');

    this.stream = null;
    this.facingMode = 'environment';
    this.currentSpotIndex = null;
    this.currentSpotMeta = null;
    this.onConfirmCallback = null;
    this.capturedDataUrl = null;
    this.watermarkWorker = null;

    try {
      this.watermarkWorker = new Worker(
        new URL('../workers/watermarkWorker.js', import.meta.url),
        { type: 'module' }
      );
    } catch {}

    this.bindEvents();
  }

  bindEvents() {
    this.btnClose.addEventListener('click', () => this.close());
    this.btnCapture.addEventListener('click', () => this.capturePhoto());
    this.btnRetake.addEventListener('click', () => this.retake());
    this.btnConfirm.addEventListener('click', () => this.confirmPhoto());
    this.btnSwitchCam.addEventListener('click', () => this.switchCamera());

    // Fallback file input
    this.fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          this.processImageFile(event.target.result);
        };
        reader.readAsDataURL(file);
      }
    });
  }

  /**
   * Opens the camera viewfinder for a given spot.
   * @param {number} spotIndex
   * @param {Object} spotMeta { step, lat, lng }
   * @param {Function} onConfirm
   */
  async open(spotIndex, spotMeta, onConfirm) {
    this.currentSpotIndex = spotIndex;
    this.currentSpotMeta = spotMeta;
    this.onConfirmCallback = onConfirm;
    this.capturedDataUrl = null;

    this.cameraTitle.textContent = `📸 SPOT #${spotMeta.step || spotIndex + 1} VERIFICATION`;

    this.viewfinderContainer.style.display = 'flex';
    this.previewContainer.style.display = 'none';
    this.modal.classList.add('active');

    await this.startStream();
  }

  async startStream() {
    this.stopStream();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.fileInput.click();
      return;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: this.facingMode,
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
          frameRate: { ideal: 60, min: 30 }
        },
        audio: false
      });
      this.video.srcObject = this.stream;
      await this.video.play();
    } catch (err) {
      console.warn('Camera stream error, falling back to file input:', err);
      this.fileInput.click();
    }
  }

  stopStream() {
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
  }

  switchCamera() {
    this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
    this.startStream();
  }

  async capturePhoto() {
    if (!this.video.videoWidth) {
      this.fileInput.click();
      return;
    }

    try {
      // Zero-latency GPU frame grab
      const bitmap = await createImageBitmap(this.video);

      // If Web Worker + OffscreenCanvas is available, offload 100% of watermarking and JPEG compression
      if (this.watermarkWorker) {
        const meta = {
          step: this.currentSpotMeta?.step || this.currentSpotIndex + 1,
          lat: this.currentSpotMeta?.lat || 0,
          lng: this.currentSpotMeta?.lng || 0
        };

        this.watermarkWorker.onmessage = (e) => {
          if (e.data.status === 'success') {
            this.capturedDataUrl = e.data.dataUrl;
            this.showPreview(this.capturedDataUrl);
          } else {
            this.fallbackMainThreadCapture();
          }
        };

        this.watermarkWorker.postMessage({ imageBitmap: bitmap, meta }, [bitmap]);
        this.stopStream();
        return;
      }
    } catch {
      this.fallbackMainThreadCapture();
      return;
    }

    this.fallbackMainThreadCapture();
  }

  fallbackMainThreadCapture() {
    const width = this.video.videoWidth || 1280;
    const height = this.video.videoHeight || 720;
    this.canvas.width = width;
    this.canvas.height = height;

    const ctx = this.canvas.getContext('2d');
    ctx.drawImage(this.video, 0, 0, width, height);
    this.stampWatermark(ctx, width, height);

    this.capturedDataUrl = this.canvas.toDataURL('image/jpeg', 0.85);
    this.showPreview(this.capturedDataUrl);
    this.stopStream();
  }

  processImageFile(dataUrl) {
    const img = new Image();
    img.onload = () => {
      this.canvas.width = img.width;
      this.canvas.height = img.height;
      const ctx = this.canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      this.stampWatermark(ctx, img.width, img.height);
      this.capturedDataUrl = this.canvas.toDataURL('image/jpeg', 0.85);
      this.showPreview(this.capturedDataUrl);
    };
    img.src = dataUrl;
  }

  stampWatermark(ctx, width, height) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString();
    const spotText = `DOKĄD? SPOT #${this.currentSpotMeta?.step || this.currentSpotIndex + 1}`;
    const coordsText = this.currentSpotMeta ? `${this.currentSpotMeta.lat.toFixed(4)}, ${this.currentSpotMeta.lng.toFixed(4)}` : '';

    const fontSize = Math.max(16, Math.round(width * 0.035));
    ctx.font = `bold ${fontSize}px "Pixelify Sans", monospace, sans-serif`;

    // Bottom pill background
    const barHeight = fontSize * 2.6;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, height - barHeight, width, barHeight);

    // Pixel yellow & green text
    ctx.fillStyle = '#facc15';
    ctx.fillText(`${spotText} • ${timeStr}`, 16, height - barHeight + fontSize + 4);

    ctx.fillStyle = '#38bdf8';
    ctx.font = `${Math.round(fontSize * 0.8)}px monospace`;
    ctx.fillText(`📅 ${dateStr} • 📍 ${coordsText}`, 16, height - 12);
  }

  showPreview(dataUrl) {
    this.previewImg.src = dataUrl;
    this.viewfinderContainer.style.display = 'none';
    this.previewContainer.style.display = 'flex';
  }

  retake() {
    this.capturedDataUrl = null;
    this.previewContainer.style.display = 'none';
    this.viewfinderContainer.style.display = 'flex';
    this.startStream();
  }

  confirmPhoto() {
    if (this.onConfirmCallback && this.capturedDataUrl) {
      this.onConfirmCallback(this.currentSpotIndex, this.capturedDataUrl);
    }
    this.close();
  }

  close() {
    this.stopStream();
    this.modal.classList.remove('active');
  }
}
