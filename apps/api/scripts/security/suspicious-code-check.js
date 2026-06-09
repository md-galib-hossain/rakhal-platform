const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();

const SCAN_EXTENSIONS = [".js", ".ts", ".jsx", ".tsx", ".mjs", ".cjs"];

const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
]);

const SUSPICIOUS_PATTERNS = [
  /global\s*\[/,
  /String\.fromCharCode/,
  /new\s+Function\s*\(/,
  /\beval\s*\(/,
  /child_process/,
  /require\s*\(\s*["']child_process["']\s*\)/,
  /powershell/i,
  /cmd\.exe/i,
  /curl\s+/i,
  /wget\s+/i,
  /Invoke-WebRequest/i,
  /Buffer\.from\s*\([^)]*base64/i,
  /atob\s*\(/,
  /setTimeout\s*\(\s*["'`]/,
  /setInterval\s*\(\s*["'`]/,
];

const STRICT_CONFIG_FILES = new Set([
  "postcss.config.js",
  "tailwind.config.js",
  "next.config.js",
  "vite.config.js",
  "webpack.config.js",
]);

let failed = false;

function walk(dir) {
  for (const item of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (!IGNORE_DIRS.has(item)) walk(fullPath);
      continue;
    }

    if (!SCAN_EXTENSIONS.includes(path.extname(item))) continue;

    scanFile(fullPath);
  }
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const relative = path.relative(ROOT, filePath);

  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(content)) {
      failed = true;
      console.log(`❌ Suspicious pattern found`);
      console.log(`File: ${relative}`);
      console.log(`Pattern: ${pattern}`);
      console.log("");
    }
  }

  if (STRICT_CONFIG_FILES.has(path.basename(filePath))) {
    const lineCount = content.split("\n").length;

    if (lineCount > 80) {
      failed = true;
      console.log(`❌ Config file is unusually large`);
      console.log(`File: ${relative}`);
      console.log(`Lines: ${lineCount}`);
      console.log("");
    }
  }
}

walk(ROOT);

if (failed) {
  console.error("SECURITY CHECK FAILED - DO NOT DEPLOY");
  process.exit(1);
}

console.log("Suspicious code check passed.");