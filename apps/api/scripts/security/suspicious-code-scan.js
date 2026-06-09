const fs = require("fs");
const path = require("path");

const SCAN_EXTENSIONS = new Set([
  ".js",
  ".ts",
  ".jsx",
  ".tsx",
  ".mjs",
  ".cjs",
  ".json",
]);

const EXTRA_SCAN_FILES = new Set([".env.example"]);

const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
  "logs",
  "uploads",
]);

const SECURITY_TOOLING_FILES = new Set([
  "scripts/security/run-security-check.js",
  "scripts/security/suspicious-code-check.js",
  "scripts/security/suspicious-code-scan.js",
]);

const STRICT_CONFIG_FILES = new Set([
  "postcss.config.js",
  "tailwind.config.js",
  "next.config.js",
  "vite.config.js",
  "webpack.config.js",
  "eslint.config.js",
  "babel.config.js",
  "tsconfig.json",
]);

const CONFIG_RUNTIME_PATTERNS = [
  { type: "CONFIG_OBFUSCATION", pattern: "global[", regex: /global\s*\[/, severity: "CRITICAL" },
  { type: "CONFIG_OBFUSCATION", pattern: "globalThis[", regex: /globalThis\s*\[/, severity: "CRITICAL" },
  { type: "CONFIG_OBFUSCATION", pattern: "eval(", regex: /\beval\s*\(/, severity: "CRITICAL" },
  { type: "CONFIG_OBFUSCATION", pattern: "Function", regex: /\bFunction\s*\(/, severity: "CRITICAL" },
  { type: "CONFIG_OBFUSCATION", pattern: "new Function", regex: /new\s+Function\s*\(/, severity: "CRITICAL" },
  { type: "CONFIG_OBFUSCATION", pattern: "String.fromCharCode", regex: /String\.fromCharCode/, severity: "CRITICAL" },
  { type: "CONFIG_PROCESS_EXECUTION", pattern: "child_process", regex: /child_process/, severity: "CRITICAL" },
  { type: "CONFIG_PROCESS_EXECUTION", pattern: "Buffer.from base64", regex: /Buffer\.from\s*\([^)]*["'`]base64["'`]/i, severity: "CRITICAL" },
  { type: "CONFIG_PROCESS_EXECUTION", pattern: "curl", regex: /\bcurl\b/i, severity: "CRITICAL" },
  { type: "CONFIG_PROCESS_EXECUTION", pattern: "wget", regex: /\bwget\b/i, severity: "CRITICAL" },
  { type: "CONFIG_PROCESS_EXECUTION", pattern: "powershell", regex: /\bpowershell\b/i, severity: "CRITICAL" },
  { type: "CONFIG_PROCESS_EXECUTION", pattern: "cmd.exe", regex: /\bcmd\.exe\b/i, severity: "CRITICAL" },
];

const PATTERNS = [
  { type: "DYNAMIC_CODE_EXECUTION", pattern: "eval(", regex: /\beval\s*\(/, severity: "HIGH", reason: "Dynamic code execution can run injected or obfuscated JavaScript." },
  { type: "DYNAMIC_CODE_EXECUTION", pattern: "new Function", regex: /new\s+Function\s*\(/, severity: "HIGH", reason: "Runtime function construction can hide malicious logic." },
  { type: "DYNAMIC_CODE_EXECUTION", pattern: "Function", regex: /(?:^|[^\w.])Function\s*\(/, severity: "HIGH", reason: "Runtime function construction can hide malicious logic." },
  { type: "GLOBAL_PROPERTY_ACCESS", pattern: "global[", regex: /global\s*\[/, severity: "CRITICAL", reason: "Computed global access is commonly used by obfuscated trojans." },
  { type: "GLOBAL_PROPERTY_ACCESS", pattern: "globalThis[", regex: /globalThis\s*\[/, severity: "CRITICAL", reason: "Computed global access is commonly used by obfuscated trojans." },
  { type: "OBFUSCATION", pattern: "String.fromCharCode", regex: /String\.fromCharCode/, severity: "CRITICAL", reason: "Character-code decoding is a common JavaScript obfuscation technique." },
  { type: "ENCODED_PAYLOAD", pattern: "Buffer.from(...base64)", regex: /Buffer\.from\s*\([^)]*["'`]base64["'`]/i, severity: "HIGH", reason: "Base64 decoding can hide executable payloads." },
  { type: "PROCESS_EXECUTION", pattern: "child_process", regex: /\bchild_process\b/, severity: "HIGH", reason: "Child process access can execute operating system commands." },
  { type: "PROCESS_EXECUTION", pattern: "require(\"child_process\")", regex: /require\s*\(\s*["']child_process["']\s*\)/, severity: "HIGH", reason: "Child process access can execute operating system commands." },
  { type: "PROCESS_EXECUTION", pattern: "exec(", regex: /(?:^|[^\w.])exec\s*\(/, severity: "HIGH", reason: "Shell execution can run attacker-controlled commands." },
  { type: "PROCESS_EXECUTION", pattern: "execSync(", regex: /(?:^|[^\w.])execSync\s*\(/, severity: "HIGH", reason: "Shell execution can run attacker-controlled commands." },
  { type: "PROCESS_EXECUTION", pattern: "spawn(", regex: /(?:^|[^\w.])spawn\s*\(/, severity: "HIGH", reason: "Process spawning can run attacker-controlled commands." },
  { type: "PROCESS_EXECUTION", pattern: "spawnSync(", regex: /(?:^|[^\w.])spawnSync\s*\(/, severity: "HIGH", reason: "Process spawning can run attacker-controlled commands." },
  { type: "SUSPICIOUS_COMMAND", pattern: "powershell", regex: /\bpowershell\b/i, severity: "HIGH", reason: "PowerShell invocation in source code is suspicious in this backend." },
  { type: "SUSPICIOUS_COMMAND", pattern: "cmd.exe", regex: /\bcmd\.exe\b/i, severity: "HIGH", reason: "Windows shell invocation in source code is suspicious in this backend." },
  { type: "SUSPICIOUS_COMMAND", pattern: "curl", regex: /\bcurl\b/i, severity: "MEDIUM", reason: "Command-line network download may indicate a staged payload." },
  { type: "SUSPICIOUS_COMMAND", pattern: "wget", regex: /\bwget\b/i, severity: "MEDIUM", reason: "Command-line network download may indicate a staged payload." },
  { type: "SUSPICIOUS_COMMAND", pattern: "Invoke-WebRequest", regex: /\bInvoke-WebRequest\b/i, severity: "HIGH", reason: "PowerShell network download may indicate a staged payload." },
  { type: "ENCODED_PAYLOAD", pattern: "atob(", regex: /\batob\s*\(/, severity: "MEDIUM", reason: "Base64 decoding can hide payloads or secrets." },
  { type: "STRING_TIMER_EXECUTION", pattern: "setTimeout(\"string\")", regex: /setTimeout\s*\(\s*["'`]/, severity: "HIGH", reason: "String-based timers execute code dynamically." },
  { type: "STRING_TIMER_EXECUTION", pattern: "setInterval(\"string\")", regex: /setInterval\s*\(\s*["'`]/, severity: "HIGH", reason: "String-based timers execute code dynamically." },
  { type: "DYNAMIC_REQUIRE", pattern: "dynamic require aliasing", regex: /(?:const|let|var)\s+\w+\s*=\s*require\s*;|require\s*\(\s*[^"'`\s][^)]+\)/, severity: "MEDIUM", reason: "Dynamic or aliased require calls can hide loaded modules." },
  { type: "FILESYSTEM_MODIFICATION", pattern: "fs modification", regex: /\bfs\.(?:writeFile|writeFileSync|appendFile|appendFileSync|rm|rmSync|unlink|unlinkSync|rename|renameSync|copyFile|copyFileSync)\s*\(/, severity: "HIGH", configOnly: true, reason: "Filesystem mutation in configuration files is suspicious." },
  { type: "NETWORK_CALL", pattern: "network call", regex: /\b(?:fetch|axios\.(?:get|post|put|patch|delete)|https?\.request|https?\.get)\s*\(/, severity: "HIGH", configOnly: true, reason: "Network calls in configuration files are suspicious and should be reviewed." },
];

function loadAllowlist(rootDir, allowlistPath) {
  if (!fs.existsSync(allowlistPath)) {
    return [];
  }

  const raw = fs.readFileSync(allowlistPath, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed || !Array.isArray(parsed.allow)) {
    throw new Error("security-allowlist.json must contain an allow array.");
  }

  return parsed.allow.map((entry, index) => {
    if (!entry.file || !entry.pattern || !entry.reason) {
      throw new Error(`Allowlist entry ${index + 1} must include file, pattern, and reason.`);
    }

    return {
      file: normalizePath(entry.file),
      pattern: String(entry.pattern),
      reason: String(entry.reason),
      allowConfigFile: entry.allowConfigFile === true,
    };
  });
}

function normalizePath(value) {
  return value.replace(/\\/g, "/");
}

function isIgnoredDirectory(relativePath) {
  const normalized = normalizePath(relativePath);
  if (normalized === "scripts/security/reports" || normalized.startsWith("scripts/security/reports/")) {
    return true;
  }

  return normalized.split("/").some((part) => IGNORE_DIRS.has(part));
}

function shouldScanFile(filePath) {
  const baseName = path.basename(filePath);
  return SCAN_EXTENSIONS.has(path.extname(baseName)) || EXTRA_SCAN_FILES.has(baseName);
}

function walkFiles(rootDir) {
  const files = [];

  function walk(currentDir) {
    for (const item of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const fullPath = path.join(currentDir, item.name);
      const relative = path.relative(rootDir, fullPath);

      if (item.isDirectory()) {
        if (!isIgnoredDirectory(relative)) {
          walk(fullPath);
        }
        continue;
      }

      if (item.isFile() && shouldScanFile(fullPath)) {
        files.push(fullPath);
      }
    }
  }

  walk(rootDir);
  return files;
}

function summarizeScanScope(rootDir, files) {
  const includedFolders = new Set();
  const includedRootFiles = new Set();

  for (const filePath of files) {
    const relative = normalizePath(path.relative(rootDir, filePath));
    const parts = relative.split("/");
    if (parts.length > 1) {
      includedFolders.add(parts[0]);
    } else {
      includedRootFiles.add(relative);
    }
  }

  return {
    scannedFileCount: files.length,
    includedFolders: Array.from(includedFolders).sort(),
    includedRootFiles: Array.from(includedRootFiles).sort(),
    ignoredFolders: Array.from(IGNORE_DIRS).sort(),
    ignoredPaths: ["scripts/security/reports"],
    scannedExtensions: Array.from(SCAN_EXTENSIONS).sort(),
    extraScannedFiles: Array.from(EXTRA_SCAN_FILES).sort(),
    note: "Folders are summarized at top level. For example, src means src and its nested folders were included.",
  };
}

function getLineNumber(content, index) {
  return content.slice(0, index).split(/\r?\n/).length;
}

function getColumnNumber(content, index) {
  const lineStart = content.lastIndexOf("\n", index);
  return index - lineStart;
}

function getSafeSnippet(lines, lineNumber) {
  const line = lines[lineNumber - 1] || "";
  return line.trim().replace(/[A-Za-z0-9+/=]{40,}/g, "[REDACTED_LONG_TOKEN]").slice(0, 240);
}

function isAllowlisted(allowlist, finding, isConfigFile) {
  return allowlist.find((entry) => {
    if (entry.file !== normalizePath(finding.file)) {
      return false;
    }

    if (isConfigFile && !entry.allowConfigFile) {
      return false;
    }

    return finding.pattern.includes(entry.pattern) || entry.pattern.includes(finding.pattern);
  });
}

function addFinding(findings, allowlist, finding, isConfigFile) {
  const allowed = isAllowlisted(allowlist, finding, isConfigFile);
  if (allowed) {
    findings.push({
      ...finding,
      severity: "INFO",
      allowlisted: true,
      reason: `${finding.reason} Allowlisted: ${allowed.reason}`,
      recommendation: "Keep this allowlist entry file-specific and review it regularly.",
    });
    return;
  }

  findings.push(finding);
}

function scanFile(rootDir, filePath, allowlist) {
  const content = fs.readFileSync(filePath, "utf8");
  const relative = normalizePath(path.relative(rootDir, filePath));
  const baseName = path.basename(filePath);
  const isConfigFile = STRICT_CONFIG_FILES.has(baseName);
  const isSecurityToolingFile = SECURITY_TOOLING_FILES.has(relative);
  const lines = content.split(/\r?\n/);
  const findings = [];

  for (const rule of PATTERNS) {
    if (rule.configOnly && !isConfigFile) {
      continue;
    }

    const regex = new RegExp(rule.regex.source, rule.regex.flags.includes("g") ? rule.regex.flags : `${rule.regex.flags}g`);
    for (const match of content.matchAll(regex)) {
      const line = getLineNumber(content, match.index || 0);
      const column = getColumnNumber(content, match.index || 0);
      const finding = {
        source: "Suspicious Code Scan",
        severity: rule.severity,
        type: isConfigFile && rule.type === "NETWORK_CALL" ? "CONFIG_NETWORK_CALL" : rule.type,
        file: relative,
        line,
        column,
        pattern: rule.pattern,
        reason: isConfigFile && CONFIG_RUNTIME_PATTERNS.some((configRule) => configRule.pattern === rule.pattern)
          ? "Strict config files must not contain obfuscation, process execution, or hidden runtime behavior."
          : rule.reason,
        snippet: getSafeSnippet(lines, line),
        recommendation: isConfigFile
          ? "Remove runtime logic from this config file and keep only explicit configuration exports."
          : "Review this code path and replace dynamic or shell-capable behavior with safer explicit code.",
      };
      if (isSecurityToolingFile) {
        findings.push({
          ...finding,
          severity: "INFO",
          allowlisted: true,
          reason: `${finding.reason} This is part of the security scanner implementation and is reported for visibility.`,
          recommendation: "Review security tooling changes carefully during code review.",
        });
      } else {
        addFinding(findings, allowlist, finding, isConfigFile);
      }
    }
  }

  if (isConfigFile) {
    if (content.length > 12000 || lines.length > 120) {
      addFinding(findings, allowlist, {
        source: "Suspicious Code Scan",
        severity: "CRITICAL",
        type: "CONFIG_UNUSUALLY_LARGE",
        file: relative,
        line: 1,
        column: 1,
        pattern: "unusually large config file",
        reason: "Strict config files should be small and auditable; large config files can hide payloads.",
        snippet: `${lines.length} lines, ${content.length} bytes`,
        recommendation: "Reduce this config file to essential configuration and move legitimate logic to reviewed source files.",
      }, isConfigFile);
    }

    for (const rule of CONFIG_RUNTIME_PATTERNS) {
      if (rule.regex.test(content)) {
        const match = content.match(rule.regex);
        const line = getLineNumber(content, match && match.index ? match.index : 0);
        const column = getColumnNumber(content, match && match.index ? match.index : 0);
        addFinding(findings, allowlist, {
          source: "Suspicious Code Scan",
          severity: rule.severity,
          type: rule.type,
          file: relative,
          line,
          column,
          pattern: rule.pattern,
          reason: "Strict config files must not contain PolinRider-style obfuscation or runtime execution primitives.",
          snippet: getSafeSnippet(lines, line),
          recommendation: "Remove the suspicious construct and verify the config file contains only normal configuration.",
        }, isConfigFile);
      }
    }

    const normalExportIndex = content.search(/module\.exports|export\s+default/);
    if (normalExportIndex >= 0) {
      const afterExport = content.slice(normalExportIndex);
      const statementCount = (afterExport.match(/;\s*(?:\w|\(|global|eval|Function|require|process)/g) || []).length;
      if (statementCount >= 3) {
        addFinding(findings, allowlist, {
          source: "Suspicious Code Scan",
          severity: "CRITICAL",
          type: "CONFIG_HIDDEN_RUNTIME_LOGIC",
          file: relative,
          line: getLineNumber(content, normalExportIndex),
          column: getColumnNumber(content, normalExportIndex),
          pattern: "hidden runtime code in config files",
          reason: "Executable statements after a normal config export can hide malicious runtime behavior.",
          snippet: getSafeSnippet(lines, getLineNumber(content, normalExportIndex)),
          recommendation: "Keep config files declarative and remove hidden execution logic.",
        }, isConfigFile);
      }
    }
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/\.(?:js|ts|jsx|tsx|mjs|cjs)$/.test(relative) && line.length > 1200) {
      addFinding(findings, allowlist, {
        source: "Suspicious Code Scan",
        severity: "HIGH",
        type: "LONG_ONE_LINE_JAVASCRIPT",
        file: relative,
        line: index + 1,
        column: 1,
        pattern: "very long one-line JavaScript",
        reason: "Very long JavaScript lines are often used to hide minified or obfuscated payloads.",
        snippet: getSafeSnippet(lines, index + 1),
        recommendation: "Review the line and move legitimate generated code outside source-controlled application files.",
      }, isConfigFile);
    }

    if (/[A-Za-z0-9+/=]{500,}/.test(line)) {
      addFinding(findings, allowlist, {
        source: "Suspicious Code Scan",
        severity: "HIGH",
        type: "LONG_ENCODED_STRING",
        file: relative,
        line: index + 1,
        column: 1,
        pattern: "very long encoded strings",
        reason: "Long encoded strings can hide malware payloads or leaked secret material.",
        snippet: getSafeSnippet(lines, index + 1),
        recommendation: "Remove encoded payloads from source or document and review any legitimate generated artifact.",
      }, isConfigFile);
    }
  }

  return findings;
}

function scan(rootDir, options = {}) {
  const allowlistPath = options.allowlistPath || path.join(rootDir, "scripts", "security", "security-allowlist.json");
  const allowlist = loadAllowlist(rootDir, allowlistPath);
  const files = walkFiles(rootDir);
  const scanScope = summarizeScanScope(rootDir, files);
  const findings = files.flatMap((filePath) => scanFile(rootDir, filePath, allowlist));
  const blockingFindings = findings.filter((finding) => !finding.allowlisted && ["CRITICAL", "HIGH"].includes(finding.severity));

  return {
    scannedFiles: files.length,
    scanScope,
    findings,
    failed: blockingFindings.length > 0,
  };
}

module.exports = {
  scan,
  summarizeScanScope,
  STRICT_CONFIG_FILES,
};

if (require.main === module) {
  const result = scan(process.cwd());
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.failed ? 1 : 0);
}
