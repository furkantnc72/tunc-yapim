const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const socket = io();

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

let totalLikes = 0;
let likeGoal = 54000;
let busy = false;
let replyQueue = [];
let lastSpokenAt = 0;
let autoReplyCooldown = 6500;

const actions = {
  scare: { cls: 'scare', ms: 1500, line: 'Aman! O da neydi?! 😱' },
  dance: { cls: 'dance', ms: 3300, line: 'Tamam tamam, biraz dans edebilirim! 🕺' },
  fall: { cls: 'fall', ms: 1500, line: 'Ayyy! Ayağım kaydı! 😵' },
  hit: { cls: 'hit', ms: 1100, line: 'Cesaretimi topladım... HİYAA! 🥊' },
  jump: { cls: 'jump', ms: 1400, line: 'Yukarı çıkıyorum, belki burada güvendeyim! 😬' },
  spin: { cls: 'spin', ms: 1400, line: 'Başım dönüyorrr! 🌀' },
  'walk-left': { cls: 'walk-left', ms: 2400, line: 'Bir bakıp hemen geri geleceğim... sanırım. 👀' },
  'walk-right': { cls: 'walk-right', ms: 2400, line: 'Bahçede bir şey yoktur değil mi? 🌳' },
  'big-gift': { cls: 'big-gift', ms: 3700, line: 'BU NEYDİ ÖYLE?! Çok teşekkür ederim! 🤯💛' }
};

function setHeadline(text, ms=3000){ headline.textContent = text; clearTimeout(setHeadline.t); setHeadline.t=setTimeout(()=>headline.textContent='SORUNU YAZ, CESUR OKUSUN',ms); }
function showSpeech(text, ms=3200){ speech.textContent=text; speech.classList.remove('hidden'); clearTimeout(showSpeech.t); showSpeech.t=setTimeout(()=>speech.classList.add('hidden'),ms); }
function showCaption(text, ms=3400){ caption.textContent=text; caption.classList.remove('hidden'); clearTimeout(showCaption.t); showCaption.t=setTimeout(()=>caption.classList.add('hidden'),ms); }
function toast(text, ms=2500){ eventToast.textContent=text; clearTimeout(toast.t); toast.t=setTimeout(()=>eventToast.textContent='',ms); }

function animate(actionName, customLine=''){
  const a=actions[actionName] || actions.scare;
  if(busy && actionName!=='scare') return;
  busy=true;
  courage.className=`courage ${a.cls}`;
  const line=customLine || a.line;
  if(line) showSpeech(line, Math.min(a.ms,3200));
  if(actionName==='hit'){
    $('#impact').classList.remove('hidden');
    setTimeout(()=>$('#impact').classList.add('hidden'),550);
  }
  if(actionName==='scare'){
    $('#ghost').classList.remove('hidden');
    setTimeout(()=>$('#ghost').classList.add('hidden'),1200);
  }
  setTimeout(()=>{ courage.className='courage idle'; busy=false; },a.ms);
}

function addChat(user, message, avatar=''){
  const row=document.createElement('div'); row.className='chat-line';
  const pic=avatar?`<img src="${escapeAttr(avatar)}" alt="">`:`<span class="avatar-dot"></span>`;
  row.innerHTML=`${pic}<div><span class="who">${escapeHtml(user)}</span><span class="msg">${escapeHtml(message)}</span></div>`;
  chat.appendChild(row); while(chat.children.length>8) chat.removeChild(chat.firstChild);
}
function escapeHtml(v=''){ return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function escapeAttr(v=''){ return escapeHtml(v).replace(/`/g,''); }

function speak(text){
  if(!$('#ttsToggle').checked || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(text); u.lang='tr-TR'; u.rate=1.08; u.pitch=1.18; u.volume=1;
  const voices=speechSynthesis.getVoices();
  const tr=voices.find(v=>v.lang?.toLowerCase().startsWith('tr')) || voices[0]; if(tr) u.voice=tr;
  u.onstart=()=>{ courage.className='courage talk'; };
  u.onend=()=>{ courage.className='courage idle'; };
  speechSynthesis.speak(u);
}

async function aiReply(user, comment){
  if(!$('#aiToggle').checked) return;
  try{
    const r=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user,comment})});
    const j=await r.json(); if(!r.ok) throw new Error(j.error||'AI hatası');
    const text=j.text || 'Aman!';
    showSpeech(text,4800); showCaption(`Cesur: ${text}`,5000); speak(text);
  }catch(e){ toast(`AI: ${e.message}`); }
}

function maybeReply(user, comment){
  if(!$('#autoReplyToggle').checked) return;
  const now=Date.now();
  if(now-lastSpokenAt<autoReplyCooldown){ replyQueue.push([user,comment]); if(replyQueue.length>6) replyQueue.shift(); return; }
  lastSpokenAt=now; setHeadline('YORUMLARA CEVAP VERİYOR',3800); aiReply(user,comment);
  setTimeout(()=>{
    if(replyQueue.length){ const [u,c]=replyQueue.shift(); maybeReply(u,c); }
  },autoReplyCooldown+200);
}

function hearts(n=5){
  for(let i=0;i<Math.min(n,18);i++) setTimeout(()=>{
    const h=document.createElement('span'); h.className='heart'; h.textContent=['❤️','💗','💖','💛'][Math.floor(Math.random()*4)];
    h.style.right=`${2+Math.random()*10}%`; h.style.animationDuration=`${1.5+Math.random()*1.2}s`; $('.stage').appendChild(h); setTimeout(()=>h.remove(),2800);
  },i*70);
}
function updateLikes(n){ totalLikes=Math.max(totalLikes,n); const pct=Math.min(100,totalLikes/likeGoal*100); likeProgress.style.width=`${pct}%`; likeProgressText.textContent=`${totalLikes.toLocaleString('tr-TR')} / ${likeGoal.toLocaleString('tr-TR')}`; }

function giftReaction(ev){
  const diamonds=Number(ev.diamondCount||0)*Number(ev.repeatCount||1);
  giftAlert.innerHTML=`🎁 <b>${escapeHtml(ev.nickname||ev.user)}</b> ${escapeHtml(ev.giftName||'hediye')} gönderdi ×${ev.repeatCount||1}`;
  giftAlert.classList.remove('hidden'); clearTimeout(giftReaction.t); giftReaction.t=setTimeout(()=>giftAlert.classList.add('hidden'),3500);
  setHeadline('HEDİYE AT, CESUR YAPSIN!',3500);
  if(diamonds>=500) animate('big-gift');
  else if(diamonds>=100) animate('spin');
  else if(diamonds>=50) animate('dance');
  else if(diamonds>=10) animate('fall');
  else animate('scare');
  hearts(Math.max(4,Math.min(18,Math.ceil(diamonds/30)+4)));
}

function handleEvent(ev){
  if(!ev?.type) return;
  if(ev.type==='chat') { addChat(ev.nickname||ev.user,ev.comment,ev.avatar); maybeReply(ev.nickname||ev.user,ev.comment); }
  if(ev.type==='gift') giftReaction(ev);
  if(ev.type==='like') { updateLikes(Number(ev.totalLikeCount||totalLikes+ev.likeCount||1)); hearts(Math.ceil((ev.likeCount||1)/20)); }
  if(ev.type==='follow') { toast(`➕ ${ev.user} takip etti`); animate('dance',`${ev.user}, hoş geldin! 🐾`); }
  if(ev.type==='share') { toast(`↗️ ${ev.user} yayını paylaştı`); hearts(7); }
  if(ev.type==='member') toast(`${ev.user} yayına katıldı`);
  if(ev.type==='roomUser') viewerCount.textContent=Number(ev.viewers||0).toLocaleString('tr-TR');
}

socket.on('tiktok:event',handleEvent);
socket.on('tiktok:status',(s)=>{
  connectionLabel.textContent=s.connected?`@${s.username}`:'TEST MODU';
  statusText.textContent=s.connected?`TikTok LIVE bağlı: @${s.username}`:'TikTok bağlı değil. Test modu kullanılabilir.';
  $('#connectBtn').textContent=s.connected?'Bağlı':'Bağlan';
});
socket.on('tiktok:error',(e)=>toast(`TikTok: ${e.message}`));

$('#connectBtn').addEventListener('click',async()=>{
  const username=$('#username').value.trim(); if(!username){statusText.textContent='Kullanıcı adı gir.';return;}
  statusText.textContent='Bağlanıyor...';
  try{const r=await fetch('/api/connect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username})});const j=await r.json();if(!r.ok)throw new Error(j.error);statusText.textContent=`Bağlandı: @${j.username}`;}catch(e){statusText.textContent=`Bağlantı hatası: ${e.message}`;}
});

$('#settingsToggle').onclick=()=>settings.classList.toggle('closed'); $('#closeSettings').onclick=()=>settings.classList.add('closed');
$$('[data-test-action]').forEach(b=>b.addEventListener('click',()=>animate(b.dataset.testAction)));
$('#sendComment').onclick=()=>{ const msg=$('#testComment').value.trim(); if(!msg)return; handleEvent({type:'chat',user:'test_kullanici',nickname:'test_kullanici',comment:msg}); };
$$('[data-test]').forEach(b=>b.onclick=()=>{
  const t=b.dataset.test;
  if(t==='rose')handleEvent({type:'gift',user:'irem',nickname:'irem',giftName:'Gül',repeatCount:1,diamondCount:1});
  if(t==='donut')handleEvent({type:'gift',user:'mert',nickname:'mert',giftName:'Donut',repeatCount:1,diamondCount:75});
  if(t==='galaxy')handleEvent({type:'gift',user:'zeynep',nickname:'zeynep',giftName:'Galaxy',repeatCount:1,diamondCount:1000});
  if(t==='follow')handleEvent({type:'follow',user:'yeni_takipci'});
  if(t==='likes')handleEvent({type:'like',user:'izleyici',likeCount:1000,totalLikeCount:totalLikes+1000});
  if(t==='share')handleEvent({type:'share',user:'paylasan'});
});

addChat('Ece','Cesur arkanda biri var 😭');
addChat('Mert','Korkma biz buradayız ❤️');
addChat('Deniz','Bahçeye git! 👀');
updateLikes(35358);
setTimeout(()=>animate('scare','B-bir şey duydum sanki... 👀'),1200);
