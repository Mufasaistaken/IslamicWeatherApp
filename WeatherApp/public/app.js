const weatherLocation = document.getElementById('weather-location');
const tempValue = document.getElementById('temp-value');
const feelsLike = document.getElementById('feels-like');
const condition = document.getElementById('condition');
const humidity = document.getElementById('humidity');
const wind = document.getElementById('wind');
const weatherUpdated = document.getElementById('weather-updated');
const weatherNext = document.getElementById('weather-next');
const ayahAr = document.getElementById('ayah-ar');
const ayahEn = document.getElementById('ayah-en');
const ayahRef = document.getElementById('ayah-ref');
const ayahLoading = document.getElementById('ayah-loading');
const ayahUpdated = document.getElementById('ayah-updated');
const ayahNext = document.getElementById('ayah-next');
const audioControls = document.getElementById('audio-controls');
const audioToggle = document.getElementById('ayah-audio-toggle');
const audioStatus = document.getElementById('ayah-audio-status');
const audioElement = document.getElementById('ayah-audio');
const refreshAyah = document.getElementById('refresh-ayah');
const locationForm = document.getElementById('location-form');
const locationInput = document.getElementById('location-input');

let weatherTimer;
let ayahTimer;
let currentLocation = '';

const MS_IN_MIN = 60 * 1000;

const titleCase = (text) => text.replace(/\b\w/g, (match) => match.toUpperCase());

const formatTimestamp = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const describeDuration = (timestamp) => {
  if (!timestamp) return '';
  const diff = timestamp - Date.now();
  if (diff <= 0) return 'Updating shortly';
  const minutes = Math.round(diff / MS_IN_MIN);
  if (minutes < 60) return `Refreshes in ~${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (remainder === 0) {
    return `Refreshes in ~${hours} hr`;
  }
  return `Refreshes in ~${hours} hr ${remainder} min`;
};

const scheduleRefresh = (timerRef, callback, timestamp, fallbackMinutes) => {
  if (timerRef) {
    clearTimeout(timerRef);
  }
  const fallback = fallbackMinutes * MS_IN_MIN;
  let delay = fallback;
  if (timestamp) {
    const target = Math.max(0, timestamp - Date.now());
    delay = Math.max(MS_IN_MIN, target + 30 * 1000);
  }
  return setTimeout(callback, delay);
};

async function fetchWeather(query) {
  try {
    const params = query ? `?q=${encodeURIComponent(query)}` : '';
    const response = await fetch(`/api/weather${params}`);

    if (!response.ok) {
      throw new Error('Weather fetch failed');
    }

    const data = await response.json();
    currentLocation = query || '';
    weatherLocation.textContent = data.location ?? 'Unknown location';
    tempValue.textContent = Number.isFinite(data.temperature) ? data.temperature : '--';
    feelsLike.textContent = Number.isFinite(data.feelsLike)
      ? `Feels like ${data.feelsLike}°F`
      : 'Feels like --°F';
    condition.textContent = data.conditions ? titleCase(data.conditions) : 'No conditions available';
    humidity.textContent = data.humidity != null ? `${data.humidity}%` : '--%';
    wind.textContent = data.windSpeed != null ? `${Math.round(data.windSpeed)} mph` : '-- mph';

    weatherUpdated.textContent = data.updatedAt
      ? `Updated: ${formatTimestamp(data.updatedAt)}`
      : '';
    weatherNext.textContent = describeDuration(data.nextUpdate);

    weatherTimer = scheduleRefresh(
      weatherTimer,
      () => fetchWeather(currentLocation || undefined),
      data.nextUpdate,
      65
    );
  } catch (error) {
    console.error(error);
    condition.textContent = 'Weather took a rain check. Try again soon!';
  }
}

function resetAyahFields() {
  ayahAr.textContent = '';
  ayahEn.textContent = '';
  ayahRef.textContent = '';
  ayahUpdated.textContent = '';
  ayahNext.textContent = '';
}

function updateAudioControls(url, reference) {
  if (!url) {
    audioControls.hidden = true;
    audioToggle.disabled = true;
    audioElement.pause();
    audioElement.removeAttribute('src');
    audioElement.load();
    audioStatus.textContent = '';
    return;
  }

  audioControls.hidden = false;
  audioToggle.disabled = false;
  audioToggle.textContent = 'Play surah recitation';
  audioElement.loop = true;
  audioElement.src = url;
  audioElement.load();

  const label = reference ? `Reciting ${reference}` : 'Reciting selected surah';
  audioStatus.textContent = `Ready: ${label}`;

  audioElement.play().then(() => {
    audioToggle.textContent = 'Pause recitation';
    audioStatus.textContent = `${label} — playing on loop`;
  }).catch(() => {
    audioStatus.textContent = `${label}. Tap play to start.`;
  });
}

async function fetchAyah(forceRefresh = false) {
  if (!forceRefresh) {
    ayahLoading.style.display = 'block';
  }
  resetAyahFields();

  try {
    const response = await fetch('/api/ayah');
    if (!response.ok) {
      throw new Error('Ayah fetch failed');
    }

    const data = await response.json();
    if (!data.arabic || !data.english || !data.reference) {
      throw new Error('Incomplete ayah payload');
    }

    ayahAr.textContent = data.arabic;
    ayahEn.textContent = data.english;
    ayahRef.textContent = data.reference;
    ayahUpdated.textContent = data.updatedAt
      ? `Updated: ${formatTimestamp(data.updatedAt)}`
      : '';
    ayahNext.textContent = describeDuration(data.nextUpdate);

    updateAudioControls(data.recitationUrl, data.reference);

    ayahTimer = scheduleRefresh(ayahTimer, () => fetchAyah(true), data.nextUpdate, 130);
  } catch (error) {
    console.error(error);
    ayahAr.textContent = '⚠️';
    ayahEn.textContent = 'The ayah generator is feeling a little shy right now. Give it another try in a moment.';
    audioControls.hidden = true;
  } finally {
    ayahLoading.style.display = 'none';
  }
}

locationForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const value = locationInput.value.trim();
  fetchWeather(value || undefined);
});

refreshAyah.addEventListener('click', () => {
  ayahLoading.style.display = 'block';
  fetchAyah(true);
});

audioToggle.addEventListener('click', () => {
  if (!audioElement.src) {
    return;
  }

  if (audioElement.paused) {
    audioElement.play().then(() => {
      audioToggle.textContent = 'Pause recitation';
      audioStatus.textContent = 'Recitation playing on loop';
    }).catch(() => {
      audioStatus.textContent = 'Browser blocked autoplay. Tap play again to start.';
    });
  } else {
    audioElement.pause();
    audioToggle.textContent = 'Play surah recitation';
    audioStatus.textContent = 'Recitation paused';
  }
});

audioElement.addEventListener('ended', () => {
  audioStatus.textContent = 'Recitation looping…';
});

audioElement.addEventListener('play', () => {
  audioToggle.textContent = 'Pause recitation';
  audioStatus.textContent = 'Recitation playing on loop';
});

audioElement.addEventListener('pause', () => {
  audioToggle.textContent = 'Play surah recitation';
  audioStatus.textContent = 'Recitation paused';
});

audioElement.addEventListener('error', () => {
  audioStatus.textContent = 'Audio failed to load. Try again later.';
});

fetchWeather();
fetchAyah();
