const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];

  page.on('pageerror', error => errors.push('pageerror: ' + error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push('console: ' + message.text());
  });

  await page.goto('http://127.0.0.1:4173/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  await page.locator('#onboarding-backdrop').evaluate(node => node.classList.remove('show'));

  const pages = ['dashboard', 'analysis', 'plan', 'qa', 'skills', 'mistakes', 'report', 'motivation'];
  for (const id of pages) {
    await page.locator('.nav-item[data-page="' + id + '"]').click();
    const active = await page.locator('#' + id).evaluate(node => node.classList.contains('active-page'));
    if (!active) throw new Error('导航未切换到：' + id);
  }

  await page.locator('.nav-item[data-page="analysis"]').click();
  await page.locator('#run-analysis-agent').click();
  if (!(await page.locator('#onboarding-backdrop').evaluate(node => node.classList.contains('show')))) {
    throw new Error('未登录学生点击 AI 诊断后没有打开首次学情设置');
  }

  await page.locator('#onboarding-backdrop').evaluate(node => node.classList.remove('show'));

  await page.locator('.nav-item[data-page="plan"]').click();
  await page.locator('#generate-plan').click();
  if (!(await page.locator('#onboarding-backdrop').evaluate(node => node.classList.contains('show')))) {
    throw new Error('未登录学生点击生成学习路径后没有打开首次学情设置');
  }

  if (errors.length) {
    throw new Error('浏览器运行错误：\n' + errors.join('\n'));
  }

  console.log('SMOKE PASS: navigation and core guard interactions are working');
  await browser.close();
})();
