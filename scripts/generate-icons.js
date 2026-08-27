// Generate PNG icons from SVG using canvas (Node.js script)
// Run: node scripts/generate-icons.js

import { readFileSync, writeFileSync } from 'fs';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const svgPath = 'public/icon.svg';

async function generateIcon(size, outputPath, padding = 0) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  const svgData = readFileSync(svgPath, 'utf8');
  const svgDataUri = `data:image/svg+xml;base64,${Buffer.from(svgData).toString('base64')}`;
  const img = await loadImage(svgDataUri);

  if (padding > 0) {
    // Maskable icon: add safe zone padding
    ctx.fillStyle = '#4f46e5';
    ctx.fillRect(0, 0, size, size);
    const drawSize = size - padding * 2;
    ctx.drawImage(img, padding, padding, drawSize, drawSize);
  } else {
    ctx.drawImage(img, 0, 0, size, size);
  }

  const buffer = canvas.toBuffer('image/png');
  writeFileSync(outputPath, buffer);
  console.log(`✅ Generated ${outputPath} (${buffer.length} bytes)`);
}

async function main() {
  await generateIcon(192, 'public/icon-192.png');
  await generateIcon(512, 'public/icon-512.png');
  // Maskable icons need 10% safe zone padding on each side
  await generateIcon(192, 'public/icon-maskable-192.png', 19);
  await generateIcon(512, 'public/icon-maskable-512.png', 51);
  console.log('🎉 All icons generated!');
}

main().catch(console.error);
