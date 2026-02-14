# Timecast

Personalized historical news podcast web app (Chinese + English).

## Features

- Google login
- Built-in categories (AI, Finance, World, Technology, Business, etc.)
- Choose category combinations + date range + language
- Country/region focus for news generation
- Google account scoped podcast history (replay previous generated episodes)
- Generate historical-news podcast via Gemini (news events + script + TTS)
- Play + read script + public read-only share link

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env`:

```bash
GOOGLE_CLIENT_ID=your_google_client_id
GEMINI_API_KEY=your_gemini_api_key
GEMINI_API_VERSION=v1
GEMINI_MODEL=gemini-2.5-flash
GEMINI_TTS_MODEL=gemini-2.5-flash-preview-tts
PORT=3000
```

3. Start server:

```bash
npm run dev
```

4. Open:

```text
http://localhost:3000
```

## Notes

- Google login uses ID token verification in backend.
- Gemini calls latest API first (`v1`), then auto-fallback to `v1beta`.
- TTS model should use preview TTS models (e.g. `gemini-2.5-flash-preview-tts`), not `gemini-2.5-flash-tts`.
- Generated podcasts metadata is stored in `data/podcasts.json`.
