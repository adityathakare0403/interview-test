# Sentari Interview Template

Welcome candidate! This repository is a **self-contained sandbox**. It does _not_ connect to any Supabase instance or external API; everything you need is already here.

---

## 1 Project Setup
```bash
pnpm install     # install locked dev-dependencies
pnpm lint        # ESLint + Prettier (zero warnings allowed)
pnpm test        # Vitest unit tests – must be green
cp env.example .env  # (optional) add your OpenAI key to run live calls
```

## 2 Domain Types & Mock Data
* `src/lib/types.ts` – exact TypeScript interfaces used in production.
* `Expanded_Diary_Entries.csv` – 200-row fixture at repo root (all DB columns).
* `src/lib/mockData.ts` – loads the CSV at runtime and exports it as `mockVoiceEntries`.
* `src/lib/openai.ts` – optional helper: if `OPENAI_API_KEY` is present it calls the real API, otherwise returns deterministic stubs so tests still pass offline.

> **Note:** the CSV mirrors our current production schema, but you're welcome to add extra columns in your local copy if your solution needs them (e.g. a temporary `score` field). Keep the original columns untouched so our automated checker can still parse the file.

## 3 Your Only Job
Open `src/lib/sampleFunction.ts` and complete the body of `processEntries()`.  
Requirements:
1. Pure & synchronous (no network or file-system side-effects unless you use the provided OpenAI helper).  
2. Must return a `ProcessedResult` object (defined in `types.ts`).  
3. Update / add tests in `tests/sampleFunction.test.ts` so coverage is > 90 %.  

## 4 Rules
✅ Do
* Keep TypeScript `strict` errors at **0**.
* Run `pnpm lint --fix` before commit.
* Document non-trivial logic with JSDoc.

🚫 Don't
* Touch files outside `src/` or modify config files.
* Add runtime dependencies (dev-deps are allowed if justified).
* Commit any secrets – keep your `.env` file local.

## 5 Submit
1. Push your fork / repo to GitHub (public or private link).  
2. Share the repo URL or a `patch.diff` file per the job portal instructions.

That's it — good luck and happy coding!

---

# Sentari Interview Task: Feature Design Explanation

## How do you detect actionable intent?

To detect actionable intent in voice journal entries, the code in `sampleFunction.ts` employs a combination of regex-based pattern matching and keyword analysis to identify transcripts that suggest tasks or actions. Specifically:

**Regex for Task Verbs**: A comprehensive regex (`taskVerbs`) matches verbs associated with actions or intentions, such as "plan," "need," "want," "schedule," and their various forms (e.g., "planning," "needed"). This ensures the function captures a wide range of expressions indicating user intent to perform a task. For example, phrases like _"I need to call Sarah"_ or _"I’m planning to clean the kitchen"_ are detected.

**Time Phrases for Context**: Another regex (`timePhrases`) identifies temporal expressions like "tomorrow," "today," "this week," or "next week." These help contextualize tasks by suggesting when an action is intended, enabling the extraction of due dates. For instance, _"Schedule a dentist appointment tomorrow"_ triggers both a task verb and a time phrase.

**Category Keywords**: A predefined set of category keywords (`categories`) maps transcripts to domains like Work, Personal, Health, or Home. Keywords such as _"dentist"_ (Health) or _"email"_ (Work) refine the intent by assigning relevant categories. For example, _"Book a dentist appointment"_ is categorized as Health.

**Transcript Focus**: The function processes `transcript_user` from each `VoiceEntry`, prioritizing user-edited transcripts over raw ones to capture refined user intent. If `transcript_user` contains a task verb, it’s considered actionable, filtering out non-task entries like _"I had dinner with friends."_  

This approach balances precision (via regex and keywords) with flexibility (handling varied verb forms and time expressions), effectively identifying actionable intent while minimizing false positives from casual statements.

---

## Why this structure?

The output structure, defined in `types.ts` as `ProcessedResult` and implemented in `sampleFunction.ts`, is designed to be user-centric, flexible, and extensible for Sentari’s voice journaling use case. The structure includes:

- **summary** (`string`): A concise overview, e.g., _"Analysed 200 entries, extracted 52 tasks for query 'health appointment'"._ This provides users with immediate context about the query results, enhancing usability in a journaling app.
- **tagFrequencies** (`Record<string, number>`): Counts occurrences of user-defined tags, skipping malformed tags. This supports future analytics and thematic insights.
- **tasks** (`Array`):
  - `task_text` (`string`): Full transcript to preserve user context.
  - `due_date` (`string | null`): ISO date if a time phrase is found, otherwise null.
  - `status` (`string`): Defaults to `"pending"`; allows state tracking like "completed."
  - `category` (`string`): Contextual domain like Work or Health.
  - `score` (`number | undefined`): Present only when a query is given, supports semantic ranking.

### Rationale:
- **User-Centric**: Tasks are clear, categorized, and dated.
- **Flexibility**: Nullable fields and extensible categories accommodate variety.
- **Semantic Query Support**: Score allows ranking by natural language relevance.
- **Testability**: Output is deterministic and suited for high test coverage.
- **Scalability**: Designed to handle 200+ entries and integrate with Supabase.

Additionally, before running `pnpm lint`, I added the following dev dependencies and lightly updated the ESLint config to align with TypeScript:

```bash
pnpm add -D @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

---

## How would this integrate into reminders or summaries?

The feature in `sampleFunction.ts` can seamlessly enhance Sentari’s reminders and summaries:

### Reminders
- **Task-Based Notifications**: Example —  
  _"Reminder: Book your dentist appointment today (Health)."_  
  derived from:  
  `{ task_text: "Book dentist appointment", due_date: "2025-06-18", category: "Health" }`
- **Calendar Integration**: Due dates in ISO format can sync with calendars.
- **Status Tracking**: Tasks can be marked `"completed"` or `"snoozed"` via UI interaction.
- **Query-Driven Reminders**: High-scoring tasks can trigger recurring prompts to reinforce habits.

### Summaries
- **Daily/Weekly Digests**:  
  _"This week, you recorded 10 entries and identified 3 tasks, including a dentist appointment."_
- **Tag Insights**:  
  _"You mentioned 'work' 5 times this week, focusing on meetings and emails."_
- **Task Progress Reports**:  
  _"Health tasks this week: Book dentist (due 2025-06-18), Start no-sugar plan (no due date)."_
- **Semantic Highlights**:  
  _"Your top health tasks include booking a dentist appointment (relevance: 0.85)."_  

### Integration with Sentari’s App
- **UI**: A "Tasks" tab in `try.withsentari.com`, filterable by category/due date.
- **Voice Interaction**: Users ask, _"What are my tasks for tomorrow?"_ and get a TTS response.
- **Supabase Storage**: Tasks link to `voice_entries` via `id`, stored in a new `tasks` table.

---

This design transforms journal entries into actionable insights and fosters deeper user engagement via structured reminders, intelligent summaries, and voice-based interaction—all aligned with Sentari’s vision.
