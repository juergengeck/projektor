/**
 * Deployment configuration for the Amway workspace.
 *
 * Brand tokens ship with defaults (see `brand.js`). Everything else —
 * department/facility roster, role and contract issuers, revenue/tax/returns
 * policy versions — has no safe default and must be supplied by the operator.
 * Accessors fail fast on unconfigured values instead of inventing authority.
 */

function fail(message) {
  throw new Error(message);
}

export function createAmwayConfig({
  departments = [],
  facilities = [],
  issuers = {},
  policies = {},
} = {}) {
  return { departments, facilities, issuers, policies };
}

export function requireDepartments(config) {
  if (!config || !Array.isArray(config.departments) || config.departments.length === 0) {
    fail("Amway is not configured: initial department roster is missing.");
  }
  return config.departments;
}

export function requireIssuers(config) {
  if (!config || !config.issuers || Object.keys(config.issuers).length === 0) {
    fail("Amway is not configured: role/contract issuers are missing.");
  }
  return config.issuers;
}

/**
 * Returns the versioned policy descriptor for `name` (e.g.
 * "revenue-recognition", "tax", "returns"), or fails when the operator has
 * not supplied one. Never synthesize policy from defaults.
 */
export function requirePolicy(config, name) {
  const policy = config?.policies?.[name];
  if (!policy || typeof policy.version !== "string" || policy.version.length === 0) {
    fail(`Amway is not configured: '${name}' policy version is missing.`);
  }
  return policy;
}
