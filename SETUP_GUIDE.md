# CalorieAI — Setup & Deployment Guide

---

## What You Need

- Free account at **supabase.com** (database + login)
- Free account at **netlify.com** (hosting)
- API key from **console.anthropic.com** (AI features — pay per use, ~$2–5/month typical use)
- Your GitHub repo with the CalorieAI code

---

## Step 1 — Create a Supabase Project

1. Go to **supabase.com** → sign in → click **New project**
2. Enter a project name (e.g. `calorieai`)
3. Set a strong database password (save it somewhere safe)
4. Choose the region closest to you
5. Click **Create new project** and wait ~2 minutes

---

## Step 2 — Run the Database Schema

You need to run 3 SQL files in order. In your Supabase project:

1. Click **SQL Editor** in the left sidebar
2. Click **New query**
3. Open **`supabase/schema.sql`** from the repo → paste the entire contents → click **Run**
4. Click **New query** again
5. Open **`supabase/schema-v2.sql`** → paste → click **Run**
6. Click **New query** again
7. Open **`supabase/schema-v3.sql`** → paste → click **Run**

Each should say "Success". If you see an error, check you're running them in order.

---

## Step 3 — Get Your Supabase Credentials

1. In Supabase, click **Project Settings** (gear icon, bottom of left sidebar)
2. Click **API**
3. Copy and save these two values:
   - **Project URL** — e.g. `https://abcdefgh.supabase.co`
   - **anon public** key — the long string under "Project API keys"

---

## Step 4 — Get Your Anthropic API Key

1. Go to **console.anthropic.com** → sign in
2. Click **API Keys** → **Create Key**
3. Copy the key (starts with `sk-ant-...`) — you only see it once
4. Go to **Billing** and add a payment method (you won't be charged until you use it)

**Cost guide:**
| Action | Approximate cost |
|---|---|
| Log a meal (AI) | ~$0.015 |
| Get meal suggestions | ~$0.05 |
| Weekly insights | ~$0.05 |
| Manual meal entry | $0.00 |
| Quick-log a saved meal | $0.00 |

Tip: use **Manual Entry** or **Quick Log** for everyday meals and save AI for when you want feedback or suggestions.

---

## Step 5 — Deploy to Netlify

1. Go to **netlify.com** → sign in → click **Add new site**
2. Click **Import an existing project** → connect to GitHub
3. Select your **Calorie** repository
4. Set branch to: `claude/netlify-calorie-counter-btumzn`
5. Netlify will detect the build settings automatically — **do not change them**
6. **Do not click Deploy yet** — go to Step 6 first

---

## Step 6 — Set Environment Variables in Netlify

Still in the Netlify setup screen, find **Environment variables** and add:

| Variable Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase Project URL (from Step 3) |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key (from Step 3) |
| `ANTHROPIC_API_KEY` | Your Anthropic API key (from Step 4) |

> **Important:** Spell the variable names exactly as shown above, including the `VITE_` prefix on the first two.

Now click **Deploy site**.

---

## Step 7 — Wait for the Build

- The build takes 2–3 minutes
- Watch the progress in the **Deploys** tab
- When it says **Published**, your site is live
- Netlify gives you a URL like `https://wonderful-name-123.netlify.app` — click it to open the app

---

## Step 8 — Update Supabase with Your Live URL

This is needed for password reset emails to work.

1. Copy your Netlify URL
2. Go back to Supabase → **Authentication** → **URL Configuration**
3. Set **Site URL** to your Netlify URL
4. Under **Redirect URLs**, add your Netlify URL

---

## Step 9 — Create Your Accounts

1. Open the app at your Netlify URL
2. Click **Create Account** — enter your email and a strong password
3. Check your email and click the confirmation link
4. Sign in and complete the 4-step setup:
   - **Step 1:** Name, age, gender
   - **Step 2:** Height, current weight, goal weight
   - **Step 3:** Activity level, weight goal
   - **Step 4:** Dietary options — tick GLP-1, keto, bariatric, etc. (you can change these anytime in Settings)
5. Your wife repeats this on her own device — her account is completely separate

---

## Step 10 — (Optional) Add a Custom Domain

If you want a URL like `calories.yourdomain.com`:

1. In Netlify → **Domain management** → **Add custom domain**
2. Follow the instructions to update your DNS settings

---

## Using the App

### Logging Food

| Method | API cost | Best for |
|---|---|---|
| **Manual Entry** | Free | Meals you already know the macros for |
| **Quick Log** | Free | Meals you've logged before (auto-saved) |
| **AI Text** | ~$0.015 | New meals, estimating portions |
| **AI Photo** | ~$0.015 | When you can't be bothered typing |

### AI Features (all on-demand — only costs when you tap the button)

- **Meal Suggestions** — tap "Get Ideas" in the Suggestions tab
- **Weekly Insights** — tap "Analyse Week" in the Insights tab

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Build fails on Netlify | Check the build log. Usually a misspelled env variable name. |
| "Missing Supabase environment variables" | `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is missing or misspelled in Netlify |
| "Failed to analyse food" | Check `ANTHROPIC_API_KEY` in Netlify. Make sure billing is set up at console.anthropic.com |
| Blank screen after login | The SQL schemas didn't run. Re-run all 3 files in Supabase SQL Editor |
| Password reset links don't work | You haven't added the Netlify URL to Supabase → Authentication → URL Configuration (Step 8) |
| Confirmation email not arriving | Check spam. In Supabase → Authentication → Email Templates you can resend. |

---

## Monthly Cost Summary (typical family use)

| Service | Plan | Cost |
|---|---|---|
| Supabase | Free tier | $0 |
| Netlify | Free tier | $0 |
| Anthropic | Pay per use | ~$2–5/month |
| **Total** | | **~$2–5/month** |

The free tiers are generous enough that only the Anthropic API usage will cost anything for personal use.

---

*Generated for the CalorieAI project — branch `claude/netlify-calorie-counter-btumzn`*
