# nd-ex agents

Personal AI agent console — Wine Cellar, Code Runner, Web Scraper.

## Setup

### 1. Clone & install
```bash
git clone https://github.com/YOUR_USERNAME/nd-ex-agents
cd nd-ex-agents
npm install
```

### 2. Environment variables
Copy `.env.example` to `.env.local` and fill in:

```
NEXTAUTH_URL=https://nd-ex.com
NEXTAUTH_SECRET=   # run: openssl rand -base64 32
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
OPENCLAW_GATEWAY_URL=http://198.199.83.91:18789
OPENCLAW_GATEWAY_TOKEN=
ALLOWED_EMAIL=your@email.com
```

### 3. Google OAuth setup
- Go to console.cloud.google.com
- Create OAuth 2.0 credentials
- Add authorized redirect URI: `https://nd-ex.com/api/auth/callback/google`
- Also add `http://localhost:3000/api/auth/callback/google` for local dev

### 4. Deploy to Vercel
- Push to GitHub
- Import repo in Vercel
- Add all env vars in Vercel dashboard
- Set custom domain to nd-ex.com

### 5. Local dev
```bash
npm run dev
```
Open http://localhost:3000
