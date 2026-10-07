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
  let skillCalls = 0;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];

  page.on('pageerror', error => errors.push('pageerror: ' + error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push('console: ' + message.text());
  });

  await page.route('**/api/agent', async route => {
    const body = JSON.parse(route.request().postData() || '{}');
    let result = responseFor(body.agent);
    if (body.agent === 'skill') {
      skillCalls += 1;
      if (skillCalls === 1) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      if (skillCalls > 1) {
        result = {
          level: '困难题',
          label: '困难应用',
          question: '一次函数 y = kx + 1 经过点（2，5），求其与 x 轴交点的横坐标。',
          options: { A: '-1', B: '-1/2', C: '1/2', D: '2' },
          answer: 'B',
          explanation: '与 x 轴交点令 y=0，需要先由点求 k，再反推截距。'
        };
      }
    }
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

  await page.route('**/api/health', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', provider: 'mock' })
    });
  });

  await page.goto('http://127.0.0.1:4173/index.html', { waitUntil: 'networkidle' });
  await page.evaluate(profileData => {
    localStorage.setItem('yincaiProfile', JSON.stringify(profileData));
    localStorage.removeItem('yincaiPlan');
    localStorage.removeItem('yincaiSkill');
    localStorage.removeItem('yincaiMistakes');
    localStorage.removeItem('yincaiSkillHistory');
  }, profile);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const bankText = (await page.locator('#skill-bank-count').textContent()).trim();
  if (bankText !== '3000 道初中题') throw new Error('题库数量显示错误：' + bankText);

  const bankAudit = await page.evaluate(() => {
    const raw = Array.isArray(window.YINCaiJuniorHighMathBank) ? window.YINCaiJuniorHighMathBank : [];
    const seenIds = new Set();
    const seenQuestions = new Set();
    const levels = [0, 0, 0, 0];
    let duplicateId = '';
    let duplicateQuestion = 0;

    for (const q of raw) {
      const id = String(q.id || '');
      const question = String(q.question || '').replace(/\s+/g, '');
      if (seenIds.has(id) && !duplicateId) duplicateId = id;
      if (seenQuestions.has(question)) duplicateQuestion += 1;
      seenIds.add(id);
      seenQuestions.add(question);

      const isCJEval = q.sourceDataset === 'CJEval';
      const level = isCJEval
        ? Math.max(0, Math.min(3, Number(q.difficulty || 0)))
        : Math.max(0, Math.min(3, Number(q.difficulty || 1) - 1));
      levels[level] += 1;
    }

    return { count: raw.length, levels, duplicateId, duplicateQuestion };
  });

  if (bankAudit.count !== 3000) {
    throw new Error('题库原始题数不是3000：' + bankAudit.count);
  }
  if (bankAudit.duplicateId) {
    throw new Error('题库存在重复ID：' + bankAudit.duplicateId);
  }
  const duplicateRate = bankAudit.count
    ? (bankAudit.duplicateQuestion / bankAudit.count)
    : 0;
  if (duplicateRate > 0.10) {
    throw new Error('题库重复题比例超过10%：' + Math.round(duplicateRate * 1000) / 10 + '%');
  }
  if (bankAudit.levels.some(n => n === 0)) {
    throw new Error('四级难度不是全部存在：' + JSON.stringify(bankAudit.levels));
  }

  for (const id of ['dashboard', 'analysis', 'plan', 'qa', 'skills', 'mistakes', 'report', 'motivation']) {
    await page.locator('.nav-item[data-page="' + id + '"]').click();
    const active = await page.locator('#' + id).evaluate(node => node.classList.contains('active-page'));
    if (!active) throw new Error('导航未切换到：' + id);
  }

  await page.locator('.nav-item[data-page="analysis"]').click();
  await page.locator('#run-analysis-agent').click();
  await page.locator('#diagnosis-result-card').waitFor({ state:'visible', timeout:1500 });
  if (!(await page.locator('#diagnosis-result-card').isVisible())) {
    throw new Error('AI 学情诊断没有把结果渲染到页面');
  }
  if (!(await page.locator('#profile-diagnosis-state').textContent()).includes('AI 已诊断')) {
    throw new Error('学习画像状态没有更新');
  }

  await page.locator('.nav-item[data-page="plan"]').click();
  await page.locator('#generate-plan').click();
  await page.waitForTimeout(650);
  const weekCount = await page.locator('#week-plan .week-card').count();
  if (weekCount !== 4) throw new Error('学习路径没有渲染4个阶段，实际：' + weekCount);
  const planStatus = await page.locator('#plan-status').textContent();
  if (!/路径已生成|AI 已生成|AI 增强失败/.test(planStatus)) {
    throw new Error('学习路径生成后状态没有更新：' + planStatus);
  }
  if ((await page.locator('#plan-result-title').textContent()).indexOf('20') < 0) {
    throw new Error('学习路径没有使用学生输入的剩余天数');
  }

  await page.locator('.nav-item[data-page="skills"]').click();
  const firstStart = Date.now();
  await page.locator('#skill-next').click();
  await page.waitForFunction(() => {
    const submit = document.getElementById('skill-submit');
    return !!submit && !submit.disabled && !!document.getElementById('skill-question-text')?.textContent?.trim();
  }, { timeout: 1000 });
  if (Date.now() - firstStart > 1000) {
    throw new Error('开始训练没有做到即时出题');
  }
  if (!(await page.locator('#skill-options button').count())) {
    throw new Error('点击“开始训练”后没有立即生成题目');
  }
  if ((await page.locator('#skill-question-no').textContent()).trim() !== '1') {
    throw new Error('第一道训练题编号没有正确更新');
  }

  const firstQuestion = await page.locator('#skill-question-text').textContent();
  if (await page.locator('#skill-options button').count()) {
    await page.locator('#skill-options button[data-skill-option="B"]').click();
  } else {
    await page.locator('#skill-free-answer').fill('__smoke_first__');
  }
  await page.locator('#skill-submit').click();
  await page.waitForFunction(() => {
    const button = document.getElementById('skill-next');
    const panel = document.getElementById('skills');
    return !!button && button.hidden === false && !button.hasAttribute('hidden')
      && panel?.dataset.skillState === 'answered';
  }, { timeout: 2500 });

  if (!(await page.locator('#skill-question-text').textContent()).includes(firstQuestion)) {
    throw new Error('提交后上一题没有保留，页面自动跳题了');
  }

  if ((await page.locator('#skill-next').getAttribute('hidden')) !== null
      || !(await page.locator('#skill-next').isEnabled())
      || (await page.locator('#skills').getAttribute('data-skill-state')) !== 'answered') {
    throw new Error('提交后“下一题”状态没有正确恢复');
  }

  const historyCount = await page.locator('#skill-history-list .skill-history-item').count();
  if (historyCount !== 1) throw new Error('第一题没有进入题目历史');

  // 进入第二题后用“这题我不会”走稳定的错题沉淀路径，避免测试依赖某个选项恰好为错。
  await page.locator('#skill-next').click();
  await page.waitForFunction(() => {
    const submit = document.getElementById('skill-submit');
    return !!submit && !submit.disabled &&
      document.getElementById('skill-question-no')?.textContent?.trim() === '2';
  }, { timeout: 1000 });
  await page.locator('#skill-skip').click();
  await page.waitForFunction(() => {
    const panel = document.getElementById('skills');
    return panel?.dataset.skillState === 'answered';
  }, { timeout: 1500 });

  const mistakeCount = Number((await page.locator('#mistake-stat-pending').textContent()).trim());
  if (mistakeCount < 1) throw new Error('标记“这题我不会”后没有进入错题本，当前数量：' + mistakeCount);
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
