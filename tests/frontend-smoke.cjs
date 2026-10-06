const { chromium } = require('playwright');

const profile = {
  name: '测试学生',
  grade: '初三',
  subject: '数学',
  score: '60',
  goal: '期中80',
  days: '20',
  hours: '3',
  state: '函数综合题经常错误，几何证明不知道从哪里下手',
  diagnosis: null,
  primaryTopic: ''
};

function responseFor(agent) {
  if (agent === 'analysis') {
    return {
      summary: '当前主要问题集中在函数综合应用和几何证明。',
      priorities: [
        { name: '函数综合应用', priority: '高', mastery: 55, evidence: '学生自述综合题错误较多。' },
        { name: '几何证明', priority: '高', mastery: 48, evidence: '学生明确表示不知道从哪里下手。' },
        { name: '基础计算', priority: '低', mastery: null, evidence: '目前数据不足。' }
      ],
      recommendedAction: '先训练函数综合题，再进入几何证明。'
    };
  }
  if (agent === 'plan') {
    return {
      title: '20天·冲刺80分',
      highestPriority: '函数综合应用',
      secondPriority: '几何证明',
      stable: '基础计算',
      dailyMinutes: 180,
      weeks: [
        { week: '第1阶段', focus: '函数综合基础', goal: '补齐综合题方法', minutesPerDay: 60, reason: '先补高频薄弱点。' },
        { week: '第2阶段', focus: '函数综合应用', goal: '提高综合题正确率', minutesPerDay: 60, reason: '从基础过渡到综合。' },
        { week: '第3阶段', focus: '几何证明', goal: '学会从目标反推', minutesPerDay: 40, reason: '解决主要卡点。' },
        { week: '第4阶段', focus: '综合训练与错题复习', goal: '稳定考试表现', minutesPerDay: 20, reason: '最后阶段回收错题。' }
      ],
      adjustment: '根据正确率与错题复发情况每3天调整。'
    };
  }
  if (agent === 'skill') {
    return {
      level: '中等题',
      label: '中等应用',
      question: '一次函数 y = 2x + b 经过点（1，4），则 b = ?',
      options: { A: '1', B: '2', C: '3', D: '4' },
      answer: 'B',
      explanation: '把点（1，4）代入即可。'
    };
  }
  if (agent === 'mistake') {
    return '错误原因：把函数值与截距混淆。知识点：一次函数解析式。下一步先做一道基础同类题。';
  }
  if (agent === 'motivation') {
    return '建议：收尾\n今天只完成最高优先级任务即可。';
  }
  return '测试响应';
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];

  page.on('pageerror', error => errors.push('pageerror: ' + error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push('console: ' + message.text());
  });

  await page.route('**/api/agent', async route => {
    const body = JSON.parse(route.request().postData() || '{}');
    const result = responseFor(body.agent);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ result: typeof result === 'string' ? result : JSON.stringify(result) })
    });
  });

  await page.route('**/api/chat', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ answer: '收到。我会先判断你的卡点，再一步一步引导。' })
    });
  });

  await page.goto('http://127.0.0.1:4173/index.html', { waitUntil: 'networkidle' });
  await page.evaluate(profileData => {
    localStorage.setItem('yincaiProfile', JSON.stringify(profileData));
    localStorage.removeItem('yincaiPlan');
    localStorage.removeItem('yincaiSkill');
    localStorage.removeItem('yincaiMistakes');
  }, profile);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  for (const id of ['dashboard', 'analysis', 'plan', 'qa', 'skills', 'mistakes', 'report', 'motivation']) {
    await page.locator('.nav-item[data-page="' + id + '"]').click();
    const active = await page.locator('#' + id).evaluate(node => node.classList.contains('active-page'));
    if (!active) throw new Error('导航未切换到：' + id);
  }

  await page.locator('.nav-item[data-page="analysis"]').click();
  await page.locator('#run-analysis-agent').click();
  await page.waitForTimeout(200);
  if (!(await page.locator('#diagnosis-result-card').isVisible())) {
    throw new Error('AI 学情诊断没有把结果渲染到页面');
  }
  if (!(await page.locator('#profile-diagnosis-state').textContent()).includes('AI 已诊断')) {
    throw new Error('学习画像状态没有更新');
  }

  await page.locator('.nav-item[data-page="plan"]').click();
  await page.locator('#generate-plan').click();
  await page.waitForTimeout(200);
  const weekCount = await page.locator('#week-plan .week-card').count();
  if (weekCount !== 4) throw new Error('学习路径没有渲染4个阶段，实际：' + weekCount);

  await page.locator('.nav-item[data-page="skills"]').click();
  await page.waitForTimeout(200);
  if (!(await page.locator('#skill-options button').count())) {
    throw new Error('技能训练没有生成题目');
  }
  await page.locator('#skill-options button[data-skill-option="B"]').click();
  await page.locator('#skill-submit').click();
  await page.waitForTimeout(200);

  if (!(await page.locator('#skill-result-title').textContent()).includes('第')) {
    throw new Error('技能训练答题后没有进入下一状态');
  }

  await page.locator('#skill-options button[data-skill-option="A"]').click();
  await page.locator('#skill-submit').click();
  await page.waitForTimeout(250);

  const mistakeCount = await page.locator('#mistake-stat-pending').textContent();
  if (mistakeCount !== '1') throw new Error('答错后没有进入错题本，当前数量：' + mistakeCount);

  await page.locator('.nav-item[data-page="qa"]').click();
  await page.locator('#chat-input').fill('你好，请先告诉我应该怎么学。');
  await page.locator('#chat-form').dispatchEvent('submit');
  await page.waitForTimeout(100);
  if ((await page.locator('#chat-log').textContent()).indexOf('收到') < 0) {
    throw new Error('AI答疑没有收到后端响应');
  }

  if (errors.length) {
    throw new Error('浏览器运行错误：\n' + errors.join('\n'));
  }

  console.log('SMOKE PASS: navigation + diagnosis + plan + skill + mistake + QA');
  await browser.close();
})();
