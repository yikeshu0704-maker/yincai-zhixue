const API_ORIGIN = 'http://127.0.0.1:8080';
const CHAT_API_URL = API_ORIGIN + '/api/chat';
const AGENT_API_URL = API_ORIGIN + '/api/agent';

const PROFILE_KEY = 'yincaiProfile';
const TASK_KEY = 'yincaiTasks';
const STREAK_KEY = 'yincaiStreak';
const DATA_VERSION = '2026-10-07-first-user-flow-v2';

if (localStorage.getItem('yincaiDataVersion') !== DATA_VERSION) {
  ['yincaiProfile', 'yincaiTasks', 'yincaiStreak', 'yincaiMistakes'].forEach((key) => localStorage.removeItem(key));
  localStorage.setItem('yincaiDataVersion', DATA_VERSION);
}

let profile = null;

function loadProfile() {
  try {
    profile = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
  } catch (error) {
    profile = null;
  }
  return profile;
}

function saveProfile(nextProfile) {
  profile = nextProfile;
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

function profileContext() {
  if (!profile) return '当前没有学生学情数据。请先让学生完成首次学情设置。';
  return [
    '学生姓名：' + profile.name,
    '年级：' + profile.grade,
    '学科：' + profile.subject,
    '最近一次考试分数：' + (profile.score || '未填写'),
    '考试目标：' + (profile.goal || '未填写'),
    '距离考试：' + (profile.days || '未填写') + ' 天',
    '每天可学习：' + (profile.hours || '未填写') + ' 小时',
    '学生自述当前情况：' + (profile.state || '未填写'),
    '历史错题数量：' + Object.keys(mistakeData).length,
    '最近一次 AI 学情诊断：' + (profile.diagnosis ? JSON.stringify(profile.diagnosis) : '尚未诊断'),
    '当前重点训练：' + (profile.primaryTopic || '尚未确定')
  ].join('\\n');
}

function openOnboarding() {
  const modal = document.getElementById('onboarding-backdrop');
  if (modal) modal.classList.add('show');
}

function closeOnboarding() {
  const modal = document.getElementById('onboarding-backdrop');
  if (modal) modal.classList.remove('show');
}


const navItems = [...document.querySelectorAll('.nav-item')];
const pages = [...document.querySelectorAll('.page')];
const titleMap = {
  dashboard: '你的今日学习计划',
  analysis: '你的学习情况分析',
  plan: 'AI 为你安排的学习路径',
  qa: 'AI 答疑辅导',
  skills: '自适应技能训练',
  mistakes: '你的错题复盘中心',
  report: '本周学习报告',
  motivation: '今日学习激励'
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
let chatPending = false;

function appendAssistantBubble(answerText, noteText) {
  const assistant = document.createElement('div');
  assistant.className = 'chat assistant';
  assistant.innerHTML = '<div class="chat-avatar">AI</div><div><p></p><small></small></div>';
  assistant.querySelector('p').textContent = answerText;
  const small = assistant.querySelector('small');
  if (noteText) small.textContent = noteText; else small.remove();
  chatLog.appendChild(assistant);
  chatLog.scrollTop = chatLog.scrollHeight;
  return assistant;
}

const chatImageInput = document.getElementById('chat-image');
const chatImageName = document.getElementById('chat-image-name');
const clearChatImageButton = document.getElementById('clear-chat-image');
let selectedChatImage = null;

function resetChatImage() {
  selectedChatImage = null;
  if (chatImageInput) chatImageInput.value = '';
  if (chatImageName) chatImageName.textContent = '支持 JPG / PNG / GIF / WebP，建议 8MB 以内';
  if (clearChatImageButton) clearChatImageButton.hidden = true;
}

chatImageInput?.addEventListener('change', () => {
  const file = chatImageInput.files?.[0];
  if (!file) return;
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowed.includes(file.type)) {
    showToast('暂时只支持 JPG、PNG、GIF、WebP');
    resetChatImage();
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    showToast('图片建议控制在 8MB 以内');
    resetChatImage();
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    selectedChatImage = { data: reader.result, mimeType: file.type, name: file.name };
    if (chatImageName) chatImageName.textContent = file.name;
    if (clearChatImageButton) clearChatImageButton.hidden = false;
  };
  reader.readAsDataURL(file);
});
clearChatImageButton?.addEventListener('click', resetChatImage);

chatForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const text = chatInput.value.trim();
  if ((!text && !selectedChatImage) || chatPending) return;

  const sentImage = selectedChatImage;
  const user = document.createElement('div');
  user.className = 'chat';
  const imagePreview = sentImage
    ? '<img class="chat-user-image" src="' + sentImage.data + '" alt="用户上传的题目图片" />'
    : '';
  user.innerHTML = '<div class="chat-avatar">我</div><div>' +
    imagePreview + '<p>' + escapeHtml(text || '请帮我看这张题目图片。') + '</p></div>';
  chatLog.appendChild(user);

  chatInput.value = '';
  resetChatImage();
  chatPending = true;

  const pending = appendAssistantBubble('正在分析你的题目…', sentImage ? '正在读取图片并连接后端服务…' : '正在连接后端服务…');
  try {
    const response = await fetch(CHAT_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: profile ? (profileContext() + '\\n学生当前问题：' + text) : text,
        imageData: sentImage?.data || null,
        imageMimeType: sentImage?.mimeType || null
      })
    });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data = await response.json();
    pending.querySelector('p').textContent = data.answer || '（后端返回内容为空，请稍后再试）';
    pending.querySelector('small').textContent = sentImage ? '来自 DeepSeek 多模态答疑' : '来自因材智学后端服务';
  } catch (error) {
    pending.querySelector('p').textContent = '暂时无法完成答疑。请确认 Spring Boot 后端运行在 localhost:8080，且 DeepSeek API 可用。';
    pending.querySelector('small').textContent = '连接失败 · ' + error.message;
  }
  chatPending = false;
  chatLog.scrollTop = chatLog.scrollHeight;
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

const analysisAgentButton = document.getElementById('run-analysis-agent');

function parseAgentJson(raw) {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Agent 返回的结构化结果无法解析，请重试。');
  try { return JSON.parse(raw.slice(start, end + 1)); }
  catch (error) { throw new Error('Agent 返回的结构化结果无法解析，请重试。'); }
}

function renderDiagnosisResult(data) {
  profile.diagnosis = data;
  profile.primaryTopic = data.priorities?.[0]?.name || '';
  saveProfile(profile);

  const main = document.getElementById('analysis-main');
  const summary = document.getElementById('analysis-agent-result');
  if (main) main.textContent = (data.priorities || []).slice(0, 2).map(item => item.name).filter(Boolean).join(' + ') || '待诊断';
  if (summary) summary.innerHTML = '<b>总体判断：</b> ' + escapeHtml(data.summary || '暂无') + '<br><b>下一步：</b> ' + escapeHtml(data.recommendedAction || '暂无');

  const reasons = [
    document.getElementById('analysis-reason-1'),
    document.getElementById('analysis-reason-2'),
    document.getElementById('analysis-reason-3')
  ];
  (data.priorities || []).slice(0, 3).forEach((item, index) => {
    if (!reasons[index]) return;
    const mastery = typeof item.mastery === 'number' ? '掌握度 ' + item.mastery + '%' : '掌握度待诊断';
    reasons[index].innerHTML = '<b>' + escapeHtml(item.name || '未命名知识点') + '</b> · ' +
      escapeHtml(item.priority || '待诊断') + ' · ' + mastery + '<br>' + escapeHtml(item.evidence || '暂无依据');
  });

  const map = document.getElementById('mastery-list');
  if (map) {
    const list = data.priorities || [];
    map.innerHTML = list.length ? list.map(item => {
      const mastery = typeof item.mastery === 'number' ? item.mastery : null;
      const priorityClass = item.priority === '高' ? 'priority-high' : item.priority === '中' ? 'priority-mid' : '';
      return '<div class="mastery-row ' + priorityClass + '">' +
        '<div class="mastery-name"><b>' + escapeHtml(item.name || '知识点') + '</b><span>' + escapeHtml(item.priority || '待诊断') + '</span></div>' +
        '<div class="mastery-bar"><i style="width:' + (mastery === null ? 10 : mastery) + '%"></i></div>' +
        '<strong>' + (mastery === null ? '待诊断' : mastery + '%') + '</strong>' +
      '</div>';
    }).join('') : '<div class="empty-state"><b>AI 暂时无法形成知识点地图</b><p>请先补充更多测试结果或答题记录。</p></div>';
  }

  const skillTitle = document.getElementById('skill-topic-title');
  if (skillTitle && data.priorities?.[0]?.name) skillTitle.textContent = data.priorities[0].name + ' · AI训练';
  showToast('学情诊断已更新');
  requestDynamicSkillQuestion(false).catch(() => {});
}

async function runAnalysisAgent() {
  if (!profile) { openOnboarding(); showToast('先完成首次学情设置'); return; }
  if (analysisAgentButton) { analysisAgentButton.disabled = true; analysisAgentButton.textContent = 'AI分析中…'; }
  try {
    const answer = await callAgent('analysis', profileContext() + '\\n请完成第一次学情诊断。');
    renderDiagnosisResult(parseAgentJson(answer));
    renderProfile();
  } catch (error) {
    const resultNode = document.getElementById('analysis-agent-result');
    if (resultNode) resultNode.textContent = error.message;
    showToast('学情分析失败');
  } finally {
    if (analysisAgentButton) { analysisAgentButton.disabled = false; analysisAgentButton.textContent = 'AI重新诊断'; }
  }
}

analysisAgentButton?.addEventListener('click', runAnalysisAgent);

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
const planProgressBar = document.getElementById('plan-progress-bar');
const planProgressText = document.getElementById('plan-progress-text');

let planProgressTimer = null;

function startPlanProgress() {
  clearInterval(planProgressTimer);
  let value = 8;
  const messages = [
    '正在读取你的学情与考试目标…',
    '正在分析薄弱点与时间预算…',
    '正在计算阶段任务分配…',
    '正在生成每天可执行的训练安排…'
  ];
  let index = 0;

  if (planProgressBar) {
    planProgressBar.style.width = value + '%';
    planProgressBar.classList.add('running');
  }
  if (planProgressText) planProgressText.textContent = messages[0];

  planProgressTimer = setInterval(() => {
    value = Math.min(88, value + 7);
    index = Math.min(messages.length - 1, index + 1);
    if (planProgressBar) planProgressBar.style.width = value + '%';
    if (planProgressText) planProgressText.textContent = messages[index];
  }, 1400);
}

function finishPlanProgress(success, message) {
  clearInterval(planProgressTimer);
  if (planProgressBar) {
    planProgressBar.style.width = success ? '100%' : '0%';
    planProgressBar.classList.toggle('running', false);
    planProgressBar.classList.toggle('failed', !success);
  }
  if (planProgressText) {
    planProgressText.textContent = message;
  }
}

generatePlanButton?.addEventListener('click', async () => {
  if (!profile) {
    openOnboarding();
    showToast('先完成首次学情设置');
    return;
  }

  const days = Math.max(1, Number(planDays.value || profile.days) || 1);
  const hours = Math.max(0.5, Number(planHours.value || profile.hours) || 0.5);
  const minutes = Math.round(hours * 60);
  const goal = planGoal.value.trim() || profile.goal || '完成阶段性考试目标';
  const title = document.getElementById('plan-result-title');
  const budget = document.getElementById('plan-budget');
  const status = document.getElementById('plan-status');
  const result = document.getElementById('plan-agent-result');

  if (title) title.textContent = days + ' 天 · ' + (goal.length > 28 ? goal.slice(0, 28) + '…' : goal);
  if (budget) budget.textContent = minutes + ' 分钟';
  if (status) status.textContent = 'AI 正在规划…';
  if (result) result.textContent = '请稍候。AI 正在综合你的学情、目标与时间限制。';
  if (generatePlanButton) generatePlanButton.disabled = true;

  startPlanProgress();

  try {
    const answer = await callAgent('plan',
      profileContext() + '\\n' +
      '本次规划输入的考试目标：' + goal + '\\n' +
      '本次规划输入的剩余天数：' + days + ' 天。\\n' +
      '本次规划输入的每天学习时间：' + hours + ' 小时。'
    );
    const data = parseAgentJson(answer);
    renderPlanResult(data, days, minutes);
    if (status) status.textContent = '真实 Agent 已生成';
    finishPlanProgress(true, '规划完成：已生成可执行学习阶段');
    showToast('学习路径 Agent 已完成重新规划');
  } catch (error) {
    if (result) result.textContent = error.message;
    if (status) status.textContent = 'Agent 调用失败';
    finishPlanProgress(false, '生成失败：' + error.message);
    showToast('学习路径生成失败');
  } finally {
    if (generatePlanButton) generatePlanButton.disabled = false;
  }
});


function renderPlanResult(data, days, minutes) {
  const title = document.getElementById('plan-result-title');
  const status = document.getElementById('plan-status');
  const priority1 = document.getElementById('plan-priority-1');
  const priority2 = document.getElementById('plan-priority-2');
  const stable = document.getElementById('plan-stable');
  const budget = document.getElementById('plan-budget');
  const weekPlan = document.getElementById('week-plan');
  const note = document.getElementById('plan-agent-result');

  if (title) title.textContent = data.title || (days + ' 天学习计划');
  if (status) status.textContent = '真实 Agent 已生成';
  if (priority1) priority1.textContent = data.highestPriority || '待诊断';
  if (priority2) priority2.textContent = data.secondPriority || '待诊断';
  if (stable) stable.textContent = data.stable || '待诊断';
  if (budget) budget.textContent = (data.dailyMinutes || minutes) + ' 分钟';
  if (note) note.textContent = data.adjustment || '完成训练后会继续动态重排。';

  const weeks = Array.isArray(data.weeks) ? data.weeks : [];
  if (weekPlan) {
    weekPlan.innerHTML = weeks.length ? weeks.map((week, index) =>
      '<article class="week-card ' + (index === 0 ? 'high' : index === weeks.length - 1 ? 'final' : 'mid') + '">' +
        '<div class="week-index">' + escapeHtml(week.week || ('阶段 ' + (index + 1))) + '</div>' +
        '<div class="week-main"><h4>' + escapeHtml(week.focus || '训练重点') + '</h4>' +
        '<p>' + escapeHtml(week.goal || '') + '</p>' +
        '<div class="week-tags"><span>Agent 规划</span><b>每天 ' + escapeHtml(String(week.minutesPerDay || data.dailyMinutes || minutes)) + ' 分钟</b></div>' +
        '<small class="week-reason">' + escapeHtml(week.reason || '') + '</small></div>' +
        '<div class="week-check">' + (index + 1) + '</div>' +
      '</article>'
    ).join('') : '<div class="empty-state"><b>Agent 暂时没有生成阶段计划</b><p>请重试一次。</p></div>';
  }
}

let mistakeData = {};
let currentMistake = null;
let reviewStep = 1;
let selectedReviewAnswer = '';

function getStoredMistakes() {
  try {
    return JSON.parse(localStorage.getItem('yincaiMistakes') || '[]');
  } catch (error) {
    return [];
  }
}

function saveMistakes() {
  localStorage.setItem('yincaiMistakes', JSON.stringify(Object.values(mistakeData)));
}

function hydrateMistakes() {
  const items = getStoredMistakes();
  mistakeData = {};
  items.forEach(item => { mistakeData[item.id] = item; });
  currentMistake = Object.keys(mistakeData)[0] || null;
}
hydrateMistakes();


function renderMistake() {
  const data = currentMistake ? mistakeData[currentMistake] : null;
  const title = document.getElementById('mistake-title');
  const type = document.getElementById('mistake-type');
  const question = document.getElementById('mistake-question');
  const stageTitle = document.getElementById('review-stage-title');
  const stageText = document.getElementById('review-stage-text');
  const status = document.getElementById('review-status');
  const next = document.getElementById('review-next');
  const pill = document.getElementById('mastery-pill');
  if (!title) return;
  if (!data) {
    title.textContent = '等待第一道错题';
    document.getElementById('mistake-type').textContent = '暂无';
    document.getElementById('mistake-question').textContent = '完成一道练习并出现真实错误后，这里会显示原题。';
    document.getElementById('review-stage-title').textContent = '等待真实错题';
    document.getElementById('review-stage-text').textContent = '先完成一道练习。系统会从你的实际错误开始复盘，而不是预置示例。';
    document.getElementById('review-status').textContent = '暂无错题';
    const aiButton = document.getElementById('ai-review-start');
    if (aiButton) aiButton.disabled = true;
    return;
  }
  const aiButton = document.getElementById('ai-review-start');
  if (aiButton) aiButton.disabled = false;
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

document.getElementById('review-next')?.addEventListener('click', async () => {
  if (reviewStep === 5) {
    showToast('复盘完成，已进入再测队列');
    reviewStep = 1;
  } else {
    reviewStep += 1;
  }
  renderMistake();

  const data = mistakeData[currentMistake];
  try {
    const answer = await callAgent('mistake',
      '错题标题：' + data.title + '\n' +
      '原错题：' + data.question + '\n' +
      '错误原因线索：' + data.reason + '\n' +
      '知识点：' + data.knowledge + '\n' +
      '错误类型：' + data.error + '\n' +
      '学生当前进入复盘第 ' + reviewStep + '/5 步。\n' +
      '请只输出本阶段最重要的诊断/训练建议，帮助学生继续复盘。'
    );
    document.getElementById('review-stage-text').textContent = answer;
  } catch (error) {
    showToast('AI复盘暂时不可用，继续使用本地复盘流程');
  }
});

renderMistake();


const skillQuestions = [
  {
    level:'基础题', label:'基础训练', question:'已知一次函数 y = 2x + 3，当 x = 1 时，y = ?', options:{A:'3',B:'5',C:'6',D:'8'}, answer:'B'
  },
  {
    level:'中等题', label:'中等应用', question:'一次函数 y = 2x + b 经过点（1，4），则 b = ?', options:{A:'1',B:'2',C:'3',D:'4'}, answer:'B'
  },
  {
    level:'综合题', label:'综合应用', question:'一次函数 y = kx + b 的图象经过 A(1,3) 和 B(3,7)，则该函数的解析式是？', options:{A:'y = x + 2',B:'y = 2x + 1',C:'y = 3x',D:'y = 2x - 1'}, answer:'B'
  },
  {
    level:'变式题', label:'迁移变式', question:'直线 y = 2x + 1 向上平移 3 个单位后经过点 P。若 P 的横坐标为 2，则 P 的纵坐标为？', options:{A:'5',B:'6',C:'8',D:'9'}, answer:'C'
  }
];
let skillLevelIndex = 2;
let skillQuestionNo = 1;
let skillStreak = 0;
let skillMastery = 0;
let selectedSkillOption = '';
let dynamicSkillQuestion = null;

function renderSkillQuestion() {
  const levelTitle = document.getElementById('skill-level-title');
  const levelPill = document.getElementById('skill-level-pill');
  const question = document.getElementById('skill-question-text');
  const no = document.getElementById('skill-question-no');
  const options = document.getElementById('skill-options');
  const current = document.getElementById('skill-current-level');
  const next = document.getElementById('skill-next-level');
  const mastery = document.getElementById('skill-mastery');
  const decisionPill = document.getElementById('skill-decision-pill');
  const decisionText = document.getElementById('skill-decision-text');
  const submit = document.getElementById('skill-submit');
  const skip = document.getElementById('skill-skip');
  if (!levelTitle || !options) return;

  const q = dynamicSkillQuestion || (profile ? skillQuestions[skillLevelIndex] : null);
  if (!profile || !q) {
    levelTitle.textContent = '等待生成';
    levelPill.textContent = '未开始';
    question.textContent = '完成首次学情设置和 AI 诊断后，系统会根据你的真实情况生成第一道训练题。';
    no.textContent = '0';
    if (current) current.textContent = '未开始';
    if (next) next.textContent = '等待诊断';
    if (mastery) mastery.textContent = '--';
    if (decisionPill) decisionPill.textContent = '等待学情';
    if (decisionText) decisionText.textContent = '先完成学情设置，Agent 才会决定训练技能和难度。';
    options.innerHTML = '<div class="empty-state"><b>等待 AI 出题</b><p>完成首次学情设置后开始训练。</p></div>';
    if (submit) submit.disabled = true;
    if (skip) skip.disabled = true;
    return;
  }

  levelTitle.textContent = q.level;
  levelPill.textContent = q.label;
  question.textContent = q.question;
  no.textContent = skillQuestionNo;
  if (current) current.textContent = q.level;
  if (mastery) mastery.textContent = skillMastery ? skillMastery + '%' : '--';
  if (decisionPill) decisionPill.textContent = '正在训练 · ' + q.level;
  if (decisionText) decisionText.textContent = skillStreak >= 2
    ? '连续答对后，Agent 正在尝试更高难度。'
    : 'Agent 会根据你的最近表现动态决定下一题。';
  const nextLabel = skillLevelIndex < 3 ? skillQuestions[skillLevelIndex + 1].level : '维持变式';
  if (next) next.textContent = nextLabel;
  options.innerHTML = Object.entries(q.options || {})
    .map(([key,value]) => '<button data-skill-option="' + key + '">' + key + '. ' + escapeHtml(String(value).replace(/^\w\.\s*/, '')) + '</button>')
    .join('');
  options.querySelectorAll('[data-skill-option]').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedSkillOption = btn.dataset.skillOption;
      options.querySelectorAll('button').forEach(x => x.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });
  if (submit) submit.disabled = false;
  if (skip) skip.disabled = false;

  const feedback=document.getElementById('skill-feedback');
  if(feedback){
    feedback.className='skill-feedback';
    feedback.innerHTML='<span>AI 评估规则</span><p>连续答对会提高难度；出现错误会先回到更适合当前状态的题型。</p>';
  }
}

function evaluateSkillAnswer(correct) {
  const resultTitle=document.getElementById('skill-result-title');
  const nextLevel=skillLevelIndex;
  let feedbackTitle='';
  let feedbackText='';
  if(correct){
    skillStreak += 1;
    skillMastery = Math.min(100, skillMastery + 8);
    if(skillStreak >= 2 && skillLevelIndex < 3) skillLevelIndex += 1;
    feedbackTitle='答对了 · Agent 已更新学情';
    feedbackText='这次表现支持你进入更高难度。当前掌握度提升到 ' + skillMastery + '%。';
    if(resultTitle) resultTitle.textContent='表现稳定，难度已上调';
  }else{
    skillStreak = 0;
    skillMastery = Math.max(0, skillMastery - 5);
    if(skillLevelIndex > 0) skillLevelIndex -= 1;
    feedbackTitle='这次先降一个难度';
    feedbackText='不要继续堆更难的题。Agent 判断你需要先补强当前能力，再重新尝试。';
    if(resultTitle) resultTitle.textContent='出现卡点，Agent 已降低难度';
  }
  document.getElementById('skill-streak').textContent=skillStreak;
  if (profile) {
    profile.skillMastery = skillMastery;
    saveProfile(profile);
  }
  skillQuestionNo += 1;
  renderSkillQuestion();
  const feedback=document.getElementById('skill-feedback');
  if(feedback){
    feedback.className=correct ? 'skill-feedback correct' : 'skill-feedback wrong';
    feedback.innerHTML='<span>' + feedbackTitle + '</span><p>' + feedbackText + '</p>';
  }
}

async function analyzeSkillMistake(q, chosen, mistakeId) {
  const answer = await callAgent('mistake',
    profileContext() + '\\n' +
    '刚刚技能训练题：' + q.question + '\\n' +
    '正确答案：' + q.answer + '\\n' +
    '学生选择：' + chosen + '\\n' +
    '请明确告诉学生：这道题暴露出的知识点是什么、错因是什么、下一步应该补什么。请简洁回答。'
  );

  if (mistakeData[mistakeId]) {
    mistakeData[mistakeId].knowledge = answer;
    mistakeData[mistakeId].reason = answer;
    saveMistakes();
    renderMistakeListFromStore();
  }

  const feedback = document.getElementById('skill-feedback');
  if (feedback) {
    feedback.className = 'skill-feedback wrong';
    feedback.innerHTML = '<span>AI 找到这次卡点</span><p>' + escapeHtml(answer) + '</p>';
  }

  profile.latestSkillDiagnosis = answer;
  saveProfile(profile);
  return answer;
}

document.getElementById('skill-submit')?.addEventListener('click', async () => {
  const q = dynamicSkillQuestion || skillQuestions[skillLevelIndex];
  if(!selectedSkillOption){ showToast('先选择一个答案'); return; }

  const chosen = selectedSkillOption;
  const correct = chosen === q.answer;
  let mistakeId = null;

  if (!correct) {
    mistakeId = 'mistake-' + Date.now();
    mistakeData[mistakeId] = {
      id: mistakeId,
      title: q.level + ' · ' + (profile?.primaryTopic || profile?.subject || '技能训练'),
      type: '技能训练错误',
      question: q.question,
      reason: '正在由 AI 分析',
      knowledge: '正在由 AI 定位',
      error: '答题错误',
      basic: '围绕该知识点做一道基础同类题。',
      variant: '改变条件后做一道变式题。',
      comprehensive: '完成一道综合应用题并解释思路。',
      createdAt: new Date().toLocaleString()
    };
    saveMistakes();
    currentMistake = mistakeId;
    renderMistakeListFromStore();
  }

  dynamicSkillQuestion = null;
  selectedSkillOption = '';
  evaluateSkillAnswer(correct);

  try {
    if (!correct && mistakeId) {
      await analyzeSkillMistake(q, chosen, mistakeId);
    }
    await requestDynamicSkillQuestion(correct);
  } catch (error) {
    const feedback = document.getElementById('skill-feedback');
    if (feedback) feedback.innerHTML = '<span>AI 暂时无法继续</span><p>' + escapeHtml(error.message) + '</p>';
  }
});

document.getElementById('skill-skip')?.addEventListener('click', async () => {
  skillStreak=0;
  skillMastery=Math.max(0, skillMastery-3);
  if(skillLevelIndex>0) skillLevelIndex -= 1;
  skillQuestionNo += 1;
  selectedSkillOption='';
  dynamicSkillQuestion = null;
  showToast('已记录“不会”，下一题会降低难度');
  renderSkillQuestion();
  try {
    await requestDynamicSkillQuestion(false);
  } catch (error) {
    showToast('AI 出题失败，保留本地题库');
  }
});

renderSkillQuestion();

const motivationComplete=document.getElementById('motivation-complete');
const motivationBar=document.getElementById('motivation-complete-bar');
const motivationTitle=document.getElementById('motivation-title');
const motivationReason=document.getElementById('motivation-reason');
const motivationStatus=document.getElementById('motivation-status');
const loadBar = document.getElementById('load-bar');
const loadValue = document.getElementById('load-value');
const loadStatus = document.getElementById('load-status');




async function callAgent(agent, context) {
  let response;
  try {
    response = await fetch(AGENT_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent, context })
    });
  } catch (error) {
    throw new Error('无法连接学习 Agent 后端（127.0.0.1:8080）。请确认 Spring Boot 已重新启动。');
  }

  let data = null;
  try {
    data = await response.json();
  } catch (error) {
    throw new Error('Agent 后端返回了无法解析的内容（HTTP ' + response.status + '）。');
  }

  if (!response.ok) {
    throw new Error(data?.result || ('Agent 请求失败（HTTP ' + response.status + '）'));
  }

  if (!data?.result) {
    throw new Error('Agent 后端返回内容为空。');
  }

  return data.result;
}

const aiReviewStart = document.getElementById('ai-review-start');
aiReviewStart?.addEventListener('click', async () => {
  const data = mistakeData[currentMistake];
  aiReviewStart.disabled = true;
  aiReviewStart.textContent = 'AI分析中…';
  try {
    const answer = await callAgent('mistake',
      '错题标题：' + data.title + '\n' +
      '原错题：' + data.question + '\n' +
      '原始错误原因线索：' + data.reason + '\n' +
      '知识点：' + data.knowledge + '\n' +
      '错误类型：' + data.error + '\n' +
      '当前复盘阶段：第 ' + reviewStep + '/5。\n' +
      '请给出本阶段最应该关注的内容和下一步训练建议。'
    );
    document.getElementById('review-stage-text').textContent = answer;
    showToast('错题复盘 Agent 已完成真实分析');
  } catch (error) {
    document.getElementById('review-stage-text').textContent = error.message;
    showToast('错题分析失败');
  } finally {
    aiReviewStart.disabled = false;
    aiReviewStart.textContent = 'AI分析这道错题';
  }
});

function parseSkillQuestion(raw) {
  let parsed = null;
  try {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
      parsed = JSON.parse(raw.slice(start, end + 1));
    }
  } catch (error) {
    parsed = null;
  }

  if (!parsed || !parsed.question || !parsed.options || !parsed.answer) return null;
  if (!['A','B','C','D'].every(key => parsed.options[key])) return null;

  return {
    level: parsed.level || '综合题',
    label: parsed.label || '综合应用',
    question: parsed.question,
    options: parsed.options,
    answer: parsed.answer,
    explanation: parsed.explanation || ''
  };
}

async function requestDynamicSkillQuestion(lastCorrect) {
  const answer = await callAgent('skill',
    profileContext() + '\\n' +
    '当前重点知识点：' + (profile?.primaryTopic || profile?.subject || '当前学科') + '。\\n' +
    '最近学情诊断：' + (profile?.diagnosis ? JSON.stringify(profile.diagnosis) : '尚未完成') + '\\n' +
    '当前技能掌握度：' + (profile?.skillMastery || '尚未测得') + '。\\n' +
    '当前训练难度：' + skillQuestions[skillLevelIndex].level + '。\\n' +
    '连续答对：' + skillStreak + '。\\n' +
    '上一题是否答对：' + (lastCorrect ? '是' : '否') + '。\\n' +
    '请根据这些表现动态决定下一题难度，并生成一道适合当前学生的新题。'
  );

  const parsed = parseSkillQuestion(answer);
  const feedback = document.getElementById('skill-feedback');

  if (!parsed) {
    if (feedback) {
      feedback.className = 'skill-feedback';
      feedback.innerHTML = '<span>AI 已参与判断难度</span><p>' + escapeHtml(answer) + '</p>';
    }
    return;
  }

  dynamicSkillQuestion = parsed;
  const levelMap = {'基础题':0,'中等题':1,'综合题':2,'变式题':3};
  if (levelMap[parsed.level] !== undefined) skillLevelIndex = levelMap[parsed.level];
  renderSkillQuestion();

  if (feedback) {
    feedback.className = 'skill-feedback correct';
    feedback.innerHTML = '<span>AI 已生成下一题</span><p>' +
      escapeHtml(parsed.explanation || '题目难度已经根据你的答题表现重新调整。') + '</p>';
  }
}

function refreshFirstUseStats() {
  const mistakesCount = Object.keys(mistakeData).length;
  const mistakeNode = document.getElementById('mistake-count');
  if (mistakeNode) mistakeNode.textContent = mistakesCount + ' 道';
  const scoreNode = document.getElementById('motivation-mastery');
  if (scoreNode) scoreNode.textContent = profile?.skillMastery ? profile.skillMastery + '%' : '--';
  const streak = Number(localStorage.getItem(STREAK_KEY) || 0);
  const streakNode = document.getElementById('motivation-streak');
  if (streakNode) streakNode.textContent = streak + ' 天';
  const bar = document.getElementById('motivation-complete-bar');
  if (bar) bar.style.width = '0%';
  if (loadBar) loadBar.style.width = mistakesCount ? '30%' : '0%';
  if (loadValue) loadValue.textContent = mistakesCount ? '30%' : '--';
  if (loadStatus) loadStatus.textContent = mistakesCount ? '开始关注' : '等待学习';
}
refreshFirstUseStats();

async function requestMotivationAgent() {
  const complete = document.getElementById('motivation-complete')?.textContent || '80%';
  const reason = await callAgent('motivation',
    profileContext() + '\\n' +
    '今日完成度：' + complete + '\\n' +
    '连续学习：' + (Number(localStorage.getItem(STREAK_KEY) || 0)) + ' 天。\\n' +
    '待复盘错题：' + Object.keys(mistakeData).length + ' 道。\\n' +
    '今天主要高优先级任务：根据当前学生情况判断。\\n' +
    '请判断今天应该继续、维持还是收尾，并给出最小必要任务。'
  );
  motivationTitle.textContent = reason.split('\n')[0] || reason;
  motivationReason.textContent = reason;
  motivationStatus.textContent = reason.startsWith('建议：收尾') ? '建议收尾' : 'AI已重新评估';
}

document.getElementById('finish-one-task')?.addEventListener('click', async () => {
  if (motivationComplete) {
    motivationComplete.textContent = '100%';
    motivationBar.style.width = '100%';
  }
  try {
    await requestMotivationAgent();
    motivationStatus.classList.add('done');
    showToast('学习激励 Agent 已重新评估：今天可以收尾或维持');
  } catch (error) {
    showToast('学习负荷分析失败');
  }
});

document.getElementById('reduce-load')?.addEventListener('click', async () => {
  try {
    await requestMotivationAgent();
    showToast('AI 已重新安排今天的负担');
  } catch (error) {
    showToast('学习负荷分析失败');
  }
});


function parseProfileStateForDisplay() {
  const state = profile?.state || '';
  const evidence = document.getElementById('evidence-state');
  if (evidence) evidence.textContent = state ? state.slice(0, 70) + (state.length > 70 ? '…' : '') : '未填写';
}

function renderProfile() {
  const hasProfile = !!profile;
  const avatar = document.getElementById('student-avatar');
  const miniName = document.getElementById('student-name-mini');
  const miniSubject = document.getElementById('student-subject-mini');
  const profileAvatar = document.getElementById('profile-avatar');
  const profileTitle = document.getElementById('profile-title');
  const profileSummary = document.getElementById('profile-summary');
  const dashboardTitle = document.getElementById('dashboard-hero-title');
  const dashboardCopy = document.getElementById('dashboard-hero-copy');
  const dashboardScore = document.getElementById('dashboard-score');
  const scoreNote = document.getElementById('dashboard-score-note');
  const aiTitle = document.getElementById('dashboard-ai-title');
  const aiCopy = document.getElementById('dashboard-ai-copy');
  const planEvidence = document.getElementById('planner-evidence-text');

  if (!hasProfile) {
    if (avatar) avatar.textContent = '?';
    if (miniName) miniName.textContent = '首次使用';
    if (miniSubject) miniSubject.textContent = '请先完成学情设置';
    if (profileAvatar) profileAvatar.textContent = '?';
    if (profileTitle) profileTitle.textContent = '尚未建立学习画像';
    if (profileSummary) profileSummary.textContent = '请先填写你的基本信息、考试目标和当前学习情况。';
    if (dashboardTitle) dashboardTitle.innerHTML = '先建立你的学习画像';
    if (dashboardCopy) dashboardCopy.textContent = '第一次使用时，先告诉 AI 你的年级、学科、目标和当前学习情况，系统才能真正因材施教。';
    if (dashboardScore) dashboardScore.textContent = '--';
    if (scoreNote) scoreNote.textContent = '等待你的第一次学情输入';
    if (aiTitle) aiTitle.textContent = '完成首次学情设置后，我会给你第一条建议。';
    if (aiCopy) aiCopy.textContent = '你的学习数据将从真实填写、测试结果和后续答题记录开始累积。';
    if (planEvidence) planEvidence.textContent = '完成首次学情设置后，这里会显示 AI 可使用的学生信息。';
    const mastery = document.getElementById('mastery-list');
    if (mastery) mastery.innerHTML = '<div class="empty-state"><b>等待第一次学情诊断</b><p>填写当前学习情况后，AI 会在这里生成你的知识点掌握地图。</p></div>';
    return;
  }

  const initial = (profile.name || '?').slice(0, 1);
  const summary = [profile.grade, profile.subject].filter(Boolean).join(' · ');
  if (avatar) avatar.textContent = initial;
  if (miniName) miniName.textContent = profile.name;
  if (miniSubject) miniSubject.textContent = summary || '已建立画像';
  if (profileAvatar) profileAvatar.textContent = initial;
  if (profileTitle) profileTitle.textContent = profile.name + ' · ' + (profile.grade || '') + (profile.subject ? profile.subject : '');
  if (profileSummary) profileSummary.innerHTML = '最近考试 <b>' + (profile.score || '未填写') + '</b> 分 · 每日可用学习时间 <b>' + (profile.hours || '未填写') + ' 小时</b> · 目标 <b>' + (profile.goal || '未填写') + '</b>';
  if (dashboardTitle) dashboardTitle.innerHTML = '欢迎回来，<em>' + escapeHtml(profile.name) + '</em>';
  if (dashboardCopy) dashboardCopy.textContent = '这是你的第一次真实学习周期。先完成学情诊断，再让 Agent 决定接下来学什么。';
  if (dashboardScore) dashboardScore.textContent = profile.score ? profile.score + '分' : '--';
  if (scoreNote) scoreNote.textContent = profile.score ? '最近一次考试' : '暂无考试数据';
  if (aiTitle) aiTitle.textContent = '下一步：让 AI 先读懂你的学习情况。';
  if (aiCopy) aiCopy.textContent = '完成“AI重新诊断”后，系统会根据你的填写结果生成第一份学习建议。';
  if (planEvidence) planEvidence.textContent = profile.grade + ' · ' + profile.subject + ' · 目标 ' + profile.goal + ' · ' + profile.days + ' 天 · 每天 ' + profile.hours + ' 小时';
  document.getElementById('evidence-profile').textContent = profile.grade + ' · ' + profile.subject;
  document.getElementById('evidence-score').textContent = profile.score ? profile.score + ' 分' : '未填写';
  document.getElementById('evidence-goal').textContent = profile.goal || '未填写';
  document.getElementById('evidence-time').textContent = (profile.days || '未填写') + ' 天 · 每天 ' + (profile.hours || '未填写') + ' 小时';
  parseProfileStateForDisplay();
  const planGoalInput = document.getElementById('plan-goal');
  const planDaysInput = document.getElementById('plan-days');
  const planHoursInput = document.getElementById('plan-hours');
  if (planGoalInput && profile.goal) planGoalInput.value = profile.goal;
  if (planDaysInput && profile.days) planDaysInput.value = profile.days;
  if (planHoursInput && profile.hours) planHoursInput.value = profile.hours;
  const skillTopic = document.getElementById('skill-topic-title');
  if (skillTopic) skillTopic.textContent = profile.subject + ' · 等待 AI 诊断';
}

function bindOnboarding() {
  const form = document.getElementById('onboarding-form');
  const next = document.getElementById('onboarding-next');
  const back = document.getElementById('onboarding-back');
  const pages = [...document.querySelectorAll('[data-onboarding-page]')];
  const step = document.getElementById('onboarding-step');
  const title = document.getElementById('onboarding-title');
  const copy = document.getElementById('onboarding-copy');
  let page = 1;

  function showStep(n) {
    page = n;
    pages.forEach(x => x.classList.toggle('active', Number(x.dataset.onboardingPage) === n));
    if (step) step.textContent = '第 ' + n + ' / 2 步';
    if (title) title.textContent = n === 1 ? '先告诉我，你是谁' : '再告诉我，你想实现什么';
    if (copy) copy.textContent = n === 1
      ? '这些信息会成为你的第一份学习画像。可以随时修改。'
      : '没有预设答案，全部由你自己填写。系统会用这些信息生成第一次学习路径。';
  }

  next?.addEventListener('click', () => {
    const name = document.getElementById('profile-name')?.value.trim();
    const grade = document.getElementById('profile-grade')?.value.trim();
    const subject = document.getElementById('profile-subject')?.value.trim();
    if (!name || !grade || !subject) {
      showToast('先把姓名、年级和学科填完整');
      return;
    }
    showStep(2);
  });

  back?.addEventListener('click', () => showStep(1));

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const nextProfile = {
      name: document.getElementById('profile-name')?.value.trim(),
      grade: document.getElementById('profile-grade')?.value.trim(),
      subject: document.getElementById('profile-subject')?.value.trim(),
      score: document.getElementById('profile-score')?.value.trim(),
      goal: document.getElementById('profile-goal')?.value.trim(),
      days: document.getElementById('profile-days')?.value.trim(),
      hours: document.getElementById('profile-hours')?.value.trim(),
      state: document.getElementById('profile-state')?.value.trim(),
      createdAt: new Date().toISOString()
    };
    saveProfile(nextProfile);
    renderProfile();
    closeOnboarding();
    showToast('学习画像已建立，正在生成第一次学情诊断');
    showPage('analysis');
    setTimeout(() => runAnalysisAgent(), 180);
  });

  document.getElementById('edit-profile-btn')?.addEventListener('click', () => {
    if (profile) {
      for (const [id, key] of [
        ['profile-name','name'],['profile-grade','grade'],['profile-subject','subject'],
        ['profile-score','score'],['profile-goal','goal'],['profile-days','days'],
        ['profile-hours','hours'],['profile-state','state']
      ]) {
        const el = document.getElementById(id);
        if (el) el.value = profile[key] || '';
      }
    }
    openOnboarding();
  });
  document.getElementById('dashboard-profile-btn')?.addEventListener('click', openOnboarding);
}

function renderMistakeListFromStore() {
  const list = document.getElementById('mistake-list');
  const count = Object.keys(mistakeData).length;
  document.getElementById('mistake-stat-pending')?.replaceChildren(document.createTextNode(String(count)));
  document.getElementById('mistake-stat-repeat')?.replaceChildren(document.createTextNode('0'));
  document.getElementById('mistake-stat-retest')?.replaceChildren(document.createTextNode('0'));
  if (!list) return;
  const items = Object.values(mistakeData);
  if (!items.length) {
    list.innerHTML = '<div class="empty-state"><b>你的错题本还是空的</b><p>先去技能训练或答题。发生真实错误后，错题会自动进入这里。</p><button class="ghost-btn" data-go="skills">去做第一道题 →</button></div>';
    list.querySelector('[data-go]')?.addEventListener('click', () => showPage('skills'));
    return;
  }
  list.innerHTML = items.map(item => '<button class="mistake-item" data-mistake="' + item.id + '"><div><span class="pill danger">待复盘</span><small>' + escapeHtml(item.createdAt || '') + '</small></div><b>' + escapeHtml(item.title) + '</b><span>' + escapeHtml(item.type) + '</span></button>').join('');
  list.querySelectorAll('.mistake-item').forEach(item => item.addEventListener('click', () => {
    currentMistake = item.dataset.mistake;
    reviewStep = 1;
    renderMistake();
  }));
}

loadProfile();
bindOnboarding();
renderProfile();
renderMistakeListFromStore();
renderMistake();
renderSkillQuestion();

if (profile) {
  skillMastery = Number(profile.skillMastery || 0);
  if (profile.diagnosis) {
    setTimeout(() => {
      if (!dynamicSkillQuestion) requestDynamicSkillQuestion(false).catch(() => {});
    }, 250);
  }
} else {
  setTimeout(openOnboarding, 120);
}



