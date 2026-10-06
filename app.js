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
  if (raw && typeof raw === 'object') return raw;
  if (typeof raw !== 'string') {
    throw new Error('Agent 返回内容不是可解析的 JSON。');
  }

  const variants = [];
  const original = raw.trim();
  variants.push(original);
  variants.push(original.replace(/^\u0060\u0060\u0060json\s*/i, '').replace(/\s*\u0060\u0060\u0060$/i, '').trim());

  try {
    const quoted = JSON.parse(original);
    if (typeof quoted === 'string') variants.push(quoted.trim());
  } catch (_) {}

  for (const candidate of variants) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch (_) {}

    const start = candidate.indexOf('{');
    if (start < 0) continue;

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < candidate.length; i++) {
      const char = candidate[i];

      if (inString) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') inString = false;
        continue;
      }

      if (char === '"') inString = true;
      else if (char === '{') depth++;
      else if (char === '}') {
        depth--;
        if (depth === 0) {
          const fragment = candidate.slice(start, i + 1);
          try {
            const parsed = JSON.parse(fragment);
            if (parsed && typeof parsed === 'object') return parsed;
          } catch (_) {}
          break;
        }
      }
    }
  }

  throw new Error('Agent 返回的结构化结果无法解析。请重试；如果连续失败，检查后端是否已重启。');
}


function renderDiagnosisResult(data) {
  profile.diagnosis = data;
  profile.primaryTopic = data.priorities?.[0]?.name || '';
  profile.diagnosedAt = new Date().toISOString();
  saveProfile(profile);

  const diagnosisCard = document.getElementById('diagnosis-result-card');
  if (diagnosisCard) diagnosisCard.hidden = !profile.diagnosis;
  const diagnosisState = document.getElementById('profile-diagnosis-state');
  if (diagnosisState) {
    diagnosisState.textContent = profile.primaryTopic
      ? 'AI 已诊断 · 当前重点：' + profile.primaryTopic
      : 'AI 已完成第一版学习画像';
  }

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

  const resultCard = document.getElementById('diagnosis-result-card');
  const resultTitle = document.getElementById('diagnosis-result-title');
  const resultSummary = document.getElementById('diagnosis-result-summary');
  const resultPriorities = document.getElementById('diagnosis-result-priorities');
  const resultNext = document.getElementById('diagnosis-result-next');

  if (resultCard) resultCard.hidden = false;
  if (resultTitle) {
    resultTitle.textContent = (data.priorities || []).slice(0, 2).map(item => item.name).filter(Boolean).join(' + ') || '已建立第一版学习画像';
  }
  if (resultSummary) resultSummary.textContent = data.summary || 'AI 已完成第一版学习判断。';
  if (resultNext) resultNext.textContent = data.recommendedAction || '进入学习路径规划。';
  if (resultPriorities) {
    resultPriorities.innerHTML = (data.priorities || []).slice(0, 4).map(item =>
      '<span class="diagnosis-chip">' +
      escapeHtml(item.name || '知识点') + ' · ' +
      escapeHtml(item.priority || '待诊断') +
      '</span>'
    ).join('');
  }

  const skillTitle = document.getElementById('skill-topic-title');
  if (skillTitle && data.priorities?.[0]?.name) skillTitle.textContent = data.priorities[0].name + ' · AI训练';
  showToast('学情诊断已更新');
}

let analysisProgressTimer = null;

function startAnalysisProgress() {
  clearInterval(analysisProgressTimer);
  let value = 8;
  let step = 0;
  const messages = [
    '正在读取你的学情信息…',
    '正在判断哪些信息足够形成证据…',
    '正在排列当前干预优先级…',
    '正在形成你的第一份学习画像…'
  ];
  const bar = document.getElementById('analysis-progress-bar');
  const text = document.getElementById('analysis-progress-text');
  if (bar) {
    bar.style.width = value + '%';
    bar.classList.add('running');
    bar.classList.remove('failed');
  }
  if (text) text.textContent = messages[0];

  analysisProgressTimer = setInterval(() => {
    value = Math.min(88, value + 8);
    step = Math.min(messages.length - 1, step + 1);
    if (bar) bar.style.width = value + '%';
    if (text) text.textContent = messages[step];
  }, 1500);
}

function finishAnalysisProgress(success, message) {
  clearInterval(analysisProgressTimer);
  const bar = document.getElementById('analysis-progress-bar');
  const text = document.getElementById('analysis-progress-text');
  if (bar) {
    bar.style.width = success ? '100%' : '0%';
    bar.classList.remove('running');
    bar.classList.toggle('failed', !success);
  }
  if (text) text.textContent = message;
}

function buildFallbackDiagnosis() {
  const text = String(profile?.state || '');
  const priorities = [];

  if (/函数|一次函数|函数综合|反比例/.test(text)) {
    priorities.push({
      name: '函数综合应用',
      priority: /综合|经常|错误|不会/.test(text) ? '高' : '中',
      mastery: null,
      evidence: '来自学生自述中的函数相关困难；当前缺少足够测试数据，不虚构掌握度。'
    });
  }

  if (/几何|证明|三角形|辅助线/.test(text)) {
    priorities.push({
      name: '几何证明',
      priority: /证明|不知道|不会|经常/.test(text) ? '高' : '中',
      mastery: null,
      evidence: '来自学生自述中的几何/证明困难；当前缺少足够测试数据，不虚构掌握度。'
    });
  }

  if (!priorities.length) {
    priorities.push({
      name: profile?.subject || '当前学科',
      priority: '待诊断',
      mastery: null,
      evidence: '首次使用数据不足，先通过技能训练收集真实表现。'
    });
  }

  return {
    summary: '当前先依据你主动填写的学习情况建立第一版学习画像；正式掌握度会随着测试和训练数据逐步修正。',
    priorities,
    recommendedAction: '先完成技能训练，收集真实答题表现，再动态更新知识点掌握度。'
  };
}

async function runAnalysisAgent() {
  if (!profile) {
    openOnboarding();
    showToast('先完成首次学情设置');
    return;
  }

  if (analysisAgentButton) {
    analysisAgentButton.disabled = true;
    analysisAgentButton.textContent = 'AI分析中…';
  }

  startAnalysisProgress();

  try {
    const answer = await callAgent('analysis', profileContext() + '\\n请完成第一次学情诊断。');
    renderDiagnosisResult(parseAgentJson(answer));
    renderProfile();
    finishAnalysisProgress(true, '诊断完成：学习画像已更新');
    showToast('学情画像已更新');
  } catch (error) {
    const fallback = buildFallbackDiagnosis();
    renderDiagnosisResult(fallback);
    const resultNode = document.getElementById('analysis-agent-result');
    if (resultNode) {
      resultNode.innerHTML =
        '<b>第一版画像已建立：</b>真实 Agent 本次未完成。' +
        '<br><span>原因：' + escapeHtml(error.message) + '</span>';
    }
    finishAnalysisProgress(true, '已建立第一版画像 · 等待后续真实训练校正');
    showToast('AI暂不可用，已用你的真实填写建立第一版画像');
  } finally {
    if (analysisAgentButton) {
      analysisAgentButton.disabled = false;
      analysisAgentButton.textContent = 'AI重新诊断';
    }
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

function buildLocalPlan(days, minutes, goal) {
  let priorities = Array.isArray(profile?.diagnosis?.priorities)
    ? profile.diagnosis.priorities
    : [];

  if (!priorities.length) {
    const stateText = String(profile?.state || '');
    priorities = [];
    if (/函数|一次函数|函数综合/.test(stateText)) {
      priorities.push({ name: '函数综合应用', priority: '高', evidence: '来自学生自述的函数综合题困难。' });
    }
    if (/几何|证明|三角形|辅助线/.test(stateText)) {
      priorities.push({ name: '几何证明', priority: '高', evidence: '来自学生自述的几何证明困难。' });
    }
  }

  const first = priorities[0]?.name || profile?.primaryTopic || profile?.subject || '当前薄弱知识点';
  const second = priorities[1]?.name || '综合应用';
  const stable = priorities[2]?.name || '待诊断';
  const stageCount = days <= 7 ? 2 : days <= 14 ? 3 : 4;
  const daily = Math.max(30, minutes);

  const stages = [
    { week: '第1阶段', focus: first + ' · 基础补强', goal: '补齐核心概念与典型方法', minutesPerDay: Math.round(daily * 0.3), reason: '先处理当前最高优先级问题。' },
    { week: '第2阶段', focus: first + ' · 综合应用', goal: '从基础题过渡到中等和综合题', minutesPerDay: Math.round(daily * 0.3), reason: '减少重复基础题，进入真正薄弱的应用环节。' },
    { week: '第3阶段', focus: second + ' · 专项训练', goal: '集中解决第二优先级知识点', minutesPerDay: Math.round(daily * 0.25), reason: '第一重点稳定后继续补强第二重点。' },
    { week: '第4阶段', focus: '综合训练 + 错题复习', goal: '检验迁移能力并回收重复错误', minutesPerDay: Math.round(daily * 0.15), reason: '最后阶段用于整合与掌握检验。' }
  ].slice(0, stageCount);

  return {
    title: days + ' 天 · ' + goal,
    highestPriority: first,
    secondPriority: second,
    stable,
    dailyMinutes: daily,
    weeks: stages,
    adjustment: '每 3 天根据正确率、错题复发和完成率重新调整下一阶段。'
  };
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

  const weekPlanContainer = document.getElementById('week-plan');
  if (weekPlanContainer) {
    weekPlanContainer.innerHTML =
      '<div class="empty-state plan-generating"><b>AI 正在生成你的学习路径…</b><p>正在综合学情、薄弱知识点、考试目标与每日学习时间。</p></div>';
  }
  const currentScrollTop = window.scrollY;

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
    window.scrollTo({ top: currentScrollTop, behavior: 'auto' });
    finishPlanProgress(true, '规划完成：已生成可执行学习阶段');
    showToast('学习路径 Agent 已完成重新规划');
  } catch (error) {
    const fallback = buildLocalPlan(days, minutes, goal);
    renderPlanResult(fallback, days, minutes);
    if (status) status.textContent = '真实 Agent 本次失败 · 已生成保底路径';
    window.scrollTo({ top: currentScrollTop, behavior: 'auto' });
    if (result) {
      result.textContent =
        '真实 Agent 没有完成本次规划；保底路径已经根据你的学情、目标和时间约束生成。';
    }
    const detail = document.getElementById('plan-agent-error');
    const detailText = document.getElementById('plan-agent-error-text');
    if (detail && detailText) {
      detail.hidden = false;
      detailText.textContent = error.message;
    }
    finishPlanProgress(true, '已生成保底路径 · 可查看本次 AI 请求错误');
    showToast('本次 AI 规划失败，已保留可执行路径');
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
    type.textContent = '暂无';
    question.textContent = '完成一道练习并出现真实错误后，这里会显示原题。';
    stageTitle.textContent = '等待真实错题';
    stageText.textContent = '先完成一道练习。系统会从你的实际错误开始复盘，而不是预置示例。';
    status.textContent = '暂无错题';
    const aiButton = document.getElementById('ai-review-start');
    if (aiButton) aiButton.disabled = true;
    return;
  }

  const aiButton = document.getElementById('ai-review-start');
  if (aiButton) aiButton.disabled = false;

  title.textContent = data.title || '错题';
  type.textContent = data.errorType || data.error || data.type || '待分析';
  question.textContent = data.question || '';
  if (pill) pill.textContent = reviewStep >= 5 ? '准备再测' : '尚未通过';

  document.querySelectorAll('.mistake-item').forEach(item => {
    item.classList.toggle('active', item.dataset.mistake === currentMistake);
  });

  document.querySelectorAll('.review-step').forEach(node => {
    const n = Number(node.dataset.reviewStep);
    node.classList.toggle('active', n <= reviewStep);
    node.classList.toggle('current', n === reviewStep);
  });

  const stages = [
    ['先找出你为什么错', '<b>错误原因</b>：' + escapeHtml(data.reason || '等待 AI 分析') + '<br><b>证据</b>：' + escapeHtml(data.evidence || '等待 AI 分析')],
    ['定位真正薄弱的知识点', '<b>核心知识点</b>：' + escapeHtml(data.knowledge || '等待 AI 定位') + '<br><span>后续训练会围绕这个知识点生成，不再泛泛刷题。</span>'],
    ['给这次错误贴上“可追踪”的标签', '<b>错误类型</b>：' + escapeHtml(data.errorType || data.error || '待判断')],
    ['从简单到综合重新练一遍', '<b>基础同类题</b>：' + escapeHtml(data.basic || 'AI 将生成') + '<br><b>变式题</b>：' + escapeHtml(data.variant || 'AI 将生成') + '<br><b>综合题</b>：' + escapeHtml(data.comprehensive || 'AI 将生成')],
    ['检查是否真正掌握', '<b>掌握检验</b>：' + escapeHtml(data.masteryCheck || '先完成不同题型的新题，再进行间隔复测。')]
  ];

  const stage = stages[reviewStep - 1];
  stageTitle.textContent = stage[0];
  stageText.innerHTML = stage[1];
  status.textContent = '第 ' + reviewStep + '/5 步 · ' + (reviewStep === 5 ? '掌握检验' : '复盘中');
  next.textContent = reviewStep === 5 ? '完成复盘' : '下一步 →';

  renderReviewAction(data);
}

function renderReviewAction(data) {
  const area = document.getElementById('review-action-area');
  if (!area) return;

  if (reviewStep === 1) {
    area.innerHTML =
      '<div class="review-question"><b>先确认：这个诊断是否符合你的真实情况？</b><p>选择最接近你的原因，帮助 Agent 校正后续训练。</p></div>' +
      '<div class="review-options">' +
      ['我没理解概念','我没抓住题目条件','我知道条件但不会组织思路','计算或代入出错'].map(x =>
        '<button type="button" data-review-answer="' + escapeHtml(x) + '">' + escapeHtml(x) + '</button>'
      ).join('') +
      '</div>';
  } else if (reviewStep === 2) {
    area.innerHTML =
      '<div class="review-question"><b>第二步：锁定知识点</b><p>后续题目会围绕这个知识点，而不是继续刷泛题。</p></div>' +
      '<div class="review-answer-card"><strong>' + escapeHtml(data.knowledge || '等待 AI 定位') + '</strong><small>' +
      escapeHtml(data.evidence || '等待更多证据') + '</small></div>';
  } else if (reviewStep === 3) {
    area.innerHTML =
      '<div class="review-question"><b>第三步：记录错误类型</b><p>错误类型会进入你的学习画像，用于调整下一次训练。</p></div>' +
      '<div class="review-answer-card"><strong>' + escapeHtml(data.errorType || data.error || '待判断') + '</strong><small>' +
      escapeHtml(data.reason || '等待 AI 给出错因') + '</small></div>';
  } else if (reviewStep === 4) {
    area.innerHTML =
      '<div class="training-ladder">' +
      '<div class="training-card"><span>① 基础同类题</span><b>' + escapeHtml(data.basic || 'AI 将生成') + '</b></div>' +
      '<div class="training-card"><span>② 真变式</span><b>' + escapeHtml(data.variant || 'AI 将改变条件或解题入口') + '</b></div>' +
      '<div class="training-card"><span>③ 综合题</span><b>' + escapeHtml(data.comprehensive || 'AI 将增加多条件整合') + '</b></div>' +
      '</div>';
  } else {
    area.innerHTML =
      '<div class="mastery-test"><span>掌握检验</span><b>' +
      escapeHtml(data.masteryCheck || '完成不同形式的新题后，再判断是否真正掌握。') +
      '</b><div class="mastery-meter"><i style="width:72%"></i></div><small>通过一次不代表掌握，必须在不同题型上稳定表现。</small></div>';
  }

  area.querySelectorAll('[data-review-answer]').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedReviewAnswer = btn.dataset.reviewAnswer;
      area.querySelectorAll('[data-review-answer]').forEach(x => x.classList.remove('selected'));
      btn.classList.add('selected');
      showToast('已记录：' + selectedReviewAnswer);
    });
  });
}


document.querySelectorAll('.mistake-item').forEach(item => item.addEventListener('click', () => {
  currentMistake = item.dataset.mistake;
  reviewStep = 1;
  selectedReviewAnswer = '';
  renderMistake();
}));

document.getElementById('review-next')?.addEventListener('click', async () => {
  if (!currentMistake) {
    showToast('先完成一道真实错题');
    return;
  }

  const data = mistakeData[currentMistake];
  if (!data) return;

  if (reviewStep === 5) {
    showToast('复盘完成，已进入再测队列');
    reviewStep = 1;
    renderMistake();
    return;
  }

  reviewStep += 1;
  renderMistake();

  try {
    const raw = await callAgent('mistake',
      '错题标题：' + data.title + '\n' +
      '原错题：' + data.question + '\n' +
      '学生选择：' + (data.chosen || '') + '\n' +
      '错误原因线索：' + (data.reason || '') + '\n' +
      '知识点：' + (data.knowledge || '') + '\n' +
      '错误类型：' + (data.error || '') + '\n' +
      '当前复盘阶段：第 ' + reviewStep + '/5。\n' +
      '请返回完整 JSON，字段：reason,knowledge,errorType,evidence,basic,variant,comprehensive,masteryCheck。'
    );
    const parsed = parseAgentJson(raw);
    Object.assign(data, parsed);
    data.error = parsed.errorType || data.error;
    mistakeData[currentMistake] = data;
    saveMistakes();
    renderMistake();
  } catch (error) {
    const stageText = document.getElementById('review-stage-text');
    if (stageText) {
      stageText.innerHTML = '<b>本阶段先使用已有诊断</b><br>' + escapeHtml(error.message);
    }
  }
});


renderMistake();


const skillQuestions = [
  {level:'基础题',label:'基础训练',question:'已知一次函数 y = 2x + 3，当 x = 1 时，y = ?',options:{A:'3',B:'5',C:'6',D:'8'},answer:'B',explanation:'把 x = 1 代入解析式。'},
  {level:'中等题',label:'中等应用',question:'一次函数 y = 2x + b 经过点（1，4），求 b。',options:{A:'1',B:'2',C:'3',D:'4'},answer:'B',explanation:'把已知点代入解析式。'},
  {level:'综合题',label:'综合应用',question:'一次函数 y = kx + b 经过 A(1,3)、B(3,7)，求其 x 轴截距。',options:{A:'1',B:'-1/2',C:'2',D:'3'},answer:'B',explanation:'先由两点求 k、b，再令 y=0。'},
  {level:'变式题',label:'迁移变式',question:'某一次函数经过点 A(2,0)，且图象与两坐标轴围成的三角形面积为4。若 x 轴截距固定为2，求所有可能的 y 轴截距，并说明为什么可能有两个解。',options:{A:'1',B:'2',C:'±2',D:'4'},answer:'C',explanation:'从直接求参数变为由几何面积反推参数并处理多解。'}
];
let skillLevelIndex = 0;
let skillQuestionNo = 0;
let skillStreak = 0;
let skillMastery = Number(profile?.skillMastery || 0);
let selectedSkillOption = '';
let dynamicSkillQuestion = null;
let skillAnswered = false;
let skillAnswerCorrect = null;
let skillHistory = JSON.parse(localStorage.getItem('yincaiSkillHistory') || '[]');

function normalizeQuestionKey(question) {
  return String(question || '').replace(/\s+/g,'').replace(/[，。！？；：、（）()]/g,'').toLowerCase();
}
function saveSkillHistory() {
  localStorage.setItem('yincaiSkillHistory', JSON.stringify(skillHistory.slice(-12)));
}
function isDuplicateQuestion(question) {
  const key = normalizeQuestionKey(question);
  return !!key && skillHistory.some(item => normalizeQuestionKey(item.question) === key);
}

function renderSkillHistory() {
  const list = document.getElementById('skill-history-list');
  if (!list) return;
  if (!skillHistory.length) {
    list.innerHTML='<div class="empty-state"><b>还没有完成的题目</b><p>提交题目后会保留在这里，可随时回看。</p></div>';
    return;
  }
  list.innerHTML=skillHistory.slice().reverse().map((item,reverseIndex)=>{
    const idx=skillHistory.length-1-reverseIndex;
    return '<button type="button" class="skill-history-item" data-skill-history-index="'+idx+'"><div><span class="pill">'+escapeHtml(item.level||'训练题')+'</span><small>第 '+(idx+1)+' 题</small></div><b>'+escapeHtml(item.question)+'</b><span class="'+(item.correct?'history-correct':'history-wrong')+'">'+(item.skipped?'已标记不会':item.correct?'答对':'答错')+'</span></button>';
  }).join('');
  list.querySelectorAll('[data-skill-history-index]').forEach(btn=>btn.addEventListener('click',()=>{
    const item=skillHistory[Number(btn.dataset.skillHistoryIndex)];
    if(!item) return;
    dynamicSkillQuestion=item;
    skillAnswered=true;
    selectedSkillOption=item.chosen||'';
    renderSkillQuestion();
    const feedback=document.getElementById('skill-feedback');
    if(feedback){feedback.className=item.correct?'skill-feedback correct':'skill-feedback wrong';feedback.innerHTML='<span>第 '+(Number(btn.dataset.skillHistoryIndex)+1)+' 题回看</span><p>你的选择：'+escapeHtml(item.chosen||'未作答')+' · 正确答案：'+escapeHtml(item.answer||'')+'<br>'+escapeHtml(item.explanation||'')+'</p>';}
  }));
}

function parseSkillQuestion(raw) {
  let parsed=null;
  try {
    const start=raw.indexOf('{'), end=raw.lastIndexOf('}');
    if(start>=0&&end>start) parsed=JSON.parse(raw.slice(start,end+1));
  } catch(_) {}
  if(!parsed||!parsed.question||!parsed.options||!parsed.answer) return null;
  if(!['A','B','C','D'].every(k=>parsed.options[k])) return null;
  if(!['A','B','C','D'].includes(parsed.answer)) return null;
  const text=(parsed.question+' '+(parsed.explanation||'')).toLowerCase();
  if(parsed.level==='变式题' && !/(变式|迁移|反推|改变|不同|多解|情境|综合|证明)/.test(text)) return null;
  return {level:parsed.level||'综合题',label:parsed.label||'综合应用',question:parsed.question,options:parsed.options,answer:parsed.answer,explanation:parsed.explanation||''};
}

function renderSkillQuestion() {
  const q=dynamicSkillQuestion;
  const submit=document.getElementById('skill-submit');
  const skip=document.getElementById('skill-skip');
  const nextButton=document.getElementById('skill-next');
  const options=document.getElementById('skill-options');
  if(!options) return;
  if(!q){
    document.getElementById('skill-level-title').textContent='等待生成';
    document.getElementById('skill-level-pill').textContent='未开始';
    document.getElementById('skill-question-text').textContent=profile?'点击“开始训练”生成第一道题。':'先完成学情设置和 AI 诊断。';
    document.getElementById('skill-question-no').textContent=String(skillQuestionNo);
    document.getElementById('skill-current-level').textContent='未开始';
    document.getElementById('skill-next-level').textContent='等待表现';
    document.getElementById('skill-mastery').textContent=skillMastery+'%';
    options.innerHTML='<div class="empty-state"><b>等待 AI 出题</b><p>不会自动跳题，点击“开始训练”或“下一题”后才生成。</p></div>';
    if(submit) submit.disabled=true;
    if(skip) skip.disabled=true;
    if(nextButton){nextButton.hidden=!profile;nextButton.disabled=false;nextButton.textContent=skillQuestionNo?'下一题':'开始训练';}
    return;
  }
  document.getElementById('skill-level-title').textContent=q.level||'训练题';
  document.getElementById('skill-level-pill').textContent=q.label||'AI训练';
  document.getElementById('skill-question-text').textContent=q.question||'';
  document.getElementById('skill-question-no').textContent=String(skillQuestionNo);
  document.getElementById('skill-current-level').textContent=q.level||'训练题';
  document.getElementById('skill-mastery').textContent=skillMastery+'%';
  document.getElementById('skill-decision-pill').textContent=skillAnswered?'本题已完成':'正在训练 · '+(q.level||'训练题');
  document.getElementById('skill-decision-text').textContent=skillAnswered?'当前题目已保留。你可以回看后再进入下一题。':'Agent 会根据最近表现决定下一题难度，不会自动跳走。';
  document.getElementById('skill-next-level').textContent=skillAnswered?'下一题将综合最新表现':['基础题','中等题','综合题','变式题'][Math.min(3,skillLevelIndex+1)];
  options.innerHTML=Object.entries(q.options||{}).map(([k,v])=>'<button type="button" data-skill-option="'+escapeHtml(k)+'"'+(skillAnswered?' disabled':'')+'>'+escapeHtml(k+'. '+v)+'</button>').join('');
  if(!skillAnswered){options.querySelectorAll('[data-skill-option]').forEach(btn=>btn.addEventListener('click',()=>{selectedSkillOption=btn.dataset.skillOption;options.querySelectorAll('button').forEach(x=>x.classList.remove('selected'));btn.classList.add('selected');}));}
  if(submit) submit.disabled=skillAnswered;
  if(skip) skip.disabled=skillAnswered;
  if(nextButton){nextButton.hidden=!skillAnswered;nextButton.disabled=false;nextButton.textContent='下一题';}
}

async function requestDynamicSkillQuestion(lastCorrect) {
  if(!profile?.diagnosis){renderSkillQuestion();return;}
  const seen=skillHistory.slice(-10).map(x=>x.question).filter(Boolean);
  const target=['基础题','中等题','综合题','变式题'][skillLevelIndex]||'综合题';
  const prompt=profileContext()+'\\n当前重点知识点：'+(profile.primaryTopic||profile.subject)+'。\\n目标难度：'+target+'。\\n连续答对：'+skillStreak+'。\\n上一题是否答对：'+(lastCorrect==null?'暂无':lastCorrect?'是':'否')+'。\\n已做题目（严禁重复）：\\n- '+(seen.join('\\n- ')||'无')+'\\n硬性要求：新题与任何已做题的题干、数值结构和解法入口都不得重复；变式题必须真正改变条件或解题入口。';
  const raw=await callAgent('skill',prompt);
  const parsed=parseSkillQuestion(raw);
  if(!parsed) throw new Error('Agent 没有返回符合规则的新题。');
  if(isDuplicateQuestion(parsed.question)) throw new Error('Agent 生成了重复题目，已拦截，没有覆盖上一题。');
  dynamicSkillQuestion=parsed;
  skillQuestionNo+=1;
  const levels={'基础题':0,'中等题':1,'综合题':2,'变式题':3};
  if(levels[parsed.level]!==undefined) skillLevelIndex=levels[parsed.level];
  skillAnswered=false;skillAnswerCorrect=null;selectedSkillOption='';
  renderSkillQuestion();
  const feedback=document.getElementById('skill-feedback');
  if(feedback){feedback.className='skill-feedback';feedback.innerHTML='<span>AI 已生成下一题</span><p>'+escapeHtml(parsed.explanation||'难度已根据你的表现调整。')+'</p>';}
}

function saveSkillAttempt(q,chosen,correct,skipped){
  skillHistory.push({level:q.level,question:q.question,options:q.options,answer:q.answer,chosen:chosen||'',correct:!!correct,skipped:!!skipped,explanation:q.explanation||'',createdAt:new Date().toISOString()});
  saveSkillHistory();
  renderSkillHistory();
}

function evaluateSkillAnswer(correct){
  const q=dynamicSkillQuestion;if(!q)return;
  const chosen=selectedSkillOption;
  if(correct){skillStreak+=1;skillMastery=Math.min(100,skillMastery+8);if(skillStreak>=2&&skillLevelIndex<3)skillLevelIndex+=1;}
  else{skillStreak=0;skillMastery=Math.max(0,skillMastery-5);if(skillLevelIndex>0)skillLevelIndex-=1;}
  if(profile){profile.skillMastery=skillMastery;saveProfile(profile);}
  saveSkillAttempt(q,chosen,correct,false);
  skillAnswered=true;skillAnswerCorrect=correct;
  document.getElementById('skill-result-title').textContent=correct?'本题答对 · 回看后再进入下一题':'本题答错 · 当前题目已保留';
  const feedback=document.getElementById('skill-feedback');
  if(feedback){feedback.className=correct?'skill-feedback correct':'skill-feedback wrong';feedback.innerHTML='<span>'+(correct?'回答正确':'出现卡点')+'</span><p>'+escapeHtml(correct?(q.explanation||'下一题会根据你的表现调整。'):('正确答案是 '+q.answer+'。建议先回看这道题，再决定是否进入下一题。'))+'</p>';}
  renderSkillQuestion();renderSkillHistory();
}

async function analyzeSkillMistake(q,chosen,mistakeId){
  const raw=await callAgent('mistake',profileContext()+'\\n刚刚技能训练题：'+q.question+'\\n正确答案：'+q.answer+'\\n学生选择：'+chosen+'\\n请返回结构化 JSON，字段：reason,knowledge,errorType,evidence,basic,variant,comprehensive,masteryCheck。');
  const data=parseAgentJson(raw);
  if(mistakeData[mistakeId]){Object.assign(mistakeData[mistakeId],data);mistakeData[mistakeId].error=data.errorType||'答题错误';saveMistakes();renderMistakeListFromStore();renderMistake();}
  const feedback=document.getElementById('skill-feedback');
  if(feedback){feedback.innerHTML='<span>AI 已定位这次错误</span><p><b>'+escapeHtml(data.knowledge||'知识点待诊断')+'</b><br>'+escapeHtml(data.reason||'错因待诊断')+'</p>';}
}

document.getElementById('skill-submit')?.addEventListener('click',async()=>{
  const q=dynamicSkillQuestion;if(!q||skillAnswered)return;
  if(!selectedSkillOption){showToast('先选择一个答案');return;}
  const chosen=selectedSkillOption,correct=chosen===q.answer;
  let mistakeId=null;
  if(!correct){
    mistakeId='mistake-'+Date.now();
    mistakeData[mistakeId]={id:mistakeId,title:q.level+' · '+(profile?.primaryTopic||profile?.subject||'技能训练'),type:'技能训练错误',question:q.question,reason:'AI 正在分析',knowledge:'AI 正在定位',error:'答题错误',basic:'等待 AI 生成',variant:'等待 AI 生成',comprehensive:'等待 AI 生成',masteryCheck:'等待 AI 生成',createdAt:new Date().toLocaleString()};
    saveMistakes();currentMistake=mistakeId;renderMistakeListFromStore();
  }
  evaluateSkillAnswer(correct);
  if(!correct&&mistakeId){try{await analyzeSkillMistake(q,chosen,mistakeId);}catch(error){showToast('错题已保存，AI 错因分析稍后可重试');}}
});

document.getElementById('skill-next')?.addEventListener('click',async()=>{
  if(!skillAnswered)return;
  const last=skillAnswerCorrect;
  dynamicSkillQuestion=null;skillAnswered=false;selectedSkillOption='';
  const nextButton=document.getElementById('skill-next');if(nextButton)nextButton.disabled=true;
  try{await requestDynamicSkillQuestion(last);}catch(error){
    dynamicSkillQuestion=null;skillAnswered=false;
    const feedback=document.getElementById('skill-feedback');
    if(feedback){feedback.className='skill-feedback wrong';feedback.innerHTML='<span>下一题暂时无法生成</span><p>'+escapeHtml(error.message)+'。当前题目和历史记录都已保留，你可以稍后重试。</p>';}
    renderSkillQuestion();
  }finally{if(nextButton)nextButton.disabled=false;}
});

document.getElementById('skill-skip')?.addEventListener('click',()=>{
  const q=dynamicSkillQuestion;if(!q||skillAnswered)return;
  skillStreak=0;skillMastery=Math.max(0,skillMastery-3);if(skillLevelIndex>0)skillLevelIndex-=1;
  saveSkillAttempt(q,'',false,true);skillAnswered=true;skillAnswerCorrect=false;
  if(profile){profile.skillMastery=skillMastery;saveProfile(profile);}
  const feedback=document.getElementById('skill-feedback');
  if(feedback){feedback.className='skill-feedback wrong';feedback.innerHTML='<span>已记录“这题我不会”</span><p>题目不会消失，可以回看后再点击“下一题”。</p>';}
  renderSkillQuestion();
});

renderSkillHistory();renderSkillQuestion();

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
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 75000);

  try {
    response = await fetch(AGENT_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent, context }),
      signal: controller.signal
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Agent 请求超过 75 秒仍未完成。请确认后端已重新启动，并检查 DeepSeek 接口状态。');
    }
    throw new Error('无法连接学习 Agent 后端（127.0.0.1:8080）。请确认 Spring Boot 已重新启动。');
  } finally {
    clearTimeout(timeoutId);
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
  if (!data) {
    showToast('先选择一道错题');
    return;
  }

  aiReviewStart.disabled = true;
  aiReviewStart.textContent = 'AI分析中…';

  try {
    const raw = await callAgent('mistake',
      '错题标题：' + data.title + '\n' +
      '原错题：' + data.question + '\n' +
      '学生选择：' + (data.chosen || '') + '\n' +
      '请返回结构化 JSON，字段：reason,knowledge,errorType,evidence,basic,variant,comprehensive,masteryCheck。'
    );
    const parsed = parseAgentJson(raw);
    Object.assign(data, parsed);
    data.error = parsed.errorType || data.error;
    mistakeData[currentMistake] = data;
    saveMistakes();
    renderMistake();
    showToast('错题分析完成');
  } catch (error) {
    const stageText = document.getElementById('review-stage-text');
    if (stageText) stageText.innerHTML = '<b>分析失败</b><br>' + escapeHtml(error.message);
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
  const diagnosisState = document.getElementById('profile-diagnosis-state');
  if (diagnosisState) {
    diagnosisState.textContent = profile.diagnosis
      ? (profile.primaryTopic ? 'AI 已诊断 · 当前重点：' + profile.primaryTopic : 'AI 已完成第一版学习画像')
      : '尚未完成 AI 学情诊断';
  }
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
    }, 250);
  }
} else {
  setTimeout(openOnboarding, 120);
}



