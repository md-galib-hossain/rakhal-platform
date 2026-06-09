const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { scan: runSuspiciousCodeScan } = require("./suspicious-code-scan");
const {
  SECURITY_MODULE_VERSION,
  SEVERITY_DEFINITIONS,
  STATUS_DEFINITIONS,
  CONFIDENCE_DEFINITIONS,
  normalizeSeverity,
  normalizeStatus,
  normalizeConfidence,
  normalizeCategory,
  severityPriority,
  buildFindingId,
} = require("./security-model");

const ROOT = process.cwd();
const SECURITY_DIR = path.join(ROOT, "scripts", "security");
const REPORTS_DIR = path.join(SECURITY_DIR, "reports");
const TRACKER_PATH = path.join(REPORTS_DIR, "findings-tracker.json");
const STRICT = String(process.env.SECURITY_STRICT || "").toLowerCase() === "true";
const DOCKER_IMAGES = {
  gitleaks: process.env.SECURITY_GITLEAKS_IMAGE || "zricethezav/gitleaks:latest",
  semgrep: process.env.SECURITY_SEMGREP_IMAGE || "semgrep/semgrep:latest",
  clamav: process.env.SECURITY_CLAMAV_IMAGE || "clamav/clamav:latest",
};
const SEVERITIES = Object.keys(SEVERITY_DEFINITIONS);
const STATUSES = Object.keys(STATUS_DEFINITIONS);

function getProjectName() {
  if (process.env.SECURITY_PROJECT_NAME) {
    return process.env.SECURITY_PROJECT_NAME;
  }

  const packagePath = path.join(process.cwd(), "package.json");
  if (fs.existsSync(packagePath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(packagePath, "utf8"));
      if (parsed.name) return parsed.name;
    } catch {
      // Fall back to folder name when package metadata is unavailable.
    }
  }

  return path.basename(process.cwd());
}

const PROJECT_NAME = getProjectName();

function nowIso() {
  return new Date().toISOString();
}

function timestampForFile(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

function ensureReportsDir() {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

function commandExists(command) {
  const checker = process.platform === "win32" ? "where" : "command";
  const args = process.platform === "win32" ? [command] : ["-v", command];
  const result = spawnSync(checker, args, { cwd: ROOT, encoding: "utf8", shell: process.platform !== "win32" });
  return result.status === 0;
}

function runCommand(command, args, options = {}) {
  const executable = process.platform === "win32" && command === "npm" ? "cmd.exe" : command;
  const commandArgs = process.platform === "win32" && command === "npm" ? ["/d", "/s", "/c", "npm", ...args] : args;
  const result = spawnSync(executable, commandArgs, {
    cwd: ROOT,
    encoding: "utf8",
    shell: false,
    maxBuffer: 1024 * 1024 * 20,
    ...options,
  });

  return {
    status: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    error: result.error ? result.error.message : null,
  };
}

function getGitValue(args, fallback) {
  const result = runCommand("git", args);
  if (result.status !== 0) {
    return fallback;
  }
  return result.stdout.trim() || fallback;
}

function getMetadata() {
  return {
    projectName: PROJECT_NAME,
    date: nowIso(),
    scanTime: nowIso(),
    branch: getGitValue(["rev-parse", "--abbrev-ref", "HEAD"], "unknown"),
    commitHash: getGitValue(["rev-parse", "--short", "HEAD"], "unknown"),
    mode: "Manual Deployment Security Gate",
    strict: STRICT,
  };
}

function normalizePath(value) {
  return String(value || "").replace(/\\/g, "/");
}

function makeFingerprint(finding) {
  return [
    categoryForFinding(finding),
    normalizePath(finding.file || ""),
    finding.line || "",
    finding.ruleId || finding.pattern || "",
    finding.title || finding.type || "",
  ].join("|");
}

function makeLegacyFingerprint(finding) {
  return [
    finding.source || "",
    finding.type || "",
    normalizePath(finding.file || ""),
    finding.line || "",
    finding.pattern || "",
  ].join("|");
}

function categoryForFinding(finding) {
  if (finding.category) return normalizeCategory(finding.category);
  if (["SECRET_SCAN_FAILED", "SECRET_SCAN_INCOMPLETE", "MISSING_SECURITY_TOOL"].includes(finding.type)) return "CONFIG_SECURITY";
  if (finding.source === "Malware Scan" || finding.type === "ANTIVIRUS_FINDING") return "MALWARE_PATTERN";
  if (finding.source === "Secret Scan" || finding.type === "LEAKED_SECRET") return "SECRETS";
  if (finding.source === "Dependency Audit" || String(finding.type || "").includes("DEPENDENCY")) return "DEPENDENCY_RISK";
  if (finding.source === "Build Verification" || finding.type === "BUILD_FAILURE") return "CONFIG_SECURITY";
  if (String(finding.type || "").startsWith("CONFIG_")) return "CONFIG_SECURITY";
  if (String(finding.type || "").includes("AUTH")) return "AUTH_SECURITY";
  if (String(finding.type || "").includes("VALIDATION")) return "INPUT_VALIDATION";
  if (String(finding.type || "").includes("UPLOAD")) return "FILE_UPLOAD_SECURITY";
  if (String(finding.type || "").includes("LOG")) return "LOGGING_SECURITY";
  if (String(finding.type || "").includes("PERMISSION")) return "PERMISSION_RISK";
  if (finding.source === "Suspicious Code Scan" || finding.source === "Semgrep Scan") return "DANGEROUS_CODE";
  return "UNKNOWN";
}

function confidenceForFinding(finding) {
  if (finding.confidence) return normalizeConfidence(finding.confidence);
  if (finding.source === "Malware Scan" || finding.source === "Secret Scan") return "CONFIRMED";
  if (["CRITICAL", "HIGH"].includes(finding.severity)) return "LIKELY";
  return "POSSIBLE";
}

function titleForFinding(finding) {
  if (finding.title) return finding.title;
  return String(finding.type || finding.pattern || finding.source || "Security finding")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function ruleIdForFinding(finding) {
  return finding.ruleId || finding.pattern || finding.type || finding.source || "manual-security-rule";
}

function ownerActionForFinding(finding) {
  if (finding.suggestedOwnerAction) return finding.suggestedOwnerAction;
  if (finding.category === "SECRETS") return "Backend owner and CTO/security reviewer: rotate exposed credentials and remove them from source.";
  if (finding.category === "DEPENDENCY_RISK") return "Backend owner: review audit details and upgrade or replace vulnerable dependencies.";
  if (finding.category === "MALWARE_PATTERN") return "Security reviewer: quarantine and investigate the affected file before deployment.";
  return "Code owner: review, fix, or document the accepted risk with a reviewer.";
}

function detectionSourceForFinding(finding) {
  const source = finding.source || finding.scanner || "Unknown Scanner";
  const map = {
    "Suspicious Code Scan": { detectedBy: "Built-in Suspicious Code Scan", scannerType: "built-in" },
    "Secret Scan": { detectedBy: "gitleaks", scannerType: "docker-gitleaks" },
    "Semgrep Scan": { detectedBy: "Semgrep", scannerType: "docker-semgrep" },
    "Malware Scan": { detectedBy: "ClamAV", scannerType: "docker-clamav" },
    "Dependency Audit": { detectedBy: "npm audit", scannerType: "npm-audit" },
    "Build Verification": { detectedBy: "npm build", scannerType: "build-check" },
  };

  return map[source] || { detectedBy: source, scannerType: "unknown" };
}

function languageForFile(file) {
  const extension = path.extname(file || "").toLowerCase();
  if ([".js", ".mjs", ".cjs", ".jsx"].includes(extension)) return "js";
  if ([".ts", ".tsx"].includes(extension)) return "ts";
  if (extension === ".json") return "json";
  return "text";
}

function detectFunctionScope(file, line) {
  if (!file || !line || line < 1) {
    return { functionName: null, scope: "N/A" };
  }

  const absolutePath = path.join(ROOT, file);
  if (!fs.existsSync(absolutePath)) {
    return { functionName: null, scope: "unknown" };
  }

  const configNames = new Set([
    "postcss.config.js",
    "tailwind.config.js",
    "next.config.js",
    "vite.config.js",
    "webpack.config.js",
    "eslint.config.js",
    "babel.config.js",
    "tsconfig.json",
  ]);
  if (configNames.has(path.basename(file))) {
    return { functionName: null, scope: "module scope" };
  }

  const lines = fs.readFileSync(absolutePath, "utf8").split(/\r?\n/);
  const before = lines.slice(0, line).join("\n");
  const classMatches = [...before.matchAll(/\bclass\s+([A-Za-z_$][\w$]*)/g)];
  const className = classMatches.length ? classMatches[classMatches.length - 1][1] : null;

  const patterns = [
    /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g,
    /\b(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?[^=;]*=>/g,
    /^\s*([A-Za-z_$][\w$]*)\s*\([^;{}]*\)\s*\{/gm,
  ];

  let best = null;
  const methodKeywordBlocklist = new Set(["if", "for", "while", "switch", "catch", "with"]);
  for (const regex of patterns) {
    for (const match of before.matchAll(regex)) {
      if (methodKeywordBlocklist.has(match[1])) {
        continue;
      }
      if (!best || match.index > best.index) {
        best = { name: match[1], index: match.index };
      }
    }
  }

  if (!best) {
    return { functionName: null, scope: "module scope" };
  }

  const functionName = className && best.index > before.lastIndexOf(`class ${className}`)
    ? `${className}.${best.name}`
    : best.name;

  return { functionName, scope: functionName };
}

function enrichFinding(finding) {
  const scopeInfo = detectFunctionScope(finding.file, finding.line);
  const severity = normalizeSeverity(finding.severity);
  const category = categoryForFinding(finding);
  const status = normalizeStatus(finding.status);
  const confidence = confidenceForFinding({ ...finding, severity });
  const title = titleForFinding(finding);
  const ruleId = ruleIdForFinding(finding);
  const detectionSource = detectionSourceForFinding(finding);
  return {
    id: finding.id || buildFindingId({ ...finding, severity, category, title, ruleId }),
    fingerprint: finding.fingerprint,
    source: finding.source,
    detectedBy: finding.detectedBy || detectionSource.detectedBy,
    scannerType: finding.scannerType || detectionSource.scannerType,
    title,
    status,
    statusExplanation: STATUS_DEFINITIONS[status].explanation,
    severity,
    severityMeaning: SEVERITY_DEFINITIONS[severity].meaning,
    severityRecommendedAction: SEVERITY_DEFINITIONS[severity].recommendedAction,
    confidence,
    confidenceExplanation: CONFIDENCE_DEFINITIONS[confidence].explanation,
    type: finding.type,
    category,
    file: normalizePath(finding.file || ""),
    line: finding.line || 0,
    column: finding.column || 0,
    functionName: finding.functionName || scopeInfo.functionName,
    scope: finding.scope || scopeInfo.scope,
    ruleId,
    pattern: finding.pattern || "",
    reason: finding.reason || "",
    snippet: finding.snippet || "",
    recommendation: finding.recommendation || "",
    suggestedOwnerAction: ownerActionForFinding({ ...finding, category }),
    scanner: finding.scanner || finding.source || "",
    engine: finding.engine || (finding.source === "Malware Scan" ? "ClamAV" : ""),
    signature: finding.signature || "",
    allowlisted: finding.allowlisted === true,
    firstSeen: finding.firstSeen || finding.firstDetectedAt,
    lastSeen: finding.lastSeen || finding.lastDetectedAt,
    firstDetectedAt: finding.firstSeen || finding.firstDetectedAt,
    lastDetectedAt: finding.lastSeen || finding.lastDetectedAt,
    occurrenceCount: finding.occurrenceCount || 1,
    resolvedAt: finding.resolvedAt || null,
    branch: finding.branch,
    commitHash: finding.commitHash,
  };
}

function dockerVolume(targetPath) {
  return `${ROOT}:${targetPath}`;
}

function getDockerRunner(toolName, dockerImage, dockerArgs) {
  if (!commandExists("docker")) {
    return {
      available: false,
      mode: "docker_unavailable",
      command: "docker",
      args: [],
      message: `${toolName} is configured for Docker-only execution, but Docker is not available`,
    };
  }

  return {
    available: true,
    mode: "docker",
    command: "docker",
    args: ["run", "--rm", "-v", dockerVolume(dockerArgs.containerPath), dockerImage, ...dockerArgs.container],
    message: `using Docker image ${dockerImage}`,
  };
}

function loadTracker() {
  if (!fs.existsSync(TRACKER_PATH)) {
    return { findings: [] };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(TRACKER_PATH, "utf8"));
    return { findings: Array.isArray(parsed.findings) ? parsed.findings : [] };
  } catch {
    return { findings: [] };
  }
}

function updateTracker(rawFindings, metadata) {
  const tracker = loadTracker();
  const byFingerprint = new Map(tracker.findings.map((finding) => [finding.fingerprint, finding]));
  const byLegacyFingerprint = new Map(tracker.findings.map((finding) => [makeLegacyFingerprint(finding), finding]));
  const seen = new Set();

  const findingsByFingerprint = new Map();
  for (const finding of rawFindings) {
    const fingerprint = makeFingerprint(finding);
    if (!findingsByFingerprint.has(fingerprint)) {
      findingsByFingerprint.set(fingerprint, finding);
    }
  }

  const findings = Array.from(findingsByFingerprint.values()).map((finding) => {
    const fingerprint = makeFingerprint(finding);
    seen.add(fingerprint);
    const existing = byFingerprint.get(fingerprint) || byLegacyFingerprint.get(makeLegacyFingerprint(finding));
    const severity = normalizeSeverity(finding.severity);
    const category = categoryForFinding(finding);
    const confidence = confidenceForFinding({ ...finding, severity });
    const title = titleForFinding(finding);
    const ruleId = ruleIdForFinding(finding);
    const id = buildFindingId({ ...finding, severity, category, title, ruleId });
    const nextStatus = finding.allowlisted ? "IGNORED" : "OPEN";
    const detectionSource = detectionSourceForFinding(finding);

    if (existing) {
      const previousStatus = normalizeStatus(existing.status);
      const status = previousStatus === "FIXED" ? "REGRESSION" : (["FALSE_POSITIVE", "IGNORED"].includes(previousStatus) ? previousStatus : nextStatus);
      Object.assign(existing, {
        id,
        fingerprint,
        source: finding.source,
        detectedBy: finding.detectedBy || detectionSource.detectedBy,
        scannerType: finding.scannerType || detectionSource.scannerType,
        title,
        status,
        severity,
        confidence,
        type: finding.type,
        category,
        file: finding.file,
        line: finding.line,
        column: finding.column || 0,
        functionName: finding.functionName || null,
        scope: finding.scope || null,
        ruleId,
        pattern: finding.pattern,
        reason: finding.reason,
        snippet: finding.snippet || "",
        recommendation: finding.recommendation,
        suggestedOwnerAction: finding.suggestedOwnerAction || null,
        scanner: finding.scanner || finding.source,
        engine: finding.engine || "",
        signature: finding.signature || "",
        occurrenceCount: (existing.occurrenceCount || 1) + 1,
        lastDetectedAt: metadata.date,
        lastSeen: metadata.date,
        resolvedAt: null,
        branch: metadata.branch,
        commitHash: metadata.commitHash,
      });

      return enrichFinding({
        ...finding,
        id,
        title,
        status,
        severity,
        confidence,
        category,
        ruleId,
        fingerprint,
        firstDetectedAt: existing.firstSeen || existing.firstDetectedAt,
        lastDetectedAt: existing.lastSeen || existing.lastDetectedAt,
        occurrenceCount: existing.occurrenceCount,
        resolvedAt: existing.resolvedAt,
        branch: existing.branch,
        commitHash: existing.commitHash,
      });
    }

    const created = {
      id,
      fingerprint,
      source: finding.source,
      detectedBy: finding.detectedBy || detectionSource.detectedBy,
      scannerType: finding.scannerType || detectionSource.scannerType,
      title,
      status: nextStatus,
      severity,
      confidence,
      type: finding.type,
      category,
      file: finding.file,
      line: finding.line,
      column: finding.column || 0,
      functionName: finding.functionName || null,
      scope: finding.scope || null,
      ruleId,
      pattern: finding.pattern,
      reason: finding.reason,
      snippet: finding.snippet || "",
      recommendation: finding.recommendation,
      suggestedOwnerAction: finding.suggestedOwnerAction || null,
      scanner: finding.scanner || finding.source,
      engine: finding.engine || "",
      signature: finding.signature || "",
      occurrenceCount: 1,
      firstDetectedAt: metadata.date,
      firstSeen: metadata.date,
      lastDetectedAt: metadata.date,
      lastSeen: metadata.date,
      resolvedAt: null,
      branch: metadata.branch,
      commitHash: metadata.commitHash,
    };
    tracker.findings.push(created);
    byFingerprint.set(fingerprint, created);
    return enrichFinding({
      ...finding,
      id: created.id,
      title,
      status: created.status,
      severity,
      confidence,
      category,
      ruleId,
      fingerprint,
      firstDetectedAt: created.firstDetectedAt,
      lastDetectedAt: created.lastDetectedAt,
      occurrenceCount: created.occurrenceCount,
      resolvedAt: created.resolvedAt,
      branch: created.branch,
      commitHash: created.commitHash,
    });
  });

  for (const tracked of tracker.findings) {
    tracked.status = normalizeStatus(tracked.status);
    tracked.severity = normalizeSeverity(tracked.severity);
    tracked.confidence = normalizeConfidence(tracked.confidence);
    tracked.category = normalizeCategory(tracked.category);
    if (["OPEN", "NEEDS_REVIEW", "REGRESSION"].includes(tracked.status) && !seen.has(tracked.fingerprint)) {
      tracked.status = "FIXED";
      tracked.resolvedAt = metadata.date;
      tracked.branch = metadata.branch;
      tracked.commitHash = metadata.commitHash;
    }
  }

  fs.writeFileSync(TRACKER_PATH, `${JSON.stringify(tracker, null, 2)}\n`);
  return findings;
}

function createFinding(input) {
  const severity = normalizeSeverity(input.severity || "HIGH");
  return {
    source: input.source,
    detectedBy: input.detectedBy || detectionSourceForFinding(input).detectedBy,
    scannerType: input.scannerType || detectionSourceForFinding(input).scannerType,
    title: input.title,
    severity,
    confidence: normalizeConfidence(input.confidence || confidenceForFinding({ ...input, severity })),
    type: input.type,
    category: input.category ? normalizeCategory(input.category) : undefined,
    file: input.file || "",
    line: input.line || 0,
    column: input.column || 0,
    functionName: input.functionName || null,
    scope: input.scope || null,
    ruleId: input.ruleId || input.pattern || input.type,
    pattern: input.pattern || "",
    reason: input.reason,
    snippet: input.snippet || "",
    recommendation: input.recommendation,
    suggestedOwnerAction: input.suggestedOwnerAction,
    scanner: input.scanner || input.source,
    engine: input.engine || "",
    signature: input.signature || "",
  };
}

function parseNpmAudit(output) {
  try {
    const parsed = JSON.parse(output);
    const metadata = parsed.metadata || {};
    const vulnerabilities = metadata.vulnerabilities || {};
    return {
      total: vulnerabilities.total || 0,
      critical: vulnerabilities.critical || 0,
      high: vulnerabilities.high || 0,
      moderate: vulnerabilities.moderate || 0,
      low: vulnerabilities.low || 0,
      info: vulnerabilities.info || 0,
    };
  } catch {
    return null;
  }
}

function parseGitleaks(output) {
  try {
    const parsed = JSON.parse(output);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    const jsonStart = String(output || "").indexOf("[");
    const jsonEnd = String(output || "").lastIndexOf("]");
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      try {
        const parsed = JSON.parse(String(output).slice(jsonStart, jsonEnd + 1));
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }
}

function normalizeScannerFilePath(value) {
  return normalizePath(String(value || ""))
    .replace(/^\/repo\//, "")
    .replace(/^\/src\//, "")
    .replace(/^\/scan\//, "")
    .replace(/^repo\//, "")
    .replace(/^src\//, "")
    .replace(/^scan\//, "");
}

function runSuspiciousCheck() {
  const result = runSuspiciousCodeScan(ROOT);
  return {
    name: "Suspicious Code Scan",
    status: result.failed ? "FAILED" : "PASSED",
    findings: result.findings,
    details: { scannedFiles: result.scannedFiles, scanScope: result.scanScope },
  };
}

function runSecretScan() {
  const runner = getDockerRunner("gitleaks", DOCKER_IMAGES.gitleaks, {
    containerPath: "/repo",
    container: ["detect", "--source", "/repo", "--redact", "--report-format", "json"],
  });

  if (!runner.available) {
    return {
      name: "Secret Scan",
      status: STRICT ? "FAILED" : "SKIPPED",
      findings: STRICT ? [createFinding({
        source: "Secret Scan",
        severity: "HIGH",
        type: "MISSING_SECURITY_TOOL",
        pattern: "gitleaks",
        reason: `${runner.message}. gitleaks is required when SECURITY_STRICT=true.`,
        recommendation: "Install/start Docker, confirm the gitleaks Docker image can run, and rerun npm run security.",
      })] : [],
      details: { message: runner.message, executionMode: runner.mode, dockerImage: DOCKER_IMAGES.gitleaks },
    };
  }

  const result = runCommand(runner.command, runner.args);
  const leaks = parseGitleaks(result.stdout);
  const findings = leaks.map((leak) => createFinding({
    source: "Secret Scan",
    severity: "CRITICAL",
    type: "LEAKED_SECRET",
    file: normalizeScannerFilePath(leak.File || leak.file || ""),
    line: leak.StartLine || leak.Line || 0,
    pattern: leak.RuleID || leak.Description || "gitleaks",
    reason: "gitleaks detected a possible secret. Secret values are redacted.",
    snippet: "[REDACTED]",
    recommendation: "Remove the secret from source control, rotate it, and store it in a proper secret manager.",
  }));

  if (result.status !== 0 && findings.length === 0) {
    findings.push(createFinding({
      source: "Secret Scan",
      title: "Secret Scanner Could Not Complete",
      severity: "HIGH",
      confidence: "POSSIBLE",
      type: "SECRET_SCAN_INCOMPLETE",
      category: "CONFIG_SECURITY",
      pattern: "gitleaks detect",
      reason: "Docker-based gitleaks returned a failing exit code but did not provide parseable secret findings. This means the secret scanner could not confirm the repository is clean.",
      snippet: `${result.stdout}\n${result.stderr}`.split(/\r?\n/).slice(0, 8).join("\n").slice(0, 1000),
      recommendation: "Run the Docker gitleaks command manually, check whether the image ran correctly, and rerun npm run security. If gitleaks reports leaks, rotate and remove those secrets.",
      suggestedOwnerAction: "Backend owner or DevOps: fix the gitleaks Docker execution/parsing problem so secret scanning can complete.",
    }));
  }

  return {
    name: "Secret Scan",
    status: findings.length > 0 ? "FAILED" : "PASSED",
    findings,
    details: { leaks: findings.length, executionMode: runner.mode, command: runner.command, dockerImage: DOCKER_IMAGES.gitleaks },
  };
}

function runDependencyAudit() {
  const result = runCommand("npm", ["audit", "--audit-level=high", "--json"]);
  const summary = parseNpmAudit(result.stdout) || parseNpmAudit(result.stderr) || {};
  const hasHighOrCritical = (summary.high || 0) > 0 || (summary.critical || 0) > 0;
  const fails = result.status !== 0 || hasHighOrCritical;
  const findings = [];

  if (hasHighOrCritical) {
    findings.push(createFinding({
      source: "Dependency Audit",
      severity: (summary.critical || 0) > 0 ? "CRITICAL" : "HIGH",
      type: "DEPENDENCY_VULNERABILITY",
      file: "package-lock.json",
      pattern: "npm audit --audit-level=high",
      reason: `npm audit reported high/critical dependency vulnerabilities. Summary: critical=${summary.critical || 0}, high=${summary.high || 0}.`,
      recommendation: "Review npm audit details and upgrade vulnerable dependencies manually. Do not run audit fix blindly.",
    }));
  } else if (fails) {
    findings.push(createFinding({
      source: "Dependency Audit",
      severity: "HIGH",
      type: "DEPENDENCY_AUDIT_FAILED",
      file: "package-lock.json",
      pattern: "npm audit --audit-level=high",
      reason: "npm audit returned a failing exit code before confirming dependency security.",
      snippet: `${result.stdout}\n${result.stderr}`.split(/\r?\n/).slice(0, 8).join("\n").slice(0, 1000),
      recommendation: "Rerun npm audit locally, fix tool or registry errors, and resolve any high or critical vulnerabilities manually.",
    }));
  }

  return {
      name: "Dependency Audit",
      status: fails ? "FAILED" : "PASSED",
      findings,
    details: { summary, exitCode: result.status, error: result.error },
  };
}

function runSemgrepScan() {
  const runner = getDockerRunner("semgrep", DOCKER_IMAGES.semgrep, {
    containerPath: "/src",
    container: ["semgrep", "scan", "--config", "auto", "--json", "/src"],
  });

  if (!runner.available) {
    return {
      name: "Semgrep Scan",
      status: STRICT ? "FAILED" : "SKIPPED",
      findings: STRICT ? [createFinding({
        source: "Semgrep Scan",
        severity: "HIGH",
        type: "MISSING_SECURITY_TOOL",
        pattern: "semgrep",
        reason: `${runner.message}. semgrep is required when SECURITY_STRICT=true.`,
        recommendation: "Install/start Docker, confirm the Semgrep Docker image can run, and rerun npm run security.",
      })] : [],
      details: { message: runner.message, executionMode: runner.mode, dockerImage: DOCKER_IMAGES.semgrep },
    };
  }

  const result = runCommand(runner.command, runner.args);
  let parsed = {};
  try {
    parsed = JSON.parse(result.stdout || "{}");
  } catch {
    parsed = {};
  }
  const semgrepResults = Array.isArray(parsed.results) ? parsed.results : [];
  const findings = semgrepResults.map((item) => createFinding({
    source: "Semgrep Scan",
    severity: "HIGH",
    type: "STATIC_ANALYSIS",
    file: normalizeScannerFilePath(item.path || ""),
    line: item.start && item.start.line ? item.start.line : 0,
    pattern: item.check_id || "semgrep",
    reason: item.extra && item.extra.message ? item.extra.message : "Semgrep reported a static analysis issue.",
    snippet: "",
    recommendation: "Review the Semgrep result and fix or document the issue before deployment.",
  }));

  if (result.status !== 0 && findings.length === 0) {
    findings.push(createFinding({
      source: "Semgrep Scan",
      severity: "HIGH",
      type: "STATIC_ANALYSIS_FAILED",
      pattern: "docker semgrep scan",
      reason: "Docker-based Semgrep returned a failing exit code before producing parseable findings.",
      snippet: `${result.stdout}\n${result.stderr}`.split(/\r?\n/).slice(0, 8).join("\n").slice(0, 1000),
      recommendation: "Run the Docker Semgrep command manually, confirm Docker can pull/run the image, and review the scanner output.",
    }));
  }

  return {
    name: "Semgrep Scan",
    status: result.status !== 0 || findings.length > 0 ? "FAILED" : "PASSED",
    findings,
    details: { results: findings.length, executionMode: runner.mode, command: runner.command, dockerImage: DOCKER_IMAGES.semgrep, exitCode: result.status, error: result.error },
  };
}

function runClamAvScan() {
  const runner = getDockerRunner("clamscan", DOCKER_IMAGES.clamav, {
    containerPath: "/scan",
    container: [
      "clamscan",
      "-r",
      "--infected",
      "--exclude-dir=node_modules",
      "--exclude-dir=.git",
      "--exclude-dir=dist",
      "--exclude-dir=build",
      "--exclude-dir=.next",
      "--exclude-dir=scripts/security/reports",
      "/scan",
    ],
  });

  if (!runner.available) {
    return {
      name: "Malware Scan",
      status: STRICT ? "FAILED" : "SKIPPED",
      findings: STRICT ? [createFinding({
        source: "Malware Scan",
        severity: "HIGH",
        type: "MISSING_SECURITY_TOOL",
        pattern: "clamscan",
        reason: `${runner.message}. ClamAV is required when SECURITY_STRICT=true.`,
        recommendation: "Install/start Docker, confirm the ClamAV Docker image can run, and rerun npm run security.",
      })] : [],
      details: { message: runner.message, executionMode: runner.mode, dockerImage: DOCKER_IMAGES.clamav },
    };
  }

  const result = runCommand(runner.command, runner.args);
  const infectedLines = `${result.stdout}\n${result.stderr}`.split(/\r?\n/).filter((line) => line.includes("FOUND"));
  const findings = infectedLines.map((line) => {
    const [filePart, ...messageParts] = line.split(":");
    const signature = messageParts.join(":").replace(/\bFOUND\b/g, "").trim();
    return createFinding({
      source: "Malware Scan",
      title: "ClamAV Malware Signature Detected",
      severity: "CRITICAL",
      confidence: "CONFIRMED",
      type: "ANTIVIRUS_FINDING",
      category: "MALWARE_PATTERN",
      file: normalizeScannerFilePath(filePart || ""),
      pattern: signature || "clamscan FOUND",
      reason: `ClamAV reported an infected file${signature ? ` with signature ${signature}` : ""}. No files were deleted.`,
      snippet: line.slice(0, 240),
      recommendation: "Quarantine manually after review, restore from a trusted source, and rotate any exposed secrets.",
      signature,
      suggestedOwnerAction: "Security reviewer and backend owner: quarantine the file, investigate how it entered the repository, and block deployment until resolved.",
    });
  });

  if (result.status > 1 && findings.length === 0) {
    findings.push(createFinding({
      source: "Malware Scan",
      severity: "HIGH",
      type: "MALWARE_SCAN_FAILED",
      pattern: "docker clamscan",
      reason: "Docker-based ClamAV returned a scanner error before confirming malware status.",
      snippet: `${result.stdout}\n${result.stderr}`.split(/\r?\n/).slice(0, 8).join("\n").slice(0, 1000),
      recommendation: "Run the Docker ClamAV command manually, confirm Docker can pull/run the image, and rerun the security scan.",
    }));
  }

  return {
    name: "Malware Scan",
    status: result.status !== 0 || findings.length > 0 ? "FAILED" : "PASSED",
    findings,
    details: { infected: findings.length, executionMode: runner.mode, command: runner.command, dockerImage: DOCKER_IMAGES.clamav, exitCode: result.status, error: result.error },
  };
}

function runBuildVerification() {
  const result = runCommand("npm", ["run", "build"]);
  const failed = result.status !== 0;
  return {
    name: "Build Verification",
    status: failed ? "FAILED" : "PASSED",
    findings: failed ? [createFinding({
      source: "Build Verification",
      severity: "HIGH",
      type: "BUILD_FAILURE",
      pattern: "npm run build",
      reason: "The project build failed during the manual security gate.",
      snippet: `${result.stdout}\n${result.stderr}`.split(/\r?\n/).slice(-8).join("\n").slice(0, 1000),
      recommendation: "Fix the build failure before any manual deployment.",
    })] : [],
    details: { exitCode: result.status, error: result.error },
  };
}

function makeSummary(checkResults, findings) {
  const counts = Object.fromEntries(SEVERITIES.map((severity) => [severity.toLowerCase(), findings.filter((finding) => finding.severity === severity).length]));
  const statusCounts = Object.fromEntries(STATUSES.map((status) => [status, findings.filter((finding) => finding.status === status).length]));
  const failed = checkResults.filter((check) => check.status === "FAILED").length;
  const skipped = checkResults.filter((check) => check.status === "SKIPPED").length;
  const passed = checkResults.filter((check) => check.status === "PASSED").length;
  const activeFindings = findings.filter((finding) => ["OPEN", "NEEDS_REVIEW", "REGRESSION"].includes(finding.status) && !finding.allowlisted);
  const blockingFindings = activeFindings.filter((finding) => ["CRITICAL", "HIGH"].includes(finding.severity));
  const warningFindings = activeFindings.filter((finding) => ["MEDIUM", "LOW"].includes(finding.severity));
  const categoryCounts = findings.reduce((acc, finding) => {
    acc[finding.category] = (acc[finding.category] || 0) + 1;
    return acc;
  }, {});
  const overallRiskStatus = blockingFindings.length > 0 ? "FAIL" : (warningFindings.length > 0 ? "WARNING" : "PASS");
  const overallRiskExplanation = {
    FAIL: "Do not deploy. One or more CRITICAL or HIGH security issues are open.",
    WARNING: "Review before deploy. Only MEDIUM or LOW security issues are open.",
    PASS: "No active risky findings were detected by this scan.",
  }[overallRiskStatus];

  return {
    status: overallRiskStatus === "PASS" ? "PASSED" : "FAILED",
    overallRiskStatus,
    overallRiskDisplay: `${overallRiskStatus} - ${overallRiskExplanation}`,
    overallRiskExplanation,
    deployment: overallRiskStatus === "PASS" ? "ALLOWED" : "BLOCKED",
    totalChecks: checkResults.length,
    passedChecks: passed,
    failedChecks: failed,
    skippedChecks: skipped,
    totalFindings: findings.length,
    criticalFindings: counts.critical,
    highFindings: counts.high,
    mediumFindings: counts.medium,
    lowFindings: counts.low,
    infoFindings: counts.info,
    openIssues: statusCounts.OPEN,
    needsReviewIssues: statusCounts.NEEDS_REVIEW,
    fixedIssues: statusCounts.FIXED,
    falsePositiveIssues: statusCounts.FALSE_POSITIVE,
    ignoredIssues: statusCounts.IGNORED,
    regressionIssues: statusCounts.REGRESSION,
    categoryCounts,
    malwarePatternFindings: categoryCounts.MALWARE_PATTERN || 0,
    dangerousCodeFindings: categoryCounts.DANGEROUS_CODE || 0,
    secretFindings: categoryCounts.SECRETS || 0,
    dependencyRiskFindings: categoryCounts.DEPENDENCY_RISK || 0,
    configSecurityFindings: categoryCounts.CONFIG_SECURITY || 0,
    allowlistedFindings: statusCounts.IGNORED,
  };
}

function markdownEscape(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function escapeFence(value) {
  return String(value ?? "").replace(/```/g, "`\u200b``").slice(0, 1200);
}

function metricStatus(value, goodWhenZero = true) {
  if (value === 0 && goodWhenZero) return "✅";
  if (value === 0) return "ℹ️";
  return "❌";
}

function checkNote(check) {
  const mode = check.details && check.details.executionMode ? ` (${check.details.executionMode})` : "";
  if (check.name === "Suspicious Code Scan") {
    return check.status === "FAILED" ? "Suspicious or PolinRider-like pattern detected" : "No blocking suspicious code found";
  }
  if (check.name === "Secret Scan") {
    return check.status === "SKIPPED" ? check.details.message : `gitleaks completed${mode}`;
  }
  if (check.name === "Dependency Audit") {
    return check.status === "FAILED" ? "npm audit did not pass" : "No high/critical audit findings";
  }
  if (check.name === "Semgrep Scan") {
    return check.status === "SKIPPED" ? check.details.message : `semgrep completed${mode}`;
  }
  if (check.name === "Malware Scan") {
    return check.status === "SKIPPED" ? check.details.message : `clamscan completed${mode}`;
  }
  if (check.name === "Build Verification") {
    return check.status === "FAILED" ? "npm run build failed" : "npm run build succeeded";
  }
  return "";
}

function scannerReadiness(checkResults) {
  const scannerNames = ["Secret Scan", "Semgrep Scan", "Malware Scan"];
  return scannerNames.map((name) => {
    const check = checkResults.find((item) => item.name === name);
    const details = check?.details || {};
    const configured = check && check.status !== "SKIPPED";

    return {
      scanner: name,
      enabled: configured,
      readiness: configured ? "ON" : "OFF / NOT CONFIGURED",
      status: check?.status || "SKIPPED",
      executionMode: details.executionMode || "docker",
      dockerImage: details.dockerImage || "",
      message: details.message || check?.notes || "",
    };
  });
}

function formatMarkdownReport(report) {
  const lines = [];
  const statusPrefix = report.metrics.status === "PASSED" ? "✅" : "❌";
  const deploymentPrefix = report.metrics.deployment === "ALLOWED" ? "✅" : "🚫";
  lines.push("# Security Scan Report", "");
  lines.push(`**Project:** ${PROJECT_NAME}  `);
  lines.push(`**Scan Time:** ${report.metadata.scanTime}  `);
  lines.push(`**Branch:** ${report.metadata.branch}  `);
  lines.push(`**Commit:** ${report.metadata.commitHash}  `);
  lines.push(`**Status:** ${statusPrefix} ${report.metrics.status}  `);
  lines.push(`**Deployment:** ${deploymentPrefix} ${report.metrics.deployment}  `);
  lines.push("");
  lines.push("## Security Metrics", "");
  lines.push("| Metric | Count | Status |");
  lines.push("|---|---:|---|");
  lines.push(`| Total Checks | ${report.metrics.totalChecks} | - |`);
  lines.push(`| Passed Checks | ${report.metrics.passedChecks} | ${report.metrics.passedChecks > 0 ? "✅" : "ℹ️"} |`);
  lines.push(`| Failed Checks | ${report.metrics.failedChecks} | ${metricStatus(report.metrics.failedChecks)} |`);
  lines.push(`| Skipped Checks | ${report.metrics.skippedChecks} | ${report.metrics.skippedChecks > 0 ? "⚠️" : "✅"} |`);
  lines.push(`| Critical Findings | ${report.metrics.criticalFindings} | ${metricStatus(report.metrics.criticalFindings)} |`);
  lines.push(`| High Findings | ${report.metrics.highFindings} | ${metricStatus(report.metrics.highFindings)} |`);
  lines.push(`| Medium Findings | ${report.metrics.mediumFindings} | ${report.metrics.mediumFindings > 0 ? "⚠️" : "✅"} |`);
  lines.push(`| Low Findings | ${report.metrics.lowFindings} | ${report.metrics.lowFindings > 0 ? "ℹ️" : "✅"} |`);
  lines.push(`| Info Findings | ${report.metrics.infoFindings} | ℹ️ |`);
  lines.push(`| Suspicious Obfuscated Code Findings | ${report.metrics.suspiciousCodeFindings} | ${metricStatus(report.metrics.suspiciousCodeFindings)} |`);
  lines.push(`| Secret Leak Findings | ${report.metrics.secretLeakFindings} | ${metricStatus(report.metrics.secretLeakFindings)} |`);
  lines.push(`| Dependency Vulnerability Findings | ${report.metrics.dependencyVulnerabilityFindings} | ${metricStatus(report.metrics.dependencyVulnerabilityFindings)} |`);
  lines.push(`| Static Analysis Findings | ${report.metrics.staticAnalysisFindings} | ${metricStatus(report.metrics.staticAnalysisFindings)} |`);
  lines.push(`| Build Verification Findings | ${report.metrics.buildVerificationFindings} | ${metricStatus(report.metrics.buildVerificationFindings)} |`);
  lines.push(`| VM/System Findings | ${report.metrics.vmSystemFindings} | ${metricStatus(report.metrics.vmSystemFindings)} |`);
  lines.push(`| Allowlisted Findings | ${report.metrics.allowlistedFindings} | ℹ️ |`);
  lines.push("");
  lines.push("## Check Results", "");
  lines.push("| Step | Check | Status | Findings | Notes |");
  lines.push("|---:|---|---|---:|---|");
  report.checkResults.forEach((check, index) => {
    lines.push(`| ${index + 1} | ${markdownEscape(check.name)} | ${statusIcon(check.status)} ${check.status} | ${check.findingCount} | ${markdownEscape(check.notes)} |`);
  });
  lines.push("");
  lines.push("## Findings Summary", "");
  if (report.findings.length === 0) {
    lines.push("No findings detected.", "");
  } else {
    lines.push("| ID | Severity | Type | File | Line | Function/Scope | Pattern | Status |");
    lines.push("|---|---|---|---|---:|---|---|---|");
    for (const finding of report.findings) {
      lines.push(`| ${finding.id} | ${finding.severity} | ${markdownEscape(finding.type)} | ${markdownEscape(finding.file || "N/A")} | ${finding.line || "N/A"} | ${markdownEscape(finding.scope || "unknown")} | ${markdownEscape(finding.pattern)} | ${finding.status} |`);
    }
    lines.push("", "## Finding Details", "");
    for (const finding of report.findings) {
      lines.push(`### ${finding.id} — ${finding.type}`, "");
      lines.push(`**Severity:** ${finding.severity}  `);
      lines.push(`**Status:** ${finding.status}  `);
      lines.push(`**Category:** ${finding.category}  `);
      lines.push(`**File:** \`${finding.file || "N/A"}\`  `);
      lines.push(`**Line:** ${finding.line || "N/A"}  `);
      lines.push(`**Column:** ${finding.column || "N/A"}  `);
      lines.push(`**Function/Scope:** \`${finding.scope || "unknown"}\`  `);
      lines.push(`**Pattern:** \`${finding.pattern || "N/A"}\`  `);
      if (finding.engine) lines.push(`**Engine:** ${finding.engine}  `);
      if (finding.signature) lines.push(`**Signature:** ${finding.signature}  `);
      lines.push("");
      lines.push("**Why this is dangerous:**", "");
      lines.push(finding.reason || "Review required before deployment.", "");
      lines.push("**Code Evidence:**", "");
      lines.push(`\`\`\`${languageForFile(finding.file)}`);
      lines.push(finding.category === "SECRET_LEAK" ? "[REDACTED]" : escapeFence(finding.snippet || ""));
      lines.push("```", "");
      lines.push("**Recommendation:**", "");
      lines.push(finding.recommendation || "Review and resolve before deployment.", "");
    }
  }
  return `${lines.join("\n")}\n`;
}

function formatReadableMarkdownReport(report) {
  const lines = [];
  const scanScope = report.scanScope || {};
  lines.push("# Security Scan Report", "");
  lines.push(`**Project:** ${PROJECT_NAME}  `);
  lines.push(`**Scan Time:** ${report.metadata.scanTime}  `);
  lines.push(`**Branch:** ${report.metadata.branch}  `);
  lines.push(`**Commit:** ${report.metadata.commitHash}  `);
  lines.push(`**Overall Security Result:** ${report.metrics.overallRiskDisplay}  `);
  lines.push(`**Deployment:** ${report.metrics.deployment}  `);
  lines.push("");
  lines.push("## Dashboard Summary", "");
  lines.push("| Metric | Value |");
  lines.push("|---|---:|");
  lines.push(`| Overall Security Result | ${markdownEscape(report.metrics.overallRiskDisplay)} |`);
  lines.push(`| What This Means | ${markdownEscape(report.metrics.overallRiskExplanation)} |`);
  lines.push(`| Total Findings | ${report.metrics.totalFindings} |`);
  lines.push(`| Critical Count | ${report.metrics.criticalFindings} |`);
  lines.push(`| High Count | ${report.metrics.highFindings} |`);
  lines.push(`| Medium Count | ${report.metrics.mediumFindings} |`);
  lines.push(`| Low Count | ${report.metrics.lowFindings} |`);
  lines.push(`| Info Count | ${report.metrics.infoFindings} |`);
  lines.push(`| Open Issues | ${report.metrics.openIssues} |`);
  lines.push(`| Needs Review | ${report.metrics.needsReviewIssues} |`);
  lines.push(`| Regressions | ${report.metrics.regressionIssues} |`);
  lines.push(`| Fixed | ${report.metrics.fixedIssues} |`);
  lines.push(`| False Positive | ${report.metrics.falsePositiveIssues} |`);
  lines.push(`| Generated At | ${report.metadata.scanTime} |`);
  lines.push(`| Project Path | ${markdownEscape(report.metadata.projectPath)} |`);
  lines.push(`| Security Module Version | ${report.metadata.securityModuleVersion} |`);
  lines.push("");
  lines.push("## Docker Scanner Checklist", "");
  lines.push("These Docker-only scanners should be ON for full coverage. If any scanner is OFF, check Docker Desktop and the configured Docker image.");
  lines.push("");
  lines.push("| Scanner | Checklist | Status | Docker Image | Message |");
  lines.push("|---|---|---|---|---|");
  for (const scanner of report.scannerReadiness || []) {
    lines.push(`| ${markdownEscape(scanner.scanner)} | ${scanner.enabled ? "[x]" : "[ ]"} ${markdownEscape(scanner.readiness)} | ${scanner.status} | ${markdownEscape(scanner.dockerImage || "N/A")} | ${markdownEscape(scanner.message || "OK")} |`);
  }
  lines.push("");
  lines.push("## Scan Scope", "");
  lines.push("This section summarizes which top-level project areas were included. Nested folders are intentionally collapsed, so `src` means `src` and all scanned nested folders under it.");
  lines.push("");
  lines.push("| Scope Item | Value |");
  lines.push("|---|---|");
  lines.push(`| Scanned File Count | ${scanScope.scannedFileCount || 0} |`);
  lines.push(`| Included Folders | ${markdownEscape((scanScope.includedFolders || []).join(", ") || "None")} |`);
  lines.push(`| Included Root Files | ${markdownEscape((scanScope.includedRootFiles || []).join(", ") || "None")} |`);
  lines.push(`| Ignored Folders | ${markdownEscape((scanScope.ignoredFolders || []).join(", ") || "None")} |`);
  lines.push(`| Ignored Paths | ${markdownEscape((scanScope.ignoredPaths || []).join(", ") || "None")} |`);
  lines.push(`| Scanned Extensions | ${markdownEscape((scanScope.scannedExtensions || []).join(", ") || "None")} |`);
  lines.push(`| Extra Scanned File Names | ${markdownEscape((scanScope.extraScannedFiles || []).join(", ") || "None")} |`);
  lines.push("");
  lines.push("## Severity Meanings", "");
  lines.push("| Severity | Meaning | Recommended Action | Priority |");
  lines.push("|---|---|---|---:|");
  for (const severity of SEVERITIES) {
    const definition = SEVERITY_DEFINITIONS[severity];
    lines.push(`| ${severity} | ${markdownEscape(definition.meaning)} | ${markdownEscape(definition.recommendedAction)} | ${definition.priority} |`);
  }
  lines.push("");
  lines.push("## Status Meanings", "");
  lines.push("| Status | Explanation |");
  lines.push("|---|---|");
  for (const status of STATUSES) {
    lines.push(`| ${status} | ${markdownEscape(STATUS_DEFINITIONS[status].explanation)} |`);
  }
  lines.push("");
  lines.push("## Confidence Meanings", "");
  lines.push("| Confidence | Explanation |");
  lines.push("|---|---|");
  for (const [confidence, definition] of Object.entries(CONFIDENCE_DEFINITIONS)) {
    lines.push(`| ${confidence} | ${markdownEscape(definition.explanation)} |`);
  }
  lines.push("");
  lines.push("## Check Results", "");
  lines.push("| Step | Check | Status | Findings | Notes |");
  lines.push("|---:|---|---|---:|---|");
  report.checkResults.forEach((check, index) => {
    lines.push(`| ${index + 1} | ${markdownEscape(check.name)} | ${check.status} | ${check.findingCount} | ${markdownEscape(check.notes)} |`);
  });
  lines.push("");
  lines.push("## Findings Summary", "");
  if (report.findings.length === 0) {
    lines.push("No findings detected.", "");
  } else {
    lines.push("| ID | Title | Detected By | Severity | Status | Confidence | Category | File | Line | Rule |");
    lines.push("|---|---|---|---|---|---|---|---|---:|---|");
    for (const finding of report.findings) {
      lines.push(`| ${finding.id} | ${markdownEscape(finding.title)} | ${markdownEscape(finding.detectedBy || finding.scanner || finding.source)} | ${finding.severity} | ${finding.status} | ${finding.confidence} | ${finding.category} | ${markdownEscape(finding.file || "N/A")} | ${finding.line || "N/A"} | ${markdownEscape(finding.ruleId)} |`);
    }
    lines.push("", "## Finding Details", "");
    for (const finding of [...report.findings].sort((a, b) => severityPriority(a.severity) - severityPriority(b.severity))) {
      lines.push(`### ${finding.id}`, "");
      lines.push(`**Title:** ${finding.title}  `);
      lines.push(`**Detected By:** ${finding.detectedBy || finding.scanner || finding.source}  `);
      lines.push(`**Scanner Type:** ${finding.scannerType || "unknown"}  `);
      lines.push(`**Severity:** ${finding.severity}  `);
      lines.push(`**Status:** ${finding.status}  `);
      lines.push(`**Confidence:** ${finding.confidence}  `);
      lines.push(`**Category:** ${finding.category}  `);
      lines.push(`**File:** \`${finding.file || "N/A"}\`  `);
      lines.push(`**Line:** ${finding.line || "N/A"}  `);
      lines.push(`**Column:** ${finding.column || "N/A"}  `);
      lines.push(`**Function Name:** \`${finding.functionName || finding.scope || "unknown"}\`  `);
      lines.push(`**Rule ID:** \`${finding.ruleId || "N/A"}\`  `);
      if (finding.engine) lines.push(`**Engine:** ${finding.engine}  `);
      if (finding.signature) lines.push(`**Signature:** ${finding.signature}  `);
      lines.push(`**Suggested Owner/Action:** ${finding.suggestedOwnerAction}  `);
      lines.push(`**First Seen:** ${finding.firstSeen || "N/A"}  `);
      lines.push(`**Last Seen:** ${finding.lastSeen || "N/A"}  `);
      lines.push(`**Occurrence Count:** ${finding.occurrenceCount || 1}  `);
      lines.push("");
      lines.push("**Why this matters:**", "");
      lines.push(finding.reason || "Review required before deployment.", "");
      lines.push("**Evidence or Matched Code Snippet:**", "");
      lines.push(`\`\`\`${languageForFile(finding.file)}`);
      lines.push(finding.category === "SECRETS" ? "[REDACTED]" : escapeFence(finding.snippet || ""));
      lines.push("```", "");
      lines.push("**Recommended Fix:**", "");
      lines.push(finding.recommendation || "Review and resolve before deployment.", "");
    }
  }

  return `${lines.join("\n")}\n`;
}

function statusIcon(status) {
  if (status === "PASSED") return "✅";
  if (status === "SKIPPED") return "⚠️";
  return "❌";
}

function printConsole(report) {
  report.checkResults.forEach((check, index) => {
    console.log(`[${index + 1}/6] ${check.name} ${statusIcon(check.status)} ${check.status}`);
  });
  console.log("");
  console.log(report.metrics.status === "PASSED" ? "SECURITY CHECK PASSED - DEPLOYMENT ALLOWED" : "SECURITY CHECK FAILED - DO NOT DEPLOY");
  console.log("");
  console.log("Metrics:");
  console.log("");
  console.log(`Critical Findings: ${report.metrics.criticalFindings}`);
  console.log(`High Findings: ${report.metrics.highFindings}`);
  console.log(`Secret Leaks: ${report.metrics.secretLeakFindings}`);
  console.log(`Dependency Vulnerabilities: ${report.metrics.dependencyVulnerabilityFindings}`);
  console.log(`Suspicious Code Findings: ${report.metrics.suspiciousCodeFindings}`);

  const critical = report.findings.filter((finding) => ["CRITICAL", "HIGH"].includes(finding.severity) && finding.status === "OPEN");
  if (critical.length > 0) {
    console.log("");
    console.log("Top Findings:");
    console.log("");
    critical.slice(0, 20).forEach((finding, index) => {
      const location = finding.file ? `${finding.file}:${finding.line || "N/A"}` : finding.source;
      console.log(`${index + 1}. ${finding.id} | ${finding.severity} | ${location} | ${finding.scope || "unknown"} | ${finding.pattern}`);
    });
  }

  console.log("");
  console.log("Full report:");
  console.log(path.relative(ROOT, report.reportPaths.markdown));
  console.log("");
  console.log("Latest report:");
  console.log(path.relative(ROOT, report.reportPaths.latestMarkdown));
  console.log("");
  console.log("Tracker:");
  console.log(path.relative(ROOT, report.trackerPath));
}

function printFriendlyConsole(report) {
  console.log("Security Scan Completed");
  console.log("");
  console.log(`Result: ${report.metrics.overallRiskDisplay}`);
  console.log("");
  console.log(`Total Findings: ${report.metrics.totalFindings}`);
  console.log(`Open Issues: ${report.metrics.openIssues + report.metrics.regressionIssues}`);
  console.log("");
  console.log("Issue Levels:");
  console.log(`Critical: ${report.metrics.criticalFindings}`);
  console.log(`High: ${report.metrics.highFindings}`);
  console.log(`Medium: ${report.metrics.mediumFindings}`);
  console.log(`Low: ${report.metrics.lowFindings}`);
  console.log(`Info: ${report.metrics.infoFindings}`);
  console.log("");
  console.log("Docker Scanners:");
  for (const scanner of report.scannerReadiness || []) {
    console.log(`${scanner.enabled ? "[x]" : "[ ]"} ${scanner.scanner}: ${scanner.readiness}`);
  }

  const blocking = report.findings.filter((finding) => ["CRITICAL", "HIGH"].includes(finding.severity) && ["OPEN", "REGRESSION"].includes(finding.status));
  if (blocking.length > 0) {
    console.log("");
    console.log("Top Critical/High Issues:");
    blocking.slice(0, 20).forEach((finding, index) => {
      const location = finding.file ? `${finding.file}:${finding.line || "N/A"}` : finding.source;
      console.log(`${index + 1}. ${finding.id} | ${finding.severity} | ${location} | ${finding.title}`);
    });
  }

  console.log("");
  console.log("Report saved:");
  console.log(path.relative(ROOT, report.reportPaths.markdown));
  console.log("");
  console.log("Next action:");
  if (report.metrics.overallRiskStatus === "FAIL") {
    console.log("Fix CRITICAL and HIGH issues first.");
  } else if (report.metrics.overallRiskStatus === "WARNING") {
    console.log("Review MEDIUM and LOW issues before release.");
  } else {
    console.log("No risky findings found.");
  }
}

function main() {
  ensureReportsDir();
  const metadata = getMetadata();
  const checkResults = [
    runSuspiciousCheck(),
    runSecretScan(),
    runDependencyAudit(),
    runSemgrepScan(),
    runClamAvScan(),
    runBuildVerification(),
  ];
  const rawFindings = checkResults.flatMap((check) => check.findings);
  const findings = updateTracker(rawFindings, metadata);
  const metrics = makeSummary(checkResults, findings);
  const stamp = timestampForFile(new Date(metadata.date));
  const markdownPath = path.join(REPORTS_DIR, `security-report-${stamp}.md`);
  const jsonPath = path.join(REPORTS_DIR, `security-report-${stamp}.json`);
  const latestMarkdownPath = path.join(REPORTS_DIR, "latest.md");
  const latestJsonPath = path.join(REPORTS_DIR, "latest.json");
  const reportMetadata = {
    projectName: PROJECT_NAME,
    scanTime: metadata.date,
    branch: metadata.branch,
    commitHash: metadata.commitHash,
    status: metrics.status,
    overallRiskStatus: metrics.overallRiskStatus,
    deployment: metrics.deployment,
    mode: metadata.mode,
    strict: metadata.strict,
    generatedAt: metadata.date,
    projectPath: ROOT,
    securityModuleVersion: SECURITY_MODULE_VERSION,
    reportPath: markdownPath,
    latestReportPath: latestMarkdownPath,
    trackerPath: TRACKER_PATH,
  };
  const normalizedCheckResults = checkResults.map(({ name, status, details, findings: checkFindings }) => ({
    name,
    status,
    findingCount: checkFindings.length,
    notes: checkNote({ name, status, details }),
    details,
  }));
  const scanScope = checkResults.find((check) => check.name === "Suspicious Code Scan")?.details?.scanScope || null;
  const readiness = scannerReadiness(normalizedCheckResults);
  const report = {
    metadata: reportMetadata,
    metrics,
    scanScope,
    scannerReadiness: readiness,
    checkResults: normalizedCheckResults,
    findings,
    reportPaths: {
      markdown: markdownPath,
      json: jsonPath,
      latestMarkdown: latestMarkdownPath,
      latestJson: latestJsonPath,
    },
    trackerPath: TRACKER_PATH,
  };

  fs.writeFileSync(markdownPath, formatReadableMarkdownReport(report));
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.copyFileSync(markdownPath, report.reportPaths.latestMarkdown);
  fs.copyFileSync(jsonPath, report.reportPaths.latestJson);

  printFriendlyConsole(report);
  process.exit(metrics.status === "PASSED" ? 0 : 1);
}

main();
