const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const fsp = require("node:fs/promises");
const { readEnv } = require("./config/env-loader.cjs");
const {
  buildImportPlan,
  importStudentAccounts,
} = require("./tools/student-import/index.js");

const REPO_ROOT = path.resolve(__dirname, "..");
const DEFAULT_PORT = Number(process.env.PORT || 3000);
const MAX_IMPORT_FILE_SIZE_BYTES = 15 * 1024 * 1024;

const CONTENT_TYPES = {
  ".csv": "text/csv; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const rawText = await response.text();

  let json = null;
  try {
    json = rawText ? JSON.parse(rawText) : null;
  } catch (error) {
    json = rawText;
  }

  return {
    ok: response.ok,
    status: response.status,
    json,
  };
}

function buildPublicEnv(env) {
  return Object.keys(env).reduce((result, key) => {
    if (!key.startsWith("SUPABASE_")) {
      return result;
    }

    if (key === "SUPABASE_SERVICE_ROLE_KEY") {
      return result;
    }

    result[key] = env[key];
    return result;
  }, {});
}

async function fetchPublicEvents() {
  const env = readEnv();
  const url = env.SUPABASE_URL;
  const anonKey = env.SUPABASE_ANON_KEY;
  const tableName = env.SUPABASE_TABLE_EVENTS || "events";

  if (!url || !anonKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env");
  }

  const result = await requestJson(
    `${url}/rest/v1/${tableName}?select=*&order=start.asc`,
    {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (!result.ok) {
    throw new Error(
      `Supabase events request failed: ${JSON.stringify(result.json)}`,
    );
  }

  return Array.isArray(result.json) ? result.json : [];
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseBoolean(value) {
  const normalizedValue = normalizeString(String(value || "")).toLowerCase();
  return normalizedValue === "true" || normalizedValue === "1" || normalizedValue === "yes";
}

function getBearerToken(request) {
  const authHeader = normalizeString(request.headers.authorization);

  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return normalizeString(authHeader.slice(7));
}

function buildSupabaseHeaders(apiKey, accessToken = apiKey) {
  return {
    apikey: apiKey,
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

async function verifyAdminRequest(request) {
  const env = readEnv();
  const accessToken = getBearerToken(request);

  if (!accessToken) {
    const error = new Error("Thieu access token. Vui long dang nhap lai bang tai khoan admin.");
    error.statusCode = 401;
    throw error;
  }

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    const error = new Error(
      "Backend chua duoc cau hinh SUPABASE_URL hoac SUPABASE_SERVICE_ROLE_KEY trong .env.",
    );
    error.statusCode = 500;
    throw error;
  }

  const publicApiKey = env.SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  const currentUserResult = await requestJson(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: buildSupabaseHeaders(publicApiKey, accessToken),
  });

  if (!currentUserResult.ok || !currentUserResult.json?.id) {
    const error = new Error(
      "Khong xac thuc duoc phien dang nhap hien tai. Vui long dang nhap lai.",
    );
    error.statusCode = 401;
    throw error;
  }

  const userId = currentUserResult.json.id;
  const profileResult = await requestJson(
    `${env.SUPABASE_URL}/rest/v1/profiles?select=id,role,display_name,login_id,email&id=eq.${encodeURIComponent(userId)}&limit=1`,
    {
      headers: buildSupabaseHeaders(env.SUPABASE_SERVICE_ROLE_KEY),
    },
  );

  if (!profileResult.ok || !Array.isArray(profileResult.json)) {
    const error = new Error("Khong the tai thong tin phan quyen admin hien tai.");
    error.statusCode = 500;
    throw error;
  }

  const profile = profileResult.json[0] || null;

  if (normalizeString(profile?.role).toLowerCase() !== "admin") {
    const error = new Error("Ban khong co quyen su dung chuc nang import sinh vien.");
    error.statusCode = 403;
    throw error;
  }

  return {
    env,
    profile,
    user: currentUserResult.json,
  };
}

async function parseMultipartForm(request) {
  const wrappedRequest = new Request("http://localhost/upload", {
    method: request.method || "POST",
    headers: request.headers,
    body: request,
    duplex: "half",
  });

  return wrappedRequest.formData();
}

function toImportPreview(record) {
  return {
    course: record.course,
    email: record.email,
    gender: record.gender,
    loginId: record.loginId,
    role: record.role,
    rowNumber: record.rowNumber,
    studentId: record.studentId,
    studentName: record.studentName,
  };
}

async function withUploadedTempFile(file, callback) {
  const originalFileName = normalizeString(file?.name);
  const extension = path.extname(originalFileName).toLowerCase();

  if (![".xlsx", ".csv"].includes(extension)) {
    const error = new Error(
      "Chi ho tro file .xlsx hoac .csv. Neu ban dang co .xls, hay luu lai thanh .xlsx.",
    );
    error.statusCode = 400;
    throw error;
  }

  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), "vuyp-student-import-"));
  const tempFilePath = path.join(tempDir, `upload${extension}`);

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    await fsp.writeFile(tempFilePath, bytes);
    return await callback(tempFilePath);
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function handleAdminStudentImport(request, response) {
  try {
    const contentLength = Number(request.headers["content-length"] || 0);

    if (
      Number.isFinite(contentLength) &&
      contentLength > MAX_IMPORT_FILE_SIZE_BYTES + 1024 * 64
    ) {
      sendJson(response, 413, {
        ok: false,
        message: "File import qua lon. Vui long chia nho file hoac chi upload toi da 15MB.",
      });
      return;
    }

    const { env, profile } = await verifyAdminRequest(request);
    const formData = await parseMultipartForm(request);
    const uploadedFile = formData.get("file");
    const sheetName = normalizeString(formData.get("sheetName"));
    const dryRun = parseBoolean(formData.get("dryRun"));
    const keepPassword = parseBoolean(formData.get("keepPassword"));

    if (!uploadedFile || typeof uploadedFile.arrayBuffer !== "function") {
      sendJson(response, 400, {
        ok: false,
        message: "Vui long chon mot file Excel hoac CSV de import.",
      });
      return;
    }

    if (Number(uploadedFile.size || 0) > MAX_IMPORT_FILE_SIZE_BYTES) {
      sendJson(response, 413, {
        ok: false,
        message: "File import qua lon. Vui long chi upload toi da 15MB.",
      });
      return;
    }

    const fileName = normalizeString(uploadedFile.name);

    const payload = await withUploadedTempFile(uploadedFile, async (tempFilePath) => {
      const plan = await buildImportPlan({
        env,
        filePath: tempFilePath,
        keepPassword,
        sheetName,
      });

      if (dryRun || plan.issues.length > 0) {
        return {
          dryRun: true,
          fileName,
          issues: plan.issues,
          ok: plan.issues.length === 0,
          preview: plan.records.slice(0, 10).map(toImportPreview),
          summary: {
            filePath: fileName,
            rawRowCount: plan.rawRowCount,
            recordCount: plan.records.length,
            sheetName: plan.sheetName,
          },
        };
      }

      const result = await importStudentAccounts({
        env,
        keepPassword,
        plan,
      });

      return {
        dryRun: false,
        fileName,
        failures: result.failures,
        ok: result.summary.failed === 0,
        preview: result.records.slice(0, 10).map(toImportPreview),
        summary: {
          ...result.summary,
          sheetName: result.sheetName,
        },
      };
    });

    sendJson(response, 200, {
      ...payload,
      actor: {
        displayName: profile.display_name || "Quản trị viên",
        loginId: profile.login_id || profile.email || profile.id,
      },
    });
  } catch (error) {
    console.error("Khong the import danh sach sinh vien.", error);
    sendJson(response, error.statusCode || 500, {
      ok: false,
      message: error.message || "Khong the import danh sach sinh vien luc nay.",
    });
  }
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, text) {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
  });
  response.end(text);
}

function safeResolvePath(urlPathname) {
  const normalizedPath = decodeURIComponent(urlPathname.split("?")[0] || "/");
  const requestPath = normalizedPath === "/" ? "/index.html" : normalizedPath;
  const absolutePath = path.resolve(REPO_ROOT, `.${requestPath}`);

  if (!absolutePath.startsWith(REPO_ROOT)) {
    return "";
  }

  return absolutePath;
}

function serveStaticFile(response, absolutePath) {
  try {
    let targetPath = absolutePath;
    const stats = fs.existsSync(targetPath) ? fs.statSync(targetPath) : null;

    if (stats?.isDirectory()) {
      targetPath = path.join(targetPath, "index.html");
    }

    if (!fs.existsSync(targetPath) || !fs.statSync(targetPath).isFile()) {
      sendText(response, 404, "Not found");
      return;
    }

    const extension = path.extname(targetPath).toLowerCase();
    const contentType =
      CONTENT_TYPES[extension] || "application/octet-stream";

    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": contentType,
    });
    fs.createReadStream(targetPath).pipe(response);
  } catch (error) {
    console.error("Khong the phuc vu file tinh.", error);
    sendText(response, 500, "Internal server error");
  }
}

function createServer() {
  return http.createServer((request, response) => {
    const requestUrl = new URL(
      request.url || "/",
      `http://${request.headers.host || "localhost"}`,
    );

    if (requestUrl.pathname === "/app-env.json") {
      sendJson(response, 200, buildPublicEnv(readEnv()));
      return;
    }

    if (requestUrl.pathname === "/health" || requestUrl.pathname === "/api/health") {
      sendJson(response, 200, {
        name: "Vuyp-AGILE backend",
        status: "ok",
        message:
          "Backend dang serve frontend va runtime config. Cac thao tac Supabase nam trong backend/scripts/supabase.",
      });
      return;
    }

    if (requestUrl.pathname === "/api/events") {
      fetchPublicEvents()
        .then((events) => {
          sendJson(response, 200, {
            ok: true,
            events,
          });
        })
        .catch((error) => {
          console.error("Khong the tai danh sach su kien cong khai.", error);
          sendJson(response, 500, {
            ok: false,
            message: error.message || "Khong the tai su kien cong khai.",
          });
        });
      return;
    }

    if (
      request.method === "POST" &&
      requestUrl.pathname === "/api/admin/import/students"
    ) {
      handleAdminStudentImport(request, response);
      return;
    }

    const absolutePath = safeResolvePath(requestUrl.pathname);

    if (!absolutePath) {
      sendText(response, 400, "Invalid path");
      return;
    }

    serveStaticFile(response, absolutePath);
  });
}

function startServer(port = DEFAULT_PORT) {
  const server = createServer();
  server.listen(port, () => {
    console.log(`Vuyp-AGILE runtime dang chay tai http://localhost:${port}`);
  });
  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = {
  createServer,
  startServer,
};
