# 🔗 Bond — Your AI-Powered Friendship Companion

> A full-stack web app that gives close friendships a private space to grow — with shared memories, a bucket list, daily check-ins, AI insights, and support mode.

---

## ✨ Features

| Feature | What it does |
|---|---|
| **Shared Memories** | A private scrapbook — add photos, dates, and stories together |
| **Bucket List** | Things you both want to do — track and celebrate completions |
| **Daily Check-in** | Share your mood every day and get an AI response tailored to your bond |
| **Bond Insights** | AI-generated reflection on your unique friendship |
| **Support Mode** | Get personalized ideas on how to show up for your friend |
| **Invite System** | Pair with exactly one friend using a private invite code |

---

## 🗂️ Project Structure

```
bond-app/
├── backend/          ← Node.js + Express API
│   ├── routes/
│   │   ├── auth.js       Register, login, connect friend
│   │   ├── memories.js   CRUD memories
│   │   ├── bucketlist.js CRUD bucket list
│   │   └── ai.js         AI check-in, support, insights
│   ├── db.js         SQLite database setup
│   ├── server.js     Main Express server
│   └── .env.example  Environment variables template
│
└── frontend/         ← React + Vite app
    └── src/
        ├── pages/
        │   ├── Landing.jsx   Homepage
        │   ├── Auth.jsx      Login & register
        │   ├── AppShell.jsx  Sidebar layout
        │   ├── Dashboard.jsx Bond home + connect flow
        │   ├── Memories.jsx  Memory gallery
        │   ├── BucketList.jsx Shared bucket list
        │   ├── CheckIn.jsx   Daily mood check-in
        │   └── Support.jsx   Support your friend
        ├── components/
        │   └── Sidebar.jsx
        ├── context/
        │   └── AuthContext.jsx  Global auth + API helper
        └── index.css           Full design system
```

---

## 🚀 Local Setup (Run on Your Computer)

### Step 1 — Prerequisites
Make sure you have these installed:
- [Node.js](https://nodejs.org/) (v18 or newer)
- [Git](https://git-scm.com/)

### Step 2 — Set up the Backend

```bash
cd bond-app/backend

# Install dependencies
npm install

# Create your environment file
cp .env.example .env
```

Now open `.env` in any text editor and fill in:
- `ANTHROPIC_API_KEY` → Get yours free at https://console.anthropic.com
- `JWT_SECRET` → Type any long random string (e.g. `mysecretbond123xyz`)

```bash
# Start the backend server
npm run dev
```

You should see: `🔗 Bond API running on http://localhost:5000`

### Step 3 — Set up the Frontend

Open a **new terminal window**:

```bash
cd bond-app/frontend

# Install dependencies
npm install

# Start the frontend
npm run dev
```

You should see: `Local: http://localhost:5173`

### Step 4 — Open the app

Go to **http://localhost:5173** in your browser.

---

## 📤 Uploading to GitHub

### Step 1 — Create a GitHub account
Go to [github.com](https://github.com) and sign up (it's free).

### Step 2 — Create a new repository
1. Click the **+** button (top right) → **New repository**
2. Name it `bond-app`
3. Set it to **Public** or **Private**
4. Click **Create repository**

### Step 3 — Push your code

Open a terminal in the `bond-app/` folder and run:

```bash
git init
git add .
git commit -m "Initial commit — Bond app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/bond-app.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username.

Your code is now on GitHub! 🎉

---

## 🌐 Hosting the App Online (Free)

You need to deploy two things separately:
1. **Backend** → Railway or Render
2. **Frontend** → Vercel or Netlify

---

### Backend: Deploy to Railway (Free)

1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click **New Project** → **Deploy from GitHub repo** → select `bond-app`
3. Set the **root directory** to `backend`
4. Add environment variables:
   - `ANTHROPIC_API_KEY` = your key
   - `JWT_SECRET` = your secret
   - `FRONTEND_URL` = your Vercel URL (you'll get this next)
5. Railway will give you a URL like `https://bond-backend.up.railway.app`

---

### Frontend: Deploy to Vercel (Free)

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **Add New Project** → Import `bond-app`
3. Set the **root directory** to `frontend`
4. Add environment variable:
   - `VITE_API_URL` = your Railway backend URL
5. In `frontend/vite.config.js`, update the proxy target to your Railway URL
6. Click **Deploy** — Vercel gives you a URL like `https://bond-app.vercel.app`

---

### Final step: Update CORS

Go back to Railway, update `FRONTEND_URL` to your Vercel URL.

---

## 🔑 How the app works

1. **Friend A** registers → gets an 8-character invite code (e.g. `AB12CD34`)
2. **Friend B** registers → enters Friend A's invite code
3. They're now **bonded** → all features unlock
4. Everything is private to just the two of them

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router, Vite |
| Backend | Node.js, Express |
| Database | SQLite (via better-sqlite3) |
| AI | Anthropic Claude (claude-sonnet) |
| Auth | JWT tokens + bcrypt |
| Styling | Pure CSS with design system |

---

## 💡 Ideas to Extend This

- 📱 Make it a mobile app (React Native)
- 🔔 Add email/push notifications for check-in reminders
- 🖼️ Add real image uploads (Cloudinary)
- 💬 Add real-time messaging (Socket.io)
- 📊 Add a mood chart over time
- 🌍 Add multi-language support

---

Made with ♥ — for the friendships that matter most.
