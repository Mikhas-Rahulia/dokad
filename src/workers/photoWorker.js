/**
 * OPFS (Origin Private File System) Photo Storage Worker
 * Writes photo blobs directly to filesystem with zero main-thread blocking.
 * Falls back to IndexedDB postMessage if OPFS not available.
 */

self.onmessage = async (e) => {
  const { action, filename, buffer, dateStr } = e.data;

  try {
    if (action === 'save') {
      const root = await navigator.storage.getDirectory();
      const memoriesDir = await root.getDirectoryHandle('memories', { create: true });
      const dateDir = await memoriesDir.getDirectoryHandle(dateStr, { create: true });
      const fileHandle = await dateDir.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(new Uint8Array(buffer));
      await writable.close();
      self.postMessage({ action: 'saved', filename, dateStr });
    }

    if (action === 'load') {
      const root = await navigator.storage.getDirectory();
      const memoriesDir = await root.getDirectoryHandle('memories');
      const dateDir = await memoriesDir.getDirectoryHandle(dateStr);
      const fileHandle = await dateDir.getFileHandle(filename);
      const file = await fileHandle.getFile();
      const buffer = await file.arrayBuffer();
      self.postMessage({ action: 'loaded', filename, dateStr, buffer }, [buffer]);
    }

    if (action === 'listDates') {
      const root = await navigator.storage.getDirectory();
      const memoriesDir = await root.getDirectoryHandle('memories');
      const dates = [];
      for await (const [name, handle] of memoriesDir.entries()) {
        if (handle.kind === 'directory') {
          dates.push(name);
        }
      }
      self.postMessage({ action: 'dates', dates: dates.sort().reverse() });
    }

    if (action === 'listPhotos') {
      const root = await navigator.storage.getDirectory();
      const memoriesDir = await root.getDirectoryHandle('memories');
      const dateDir = await memoriesDir.getDirectoryHandle(dateStr);
      const files = [];
      for await (const [name, handle] of dateDir.entries()) {
        if (handle.kind === 'file') {
          files.push(name);
        }
      }
      self.postMessage({ action: 'photos', dateStr, files: files.sort() });
    }

  } catch (err) {
    self.postMessage({ action: 'error', error: err.message, filename, dateStr });
  }
};
