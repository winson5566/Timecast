const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const { existsSync } = require('fs');
const dotenv = require('dotenv');
const { OAuth2Client } = require('google-auth-library');
const { v4: uuidv4 } = require('uuid');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'podcasts.json');
const AUDIO_DIR = path.join(__dirname, 'public', 'audio');

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

async function ensureStorage() {
  if (!existsSync(DATA_FILE)) {
    await fs.writeFile(DATA_FILE, '[]', 'utf8');
  }
}

async function readPodcasts() {
  await ensureStorage();
  const raw = await fs.readFile(DATA_FILE, 'utf8');
  return JSON.parse(raw);
}

async function writePodcasts(list) {
  await fs.writeFile(DATA_FILE, JSON.stringify(list, null, 2), 'utf8');
}

async function removeAudioIfLocal(audioUrl) {
  if (!audioUrl || typeof audioUrl !== 'string' || !audioUrl.startsWith('/audio/')) {
    return;
  }
  const fileName = path.basename(audioUrl);
  const fullPath = path.join(AUDIO_DIR, fileName);
  try {
    await fs.unlink(fullPath);
  } catch (_) {
    // Ignore missing files or unlink issues to avoid blocking record deletion.
  }
}

async function verifyGoogleIdToken(idToken) {
  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new Error('Missing GOOGLE_CLIENT_ID in environment');
  }

  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  if (!payload || !payload.email) {
    throw new Error('Invalid Google token payload');
  }

  return {
    googleSub: payload.sub,
    name: payload.name || 'Unknown',
    email: payload.email,
    picture: payload.picture || null,
  };
}

function buildNewsPrompt({ categories, startDate, endDate, language, region }) {
  const langText = language === 'zh' ? '中文' : 'English';

  return [
    `你是资深新闻编辑与研究助手。目标：围绕指定时间段与地区，整理“权威 + 重要 + 有趣”的历史新闻条目，形成可用于播客的事件清单。`,
    ``,
    `时间范围: ${startDate} 到 ${endDate}`,
    `国家/地区重点: ${region || 'Global'}`,
    `关注分类: ${categories.join('、')}`,
    `输出语言: ${langText}`,
    ``,
    `硬性规则（必须遵守）：`,
    `1) 做事件去重：同一事件多家媒体报道要合并成 1 条（可在 sources 中补充其他来源）。`,
    `2) 质量优先：优先选择权威媒体、信息密度高、影响面大、具有长期意义或“转折点”属性的事件。`,
    `3) 每条尽量给出可信来源媒体和链接。`,
    `4) 至少 10 条，最多 30 条。`,
    `5) 按主题均衡覆盖（比如 3–5 个主题）。`,
    ``,
    `评估标准（用于排序，写进你的判断而不是输出公式）：`,
    `- 权威性：媒体可信度、是否一手信息/可靠引用`,
    `- 重要性：影响范围、对行业/社会的后果`,
    `- 可讲性：能否用 30–60 秒讲清楚`,
    ``,
    `输出格式：只输出 JSON 数组，每个元素包含字段：`,
    `- title: 口播友好的一句话标题（原创改写）`,
    `- date: ISO 日期（YYYY-MM-DD）`,
    `- category: 从关注分类中选 1 个最贴切的`,
    `- whyImportant: 1–2 句说明“为什么值得在这个时间段回看”`,
    `- sourceName: 主来源媒体名`,
    `- url: 主来源链接`,
    `- sources: 可选，数组，列出同一事件的其他来源 {sourceName, url}`,
    ``,
    `禁止输出“无法联网/无法访问实时新闻源/请允许我检索”等元信息。`,
  ].join('\n');
}

function buildPodcastPrompt({ language, categories, startDate, endDate, region, events }) {
  const langName = language === 'zh' ? '中文' : 'English';

  return [
    `You are an experienced news podcast host and editor.`,
    `Create a scripted single-host news podcast in ${langName}.`,
    ``,
    `Time range: ${startDate} to ${endDate}.`,
    `Geographic focus: ${region || 'Global'}.`,
    `Selected categories: ${categories.join(', ')}.`,
    ``,
    `Requirements:`,
    `- Use ONLY the events provided below as factual anchors.`,
    `- Do NOT list news chronologically; group into 3-5 themes.`,
    `- Single narrator only.`,
    `- Do NOT include "来源：xxx" / "Source: xxx" in scriptText.`,
    `- title must be meaningful and based on the script content, in ${langName}.`,
    `- summary must be 2-3 sentences, in ${langName}.`,
    `- scriptText must be a ready-to-read monologue.`,
    ``,
    `Length target: 4-6 minutes speaking time.`,
    ``,
    `Return JSON object with keys: title, summary, scriptText, keyPoints.`,
    ``,
    `Events JSON: ${JSON.stringify(events)}`,
  ].join('\n');
}


function normalizeToMonologue(text) {
  if (!text) return '';
  const cleaned = text
    .replace(/来源[:：][^\n。！？!?]*(?:[。！？!?]|$)/g, '')
    .replace(/Source[:：][^\n.?!]*(?:[.?!]|$)/gi, '');
  const lines = cleaned
    .split('\n')
    .map((line) =>
      line
        .replace(/^\s*(host\s*[ab]|主播[ab甲乙]?|a|b)\s*[:：]\s*/i, '')
        .replace(/^\s*[-*]\s*/, '')
        .trim(),
    )
    .filter(Boolean);
  return lines.join('\n\n');
}

function buildFallbackScriptFromEvents({ language, region, startDate, endDate, events }) {
  const top = (events || []).slice(0, 8);
  if (!top.length) {
    return '';
  }

  if (language === 'zh') {
    const intro = `早上好，这里是 Timecast。今天我们回看 ${startDate} 到 ${endDate}，重点地区是 ${region || 'Global'}。以下是这个时间段最值得关注的新闻脉络。`;
    const lines = top.map((e, i) => {
      return `第${i + 1}条，${e.title}。${e.whyImportant || ''}`;
    });
    return [intro, ...lines, '以上是本期历史新闻回顾，我们下期再见。'].join('\n\n');
  }

  const intro = `Good morning, this is Timecast. Today we review ${startDate} to ${endDate}, with a focus on ${region || 'Global'}. Here are the key stories from that period.`;
  const lines = top.map((e, i) => {
    return `Story ${i + 1}: ${e.title}. ${e.whyImportant || ''}`;
  });
  return [intro, ...lines, 'That wraps up this historical news briefing. See you next time.'].join('\n\n');
}

function buildFallbackTitleAndSummary({ language, startDate, endDate, region, events, scriptText, title, summary }) {
  const first = events?.[0]?.title || (language === 'zh' ? '历史新闻回顾' : 'Historical News Briefing');
  const safeTitle = (title || '').trim();
  const safeSummary = (summary || '').trim();

  const generatedTitle =
    safeTitle && !/^generated podcast$/i.test(safeTitle)
      ? safeTitle
      : language === 'zh'
      ? `回看${startDate}至${endDate}：${first.slice(0, 24)}`
      : `Revisiting ${startDate} to ${endDate}: ${first.slice(0, 48)}`;

  let generatedSummary = safeSummary;
  if (!generatedSummary) {
    const lines = (scriptText || '').split(/[\n。！？.!?]/).map((x) => x.trim()).filter(Boolean);
    if (lines.length >= 2) {
      generatedSummary = language === 'zh' ? `${lines[0]}。${lines[1]}。` : `${lines[0]}. ${lines[1]}.`;
    } else {
      generatedSummary =
        language === 'zh'
          ? `本期回顾 ${startDate} 至 ${endDate} 的${region || 'Global'}新闻脉络，围绕重点事件提炼核心变化与影响。`
          : `This episode reviews key ${region || 'Global'} stories from ${startDate} to ${endDate}, focusing on major shifts and their impact.`;
    }
  }

  return { generatedTitle, generatedSummary };
}

function parseJsonLoose(text, fallback) {
  try {
    return JSON.parse(text);
  } catch (_) {
    const cleaned = text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
    try {
      return JSON.parse(cleaned);
    } catch (_) {
      return fallback;
    }
  }
}

function pcm16ToWavBuffer(pcmBuffer, sampleRate = 24000, channels = 1) {
  const bitsPerSample = 16;
  const blockAlign = (channels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcmBuffer.length;
  const wav = Buffer.alloc(44 + dataSize);

  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write('WAVE', 8);
  wav.write('fmt ', 12);
  wav.writeUInt32LE(16, 16); // PCM chunk size
  wav.writeUInt16LE(1, 20); // PCM format
  wav.writeUInt16LE(channels, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(byteRate, 28);
  wav.writeUInt16LE(blockAlign, 32);
  wav.writeUInt16LE(bitsPerSample, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(dataSize, 40);
  pcmBuffer.copy(wav, 44);

  return wav;
}

function normalizeEvents(payload) {
  const rawList = Array.isArray(payload) ? payload : Array.isArray(payload?.events) ? payload.events : [];
  return rawList
    .map((item) => ({
      title: item?.title || '',
      date: item?.date || '',
      category: item?.category || '',
      whyImportant: item?.whyImportant || item?.reason || '',
      sourceName: item?.sourceName || '',
      url: item?.url || '',
      sources: Array.isArray(item?.sources) ? item.sources : [],
    }))
    .filter((item) => {
      if (!item.title) return false;
      const text = `${item.title} ${item.whyImportant} ${item.sourceName}`.toLowerCase();
      if (text.includes('无法访问') || text.includes('cannot access') || text.includes('system prompt') || text.includes('系统提示')) {
        return false;
      }
      return true;
    });
}

function getGeminiApiVersions() {
  const configured = (process.env.GEMINI_API_VERSION || '').trim();
  return [...new Set([configured, 'v1', 'v1beta'].filter(Boolean))];
}

function getGeminiTextModels() {
  const configured = (process.env.GEMINI_MODEL || '').replace(/^models\//, '').trim();
  return [...new Set([configured, 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'].filter(Boolean))];
}

function getGeminiTtsModels() {
  const configured = (process.env.GEMINI_TTS_MODEL || '').replace(/^models\//, '').trim();
  return [
    ...new Set([configured, 'gemini-2.5-flash-preview-tts', 'gemini-2.5-pro-preview-tts'].filter(Boolean)),
  ];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGeminiText(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY in environment');
  }

  const apiVersions = getGeminiApiVersions();
  const modelCandidates = getGeminiTextModels();

  let lastError = 'Unknown Gemini error';
  for (const apiVersion of apiVersions) {
    for (const model of modelCandidates) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        const endpoint = `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
            },
          }),
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          const msg = payload?.error?.message || `HTTP ${response.status}`;
          lastError = `${apiVersion}/${model}#${attempt}: ${msg}`;
          if (response.status === 503 || response.status === 429 || response.status >= 500) {
            if (attempt < 2) {
              await sleep(600 * attempt);
              continue;
            }
            break;
          }
          if (response.status === 404 || response.status === 400) {
            break;
          }
          throw new Error(`Gemini request failed (${response.status}) on ${apiVersion}/${model}: ${msg}`);
        }

        const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (text) {
          return text;
        }
        lastError = `${apiVersion}/${model}#${attempt}: empty content`;
        if (attempt < 2) {
          await sleep(300);
          continue;
        }
      }
    }
  }

  throw new Error(`Gemini request failed after version/model fallback. ${lastError}`);
}

async function getEventsFromGemini(input) {
  const prompt = buildNewsPrompt(input);
  const text = await callGeminiText(prompt);
  let events = normalizeEvents(parseJsonLoose(text, []));
  if (events.length > 0) {
    return {
      events,
      llmNewsDebug: {
        provider: 'gemini',
        prompt,
        firstRaw: text,
        retryRaw: null,
      },
    };
  }

  const retryText = await callGeminiText(`${prompt}\n\n补充要求：必须返回至少 8 条，不能为空数组。`);
  events = normalizeEvents(parseJsonLoose(retryText, []));
  return {
    events,
    llmNewsDebug: {
      provider: 'gemini',
      prompt,
      firstRaw: text,
      retryRaw: retryText,
    },
  };
}

async function getPodcastScriptFromGemini(input) {
  const text = await callGeminiText(buildPodcastPrompt(input));
  return parseJsonLoose(text, {});
}

async function createAudioWithGemini({ text, language, podcastId }) {
  const safeText = (text || '').trim();
  if (!safeText) {
    throw new Error('Generated script is empty after normalization.');
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY in environment');
  }
  const apiVersions = getGeminiApiVersions();
  const ttsModels = getGeminiTtsModels();
  const voiceName = language === 'zh' ? 'Kore' : 'Aoede';
  let audioBase64 = '';
  let mimeType = 'audio/wav';
  let lastError = 'Unknown Gemini TTS error';

  for (const apiVersion of apiVersions) {
    for (const ttsModel of ttsModels) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        const endpoint = `https://generativelanguage.googleapis.com/${apiVersion}/models/${ttsModel}:generateContent?key=${apiKey}`;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: safeText }] }],
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName,
                  },
                },
              },
            },
          }),
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          const msg = payload?.error?.message || `HTTP ${response.status}`;
          lastError = `${apiVersion}/${ttsModel}#${attempt}: ${msg}`;
          if (response.status === 503 || response.status === 429 || response.status >= 500) {
            if (attempt < 2) {
              await sleep(600 * attempt);
              continue;
            }
            break;
          }
          if (response.status === 404 || response.status === 400) {
            break;
          }
          throw new Error(`Gemini TTS failed (${response.status}) on ${apiVersion}/${ttsModel}: ${msg}`);
        }

        const inlineData = payload?.candidates?.[0]?.content?.parts?.find((p) => p?.inlineData)?.inlineData;
        audioBase64 = inlineData?.data || '';
        mimeType = inlineData?.mimeType || 'audio/wav';
        if (audioBase64) break;
        lastError = `${apiVersion}/${ttsModel}#${attempt}: empty audio data`;
        if (attempt < 2) {
          await sleep(300);
          continue;
        }
      }
    }
    if (audioBase64) break;
  }

  if (!audioBase64) {
    throw new Error(`Gemini TTS failed after version/model fallback. ${lastError}`);
  }
  const lowerMime = String(mimeType || '').toLowerCase();
  const isRawPcm = lowerMime.includes('audio/l16') || lowerMime.includes('audio/pcm');
  const ext = lowerMime.includes('mp3') || lowerMime.includes('mpeg') ? 'mp3' : 'wav';

  const fileName = `${podcastId}.${ext}`;
  const fullPath = path.join(AUDIO_DIR, fileName);
  let buffer = Buffer.from(audioBase64, 'base64');
  if (isRawPcm) {
    const sampleRateMatch = lowerMime.match(/rate=(\d+)/);
    const sampleRate = sampleRateMatch ? Number(sampleRateMatch[1]) : 24000;
    buffer = pcm16ToWavBuffer(buffer, sampleRate, 1);
  }
  await fs.writeFile(fullPath, buffer);
  return `/audio/${fileName}`;
}

app.post('/api/auth/google', async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ error: 'Missing idToken' });
    }

    const user = await verifyGoogleIdToken(idToken);
    return res.json({ user });
  } catch (error) {
    return res.status(401).json({ error: `Google auth failed: ${error.message}` });
  }
});

app.get('/api/config', (req, res) => {
  res.json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID',
  });
});

app.post('/api/my/podcasts', async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ error: 'Missing idToken' });
    }

    const user = await verifyGoogleIdToken(idToken);
    const podcasts = await readPodcasts();
    const mine = podcasts
      .filter((p) => p.user?.email?.toLowerCase() === user.email.toLowerCase())
      .map((p) => ({
        id: p.id,
        title: p.title,
        createdAt: p.createdAt,
        input: p.input,
      }));

    return res.json({ items: mine });
  } catch (error) {
    return res.status(401).json({ error: `List load failed: ${error.message}` });
  }
});

app.post('/api/my/podcasts/clear-all', async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ error: 'Missing idToken' });
    }

    const user = await verifyGoogleIdToken(idToken);
    const podcasts = await readPodcasts();
    const mine = podcasts.filter((p) => p.user?.email?.toLowerCase() === user.email.toLowerCase());
    const others = podcasts.filter((p) => p.user?.email?.toLowerCase() !== user.email.toLowerCase());

    await writePodcasts(others);
    await Promise.all(mine.map((item) => removeAudioIfLocal(item.audioUrl)));
    return res.json({ ok: true, deleted: mine.length });
  } catch (error) {
    return res.status(401).json({ error: `Clear failed: ${error.message}` });
  }
});

app.post('/api/my/podcasts/:id', async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ error: 'Missing idToken' });
    }

    const user = await verifyGoogleIdToken(idToken);
    const podcasts = await readPodcasts();
    const item = podcasts.find(
      (p) => p.id === req.params.id && p.user?.email?.toLowerCase() === user.email.toLowerCase(),
    );
    if (!item) {
      return res.status(404).json({ error: 'Podcast not found' });
    }
    return res.json(item);
  } catch (error) {
    return res.status(401).json({ error: `Podcast load failed: ${error.message}` });
  }
});

app.post('/api/my/podcasts/:id/delete', async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ error: 'Missing idToken' });
    }

    const user = await verifyGoogleIdToken(idToken);
    const podcasts = await readPodcasts();
    const target = podcasts.find(
      (p) => p.id === req.params.id && p.user?.email?.toLowerCase() === user.email.toLowerCase(),
    );
    if (!target) {
      return res.status(404).json({ error: 'Podcast not found' });
    }

    const next = podcasts.filter((p) => p.id !== req.params.id);
    await writePodcasts(next);
    await removeAudioIfLocal(target.audioUrl);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(401).json({ error: `Delete failed: ${error.message}` });
  }
});

app.post('/api/podcasts', async (req, res) => {
  try {
    const { idToken, categories, startDate, endDate, language, region } = req.body;

    if (!idToken || !Array.isArray(categories) || categories.length === 0 || !startDate || !endDate || !language) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const user = await verifyGoogleIdToken(idToken);

    const eventsResult = await getEventsFromGemini({
      categories,
      startDate,
      endDate,
      language,
      region: region || 'Global',
    });
    const events = eventsResult.events || [];
    if (!events.length) {
      throw new Error('Failed to extract structured events from fetched news. Please retry with a narrower date range.');
    }

    const script = await getPodcastScriptFromGemini({
      language,
      categories,
      startDate,
      endDate,
      region: region || 'Global',
      events,
    });

    const podcastId = uuidv4();
    const voiceScript =
      normalizeToMonologue(script.scriptText || script.summary || '') ||
      buildFallbackScriptFromEvents({
        language,
        region: region || 'Global',
        startDate,
        endDate,
        events,
      });
    const titleSummary = buildFallbackTitleAndSummary({
      language,
      startDate,
      endDate,
      region: region || 'Global',
      events,
      scriptText: voiceScript,
      title: script.title,
      summary: script.summary,
    });
    const audioUrl = await createAudioWithGemini({
      text: voiceScript,
      language,
      podcastId,
    });

    const record = {
      id: podcastId,
      createdAt: new Date().toISOString(),
      user: {
        name: user.name,
        email: user.email,
      },
      input: {
        categories,
        startDate,
        endDate,
        language,
        region: region || 'Global',
      },
      events,
      title: titleSummary.generatedTitle,
      summary: titleSummary.generatedSummary,
      scriptText: voiceScript,
      keyPoints: script.keyPoints || [],
      llmNewsDebug: eventsResult.llmNewsDebug || null,
      audioUrl,
      shareUrl: `/share/${podcastId}`,
    };

    const podcasts = await readPodcasts();
    podcasts.unshift(record);
    await writePodcasts(podcasts);

    return res.json(record);
  } catch (error) {
    return res.status(500).json({ error: `Podcast generation failed: ${error.message}` });
  }
});

app.get('/api/podcasts/:id', async (req, res) => {
  try {
    const podcasts = await readPodcasts();
    const item = podcasts.find((p) => p.id === req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Podcast not found' });
    }
    return res.json(item);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.get('/share/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'share.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

ensureStorage()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Timecast running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
