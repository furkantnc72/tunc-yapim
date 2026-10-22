import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { TikTokLiveConnection, WebcastEvent, ControlEvent } from 'tiktok-live-connector';

const PORT = Number(process.env.PORT || 3000);
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.json({ limit: '1mb' }));
app.use(express.static('public'));

let liveConnection = null;
let connectedUsername = null;
let lastRoomState = { viewers: 0, likes: 0 };

function safeUser(data = {}) {
  return data.uniqueId || data.user?.uniqueId || data.nickname || data.user?.nickname || 'izleyici';
}

function cleanUsername(value = '') {
  return String(value).trim().replace(/^@/, '').replace(/[^a-zA-Z0-9._]/g, '').slice(0, 64);
}

async function disconnectTikTok() {
  try { liveConnection?.disconnect?.(); } catch {}
  liveConnection = null;
  connectedUsername = null;
}

async function connectTikTok(username) {
  const clean = cleanUsername(username);
  if (!clean) throw new Error('Geçerli TikTok kullanıcı adı gir.');
  if (liveConnection && connectedUsername === clean) return;
  await disconnectTikTok();

  const conn = new TikTokLiveConnection(clean, { enableExtendedGiftInfo: true });
  liveConnection = conn;
  connectedUsername = clean;

  conn.on(ControlEvent.CONNECTED, (state) => {
    io.emit('tiktok:status', { connected: true, username: clean, roomId: state?.roomId || null });
  });

  conn.on(ControlEvent.DISCONNECTED, () => {
    io.emit('tiktok:status', { connected: false, username: clean, reason: 'Bağlantı kesildi' });
  });

  conn.on(ControlEvent.ERROR, (err) => {
    io.emit('tiktok:error', { message: err?.message || String(err) });
  });

  conn.on(WebcastEvent.CHAT, (data) => {
    io.emit('tiktok:event', {
      type: 'chat', user: safeUser(data), nickname: data.nickname || data.user?.nickname || safeUser(data),
      avatar: data.profilePictureUrl || data.user?.profilePicture?.urlList?.[0] || '',
      comment: data.comment || '', ts: Date.now()
    });
  });

  conn.on(WebcastEvent.GIFT, (data) => {
    const info = data.extendedGiftInfo || data.giftDetails || {};
    const repeatEnd = data.repeatEnd ?? data.repeat_end ?? 1;
    if (data.giftType === 1 && !repeatEnd) return;
    io.emit('tiktok:event', {
      type: 'gift', user: safeUser(data), nickname: data.nickname || data.user?.nickname || safeUser(data),
      avatar: data.profilePictureUrl || data.user?.profilePicture?.urlList?.[0] || '',
      giftId: data.giftId || info.id || null,
      giftName: info.name || data.giftName || `Hediye #${data.giftId || '?'}`,
      repeatCount: Number(data.repeatCount || 1),
      diamondCount: Number(info.diamondCount || data.diamondCount || 0),
      giftPictureUrl: info.image?.urlList?.[0] || info.icon?.urlList?.[0] || '',
      ts: Date.now()
    });
  });

  conn.on(WebcastEvent.LIKE, (data) => {
    lastRoomState.likes = Number(data.totalLikeCount || lastRoomState.likes || 0);
    io.emit('tiktok:event', {
      type: 'like', user: safeUser(data), likeCount: Number(data.likeCount || 1), totalLikeCount: lastRoomState.likes, ts: Date.now()
    });
  });

  conn.on(WebcastEvent.FOLLOW, (data) => io.emit('tiktok:event', { type: 'follow', user: safeUser(data), ts: Date.now() }));
  conn.on(WebcastEvent.SHARE, (data) => io.emit('tiktok:event', { type: 'share', user: safeUser(data), ts: Date.now() }));
  conn.on(WebcastEvent.MEMBER, (data) => io.emit('tiktok:event', { type: 'member', user: safeUser(data), ts: Date.now() }));
  conn.on(WebcastEvent.ROOM_USER, (data) => {
    lastRoomState.viewers = Number(data.viewerCount || data.userCount || 0);
    io.emit('tiktok:event', { type: 'roomUser', viewers: lastRoomState.viewers, ts: Date.now() });
  });

  await conn.connect();
}

app.post('/api/connect', async (req, res) => {
  try {
    await connectTikTok(req.body?.username);
    res.json({ ok: true, username: connectedUsername });
  } catch (err) {
    await disconnectTikTok();
    res.status(400).json({ ok: false, error: err?.message || String(err) });
  }
});

app.post('/api/disconnect', async (_req, res) => {
  await disconnectTikTok();
  io.emit('tiktok:status', { connected: false });
  res.json({ ok: true });
});

app.get('/api/status', (_req, res) => {
  res.json({ connected: Boolean(liveConnection), username: connectedUsername, ...lastRoomState, ai: Boolean(process.env.OPENAI_API_KEY) });
});

const SYSTEM_PROMPT = `Sen TikTok canlı yayınında Cesur adlı korkak ama komik bir çizgi köpeksin. Türkçe konuş. İzleyicinin yorumuna 1-2 kısa cümleyle eğlenceli, aile dostu ve canlı yayına uygun cevap ver. Korkak, şaşkın ve sevimli bir kişiliğin olsun. Küfür, hakaret, cinsel içerik, tehlikeli yönlendirme ve kişisel veri isteme. Gerektiğinde yorumdaki kullanıcı adına seslen. Cevap en fazla 140 karakter olsun.`;

app.post('/api/ai', async (req, res) => {
  const comment = String(req.body?.comment || '').trim().slice(0, 500);
  const user = String(req.body?.user || 'izleyici').trim().slice(0, 80);
  if (!comment) return res.status(400).json({ error: 'Yorum boş.' });

  if (!process.env.OPENAI_API_KEY) {
    const fallbacks = [
      `${user}, aman öyle deme! Ben zaten korkuyorum 😰`,
      `${user}, bunu duyunca tüylerim diken diken oldu! 😳`,
      `B-ben mi? Tabii ki korkmadım... sadece biraz titriyorum! 😅`,
      `${user}, sen yanımdaysan belki cesaret ederim! 🐾`,
      `Dur bir dakika... arkadan bir ses geldi sanki! 👀`
    ];
    return res.json({ text: fallbacks[Math.floor(Math.random() * fallbacks.length)], fallback: true });
  }

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-5.1-mini',
        instructions: SYSTEM_PROMPT,
        input: `${user}: ${comment}`,
        max_output_tokens: 90
      })
    });
    if (!response.ok) throw new Error(`AI API ${response.status}`);
    const json = await response.json();
    const text = String(json.output_text || '').trim();
    res.json({ text: text || 'Aman! Bir an ne diyeceğimi unuttum 😅' });
  } catch (err) {
    res.status(502).json({ error: err?.message || String(err) });
  }
});

io.on('connection', (socket) => {
  socket.emit('tiktok:status', { connected: Boolean(liveConnection), username: connectedUsername });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Cesur TikTok AI: http://localhost:${PORT}`);
});
