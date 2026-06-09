# Security Module Explanation

This is the main documentation for the security module under `scripts/security`.

The module is generic. It can be used in JavaScript/TypeScript projects such as:

- Node.js or Express backends.
- Next.js applications.
- React/Vite admin panels or frontends.
- Mixed full-stack repositories with `src`, `scripts`, config files, JSON files, and package metadata.

## Quick Setup

1. Install and start Docker Desktop.

2. Confirm Docker works:

```powershell
docker --version
docker ps
```

3. Pull the scanner images:

```powershell
docker pull zricethezav/gitleaks:latest
docker pull semgrep/semgrep:latest
docker pull clamav/clamav:latest
```

4. Optional: set a friendly project name for reports:

```powershell
$env:SECURITY_PROJECT_NAME="my-project-name"
```

If `SECURITY_PROJECT_NAME` is not set, the runner uses `package.json` `name`, then falls back to the current folder name.

5. Optional: override Docker images:

```powershell
$env:SECURITY_GITLEAKS_IMAGE="zricethezav/gitleaks:latest"
$env:SECURITY_SEMGREP_IMAGE="semgrep/semgrep:latest"
$env:SECURITY_CLAMAV_IMAGE="clamav/clamav:latest"
```

6. Optional: make missing Docker scanner setup fail the scan instead of skip:

```powershell
$env:SECURITY_STRICT="true"
```

7. Run the security gate:

```bash
npm run security
```

The module scans the project, generates human-readable and JSON reports, tracks findings across runs, and exits with a failing status when active high-risk findings exist.

## Main Files

| File | Purpose |
|---|---|
| `run-security-check.js` | Main runner for `npm run security`. It runs all checks, updates the tracker, writes reports, and prints the terminal summary. |
| `suspicious-code-scan.js` | Built-in source-code scanner for dangerous JavaScript/TypeScript/config patterns. |
| `suspicious-code-check.js` | Standalone helper for suspicious-code checking. |
| `security-model.js` | Shared severity, status, confidence, category, and finding ID definitions. |
| `security-allowlist.json` | File-specific reviewed exceptions. |
| `reports/` | Generated markdown/json reports and finding tracker. |
| `report_explain.md` | Detailed guide to reading generated reports. |

## What It Detects

- Secret and credential leaks with Docker-based gitleaks.
- Malware signatures with Docker-based ClamAV. Any infected-file match is reported as `CRITICAL`.
- Dangerous JavaScript/TypeScript patterns such as `eval`, `new Function`, process execution, encoded payloads, dynamic require, and hidden runtime behavior in config files.
- High and critical dependency risk with `npm audit --audit-level=high`.
- Static-analysis findings with Docker-based Semgrep.
- Build failures with `npm run build`.

## What It Cannot Guarantee

This module is a security review aid, not proof that the project is fully secure. It cannot guarantee that every vulnerability, business-logic flaw, authorization bug, payment-flow issue, malicious package behavior, or runtime compromise has been detected.

Human review is still required for authentication, payment flows, permissions, API authorization, production configuration, and any finding marked `NEEDS_REVIEW` or `POSSIBLE`.

## How To Run

```bash
npm run security
```

The command runs:

- Built-in suspicious-code scan.
- Docker-based gitleaks secret scan.
- `npm audit --audit-level=high`.
- Docker-based Semgrep scan.
- Docker-based ClamAV malware scan.
- `npm run build`.

## Docker Requirements

`gitleaks`, `semgrep`, and `clamscan` are Docker-only in this module. The runner does not use locally installed versions of these three tools.

Docker Desktop must be installed and running.

Default Docker images:

| Tool | Docker Image | Purpose |
|---|---|---|
| gitleaks | `zricethezav/gitleaks:latest` | Secret leak detection. |
| Semgrep | `semgrep/semgrep:latest` | Static code analysis. |
| ClamAV | `clamav/clamav:latest` | Malware signature scanning. |

Set or override Docker images in PowerShell:

```powershell
$env:SECURITY_GITLEAKS_IMAGE="zricethezav/gitleaks:latest"
$env:SECURITY_SEMGREP_IMAGE="semgrep/semgrep:latest"
$env:SECURITY_CLAMAV_IMAGE="clamav/clamav:latest"
npm run security
```

If Docker is missing, these Docker-only checks are marked `SKIPPED` by default. To make missing Docker fail the scan:

```powershell
$env:SECURITY_STRICT="true"
npm run security
```

## Manual Docker Commands

Use these commands when troubleshooting one scanner at a time.

### Gitleaks

Purpose: detect committed secrets, tokens, API keys, private keys, and credential-like values.

```powershell
docker run --rm --name gcpay-security-gitleaks -v ${PWD}:/repo zricethezav/gitleaks:latest detect --source /repo --redact --report-format json
```

Important:

- `--redact` prevents secret values from being printed.
- A finding from gitleaks should be treated seriously.
- If a real secret is found, remove it and rotate/revoke it immediately.

### Semgrep

Purpose: static code analysis for insecure patterns, framework misuse, secret-like values, unsafe input handling, and risky code.

```powershell
docker run --rm --name gcpay-security-semgrep -v ${PWD}:/src semgrep/semgrep:latest semgrep scan --config auto --json /src
```

Important:

- Semgrep findings may be true positives or false positives.
- Review the file, line, rule ID, and evidence before deciding.
- Secret-like values in `.sql`, `.json`, or fixture files may still be real security risks if they contain user/session data.

### ClamAV

Purpose: antivirus-style scan for known malware signatures.

```powershell
docker run --rm --name gcpay-security-clamav -v ${PWD}:/scan clamav/clamav:latest clamscan -r --infected /scan
```

Important:

- ClamAV signature matches are treated as `CRITICAL`.
- The module does not delete or quarantine files automatically.
- If ClamAV reports an infected file, stop deployment and investigate manually.

## What The Built-In Scanner Scans

The built-in suspicious-code scanner walks the project and scans supported source/config files. Reports summarize included top-level folders. For example, if `src` is listed, then `src` and its scanned nested folders were included.

Scanned file types:

- `.js`
- `.ts`
- `.jsx`
- `.tsx`
- `.mjs`
- `.cjs`
- `.json`
- `.env.example`

Ignored folders:

- `node_modules`
- `.git`
- `dist`
- `build`
- `.next`
- `coverage`
- `logs`
- `uploads`
- `scripts/security/reports`

## Suspicious Patterns Detected

| Pattern Type | Examples | Why It Matters |
|---|---|---|
| Dynamic execution | `eval(`, `new Function`, `Function(` | Can execute injected or hidden code. |
| Global object tricks | `global[`, `globalThis[` | Often used in obfuscated payloads. |
| Encoded payloads | `Buffer.from(..., "base64")`, very long encoded strings | Can hide malware, scripts, or secrets. |
| Shell/process execution | `child_process`, `exec(`, `spawn(`, `execSync(` | Can run operating system commands. |
| Suspicious command usage | `powershell`, `cmd.exe`, `curl`, `wget`, `Invoke-WebRequest` | Can download or execute staged payloads. |
| String timer execution | `setTimeout("...")`, `setInterval("...")` | Executes code from strings. |
| Dynamic require | Aliased or computed `require(...)` | Can hide which module is loaded. |
| Config-file runtime behavior | Filesystem mutation, network calls, hidden logic | Build/config files should stay declarative and easy to audit. |
| Large/minified lines | Very long one-line JavaScript | Can hide obfuscated payloads. |

Strict config files receive extra scrutiny:

- `postcss.config.js`
- `tailwind.config.js`
- `next.config.js`
- `vite.config.js`
- `webpack.config.js`
- `eslint.config.js`
- `babel.config.js`
- `tsconfig.json`

## Reports

Reports are written to:

```text
scripts/security/reports
```

Timestamped markdown reports use:

```text
security-report-YYYY-MM-DD_HH-mm-ss.md
```

The latest report is also copied to:

- `latest.md`
- `latest.json`

Each report includes:

- Overall Security Result.
- Dashboard summary.
- Docker Scanner Checklist.
- Scan scope.
- Severity, status, and confidence explanations.
- Check results.
- Findings summary with `Detected By`.
- Finding details with evidence, rule ID, owner/action, first seen, last seen, and occurrence count.

If a Docker-based scanner cannot complete, the report creates a scanner/tooling finding. For example, if gitleaks fails before returning parseable JSON, the report says the secret scanner could not confirm the repository is clean. That is different from a confirmed leaked secret.

## Docker Scanner Checklist

Near the top of every report, the Docker Scanner Checklist shows whether the Docker-only scanners are configured and running:

| Scanner | Meaning |
|---|---|
| Secret Scan | Docker-based gitleaks. |
| Semgrep Scan | Docker-based Semgrep. |
| Malware Scan | Docker-based ClamAV. |

Checklist meaning:

- `[x] ON`: Docker was available and the scanner command ran.
- `[ ] OFF / NOT CONFIGURED`: Docker was unavailable or the scanner could not be started.

The scanner `Status` column is separate:

- `PASSED`: scanner ran and did not produce findings.
- `FAILED`: scanner ran and found issues, or the scanner command failed.
- `SKIPPED`: scanner did not run.

So `[x] ON` plus `FAILED` means the scanner was active, but it found issues or needs attention.

## Overall Security Result

| Result | Meaning |
|---|---|
| `FAIL` | Do not deploy. One or more `CRITICAL` or `HIGH` security issues are open. |
| `WARNING` | Review before deploy. Only `MEDIUM` or `LOW` security issues are open. |
| `PASS` | No active risky findings were detected by this scan. |

`PASS` does not prove the project is perfectly secure. It only means this scan did not detect active risky findings.

## Severity Model

| Severity | Meaning | Recommended Action | Priority |
|---|---|---|---:|
| `CRITICAL` | Confirmed dangerous issue, such as exposed production secret, malware signature, dangerous shell command, or credential-stealing pattern. | Stop release or deployment until fixed, rotated, or formally contained. | 1 |
| `HIGH` | Serious security risk that needs urgent fixing, such as hardcoded tokens, unsafe eval, or insecure auth logic. | Fix before deployment unless a security owner explicitly accepts the risk. | 2 |
| `MEDIUM` | Risky pattern that should be reviewed, such as weak validation, missing rate limiting, or suspicious dependency usage. | Review soon and schedule a fix or document why it is acceptable. | 3 |
| `LOW` | Minor security concern or best-practice warning. | Fix during normal hardening work. | 4 |
| `INFO` | Informational finding that is not directly dangerous. | Use as context; no urgent fix is required. | 5 |

## Status Model

| Status | Meaning |
|---|---|
| `OPEN` | Issue found and not fixed yet. |
| `NEEDS_REVIEW` | Issue may be valid but needs human confirmation. |
| `FALSE_POSITIVE` | Reviewed and confirmed safe. |
| `FIXED` | Issue has been fixed and was not found in the latest scan. |
| `IGNORED` | Accepted risk or intentionally skipped. |
| `REGRESSION` | Previously fixed issue appeared again. |

## Confidence Model

| Confidence | Meaning |
|---|---|
| `CONFIRMED` | Very likely real issue. |
| `LIKELY` | Strong suspicious signal. |
| `POSSIBLE` | Needs manual verification. |

Status describes lifecycle. Confidence describes certainty. Severity describes urgency.

## Categories

- `SECRETS`
- `MALWARE_PATTERN`
- `DANGEROUS_CODE`
- `DEPENDENCY_RISK`
- `AUTH_SECURITY`
- `INPUT_VALIDATION`
- `CONFIG_SECURITY`
- `FILE_UPLOAD_SECURITY`
- `LOGGING_SECURITY`
- `PERMISSION_RISK`
- `UNKNOWN`

## Detection Source Tracking

Every finding includes explicit scanner tracking fields:

| Field | Meaning |
|---|---|
| `detectedBy` | Human-readable scanner name that found the issue. |
| `scannerType` | Stable machine-readable scanner type. |

Common values:

| detectedBy | scannerType | Meaning |
|---|---|---|
| `Built-in Suspicious Code Scan` | `built-in` | Project-local pattern scanner from `suspicious-code-scan.js`. |
| `gitleaks` | `docker-gitleaks` | Docker-based secret scanner. |
| `Semgrep` | `docker-semgrep` | Docker-based static-analysis scanner. |
| `ClamAV` | `docker-clamav` | Docker-based malware scanner. |
| `npm audit` | `npm-audit` | Dependency vulnerability check. |
| `npm build` | `build-check` | Build verification. |

Use `detectedBy` to quickly understand which tool raised the issue.

## Finding ID Format

Finding IDs use:

```text
SEC-{CATEGORY}-{SEVERITY}-{HASH}
```

Example:

```text
SEC-SECRETS-CRITICAL-A91F3C
```

The hash is stable across reports and is based on category, file path, line number, rule ID, and finding title. This makes the same issue easy to track over time.

## Finding Tracker

The tracker lives at:

```text
scripts/security/reports/findings-tracker.json
```

It stores:

- Finding ID.
- Fingerprint.
- Severity.
- Status.
- Confidence.
- Category.
- First seen.
- Last seen.
- Occurrence count.
- Branch and commit.

## How Developers Should Fix Issues

Fix `CRITICAL` and `HIGH` findings first.

For secrets:

- Remove the secret from the repository.
- Revoke or rotate it immediately.
- Move the value into a secret manager or protected runtime environment.

For ClamAV malware findings:

- Stop deployment.
- Quarantine the file manually.
- Investigate how it entered the repository.
- Restore from trusted source.
- Rotate secrets if compromise is possible.

For dangerous code:

- Replace dynamic execution and shell-capable behavior with explicit safe code.
- Remove encoded payloads unless they are documented and reviewed.

For dependency risks:

- Inspect `npm audit` details.
- Upgrade or replace vulnerable packages manually.
- Do not run automatic fixes blindly on production projects.

For unclear findings:

- Review the evidence.
- Decide whether it is real, false positive, ignored risk, or fixed.
- Document the decision.

## How CTO/Admin Reviewers Should Read Reports

Start with:

1. Overall Security Result.
2. Total findings.
3. Critical and High counts.
4. Open and Regression counts.
5. Finding Details.

If the result is `FAIL`, deployment should stop until the high-risk findings are handled.

## Sample Finding

### SEC-SECRETS-CRITICAL-A91F3C

Severity: CRITICAL  
Status: OPEN  
Confidence: CONFIRMED  
Category: SECRETS  
File: `.env`  
Line: 12  
Rule: `hardcoded-aws-secret`

Why this matters:
AWS secret keys can allow attackers to access cloud resources.

Recommended fix:
Immediately revoke the leaked key, create a new one, and store it in a secure secret manager.
