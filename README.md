# forma — Training Analytics Portal

**forma** is a production-grade Training Analytics Portal designed for engineering academies, bootcamps, and technical organizations. It tracks trainee evaluation sessions, scores, error rates, time-to-completion, and longitudinal growth analytics across cohorts and curricula.

---

## 🔒 Role-Based Permissions Matrix

| Feature / Resource | ADMIN | TRAINER | TRAINEE | Description |
|---|:---:|:---:|:---:|---|
| **Overview & Metrics** | Full Access | Assigned Cohorts | Personal Progress | Portal analytics, KPI metrics, and progress charts |
| **At-Risk Detection Panel** | Full Access | Assigned Cohorts | Hidden | Rule-based explainable at-risk flags and severity |
| **Weak-Topic Heatmap** | Full Access | Assigned Cohorts | Hidden | Trainee × topic matrix and ranked curriculum gaps |
| **Side-by-Side Comparison** | Full Access | Full Access | Privacy Safe | Benchmarking two batches or trainees side by side |
| **Record Session Results** | Full Access | Assigned Cohorts | ❌ Read-Only | Submit, bulk-import, and edit evaluation scores |
| **Milestone Badges** | Award / View | Award / View | View & Export | Idempotently awarded achievements & PDF certificate |
| **AI Feedback Draft** | Full Access | Assigned Cohorts | ❌ Read-Only | Aggregated metrics-only feedback generator |
| **Audit Logs** | View All | ❌ Forbidden | ❌ Forbidden | Immutable security & change log with actor tracking |
| **Global Search (⌘K)** | All Records | Assigned Cohorts | Personal Scope | Debounced, keyboard-navigable command palette |
| **Weekly Digest Email** | Full Access | Opt-in / Preview | ❌ Forbidden | Scheduled performance digest via nodemailer/preview |

---

## 🧠 Insights Engine Architecture (`server/src/insights/`)

The core insights engine is decoupled into pure, unit-tested mathematical and statistical functions:

1. **Rule-Based Explainable At-Risk Detection**:
   - **Score Drop Rule**: Last 3 scores strictly falling ($s_1 > s_2 > s_3$) by more than 10 points total.
   - **Error Spike Rule**: Latest error count is $>30\%$ above the trainee's previous 3 sessions' average.
   - **Batch Deficit Rule**: Trainee cumulative average is $>15$ points below the batch benchmark.
   - **Absence Spike Rule**: 2 or more recorded absences within the last 5 sessions.
   - **Severity**: Flagged as `HIGH` if 2 or more rules trigger; `MEDIUM` if 1 rule triggers.
   - **Thresholds**: Fully configured and documented in `server/src/insights/config.ts`.

2. **Weak-Topic Analysis**:
   - Computes Trainee × Topic matrix with average score, error rate, and sample size ($n$).
   - Ranks curriculum topics ascending by average score to pinpoint teaching gaps.

3. **Benchmarking & Percentiles**:
   - Computes mid-point percentile ranks for scores (higher is better) and errors/time (lower is better).
   - Side-by-side comparison endpoint (`GET /api/v1/insights/compare`) and interactive UI (`/compare`).
   - Trainee-facing view strictly displays personal progress without competitor rankings or peer names.

4. **Improvement & Consistency**:
   - **Improvement**: Calculated via Ordinary Least Squares (OLS) regression slope ($m$) plus total delta from first 3 to latest 3 sessions.
   - **Consistency**: Scaled standard deviation index ($100 - \frac{\sigma}{\sigma_{\max}} \times 100$). High consistency indicates steady, dependable execution.

5. **Score Projections**:
   - Linear trend projection with confidence interval range $[score_{\min}, score_{\max}]$.
   - Clearly labeled: *"Estimate based on the current trend"*.
   - Automatically hidden when fewer than 5 evaluated sessions exist.

6. **Insight Sentences**:
   - Grounded template sentences generated on the Overview page (maximum 5), with direct links to filtered views.
   - Cohorts with fewer than 5 sample points are strictly excluded to avoid premature conclusions.

---

## 📬 Engagement Features

- **Weekly Digest Email (`server/src/services/digest.ts`)**:
  - Scheduled engine compiling top improvers, at-risk trainees with reasons, and pending evaluations.
  - Delivered via Nodemailer (SMTP env config) with automated fallback to `./server/storage/email_previews/` in development.
  - Per-user opt-out stored in profile (`emailDigestEnabled: false`).
- **Milestone Badges & Certificate PDF**:
  - Five milestone badges: *First Milestone*, *5-Session Pass Streak*, *Topic Master*, *High Climber*, and *Perfect Attendance*.
  - Idempotent evaluation ensuring zero duplicate awards.
  - Built-in *"Download Certificate"* button generating high-resolution landscape PDF certificates via jsPDF.
- **Global Search Command Palette (`Ctrl+K` / `Cmd+K`)**:
  - Keyboard-accessible search modal with role-based scoping, debounced lookup, and quick action shortcuts.

---

## 🎨 UI Polish, Accessibility & Responsiveness

- **Dual Light & Dark Theme**: Toggle in header with instant color-scheme switching, persistent local storage, and AA contrast across all tokens.
- **Mobile Experience (390px)**: Horizontal table scrolling with sticky first column (`.table-sticky-col`), stacked metric cards, and responsive chart containers.
- **Accessible Charts**: Every chart features a *"View as Table"* toggle button and a text summary describing trends and takeaways.
- **AI Feedback Draft**: Mentor feedback synthesizer powered by `@google/genai` (Gemini 3.8 Flash) with local deterministic fallback. Strictly anonymized (only uses first name and mathematical aggregates; never exposes emails or raw notes).

---

## ⚠️ Known Limitations

1. **Local SQLite Concurrency**: The local development database uses SQLite; while optimized via Prisma transactions, high concurrent writes in production should utilize PostgreSQL via the `DATABASE_URL` connection string.
2. **AI Provider Fallback**: When `GEMINI_API_KEY` is not present, the AI Feedback Draft feature automatically and seamlessly utilizes the rule-based deterministic summary engine.
3. **Email SMTP in Dev Mode**: When SMTP credentials are not configured, digest emails are safely written to `server/storage/email_previews/` for local inspection without delivery failures.
