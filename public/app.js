const i18n = {
  zh: {
    heroTitle: '让历史能被听见。',
    loginTitle: '1. Google 登录',
    notLoggedIn: '未登录',
    logout: '退出登录',
    signIn: '登录',
    me: '我的',
    configTitle: '配置你的历史新闻 Podcast',
    categoriesLabel: '新闻分类（可多选）',
    startDate: '开始日期',
    endDate: '结束日期',
    language: '播客语言',
    region: '国家或地区',
    generate: '生成 Podcast',
    summary: '摘要',
    script: '播报稿',
    events: '新闻事件',
    copyLink: '复制分享链接',
    needLogin: '请先完成 Google 登录',
    needForm: '请至少选择 1 个分类并填写日期范围',
    generating: '正在生成，请稍候（约 20-60 秒）...',
    done: 'Podcast 生成完成',
    copied: '分享链接已复制',
    noEvents: '本次未返回可展示的新闻事件',
    historyTitle: '我的 Podcasts',
    historyEmpty: '登录后查看你的历史生成记录',
    historyNone: '你还没有生成记录，先创建第一期吧',
    historyLoading: '正在加载历史记录...',
    historyLoadFailed: '历史记录加载失败',
    clearAll: '全部清空',
    deleteOne: '删除',
    confirmDeleteOne: '确认删除这条 Podcast 记录？',
    confirmClearAll: '确认清空该账号的全部 Podcast 记录？',
    deleteSuccess: '记录已删除',
    clearSuccess: '已清空全部记录',
    statusGenerating: '生成中',
    statusCompleted: '已完成',
    statusFailed: '失败',
    pendingTitle: '正在生成新 Podcast',
  },
  en: {
    heroTitle: 'Make history audible.',
    loginTitle: '1. Google Login',
    notLoggedIn: 'Not logged in',
    logout: 'Logout',
    signIn: 'Sign in',
    me: 'Me',
    configTitle: 'Configure your historical news podcast',
    categoriesLabel: 'News categories (multi-select)',
    startDate: 'Start date',
    endDate: 'End date',
    language: 'Podcast language',
    region: 'Country or region',
    generate: 'Generate Podcast',
    summary: 'Summary',
    script: 'Narration Script',
    events: 'News events',
    copyLink: 'Copy share link',
    needLogin: 'Please login with Google first',
    needForm: 'Select at least 1 category and date range',
    generating: 'Generating podcast... please wait (20-60s)',
    done: 'Podcast generated successfully',
    copied: 'Share link copied',
    noEvents: 'No news events returned for this run',
    historyTitle: 'My Podcasts',
    historyEmpty: 'Login to see your generated episodes',
    historyNone: 'No episodes yet. Generate your first one.',
    historyLoading: 'Loading your podcast history...',
    historyLoadFailed: 'Failed to load history',
    clearAll: 'Clear all',
    deleteOne: 'Delete',
    confirmDeleteOne: 'Delete this podcast record?',
    confirmClearAll: 'Clear all podcast records for this account?',
    deleteSuccess: 'Record deleted',
    clearSuccess: 'All records cleared',
    statusGenerating: 'Generating',
    statusCompleted: 'Completed',
    statusFailed: 'Failed',
    pendingTitle: 'Generating new podcast',
  },
};

const categoryOptions = [
  { value: 'World', zh: '世界', en: 'World' },
  { value: 'Geopolitics', zh: '地缘政治', en: 'Geopolitics' },
  { value: 'Policy', zh: '政策', en: 'Policy' },
  { value: 'Finance', zh: '财经', en: 'Finance' },
  { value: 'Markets', zh: '市场', en: 'Markets' },
  { value: 'Business', zh: '商业', en: 'Business' },
  { value: 'Companies', zh: '公司', en: 'Companies' },
  { value: 'Technology', zh: '科技', en: 'Technology' },
  { value: 'AI', zh: '人工智能', en: 'AI' },
  { value: 'Science', zh: '科学', en: 'Science' },
  { value: 'Education', zh: '教育', en: 'Education' },
  { value: 'Startups', zh: '创业', en: 'Startups' },
  { value: 'Society', zh: '社会', en: 'Society' },
];

const regionOptions = [
  { value: 'Global', zh: '全球', en: 'Global' },
  { value: 'United States', zh: '美国', en: 'United States' },
  { value: 'China', zh: '中国', en: 'China' },
  { value: 'Hong Kong SAR', zh: '中国香港', en: 'Hong Kong SAR' },
  { value: 'Taiwan', zh: '中国台湾', en: 'Taiwan' },
  { value: 'Japan', zh: '日本', en: 'Japan' },
  { value: 'South Korea', zh: '韩国', en: 'South Korea' },
  { value: 'Singapore', zh: '新加坡', en: 'Singapore' },
  { value: 'India', zh: '印度', en: 'India' },
  { value: 'United Kingdom', zh: '英国', en: 'United Kingdom' },
  { value: 'European Union', zh: '欧盟', en: 'European Union' },
  { value: 'Germany', zh: '德国', en: 'Germany' },
  { value: 'France', zh: '法国', en: 'France' },
  { value: 'Middle East', zh: '中东', en: 'Middle East' },
  { value: 'Latin America', zh: '拉美', en: 'Latin America' },
  { value: 'Africa', zh: '非洲', en: 'Africa' },
  { value: 'Southeast Asia', zh: '东南亚', en: 'Southeast Asia' },
  { value: 'New Zealand', zh: '新西兰', en: 'New Zealand' },
];

let currentLang = 'zh';
let googleIdToken = '';
let userProfile = null;
let lastShareUrl = '';
let historyItems = [];
let generationProgressTimer = null;
let generationProgressStartAt = 0;
let currentPendingHistoryId = null;
const AUTH_STORAGE_KEY = 'timecast_auth_v1';

function t(key) {
  return i18n[currentLang][key] || key;
}

function applyLanguage() {
  document.documentElement.lang = currentLang === 'zh' ? 'zh-CN' : 'en';
  document.querySelectorAll('[data-i18n]').forEach((node) => {
    const key = node.getAttribute('data-i18n');
    node.textContent = t(key);
  });
  document.getElementById('langToggle').textContent = currentLang === 'zh' ? 'EN' : '中';
  renderCategories();
  renderRegions();
  updateAuthUI();
  renderHistoryList();
}

function renderCategories() {
  const wrap = document.getElementById('categories');
  const selected = new Set(Array.from(document.querySelectorAll('#categories input:checked')).map((x) => x.value));
  wrap.innerHTML = categoryOptions
    .map(
      (c) => `
      <label class="category-item">
        <input type="checkbox" value="${c.value}" ${selected.has(c.value) ? 'checked' : ''} />
        <span>${currentLang === 'zh' ? c.zh : c.en}</span>
      </label>
    `,
    )
    .join('');
}

function renderRegions() {
  const regionSelect = document.getElementById('region');
  const previous = regionSelect.value || 'Global';
  regionSelect.innerHTML = regionOptions
    .map((r) => `<option value="${r.value}">${currentLang === 'zh' ? r.zh : r.en}</option>`)
    .join('');
  regionSelect.value = previous;
}

function getCategoryLabel(value) {
  const item = categoryOptions.find((c) => c.value === value);
  return item ? (currentLang === 'zh' ? item.zh : item.en) : value;
}

function getRegionLabel(value) {
  const item = regionOptions.find((r) => r.value === value);
  return item ? (currentLang === 'zh' ? item.zh : item.en) : value;
}

function buildSummaryFallback(result) {
  if (result.summary && result.summary.trim()) return result.summary.trim();
  const script = (result.scriptText || '').trim();
  if (!script) return '';
  const parts = script.split(/[\n。！？.!?]/).map((x) => x.trim()).filter(Boolean);
  return parts.slice(0, 2).join(currentLang === 'zh' ? '。' : '. ');
}

function setStatus(text) {
  document.getElementById('status').textContent = text;
}

function startGenerationProgress() {
  const wrap = document.getElementById('genProgress');
  const bar = document.getElementById('genProgressBar');
  const text = document.getElementById('genProgressText');
  const totalMs = 120000;

  generationProgressStartAt = Date.now();
  wrap.style.display = 'block';
  bar.style.width = '0%';
  text.textContent = '0%';

  if (generationProgressTimer) {
    clearInterval(generationProgressTimer);
  }

  generationProgressTimer = setInterval(() => {
    const elapsed = Date.now() - generationProgressStartAt;
    const pct = Math.min(99, Math.floor((elapsed / totalMs) * 99));
    bar.style.width = `${pct}%`;
    text.textContent = `${pct}%`;
    if (currentPendingHistoryId) {
      updateHistoryItem(currentPendingHistoryId, { progress: pct, status: 'generating' });
    }
  }, 200);
}

function stopGenerationProgress(completed) {
  const wrap = document.getElementById('genProgress');
  const bar = document.getElementById('genProgressBar');
  const text = document.getElementById('genProgressText');

  if (generationProgressTimer) {
    clearInterval(generationProgressTimer);
    generationProgressTimer = null;
  }

  if (completed) {
    bar.style.width = '100%';
    text.textContent = '100%';
    setTimeout(() => {
      wrap.style.display = 'none';
    }, 400);
    return;
  }

  wrap.style.display = 'none';
}

function setHistoryMeta(text) {
  document.getElementById('historyMeta').textContent = text;
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || '';
  return date.toLocaleString(currentLang === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function findHistoryItemById(id) {
  return historyItems.find((x) => x.id === id);
}

function updateHistoryItem(id, patch) {
  const idx = historyItems.findIndex((x) => x.id === id);
  if (idx < 0) return;
  historyItems[idx] = { ...historyItems[idx], ...patch };
  renderHistoryList();
}

function removeHistoryItem(id) {
  historyItems = historyItems.filter((x) => x.id !== id);
  renderHistoryList();
}

function makePendingHistoryItem(payload) {
  return {
    id: `pending-${Date.now()}`,
    title: t('pendingTitle'),
    createdAt: new Date().toISOString(),
    input: {
      categories: payload.categories || [],
      startDate: payload.startDate || '',
      endDate: payload.endDate || '',
      language: payload.language || currentLang,
      region: payload.region || 'Global',
    },
    status: 'generating',
    progress: 0,
    isPending: true,
  };
}

function getHistoryStatusInfo(item) {
  if (item.status === 'failed') return { label: t('statusFailed'), progress: item.progress ?? 0 };
  if (item.status === 'generating') return { label: t('statusGenerating'), progress: Math.min(99, item.progress ?? 0) };
  return { label: t('statusCompleted'), progress: 100 };
}

function renderHistoryList() {
  const wrap = document.getElementById('historyList');
  const clearBtn = document.getElementById('clearHistoryBtn');
  wrap.innerHTML = '';

  if (!googleIdToken) {
    historyItems = [];
    setHistoryMeta(t('historyEmpty'));
    clearBtn.style.display = 'none';
    return;
  }

  if (!historyItems.length) {
    setHistoryMeta(t('historyNone'));
    clearBtn.style.display = 'none';
    return;
  }

  clearBtn.style.display = 'inline-block';
  setHistoryMeta('');
  historyItems.forEach((item) => {
    const statusInfo = getHistoryStatusInfo(item);
    const canOpen = !item.isPending && item.status !== 'failed';
    const row = document.createElement('div');
    row.className = 'history-row';
    row.innerHTML = `
      <button class="history-item" type="button" data-action="open" data-id="${item.id}" ${canOpen ? '' : 'disabled'}>
        <strong>${item.title || 'Untitled'}</strong>
        <span>${formatDateTime(item.createdAt)}</span>
        <span>${item.input?.startDate || ''} ~ ${item.input?.endDate || ''} | ${item.input?.region || 'Global'}</span>
        <span class="history-state">${statusInfo.label} · ${statusInfo.progress}%</span>
        <span class="history-progress"><i style="width:${statusInfo.progress}%"></i></span>
      </button>
      <button class="history-delete" type="button" data-action="delete" data-id="${item.id}">${t('deleteOne')}</button>
    `;
    wrap.appendChild(row);
  });
}

async function loadHistory() {
  if (!googleIdToken) {
    renderHistoryList();
    return;
  }

  setHistoryMeta(t('historyLoading'));
  try {
    const resp = await fetch('/api/my/podcasts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: googleIdToken }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      throw new Error(data.error || t('historyLoadFailed'));
    }
    const pendingOrFailed = historyItems.filter((x) => x.isPending || x.status === 'failed');
    historyItems = [...pendingOrFailed, ...(data.items || []).map((x) => ({ ...x, status: 'completed', progress: 100 }))];
    renderHistoryList();
  } catch (err) {
    historyItems = [];
    setHistoryMeta(`${t('historyLoadFailed')}: ${err.message}`);
  }
}

async function openHistoryPodcast(podcastId) {
  const resp = await fetch(`/api/my/podcasts/${podcastId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: googleIdToken }),
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data.error || 'Failed to load podcast');
  }
  renderResult(data);
}

async function deleteHistoryPodcast(podcastId) {
  const resp = await fetch(`/api/my/podcasts/${podcastId}/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: googleIdToken }),
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data.error || 'Delete failed');
  }
}

async function clearAllHistory() {
  const resp = await fetch('/api/my/podcasts/clear-all', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: googleIdToken }),
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data.error || 'Clear failed');
  }
}

function updateAuthUI() {
  const googleBtn = document.getElementById('googleBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const authToggle = document.getElementById('authToggle');
  const isLoggedIn = Boolean(googleIdToken && userProfile);

  googleBtn.style.display = isLoggedIn ? 'none' : 'block';
  logoutBtn.style.display = isLoggedIn ? 'block' : 'none';
  authToggle.textContent = isLoggedIn ? t('me') : t('signIn');
  if (!isLoggedIn) {
    document.getElementById('userInfo').textContent = t('notLoggedIn');
  }
}

function closeAuthPanel() {
  document.getElementById('authPanel').classList.remove('open');
}

function toggleAuthPanel() {
  document.getElementById('authPanel').classList.toggle('open');
}

function persistAuth() {
  if (!googleIdToken || !userProfile) {
    return;
  }
  localStorage.setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify({
      idToken: googleIdToken,
      user: userProfile,
    }),
  );
}

function clearAuth() {
  googleIdToken = '';
  userProfile = null;
  localStorage.removeItem(AUTH_STORAGE_KEY);
  document.getElementById('userInfo').textContent = t('notLoggedIn');
  updateAuthUI();
  renderHistoryList();
}

async function handleGoogleToken(idToken) {
  const resp = await fetch('/api/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data.error || 'Google auth failed');
  }

  googleIdToken = idToken;
  userProfile = data.user;
  document.getElementById('userInfo').textContent = `${data.user.name} (${data.user.email})`;
  persistAuth();
  updateAuthUI();
  closeAuthPanel();
  await loadHistory();
}

window.handleCredentialResponse = async (response) => {
  try {
    await handleGoogleToken(response.credential);
  } catch (err) {
    setStatus(err.message);
  }
};

function initGoogle() {
  const clientId = window.__GOOGLE_CLIENT_ID__;
  if (!clientId || clientId === 'YOUR_GOOGLE_CLIENT_ID') {
    setStatus('Set GOOGLE_CLIENT_ID in .env first');
    return;
  }

  window.google.accounts.id.initialize({
    client_id: clientId,
    callback: window.handleCredentialResponse,
  });

  window.google.accounts.id.renderButton(document.getElementById('googleBtn'), {
    theme: 'outline',
    size: 'large',
    text: 'signin_with',
  });
}

function getFormPayload() {
  const categories = Array.from(document.querySelectorAll('#categories input:checked')).map((x) => x.value);
  const startDate = document.getElementById('startDate').value;
  const endDate = document.getElementById('endDate').value;
  const language = document.getElementById('language').value;
  const region = document.getElementById('region').value;

  return { categories, startDate, endDate, language, region };
}

function setDefaultDateRange() {
  const startInput = document.getElementById('startDate');
  const endInput = document.getElementById('endDate');
  if (!startInput || !endInput || (startInput.value && endInput.value)) {
    return;
  }

  const end = new Date();
  const start = new Date(end);
  start.setMonth(start.getMonth() - 1);

  const toDateValue = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  if (!endInput.value) endInput.value = toDateValue(end);
  if (!startInput.value) startInput.value = toDateValue(start);
}

function renderResult(result) {
  document.getElementById('resultCard').style.display = 'block';
  document.getElementById('podcastTitle').textContent = result.title || '';
  document.getElementById('podcastMeta').textContent =
    `${result.input.startDate} ~ ${result.input.endDate} | ${getRegionLabel(result.input.region || 'Global')} | ${(result.input.categories || []).map(getCategoryLabel).join(', ')} | ${result.input.language}`;
  document.getElementById('summary').textContent = buildSummaryFallback(result);
  document.getElementById('scriptText').textContent = result.scriptText;

  const audio = document.getElementById('audioPlayer');
  audio.src = result.audioUrl;

  const eventsList = document.getElementById('eventsList');
  eventsList.innerHTML = '';
  const events = result.events || [];
  if (!events.length) {
    const li = document.createElement('li');
    li.textContent = t('noEvents');
    eventsList.appendChild(li);
  }
  events.forEach((e) => {
    const li = document.createElement('li');
    li.textContent = `${e.date || ''} [${getCategoryLabel(e.category || '')}] ${e.title || ''} - ${e.whyImportant || ''}`;
    eventsList.appendChild(li);
  });

  lastShareUrl = `${window.location.origin}${result.shareUrl}`;
}

async function generatePodcast() {
  if (!googleIdToken) {
    setStatus(t('needLogin'));
    return;
  }

  const payload = getFormPayload();
  if (!payload.categories.length || !payload.startDate || !payload.endDate) {
    setStatus(t('needForm'));
    return;
  }

  const pending = makePendingHistoryItem(payload);
  currentPendingHistoryId = pending.id;
  historyItems.unshift(pending);
  renderHistoryList();

  setStatus('');
  startGenerationProgress();
  document.getElementById('generateBtn').disabled = true;

  try {
    const resp = await fetch('/api/podcasts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idToken: googleIdToken,
        ...payload,
      }),
    });

    const data = await resp.json();
    if (!resp.ok) {
      throw new Error(data.error || 'Failed to generate podcast');
    }

    if (currentPendingHistoryId) {
      updateHistoryItem(currentPendingHistoryId, { status: 'completed', progress: 100, isPending: false });
    }
    renderResult(data);
    await loadHistory();
    stopGenerationProgress(true);
    setStatus(t('done'));
  } catch (err) {
    if (currentPendingHistoryId) {
      const item = findHistoryItemById(currentPendingHistoryId);
      const failedProgress = Math.max(1, item?.progress || 0);
      updateHistoryItem(currentPendingHistoryId, { status: 'failed', progress: failedProgress, isPending: true });
    }
    stopGenerationProgress(false);
    setStatus(err.message);
  } finally {
    currentPendingHistoryId = null;
    document.getElementById('generateBtn').disabled = false;
  }
}

function bindEvents() {
  document.getElementById('generateBtn').addEventListener('click', generatePodcast);
  document.getElementById('langToggle').addEventListener('click', () => {
    currentLang = currentLang === 'zh' ? 'en' : 'zh';
    applyLanguage();
  });

  document.getElementById('copyLinkBtn').addEventListener('click', async () => {
    if (!lastShareUrl) {
      return;
    }
    await navigator.clipboard.writeText(lastShareUrl);
    setStatus(t('copied'));
  });

  document.getElementById('logoutBtn').addEventListener('click', () => {
    clearAuth();
    if (window.google?.accounts?.id?.disableAutoSelect) {
      window.google.accounts.id.disableAutoSelect();
    }
    setStatus('');
    closeAuthPanel();
  });

  document.getElementById('authToggle').addEventListener('click', (event) => {
    event.stopPropagation();
    toggleAuthPanel();
  });

  document.getElementById('authPanel').addEventListener('click', (event) => {
    event.stopPropagation();
  });

  document.addEventListener('click', () => {
    closeAuthPanel();
  });

  document.getElementById('historyList').addEventListener('click', async (event) => {
    const target = event.target.closest('[data-action][data-id]');
    if (!target?.dataset?.id || !target?.dataset?.action) {
      return;
    }
    try {
      if (target.dataset.action === 'open') {
        const rowItem = findHistoryItemById(target.dataset.id);
        if (rowItem?.isPending || rowItem?.status === 'failed') return;
        await openHistoryPodcast(target.dataset.id);
        setStatus('');
      } else if (target.dataset.action === 'delete') {
        if (!window.confirm(t('confirmDeleteOne'))) return;
        const rowItem = findHistoryItemById(target.dataset.id);
        if (rowItem?.isPending) {
          removeHistoryItem(target.dataset.id);
          setStatus(t('deleteSuccess'));
        } else {
          await deleteHistoryPodcast(target.dataset.id);
          await loadHistory();
          setStatus(t('deleteSuccess'));
        }
      }
    } catch (err) {
      setStatus(err.message);
    }
  });

  document.getElementById('clearHistoryBtn').addEventListener('click', async () => {
    if (!googleIdToken) return;
    if (!window.confirm(t('confirmClearAll'))) return;
    try {
      await clearAllHistory();
      await loadHistory();
      document.getElementById('resultCard').style.display = 'none';
      setStatus(t('clearSuccess'));
    } catch (err) {
      setStatus(err.message);
    }
  });
}

async function restoreAuthFromStorage() {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.idToken) {
      clearAuth();
      return;
    }
    await handleGoogleToken(parsed.idToken);
  } catch (_) {
    clearAuth();
  }
}

async function bootstrap() {
  renderCategories();
  renderRegions();
  applyLanguage();
  bindEvents();
  updateAuthUI();
  renderHistoryList();
  setDefaultDateRange();

  const configResp = await fetch('/api/config');
  const config = await configResp.json();
  window.__GOOGLE_CLIENT_ID__ = config.googleClientId;
  initGoogle();
  await restoreAuthFromStorage();
}

bootstrap();
