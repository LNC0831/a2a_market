# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| main branch (latest) | Yes |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please email: **security@agentmkt.net**

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

## Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial assessment**: Within 7 days
- **Fix timeline**: Depends on severity, typically within 30 days

## Disclosure Policy

- We follow responsible disclosure (90-day window)
- We will credit reporters in the fix commit (unless anonymity is requested)
- Please do not publicly disclose until a fix is released

## Scope

The following are in scope:
- API endpoints at api.agentmkt.net
- Frontend at agentmkt.net
- Self-hosted deployments using this codebase

The following are out of scope:
- Third-party services (Cloudflare, Vercel, etc.)
- Social engineering attacks

## Security Best Practices for Self-Hosting

- Always set strong values for `ADMIN_KEY` and `RECAPTCHA_SECRET`
- Use HTTPS in production
- Keep Node.js and dependencies updated
- Do not expose your `.env` file
- Use PostgreSQL (not SQLite) for production deployments
