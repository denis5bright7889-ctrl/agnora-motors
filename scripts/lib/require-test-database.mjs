// A fail-closed gate for scripts that WRITE to a database.
//
// The problem this solves: a verification script that reads .env.local is
// pointed at production every time it runs, and the only thing standing
// between it and real data is the operator remembering that. That is not a
// control. This module makes the script prove its target is a test database
// before it is handed a connection string.
//
// The gate is positive, not negative: a target must be recognisably a test
// database to be allowed. An unfamiliar host is refused rather than assumed
// safe, so a new production endpoint is denied by default instead of silently
// qualifying. Production is never named here — naming it would make the
// control depend on a list that goes stale, and would put infrastructure
// detail in the repository.

/** Hosts that are a developer's own machine. */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "0.0.0.0"]);

/**
 * A label in the host or database name that marks a non-production target.
 * Must appear as its own token so "latest" does not match "test" and
 * "greatest-db" does not either.
 */
const TEST_MARKER = /(^|[-_.])(test|tests|testing|staging|stage|sandbox|scratch|dev|ci|preview)([-_.]|$)/i;

/** Set this to run a writing script. Deliberately not a default. */
const OPT_IN = "AGNORA_ALLOW_TEST_WRITES";

function describe(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  return {
    host: u.hostname,
    // Strip the leading slash; ignore any ?options suffix.
    database: decodeURIComponent(u.pathname.replace(/^\//, "")) || "(none)",
    port: u.port || "(default)",
  };
}

function classify(target) {
  if (LOCAL_HOSTS.has(target.host)) return { safe: true, why: "host is this machine" };
  if (TEST_MARKER.test(target.host)) return { safe: true, why: "host is labelled as a test environment" };
  if (TEST_MARKER.test(target.database)) return { safe: true, why: "database name is labelled as a test database" };
  return { safe: false, why: "the target is not recognisable as a test database" };
}

function fail(lines) {
  console.error("\n  REFUSED — this script writes to the database.\n");
  for (const l of lines) console.error("  " + l);
  console.error("");
  process.exit(1);
}

/**
 * Returns a connection string only when the target is provably a test
 * database and the operator has opted in. Otherwise prints why and exits 1.
 *
 * Reads TEST_DATABASE_URL in preference to DATABASE_URL, so that a shell
 * already carrying production credentials cannot satisfy it by accident.
 */
export function requireTestDatabase({ scriptName = "this script" } = {}) {
  const source = process.env.TEST_DATABASE_URL
    ? "TEST_DATABASE_URL"
    : process.env.DATABASE_URL
      ? "DATABASE_URL"
      : null;

  if (!source) {
    fail([
      `${scriptName} needs a test database.`,
      "",
      "Neither TEST_DATABASE_URL nor DATABASE_URL is set.",
      "Set TEST_DATABASE_URL to a scratch database and try again:",
      "",
      "  TEST_DATABASE_URL=postgres://user:pass@localhost:5432/agnora_test \\",
      `  ${OPT_IN}=1 node ${scriptName}`,
      "",
      "Note: .env.local is NOT read. That file points at the live database,",
      "and reading it is what made this script dangerous in the first place.",
    ]);
  }

  const raw = process.env[source];
  const target = describe(raw);
  if (!target) {
    fail([`${source} is not a valid connection URL, so its target cannot be checked.`]);
  }

  const verdict = classify(target);

  // Never print the connection string: it carries the password.
  const shown = [
    `source:   ${source}`,
    `host:     ${target.host}`,
    `port:     ${target.port}`,
    `database: ${target.database}`,
  ];

  if (!verdict.safe) {
    fail([
      ...shown,
      "",
      `Verdict: ${verdict.why}.`,
      "",
      "A target is allowed only when it is localhost, or when its host or",
      "database name carries a test label (test, staging, sandbox, scratch,",
      "dev, ci, preview). Anything else is treated as production.",
      "",
      "If this really is a scratch database, give it a name that says so.",
      "Do not widen this check to let the current target through.",
    ]);
  }

  if (process.env[OPT_IN] !== "1") {
    fail([
      ...shown,
      "",
      `Verdict: ${verdict.why}, which is allowed.`,
      "",
      `But ${OPT_IN} is not set to 1. Two independent conditions are`,
      "required, so that a correctly-named test database still cannot be",
      "written to by a script run unintentionally.",
      "",
      `  ${OPT_IN}=1 node ${scriptName}`,
    ]);
  }

  console.log(`[guard] ${target.database} on ${target.host} — ${verdict.why}; ${OPT_IN}=1. Proceeding.`);
  return raw;
}
