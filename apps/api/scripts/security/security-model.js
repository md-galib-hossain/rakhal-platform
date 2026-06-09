const crypto = require("crypto");

const SECURITY_MODULE_VERSION = "2.0.0";

const SEVERITY_DEFINITIONS = {
  CRITICAL: {
    label: "CRITICAL",
    meaning: "Confirmed dangerous issue, such as an exposed production secret, malware signature, dangerous shell command, or credential-stealing pattern.",
    recommendedAction: "Stop release or deployment until this is fixed, rotated, or formally contained.",
    priority: 1,
  },
  HIGH: {
    label: "HIGH",
    meaning: "Serious security risk that needs urgent fixing, such as hardcoded tokens, unsafe eval, or insecure auth logic.",
    recommendedAction: "Fix before deployment unless a security owner explicitly accepts the risk.",
    priority: 2,
  },
  MEDIUM: {
    label: "MEDIUM",
    meaning: "Risky pattern that should be reviewed, such as weak validation, missing rate limiting, or suspicious dependency usage.",
    recommendedAction: "Review soon and schedule a fix or document why it is acceptable.",
    priority: 3,
  },
  LOW: {
    label: "LOW",
    meaning: "Minor security concern or best-practice warning.",
    recommendedAction: "Fix during normal hardening work.",
    priority: 4,
  },
  INFO: {
    label: "INFO",
    meaning: "Informational finding that is not directly dangerous.",
    recommendedAction: "Use as context; no urgent fix is required.",
    priority: 5,
  },
};

const STATUS_DEFINITIONS = {
  OPEN: {
    label: "OPEN",
    explanation: "Issue found and not fixed yet.",
  },
  NEEDS_REVIEW: {
    label: "NEEDS_REVIEW",
    explanation: "Issue may be valid but needs human confirmation.",
  },
  FALSE_POSITIVE: {
    label: "FALSE_POSITIVE",
    explanation: "Reviewed and confirmed safe.",
  },
  FIXED: {
    label: "FIXED",
    explanation: "Issue has been fixed and was not found in the latest scan.",
  },
  IGNORED: {
    label: "IGNORED",
    explanation: "Accepted risk or intentionally skipped.",
  },
  REGRESSION: {
    label: "REGRESSION",
    explanation: "Previously fixed issue appeared again.",
  },
};

const CONFIDENCE_DEFINITIONS = {
  CONFIRMED: {
    label: "CONFIRMED",
    explanation: "Very likely real issue.",
  },
  LIKELY: {
    label: "LIKELY",
    explanation: "Strong suspicious signal.",
  },
  POSSIBLE: {
    label: "POSSIBLE",
    explanation: "Needs manual verification.",
  },
};

const CATEGORIES = [
  "SECRETS",
  "MALWARE_PATTERN",
  "DANGEROUS_CODE",
  "DEPENDENCY_RISK",
  "AUTH_SECURITY",
  "INPUT_VALIDATION",
  "CONFIG_SECURITY",
  "FILE_UPLOAD_SECURITY",
  "LOGGING_SECURITY",
  "PERMISSION_RISK",
  "UNKNOWN",
];

function normalizeSeverity(value) {
  return SEVERITY_DEFINITIONS[value] ? value : "MEDIUM";
}

function normalizeStatus(value) {
  if (STATUS_DEFINITIONS[value]) return value;
  if (value === "RESOLVED") return "FIXED";
  if (value === "ALLOWLISTED") return "IGNORED";
  return "OPEN";
}

function normalizeConfidence(value) {
  return CONFIDENCE_DEFINITIONS[value] ? value : "POSSIBLE";
}

function normalizeCategory(value) {
  return CATEGORIES.includes(value) ? value : "UNKNOWN";
}

function severityPriority(severity) {
  return SEVERITY_DEFINITIONS[normalizeSeverity(severity)].priority;
}

function shortHash(value) {
  return crypto.createHash("sha1").update(String(value)).digest("hex").slice(0, 6).toUpperCase();
}

function buildFindingId(finding) {
  const category = normalizeCategory(finding.category);
  const severity = normalizeSeverity(finding.severity);
  const stableParts = [
    category,
    finding.file || "",
    finding.line || "",
    finding.ruleId || finding.pattern || "",
    finding.title || finding.type || "",
  ];

  return `SEC-${category}-${severity}-${shortHash(stableParts.join("|"))}`;
}

module.exports = {
  SECURITY_MODULE_VERSION,
  SEVERITY_DEFINITIONS,
  STATUS_DEFINITIONS,
  CONFIDENCE_DEFINITIONS,
  CATEGORIES,
  normalizeSeverity,
  normalizeStatus,
  normalizeConfidence,
  normalizeCategory,
  severityPriority,
  buildFindingId,
};
