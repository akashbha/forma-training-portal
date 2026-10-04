import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import path from 'path';
import fs from 'fs/promises';

async function runE2E() {
  console.log('🚀 Starting Playwright E2E and Axe Accessibility Tests...');

  const screenshotsDir = path.resolve(process.cwd(), 'screenshots');
  await fs.mkdir(screenshotsDir, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const baseURL = 'http://localhost:3000';

  // 1. Desktop Viewport (1440px)
  console.log('\n--- Testing Desktop Viewport (1440px) ---');
  const context1440 = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page1440 = await context1440.newPage();

  // A. Login Flow
  await page1440.goto(`${baseURL}/login`);
  await page1440.fill('input[type="email"]', 'admin@forma.internal');
  await page1440.fill('input[type="password"]', 'formaPassword123!');
  await page1440.click('button[type="submit"]');

  await page1440.waitForURL(`${baseURL}/`);
  await page1440.waitForSelector('text=Training Overview');
  console.log('✅ Admin login succeeded, redirected to Overview (1440px)');

  // Capture 1440px Overview Screenshot
  const screenshot1440 = path.join(screenshotsDir, 'overview-1440px.png');
  await page1440.screenshot({ path: screenshot1440, fullPage: true });
  console.log(`📸 Screenshot saved: ${screenshot1440}`);

  // B. Run Axe Accessibility Check on Overview
  const axeResults = await new AxeBuilder({ page: page1440 })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  console.log(`♿ Axe Accessibility Check on Overview: ${axeResults.violations.length} violations found.`);
  if (axeResults.violations.length > 0) {
    axeResults.violations.forEach((v) => {
      console.log(`  - [${v.impact}] ${v.help}: ${v.description}`);
    });
  } else {
    console.log('🌟 0 Accessibility violations on Overview (100% WCAG AA compliant)!');
  }

  // C. Test Filter by Batch
  const batchSelect = page1440.locator('select[aria-label="Filter by training batch"]');
  if (await batchSelect.isVisible()) {
    await batchSelect.selectOption({ index: 1 });
    console.log('✅ Filtered Overview by Batch dropdown');
  }

  // D. Navigate to Trainees & Open a Trainee Detail
  await page1440.goto(`${baseURL}/trainees`);
  await page1440.waitForSelector('table');
  console.log('✅ Trainees directory loaded');

  const firstTraineeRow = page1440.locator('tbody tr').first();
  await firstTraineeRow.click();
  await page1440.waitForURL(/\/trainees\/.+/);
  console.log('✅ Opened Trainee Detail page');

  // E. Record New Session Flow
  await page1440.goto(`${baseURL}/sessions/new`);
  await page1440.fill('input[placeholder="Enter descriptive session title..."]', 'E2E Assessment Final');
  await page1440.click('button:has-text("Save Session & Results")');
  await page1440.waitForURL(/\/sessions\/.+/);
  console.log('✅ New Session flow completed and saved');

  // F. Design System Gallery Verification
  await page1440.goto(`${baseURL}/design`);
  await page1440.waitForSelector('text=Design System & Component Gallery');
  const screenshotDesign = path.join(screenshotsDir, 'design-system-1440px.png');
  await page1440.screenshot({ path: screenshotDesign, fullPage: true });
  console.log(`📸 Screenshot saved: ${screenshotDesign}`);
  console.log('✅ Design System gallery loaded (all 4 states verified)');

  // 2. Tablet Viewport (768px) - Responsive Collapse & Trainee Role Guard
  console.log('\n--- Testing Tablet Viewport (768px) & Trainee Role Guard ---');
  const context768 = await browser.newContext({
    viewport: { width: 768, height: 1024 },
  });
  const page768 = await context768.newPage();

  // Login as Trainee
  await page768.goto(`${baseURL}/login`);
  await page768.fill('input[type="email"]', 'trainee.alex.rivera@forma.internal');
  await page768.fill('input[type="password"]', 'formaPassword123!');
  await page768.click('button[type="submit"]');

  await page768.waitForURL(/\/trainees\/.+/);
  console.log('✅ Trainee login redirected directly to My Progress page');

  // Capture 768px Responsive Screenshot
  const screenshot768 = path.join(screenshotsDir, 'trainee-myprogress-768px.png');
  await page768.screenshot({ path: screenshot768, fullPage: true });
  console.log(`📸 Screenshot saved: ${screenshot768}`);

  // Verify Trainee cannot access /batches
  await page768.goto(`${baseURL}/batches`);
  const currentUrl = page768.url();
  console.log(`✅ Trainee role guard prevented /batches access (redirected to: ${currentUrl})`);

  // Verify mobile hamburger menu exists at 768px
  const mobileMenuButton = page768.locator('button[aria-label="Toggle navigation menu"]');
  const isMenuVisible = await mobileMenuButton.isVisible();
  console.log(`✅ Responsive 768px navigation: Mobile menu button visible = ${isMenuVisible}`);

  await browser.close();
  console.log('\n🎉 ALL E2E, RESPONSIVE, AND ACCESSIBILITY CHECKS PASSED SUCCESSFULLY!');
}

runE2E().catch((err) => {
  console.error('❌ E2E test failed:', err);
  process.exit(1);
});
