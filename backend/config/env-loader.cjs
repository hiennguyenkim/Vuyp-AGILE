const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..", "..");

function parseEnvText(text) {
  return String(text || "")
    .split(/\r?\n/)
    .reduce((result, line) => {
      const trimmedLine = line.trim();

      if (!trimmedLine || trimmedLine.startsWith("#")) {
        return result;
      }

      const separatorIndex = trimmedLine.indexOf("=");
      if (separatorIndex === -1) {
        return result;
      }

      const key = trimmedLine.slice(0, separatorIndex).trim();
      const value = trimmedLine.slice(separatorIndex + 1).trim();

      if (key) {
        result[key] = value;
      }

      return result;
    }, {});
}

function readEnvFile(filename) {
  const envCandidates = [
    path.resolve(process.cwd(), filename),
    path.resolve(REPO_ROOT, filename),
  ];

  for (const envPath of envCandidates) {
    if (fs.existsSync(envPath)) {
      return parseEnvText(fs.readFileSync(envPath, "utf8"));
    }
  }

  return {};
}

function readEnv() {
  return readEnvFile(".env");
}

function requireEnv(env, keys) {
  const missingKeys = keys.filter((key) => !String(env[key] || "").trim());

  if (missingKeys.length > 0) {
    console.error(
      `Thieu bien moi truong: ${missingKeys.join(", ")}. Hay cap nhat .env.`,
    );
    process.exit(1);
  }
}

module.exports = {
  readEnv,
  requireEnv,
};
