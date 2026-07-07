# 05 — GitHub account hardening (security follow-up)

Status: ready-for-human

Follow-up to this session's security incident: someone probed the maintainer's GitHub account shortly after this public repo was created. The full-history scan found no keys/tokens/credentials ever committed; the only exposure was a personal gmail in commit metadata, now scrubbed (root commit rewritten to `ec8bfc8`, force-pushed). Keeping the repo public is the accepted decision (ADR 0001), so the account is hardened instead of the repo made private.

Requires human action in the GitHub UI; cannot be done by an agent.

## Actions

- Enable 2FA.
- Rotate the account password.
- Review active sessions, personal access tokens, and authorized OAuth apps; revoke anything unrecognized.
- Enable "Keep my email address private".
- Enable "Block command line pushes that expose my email".

## Residual risk

- GitHub may still serve the orphaned pre-scrub commit `d9b3533` by direct SHA/API until its GC runs, and any pre-existing fork retains it. To purge sooner, open a GitHub Support request. Treat the old gmail as already harvested; do not reintroduce it anywhere (commits, docs, issues).
