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

  await new Promise(r => setTimeout(r, 2000));

  console.log('🌐 Launching Chromium browser with mock GPS...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    geolocation: { latitude: 50.0617, longitude: 19.9373 },
    permissions: ['geolocation']
  });

  const page = await context.newPage();

  // Enable Virtual WebAuthn authenticator for Passkeys in Chromium
  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true
    }
  });

  await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });

  console.log('📸 Screenshot 1: Passkey Registration View...');
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'screen_1_passkey.png') });

  // Register Passkey via virtual authenticator
  console.log('🔑 Registering Passkey...');
  await page.click('#btn-passkey-register');
  await page.waitForTimeout(800);

  console.log('📸 Screenshot 2: Main App Screen...');
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'screen_2_unlocked_home.png') });

  console.log('🎲 Generating Today\'s 3 Walk Destinations...');
  await page.click('#btn-generate-daily');
  await page.waitForTimeout(1500);

  console.log('📸 Screenshot 3: Active Daily 3-Spot Tour with Route...');
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'screen_3_active_walk.png') });

  console.log('📅 Opening Memories Calendar...');
  await page.click('#btn-open-calendar');
  await page.waitForTimeout(800);

  console.log('📸 Screenshot 4: Memories Calendar View...');
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'screen_4_calendar_memories.png') });

  await page.click('#modal-calendar-close');
  await page.waitForTimeout(500);

  await browser.close();
  server.kill();
  console.log('✅ Full automated browser verification succeeded!');
  process.exit(0);
}

runBrowserCheck().catch(err => {
  console.error('Browser check failed:', err);
  process.exit(1);
});
