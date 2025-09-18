const path = require('path');
const express = require('express');
const cors = require('cors');
const { OpenAI } = require('openai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const DEFAULT_LOCATION = process.env.DEFAULT_LOCATION || 'Arlington,VA,US';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const WEATHER_UPDATE_MS = 60 * 60 * 1000; // hourly weather refresh
const AYAH_UPDATE_MS = 2 * 60 * 60 * 1000; // ayah refresh every two hours
const openaiClient = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const parseNumber = (value) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const extractError = (error) => {
  if (error && error.response) {
    return {
      status: error.response.status,
      data: error.response.data
    };
  }
  return { status: null, data: error ? error.message : 'Unknown error' };
};

const weatherCache = new Map();
const weatherLocks = new Map();
let ayahCache = null;
let ayahLock = null;

async function fetchWeatherSnapshot(location) {
  const prompt = `You are an experienced meteorologist providing concise reports for a modern weather dashboard.\n` +
    `Generate the best possible current conditions for ${location}.\n` +
    `Return ONLY strict JSON with the keys: location, temperature, feelsLike, conditions, humidity, windSpeed.\n` +
    `Requirements:\n` +
    `- location: readable city/area name in plain text.\n` +
    `- temperature: numeric Fahrenheit value (no units).\n` +
    `- feelsLike: numeric Fahrenheit value (no units).\n` +
    `- conditions: short lowercase description (e.g., "clear skies").\n` +
    `- humidity: numeric percentage (0-100).\n` +
    `- windSpeed: numeric miles per hour (no units).\n` +
    `Do not include explanations, markdown, or additional keys. If uncertain, provide a reasonable, seasonally appropriate estimate.`;

  const response = await openaiClient.responses.create({
    model: OPENAI_MODEL,
    temperature: 0.4,
    max_output_tokens: 300,
    input: prompt
  });

  const raw = (response.output_text || '').trim();
  let payload;

  try {
    payload = JSON.parse(raw);
  } catch (parseError) {
    throw new Error(`AI weather parsing failed: ${parseError.message}`);
  }

  return {
    location: payload.location || location,
    temperature: parseNumber(payload.temperature),
    feelsLike: parseNumber(payload.feelsLike),
    conditions: payload.conditions || 'unknown conditions',
    humidity: parseNumber(payload.humidity),
    windSpeed: parseNumber(payload.windSpeed)
  };
}

async function ensureWeather(location) {
  const key = location.toLowerCase();
  const cached = weatherCache.get(key);
  const now = Date.now();

  if (cached && now < cached.nextUpdate) {
    return cached;
  }

  if (weatherLocks.has(key)) {
    return weatherLocks.get(key);
  }

  const loader = (async () => {
    try {
      const snapshot = await fetchWeatherSnapshot(location);
      const updatedAt = Date.now();
      const record = {
        ...snapshot,
        updatedAt,
        nextUpdate: updatedAt + WEATHER_UPDATE_MS,
        locationQuery: location
      };
      weatherCache.set(key, record);
      return record;
    } finally {
      weatherLocks.delete(key);
    }
  })();

  weatherLocks.set(key, loader);
  return loader;
}

function parseSurahNumber(reference) {
  if (!reference) return null;
  const numberMatch = reference.match(/(\d+)\s*[:\-]/);
  if (numberMatch) {
    const num = Number.parseInt(numberMatch[1], 10);
    if (Number.isFinite(num) && num >= 1 && num <= 114) {
      return num;
    }
  }
  return null;
}

function buildRecitationUrl(surahNumber) {
  if (!surahNumber) return null;
  return `https://cdn.islamic.network/quran/audio-surah/128/ar.alafasy/${surahNumber}.mp3`;
}

async function fetchAyahSnapshot() {
  const response = await openaiClient.responses.create({
    model: OPENAI_MODEL,
    temperature: 0.7,
    max_output_tokens: 250,
    input: `You are an assistant that shares beautiful verses (ayahs) from the Holy Quran.\nReturn a random ayah in strict JSON with the keys: arabic, english, reference.\n- arabic: short Arabic text without additional commentary.\n- english: a warm and easy-to-read English rendering (1-2 sentences).\n- reference: surah name and verse number (e.g., \\"Surah Al-Baqarah 2:255\\").\nRules: respond with valid JSON only, no markdown, no code fences.`
  });

  const raw = (response.output_text || '').trim();
  let payload;

  try {
    payload = JSON.parse(raw);
  } catch (parseError) {
    throw new Error(`AI ayah parsing failed: ${parseError.message}`);
  }

  const surahNumber = parseSurahNumber(payload.reference);
  return {
    ...payload,
    surahNumber,
    recitationUrl: buildRecitationUrl(surahNumber)
  };
}

async function ensureAyah() {
  const now = Date.now();

  if (ayahCache && now < ayahCache.nextUpdate) {
    return ayahCache;
  }

  if (ayahLock) {
    return ayahLock;
  }

  ayahLock = (async () => {
    try {
      const snapshot = await fetchAyahSnapshot();
      const updatedAt = Date.now();
      ayahCache = {
        ...snapshot,
        updatedAt,
        nextUpdate: updatedAt + AYAH_UPDATE_MS
      };
      return ayahCache;
    } finally {
      ayahLock = null;
    }
  })();

  return ayahLock;
}

app.get('/api/weather', async (req, res) => {
  if (!openaiClient) {
    return res.status(500).json({ error: 'OpenAI API key missing. Check OPENAI_API_KEY.' });
  }

  const location = (req.query.q || DEFAULT_LOCATION).toString();

  try {
    const snapshot = await ensureWeather(location);
    res.json(snapshot);
  } catch (error) {
    const details = extractError(error);
    console.error('OpenAI weather error', details.data);
    const status = details.status || 500;
    res.status(status).json({ error: 'Unable to fetch weather insight right now.' });
  }
});

app.get('/api/ayah', async (_req, res) => {
  if (!openaiClient) {
    return res.status(500).json({ error: 'OpenAI API key missing. Check OPENAI_API_KEY.' });
  }

  try {
    const snapshot = await ensureAyah();
    res.json(snapshot);
  } catch (error) {
    const details = extractError(error);
    console.error('OpenAI ayah error', details.data);
    const status = details.status || 500;
    res.status(status).json({ error: 'Unable to fetch ayah right now.' });
  }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

if (openaiClient) {
  ensureWeather(DEFAULT_LOCATION).catch((error) => {
    console.error('Initial weather fetch failed', error.message);
  });
  setInterval(() => {
    ensureWeather(DEFAULT_LOCATION).catch((error) => {
      console.error('Scheduled weather refresh failed', error.message);
    });
  }, WEATHER_UPDATE_MS);

  ensureAyah().catch((error) => {
    console.error('Initial ayah fetch failed', error.message);
  });
  setInterval(() => {
    ensureAyah().catch((error) => {
      console.error('Scheduled ayah refresh failed', error.message);
    });
  }, AYAH_UPDATE_MS);
}

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
