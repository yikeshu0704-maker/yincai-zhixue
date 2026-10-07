const API_ORIGIN = window.YincaiConfig?.apiOrigin || 'http://127.0.0.1:8080';
const CHAT_API_URL = API_ORIGIN + '/api/chat';
const AGENT_API_URL = API_ORIGIN + '/api/agent';
const HEALTH_API_URL = API_ORIGIN + '/api/health';

// 顶部 AI 服务状态由真实健康检查驱动，绝不写死。
async function checkBackendHealth() {
  const status = document.getElementById('backend-status');
  if (!status) return;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(HEALTH_API_URL, { method: 'GET', signal: controller.signal });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    status.className = 'backend-status online';
    status.innerHTML = '<i></i>DeepSeek AI · 在线';
  } catch (error) {
    status.className = 'backend-status offline';
    status.innerHTML = '<i></i>AI服务离线 · 核心功能可用';
  } finally {
    clearTimeout(timeoutId);
  }
}
checkBackendHealth();
setInterval(checkBackendHealth, 30000);

const PROFILE_KEY = 'yincaiProfile';
const TASK_KEY = 'yincaiTasks';
const STREAK_KEY = 'yincaiStreak';
const DATA_VERSION = '2026-10-07-question-bank-3000-v2';
const PROFILE_RESET_VERSION = '2026-10-07-profile-reset-v1';

/*
 * 仅执行一次用户明确要求的“清空当前旧学情”。
 * 后续代码版本更新不会自动删除学生数据；今后清空必须通过“清空学情数据”按钮。
 */
if (localStorage.getItem('yincaiDataVersion') !== DATA_VERSION) {
  localStorage.setItem('yincaiDataVersion', DATA_VERSION);
}
if (localStorage.getItem('yincaiProfileResetVersion') !== PROFILE_RESET_VERSION) {
  ['yincaiProfile', 'yincaiTasks', 'yincaiStreak', 'yincaiMistakes', 'yincaiSkillHistory'].forEach((key) => {
    localStorage.removeItem(key);
  });
  localStorage.setItem('yincaiProfileResetVersion', PROFILE_RESET_VERSION);
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

function localDateKey(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function saveProfile(nextProfile) {
  profile = nextProfile;
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

function clearStudentData() {
  [
    PROFILE_KEY,
    TASK_KEY,
    STREAK_KEY,
    'yincaiMistakes',
    'yincaiSkillHistory',
    'yincaiDataVersion'
  ].forEach((key) => localStorage.removeItem(key));

  localStorage.setItem('yincaiDataVersion', DATA_VERSION);
  localStorage.setItem('yincaiProfileResetVersion', PROFILE_RESET_VERSION);
}

function resetOnboardingForm() {
  const form = document.getElementById('onboarding-form');
  if (form) form.reset();
  document.querySelectorAll('[data-onboarding-page]').forEach(page => page.classList.toggle('active', page.dataset.onboardingPage === '1'));
  const step = document.getElementById('onboarding-step');
  const title = document.getElementById('onboarding-title');
  const copy = document.getElementById('onboarding-copy');
  if (step) step.textContent = '第 1 / 2 步';
  if (title) title.textContent = '先告诉我，你是谁';
  if (copy) copy.textContent = '这些信息会成为你的第一份学习画像。可以随时修改。';
}

function handleClearStudentData() {
  const confirmed = window.confirm('确定清空全部学情数据吗？\n\n将删除学生画像、诊断结果、训练记录、错题和连续学习记录。此操作不可撤销。');
  if (!confirmed) return;

  clearStudentData();
  window.location.reload();
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
  ].join('\n');
}

function openOnboarding() {
  const modal = document.getElementById('onboarding-backdrop');
  if (!profile) resetOnboardingForm();
  if (modal) modal.classList.add('show');
}

function closeOnboarding() {
  const modal = document.getElementById('onboarding-backdrop');
  if (modal) modal.classList.remove('show');
}


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
  const page = document.getElementById(id);
  if (!page || !page.classList.contains('page')) {
    showToast('页面暂不可用：' + String(id || '未知页面'));
    return false;
  }
  pages.forEach((item) => item.classList.toggle('active-page', item === page));
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.classList.toggle('active', item.dataset.page === id);
  });
  const titleNode = document.getElementById('page-title');
  if (titleNode) titleNode.textContent = titleMap[id] || '因材智学';
  if (typeof window.scrollTo === 'function') {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
  return true;
}

// 事件委托：静态和动态生成的导航/跳转按钮都由同一处处理。
document.querySelector('.nav')?.addEventListener('click', (event) => {
  const item = event.target.closest('.nav-item');
  if (item) showPage(item.dataset.page);
});

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-go]');
  if (button) {
    event.preventDefault();
    showPage(button.dataset.go);
  }
});

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
  const chatController = new AbortController();
  const chatTimeoutId = setTimeout(() => chatController.abort(), 25000);
  try {
    const response = await fetch(CHAT_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: profile ? (profileContext() + '\n学生当前问题：' + text) : text,
        imageData: sentImage?.data || null,
        imageMimeType: sentImage?.mimeType || null
      }),
      signal: chatController.signal
    });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data = await response.json();
    const answer = data.answer || '（后端返回内容为空，请稍后再试）';
    pending.querySelector('p').classList.add('ai-rich-text');
    pending.querySelector('p').innerHTML = renderAiMarkdown(answer);
    pending.querySelector('small').textContent = sentImage ? '来自 DeepSeek 多模态答疑' : '来自 DeepSeek 答疑';
    qaTurnCount += 1;
    renderTutorStage(answer, text || '请帮我看这道题。');
    renderReport();
  } catch (error) {
    const reason = error.name === 'AbortError'
      ? 'AI 请求超过 25 秒仍未完成，请重新发送一次。'
      : '暂时无法完成答疑。请确认 Spring Boot 后端运行在 localhost:8080，且 DeepSeek API 可用。';
    pending.querySelector('p').textContent = reason;
    pending.querySelector('small').textContent = '连接失败 · ' + (error.name === 'AbortError' ? '请求超时' : error.message);
  } finally {
    clearTimeout(chatTimeoutId);
  }
  chatPending = false;
  chatLog.scrollTop = chatLog.scrollHeight;
});

function escapeHtml(value) {
  const text = value == null ? '' : String(value);
  return text.replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
}

function renderAiMarkdown(value) {
  const escaped = escapeHtml(String(value == null ? '' : value)).replace(/\r\n?/g, '\n');
  const lines = escaped.split('\n');
  const out = [];
  let inList = false;
  const closeList = () => {
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
  };
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      closeList();
      out.push('<div class="ai-md-gap"></div>');
      continue;
    }
    if (/^---+$/.test(trimmed) || /^\*\*\*+$/.test(trimmed)) {
      closeList();
      out.push('<hr class="ai-md-rule">');
      continue;
    }

    const quote = trimmed.match(/^>\s*(.+)$/);
    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    const numbered = trimmed.match(/^\d+[.)]\s+(.+)$/);
    let content = trimmed.replace(/^#{1,3}\s+/, '');
    content = content.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    if (quote) {
      closeList();
      out.push('<div class="ai-md-quote">' + quote[1] + '</div>');
    } else if (bullet || numbered) {
      if (!inList) {
        out.push('<ul class="ai-md-list">');
        inList = true;
      }
      content = content.replace(/^[-*]\s+/, '').replace(/^\d+[.)]\s+/, '');
      out.push('<li>' + content + '</li>');
    } else {
      closeList();
      out.push('<div class="ai-md-line">' + content + '</div>');
    }
  }
  closeList();
  return out.join('');
}

function formatQuestionText(value) {
  let text=value==null?'':String(value);
  const supers={'0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','+':'⁺','-':'⁻','=':'⁼','n':'ⁿ','i':'ⁱ'};
  const subs={'0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉','+':'₊','-':'₋','=':'₌','n':'ₙ','i':'ᵢ'};
  const sup=v=>String(v).split('').map(ch=>supers[ch]||ch).join('');
  const sub=v=>String(v).split('').map(ch=>subs[ch]||ch).join('');
  return text.replace(/\\textless\s*\{\}/g,'<').replace(/\\textgreater\s*\{\}/g,'>')
    .replace(/\\textless/g,'<').replace(/\\textgreater/g,'>').replace(/\\textbar|\\mid/g,'|')
    .replace(/\\ne|\\neq/g,'≠').replace(/\\leqslant|\\leq/g,'≤').replace(/\\geqslant|\\geq/g,'≥')
    .replace(/\\approx/g,'≈').replace(/\\times/g,'×').replace(/\\cdot/g,'·').replace(/\\pm/g,'±')
    .replace(/\\infty/g,'∞').replace(/\\angle/g,'∠').replace(/\\triangle/g,'△').replace(/\\parallel/g,'∥').replace(/\\perp/g,'⊥')
    .replace(/\\to|\\rightarrow/g,'→').replace(/\\left|\\right/g,'').replace(/\\textbf\s*\{([^{}]*)\}/g,'$1')
    .replace(/\\text\s*\{([^{}]*)\}/g,'$1').replace(/\\mathrm\s*\{([^{}]*)\}/g,'$1')
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g,'($1)/($2)').replace(/\\sqrt\{([^{}]+)\}/g,'√($1)')
    .replace(/\$\$/g,'').replace(/\$([^$]+)\$/g,'').replace(/\\\(|\\\)|\\\[|\\\]/g,'')
    .replace(/\\,/g,' ').replace(/\\;/g,' ').replace(/\\!/g,'')
    .replace(/\^\{([^{}]+)\}/g,(_,v)=>sup(v)).replace(/\^([0-9n])/g,(_,v)=>sup(v))
    .replace(/_\{([^{}]+)\}/g,(_,v)=>sub(v)).replace(/_([0-9n])/g,(_,v)=>sub(v))
    .replace(/\{([^{}]*)\}/g,'').replace(/\s+/g,' ').trim();
}
function renderSkillQuestion() {
  const totalImportedQuestions = importedJuniorHighBank().length;
  const bankCount = document.getElementById('skill-bank-count');
  if (bankCount) bankCount.textContent = totalImportedQuestions + ' 道初中题';
  const q=dynamicSkillQuestion;
  const submit=document.getElementById('skill-submit');
  const skip=document.getElementById('skill-skip');
  const nextButton=document.getElementById('skill-next');
  const options=document.getElementById('skill-options');
  if(!options)return;

  const topic = currentSkillTopic();
  const topicTitle = document.getElementById('skill-topic-title');
  if (topicTitle) topicTitle.textContent = topic + ' · 自适应训练';

  if(!q){
    document.getElementById('skill-level-title').textContent='等待生成';
    document.getElementById('skill-level-pill').textContent='未开始';
    document.getElementById('skill-question-text').textContent=profile?'点击“开始训练”生成第一道题。':'先完成学情设置和 AI 诊断。';
    document.getElementById('skill-question-no').textContent=String(skillQuestionNo);
    document.getElementById('skill-current-level').textContent='未开始';
    document.getElementById('skill-next-level').textContent='等待表现';
    document.getElementById('skill-mastery').textContent=skillAttempts ? skillMastery+'%' : '--';
    options.innerHTML='<div class="empty-state"><b>准备开始训练</b><p>点击“开始训练”后立即从你的重点知识点题库选择一道合适难度的题目。</p></div>';
    if(submit)submit.disabled=true;
    if(skip)skip.disabled=true;
    if(nextButton){
      nextButton.hidden=!profile;
      nextButton.disabled=false;
      nextButton.textContent='开始训练';
    }
    return;
  }

  document.getElementById('skill-level-title').textContent=difficultyLabel(q.level) || q.label || '训练题';
  document.getElementById('skill-level-pill').textContent=q.label||'AI训练';
  document.getElementById('skill-question-text').textContent=formatQuestionText(q.question||'');
  document.getElementById('skill-question-no').textContent=String(skillQuestionNo);
  document.getElementById('skill-current-level').textContent=difficultyLabel(q.level) || q.label || '训练题';
  document.getElementById('skill-mastery').textContent=skillAttempts ? skillMastery+'%' : '--';
  document.getElementById('skill-decision-pill').textContent=skillAnswered?'本题已完成':skillLoading?'AI正在出题':'自适应训练中';
  document.getElementById('skill-decision-text').textContent=skillAnswered?'当前题目已保留。你可以回看后再进入下一题。':skillLoading?'正在根据你的学情和历史表现选择题目。':'下一题会根据这道题的答题表现升难或降难。';
  document.getElementById('skill-next-level').textContent=skillAnswered?'下一题将综合最新表现':(['基础题','中等题','困难题','拔尖题'][Math.min(3,skillLevelIndex+1)]||'保持当前难度');

  const hasChoiceOptions = q.options && ['A','B','C','D'].every(k => q.options[k]);
  if (!hasChoiceOptions || q.inputType === 'text') {
    options.innerHTML =
      '<label class="skill-text-answer"><span>填写你的答案</span>' +
      '<textarea id="skill-free-answer" rows="4" placeholder="写出最终答案或关键结论"'+(skillAnswered||skillLoading?' disabled':'')+'>'+escapeHtml(selectedSkillOption||'')+'</textarea>' +
      '</label>';
    const input=document.getElementById('skill-free-answer');
    if(input && !skillAnswered && !skillLoading){
      input.addEventListener('input',()=>{ selectedSkillOption=input.value.trim(); });
    }
  } else {
    options.innerHTML=Object.entries(q.options||{}).map(([k,v])=>'<button type="button" data-skill-option="'+escapeHtml(k)+'"'+(skillAnswered||skillLoading?' disabled':'')+'>'+escapeHtml(k+'. '+formatQuestionText(v))+'</button>').join('');
    if(!skillAnswered&&!skillLoading){
      options.querySelectorAll('[data-skill-option]').forEach(btn=>btn.addEventListener('click',()=>{
        selectedSkillOption=btn.dataset.skillOption;
        options.querySelectorAll('button').forEach(x=>x.classList.remove('selected'));
        btn.classList.add('selected');
      }));
    }
  }

  if(submit)submit.disabled=skillAnswered||skillLoading;
  if(skip)skip.disabled=skillAnswered||skillLoading;
  if(nextButton){
    if(skillAnswered){
      nextButton.hidden=false;
      nextButton.removeAttribute('hidden');
      nextButton.disabled=false;
      nextButton.style.removeProperty('display');
      nextButton.textContent='下一题';
    }else{
      nextButton.hidden=true;
      nextButton.setAttribute('hidden','');
      nextButton.disabled=skillLoading;
      nextButton.textContent=skillLoading?'正在出题…':'下一题';
    }
  }

  const skillPanel=document.getElementById('skills');
  if(skillPanel){
    skillPanel.dataset.skillState=skillAnswered?'answered':'question';
  }
}

function forceSkillAnsweredUI(){
  const nextButton=document.getElementById('skill-next');
  const skillPanel=document.getElementById('skills');
  if(!nextButton || !dynamicSkillQuestion || !skillAnswered) return;
  nextButton.hidden=false;
  nextButton.removeAttribute('hidden');
  nextButton.disabled=false;
  nextButton.style.removeProperty('display');
  nextButton.textContent='下一题';
  if(skillPanel) skillPanel.dataset.skillState='answered';
}

async function generateAISkillQuestion() {
  const topic = currentSkillTopic();
  const recent = skillHistory.slice(-6).map(item =>
    (item.correct ? '对' : '错') + '·' + (item.label || '训练题')
  ).join('，') || '无';
  const mistakes = Object.values(mistakeData).slice(-3).map(item => item.title).join('；') || '无';
  const usedQuestions = skillHistory.map(item => item.question).join('\\n');
  const levelNames = ['基础题','中等题','困难题','拔尖题'];

  const raw = await callAgent('skill',
    '训练知识点：' + topic + '\\n' +
    '当前掌握度：' + (skillAttempts ? skillMastery + '%' : '尚无数据，从基础难度开始') + '\\n' +
    '当前训练难度（必须严格遵守）：' + levelNames[Math.min(3, skillLevelIndex)] + '\\n' +
    '连续答对：' + skillStreak + '\\n' +
    '最近表现：' + recent + '\\n' +
    '错题记录：' + mistakes + '\\n' +
    (profile ? '学生情况：' + (profile.grade || '') + ' ' + (profile.subject || '') + '，自述薄弱点：' + (profile.state || '未填写') + '\\n' : '') +
    '已做过且严禁重复（也不能只换数字）的题目：\\n' + (usedQuestions || '无') + '\\n' +
    '请根据以上真实表现决定下一题的难度与题型，并生成一道真正不同的新题。'
  );

  const parsed = parseSkillQuestion(raw);
  if (!parsed) throw new Error('AI 出题格式无法解析');
  if (isDuplicateQuestion(parsed.question)) throw new Error('AI 生成了重复题目');
  return parsed;
}

function consumePrefetchedSkillQuestion() {
  if (!prefetchedSkillQuestion || prefetchedSkillToken !== skillPrefetchToken) {
    prefetchedSkillQuestion = null;
    return null;
  }
  const q = prefetchedSkillQuestion;
  prefetchedSkillQuestion = null;
  return q;
}

function showSkillQuestion(question, source) {
  dynamicSkillQuestion = {
    ...question,
    id: question.id || ((source === 'ai' ? 'ai-' : 'local-') + Date.now()),
    level: typeof question.level === 'number' ? question.level : skillLevelIndex,
    source: source || question.source || 'adaptive-engine'
  };
  skillQuestionNo += 1;
  skillAnswered = false;
  skillAnswerCorrect = null;
  selectedSkillOption = '';
  setSkillGeneration(false);

  const feedback = document.getElementById('skill-feedback');
  if (feedback) {
    feedback.className = 'skill-feedback';
    feedback.innerHTML = source === 'ai'
      ? '<span>AI 已提前准备好下一题</span><p>本题结合你的最新答题表现动态生成。</p>'
      : '<span>题目已就绪</span><p>即时从自适应题库选择，不等待 AI。</p>';
  }

  renderSkillQuestion();
}

function invalidateSkillPrefetch() {
  prefetchedSkillQuestion = null;
  skillPrefetchToken += 1;
}

async function prefetchNextSkillQuestion() {
  if (!profile || skillPrefetchInFlight) return;

  const token = ++skillPrefetchToken;
  skillPrefetchInFlight = true;

  try {
    const question = await generateAISkillQuestion();
    if (token !== skillPrefetchToken) return;
    prefetchedSkillQuestion = question;
    prefetchedSkillToken = token;
  } catch (_) {
    // AI 是后台加速器；失败不影响下一题即时出现。
  } finally {
    skillPrefetchInFlight = false;
  }
}

function requestDynamicSkillQuestion() {
  if (!profile) {
    showToast('先完成首次学情设置');
    return;
  }

  const aiQuestion = consumePrefetchedSkillQuestion();
  if (aiQuestion) {
    const targetLevel = skillLevelIndex;
    showSkillQuestion({ ...aiQuestion, level: targetLevel, label: difficultyLabel(targetLevel) }, 'ai');
    return;
  }

  invalidateSkillPrefetch();
  showSkillQuestion(selectLocalQuestion(), 'adaptive-engine');
}
function saveSkillAttempt(q,chosen,correct,skipped){
  skillHistory.push({
    id:q.id || ('local-'+Date.now()),
    level:typeof q.level==='number'?q.level:skillLevelIndex,
    label:q.label||'训练题',
    question:q.question,
    options:q.options,
    answer:q.answer,
    chosen:chosen||'',
    correct:!!correct,
    skipped:!!skipped,
    explanation:q.explanation||'',
    topic:currentSkillTopic(),
    createdAt:new Date().toISOString()
  });
  saveSkillHistory();
  renderSkillHistory();
  syncDerivedStudentStats();
}

function buildLocalMistakeFeedback(q, chosen) {
  const levelName = ['基础题','中等题','困难题','拔尖题'][q.level] || q.label || '训练题';
  const topic = currentSkillTopic();
  return {
    reason: chosen === q.answer
      ? '本题答对，暂不记录为错题。'
      : '你的选择与正确答案不一致。先回到题目中检查题目条件、解题步骤和代入过程。',
    knowledge: topic,
    errorType: chosen === q.answer ? '掌握' : (
      q.level === 0 ? '基础概念或直接计算' :
      q.level === 1 ? '条件提取或两步推理' :
      q.level === 2 ? '多条件整合、综合推理或较强迁移' :
      '竞赛思维、深度迁移或非套路解法'
    ),
    evidence: '题目：' + q.question + '；你的选择：' + (chosen || '未作答') + '；正确答案：' + q.answer,
    basic: '先做 1 道同知识点基础题，确认核心方法不再出错。',
    variant: '等基础方法稳定后，再换条件或解题入口做真正变式。',
    comprehensive: '最后用一道多条件综合题检查能否独立迁移。',
    masteryCheck: '连续完成不同形式的 2～3 道题且正确，再将掌握度上调。'
  };
}

function evaluateSkillAnswer(correct){
  const q=dynamicSkillQuestion;
  if(!q)return;
  const chosen=selectedSkillOption;
  skillAnswered=true;
  skillAnswerCorrect=correct;
  updateSkillMastery(correct);
  saveSkillAttempt(q,chosen,correct,false);

  document.getElementById('skill-result-title').textContent=correct
    ? '本题答对 · 回看后再进入下一题'
    : '本题答错 · 已生成错因反馈';

  const feedback=document.getElementById('skill-feedback');
  if(feedback){
    const local = correct
      ? {
          title:'本题答对',
          text:q.explanation||'表现稳定，下一题会根据你的表现调整。'
        }
      : {
          title:'这次出现卡点',
          text:'正确答案是 '+q.answer+'。'+buildLocalMistakeFeedback(q,chosen).reason
        };
    feedback.className=correct?'skill-feedback correct':'skill-feedback wrong';
    feedback.innerHTML =
      '<div class="skill-feedback-block local-feedback">' +
        '<span>'+escapeHtml(local.title)+'</span>' +
        '<p>'+escapeHtml(local.text)+'</p>' +
      '</div>' +
      (correct ? '' :
        '<div class="skill-feedback-block ai-feedback ai-feedback-pending">' +
          '<span>AI 错因补充分析</span>' +
          '<p>正在结合你的题目、答案与学习记录补充诊断…</p>' +
        '</div>');
  }
  renderSkillQuestion();
  forceSkillAnsweredUI();
  queueMicrotask(forceSkillAnsweredUI);
  renderSkillHistory();

  // AI 在后台准备下一题，当前页面完全不等待。
  void prefetchNextSkillQuestion();
}

async function analyzeSkillMistake(q,chosen,mistakeId){
  // 本地反馈先立即完成，AI 只负责增强诊断，不再阻塞学生训练。
  const local = buildLocalMistakeFeedback(q, chosen);
  if (mistakeData[mistakeId]) {
    Object.assign(mistakeData[mistakeId], local);
    mistakeData[mistakeId].error = local.errorType;
    saveMistakes();
    renderMistakeListFromStore();
    renderMistake();
  }

  try {
    const raw=await callAgent('mistake',
      profileContext()+'\n刚刚技能训练题：'+q.question+
      '\n正确答案：'+q.answer+
      '\n学生选择：'+chosen+
      '\n请返回结构化 JSON，字段：reason,knowledge,errorType,evidence,basic,variant,comprehensive,masteryCheck。'
    );
    const data=parseAgentJson(raw);
    if(mistakeData[mistakeId]){
      Object.assign(mistakeData[mistakeId],data);
      mistakeData[mistakeId].error=data.errorType||mistakeData[mistakeId].error;
      saveMistakes();
      renderMistakeListFromStore();
      renderMistake();
    }
    const feedback=document.getElementById('skill-feedback');
    if(feedback){
      const aiBox = feedback.querySelector('.ai-feedback');
      if(aiBox){
        aiBox.classList.remove('ai-feedback-pending');
        aiBox.innerHTML =
          '<span>AI 错因补充分析</span>' +
          '<p><b>'+escapeHtml(data.knowledge||local.knowledge)+'</b><br>'+
          escapeHtml(data.reason||local.reason)+'</p>';
      }
    }
  } catch (error) {
    const feedback=document.getElementById('skill-feedback');
    const aiBox=feedback?.querySelector('.ai-feedback');
    if(aiBox){
      aiBox.classList.remove('ai-feedback-pending');
      aiBox.innerHTML =
        '<span>AI 错因补充分析暂不可用</span>' +
        '<p>本地错因判断仍然保留，不影响继续训练。</p>';
    }
  }
}

function normalizeSkillAnswer(value){
  return String(value||'')
    .trim()
    .toLowerCase()
    .replace(/\s+/g,'')
    .replace(/[$\\{}\[\]（）()，,。；;：:]/g,'');
}

function skillAnswersEquivalent(chosen, answer){
  const a=normalizeSkillAnswer(chosen);
  const b=normalizeSkillAnswer(answer);
  if(!a||!b)return false;
  if(a===b)return true;
  const na=Number(a), nb=Number(b);
  return Number.isFinite(na) && Number.isFinite(nb) && Math.abs(na-nb)<1e-9;
}

document.getElementById('skill-submit')?.addEventListener('click',async()=>{
  const q=dynamicSkillQuestion;
  if(!q||skillAnswered||skillLoading)return;
  if(q.inputType==='text'){
    const input=document.getElementById('skill-free-answer');
    selectedSkillOption=input ? input.value.trim() : '';
  }
  if(!selectedSkillOption){
    showToast(q.inputType==='text'?'先填写答案':'先选择一个答案');
    return;
  }

  const chosen=selectedSkillOption;
  // 作答后立即使可能残留的旧出题请求失效，避免异步回写覆盖“已完成”状态。
  skillRequestId += 1;
  const correct=q.inputType==='text' ? skillAnswersEquivalent(chosen,q.answer) : chosen===q.answer;
  let mistakeId=null;

  if(!correct){
    mistakeId='mistake-'+Date.now();
    const local=buildLocalMistakeFeedback(q,chosen);
    mistakeData[mistakeId]={
      id:mistakeId,
      title:(q.label||'训练题')+' · '+currentSkillTopic(),
      type:'技能训练错误',
      question:q.question,
      reason:local.reason,
      knowledge:local.knowledge,
      error:local.errorType,
      evidence:local.evidence,
      basic:local.basic,
      variant:local.variant,
      comprehensive:local.comprehensive,
      masteryCheck:local.masteryCheck,
      chosen,
      createdAt:new Date().toLocaleString()
    };
    saveMistakes();
    currentMistake=mistakeId;
    renderMistakeListFromStore();
  }

  evaluateSkillAnswer(correct);
  forceSkillAnsweredUI();

  if(!correct&&mistakeId){
    void analyzeSkillMistake(q,chosen,mistakeId);
  }
});

document.getElementById('skill-next')?.addEventListener('click',()=>{
  if(skillLoading)return;

  if(dynamicSkillQuestion && !skillAnswered){
    showToast('先完成当前题');
    return;
  }

  requestDynamicSkillQuestion();
});

document.getElementById('skill-skip')?.addEventListener('click',()=>{
  const q=dynamicSkillQuestion;
  if(!q||skillAnswered||skillLoading)return;
  skillRequestId += 1;

  const mistakeId='mistake-'+Date.now();
  const local=buildLocalMistakeFeedback(q,'');
  mistakeData[mistakeId]={
    id:mistakeId,
    title:(q.label||'训练题')+' · '+currentSkillTopic(),
    type:'技能训练不会',
    question:q.question,
    reason:'你主动标记“不会”，系统将其视为需要复盘的真实学习信号。',
    knowledge:local.knowledge,
    error:local.errorType,
    evidence:'题目：'+q.question+'；学生标记：不会。',
    basic:local.basic,
    variant:local.variant,
    comprehensive:local.comprehensive,
    masteryCheck:local.masteryCheck,
    chosen:'',
    skipped:true,
    createdAt:new Date().toLocaleString()
  };
  saveMistakes();
  currentMistake=mistakeId;
  renderMistakeListFromStore();

  skillStreak=0;
  if(skillLevelIndex>0)skillLevelIndex-=1;
  skillMastery=Math.max(0,skillMastery-5);
  skillAttempts+=1;
  saveSkillState();

  saveSkillAttempt(q,'',false,true);
  skillAnswered=true;
  skillAnswerCorrect=false;

  if(profile) saveProfile(profile);
  syncDerivedStudentStats();

  const feedback=document.getElementById('skill-feedback');
  if(feedback){
    feedback.className='skill-feedback wrong';
    feedback.innerHTML =
      '<div class="skill-feedback-block local-feedback">' +
      '<span>已记录“这题我不会”</span>' +
      '<p>这道题已进入错题复盘中心。当前难度已下调，点击“下一题”后会继续给你更适合的训练。</p>' +
      '</div>' +
      '<div class="skill-feedback-block ai-feedback ai-feedback-pending">' +
      '<span>AI 错因补充分析</span>' +
      '<p>正在结合你的题目与学习记录补充诊断…</p>' +
      '</div>';
  }
  renderSkillQuestion();
  forceSkillAnsweredUI();
  void analyzeSkillMistake(q,'',mistakeId);
});

renderSkillHistory();
renderSkillQuestion();

const motivationComplete=document.getElementById('motivation-complete');
const motivationBar=document.getElementById('motivation-complete-bar');
const motivationTitle=document.getElementById('motivation-title');
const motivationReason=document.getElementById('motivation-reason');
const motivationStatus=document.getElementById('motivation-status');
const loadBar = document.getElementById('load-bar');
const loadValue = document.getElementById('load-value');
const loadStatus = document.getElementById('load-status');




async function callAgent(agent, context, timeoutMs) {
  const deadline = timeoutMs || 25000;
  let response;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), deadline);

  try {
    response = await fetch(AGENT_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent, context }),
      signal: controller.signal
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('AI 请求超过 ' + Math.round(deadline / 1000) + ' 秒仍未完成。核心学习流程不会被阻塞，请稍后重试。');
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



const STUDY_TIME_KEY = 'yincaiStudySeconds';

function getStudySeconds() {
  return Number(localStorage.getItem(STUDY_TIME_KEY) || 0);
}

let studySessionStartedAt = Date.now();

function flushStudyTime() {
  if (!profile) {
    studySessionStartedAt = Date.now();
    return;
  }
  const now = Date.now();
  const delta = Math.max(0, Math.min(120, Math.floor((now - studySessionStartedAt) / 1000)));
  if (delta > 0) localStorage.setItem(STUDY_TIME_KEY, String(getStudySeconds() + delta));
  studySessionStartedAt = now;
  renderReport();
}

setInterval(() => {
  if (profile && document.visibilityState === 'visible') flushStudyTime();
}, 30000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushStudyTime();
  else studySessionStartedAt = Date.now();
});
window.addEventListener('beforeunload', flushStudyTime);

function calculateLearningStreak() {
  const dates = new Set(skillHistory.map(item => (item.createdAt || '').slice(0, 10)).filter(Boolean));
  let streak = 0;
  let day = new Date();
  while (dates.has(day.toISOString().slice(0, 10))) {
    streak += 1;
    day = new Date(day.getTime() - 86400000);
  }
  return streak;
}

function renderDashboardTasks() {
  const empty = document.getElementById('dashboard-task-empty');
  const generated = document.getElementById('dashboard-task-generated');
  if (!empty || !generated) return;
  if (!profile) {
    empty.hidden = false;
    generated.innerHTML = '';
    return;
  }

  const topic = profile.diagnosis?.priorities?.[0]?.name || profile.primaryTopic || profile.subject || '当前重点知识点';
  const todayKey = localDateKey();
  let state;
  try { state = JSON.parse(localStorage.getItem(TASK_KEY) || 'null'); } catch (_) { state = null; }

  if (!state || state.date !== todayKey || !Array.isArray(state.items)) {
    state = {
      date: todayKey,
      items: [
        { id:'diagnosis', title:'完成一次学情诊断', note:'让 Agent 根据当前资料确定今天重点', done:!!profile.diagnosis, go:'analysis' },
        { id:'training', title:topic + ' · 自适应训练 5 题', note:'从基础到当前适合难度连续训练', done:todayCompletedTasks() >= 5, go:'skills' },
        { id:'review', title:'复盘今天的错题', note:'完成至少 1 道错题复盘即可', done:false, go:'mistakes' }
      ]
    };
  } else {
    state.items[0].done = !!profile.diagnosis;
    state.items[1].done = todayCompletedTasks() >= 5;
  }
  localStorage.setItem(TASK_KEY, JSON.stringify(state));

  const doneCount = state.items.filter(item => item.done).length;
  const rate = Math.round(doneCount / state.items.length * 100);
  empty.hidden = true;
  generated.innerHTML = state.items.map(item =>
    '<div class="task-row ' + (item.done ? 'done' : '') + '">' +
      '<button type="button" class="task-check" aria-label="' + escapeHtml(item.title) + '" data-task-toggle="' + item.id + '">' + (item.done ? '✓' : '') + '</button>' +
      '<div class="task-row-main"><b>' + escapeHtml(item.title) + '</b><small>' + escapeHtml(item.note) + '</small></div>' +
      '<button type="button" class="task-go" data-go="' + escapeHtml(item.go) + '">' + (item.done ? '回看' : '去做') + '</button>' +
    '</div>'
  ).join('');

  generated.querySelectorAll('[data-task-toggle]').forEach(button => button.addEventListener('click', () => {
    const current = state.items.find(item => item.id === button.dataset.taskToggle);
    if (!current) return;
    if (current.id !== 'review') {
      showPage(current.go);
      return;
    }
    current.done = !current.done;
    localStorage.setItem(TASK_KEY, JSON.stringify(state));
    renderDashboardTasks();
    refreshFirstUseStats();
  }));
}

function renderReport() {
  const seconds = getStudySeconds();
  const weekItems = skillHistory.filter(item => {
    const time = Date.parse(item.createdAt || '');
    return Number.isFinite(time) && (Date.now() - time <= 7 * 86400000);
  });
  const recentMistakes = Object.values(mistakeData).filter(item => {
    const time = Date.parse(item.createdAt || '');
    return Number.isFinite(time) && (Date.now() - time <= 7 * 86400000);
  }).length;

  const hours = seconds / 3600;
  const study = document.getElementById('report-study-hours');
  const completed = document.getElementById('report-completed');
  const mistakeChange = document.getElementById('report-mistakes-change');
  const masteryChange = document.getElementById('report-mastery-change');

  if (study) study.textContent = hours < 0.05 ? (hours * 60).toFixed(1) + ' min' : hours.toFixed(1) + ' h';
  if (completed) completed.textContent = String(weekItems.length);
  if (mistakeChange) mistakeChange.textContent = recentMistakes ? '新增 ' + recentMistakes + ' 道' : '--';

  if (masteryChange) {
    const initial = Number(profile?.initialSkillMastery);
    const current = Number(profile?.skillMastery);
    masteryChange.textContent = Number.isFinite(initial) && skillAttempts >= 2
      ? ((current - initial >= 0 ? '+' : '') + (current - initial).toFixed(1) + ' pt')
      : skillAttempts === 1 && Number.isFinite(current) ? '基线已建立' : '--';
  }

  const summary = document.getElementById('report-summary-text');
  const pill = document.getElementById('report-summary-pill');
  if (!summary) return;

  if (!profile) {
    summary.textContent = '完成学情设置后，这里会根据真实训练、错题和学习时长生成周报。';
    if (pill) pill.textContent = '等待学习';
    return;
  }

  const topic = profile.diagnosis?.priorities?.[0]?.name || profile.primaryTopic || profile.subject || '当前重点知识点';
  const accuracy = weekItems.length ? Math.round(weekItems.filter(item => item.correct).length / weekItems.length * 100) : 0;
  summary.textContent = weekItems.length
    ? '本周围绕“' + topic + '”完成了 ' + weekItems.length + ' 次训练，正确率约 ' + accuracy + '%。' +
      (recentMistakes ? ' 当前还有 ' + recentMistakes + ' 道近期错题值得复盘。' : ' 暂时没有新增错题。') +
      ' 后续训练会根据实际表现继续调整难度。'
    : '本周还没有完整的训练记录。完成几道真实题目后，这里会显示你的实际学习情况。';
  if (pill) pill.textContent = weekItems.length ? '基于真实数据' : '等待学习';
}

function syncDerivedStudentStats() {
  const mistakesCount = Object.keys(mistakeData).length;
  const streak = calculateLearningStreak();
  const pct = todayCompletePercent();

  const streakNode = document.getElementById('streak-count');
  const motivationStreakNode = document.getElementById('motivation-streak');
  const motivationComplete = document.getElementById('motivation-complete');
  const motivationBar = document.getElementById('motivation-complete-bar');
  const scoreNode = document.getElementById('motivation-mastery');

  if (streakNode) streakNode.textContent = streak + ' 天';
  if (motivationStreakNode) motivationStreakNode.textContent = streak + ' 天';
  if (motivationComplete) motivationComplete.textContent = pct + '%';
  if (motivationBar) motivationBar.style.width = pct + '%';
  if (scoreNode) scoreNode.textContent = profile?.skillMastery != null ? profile.skillMastery + '%' : '--';

  const local = profile ? buildLocalMotivation(pct + '%', streak, mistakesCount) : null;
  if (local) {
    const dashboardTitle = document.getElementById('dashboard-motivation-title');
    const dashboardReason = document.getElementById('dashboard-motivation-reason');
    const dashboardStatus = document.getElementById('dashboard-motivation-status');
    if (dashboardTitle) dashboardTitle.textContent = local.title;
    if (dashboardReason) dashboardReason.textContent = local.reason;
    if (dashboardStatus) dashboardStatus.textContent = local.title.replace('建议：','');
  }

  renderDashboardTasks();
  renderReport();
}

function refreshFirstUseStats() {
  const mistakesCount = Object.keys(mistakeData).length;
  const mistakeNode = document.getElementById('mistake-count');
  if (mistakeNode) mistakeNode.textContent = mistakesCount + ' 道';

  const scoreNode = document.getElementById('motivation-mastery');
  if (scoreNode) scoreNode.textContent = profile?.skillMastery ? profile.skillMastery + '%' : '--';

  const streak = calculateLearningStreak();
  localStorage.setItem(STREAK_KEY, String(streak));
  const streakNode = document.getElementById('streak-count');
  if (streakNode) streakNode.textContent = streak + ' 天';
  const motivationStreakNode = document.getElementById('motivation-streak');
  if (motivationStreakNode) motivationStreakNode.textContent = streak + ' 天';

  const pct = todayCompletePercent();
  const completeNode = document.getElementById('motivation-complete');
  if (completeNode) completeNode.textContent = pct + '%';
  const bar = document.getElementById('motivation-complete-bar');
  if (bar) bar.style.width = pct + '%';
  if (loadBar) loadBar.style.width = mistakesCount ? '30%' : '0%';
  if (loadValue) loadValue.textContent = mistakesCount ? '30%' : '--';
  if (loadStatus) loadStatus.textContent = mistakesCount ? '开始关注' : '等待学习';

  renderDashboardTasks();
  renderReport();
  if (profile) {
    void requestMotivationAgentIfReady(false);
  }
}refreshFirstUseStats();

// 学习激励：完成度来自真实答题数据，不再写死。
function todayCompletedTasks() {
  const today = localDateKey();
  return skillHistory.filter(item => (item.createdAt || '').slice(0, 10) === today).length;
}

function todayCompletePercent() {
  const target = 5; // 每天默认 5 道高价值训练题
  return Math.min(100, Math.round((todayCompletedTasks() / target) * 100));
}

function buildLocalMotivation(complete, streak, mistakesCount) {
  const pct = Number(String(complete).replace('%', '')) || 0;
  if (pct >= 90) {
    return {
      title: '建议：收尾',
      reason: '今日任务已基本完成。把剩余时间留给错题复盘或休息，不建议为了“完成更多”再堆新任务。'
    };
  }
  if (streak >= 3 && mistakesCount > 0) {
    return {
      title: '建议：维持',
      reason: '你已经连续学习 ' + streak + ' 天。今天只处理 ' + mistakesCount + ' 道待复盘错题，不加新内容，保住学习连续性。'
    };
  }
  return {
    title: '建议：继续',
    reason: '今日完成度还有空间。优先完成当前重点知识点训练，不必追加额外任务。'
  };
}

async function requestMotivationAgentIfReady(force = false) {
  if (!profile) return;
  const title = document.getElementById('dashboard-motivation-title');
  const reasonNode = document.getElementById('dashboard-motivation-reason');
  const statusNode = document.getElementById('dashboard-motivation-status');
  const signature = String(todayCompletePercent()) + '|' + Object.keys(mistakeData).length + '|' + String(skillAttempts) + '|' + String(profile.skillMastery || 0);

  if (!force && window.__lastMotivationSignature === signature) return;
  window.__lastMotivationSignature = signature;

  const local = buildLocalMotivation(todayCompletePercent() + '%', calculateLearningStreak(), Object.keys(mistakeData).length);
  if (title) title.textContent = local.title;
  if (reasonNode) reasonNode.textContent = local.reason;
  if (statusNode) statusNode.textContent = local.title.replace('建议：','');

  try {
    await requestMotivationAgent();
  } catch (_) {
    // requestMotivationAgent 已经提供本地保底结果。
  }
}

async function requestMotivationAgent() {
  const complete = todayCompletePercent() + '%';
  const streak = Number(localStorage.getItem(STREAK_KEY) || 0);
  const mistakesCount = Object.keys(mistakeData).length;
  try {
    const reason = await callAgent('motivation',
      profileContext() + '\n' +
      '今日完成度：' + complete + '（来自真实答题记录）。\n' +
      '连续学习：' + streak + ' 天。\n' +
      '待复盘错题：' + mistakesCount + ' 道。\n' +
      '今天主要高优先级任务：根据当前学生情况判断。\n' +
      '请判断今天应该继续、维持还是收尾，并给出最小必要任务。'
    );
    const aiTitle = reason.split('\n')[0] || reason;
    motivationTitle.textContent = aiTitle;
    motivationReason.textContent = reason;
    motivationStatus.textContent = reason.startsWith('建议：收尾') ? '建议收尾' : 'AI已重新评估';
    const dashboardTitle = document.getElementById('dashboard-motivation-title');
    const dashboardReason = document.getElementById('dashboard-motivation-reason');
    const dashboardStatus = document.getElementById('dashboard-motivation-status');
    if (dashboardTitle) dashboardTitle.textContent = aiTitle;
    if (dashboardReason) dashboardReason.textContent = reason;
    if (dashboardStatus) dashboardStatus.textContent = reason.startsWith('建议：收尾') ? '建议收尾' : 'AI已重新评估';
  } catch (error) {
    // AI 失败时使用本地规则保底判断，并明确标识。
    const local = buildLocalMotivation(complete, streak, mistakesCount);
    motivationTitle.textContent = local.title;
    motivationReason.textContent = local.reason + '（AI 暂时不可用：' + error.message + '）';
    motivationStatus.textContent = '保底判断 · AI 不可用';
    const dashboardTitle = document.getElementById('dashboard-motivation-title');
    const dashboardReason = document.getElementById('dashboard-motivation-reason');
    const dashboardStatus = document.getElementById('dashboard-motivation-status');
    if (dashboardTitle) dashboardTitle.textContent = local.title;
    if (dashboardReason) dashboardReason.textContent = local.reason;
    if (dashboardStatus) dashboardStatus.textContent = '保底判断';
    throw error;
  }
}

document.getElementById('finish-one-task')?.addEventListener('click', async () => {
  // 完成度以真实答题记录为准，不再写死为 100%。
  refreshFirstUseStats();
  try {
    await requestMotivationAgent();
    await requestMotivationAgentIfReady(true);
    motivationStatus.classList.add('done');
    showToast('学习激励 Agent 已重新评估：今天可以收尾或维持');
  } catch (error) {
    showToast('AI 分析失败，已显示保底判断');
  }
});

document.getElementById('reduce-load')?.addEventListener('click', async () => {
  try {
    await requestMotivationAgent();
    await requestMotivationAgentIfReady(true);
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
  if (skillTopic) {
    const topic = profile.diagnosis?.priorities?.[0]?.name || profile.primaryTopic;
    skillTopic.textContent = topic ? topic + ' · AI 自适应训练' : profile.subject + ' · 等待 AI 诊断';
  }
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
    renderSkillQuestion();
    refreshFirstUseStats();
    closeOnboarding();
    showToast('学习画像已建立，正在生成第一次学情诊断');
    showPage('analysis');
    setTimeout(() => runAnalysisAgent(), 180);
  });

  document.getElementById('edit-profile-btn')?.addEventListener('click', () => {
    resetOnboardingForm();
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

  document.getElementById('clear-profile-btn')?.addEventListener('click', handleClearStudentData);
  document.getElementById('dashboard-motivation-btn')?.addEventListener('click', () => {
    showPage('motivation');
    requestMotivationAgentIfReady();
  });
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
renderTutorStage();

if (profile) {
  skillMastery = Number(profile.skillMastery || 0);
} else {
  setTimeout(openOnboarding, 120);
}



