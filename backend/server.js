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

function normalizeGender(value) {
  const normalizedValue = normalizeString(value).toLowerCase();

  if (!normalizedValue) {
    return "";
  }

  if (normalizedValue === "nu" || normalizedValue === "nữ") {
    return "Nữ";
  }

  if (normalizedValue === "nam") {
    return "Nam";
  }

  if (normalizedValue === "khac" || normalizedValue === "khác") {
    return "Khác";
  }

  return normalizeString(value);
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
    const error = new Error("Ban khong co quyen su dung chuc nang quan tri nay.");
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

async function parseJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const rawText = Buffer.concat(chunks).toString("utf8").trim();

  if (!rawText) {
    return {};
  }

  try {
    return JSON.parse(rawText);
  } catch (error) {
    const parseError = new Error("Noi dung gui len khong phai JSON hop le.");
    parseError.statusCode = 400;
    throw parseError;
  }
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

function getStudentHeaders(serviceRoleKey) {
  return buildSupabaseHeaders(serviceRoleKey);
}

function extractApiErrorMessage(payload) {
  if (!payload) {
    return "";
  }

  if (typeof payload === "string") {
    return payload;
  }

  return normalizeString(
    payload.msg ||
      payload.message ||
      payload.error_description ||
      payload.error ||
      JSON.stringify(payload),
  );
}

function isAlreadyExistsApiError(payload) {
  const message = extractApiErrorMessage(payload).toLowerCase();
  return (
    message.includes("already") ||
    message.includes("exists") ||
    message.includes("duplicate")
  );
}

function getDefaultStudentEmailDomain(env) {
  return (
    normalizeString(env.SETUP_DEFAULT_EMAIL_DOMAIN) ||
    normalizeString(env.SUPABASE_AUTH_IDENTITY_DOMAIN)
  );
}

function resolveStudentEmail(loginId, explicitEmail, env) {
  const normalizedEmail = normalizeString(explicitEmail);

  if (normalizedEmail) {
    return normalizedEmail;
  }

  const normalizedLoginId = normalizeString(loginId);
  const defaultDomain = getDefaultStudentEmailDomain(env);

  if (!normalizedLoginId || !defaultDomain) {
    return "";
  }

  return `${normalizedLoginId}@${defaultDomain}`;
}

function normalizeStudentProfileRow(row) {
  return {
    createdAt: normalizeString(row?.created_at || row?.createdAt),
    displayName: normalizeString(row?.display_name || row?.displayName),
    email: normalizeString(row?.email),
    id: normalizeString(row?.id),
    loginId: normalizeString(row?.login_id || row?.loginId),
    role: normalizeString(row?.role || "student") || "student",
    studentCourse: normalizeString(row?.student_course || row?.studentCourse),
    studentGender: normalizeString(row?.student_gender || row?.studentGender),
    studentId: normalizeString(row?.student_id || row?.studentId),
    studentName: normalizeString(row?.student_name || row?.studentName),
    updatedAt: normalizeString(row?.updated_at || row?.updatedAt),
    username: normalizeString(row?.username),
  };
}

function buildStudentMetadata(student) {
  return {
    display_name: student.displayName,
    login_id: student.loginId,
    role: "student",
    student_course: student.studentCourse,
    student_gender: student.studentGender,
    student_id: student.studentId,
    student_name: student.studentName,
  };
}

function buildStudentProfilePayload(student) {
  return {
    display_name: student.displayName,
    email: student.email,
    id: student.id,
    login_id: student.loginId,
    role: "student",
    student_course: student.studentCourse,
    student_gender: student.studentGender,
    student_id: student.studentId,
    student_name: student.studentName,
    username: student.username,
  };
}

function buildStudentInput(payload, env, options = {}) {
  const currentStudent = options.currentStudent || null;
  const loginId =
    normalizeString(payload?.loginId) ||
    normalizeString(payload?.studentId) ||
    normalizeString(currentStudent?.loginId) ||
    normalizeString(currentStudent?.studentId);
  const studentId =
    normalizeString(payload?.studentId) ||
    normalizeString(payload?.loginId) ||
    normalizeString(currentStudent?.studentId) ||
    normalizeString(currentStudent?.loginId);
  const studentName =
    normalizeString(payload?.studentName) ||
    normalizeString(payload?.displayName) ||
    normalizeString(currentStudent?.studentName) ||
    normalizeString(currentStudent?.displayName);
  const displayName =
    normalizeString(payload?.displayName) ||
    studentName ||
    normalizeString(currentStudent?.displayName);
  const studentCourse =
    normalizeString(payload?.studentCourse || payload?.course) ||
    normalizeString(currentStudent?.studentCourse);
  const studentGender = normalizeGender(
    payload?.studentGender || payload?.gender || currentStudent?.studentGender,
  );
  const email = resolveStudentEmail(
    loginId,
    payload?.email || currentStudent?.email,
    env,
  );
  const rawPassword = normalizeString(payload?.password);
  const defaultPassword = normalizeString(env.SETUP_DEFAULT_PASSWORD);
  const password =
    options.mode === "create" ? rawPassword || defaultPassword : rawPassword;
  const issues = [];

  if (!studentName) {
    issues.push("Vui long nhap ho ten sinh vien.");
  }

  if (!studentId) {
    issues.push("Vui long nhap MSSV.");
  }

  if (!loginId) {
    issues.push("Vui long nhap login ID.");
  }

  if (!email) {
    issues.push(
      "Khong the xac dinh email cho sinh vien. Hay nhap email hoac cau hinh domain mac dinh trong .env.",
    );
  }

  if (options.mode === "create" && !password) {
    issues.push(
      "Thieu mat khau tao tai khoan. Hay nhap password hoac cau hinh SETUP_DEFAULT_PASSWORD trong .env.",
    );
  }

  return {
    displayName,
    email,
    id: normalizeString(options.id || currentStudent?.id),
    issues,
    loginId,
    password,
    studentCourse,
    studentGender,
    studentId,
    studentName,
    username: loginId,
  };
}

async function fetchStudentProfiles(env, options = {}) {
  const requestUrl = new URL("/rest/v1/profiles", env.SUPABASE_URL);
  requestUrl.searchParams.set(
    "select",
    "id,email,login_id,role,display_name,student_id,student_name,student_course,student_gender,username,created_at,updated_at",
  );
  requestUrl.searchParams.set("role", "eq.student");
  requestUrl.searchParams.set("order", "student_id.asc");

  if (normalizeString(options.id)) {
    requestUrl.searchParams.set("id", `eq.${normalizeString(options.id)}`);
    requestUrl.searchParams.set("limit", "1");
  }

  const searchTerm = normalizeString(options.search);

  if (searchTerm) {
    requestUrl.searchParams.set(
      "or",
      `(student_id.ilike.*${searchTerm}*,student_name.ilike.*${searchTerm}*,login_id.ilike.*${searchTerm}*,email.ilike.*${searchTerm}*)`,
    );
  }

  const result = await requestJson(String(requestUrl), {
    headers: getStudentHeaders(env.SUPABASE_SERVICE_ROLE_KEY),
  });

  if (!result.ok || !Array.isArray(result.json)) {
    throw new Error(
      `Khong the tai danh sach sinh vien: ${extractApiErrorMessage(result.json)}`,
    );
  }

  return result.json.map((row) => normalizeStudentProfileRow(row));
}

async function getStudentProfileById(env, studentId) {
  const students = await fetchStudentProfiles(env, {
    id: studentId,
  });
  return students[0] || null;
}

async function ensureStudentFieldUnique(env, column, value, excludeId = "") {
  const normalizedValue = normalizeString(value);

  if (!normalizedValue) {
    return;
  }

  const requestUrl = new URL("/rest/v1/profiles", env.SUPABASE_URL);
  requestUrl.searchParams.set(
    "select",
    "id,role,student_id,student_name,login_id,email",
  );
  requestUrl.searchParams.set(column, `eq.${normalizedValue}`);
  requestUrl.searchParams.set("limit", "1");

  const result = await requestJson(String(requestUrl), {
    headers: getStudentHeaders(env.SUPABASE_SERVICE_ROLE_KEY),
  });

  if (!result.ok || !Array.isArray(result.json)) {
    throw new Error(
      `Khong the kiem tra trung du lieu sinh vien: ${extractApiErrorMessage(result.json)}`,
    );
  }

  const existing = result.json[0] || null;

  if (!existing || normalizeString(existing.id) === normalizeString(excludeId)) {
    return;
  }

  const labels = {
    email: "Email",
    login_id: "Login ID",
    student_id: "MSSV",
  };
  const error = new Error(`${labels[column] || column} da ton tai trong he thong.`);
  error.statusCode = 409;
  throw error;
}

async function createStudentAuthUser(env, student) {
  const result = await requestJson(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: getStudentHeaders(env.SUPABASE_SERVICE_ROLE_KEY),
    body: JSON.stringify({
      email: student.email,
      email_confirm: true,
      password: student.password,
      user_metadata: buildStudentMetadata(student),
    }),
  });

  if (!result.ok) {
    const message = isAlreadyExistsApiError(result.json)
      ? "Email nay da ton tai trong Supabase Auth."
      : `Khong the tao auth user sinh vien: ${extractApiErrorMessage(result.json)}`;
    const error = new Error(message);
    error.statusCode = isAlreadyExistsApiError(result.json) ? 409 : 500;
    throw error;
  }

  return normalizeString(result.json?.id);
}

async function createStudentProfile(env, student) {
  const existingProfile = await getStudentProfileById(env, student.id);

  if (existingProfile) {
    return syncStudentProfile(env, student);
  }

  const result = await requestJson(`${env.SUPABASE_URL}/rest/v1/profiles`, {
    method: "POST",
    headers: {
      ...getStudentHeaders(env.SUPABASE_SERVICE_ROLE_KEY),
      Prefer: "return=representation",
    },
    body: JSON.stringify(buildStudentProfilePayload(student)),
  });

  if (!result.ok || !Array.isArray(result.json) || !result.json[0]) {
    throw new Error(
      `Khong the tao profile sinh vien: ${extractApiErrorMessage(result.json)}`,
    );
  }

  return normalizeStudentProfileRow(result.json[0]);
}

async function deleteStudentAuthUser(env, studentId) {
  const result = await requestJson(
    `${env.SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(studentId)}`,
    {
      method: "DELETE",
      headers: getStudentHeaders(env.SUPABASE_SERVICE_ROLE_KEY),
    },
  );

  if (!result.ok) {
    throw new Error(
      `Khong the xoa tai khoan Auth cua sinh vien: ${extractApiErrorMessage(result.json)}`,
    );
  }
}

async function updateStudentAuthUser(env, student, options = {}) {
  const payload = {
    email: student.email,
    email_confirm: true,
    user_metadata: buildStudentMetadata(student),
  };

  if (normalizeString(options.password || student.password)) {
    payload.password = normalizeString(options.password || student.password);
  }

  const result = await requestJson(
    `${env.SUPABASE_URL}/auth/v1/admin/users/${student.id}`,
    {
      method: "PUT",
      headers: getStudentHeaders(env.SUPABASE_SERVICE_ROLE_KEY),
      body: JSON.stringify(payload),
    },
  );

  if (!result.ok) {
    const message = isAlreadyExistsApiError(result.json)
      ? "Email nay da ton tai trong Supabase Auth."
      : `Khong the cap nhat auth user sinh vien: ${extractApiErrorMessage(result.json)}`;
    const error = new Error(message);
    error.statusCode = isAlreadyExistsApiError(result.json) ? 409 : 500;
    throw error;
  }
}

async function syncStudentProfile(env, student) {
  const requestUrl = new URL("/rest/v1/profiles", env.SUPABASE_URL);
  requestUrl.searchParams.set("id", `eq.${student.id}`);

  const result = await requestJson(String(requestUrl), {
    method: "PATCH",
    headers: {
      ...getStudentHeaders(env.SUPABASE_SERVICE_ROLE_KEY),
      Prefer: "return=representation",
    },
    body: JSON.stringify(buildStudentProfilePayload(student)),
  });

  if (!result.ok || !Array.isArray(result.json) || !result.json[0]) {
    throw new Error(
      `Khong the cap nhat profile sinh vien: ${extractApiErrorMessage(result.json)}`,
    );
  }

  return normalizeStudentProfileRow(result.json[0]);
}

async function syncStudentRegistrations(env, previousStudent, nextStudent) {
  const previousStudentId = normalizeString(previousStudent?.studentId);

  if (!previousStudentId) {
    return;
  }

  const requestUrl = new URL("/rest/v1/registrations", env.SUPABASE_URL);
  requestUrl.searchParams.set("student_id", `eq.${previousStudentId}`);

  const result = await requestJson(String(requestUrl), {
    method: "PATCH",
    headers: {
      ...getStudentHeaders(env.SUPABASE_SERVICE_ROLE_KEY),
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      student_course: nextStudent.studentCourse,
      student_gender: nextStudent.studentGender,
      student_id: nextStudent.studentId,
      student_name: nextStudent.studentName,
    }),
  });

  if (!result.ok) {
    throw new Error(
      `Khong the dong bo lich su dang ky cua sinh vien: ${extractApiErrorMessage(result.json)}`,
    );
  }
}

async function listAdminStudents(request, response) {
  try {
    const { env } = await verifyAdminRequest(request);
    const requestUrl = new URL(
      request.url || "/api/admin/students",
      `http://${request.headers.host || "localhost"}`,
    );
    const search = normalizeString(requestUrl.searchParams.get("search"));
    const students = await fetchStudentProfiles(env, { search });

    sendJson(response, 200, {
      ok: true,
      students,
    });
  } catch (error) {
    console.error("Khong the tai danh sach sinh vien.", error);
    sendJson(response, error.statusCode || 500, {
      ok: false,
      message: error.message || "Khong the tai danh sach sinh vien luc nay.",
    });
  }
}

async function createAdminStudent(request, response) {
  let env = null;
  let createdAuthUserId = "";

  try {
    ({ env } = await verifyAdminRequest(request));
    const payload = await parseJsonBody(request);
    const student = buildStudentInput(payload, env, {
      mode: "create",
    });

    if (student.issues.length > 0) {
      sendJson(response, 400, {
        ok: false,
        message: student.issues.join(" "),
      });
      return;
    }

    await ensureStudentFieldUnique(env, "email", student.email);
    await ensureStudentFieldUnique(env, "login_id", student.loginId);
    await ensureStudentFieldUnique(env, "student_id", student.studentId);

    student.id = await createStudentAuthUser(env, student);
    createdAuthUserId = student.id;
    const createdStudent = await createStudentProfile(env, student);

    sendJson(response, 201, {
      ok: true,
      message: "Tao tai khoan sinh vien thanh cong.",
      student: createdStudent,
    });
  } catch (error) {
    if (env && createdAuthUserId) {
      try {
        await deleteStudentAuthUser(env, createdAuthUserId);
      } catch (cleanupError) {
        console.error(
          "Khong the rollback auth user sinh vien sau khi tao that bai.",
          cleanupError,
        );
      }
    }

    console.error("Khong the tao sinh vien.", error);
    sendJson(response, error.statusCode || 500, {
      ok: false,
      message: error.message || "Khong the tao tai khoan sinh vien luc nay.",
    });
  }
}

async function updateAdminStudent(request, response, studentId) {
  try {
    const { env } = await verifyAdminRequest(request);
    const existingStudent = await getStudentProfileById(env, studentId);

    if (!existingStudent) {
      sendJson(response, 404, {
        ok: false,
        message: "Khong tim thay sinh vien can cap nhat.",
      });
      return;
    }

    const payload = await parseJsonBody(request);
    const nextStudent = buildStudentInput(payload, env, {
      currentStudent: existingStudent,
      id: studentId,
      mode: "update",
    });

    if (nextStudent.issues.length > 0) {
      sendJson(response, 400, {
        ok: false,
        message: nextStudent.issues.join(" "),
      });
      return;
    }

    await ensureStudentFieldUnique(env, "email", nextStudent.email, studentId);
    await ensureStudentFieldUnique(env, "login_id", nextStudent.loginId, studentId);
    await ensureStudentFieldUnique(env, "student_id", nextStudent.studentId, studentId);

    await updateStudentAuthUser(env, nextStudent, {
      password: normalizeString(payload?.password),
    });
    await syncStudentRegistrations(env, existingStudent, nextStudent);
    const updatedStudent = await syncStudentProfile(env, nextStudent);

    sendJson(response, 200, {
      ok: true,
      message: "Cap nhat sinh vien thanh cong.",
      student: updatedStudent,
    });
  } catch (error) {
    console.error("Khong the cap nhat sinh vien.", error);
    sendJson(response, error.statusCode || 500, {
      ok: false,
      message: error.message || "Khong the cap nhat sinh vien luc nay.",
    });
  }
}

async function deleteAdminStudent(request, response, studentId) {
  try {
    const { env } = await verifyAdminRequest(request);
    const existingStudent = await getStudentProfileById(env, studentId);

    if (!existingStudent) {
      sendJson(response, 404, {
        ok: false,
        message: "Khong tim thay sinh vien can xoa.",
      });
      return;
    }

    await deleteStudentAuthUser(env, studentId);

    sendJson(response, 200, {
      ok: true,
      message: "Da xoa tai khoan sinh vien. Lich su dang ky se duoc giu lai trong he thong.",
      student: existingStudent,
    });
  } catch (error) {
    console.error("Khong the xoa sinh vien.", error);
    sendJson(response, error.statusCode || 500, {
      ok: false,
      message: error.message || "Khong the xoa sinh vien luc nay.",
    });
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

    if (request.method === "GET" && requestUrl.pathname === "/api/admin/students") {
      listAdminStudents(request, response);
      return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/api/admin/students") {
      createAdminStudent(request, response);
      return;
    }

    if (requestUrl.pathname.startsWith("/api/admin/students/")) {
      const studentId = normalizeString(
        decodeURIComponent(requestUrl.pathname.split("/").pop() || ""),
      );

      if (!studentId) {
        sendJson(response, 400, {
          ok: false,
          message: "Thieu id sinh vien can thao tac.",
        });
        return;
      }

      if (request.method === "PUT") {
        updateAdminStudent(request, response, studentId);
        return;
      }

      if (request.method === "DELETE") {
        deleteAdminStudent(request, response, studentId);
        return;
      }
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
