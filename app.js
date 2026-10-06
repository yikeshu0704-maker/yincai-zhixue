const navItems = [...document.querySelectorAll('.nav-item')];
const pages = [...document.querySelectorAll('.page')];
const titleMap = {
  dashboard: '你的今日学习计划',
  analysis: '你的学习情况分析',
  plan: 'AI 为你安排的学习路径',
  qa: 'AI 答疑辅导',
  mistakes: '你的错题复盘中心',
  report: '本周学习报告'
};

function showPage(id) {
  pages.forEach((page) => page.classList.toggle('active-page', page.id === id));
  navItems.forEach((item) => item.classList.toggle('active', item.dataset.page === id));
  document.getElementById('page-title').textContent = titleMap[id] || '因材智学';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

navItems.forEach((item) => item.addEventListener('click', () => showPage(item.dataset.page)));
document.querySelectorAll('[data-go]').forEach((button) => button.addEventListener('click', () => showPage(button.dataset.go)));

document.querySelectorAll('.task-item input').forEach((input) => {
  input.addEventListener('change', () => {
    input.closest('.task-item').classList.toggle('done', input.checked);
    input.closest('.task-item').querySelector('small').textContent = input.checked ? '已完成' : '待完成';
  });
});

const toast = document.getElementById('toast');
let toastTimer;
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
}
document.querySelectorAll('[data-toast]').forEach((button) => button.addEventListener('click', () => showToast(button.dataset.toast)));

const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatLog = document.getElementById('chat-log');
chatForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  const user = document.createElement('div');
  user.className = 'chat';
  user.innerHTML = `<div class="chat-avatar">我</div><div><p>${escapeHtml(text)}</p></div>`;
  chatLog.appendChild(user);
  chatInput.value = '';
  setTimeout(() => {
    const assistant = document.createElement('div');
    assistant.className = 'chat assistant';
    assistant.innerHTML = `<div class="chat-avatar">AI</div><div><p>已收到。正式版本中，我会结合你的年级、当前学情和错题记录，先定位你的卡点，再给你分步骤提示，而不是直接告诉你答案。</p><small>演示模式 · 尚未连接大模型</small></div>`;
    chatLog.appendChild(assistant);
    chatLog.scrollTop = chatLog.scrollHeight;
  }, 450);
});

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
}



const tutorStages = [
  {title:'第 1 步 · 判断你卡在哪里',badge:'定位卡点',response:'先不要看答案。告诉我：你看到“AB = AC”和“AD 是角平分线”后，能想到哪些相等的边或角？',hint:'提示：题目已经给了一个“边相等”和一个“角相等”的条件。',button:'我还是不会 → 下一步'},
  {title:'第 2 步 · 给一个小提示',badge:'轻提示',response:'你已经有两个非常重要的条件：AB = AC，以及 ∠BAD = ∠CAD。下一步想想：还缺哪个条件，才能比较两个三角形？',hint:'提示：两个三角形都会用到 AD。',button:'还是不会 → 继续引导'},
  {title:'第 3 步 · 引导你组织思路',badge:'分步引导',response:'我们比较 △ABD 和 △ACD。现在已经有 AB = AC、∠BAD = ∠CAD，而且 AD 是两边共有的。你能想到对应的全等判定吗？',hint:'提示：两边和它们的夹角分别相等。',button:'我仍然不会 → 看讲解'},
  {title:'第 4 步 · 解释为什么这样做',badge:'重点讲解',response:'因为目标是证明 BD = CD，所以可以尝试把 BD、CD 放进两个三角形中比较。△ABD 与 △ACD 有 AB = AC、AD = AD、∠BAD = ∠CAD，因此两三角形全等。全等后，对应边 BD 与 CD 就相等。',hint:'关键不是“背结论”，而是从目标反推：要证明 BD = CD，就找包含 BD、CD 的两个可比较三角形。',button:'还是不清楚 → 查看完整解法'},
  {title:'第 5 步 · 完整解法',badge:'完整解法',response:'证明：在 △ABD 和 △ACD 中，AB = AC（已知），AD = AD（公共边），∠BAD = ∠CAD（AD 为 ∠A 的角平分线）。所以 △ABD ≌ △ACD（SAS）。因此 BD = CD（全等三角形的对应边相等）。',hint:'学会了吗？下一道题可以尝试自己先找“目标对应的两个三角形”。',button:'重新练一题'}
];
let tutorStage = 0;
function renderTutorStage() {
  const s = tutorStages[tutorStage];
  const title = document.getElementById('tutor-stage-title');
  const badge = document.getElementById('tutor-stage-badge');
  const responseTitle = document.getElementById('tutor-response-title');
  const message = document.getElementById('tutor-message');
  const next = document.getElementById('tutor-next');
  if (!title) return;
  title.textContent = s.title;
  badge.textContent = s.badge;
  responseTitle.textContent = s.badge;
  message.querySelector('p').textContent = s.response;
  message.querySelector('small').textContent = s.hint;
  next.textContent = s.button;
  document.querySelectorAll('.stage-node').forEach(node => {
    const n = Number(node.dataset.stage);
    node.classList.toggle('active', n <= tutorStage + 1);
    node.classList.toggle('current', n === tutorStage + 1);
  });
}
document.getElementById('tutor-next')?.addEventListener('click', () => {
  tutorStage = (tutorStage + 1) % tutorStages.length;
  renderTutorStage();
});
document.getElementById('tutor-hint')?.addEventListener('click', () => {
  const s = tutorStages[tutorStage];
  const small = document.querySelector('#tutor-message small');
  if (small) small.textContent = s.hint;
  showToast('已追加一个更具体的提示');
});
document.querySelectorAll('[data-stuck]').forEach(button => button.addEventListener('click', () => {
  const message = document.querySelector('#tutor-message p');
  if (message) message.textContent = '收到，你现在的问题是：“' + button.dataset.stuck + '”。我会从这个卡点开始，而不是直接给完整答案。';
  showToast('已记录你的卡点');
}));
document.querySelectorAll('[data-prompt]').forEach(button => button.addEventListener('click', () => {
  chatInput.value = button.dataset.prompt;
  showPage('qa');
  chatInput.focus();
}));
renderTutorStage();


const planGoal = document.getElementById('plan-goal');
const planDays = document.getElementById('plan-days');
const planHours = document.getElementById('plan-hours');
const generatePlanButton = document.getElementById('generate-plan');

generatePlanButton?.addEventListener('click', () => {
  const days = Math.max(1, Number(planDays.value) || 30);
  const hours = Math.max(0.5, Number(planHours.value) || 2);
  const minutes = Math.round(hours * 60);
  const goal = planGoal.value.trim() || '完成阶段性考试目标';
  const title = document.getElementById('plan-result-title');
  const budget = document.getElementById('plan-budget');
  const status = document.getElementById('plan-status');
  if (title) title.textContent = days + ' 天 · ' + (goal.length > 28 ? goal.slice(0, 28) + '…' : goal);
  if (budget) budget.textContent = minutes + ' 分钟';
  if (status) status.textContent = '刚刚重新规划';
  showToast('AI 已根据你的时间约束重排学习路径');
});

const mistakeData = {
  function: {
    title:'一次函数图像与解析式',
    type:'条件提取错误',
    question:'已知一次函数 y = 2x + b 经过点（1，5），求 b。你把 b 写成了 5。',
    reason:'你把“点的纵坐标 y=5”和“截距 b”混在了一起，核心问题不是计算，而是没有把“点在函数图像上”转化成函数关系。',
    knowledge:'一次函数的图像与解析式：点（x，y）在图像上 ⇔ y = kx + b。',
    error:'概念理解 + 条件转化',
    basic:'把点（2，7）代入 y = 2x + b，求 b。',
    variant:'一次函数 y = -3x + b 经过点（2，1），求 b，并判断图像经过哪个象限。',
    comprehensive:'给出一次函数图像上的两个点，求解析式并判断与另一条直线的交点。',
  },
  geometry: {
    title:'三角形全等证明',
    type:'证明结构错误',
    question:'在 △ABC 中，AB = AC，AD 是 ∠A 的角平分线。证明：BD = CD。你只写了“等腰三角形两底角相等”，没有完成证明。',
    reason:'你知道结论，但没有把目标 BD = CD 转化成“比较两个包含 BD、CD 的三角形”，导致证明链条断开。',
    knowledge:'三角形全等判定：利用已知边、公共边和角平分线得到 SAS。',
    error:'思路组织 + 证明书写',
    basic:'在两个三角形中找出两边及其夹角相等的条件。',
    variant:'增加一条辅助线后，判断应比较哪两个三角形，并写出全等依据。',
    comprehensive:'完成含辅助线的几何综合证明，并说明每一步依据。',
  },
  pythagoras: {
    title:'勾股定理基础应用',
    type:'计算步骤不稳定',
    question:'直角三角形两直角边分别为 6 和 8，求斜边。你第一次把 6+8 当成了斜边。',
    reason:'你知道题目与直角三角形有关，但没有先识别“斜边对应最长边”，并正确调用平方关系。',
    knowledge:'勾股定理：直角三角形中，两直角边平方和等于斜边平方。',
    error:'公式调用 + 条件识别',
    basic:'直角边为 5、12，求斜边。',
    variant:'已知斜边和一条直角边，反求另一条直角边。',
    comprehensive:'将勾股定理与面积、相似或坐标综合使用。',
  }
};

let currentMistake = 'function';
let reviewStep = 1;
let selectedReviewAnswer = '';

function renderMistake() {
  const data = mistakeData[currentMistake];
  const title = document.getElementById('mistake-title');
  const type = document.getElementById('mistake-type');
  const question = document.getElementById('mistake-question');
  const stageTitle = document.getElementById('review-stage-title');
  const stageText = document.getElementById('review-stage-text');
  const status = document.getElementById('review-status');
  const next = document.getElementById('review-next');
  const pill = document.getElementById('mastery-pill');
  if (!title) return;
  title.textContent = data.title;
  type.textContent = data.type;
  question.textContent = data.question;
  if (pill) pill.textContent = reviewStep >= 5 ? '准备再测' : '尚未通过';
  document.querySelectorAll('.mistake-item').forEach(item => item.classList.toggle('active', item.dataset.mistake === currentMistake));
  document.querySelectorAll('.review-step').forEach(node => {
    const n = Number(node.dataset.reviewStep);
    node.classList.toggle('active', n <= reviewStep);
    node.classList.toggle('current', n === reviewStep);
  });
  const stages = [
    ['先找出你为什么错', data.reason],
    ['定位真正薄弱的知识点', data.knowledge],
    ['给这次错误贴上“可追踪”的标签', data.error],
    ['从简单到综合重新练一遍', '先做同类基础题，再做变式题，最后进入综合题。系统会根据正确率决定是否升级难度。'],
    ['检查是否真正掌握', '通过不同题型后再进行间隔复测。连续通过后，才会把该知识点从“待干预”移动到“稳定掌握”。']
  ];
  const stage = stages[reviewStep - 1];
  stageTitle.textContent = stage[0];
  stageText.textContent = stage[1];
  status.textContent = '第 ' + reviewStep + '/5 步 · ' + (reviewStep === 5 ? '掌握检验' : '复盘中');
  next.textContent = reviewStep === 5 ? '完成复盘' : '下一步 →';
  renderReviewAction(data);
}

function renderReviewAction(data) {
  const area = document.getElementById('review-action-area');
  if (!area) return;
  if (reviewStep === 1) {
    area.innerHTML = '<div class="review-question"><b>第一步：判断你的错误原因</b><p>你当时为什么会得到这个错误答案？</p></div><div class="review-options">' +
      ['忘记代入','把y当b','不会'].map(x => '<button data-review-answer="' + x + '">' +
      (x === '忘记代入' ? '我忘记把点代入函数' : x === '把y当b' ? '我把 y 的值直接当成了 b' : '我不知道点在图像上是什么意思') + '</button>').join('') + '</div>';
  } else if (reviewStep === 2) {
    area.innerHTML = '<div class="review-question"><b>第二步：定位知识点</b><p>系统判断这道错题最核心的知识点是：</p></div><div class="review-answer-card"><strong>' + data.knowledge + '</strong><small>后续训练会围绕这个知识点生成，而不是泛泛刷题。</small></div>';
  } else if (reviewStep === 3) {
    area.innerHTML = '<div class="review-question"><b>第三步：错误类型</b><p>这次错误更接近哪一种？</p></div><div class="review-options"><button data-review-answer="概念理解">概念理解</button><button data-review-answer="条件提取">条件提取</button><button data-review-answer="思路组织">思路组织</button></div>';
  } else if (reviewStep === 4) {
    area.innerHTML = '<div class="training-ladder"><div class="training-card"><span>① 基础同类题</span><b>' + data.basic + '</b></div><div class="training-card"><span>② 变式题</span><b>' + data.variant + '</b></div><div class="training-card"><span>③ 综合题</span><b>' + data.comprehensive + '</b></div></div>';
  } else {
    area.innerHTML = '<div class="mastery-test"><span>掌握检验题</span><b>先独立完成 1 道同知识点的新题，再由 AI 判断是否需要继续补救。</b><div class="mastery-meter"><i style="width:72%"></i></div><small>当前预计掌握度 72% · 通过门槛 80%</small></div>';
  }
  area.querySelectorAll('[data-review-answer]').forEach(btn => btn.addEventListener('click', () => {
    selectedReviewAnswer = btn.dataset.reviewAnswer;
    area.querySelectorAll('[data-review-answer]').forEach(x => x.classList.remove('selected'));
    btn.classList.add('selected');
    showToast('已记录：' + selectedReviewAnswer);
  }));
}

document.querySelectorAll('.mistake-item').forEach(item => item.addEventListener('click', () => {
  currentMistake = item.dataset.mistake;
  reviewStep = 1;
  selectedReviewAnswer = '';
  renderMistake();
}));

document.getElementById('review-next')?.addEventListener('click', () => {
  if (reviewStep === 5) {
    showToast('复盘完成，已进入再测队列');
    reviewStep = 1;
  } else {
    reviewStep += 1;
  }
  renderMistake();
});

renderMistake();
