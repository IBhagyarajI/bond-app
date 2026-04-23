# 🔗 Bond App — Complete Beginner's Guide
### "Explain it like I'm 5" Edition

> Everything here is **100% FREE**. No credit card needed anywhere.

---

## 🗺️ Big Picture — What Are We Doing?

Think of it like setting up a shop:
- 🏗️ **Your computer** = where you build and test it locally
- 📦 **GitHub** = where you store your code (like Google Drive, but for code)
- 🌐 **Render** = your free server that runs the backend 24/7 on the internet
- 🌐 **Vercel** = your free server that shows the website to users
- 🤖 **Google Gemini** = the free AI brain powering the app

---

# PART 1 — SETTING UP YOUR COMPUTER

## Step 1 — Install Node.js (the engine that runs the app)

1. Open your browser and go to: **https://nodejs.org**
2. You'll see a big green button that says **"LTS"** — click it to download
3. Open the downloaded file and click **Next → Next → Install**
4. When it's done, click **Finish**

**✅ How to check it worked:**
- On **Windows**: Press `Windows key`, type `cmd`, press Enter → type `node --version` → press Enter
- On **Mac**: Press `Cmd + Space`, type `terminal`, press Enter → type `node --version` → press Enter

You should see something like `v20.11.0` — any number is fine!

---

## Step 2 — Install Git (for uploading to GitHub)

1. Go to: **https://git-scm.com/downloads**
2. Click your operating system (Windows or Mac)
3. Download and install it (keep clicking Next, all defaults are fine)

---

## Step 3 — Download the Bond App

1. Download the file `bond-app-gemini.zip` (given to you above)
2. Find it in your **Downloads** folder
3. **Right-click** on it → click **"Extract All"** (Windows) or just double-click (Mac)
4. You'll get a folder called `bond-app` — move it to your **Desktop** for easy access

---

## Step 4 — Get Your FREE Google Gemini API Key

This is the AI brain. It's completely free.

1. Go to: **https://aistudio.google.com/apikey**
2. Sign in with your **Google account**
3. Click the blue button **"Create API Key"**
4. Click **"Create API key in new project"**
5. You'll see a long code like `AIzaSyABC123...` — **copy it** (Ctrl+C)
6. Keep this tab open — you'll need it in a moment

---

## Step 5 — Set Up the Backend (the server / brain of the app)

### Open a terminal/command prompt:
- **Windows**: Press `Windows key` → type `cmd` → press Enter
- **Mac**: Press `Cmd + Space` → type `terminal` → press Enter

### Now type these commands one by one (press Enter after each):

```
cd Desktop/bond-app/backend
```
*(This goes into the backend folder)*

```
npm install
```
*(This downloads all the tools the app needs — takes 1-2 minutes)*

```
copy .env.example .env
```
*(Windows — creates your settings file)*
OR on Mac:
```
cp .env.example .env
```

### Now open the `.env` file:
- Go to `Desktop → bond-app → backend`
- Find the file called `.env` (just `.env`, no other name)
- Open it with **Notepad** (Windows) or **TextEdit** (Mac)
- You'll see this line:
  ```
  GOOGLE_API_KEY=your_google_api_key_here
  ```
- Replace `your_google_api_key_here` with the key you copied from Google
- Also change this line:
  ```
  JWT_SECRET=change_this_to_a_long_random_string_in_production
  ```
  to something like:
  ```
  JWT_SECRET=myfriendshipappsecret2024bondapp
  ```
- **Save the file** (Ctrl+S)

### Start the backend:
In your terminal, type:
```
npm run dev
```

🎉 You should see: `🔗 Bond API running on http://localhost:5000`

**Leave this terminal window open!**

---

## Step 6 — Set Up the Frontend (the website part)

### Open a NEW terminal window (keep the old one open!)

Then type:
```
cd Desktop/bond-app/frontend
```

```
npm install
```
*(Wait 1-2 minutes)*

```
npm run dev
```

🎉 You should see: `Local: http://localhost:5173`

---

## Step 7 — Open the App!

1. Open your browser
2. Go to: **http://localhost:5173**
3. You'll see the Bond app! 🎉

**Register an account, then share the invite code with your friend!**

---
---

# PART 2 — UPLOADING TO GITHUB

## Step 1 — Create a GitHub Account

1. Go to **https://github.com**
2. Click **"Sign up"**
3. Enter your email, create a password, choose a username
4. Verify your email

---

## Step 2 — Create a New Repository (like a folder for your code)

1. Once logged in, click the **"+"** icon in the top-right corner
2. Click **"New repository"**
3. Fill in:
   - **Repository name**: `bond-app`
   - **Description**: `My AI friendship companion app`
   - Select **Public** (so anyone can see it — great for portfolio!)
4. **DO NOT** tick "Add a README file"
5. Click the green **"Create repository"** button

You'll see a page with some commands — leave it open.

---

## Step 3 — Push Your Code to GitHub

Open a terminal and go into the bond-app folder:

**Windows:**
```
cd Desktop/bond-app
```
**Mac:**
```
cd ~/Desktop/bond-app
```

Now run these commands one by one:

```
git init
```

```
git add .
```

```
git commit -m "My Bond friendship app"
```

```
git branch -M main
```

```
git remote add origin https://github.com/YOUR_USERNAME/bond-app.git
```
⚠️ Replace `YOUR_USERNAME` with your actual GitHub username!

```
git push -u origin main
```

It will ask for your GitHub username and password.
> **Note for password:** GitHub uses a "token" not your real password. Go to **https://github.com/settings/tokens** → click "Generate new token (classic)" → tick "repo" → scroll down → Generate token → copy it → use it as your password.

✅ Refresh your GitHub page — your code is now there!

---
---

# PART 3 — PUTTING IT LIVE ON THE INTERNET (100% FREE)

We need to deploy two things:
1. **Backend** → Render (free server)
2. **Frontend** → Vercel (free website hosting)

---

## BACKEND: Deploy to Render

### Step 1 — Sign up for Render
1. Go to **https://render.com**
2. Click **"Get Started for Free"**
3. Sign up with your **GitHub account** (click "Continue with GitHub")
4. Authorize Render to access your GitHub

### Step 2 — Create a new Web Service
1. On the Render dashboard, click **"New +"**
2. Click **"Web Service"**
3. Click **"Connect"** next to your `bond-app` repository
4. Fill in these settings:
   - **Name**: `bond-app-backend`
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Under **Instance Type**: select **"Free"**

### Step 3 — Add your secret keys
Scroll down to **"Environment Variables"** and click **"Add Environment Variable"** for each:

| Key | Value |
|-----|-------|
| `GOOGLE_API_KEY` | Your Google API key from earlier |
| `JWT_SECRET` | `myfriendshipappsecret2024bondapp` |
| `FRONTEND_URL` | `https://bond-app.vercel.app` (we'll get this in the next step) |

Click **"Create Web Service"**

⏳ Wait 2-3 minutes for it to build.

When it's done, you'll see a URL like:
`https://bond-app-backend.onrender.com`

**Copy this URL — you need it for the next step!**

---

## FRONTEND: Deploy to Vercel

### Step 1 — Sign up for Vercel
1. Go to **https://vercel.com**
2. Click **"Sign Up"**
3. Choose **"Continue with GitHub"**
4. Authorize Vercel

### Step 2 — Import your project
1. Click **"Add New..."** → **"Project"**
2. Find `bond-app` in the list → click **"Import"**
3. Change **"Root Directory"** by clicking **Edit** next to it → type `frontend` → click Continue
4. Leave everything else as default
5. Click **"Deploy"**

⏳ Wait 1-2 minutes.

You'll get a URL like: `https://bond-app-abc123.vercel.app`

---

## Final Step — Connect Frontend & Backend

### Update Vercel (tell frontend where the backend is):
1. In Vercel, go to your project → **"Settings"** → **"Environment Variables"**
2. Add:
   - **Name**: `VITE_API_URL`
   - **Value**: `https://bond-app-backend.onrender.com` (your Render URL)
3. Click **Save**
4. Go to **"Deployments"** → click the three dots → **"Redeploy"**

### Update Render (tell backend where the frontend is):
1. In Render, go to your service → **"Environment"**
2. Change `FRONTEND_URL` to your Vercel URL (e.g. `https://bond-app-abc123.vercel.app`)
3. Click **"Save Changes"** — Render will automatically redeploy

### Update vite.config.js:
Open `frontend/vite.config.js` and change:
```js
target: 'http://localhost:5000',
```
to:
```js
target: process.env.VITE_API_URL || 'http://localhost:5000',
```
Then push this change to GitHub:
```
git add .
git commit -m "Update API URL for production"
git push
```
Vercel will automatically redeploy!

---

## ✅ You're Live!

Share your Vercel URL with your friend — they can sign up, enter your invite code, and you're bonded! 🎉

---

## 💡 Free Tier Limitations to Know

| Service | Free Limit | What it means |
|---------|-----------|---------------|
| **Render** | Sleeps after 15 min inactivity | First load after inactivity takes ~30 sec. That's it — still works! |
| **Google Gemini** | 15 requests/min, 1M tokens/day | Way more than enough for personal use |
| **Vercel** | 100GB bandwidth/month | Plenty for a personal app |
| **GitHub** | Unlimited public repos | Free forever |

---

## 🆘 Common Problems & Fixes

**"npm is not recognized"** → Node.js didn't install properly. Restart your computer and try again.

**"Permission denied"** (Mac) → Add `sudo` before the command, e.g. `sudo npm install`

**Backend says "Invalid API key"** → Open `.env` and make sure `GOOGLE_API_KEY` has no spaces around the `=` sign.

**Frontend shows blank page** → Make sure BOTH terminals are running (backend on 5000, frontend on 5173).

**Git asks for password** → Use your GitHub Personal Access Token, not your account password (see Step 3 of Part 2).
