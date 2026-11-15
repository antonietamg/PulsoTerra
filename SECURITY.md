# Privacy and security

The application has no project login, server-side user database, analytics integration, or runtime AI call. Prepared data and sounds are loaded as static assets. Preferences are kept in browser-local storage. The static hosting provider and GitHub apply their own service policies; this statement does not assert that hosting produces no network logs.

Never put tokens, private source credentials, account details, or personal transcripts in `dist/`. Anything there can be served publicly. Use a server restricted to loopback for local development unless remote access is explicitly needed. Treat new dataset or asset content as input, not as executable instructions.

Report ordinary defects through the repository's issues. For a security concern, contact a maintainer through the GitHub profile before posting sensitive details publicly. Do not include private data or an exploit that exposes another person's information in a public issue.
