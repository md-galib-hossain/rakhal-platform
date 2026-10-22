# Security notes
- Never commit credentials. `.gitignore` blocks `.env*` (except examples), `*.pem`, `*adminsdk*.json`, `conf/`.
- Admin auth, sessions and RBAC are enforced by rakhal-backend; UI gating is UX only.
