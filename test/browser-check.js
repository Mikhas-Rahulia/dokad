import { chromium } from 'playwright';
import { spawn } from 'child_process';
import path from 'path';

const ARTIFACTS_DIR = 'C:\\Users\\Lenovo\\.gemini\\antigravity\\brain\\b798c2ef-885b-40a4-8202-ecd7f1334a45';

async function runBrowserCheck() {
  console.log('🚀 Starting Vite preview server...');
  const server = spawn('npx.cmd', ['vite', 'preview', '--port', '5199', '--strictPort'], {
    cwd: process.cwd(),
    stdio: 'pipe',
    shell: true
  });

  server.stdout.on('data', (d) => console.log(`[Vite] ${d}`));
  server.stderr.on('data', (d) => console.error(`[Vite ERR] ${d}`));

  // Wait 2s for server to start
  await new Promise(r => setTimeout(r, 2500));

  console.log('🌐 Launching Chromium browser with mock GPS (Krakow Main Square)...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 14 / modern mobile size
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
    geolocation: { latitude: 50.0617, longitude: 19.9373 },
    permissions: ['geolocation']
  });

  const page = await context.newPage();
  await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });

  console.log('📸 Capturing screenshot 1: Initial state...');
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'screen_1_initial.png') });

  console.log('🎲 Clicking "GENERATE 3 SPOTS"...');
  await page.click('#btn-generate-daily');
  await page.waitForTimeout(1500);

  console.log('📸 Capturing screenshot 2: Active 3-Spot Tour on Map...');
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'screen_2_tour_active.png') });

  console.log('🏛️ Opening City Selector Modal...');
  await page.click('#btn-select-city');
  await page.waitForTimeout(800);

  console.log('📸 Capturing screenshot 3: City Selector Modal...');
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'screen_3_city_modal.png') });

  await page.click('#modal-city-close');
  await page.waitForTimeout(500);

  console.log('🌙 Testing Theme Toggle...');
  await page.click('#btn-theme-toggle');
  await page.waitForTimeout(500);

  console.log('📸 Capturing screenshot 4: Dark Theme Active...');
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'screen_4_dark_theme.png') });

  await browser.close();
  server.kill();
  console.log('✅ Browser check completed successfully!');
  process.exit(0);
}

runBrowserCheck().catch(err => {
  console.error('Browser check failed:', err);
  process.exit(1);
});
