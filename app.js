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
