import { chromium, devices } from 'playwright';
import { createServer } from 'vite';
import path from 'path';

const ARTIFACTS_DIR = 'C:\\Users\\Lenovo\\.gemini\\antigravity\\brain\\b798c2ef-885b-40a4-8202-ecd7f1334a45';

async function runMobileVerification() {
  console.log('🚀 Starting Vite dev server...');
  const server = await createServer({
    server: { port: 5195 }
  });
  await server.listen();

  const browser = await chromium.launch({ headless: true });

  // Test 1: iPhone 14 Pro (393 x 852)
  console.log('📱 Testing iPhone 14 Pro mobile layout & Florida GPS...');
  const ctxIphone = await browser.newContext({
    ...devices['iPhone 14 Pro'],
    geolocation: { latitude: 26.0528, longitude: -80.1439 }, // Dania Beach, Florida
    permissions: ['geolocation']
  });

  const pageIphone = await ctxIphone.newPage();
  const cdp = await ctxIphone.newCDPSession(pageIphone);
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

  await pageIphone.goto('http://localhost:5195/', { waitUntil: 'domcontentloaded' });
  await pageIphone.waitForTimeout(1000);
  await pageIphone.click('#btn-passkey-register');
  await pageIphone.waitForTimeout(1000);

  console.log('📸 Screenshot mobile: Home Screen (Florida GPS)...');
  await pageIphone.screenshot({ path: path.join(ARTIFACTS_DIR, 'screen_mobile_home.png') });

  // Click start walk
  console.log('🎲 Clicking Start Walk on mobile...');
  await pageIphone.click('#btn-generate-daily');
  await pageIphone.waitForTimeout(2500);

  console.log('📸 Screenshot mobile: Active 3-Spot Tour Card...');
  await pageIphone.screenshot({ path: path.join(ARTIFACTS_DIR, 'screen_mobile_tour.png') });

  // Test 2: iPhone SE / Small screen (375 x 667)
  console.log('📱 Testing iPhone SE (Small 375x667 screen)...');
  const ctxSe = await browser.newContext({
    viewport: { width: 375, height: 667 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
    geolocation: { latitude: 52.0116, longitude: 4.3571 }, // Delft, Netherlands
    permissions: ['geolocation']
  });
  const pageSe = await ctxSe.newPage();
  const cdpSe = await ctxSe.newCDPSession(pageSe);
  await cdpSe.send('WebAuthn.enable');
  await cdpSe.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true }
  });

  await pageSe.goto('http://localhost:5195/', { waitUntil: 'domcontentloaded' });
  await pageSe.waitForTimeout(1000);
  await pageSe.click('#btn-passkey-register');
  await pageSe.waitForTimeout(1000);
  await pageSe.click('#btn-generate-daily');
  await pageSe.waitForTimeout(2500);

  console.log('📸 Screenshot mobile: iPhone SE Small Screen Tour...');
  await pageSe.screenshot({ path: path.join(ARTIFACTS_DIR, 'screen_mobile_iphonese.png') });

  await browser.close();
  await server.close();
  console.log('✅ Mobile verification complete!');
}

runMobileVerification().catch(e => {
  console.error(e);
  process.exit(1);
});
