# Blissful Skies Weather App

Playful weather dashboard tailored for Arlington, VA with Quranic ayahs, GPT-generated weather snapshots, and looping recitations. Built for easy deployment on a local Ubuntu webserver.

## Getting Started

1. Copy `.env.example` to `.env` and populate:
   - `OPENAI_API_KEY`
   - Optionally tweak `OPENAI_MODEL` and `DEFAULT_LOCATION`.
2. Install dependencies:

```bash
npm install
```

3. Run the server:

```bash
npm run dev
```

4. Visit `http://localhost:3000` (or the domain proxied through Apache/Nginx).

## Notes on Weather & Ayahs

- Weather insights are produced by OpenAI and cached per location for an hour; the server refreshes Arlington automatically.
- Ayahs refresh every two hours and include a recitation URL (Al-Afasy) that loops in the UI. Audio autoplay may require a manual tap on some browsers.
- Treat both outputs as AI-assisted estimates/reminders. Adjust prompts in `src/server.js` if you need stricter formatting.

## Deployment Tips

- The server exposes `/api/weather` and `/api/ayah`, serving the React-free frontend from `public/`.
- Keep your `.env` secret and load it via systemd/PM2 for production.
- If Apache is handling TLS, proxy to `http://127.0.0.1:3000/` and keep Node on port 3000.

## Customization Ideas

- Replace the buddy SVGs in `public/assets` with your own characters.
- Extend the backend with persistent storage if you need audit/history of ayahs or weather.
- Layer in background animations or Lottie assets for extra delight on tablets and phones.
