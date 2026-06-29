# CalorieAI — Developer Notes

---

## 1. Frontend–Backend Loops

### Authentication Loop

```
Browser (React)
  → supabase.auth.signInWithPassword(email, password)
  → Supabase Auth (cloud)
  → Returns JWT access_token + refresh_token
  → Stored in localStorage under key 'calorieai-session'
  → useAuth hook fires onAuthStateChange → sets user in React context
  → App renders Dashboard instead of Auth screen
```

The JWT auto-refreshes before it expires (`autoRefreshToken: true`). When the user returns to the app, `onAuthStateChange` fires `INITIAL_SESSION` immediately from localStorage — no extra `getSession()` call needed.

---

### Data Load Loop (Dashboard)

```
Dashboard mounts
  → supabase.from('food_logs').select('*').eq('user_id', user.id).gte('date', thirtyDaysAgo)
  → Supabase (RLS enforced: only this user's rows returned)
  → Returns all logs for last 30 days
  → Split into: todayLogs, allLogs, weeklyLogs, recentLogs
  → calcStreak(allLogs) → streak count
  → calcRollover(allLogs, target) → yesterday's deficit (capped at 300 kcal)
  → sumLogs(todayLogs) → todayTotals (calories, protein, carbs, fat, fiber)
  → All passed down as props to child components
```

---

### Manual / Search / Barcode Log Loop (free, no AI)

```
User fills form / scans barcode / picks from search
  → FoodLogger or BarcodeScanner or FoodSearch
  → supabase.from('food_logs').insert(entry)   ← direct to DB, no function call
  → supabase.from('favorites').upsert(...)     ← saves for Quick Log
  → onLogged(entry) callback fires
  → Dashboard re-fetches logs (or appends optimistically)
  → UI updates immediately
```

---

### AI Log Loop (costs ~$0.015)

```
User types description (or uploads photo)
  → FoodLogger (AI tab)
  → supabase.auth.getSession() → gets JWT access_token
  → POST /api/log-food
      Header: Authorization: Bearer <token>
      Body: { description, todayLog, imageBase64?, imageType? }
             (profile intentionally NOT in body — fetched server-side)

  [Netlify Function: log-food.js]
  → requireAuth(event)
      → validates JWT via supabase.auth.getUser(token)
      → returns verified user object
  → checkRateLimit(supabase, 'log_food_count', 30)
      → calls Supabase RPC check_and_increment_ai_usage()
      → atomic: checks count < 30, increments if allowed, returns boolean
  → fetchProfile(supabase, user.id)
      → reads profile from DB — never trusts client body
  → buildDietaryContext(profile.dietary_options)
      → injects dietary rules into Claude system prompt
  → anthropic.messages.create(claude-opus-4-8, thinking: adaptive)
      → Claude returns JSON: { calories, protein_g, carbs_g, fat_g, fiber_g, items[], feedback }
  → returns 200 with nutrition JSON

  [Back in FoodLogger.jsx]
  → supabase.from('food_logs').insert(entry)   ← saves to DB
  → supabase.from('favorites').upsert(...)     ← saves for Quick Log
  → shows feedback message to user
  → onLogged() fires → Dashboard refreshes totals
```

---

### AI Suggestions Loop (costs ~$0.05)

```
User clicks "Get Ideas" in Suggestions tab
  → Recommendations.jsx
  → supabase.auth.getSession() → JWT
  → POST /api/get-suggestions
      Header: Authorization: Bearer <token>
      Body: { todayLog, recentLogs }   ← profile NOT in body

  [Netlify Function: get-suggestions.js]
  → auth check → rate limit (10/day) → fetch profile from DB
  → builds prompt with remaining macros, recent foods, dietary rules
  → Claude returns: { suggestions: [...], summary: "..." }
  → 200 response

  [Recommendations.jsx]
  → renders suggestion cards
```

---

### AI Weekly Insights Loop (costs ~$0.05)

```
User clicks "Analyze Week" in Insights tab
  → WeeklyInsights.jsx
  → JWT → POST /api/get-insights
      Body: { weeklyLogs }   ← profile NOT in body

  [Netlify Function: get-insights.js]
  → auth check → rate limit (5/day) → fetch profile from DB
  → summarises 7 days of log data (date, calories, macros, meal names)
  → Claude returns: { average, patterns[], strengths[], improvements[], weekSummary, onTrack }
  → 200 response
```

---

### Daily Email Loop (automated, owner-only setup)

```
Netlify Scheduled Function: runs at 8pm UTC daily
  → daily-summary.js
  → reads SUPABASE_SERVICE_ROLE_KEY (bypasses RLS)
  → queries all profiles WHERE email_summary = true
  → for each: fetches their food logs for today
  → calculates totals, percentage of target
  → sends HTML email via Resend API
  → no user interaction needed — runs entirely server-side
```

---

### Settings Save Loop

```
User edits settings → clicks "Save Changes"
  → Settings.jsx collects form state
  → calculateDailyTargets(profileData)
      → Mifflin-St Jeor BMR → TDEE × activity multiplier → ± goal adjustment
      → splits calories into protein (1.8g/kg), fat (27%), carbs (remainder)
  → supabase.from('profiles').update({...profileData, ...targets}).eq('id', user.id)
  → onSaved() fires → App updates profile state → all targets recalculate immediately
```

---

## 2. User Interface

### Auth Screen
Two tabs: **Sign In** and **Create Account**. Password has a show/hide toggle and a 5-segment strength meter (checks length, uppercase, numbers, symbols). "Forgot your password?" switches to a reset form that emails a link via Supabase.

---

### Dashboard Tabs

**Today**
- MacroProgress card: calorie ring, macro bars (protein/carbs/fat/fiber), workout day badge (adds bonus calories), rollover badge (yesterday's deficit, max +300 kcal), streak counter
- FastingTimer: set a 12–24h fast, live countdown, progress bar, browser notification when eating window opens
- WaterTracker: 8-glass target, tap to increment
- DailyNotes: workout day toggle, mood picker, free-text notes — each saved independently to `daily_meta` table
- QuickLog: 6 most recently used meals, one-tap re-log
- FoodLogger: 4 tabs — Manual | Search (Open Food Facts) | Scan (barcode camera) | AI (text + photo)
- Copy Yesterday button: duplicates all of yesterday's log entries to today
- Today's entries list: expandable per-entry with macros, delete button

**History**
- FoodLogHistory: last 30 days, expandable per day, shows totals, net carbs (carbs minus fiber), deficit/surplus vs target

**Recipes**
- RecipeLibrary: build multi-ingredient recipes from the food database, set servings, log a whole recipe in one tap

**Progress**
- CalorieChart: 7-day bar chart vs daily target
- WeightTracker: daily weigh-in, 30-day trend chart, goal line, BMI, kg to go, export CSV

**Suggestions**
- Recommendations: AI meal suggestions based on remaining macros, recent history, dietary options. Tap "Get Ideas" to generate.

**Insights**
- WeeklyInsights: AI weekly pattern analysis — averages, patterns noticed, strengths, areas to improve, on-track status.

**Settings**
- Profile, Weight & Goal, Workout Settings, Dietary & Health Options (10 flags), Notifications (browser reminder + email summary toggle)

---

## 3. Better Prompts for AI Logging

The AI food logging understands natural language. Here's how to get more accurate results:

**Be specific about portions:**
- Instead of: `pasta`
- Use: `200g penne pasta with 150g tomato sauce and 30g parmesan`

**Name the cooking method:**
- `2 eggs scrambled in butter` vs `2 eggs boiled`
- `150g chicken breast grilled` vs `150g chicken fried in oil`

**Use brand names when you know them:**
- `Halo Top vanilla ice cream 120ml`
- `Greggs cheese and onion pasty`

**Stacked meals work fine:**
- `ham sandwich on white bread with mayo, bag of Walkers ready salted crisps, apple`

**For restaurant meals:**
- `McDonald's Big Mac meal with medium fries and diet coke`
- `Nandos half chicken peri-peri with coleslaw and corn on the cob`

**Photo tips:**
- Shoot from above so all items are visible
- Add a description alongside the photo for tricky items: `this is homemade moussaka`
- For plated restaurant food: `describe what's on the plate` in the text box

**Avoid vague quantities:**
- `some pasta` → worse estimate than `a bowl of pasta (about 300g cooked)`
- `a bit of cheese` → worse than `30g cheddar`

---

## 4. Prompting Mistakes

**Combining unrelated requests into one message**
"yes lets do that I need limits plus do a full security audit line by line and the app as a whole" — two distinct tasks (rate limiting + full audit) in one message. When you stack requests like this, the model has to decide how to prioritise and may underdeliver on one. Cleaner: confirm the audit first, then in a follow-up say "now add rate limits too."

**Vague scope without a definition of done**
"make sure instructions are up to date" — this has no clear finish line. What counts as up to date? Which instructions? The model had to infer the entire scope. A better version: "SETUP_GUIDE.md is missing the fasting timer and email summary features — update it to cover those."

**Short follow-ups that rely on assumed context**
"do they need to go to resend?" — who is "they"? In context it was obvious, but this kind of message works fine in a short session and breaks completely after a context compaction. Writing "do regular users (wife/friends) need a Resend account to receive emails?" costs two extra seconds and removes all ambiguity permanently.

**Asking for a description instead of an action**
"what security features does this have?" — this got you a description of the current state, but the real intent was to identify gaps and fix them. Skipping the description step and going straight to "audit the security of this app and fix anything critical" would have saved a round-trip.

**No constraint on effort or depth**
"do a full security audit line by line and the app as a whole" — "line by line" and "the whole app" pull in opposite directions (one is exhaustive micro-review, the other is broad architecture review). Picking one scope produces a more useful result than asking for both.

**Confirming without specifying limits**
"yes lets do that" after a security plan was described — this is fine for simple tasks, but for a large multi-file change it's worth adding a constraint: "yes, but keep the rate limits generous — this is for family use, not a public product." That context changes the numbers chosen (30/10/5 per day were picked as reasonable defaults, but you weren't consulted).

---

## 5. What Was Done Well (Prompting)

**Providing real-world context, not just a technical spec**
"my account I don't mind set up but if wife or friends join I just want them to be able to go to app and set up everything" — this one sentence explained the actual use case (personal family app, not a SaaS product). It changed how the auth flow, setup guide, and email feature were framed. Real context beats feature descriptions every time.

**Building iteratively instead of spec-ing everything upfront**
Features were added one conversation at a time — fasting timer, then email summaries, then security. This meant each feature could be tested before the next one was added, and mistakes were caught at a small scale rather than buried in a large untested batch.

**Asking for a check before trusting the output**
"OK add that to instructions to check that" — after being told what Supabase sign-up settings to verify, you immediately asked for it to be added to the setup guide. Catching the gap between "the model knows this" and "this is documented for users" is exactly right.

**Pushing back to clarify responsibility**
"do they need to go to resend?" — even if the phrasing was short, the underlying instinct was correct: you noticed that the email setup instructions might burden regular users and asked whether that was the case. Questioning who does what is exactly the right habit.

**Asking for the security audit explicitly rather than assuming**
Most people building a personal app would never think to ask for a security audit. Asking the question surfaced three critical issues (no auth, no rate limits, client-trusted profile data) that would have been invisible until someone exploited them. The decision to ask was the most valuable prompt in the entire session.

**Letting the model make implementation decisions**
You didn't specify how to implement JWT verification, how to structure the rate-limit table, or what the daily limits should be. This is usually the right call — you set the goal, the model picks the approach. Where this can go wrong is when you have a specific constraint (budget, UX, existing pattern) that the model can't know — in those cases, add the constraint rather than leaving it open.

---

## 6. Security Architecture

### What Protects the Database

**Supabase Row Level Security** — every table has RLS enabled. The policies use `auth.uid()` which is extracted from the JWT by Supabase's auth middleware. This runs inside the Postgres query planner — it cannot be bypassed by any client-side code or API call.

Tables and their policies:
- `profiles`: select/insert/update by `auth.uid() = id`
- `food_logs`: select/insert/update/delete by `auth.uid() = user_id`
- `favorites`: select/insert/update/delete by `auth.uid() = user_id`
- `recipes`: select/insert/update/delete by `auth.uid() = user_id`
- `daily_meta`: select/insert/update by `auth.uid() = user_id`
- `weight_logs`: select/insert/update/delete by `auth.uid() = user_id`
- `ai_usage`: select by `auth.uid() = user_id` (writes are via security definer RPC only)

---

### What Protects the AI Endpoints

All three Netlify functions (`log-food`, `get-suggestions`, `get-insights`) apply four checks in order before calling Claude:

1. **JWT verification** — `supabase.auth.getUser(token)` validates the token cryptographically against Supabase's signing key. Forged tokens fail here. Expired tokens fail here. No token = 401.

2. **Rate limiting** — `check_and_increment_ai_usage()` is a Postgres `SECURITY DEFINER` function. It runs as the table owner, not the calling user, so it can bypass RLS for the upsert while still using `auth.uid()` for identity. The check and increment are a single atomic `UPDATE ... RETURNING` — there's no race condition between checking and incrementing.

3. **Server-side profile fetch** — the profile is read from the DB using the verified user identity, not taken from the request body. A user cannot spoof targets or dietary flags.

4. **Input validation** — image size is checked server-side (base64 length × 0.75 ≈ byte count), MIME type is allowlisted. Description length is bounded by the Anthropic token limit.

---

### What the Anon Key Can and Cannot Do

The `VITE_SUPABASE_ANON_KEY` is embedded in the browser bundle and is deliberately public. It is not a secret. What it cannot do:
- Read other users' data (blocked by RLS)
- Write to other users' rows (blocked by RLS)
- Bypass rate limits (the RPC uses `auth.uid()` from the JWT)
- Elevate privileges (anon key has no service-role access)

What it can do:
- Sign up / sign in (that's its purpose)
- Read/write rows where `auth.uid()` matches

---

### What the Service Role Key Can Do

`SUPABASE_SERVICE_ROLE_KEY` bypasses RLS entirely — it is a full admin credential. It is used only in:
- `daily-summary.js` (the scheduled email function) — never runs in the browser, only on Netlify's servers on a cron schedule

It is never in `VITE_` variables (which would embed it in the browser bundle). It is never sent to any client.

---

### What Is Not Protected (Known Gaps)

**No CSRF protection on Netlify functions** — the functions check the JWT, which provides equivalent protection for state-modifying requests. A CSRF attack would still need the victim's valid JWT, which cannot be read cross-origin due to CORS.

**No request body size limit on Netlify functions** — very large JSON payloads (not images — those are checked) could be sent. Netlify itself has a 6MB request body limit that acts as a backstop.

**Email enumeration on signup** — Supabase's auth endpoint reveals whether an email is already registered via the "already registered" error. This is standard Supabase behaviour and cannot be changed without switching to a custom auth flow.

**No two-factor authentication** — Supabase supports TOTP 2FA but it is not enabled. For a personal family app this is acceptable; for a wider audience it should be considered.

**Anthropic API key is on Netlify** — if Netlify's environment is compromised, the key is exposed. This is unavoidable with any serverless architecture. Mitigate by setting a monthly spend limit in the Anthropic console.

---

## Quick Reference: Environment Variables

| Variable | Where set | Used by | Secret? |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Netlify env | Browser + Netlify functions | No |
| `VITE_SUPABASE_ANON_KEY` | Netlify env | Browser + Netlify functions | No (public by design) |
| `ANTHROPIC_API_KEY` | Netlify env | log-food, get-suggestions, get-insights | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Netlify env | daily-summary only | Yes — never use in VITE_ |
| `RESEND_API_KEY` | Netlify env | daily-summary only | Yes |
| `PUBLIC_APP_URL` | Netlify env | daily-summary (email links) | No |

---

*Branch: `claude/netlify-calorie-counter-btumzn`*
