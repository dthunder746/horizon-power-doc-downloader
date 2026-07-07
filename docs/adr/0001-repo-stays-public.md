# Repository stays public

The tool is delivered as a standalone `.cmd` that end users fetch and run without installing anything, and which itself pulls `manifest.json` and `version.txt` from GitHub at run time. A public repo makes this token-free: plain `raw.githubusercontent.com` links work everywhere.

We considered a private repo with a token embedded in the `.cmd`. Rejected: the `.cmd` is copied onto personal machines and carried around, so an embedded token is a shared secret handed to everyone who touches the file. For content that is already-public Horizon Power material with zero secrets, that buys no real confidentiality while adding fragility (fine-grained tokens expire within ~1 year and would silently break the tool for every user at once; classic never-expiring tokens grant account-wide access; GitHub secret scanning may auto-revoke; the API download path is more complex than raw).

The security incident that prompted this (a probe of the maintainer's GitHub account) was caused by a personal email in commit metadata, now scrubbed. It is addressed by account hardening (2FA, "keep my email private", block pushes that expose the email), not by repo privacy.
