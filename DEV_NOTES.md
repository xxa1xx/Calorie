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

## 4. Mistakes Made During Development

**DailyNotes overwriting the fasting timer**
DailyNotes saved by spreading the entire `daily_meta` object into the upsert. Since FastingTimer's `fast_started_at` column wasn't in DailyNotes's own state, the spread would null it out silently on every notes save. Fixed by explicitly listing only the columns DailyNotes owns in the upsert payload.

**Running the setup guide SQL files out of order**
Schema files must run in order (v1 → v2 → v3 → v4 → v5 → v6) because later files reference tables or columns created by earlier ones. Running them out of order causes foreign key or column-not-found errors.

**AI endpoints had no authentication**
The three AI Netlify functions (`log-food`, `get-suggestions`, `get-insights`) launched with zero auth — any request with the right URL could consume the Anthropic API key. A motivated person could run up a large bill. Fixed with JWT verification on every request.

**Trusting client-supplied profile data**
The original functions accepted `profile` in the POST body and used it directly in the Claude prompt. A user could send fabricated profile data (wrong targets, wrong dietary options). Now the server fetches the profile from the database using the verified user identity.

**No server-side image validation**
The 5MB image size limit was checked only in the browser. Anyone calling the API directly could send arbitrarily large images to Claude. Added a server-side size check (converting base64 length to approximate byte count) and MIME type allowlist.

**No rate limiting on AI calls**
Without limits, a single user with a valid account could call the AI endpoints thousands of times a day. All three endpoints now have per-user daily limits enforced atomically in Postgres.

---

## 5. What Was Done Well

**Row Level Security on every table**
From day one, every table has RLS enabled with policies tied to `auth.uid()`. No user can read, write, or delete another user's data — not through the browser, not through direct API calls, not through any workaround. The database enforces this independently of the application code.

**Macro calculations done client-side, saved to DB**
`calculateDailyTargets()` uses the Mifflin-St Jeor equation — a well-validated clinical standard. Targets are recalculated and stored on every profile save, not recomputed on every page load, which keeps the UI fast.

**Dietary context is injected into every AI call, not just some**
`buildDietaryContext()` is called in all three AI functions. Whether logging food, getting suggestions, or reading weekly insights — if a user has keto or bariatric flags set, every AI response respects those constraints.

**DailyNotes and FastingTimer save independently**
Two components write to the same `daily_meta` row but using selective column upserts — they don't interfere with each other. This is the correct pattern for shared-row writes.

**Progressive Web App from the start**
The PWA manifest and Apple meta tags mean users can install the app to their home screen on both Android and iOS without any app store. On Android the fasting timer notification works even when the app is closed.

**Streak and rollover are useful motivational mechanics**
The streak algorithm correctly handles the edge case of "today not yet logged" (counts from yesterday backward). The rollover caps at 300 kcal to prevent the anti-pattern of banking large deficits and then binge-eating.

**The scheduled email summary is owner-only infrastructure**
Regular users just toggle "Daily email summary" in settings. You (the owner) set up Resend once. Nobody else ever touches an API key or environment variable. That's the right separation.

**No profile data in AI request bodies**
After the security fix, the AI functions receive only what's needed from the client (food description, today's running totals for context) and pull everything sensitive (targets, dietary options, goals) from the database server-side. This means a user can't manipulate their AI responses by sending fake profile data.

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
