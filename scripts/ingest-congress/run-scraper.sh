#!/usr/bin/env bash
# Optional wrapper to run unitedstates/congress scrapers before ingest.
# Set CONGRESS_REPO_DIR to the clone root (contains ./run).

set -euo pipefail

CONGRESS_REPO_DIR="${CONGRESS_REPO_DIR:-../congress}"
CONGRESS="${INGEST_CONGRESS:-119}"

if [[ ! -x "${CONGRESS_REPO_DIR}/run" ]]; then
  echo "ERROR: ${CONGRESS_REPO_DIR}/run not found. Clone https://github.com/unitedstates/congress"
  exit 1
fi

cd "${CONGRESS_REPO_DIR}"

MODE="${1:-fast}"
case "${MODE}" in
  fast)
    ./run votes --fast
    ;;
  full)
    ./run votes --congress="${CONGRESS}"
    ./run bills --congress="${CONGRESS}"
    ;;
  votes)
    ./run votes --congress="${CONGRESS}"
    ;;
  bills)
    ./run bills --congress="${CONGRESS}"
    ;;
  *)
    echo "Usage: $0 [fast|full|votes|bills]"
    exit 1
    ;;
esac

echo "Scrape complete. Data at: ${CONGRESS_REPO_DIR}/data/"
echo "Next: cd scripts/ingest-congress && npm run ingest -- --congress=${CONGRESS}"
