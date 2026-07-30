#!/usr/bin/env bash
# Legt die Labels für den Research-Triage-Prozess im Portfoliomanager-Repo an.
# Idempotent: bereits existierende Labels werden übersprungen.
#
# Nutzung:
#   export GITHUB_TOKEN=<PAT mit repo/issues-Recht>
#   bash create-research-labels.sh
set -euo pipefail

REPO="${REPO:-Marc-Weibel-Consulting-GmbH/Portfoliomanager}"
: "${GITHUB_TOKEN:?Bitte GITHUB_TOKEN (PAT mit repo/issues) setzen}"
API="https://api.github.com/repos/${REPO}/labels"

create_label() {
  local name="$1" color="$2" desc="$3"
  local code
  code=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$API" \
    -H "Authorization: Bearer ${GITHUB_TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    -d "$(python3 -c 'import json,sys; print(json.dumps({"name":sys.argv[1],"color":sys.argv[2],"description":sys.argv[3]}))' "$name" "$color" "$desc")")
  case "$code" in
    201) echo "created:   $name" ;;
    422) echo "exists:    $name" ;;
    *)   echo "FAILED($code): $name" ;;
  esac
}

# Prozess-Zustände
create_label "research"           "6f42c1" "Research Observatory Item (von Workflow 05)"
create_label "research:new"       "c5def5" "Frisch, noch nicht triagiert"
create_label "research:triage"    "fbca04" "Zur Sichtung"
create_label "research:spike"     "0e8a16" "Backtest-Prototyp in Arbeit"
create_label "research:review"    "d93f0b" "Backtest fertig, wartet auf Mensch"
create_label "research:accepted"  "0e8a16" "Validiert, Integration (feature-flagged)"
create_label "research:rejected"  "b60205" "Verworfen (mit Begruendung)"
create_label "experimental"       "ededed" "Experimenteller, feature-flagged Code"

# Implementierbarkeit
create_label "impl:plug_in"       "bfdadc" "Direkt A/B-testbar"
create_label "impl:needs_backtest" "fef2c0" "Erst Out-of-Sample-Backtest noetig"
create_label "impl:conceptual"    "e4e669" "Idee/Richtung, noch keine Methode"

# Betroffene Module (algo_relevance)
create_label "algo:signals"          "1d76db" "Signal-Engines"
create_label "algo:momentum_quality" "1d76db" "qualityMomentumEngine"
create_label "algo:optimizer"        "1d76db" "HRP/exakt/Auto-Portfolio"
create_label "algo:scoring"          "1d76db" "Scoring"
create_label "algo:regime"           "1d76db" "regimeEngine"
create_label "algo:risk"             "1d76db" "Risk-Overlay"
create_label "algo:ml_feature"       "1d76db" "signalFeatures/ONNX"

echo "Fertig."
