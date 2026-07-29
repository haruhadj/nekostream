/**
 * Fails the container at boot when configuration is missing, instead of letting
 * it come up "healthy" and throw on the first sign-in attempt.
 *
 * src/lib/env.ts remains the authoritative schema — this is a deploy-time guard
 * covering the misconfigurations that actually happen: unset or stub values.
 */
const REQUIRED = [
  { name: "BETTER_AUTH_URL" },
  { name: "BETTER_AUTH_SECRET", minLength: 32 },
  { name: "ANILIST_CLIENT_ID" },
  { name: "ANILIST_CLIENT_SECRET" },
  { name: "MAL_CLIENT_ID" },
  { name: "MAL_CLIENT_SECRET" },
  { name: "MAL_CODE_VERIFIER", minLength: 43, maxLength: 128 },
];

const problems = [];

for (const { name, minLength, maxLength } of REQUIRED) {
  const value = process.env[name];

  if (!value) {
    problems.push(`${name} is not set`);
    continue;
  }
  if (minLength && value.length < minLength) {
    problems.push(`${name} must be at least ${minLength} characters`);
  }
  if (maxLength && value.length > maxLength) {
    problems.push(`${name} must be at most ${maxLength} characters`);
  }
}

if (problems.length > 0) {
  console.error(
    [
      "",
      "[nekostream] Cannot start — configuration is incomplete:",
      ...problems.map((p) => `  - ${p}`),
      "",
      "  See .env.example. Generate secrets with:",
      "    BETTER_AUTH_SECRET  openssl rand -base64 32",
      "    MAL_CODE_VERIFIER   openssl rand -hex 32",
      "",
    ].join("\n")
  );
  process.exit(1);
}
