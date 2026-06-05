# Tag bills (`issue_slugs`)

Maps ingested bills to CivicMirror issue slugs for reflection scoring.

## Setup

```bash
cd scripts/tag-bills
cp config.example.env .env
npm install
ollama pull gemma4
```

## Compare methods (dry-run)

`--dry-run` prints **full tag decisions** by default: input text, matching rules, and chosen slugs.

```bash
# Fast subject-map — shows which subject/keyword matched each slug
npm run tag:dry
npx tsx tag-bills.ts --dry-run --limit=15

# Ollama — shows prompt text + model JSON response
npm run tag:ollama:dry
npx tsx ollama-tag.ts --dry-run --limit=5

# Side-by-side sample of both on the same bill count
npm run tag:compare
```

Use `--quiet` for the old one-line summary only.

### Example (subject-map dry-run)

```
────────────────────────────────────────────────────────────────────────
bill_id: hr2913-119
method: subject-map (congressional subjects + title/vote keywords)
issue_slugs: economy-jobs

Input text:
  roll_call_context: On Passage: H R 2913 Ukraine Support Act...

Tag decisions:
  ✓ economy-jobs
      via title: keyword "ukraine / defense / military / war powers"
      from: "Ukraine"
```

### Example (Ollama dry-run)

```
────────────────────────────────────────────────────────────────────────
bill_id: hconres84-119
method: ollama (gemma4)
issue_slugs: economy-jobs

Input text (sent to model):
  bill_id: hconres84-119
  roll_call_context: On Agreeing to the Resolution: H CON RES 84 ...

Model response:
  {"issue_slugs":["economy-jobs"]}
```

## Write tags

```bash
# Option A: hybrid (fast first, LLM for remainder)
npm run tag
npm run tag:ollama

# Option B: Ollama only for all vote-linked bills (overnight)
npx tsx ollama-tag.ts --force --delay-ms=250
```

| Flag | Scripts | Purpose |
|------|---------|---------|
| `--dry-run` | both | Preview; shows full explain output |
| `--quiet` | both | One-line summary in dry-run |
| `--limit=N` | both | Cap bills processed |
| `--all` | both | All bills, not just vote-linked |
| `--force` | both | Re-tag even if `issue_slugs` already set |
| `--force` | ollama | Full overnight LLM pass over vote-linked bills |

## Env

| Var | Default |
|-----|---------|
| `OLLAMA_MODEL` | `gemma4` |
| `OLLAMA_BASE_URL` | `http://localhost:11434` |
| `OLLAMA_TIMEOUT_MS` | `120000` |
