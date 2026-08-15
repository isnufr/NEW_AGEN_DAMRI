const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // Capture console messages
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
  
  await page.goto('http://localhost:8000/admin.html');
  
  // Set localStorage
  await page.evaluate(() => {
    localStorage.setItem('isAdminLoggedIn', 'true');
    localStorage.setItem('adminToken', 'dummy');
  });
  
  // Reload
  await page.goto('http://localhost:8000/admin.html', { waitUntil: 'networkidle0' });
  
  console.log('Page loaded. Clicking Daftar Armada menu...');
  await page.evaluate(() => switchMenu('armada'));
  
  // Wait a bit
  await new Promise(r => setTimeout(r, 1000));
  
  console.log('Clicking Tambah Armada button...');
  await page.evaluate(() => openAddArmadaModal());
  
  // Check if modal is visible
  const isVisible = await page.evaluate(() => {
    const m = document.getElementById('modalAddArmada');
    return !m.classList.contains('hidden');
  });
  console.log('Is modalAddArmada visible? ' + isVisible);
  
  await browser.close();
})();
