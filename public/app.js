const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const socket = io();

const stage = $('#stage');
const actor = $('#actor');
const courage = $('#courage');
const speech = $('#speech');
const caption = $('#caption');
const giftAlert = $('#giftAlert');
const chat = $('#chat');
const eventToast = $('#eventToast');
const headline = $('#headline');
const viewerCount = $('#viewerCount');
const likeProgress = $('#likeProgress');
const likeProgressText = $('#likeProgressText');
const settings = $('#settings');
const statusText = $('#statusText');
const connectionLabel = $('#connectionLabel');
const particleLayer = $('#particleLayer');
const actionChip = $('#actionChip');
const ghost = $('#ghost');
const impact = $('#impact');
const zzz = $('#zzz');

let totalLikes = 0;
let likeGoal = 54000;
let actionQueue = [];
let currentAction = null;
let replyQueue = [];
let lastSpokenAt = 0;
let autoReplyCooldown = 6500;
let idleTimer = null;
let randomMotionTimer = null;

const defaultHeadline = 'SORUNU YAZ, CESUR OKUSUN';
const defaultStateClass = 'idle';

const actions = {
  idle: { cls: 'idle', ms: 2200, label: 'Boşta', line: '' },
  talk: { cls: 'talk', ms: 1800, label: 'Konuşuyor', line: '' },
  scare: { cls: 'scare', ms: 1550, label: 'Korkuyor', line: 'Aman! O da neydi?! 😱' },
  dance: { cls: 'dance', ms: 3400, label: 'Dans ediyor', line: 'Tamam tamam, biraz dans edebilirim! 🕺' },
  fall: { cls: 'fall', ms: 1700, label: 'Düştü', line: 'Ayyy! Ayağım kaydı! 😵' },
  hit: { cls: 'hit', ms: 1250, label: 'Atak', line: 'Cesaretimi topladım... HİYAA! 🥊' },
  jump: { cls: 'jump', ms: 1450, label: 'Zıplıyor', line: 'Yukarı çıkıyorum, belki burada güvendeyim! 😬' },
  spin: { cls: 'spin', ms: 1500, label: 'Çıldırdı', line: 'Başım dönüyorrr! 🌀' },
  'walk-left': { cls: 'walk-left', ms: 2600, label: 'Sola gitti', line: 'Bir bakıp hemen geri geleceğim... sanırım. 👀' },
  'walk-right': { cls: 'walk-right', ms: 2600, label: 'Sağa gitti', line: 'Bahçede bir şey yoktur değil mi? 🌳' },
  'big-gift': { cls: 'big-gift', ms: 3800, label: 'Mega hediye', line: 'BU NEYDİ ÖYLE?! Çok teşekkür ederim! 🤯💛' },
  'panic-run': { cls: 'panic-run', ms: 2800, label: 'Panik koşu', line: 'Kaç kaç kaç! Beni yalnız bırakmayın! 🏃' },
  sleep: { cls: 'sleep', ms: 3600, label: 'Uyuyor', line: 'Bir dakika... biraz uyursam daha az korkarım... 😴' },
  laugh: { cls: 'laugh', ms: 1800, label: 'Gülüyor', line: 'Hihihi... aslında komikmiş 😅' },
  celebrate: { cls: 'celebrate', ms: 2600, label: 'Kutluyor', line: 'Yaşasın! Bu sefer korkmadım galiba! 🎉' },
  wobble: { cls: 'wobble', ms: 1300, label: 'Sendeledi', line: 'Bir an dengesiz kaldım! 😵‍💫' }
};

const idleMotions = ['scare', 'walk-left', 'walk-right', 'wobble', 'laugh', 'jump', 'sleep'];

function setHeadline(text, ms = 3000) {
  headline.textContent = text;
  clearTimeout(setHeadline.t);
  setHeadline.t = setTimeout(() => {
    headline.textContent = defaultHeadline;
  }, ms);
}

function showSpeech(text, ms = 3200) {
  speech.textContent = text;
  speech.classList.remove('hidden');
  clearTimeout(showSpeech.t);
  showSpeech.t = setTimeout(() => speech.classList.add('hidden'), ms);
}

function showCaption(text, ms = 3400) {
  caption.textContent = text;
  caption.classList.remove('hidden');
  clearTimeout(showCaption.t);
  showCaption.t = setTimeout(() => caption.classList.add('hidden'), ms);
}

function toast(text, ms = 2500) {
  eventToast.textContent = text;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (eventToast.textContent = ''), ms);
}

function showActionChip(text, ms = 1400) {
  actionChip.textContent = text;
  actionChip.classList.remove('hidden');
  clearTimeout(showActionChip.t);
  showActionChip.t = setTimeout(() => actionChip.classList.add('hidden'), ms);
}

function clearFX() {
  ghost.classList.add('hidden');
  impact.classList.add('hidden');
  zzz.classList.add('hidden');
  stage.classList.remove('shake');
}

function emitParticles(kind = 'confetti', count = 10) {
  const map = {
    hearts: ['❤️', '💖', '💗', '💛'],
    stars: ['✨', '⭐', '🌟'],
    confetti: ['🎉', '✨', '🎊'],
    panic: ['💨', '⚡', '❗'],
    sleep: ['💤', '⭐']
  };
  const source = map[kind] || map.confetti;
  for (let i = 0; i < count; i += 1) {
    const el = document.createElement('span');
    el.className = `particle ${kind}`;
    el.textContent = source[Math.floor(Math.random() * source.length)];
    el.style.left = `${8 + Math.random() * 84}%`;
    el.style.top = `${45 + Math.random() * 32}%`;
    el.style.animationDuration = `${1.7 + Math.random() * 1.2}s`;
    el.style.setProperty('--dx', `${-70 + Math.random() * 140}px`);
    el.style.setProperty('--dy', `${-140 - Math.random() * 110}px`);
    particleLayer.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }
}

function setActorState(name) {
  actor.className = `character-actor ${name}`;
}

function finishAction() {
  currentAction = null;
  setActorState(defaultStateClass);
  clearFX();
  if (actionQueue.length) {
    runAction(actionQueue.shift());
    return;
  }
  scheduleIdleMotion();
}

function queueAction(name, opts = {}) {
  if (!actions[name]) name = 'scare';
  const payload = { name, ...opts };
  if (currentAction) {
    actionQueue.push(payload);
    return;
  }
  runAction(payload);
}

function runAction(payload) {
  const { name, customLine = '', silent = false, preserveSpeech = false } = payload;
  const a = actions[name] || actions.scare;
  currentAction = name;
  clearTimeout(idleTimer);
  clearTimeout(randomMotionTimer);
  clearFX();
  setActorState(a.cls);
  showActionChip(a.label, Math.min(a.ms, 1800));
  if (!silent) {
    const line = customLine || a.line;
    if (line && !preserveSpeech) showSpeech(line, Math.min(3800, a.ms + 400));
  }

  if (name === 'hit') {
    impact.classList.remove('hidden');
  }
  if (name === 'scare' || name === 'panic-run') {
    ghost.classList.remove('hidden');
    stage.classList.add('shake');
  }
  if (name === 'sleep') {
    zzz.classList.remove('hidden');
    emitParticles('sleep', 7);
  }
  if (name === 'dance' || name === 'celebrate') emitParticles('confetti', 14);
  if (name === 'big-gift') {
    stage.classList.add('shake');
    emitParticles('confetti', 22);
    emitParticles('hearts', 8);
  }
  if (name === 'panic-run') emitParticles('panic', 10);
  if (name === 'laugh') emitParticles('stars', 6);

  idleTimer = setTimeout(finishAction, a.ms);
}

function addChat(user, message, avatar = '') {
  const row = document.createElement('div');
  row.className = 'chat-line';
  const pic = avatar ? `<img src="${escapeAttr(avatar)}" alt="">` : `<span class="avatar-dot"></span>`;
  row.innerHTML = `${pic}<div><span class="who">${escapeHtml(user)}</span><span class="msg">${escapeHtml(message)}</span></div>`;
  chat.appendChild(row);
  while (chat.children.length > 8) chat.removeChild(chat.firstChild);
}

function escapeHtml(v = '') {
  return String(v).replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function escapeAttr(v = '') {
  return escapeHtml(v).replace(/`/g, '');
}

function speak(text) {
  if (!$('#ttsToggle').checked || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'tr-TR';
  u.rate = 1.08;
  u.pitch = 1.18;
  u.volume = 1;
  const voices = speechSynthesis.getVoices();
  const tr = voices.find((v) => v.lang?.toLowerCase().startsWith('tr')) || voices[0];
  if (tr) u.voice = tr;
  u.onstart = () => {
    if (!currentAction) setActorState('talk');
  };
  u.onend = () => {
    if (!currentAction) setActorState(defaultStateClass);
  };
  speechSynthesis.speak(u);
}

async function aiReply(user, comment) {
  if (!$('#aiToggle').checked) return;
  try {
    const r = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user, comment })
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'AI hatası');
    const text = j.text || 'Aman!';
    showSpeech(text, 4800);
    showCaption(`Cesur: ${text}`, 5000);
    speak(text);
  } catch (e) {
    toast(`AI: ${e.message}`);
  }
}

function maybeReply(user, comment) {
  if (!$('#autoReplyToggle').checked) return;
  const now = Date.now();
  if (now - lastSpokenAt < autoReplyCooldown) {
    replyQueue.push([user, comment]);
    if (replyQueue.length > 6) replyQueue.shift();
    return;
  }
  lastSpokenAt = now;
  setHeadline('YORUMLARA CEVAP VERİYOR', 3800);
  aiReply(user, comment);
  const lower = String(comment).toLowerCase();
  if (/(kaç|koş|arkanda|hayalet|kork)/.test(lower)) queueAction('panic-run', { silent: true });
  else if (/(dans|oyna)/.test(lower)) queueAction('dance', { silent: true });
  else if (/(uyu|uyku)/.test(lower)) queueAction('sleep', { silent: true });
  else if (/(gül|komik)/.test(lower)) queueAction('laugh', { silent: true });
  else queueAction('scare', { silent: true });

  setTimeout(() => {
    if (replyQueue.length) {
      const [u, c] = replyQueue.shift();
      maybeReply(u, c);
    }
  }, autoReplyCooldown + 200);
}

function hearts(n = 5) {
  emitParticles('hearts', Math.min(n, 18));
}

function updateLikes(n) {
  totalLikes = Math.max(totalLikes, n);
  const pct = Math.min(100, (totalLikes / likeGoal) * 100);
  likeProgress.style.width = `${pct}%`;
  likeProgressText.textContent = `${totalLikes.toLocaleString('tr-TR')} / ${likeGoal.toLocaleString('tr-TR')}`;
}

function giftReaction(ev) {
  const diamonds = Number(ev.diamondCount || 0) * Number(ev.repeatCount || 1);
  giftAlert.innerHTML = `🎁 <b>${escapeHtml(ev.nickname || ev.user)}</b> ${escapeHtml(ev.giftName || 'hediye')} gönderdi ×${ev.repeatCount || 1}`;
  giftAlert.classList.remove('hidden');
  clearTimeout(giftReaction.t);
  giftReaction.t = setTimeout(() => giftAlert.classList.add('hidden'), 3500);
  setHeadline('HEDİYE AT, CESUR YAPSIN!', 3500);

  if (diamonds >= 500) {
    queueAction('big-gift');
    queueAction('celebrate', { silent: true });
    queueAction('spin', { silent: true });
  } else if (diamonds >= 100) {
    queueAction('dance');
    queueAction('spin', { silent: true });
  } else if (diamonds >= 50) {
    queueAction('celebrate');
  } else if (diamonds >= 10) {
    queueAction('fall');
  } else {
    queueAction('scare');
  }
  hearts(Math.max(4, Math.min(18, Math.ceil(diamonds / 30) + 4)));
}

function handleEvent(ev) {
  if (!ev?.type) return;
  if (ev.type === 'chat') {
    addChat(ev.nickname || ev.user, ev.comment, ev.avatar);
    maybeReply(ev.nickname || ev.user, ev.comment);
  }
  if (ev.type === 'gift') giftReaction(ev);
  if (ev.type === 'like') {
    updateLikes(Number(ev.totalLikeCount || totalLikes + (ev.likeCount || 1)));
    hearts(Math.ceil((ev.likeCount || 1) / 20));
    if ((ev.likeCount || 0) >= 500) queueAction('dance', { silent: true });
  }
  if (ev.type === 'follow') {
    toast(`➕ ${ev.user} takip etti`);
    queueAction('celebrate', { customLine: `${ev.user}, hoş geldin! 🐾` });
  }
  if (ev.type === 'share') {
    toast(`↗️ ${ev.user} yayını paylaştı`);
    emitParticles('confetti', 10);
    queueAction('jump', { customLine: 'Paylaşım mı? Amanın, daha çok kişi geliyor! 😳' });
  }
  if (ev.type === 'member') toast(`${ev.user} yayına katıldı`);
  if (ev.type === 'roomUser') viewerCount.textContent = Number(ev.viewers || 0).toLocaleString('tr-TR');
}

function scheduleIdleMotion() {
  if (!$('#autoMotionToggle')?.checked) return;
  clearTimeout(randomMotionTimer);
  randomMotionTimer = setTimeout(() => {
    if (currentAction) return;
    const pick = idleMotions[Math.floor(Math.random() * idleMotions.length)];
    queueAction(pick, { silent: pick !== 'sleep' });
  }, 7000 + Math.random() * 5000);
}

socket.on('tiktok:event', handleEvent);
socket.on('tiktok:status', (s) => {
  connectionLabel.textContent = s.connected ? `@${s.username}` : 'TEST MODU';
  statusText.textContent = s.connected ? `TikTok LIVE bağlı: @${s.username}` : 'TikTok bağlı değil. Test modu kullanılabilir.';
  $('#connectBtn').textContent = s.connected ? 'Bağlı' : 'Bağlan';
});
socket.on('tiktok:error', (e) => toast(`TikTok: ${e.message}`));

$('#connectBtn').addEventListener('click', async () => {
  const username = $('#username').value.trim();
  if (!username) {
    statusText.textContent = 'Kullanıcı adı gir.';
    return;
  }
  statusText.textContent = 'Bağlanıyor...';
  try {
    const r = await fetch('/api/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error);
    statusText.textContent = `Bağlandı: @${j.username}`;
  } catch (e) {
    statusText.textContent = `Bağlantı hatası: ${e.message}`;
  }
});

$('#settingsToggle').onclick = () => settings.classList.toggle('closed');
$('#closeSettings').onclick = () => settings.classList.add('closed');
$$('[data-test-action]').forEach((b) => b.addEventListener('click', () => queueAction(b.dataset.testAction)));
$('#sendComment').onclick = () => {
  const msg = $('#testComment').value.trim();
  if (!msg) return;
  handleEvent({ type: 'chat', user: 'test_kullanici', nickname: 'test_kullanici', comment: msg });
};
$$('[data-test]').forEach((b) => (b.onclick = () => {
  const t = b.dataset.test;
  if (t === 'rose') handleEvent({ type: 'gift', user: 'irem', nickname: 'irem', giftName: 'Gül', repeatCount: 1, diamondCount: 1 });
  if (t === 'donut') handleEvent({ type: 'gift', user: 'mert', nickname: 'mert', giftName: 'Donut', repeatCount: 1, diamondCount: 75 });
  if (t === 'galaxy') handleEvent({ type: 'gift', user: 'zeynep', nickname: 'zeynep', giftName: 'Galaxy', repeatCount: 1, diamondCount: 1000 });
  if (t === 'follow') handleEvent({ type: 'follow', user: 'yeni_takipci' });
  if (t === 'likes') handleEvent({ type: 'like', user: 'izleyici', likeCount: 1000, totalLikeCount: totalLikes + 1000 });
  if (t === 'share') handleEvent({ type: 'share', user: 'paylasan' });
}));
$('#autoMotionToggle')?.addEventListener('change', scheduleIdleMotion);

addChat('Ece', 'Cesur arkanda biri var 😭');
addChat('Mert', 'Korkma biz buradayız ❤️');
addChat('Deniz', 'Bahçeye git! 👀');
updateLikes(35358);
setTimeout(() => queueAction('scare', { customLine: 'B-bir şey duydum sanki... 👀' }), 1200);
scheduleIdleMotion();
