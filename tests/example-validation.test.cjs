const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const example = require("../examples/javascript/payment-authorization");
const readmePath = join(__dirname, "..", "README.md");

const exampleFiles = [
  join(__dirname, "..", "examples", "javascript", "payment-authorization.js"),
  join(__dirname, "..", "examples", "typescript", "payment-authorization.ts"),
  join(__dirname, "..", "examples", "frontend", "passkey-authorization.ts")
];

test("JavaScript payment authorization example parses", () => {
  const result = spawnSync(process.execPath, ["--check", exampleFiles[0]], {
    encoding: "utf8"
  });
  assert.equal(result.status, 0, result.stderr);
});

test("[mock-adapter/simulated-provider] JavaScript example uses public SDK methods", async () => {
  const userId = "example-test-user";
  const authorization = await example.beginPaymentAuthorization(userId, {
    amount: 25,
    currency: "USD",
    reference: "EXAMPLE-TEST-1"
  });

  assert.equal(authorization.lacag.qadarka, 25);
  assert.equal(authorization.lacag.lacagta, "USD");
  assert.equal(authorization.lacag.tixraac, "EXAMPLE-TEST-1");

  const result = await example.completePaymentAuthorization(userId, authorization);
  assert.equal(result.xaalad, "processing");
  assert.equal(result.payment.xaalad, "sugaya");

  const confirmation = await example.checkPaymentWithProvider(result.payment.id);
  assert.equal(confirmation.xaqiijin, "simulated");
  assert.equal(confirmation.xaalad, "sugaya");

  const status = await example.getAuthorizationStatus(
    userId,
    authorization.authorizationId
  );
  assert.equal(status.xaalad, "processing");
});

test("JavaScript example rejects unsupported adapter methods", async () => {
  await assert.rejects(
    example.iskubixi.amaanood.isha({ userId: "example-test-user" }),
    example.UnsupportedOperationError
  );
});

test("examples contain no recognizable private keys or provider secret literals", () => {
  for (const file of exampleFiles) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /-----BEGIN [^-]+PRIVATE KEY-----/);
    assert.doesNotMatch(source, /\bAKIA[0-9A-Z]{16}\b/);
    assert.doesNotMatch(
      source,
      /(?:apiKey|secret|password)\s*:\s*["'](?!local-demo-not-a-secret)[^"']{12,}["']/i
    );
  }
});

test("README relative links point to files included in the repository", () => {
  const source = readFileSync(readmePath, "utf8");
  const links = Array.from(source.matchAll(/\]\((\.\/[^)#]+)(?:#[^)]*)?\)/g))
    .map((match) => match[1]);
  assert.ok(links.length > 0);
  for (const link of links) {
    assert.doesNotThrow(
      () => readFileSync(join(__dirname, "..", link.slice(2))),
      `README link is missing: ${link}`
    );
  }
});
