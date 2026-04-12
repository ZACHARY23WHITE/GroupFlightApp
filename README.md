# GroupFlightApp

Family / group trip planner: shared trips, travelers (home airport, party size, cabin), and Google Flights–style quotes via SerpAPI.

See **`web/`** for the Next.js app (`npm install` and `npm run dev` inside `web/`). Copy `web/.env.example` to `web/.env` and add **Firebase** (Firestore) service account fields plus optional **SerpAPI** key.

### Firebase App Hosting (important)

The Next.js app is in **`web/`**, not the repo root. In Firebase Console → **App Hosting** → your backend → **Settings** → **Deployment**, set **Root directory** to **`web`**. If this is left as `/`, the build has no `package.json` at the repo root and fails (often with a Docker/buildpack exit code like **21**).

Add the same env vars as `web/.env` under the backend’s **Environment** settings (and use Secret Manager for `FIREBASE_PRIVATE_KEY` / `SERPAPI_API_KEY` in production). **Delete any variable row that has no value and no secret** — empty rows cause *Invalid apphosting.yaml* / *either 'value' or 'secret' field is required*.
