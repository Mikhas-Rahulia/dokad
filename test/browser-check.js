import { chromium } from 'playwright';
import { preview } from 'vite';
import path from 'path';

const ARTIFACTS_DIR = 'C:\\Users\\Lenovo\\.gemini\\antigravity\\brain\\b798c2ef-885b-40a4-8202-ecd7f1334a45';

async function runBrowserCheck() {
  console.log('🚀 Starting Vite preview server programmatically...');
  const previewServer = await preview({
    preview: {
      port: 5199,
      strictPort: true
    }
  });

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

  await page.goto('http://localhost:5199/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  console.log('📸 Screenshot 1: Passkey Registration / Unlock View...');
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'screen_1_passkey.png') });

  // Register Passkey via virtual authenticator
  console.log('🔑 Creating / Registering Passkey...');
  await page.click('#btn-passkey-register');
  await page.waitForTimeout(800);

  console.log('📸 Screenshot 2: Main App Screen (Polish/Default)...');
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'screen_2_unlocked_home.png') });

  console.log('🛰️ Testing GPS Live Diagnostics Widget...');
  await page.click('#btn-gps-status');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'screen_gps_diagnostics.png') });
  await page.click('#modal-gps-diag-close');
  await page.waitForTimeout(400);

  console.log('🎲 Generating Today\'s 3 Walk Destinations...');
  await page.click('#btn-generate-daily');
  await page.waitForTimeout(1500);

  console.log('📸 Screenshot 3: Active Daily 3-Spot Tour with Route...');
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'screen_3_active_walk.png') });

  console.log('⚖️ Opening Legal, Privacy & Anthropology Mission Modal...');
  await page.click('#btn-open-legal');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'screen_legal_anthropology.png') });
  await page.click('#modal-legal-close');
  await page.waitForTimeout(400);

  console.log('🌐 Testing Language Switcher (Switching to Russian)...');
  await page.selectOption('#lang-select', 'ru');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'screen_3_lang_ru.png') });

  console.log('📅 Opening Memories Calendar Tab...');
  await page.click('#btn-open-calendar');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'screen_4_calendar_memories.png') });

  console.log('🖼️ Switching to Photo Gallery Tab...');
  await page.click('#tab-btn-gallery');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'screen_5_photo_gallery.png') });

  console.log('🔥 Switching to Streak Stats Tab...');
  await page.click('#tab-btn-streak');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'screen_6_streak_stats.png') });

  await page.click('#modal-calendar-close');
  await page.waitForTimeout(500);

  await browser.close();
  previewServer.httpServer.close();
  console.log('✅ Full automated browser verification succeeded!');
  process.exit(0);
}

runBrowserCheck().catch(err => {
  console.error('Browser check failed:', err);
  process.exit(1);
});
