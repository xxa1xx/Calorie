# CalorieAI — Setup & Deployment Guide

---

## What You Need

| Service | Why | Cost |
|---|---|---|
| **supabase.com** | Database + user login | Free |
| **netlify.com** | Hosting | Free |
| **console.anthropic.com** | AI features (meal analysis, suggestions, insights) | ~$2–5/month |
| **resend.com** *(optional)* | Daily email summaries | Free |
| Your GitHub repo | The CalorieAI code | — |

---

## Step 1 — Create a Supabase Project

1. Go to **supabase.com** → sign in → click **New project**
2. Enter a project name (e.g. `calorieai`)
3. Set a strong database password — save it somewhere safe
4. Choose the region closest to you
5. Click **Create new project** and wait ~2 minutes

---

## Step 2 — Run the Database Schema

You need to run **5 SQL files in order**. In your Supabase project:

1. Click **SQL Editor** in the left sidebar → click **New query**
2. Open **`supabase/schema.sql`** from the repo → paste the full contents → click **Run**
3. Click **New query** → open **`supabase/schema-v2.sql`** → paste → click **Run**
4. Click **New query** → open **`supabase/schema-v3.sql`** → paste → click **Run**
5. Click **New query** → open **`supabase/schema-v4.sql`** → paste → click **Run**
6. Click **New query** → open **`supabase/schema-v5.sql`** → paste → click **Run**

Each should say **"Success"**. If you see an error, check you're running them in order.

---

## Step 3 — Get Your Supabase Credentials

1. In Supabase → **Project Settings** (gear icon, bottom-left) → **API**
2. Copy and save:
   - **Project URL** — e.g. `https://abcdefgh.supabase.co`
   - **anon public** key — the long string under "Project API keys"

---

## Step 4 — Get Your Anthropic API Key

1. Go to **console.anthropic.com** → sign in
2. Click **API Keys** → **Create Key** → copy it (starts with `sk-ant-...`)
3. Go to **Billing** → add a payment method (you won't be charged until you use AI features)

**AI cost guide:**

| Action | Cost |
|---|---|
| Log a meal with AI | ~$0.015 |
| Log a meal with photo | ~$0.015 |
| Get meal suggestions | ~$0.05 |
| Weekly insights | ~$0.05 |
| Manual / Quick Log / Search / Barcode / Recipe | **$0.00** |

Most day-to-day logging is free — AI is opt-in for each action.

---

## Step 5 — Deploy to Netlify

1. Go to **netlify.com** → sign in → click **Add new site** → **Import an existing project**
2. Connect to GitHub → select your **Calorie** repository
3. Set branch to: `claude/netlify-calorie-counter-btumzn`
4. Netlify will detect build settings automatically — **do not change them**
5. **Do not click Deploy yet** — go to Step 6 first

---

## Step 6 — Set Environment Variables in Netlify

Find **Environment variables** in the Netlify setup screen and add:

| Variable Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase Project URL (from Step 3) |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key (from Step 3) |
| `ANTHROPIC_API_KEY` | Your Anthropic API key (from Step 4) |

> **Important:** Spell the variable names exactly as shown, including the `VITE_` prefix on the first two.

Now click **Deploy site**.

---

## Step 7 — Wait for the Build

- The build takes 2–3 minutes
- Watch progress in the **Deploys** tab
- When it says **Published**, your site is live
- Netlify gives you a URL like `https://wonderful-name-123.netlify.app`

---

## Step 8 — Update Supabase with Your Live URL

Required for password reset emails to work.

1. Copy your Netlify URL
2. In Supabase → **Authentication** → **URL Configuration**
3. Set **Site URL** to your Netlify URL
4. Under **Redirect URLs**, add your Netlify URL

---

## Step 9 — (Optional) Set Up Daily Email Summaries

This sends a daily email at 8pm with each user's calorie summary. Requires a free **Resend** account.

1. Go to **resend.com** → sign up (free, no credit card required)
2. Click **API Keys** → **Create API Key** → copy it
3. *(For production)* Add and verify your domain under **Domains**. Without a domain, Resend can only send to your own verified email address.
4. In Netlify → **Site configuration** → **Environment variables**, add:

| Variable | Value |
|---|---|
| `RESEND_API_KEY` | Your Resend API key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → **service_role** key |
| `PUBLIC_APP_URL` | Your Netlify URL (e.g. `https://my-app.netlify.app`) |

5. Also update `netlify/functions/daily-summary.js` — change `noreply@yourdomain.com` to your verified Resend sender address
6. Trigger a new Netlify deploy so the scheduled function registers
7. In the app → **Settings** → turn on **Daily email summary**

> **Security note:** The service_role key has full database access. It only runs inside Netlify's servers on a schedule — it is never sent to the browser.

---

## Step 10 — Create Your Accounts

1. Open the app at your Netlify URL
2. Click **Create Account** — enter your email and a strong password
3. Check your email and click the confirmation link
4. Sign in and complete the 4-step setup:
   - **Step 1:** Name, age, gender
   - **Step 2:** Height, current weight, goal weight
   - **Step 3:** Activity level, weight goal
   - **Step 4:** Dietary options — tick GLP-1, keto, bariatric, etc. (you can change these anytime in Settings)
5. Your wife repeats this on her own device — each account is completely separate

---

## Step 11 — (Optional) Add a Custom Domain

If you want a URL like `calories.yourdomain.com`:

1. In Netlify → **Domain management** → **Add custom domain**
2. Follow the instructions to update your DNS records

---

## Using the App

### Logging Food — 4 methods, all free except AI

| Method | Tab | Cost | Best for |
|---|---|---|---|
| **Manual Entry** | Log Food → Manual | Free | You already know the macros |
| **Food Search** | Log Food → Search | Free | Search 2M+ products from Open Food Facts |
| **Barcode Scanner** | Log Food → Scan | Free | Scan any packaged product with your camera |
| **AI Analysis** | Log Food → AI | ~$0.015 | New meals, restaurant food, estimating portions |
| **AI Photo** | Log Food → AI | ~$0.015 | Take a photo of your meal |
| **Quick Log** | Quick Log card | Free | Re-log a meal you've had before (auto-saved) |
| **Recipe** | Recipes tab | Free | Log a saved recipe in one tap |

---

### Today Tab

- **Calorie progress** — daily target with workout bonus and yesterday's rollover
- **Streak counter** — consecutive days logged (🔥)
- **Daily Notes** — workout day toggle (adds extra calories to target), mood tracker, text notes
- **Fasting Timer** — set duration (12–24h), live countdown, browser alert when eating window opens
- **Water tracker** — 8-glass target
- **Quick Log** — your 6 most-used meals, one tap to log
- **Log Food** — 4-tab logger: Manual, Search (Open Food Facts), Scan (barcode), AI
- **Copy Yesterday** — duplicates all of yesterday's entries to today
- **Today's entries** — expandable list with macros per entry, delete button

---

### History Tab

Browse your last 30 days of food logs. Each day shows:
- Total calories vs. target (over/under)
- Expandable entry list with per-entry macros
- Net carbs (carbs minus fiber) per day

---

### Recipes Tab

Build reusable recipes from the food database:
- Search ingredients, set gram amounts, set number of servings
- Per-serving macros calculated automatically
- Log any recipe in one tap; adjust serving count before logging

---

### Progress Tab

- **7-day calorie chart** — bar chart vs. daily target
- **Weight tracker** — log daily weigh-ins, 30-day trend chart, goal line, kg to go
- **BMI** — calculated from current weight and height, with category label
- **Export CSV** — download your complete food log for doctors or dietitians

---

### Suggestions Tab

AI-generated meal suggestions based on your remaining macros, recent eating patterns, and dietary options. Tap **Get Ideas** — uses ~$0.05 of AI credit.

---

### Insights Tab

Weekly pattern analysis: what's working, what's not, trends over the week. Tap **Analyse Week** — uses ~$0.05 of AI credit.

---

### Settings

- Update name, age, height, weight, goal, activity level
- Toggle dietary options (GLP-1, bariatric, keto, high protein, etc.)
- Set workout calorie bonus (extra kcal added on workout days)
- Enable/disable browser reminder notifications (7pm daily)
- Enable/disable daily email summary

---

### Dietary Options

The app supports 10 dietary/health flags. When active, all AI features (meal logging, suggestions, insights) automatically adjust their advice:

| Option | What it changes |
|---|---|
| GLP-1 Medication | Expects small portions; eating under target is normal |
| Bariatric Surgery | Very small portions; protein-first priority; no dumping syndrome foods |
| Keto / Low Carb | Net carbs under 50g; fat is primary fuel |
| High Protein | Prioritises protein; flags low-protein meals |
| Diabetes / Blood Sugar | Avoids simple carbs and spikes |
| Heart Health | Low saturated fat; Mediterranean style |
| Plant-Based | No meat/fish/dairy |
| Gluten Free | Flags gluten-containing foods |
| Dairy Free | No dairy products |
| Cutting / Competition Prep | High precision tracking; very low calories expected |

---

## Install as a Phone App

CalorieAI is a **Progressive Web App (PWA)** — install it on your phone for a native app feel:

- **Android (Chrome):** three-dot menu → "Add to Home Screen"
- **iPhone (Safari):** Share button → "Add to Home Screen"

Once installed, browser notifications (fasting alerts, daily reminders) work even when the app isn't open on Android. iPhone has limited notification support outside the app.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Build fails on Netlify | Check the build log — usually a misspelled env variable name |
| "Missing Supabase environment variables" | `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is missing or misspelled |
| "Failed to analyse food" | Check `ANTHROPIC_API_KEY` in Netlify; make sure billing is set up at console.anthropic.com |
| Blank screen after login | The SQL schemas didn't run — re-run all 5 files in Supabase SQL Editor in order |
| Recipes or Daily Notes not saving | `schema-v4.sql` was not run — run it in Supabase SQL Editor |
| Fasting timer not saving | `schema-v5.sql` was not run — run it in Supabase SQL Editor |
| Email summaries not arriving | Check `RESEND_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` in Netlify; check spam |
| Email summary shows wrong sender | Update `noreply@yourdomain.com` in `netlify/functions/daily-summary.js` |
| Barcode not found | Try the 13-digit number manually; not all products are in Open Food Facts |
| Camera blocked for barcode scan | Allow camera access in browser settings for the site |
| Notifications not working on iPhone | iOS requires Safari and "Add to Home Screen"; full push support is limited |
| Password reset links don't work | Add your Netlify URL to Supabase → Authentication → URL Configuration (Step 8) |
| Confirmation email not arriving | Check spam; in Supabase → Authentication → Email Templates you can resend |

---

## Monthly Cost Summary

| Service | Plan | Cost |
|---|---|---|
| Supabase | Free tier | $0 |
| Netlify | Free tier | $0 |
| Resend | Free tier (3,000 emails/month) | $0 |
| Anthropic | Pay per use | ~$2–5/month |
| **Total** | | **~$2–5/month** |

Typical usage: AI features are the only real cost. Using Manual, Search, Barcode, and Recipe logging for everyday meals keeps AI costs to a minimum.

---

*CalorieAI — branch `claude/netlify-calorie-counter-btumzn`*
