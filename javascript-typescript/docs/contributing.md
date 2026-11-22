# Contributing

Keep changes focused and preserve public API compatibility.

## Before changes

```sh
npm ci
npm test
```

Add or update tests for behavior changes. Do not delete security, duplicate,
idempotency, validation, or error-handling coverage.

## Provider changes

Use only official provider documentation and authorized merchant credentials.
Never invent endpoints or response fields. Keep provider-specific credentials
server-side and redacted.

## Pull requests

Include:

- summary of behavior and security impact;
- affected files;
- unit/mock test coverage;
- official sandbox/live test evidence if available;
- documentation updates;
- package validation results.
