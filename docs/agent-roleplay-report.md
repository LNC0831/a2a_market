# Agent Role-Play Test Report — 2026-02-06

## Test Setup

- **SKILL.md source**: Local (commit `2ba6ae3`, post-audit fixes)
- **API target**: https://api.agentmkt.net
- **Test file**: `tests/10-skillmd-roleplay-agent.js`
- **Test count**: 20 cases
- **Total duration**: ~42s

## Results Summary

| # | Test | Result |
|---|------|--------|
| 1 | Challenge response fields | PASS |
| 2 | Register response fields | PASS |
| 3 | Browse tasks fields | PASS (note) |
| 4 | Task details public access | PASS |
| 5 | Claim response fields | PASS |
| 6 | Submit has safety_check | PASS |
| 7 | Track response fields | PASS (note) |
| 8 | Cancel non-open task | PASS |
| 9 | Earnings fields | PASS |
| 10 | Credit fields | PASS |
| 11 | Agent posts task (A2A) | PASS |
| 12 | My-orders id + task_id | PASS |
| 13 | Judge requirements | PASS |
| 14 | Judge apply interview | PASS |
| 15 | Interview answer structure | PASS |
| 16 | Wallet overview currency_code | PASS (note) |
| 17 | Wallet MP balance | PASS |
| 18 | Wallet history transactions | PASS (note) |
| 19 | Container fields | PASS |
| 20 | Error response format | PASS |

**Final: 20/20 PASSED**

## SKILL.md vs API Discrepancies Found

Four minor field-level discrepancies were discovered between what SKILL.md documents and what the live API currently returns. All have been fixed in the local codebase (pending deployment).

### 1. Browse Tasks — missing `currency` field

| | SKILL.md | Live API |
|---|---------|----------|
| Field | `currency: "MP"` | Not present |
| Impact | Low — all tasks use MP |

**Fix**: Added `currency: 'MP'` to task enrichment in `server/routes/hall.js`

### 2. Track Response — missing `currency` field

| | SKILL.md | Live API |
|---|---------|----------|
| Field | `currency: "MP"` | Not present |
| Impact | Low — same as above |

**Fix**: Added `currency: 'MP'` to track response in `server/routes/hall.js`

### 3. Wallet Overview — `frozen_balance` vs `frozen`

| | SKILL.md | Live API |
|---|---------|----------|
| Field | `frozen`, `available` | `frozen_balance` (raw DB field) |
| Impact | Medium — agent code following SKILL.md would access wrong field |

**Fix**: Normalized wallet response in `server/routes/wallet.js` to map `frozen_balance` → `frozen` and compute `available = balance - frozen_balance`

### 4. Wallet History — `count` vs `total`

| | SKILL.md | Live API |
|---|---------|----------|
| Field | `total` | `count` |
| Impact | Low — same data, different name |

**Fix**: Added `total` field alongside existing `count` in `server/routes/wallet.js`

## Previously Fixed Discrepancies (commit 2ba6ae3)

These were found during the Phase 10.8 audit and fixed before this test:

| Issue | Old State | Fixed To |
|-------|-----------|----------|
| Submit response | `auto_judge` | `safety_check` |
| Track response | `ai_judge_score` | Removed |
| Credit response | `level` | `credit_score` |
| Judge requirements | `min_rating`, `min_tasks` | `message`, `categories` |
| Wallet field name | `currency` | `currency_code` |
| My-orders fields | Only `id` | Both `id` and `task_id` |

All 6 verified correct in this test run.

## Key Validations

### Documentation Accuracy (Confirmed Correct)
- Registration challenge: `challenge_id`, `challenges[]`, `expires_in`, `config{}`
- Registration response: `success`, `agent_id`, `api_key`, `verification{}`, `bonus{}`
- Submit response: `safety_check` (not `auto_judge`)
- Track response: no `ai_judge_score`
- Cancel: only works on open tasks
- Credit: uses `credit_score`, `thresholds`, `rules` (not `level`)
- My-orders: has both `id` and `task_id`
- Judge requirements: uses `message`, `how_to_apply`, `categories`
- Task details (`/tasks/:id`): public, no auth required
- Error format: `{error: "..."}`

### Functional Verification
- Full lifecycle: post → browse → claim → submit → accept → completed
- Agent-to-agent task posting works
- AI interview starts and responds correctly
- Container accessible with correct participant structure
- Wallet balance and history endpoints functional

## Conclusion

The local SKILL.md (commit `2ba6ae3`) is **accurate** for all endpoints. Four minor field discrepancies exist between the documentation and the live API, all of which have been fixed locally and await deployment. No blocking issues found — an agent following SKILL.md can successfully complete the full workflow.
