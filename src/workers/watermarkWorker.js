/**
 * OffscreenCanvas Watermark Worker
 * Processes photos, renders retro watermark stamp with website URL and anthropological coordinates,
 * and encodes JPEG off the main thread.
 * Zero UI freeze, runs 100% on background worker thread.
 */

self.onmessage = async (e) => {
  const { imageBitmap, meta } = e.data;

  try {
    const width = imageBitmap.width;
    const height = imageBitmap.height;

    // Use OffscreenCanvas in Web Worker
    const offscreen = new OffscreenCanvas(width, height);
    const ctx = offscreen.getContext('2d', { alpha: false, desynchronized: true });

    // Draw photo
    ctx.drawImage(imageBitmap, 0, 0);
    imageBitmap.close(); // Immediate memory release

    // Watermark styling
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString();
    const step = meta?.step || 1;
    const coordsText = meta && meta.lat ? `${meta.lat.toFixed(5)}°N, ${meta.lng.toFixed(5)}°E` : '';
    const website = 'mikhas-rahulia.github.io/dokad';

    const fontSize = Math.max(15, Math.round(width * 0.032));
    const subFontSize = Math.round(fontSize * 0.78);
    const microFontSize = Math.round(fontSize * 0.68);

    // 3-line bottom banner background
    const barHeight = fontSize * 3.6;
    ctx.fillStyle = 'rgba(12, 15, 23, 0.85)';
    ctx.fillRect(0, height - barHeight, width, barHeight);

    // Accent top border line on banner
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, height - barHeight, width, 3);

    // Line 1: Spot & Time
    ctx.font = `bold ${fontSize}px "Pixelify Sans", monospace, sans-serif`;
    ctx.fillStyle = '#facc15';
    ctx.fillText(`🕹️ DOKĄD? SPOT #${step} • ${timeStr}`, 16, height - barHeight + fontSize + 6);

    // Line 2: Date & GPS Coordinates
    ctx.font = `${subFontSize}px monospace, sans-serif`;
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`📅 ${dateStr} • 📍 ${coordsText}`, 16, height - barHeight + fontSize + subFontSize + 12);

    // Line 3: Website & Anthropology Mission
    ctx.font = `bold ${microFontSize}px monospace, sans-serif`;
    ctx.fillStyle = '#4ade80';
    ctx.fillText(`🌐 ${website} • Local Anthropology & Physical Activity`, 16, height - 10);

    // Encode to JPEG Blob on Worker thread
    const blob = await offscreen.convertToBlob({ type: 'image/jpeg', quality: 0.88 });
    
    let dataUrl;
    if (typeof FileReaderSync !== 'undefined') {
      const reader = new FileReaderSync();
      dataUrl = reader.readAsDataURL(blob);
    } else {
      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      dataUrl = `data:image/jpeg;base64,${btoa(binary)}`;
    }

    self.postMessage({ status: 'success', dataUrl });
  } catch (err) {
    self.postMessage({ status: 'error', error: err.message });
  }
};
