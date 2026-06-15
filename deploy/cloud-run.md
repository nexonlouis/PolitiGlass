# Deploy PolitiGlass to Google Cloud Run

Host the Next.js app on [Cloud Run](https://cloud.google.com/run). Supabase stays on [supabase.com](https://supabase.com) — only the web app runs on GCP.

## Prerequisites

- Google Cloud project with billing enabled
- [gcloud CLI](https://cloud.google.com/sdk/docs/install) authenticated: `gcloud auth login`
- Docker (local build) or Cloud Build (remote build)
- Supabase project with migrations applied
- Domain **politiglass.com** (optional at first deploy)

```bash
export PROJECT_ID=your-gcp-project
export REGION=us-central1
export SERVICE=politiglass

gcloud config set project "$PROJECT_ID"
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com
```

## 1. Store secrets

Create secrets from your `.env.local` values (one secret per variable):

```bash
echo -n "https://xxxx.supabase.co" | gcloud secrets create NEXT_PUBLIC_SUPABASE_URL --data-file=-
echo -n "your-anon-key" | gcloud secrets create NEXT_PUBLIC_SUPABASE_ANON_KEY --data-file=-
echo -n "your-service-role-key" | gcloud secrets create SUPABASE_SERVICE_ROLE_KEY --data-file=-
echo -n "your-congress-key" | gcloud secrets create CONGRESS_GOV_API_KEY --data-file=-
```

Grant the Cloud Run service account access:

```bash
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

for s in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY CONGRESS_GOV_API_KEY; do
  gcloud secrets add-iam-policy-binding "$s" \
    --member="serviceAccount:${SA}" \
    --role="roles/secretmanager.secretAccessor"
done
```

## 2. Build and deploy

From the repo root:

```bash
gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --set-secrets="NEXT_PUBLIC_SUPABASE_URL=NEXT_PUBLIC_SUPABASE_URL:latest,NEXT_PUBLIC_SUPABASE_ANON_KEY=NEXT_PUBLIC_SUPABASE_ANON_KEY:latest,SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest,CONGRESS_GOV_API_KEY=CONGRESS_GOV_API_KEY:latest" \
  --set-env-vars="CONGRESS_NUMBER=119,POLITIGLASS_DEMO_MODE=false"
```

`--source .` uses Cloud Build with the root `Dockerfile` (Next.js `standalone` output).

Note: `NEXT_PUBLIC_*` vars are inlined at **build** time. For production you may prefer a `cloudbuild.yaml` that passes build args — see below.

### Build-time public env vars (recommended for Next.js)

`NEXT_PUBLIC_*` variables must be present during `npm run build`. Options:

1. **Cloud Build substitutions** — edit `deploy/cloudbuild.yaml` and run:

   ```bash
   gcloud builds submit --config deploy/cloudbuild.yaml \
     --substitutions=_REGION=$REGION,_SERVICE=$SERVICE
   ```

2. **Docker build args** — pass `--build-arg` when building locally and push to Artifact Registry.

## 3. Supabase Auth URLs

In Supabase → Authentication → URL configuration:

| Setting | Value |
|---------|--------|
| Site URL | `https://politiglass.com` (or your `*.run.app` URL while testing) |
| Redirect URLs | `https://politiglass.com/**`, `https://YOUR-SERVICE-xxx.run.app/**` |

## 4. Custom domain

```bash
gcloud run domain-mappings create \
  --service "$SERVICE" \
  --domain politiglass.com \
  --region "$REGION"
```

Follow the DNS records shown in the console (at your registrar).

## 5. Verify

```bash
gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)'
curl "$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')/api/health/data-sources"
```

## Local Docker smoke test

```bash
docker build -t politiglass .
docker run --rm -p 8080:8080 --env-file .env.local politiglass
# open http://localhost:8080
```

## Cost notes

Cloud Run bills for request time and memory while handling traffic; low-traffic demos often stay within free tier or startup credits. Supabase is billed separately.
