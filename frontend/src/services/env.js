function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseEnvValue(value) {
  const normalizedValue = normalizeString(value);

  if (
    (normalizedValue.startsWith('"') && normalizedValue.endsWith('"')) ||
    (normalizedValue.startsWith("'") && normalizedValue.endsWith("'"))
  ) {
    return normalizedValue.slice(1, -1).replace(/\\n/g, "\n");
  }

  return normalizedValue.replace(/\\n/g, "\n");
}

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
      const value = parseEnvValue(trimmedLine.slice(separatorIndex + 1));

      if (key) {
        result[key] = value;
      }

      return result;
    }, {});
}

async function fetchEnvFile(url) {
  try {
    const response = await fetch(url, {
      cache: "no-store",
    });

    if (!response.ok) {
      return {};
    }

    return parseEnvText(await response.text());
  } catch (error) {
    return {};
  }
}

async function fetchEnvJson(url) {
  try {
    const response = await fetch(url, {
      cache: "no-store",
    });

    if (!response.ok) {
      return {};
    }

    const json = await response.json();
    return isPlainObject(json) ? json : {};
  } catch (error) {
    return {};
  }
}

function createDiagnostics() {
  return {
    attemptedUrls: [],
    hasWindowEnv: false,
    loadedFrom: "",
  };
}

let envPromise = null;

export async function loadAppEnv() {
  if (envPromise) {
    return envPromise;
  }

  envPromise = (async () => {
    const diagnostics = createDiagnostics();
    const envJsonCandidates = [
      new URL("../../../app-env.json", import.meta.url),
      new URL("/app-env.json", window.location.href),
    ];
    const envFileCandidates = [
      new URL("../../../.env", import.meta.url),
      new URL("/.env", window.location.href),
    ];
    const windowEnv = isPlainObject(window.__APP_ENV__) ? window.__APP_ENV__ : {};
    diagnostics.hasWindowEnv = Object.keys(windowEnv).length > 0;

    for (const candidate of envJsonCandidates) {
      diagnostics.attemptedUrls.push(String(candidate));
      const jsonEnv = await fetchEnvJson(candidate);
      if (Object.keys(jsonEnv).length > 0) {
        diagnostics.loadedFrom = String(candidate);
        window.ClubEnvDiagnostics = diagnostics;
        return {
          ...jsonEnv,
          ...windowEnv,
        };
      }
    }

    for (const candidate of envFileCandidates) {
      diagnostics.attemptedUrls.push(String(candidate));
      const fileEnv = await fetchEnvFile(candidate);
      if (Object.keys(fileEnv).length > 0) {
        diagnostics.loadedFrom = String(candidate);
        window.ClubEnvDiagnostics = diagnostics;
        return {
          ...fileEnv,
          ...windowEnv,
        };
      }
    }

    diagnostics.loadedFrom = diagnostics.hasWindowEnv ? "window.__APP_ENV__" : "none";
    window.ClubEnvDiagnostics = diagnostics;
    return windowEnv;
  })();

  return envPromise;
}

export const APP_ENV = await loadAppEnv();

export function getEnvValue(key, fallback = "") {
  const value = APP_ENV[key];
  return normalizeString(value) || fallback;
}

export function getEnvList(key, fallback = []) {
  const rawValue = getEnvValue(key, "");
  return rawValue
    ? rawValue.split(",").map((item) => item.trim()).filter(Boolean)
    : [...fallback];
}

export function getEnvJson(key, fallback) {
  const rawValue = getEnvValue(key, "");

  if (!rawValue) {
    return fallback;
  }

  try {
    return JSON.parse(rawValue);
  } catch (error) {
    console.warn(`Khong the parse JSON cho bien moi truong ${key}.`, error);
    return fallback;
  }
}

window.ClubAppEnv = APP_ENV;
