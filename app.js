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
