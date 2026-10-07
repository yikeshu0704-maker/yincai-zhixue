const { chromium } = require('playwright');

const profile = {
  name: '回归测试学生',
  grade: '初三',
  subject: '数学',
  score: '60',
  goal: '期中80',
  days: '20',
  hours: '3',
  state: '一次函数综合题经常错误，几何证明不知道从哪里下手'
};

function responseFor(agent) {
  if (agent === 'analysis') {
    return JSON.stringify({
      summary: '当前重点集中在函数综合应用和几何证明。',
      priorities: [
        { name: '一次函数', priority: '高', mastery: null, evidence: '来自学生自述。' },
        { name: '几何证明', priority: '高', mastery: null, evidence: '来自学生自述。' }
      ],
      recommendedAction: '先完成一次函数技能训练。'
    });
  }
  if (agent === 'plan') {
    return JSON.stringify({
      title: '20天 · 个性化路径',
      highestPriority: '一次函数',
      secondPriority: '几何证明',
      stable: '基础计算',
      dailyMinutes: 180,
      weeks: [
        { week: '第1阶段', focus: '一次函数', goal: '补基础', minutesPerDay: 60, reason: '根据薄弱点。' },
        { week: '第2阶段', focus: '一次函数应用', goal: '综合训练', minutesPerDay: 60, reason: '根据目标差距。' },
        { week: '第3阶段', focus: '几何证明', goal: '证明训练', minutesPerDay: 40, reason: '根据自述。' },
        { week: '第4阶段', focus: '综合复习', goal: '稳定表现', minutesPerDay: 20, reason: '根据剩余时间。' }
      ],
      adjustment: '每3天根据真实表现调整。'
    });
  }
  if (agent === 'skill') {
    return JSON.stringify({
      level: '中等题',
      label: '中等应用',
      question: '一次函数 y=2x+b 经过点(1,4)，b等于多少？',
      options: { A:'1', B:'2', C:'3', D:'4' },
      answer: 'B',
      explanation: '代入点坐标。'
    });
  }
  if (agent === 'mistake') {
    return JSON.stringify({
      reason:'把点坐标代入关系弄错。',
      knowledge:'一次函数',
      errorType:'条件提取',
      evidence:'来自原题和学生选择。',
      basic:'做一道同类基础题。',
      variant:'改变条件重新求参数。',
      comprehensive:'完成一道综合题。',
      masteryCheck:'连续完成不同形式题目。'
    });
  }
  if (agent === 'motivation') {
    return '建议：继续\n优先完成当前重点训练。';
  }
  return '测试响应';
}

async function installRoutes(page) {
  await page.route('**/api/health', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok' })
    });
  });
  await page.route('**/api/agent', async route => {
    const body = JSON.parse(route.request().postData() || '{}');
    const result = responseFor(body.agent);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ result })
    });
  });
  await page.route('**/api/chat', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ answer: '好的，我先判断你的卡点，再一步一步引导。' })
    });
  });
}

async function assertPage(page, id) {
  await page.locator('.nav-item[data-page="' + id + '"]').click();
  await page.locator('#' + id).waitFor({ state: 'visible', timeout: 1000 });
  const active = await page.locator('#' + id).evaluate(node => node.classList.contains('active-page'));
  if (!active) throw new Error('导航失败：' + id);
}

async function runColdJourney(browser, round) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror:' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console:' + m.text()); });

  await installRoutes(page);
  await page.goto('http://127.0.0.1:4173/index.html', { waitUntil: 'networkidle' });

  const css = await page.locator('link[rel="stylesheet"]').getAttribute('href');
  const js = await page.locator('script[src*="app.js"]').getAttribute('src');
  if (!css?.includes('stable-v6') || !js?.includes('stable-v6')) {
    throw new Error('第' + round + '轮缓存破坏版本号未更新');
  }

  await page.locator('#onboarding-backdrop').waitFor({ state: 'visible', timeout: 1000 });
  await page.locator('#profile-name').fill(profile.name + round);
  await page.locator('#profile-grade').fill(profile.grade);
  await page.locator('#profile-subject').fill(profile.subject);
  await page.locator('#profile-score').fill(profile.score);
  await page.locator('#onboarding-next').click();
  await page.locator('#profile-goal').fill(profile.goal);
  await page.locator('#profile-days').fill(profile.days);
  await page.locator('#profile-hours').fill(profile.hours);
  await page.locator('#profile-state').fill(profile.state);
  await page.locator('#onboarding-form').evaluate(form => form.requestSubmit());

  await page.waitForFunction(() => document.querySelector('#onboarding-backdrop')?.classList.contains('show') === false);
  const stored = JSON.parse(await page.evaluate(() => localStorage.getItem('yincaiProfile')));
  if (stored.name !== profile.name + round) throw new Error('第' + round + '轮画像没有保存');

  for (const id of ['dashboard','analysis','plan','qa','skills','mistakes','report','motivation']) {
    await assertPage(page,id);
  }

  await assertPage(page,'dashboard');
  await page.locator('#dashboard-motivation-btn').click();
  await page.locator('#motivation').waitFor({ state:'visible', timeout:1000 });
  if (!(await page.locator('#motivation').locator('text=学习激励 Agent').isVisible())) {
    throw new Error('首页没有可见的学习激励入口');
  }

  // Test actual in-page jump buttons in addition to sidebar navigation.
  await assertPage(page,'dashboard');
  await page.locator('#dashboard button[data-go="plan"]').first().click();
  await page.locator('#plan').waitFor({ state:'visible', timeout:1000 });
  await page.locator('button[data-go="qa"]').first().click();
  await page.locator('#qa').waitFor({ state:'visible', timeout:1000 });

  // Analysis -> plan -> skill -> mistake -> QA
  await assertPage(page,'analysis');
  await page.locator('#run-analysis-agent').click();
  await page.waitForFunction(() => !document.querySelector('#diagnosis-result-card')?.hidden, { timeout: 1500 });

  await assertPage(page,'plan');
  await page.locator('#generate-plan').click();
  await page.locator('#week-plan .week-card').first().waitFor({ state:'visible', timeout:1500 });

  await assertPage(page,'skills');
  await page.locator('#skill-next').click();
  await page.locator('#skill-options button').first().waitFor({ state:'visible', timeout:1000 });
  const q1 = await page.locator('#skill-question-text').textContent();
  if (/\$\$|\\text(?:less|greater)|\\ne/.test(q1)) throw new Error('训练题仍暴露原始数学标记');
  const visibleSkillText = (q1 + ' ' + await page.locator('#skill-options').textContent()).trim();
  if (/\$\$|\\text(?:less|greater)\s*\{|\\text(?:less|greater)/.test(visibleSkillText)) {
    throw new Error('训练题仍显示原始LaTeX标记：' + visibleSkillText.slice(0, 300));
  }
  const generationVisible = await page.locator('#skill-generation').isVisible();
  if (generationVisible) {
    throw new Error('训练页仍显示阻塞式“AI正在出题”面板');
  }
  await page.locator('#skill-options button[data-skill-option="A"]').click();
  await page.locator('#skill-submit').click();
  await page.locator('#skill-next').waitFor({ state:'visible', timeout:1000 });
  await page.locator('#skill-next').click();
  await page.locator('#skill-question-no').filter({hasText:'2'}).waitFor({ state:'visible', timeout:1000 });
  const q2 = await page.locator('#skill-question-text').textContent();
  if (!q2 || q2 === q1) throw new Error('第'+round+'轮下一题没有正常切换');

  await page.locator('#skill-options button[data-skill-option="A"]').click();
  await page.locator('#skill-submit').click();

  await page.locator('#skill-feedback .local-feedback').waitFor({ state:'visible', timeout:1000 });
  await page.locator('#skill-feedback .ai-feedback').waitFor({ state:'visible', timeout:1500 });
  const feedbackBlocks = await page.locator('#skill-feedback .skill-feedback-block').count();
  if (feedbackBlocks !== 2) throw new Error('错题反馈没有同时保留本地反馈和AI补充分析');

  await assertPage(page,'mistakes');
  const mistakeCount = Number(await page.locator('#mistake-stat-pending').textContent());
  if (mistakeCount < 1) throw new Error('第'+round+'轮错题没有保存');

  await assertPage(page,'qa');
  await page.locator('#chat-input').fill('帮我判断卡点');
  await page.locator('#chat-form').dispatchEvent('submit');
  await page.locator('#chat-log').getByText('好的，我先判断你的卡点，再一步一步引导。').waitFor({ state:'visible', timeout:1500 });
  if ((await page.locator('#tutor-question-text').textContent()).includes('AB = AC')) throw new Error('答疑区残留固定几何示例');
  if ((await page.locator('#chat-log').textContent()).includes('**')) throw new Error('AI答疑仍显示原始Markdown星号');
  await assertPage(page,'report');
  const reportText = await page.locator('#report-summary-text').textContent();
  const reportPill = await page.locator('#report-summary-pill').textContent();
  if (reportText.includes('最大的突破是“一次函数”') || reportPill === '持续进步') {
    throw new Error('学习报告仍使用预置总结');
  }

  // Persistence: 10 reloads, with navigation checks each time.
  for (let reload = 1; reload <= 10; reload++) {
    await page.reload({ waitUntil:'networkidle' });
    await page.waitForTimeout(50);

    const persisted = JSON.parse(await page.evaluate(() => localStorage.getItem('yincaiProfile')));
    const skillHistory = JSON.parse(await page.evaluate(() => localStorage.getItem('yincaiSkillHistory') || '[]'));
    const mistakes = JSON.parse(await page.evaluate(() => localStorage.getItem('yincaiMistakes') || '[]'));
    if (persisted?.name !== profile.name + round) throw new Error('第'+round+'轮第'+reload+'次刷新后学生数据丢失');
    if (skillHistory.length < 2) throw new Error('第'+round+'轮第'+reload+'次刷新后训练记录丢失');
    if (mistakes.length < 1) throw new Error('第'+round+'轮第'+reload+'次刷新后错题丢失');

    for (const id of ['dashboard','analysis','plan','qa','skills','mistakes','report','motivation']) {
      await assertPage(page,id);
    }
  }

  // Clear-data UX: after normal persistence has been verified, clearing must wipe profile and derived data.
  await assertPage(page,'analysis');
  await page.locator('#edit-profile-btn').click();
  if ((await page.locator('#profile-name').inputValue()) !== profile.name + round) {
    throw new Error('编辑学情时没有读取已保存学生数据');
  }
  page.once('dialog', async dialog => {
    if (!/清空全部学情数据/.test(dialog.message())) {
      throw new Error('清空确认文案不正确');
    }
    await dialog.accept();
  });
  await page.locator('#clear-profile-btn').click();
  await page.waitForFunction(() => localStorage.getItem('yincaiProfile') === null, { timeout: 1500 });
  await page.reload({ waitUntil:'networkidle' });
  await page.locator('#onboarding-backdrop').waitFor({ state:'visible', timeout:1000 });

  const cleared = await page.evaluate(() => ({
    profile: localStorage.getItem('yincaiProfile'),
    mistakes: JSON.parse(localStorage.getItem('yincaiMistakes') || '[]'),
    history: JSON.parse(localStorage.getItem('yincaiSkillHistory') || '[]'),
    name: document.getElementById('profile-name')?.value || '',
    goal: document.getElementById('profile-goal')?.value || ''
  }));
  if (cleared.profile !== null || cleared.mistakes.length !== 0 || cleared.history.length !== 0 || cleared.name || cleared.goal) {
    throw new Error('清空后仍存在旧学生数据');
  }

  if (errors.length) throw new Error('第'+round+'轮浏览器错误:\n'+errors.join('\n'));
  await context.close();
}

(async () => {
  const browser = await chromium.launch({ headless:true });
  for (let i=1;i<=10;i++) {
    console.log('REGRESSION ROUND '+i+'/10');
    await runColdJourney(browser,i);
  }
  await browser.close();
  console.log('FULL REGRESSION PASS: 10 cold journeys × 10 reload persistence checks + complete MVP path');
})();
