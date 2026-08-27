/**
 * OffscreenCanvas Watermark Worker
 * Processes photos, renders retro watermark stamp, and encodes JPEG off the main thread.
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
    const spotText = `DOKĄD? SPOT #${meta?.step || 1}`;
    const coordsText = meta ? `${meta.lat.toFixed(4)}, ${meta.lng.toFixed(4)}` : '';

    const fontSize = Math.max(16, Math.round(width * 0.035));
    ctx.font = `bold ${fontSize}px sans-serif, monospace`;

    // Bottom banner background
    const barHeight = fontSize * 2.6;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, height - barHeight, width, barHeight);

    // Pixel yellow text
    ctx.fillStyle = '#facc15';
    ctx.fillText(`${spotText} • ${timeStr}`, 16, height - barHeight + fontSize + 4);

    // Cyan coordinates
    ctx.fillStyle = '#38bdf8';
    ctx.font = `${Math.round(fontSize * 0.8)}px monospace`;
    ctx.fillText(`📅 ${dateStr} • 📍 ${coordsText}`, 16, height - 12);

    // Encode to JPEG Blob on Worker thread
    const blob = await offscreen.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
    
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
