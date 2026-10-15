# ResumeAI – Resume Customizer

Tailor a resume to a job description with AI, without inventing anything. Upload a PDF or DOCX
resume, paste a job description, and get a rewritten resume, a match score, an ATS check, a
word-level diff of every change, a cover letter, and PDF/DOCX downloads.

## Features

- Job description input with validation (empty, under 50 or over 15,000 characters).
- Drag-and-drop PDF/DOCX upload (max 5 MB) with file name and size; type, size and content checks
  on both frontend and backend. Empty, corrupted and password-protected files are rejected.
- Scanned (image-only) PDFs are read by the AI before customization.
- AI rewrite of the summary, skills order, experience and project bullets, returned as structured
  JSON and validated against a schema.
- Accuracy checks in code: skills not found in the original resume are removed, rewrites that add
  numbers are reverted, invented bullets are dropped, and job skills you lack are listed as gaps.
- Section selection (Summary, Skills, Experience, Projects); unselected sections stay unchanged.
- Match score (skills 50%, keywords 30%, responsibilities 20%) and ATS-readiness checks with tips.
- Diff view of every change, plus original vs customized text.
- Login required: the app opens on a login page, and returning users who are already logged in
  go straight to the app. A new username gets an account on its first login (no separate sign-up
  step). Each user's versions are saved and kept after the browser is closed. Accounts and history are stored in the browser's localStorage; passwords
  are hashed with PBKDF2-SHA256 and a random salt.
- Multiple saved versions per user, with side-by-side comparison.
- Cover letter generator (from a result or standalone) with PDF/DOCX download.
- Live streaming progress with Cancel.
- Generated PDF and DOCX downloads of the customized resume.

## Tech stack

- **Frontend:** React 19, Vite, Bootstrap 5
- **Backend:** Python 3.12, FastAPI
- **AI:** Google Gemini through the official `google-genai` SDK (no LangChain)
- **Files:** `pypdf`, `python-docx`, `fpdf2`

## Project structure

```
.
├── backend/
│   ├── main.py            # FastAPI app: CORS, error handlers and routes
│   ├── services/
│   │   ├── resume_service.py  # limits, schemas, file parsing, accuracy checks, scores, PDF/DOCX export
│   │   └── ai_service.py      # Gemini client, prompts, resume customization and cover letter
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── main.jsx       # starts React
│   │   ├── App.jsx        # page layout, app state, versions and request handling
│   │   ├── api.js         # backend API calls (streaming, cover letter, export)
│   │   ├── storage.js     # browser accounts, login session and saved history (localStorage)
│   │   ├── components/
│   │   │   ├── ResumeComponents.jsx  # upload form, results tabs, diff, scores, versions
│   │   │   └── AuthForm.jsx          # login page form (first login creates the account)
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js     # dev server + /api proxy to the backend
│   ├── eslint.config.js
│   └── package.json
├── render.yaml            # backend deployment on Render
└── README.md
```

## Run locally (Windows)

Prerequisites: Python 3.12+, Node.js 20+, and a free API key from
[Google AI Studio](https://aistudio.google.com/apikey).

**Backend**

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Open `backend/.env`, set `GEMINI_API_KEY`, then start the server:

```bash
uvicorn main:app --reload --port 8000
```

On macOS/Linux use `source .venv/bin/activate` and `cp .env.example .env`.

**Frontend** (in a second terminal)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Vite forwards `/api` requests to the backend on port 8000.

**Lint and production build**

```bash
cd frontend
npm run lint
npm run build
```

## Environment variables

| Variable | Where | Default | Purpose |
| --- | --- | --- | --- |
| `GEMINI_API_KEY` | `backend/.env` | required | AI API key. Without it, AI features return a "not configured" error. |
| `GEMINI_MODEL` | `backend/.env` | `gemini-3.5-flash-lite` | AI model name. |
| `AI_TIMEOUT_SECONDS` | `backend/.env` | `90` | Timeout for AI requests. |
| `CORS_ORIGINS` | `backend/.env` | `http://localhost:5173,http://127.0.0.1:5173` | Allowed frontend URLs. |
| `VITE_API_URL` | frontend build | empty | Backend URL for production builds. |

Never commit `backend/.env`; it is listed in `.gitignore`.

## API

Errors always return `{"detail": "<message>"}`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Status and input limits |
| POST | `/api/customize-resume` | Multipart `job_description`, `resume`, optional `sections`; returns the full result |
| POST | `/api/customize-resume/stream` | Same, streamed as newline-delimited JSON events |
| POST | `/api/cover-letter` | Multipart `job_description` and `resume` or `resume_text` |
| POST | `/api/export` | JSON with `kind`, `format` and content; returns a PDF or DOCX file |
| POST | `/api/extract-resume` | Returns the text extracted from a resume |

## Deployment

1. Push the repository to GitHub.
2. **Backend on Render:** New → Blueprint, select the repository (uses `render.yaml`). Set
   `GEMINI_API_KEY` and `CORS_ORIGINS` (your frontend URL).
3. **Frontend on Vercel:** import the repository, set Root Directory to `frontend`, and set
   `VITE_API_URL` to the Render URL.
4. Add the Vercel URL to `CORS_ORIGINS` on Render.

Render's free tier sleeps when idle, so the first request can take about a minute.

## Limitations

- The AI free tier has rate limits, and Google may use free-tier data to improve its products.
  Avoid uploading real personal resumes on a free key.
- Resume text is sent to a third-party AI service; files are processed in memory and not stored.
- Login is browser-only: accounts and history live in this browser's `localStorage`, so they do
  not sync across devices or browsers and are lost if site data is cleared. It separates people
  sharing a browser but is not server-side security; anyone with access to the browser profile
  can read the stored data. A production version would use backend accounts and a database.
- Browser storage is limited (about 5 MB), so very long histories may stop saving.
- PDF export supports Latin characters only; use DOCX for other scripts.
- Skill matching can miss synonyms such as "JS" vs "JavaScript". Always review the result.
