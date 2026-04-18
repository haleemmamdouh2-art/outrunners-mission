# 🏃 Outrunners Community UK - Deployment Guide

This guide will help you push your dashboard to GitHub and launch it live on Vercel with a connected Telegram Bot.

---

## 1. 📂 GitHub Setup (Repository)

1. Go to [github.com/new](https://github.com/new).
2. Name your repository (e.g., `outrunners-dashboard`).
3. Click the link that says **"uploading an existing file"**.
4. **Drag and Drop** these files from your project folder:
   - `index.html`
   - `outrunners.css`
   - `outrunners.js`
   - `.gitignore`
   - `api` folder (containing `telegram.js`)
5. Click **"Commit changes"**.

---

## 2. 🚀 Vercel Deployment

1. Go to [vercel.com](https://vercel.com) and log in with GitHub.
2. Click **"Import"** on your new repository.
3. Click **"Deploy"**.
4. Copy your new Vercel URL (e.g., `https://outrunners.vercel.app`).

---

## 3. 🤖 Linking the Telegram Bot

To activate live tracking, run this in your browser:
`https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook?url=YOUR_VERCEL_URL/api/telegram`

---

## 🛠 Support
* **Live Status**: Once active, the dashboard shows a "LIVE" badge.
* **Map**: Marker syncs in real-time with your Telegram Live Location.
