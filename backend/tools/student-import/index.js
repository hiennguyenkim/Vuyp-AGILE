const fs = require("node:fs");
const path = require("node:path");
const ExcelJS = require("exceljs");
const { readEnv } = require("../../config/env-loader.cjs");

const HEADER_ALIASES = {
  studentId: [
    "mssv",
    "student_id",
    "studentid",
    "ma_sv",
    "masv",
    "ma_sinh_vien",
    "masinhvien",
  ],
  loginId: [
    "login_id",
    "loginid",
    "username",
    "user_name",
    "tai_khoan",
    "taikhoan",
    "account",
    "account_id",
  ],
  name: [
    "name",
    "student_name",
    "studentname",
    "ho_ten",
    "hoten",
    "ho_va_ten",
    "hovaten",
    "full_name",
    "fullname",
    "display_name",
    "displayname",
    "ten",
  ],
  displayName: ["display_name", "displayname"],
  gender: ["gender", "gioi_tinh", "gioitinh", "sex"],
  course: ["course", "khoa", "student_course", "studentcourse", "cohort", "lop"],
  email: ["email", "mail"],
  password: ["password", "mat_khau", "matkhau", "pass"],
  role: ["role", "vai_tro", "vaitro"],
  username: ["username", "user_name"],
};

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeHeader(value) {
  return normalizeString(String(value || ""))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getFieldValue(rawRow, fieldName) {
  const aliases = HEADER_ALIASES[fieldName] || [];

  for (const alias of aliases) {
    if (normalizeString(rawRow[alias])) {
      return normalizeString(rawRow[alias]);
    }
  }

  return "";
}

function normalizeRole(value) {
  return normalizeString(value).toLowerCase() === "admin" ? "admin" : "student";
}

function normalizeGender(value) {
  const normalizedValue = normalizeHeader(value).replaceAll("_", "");

  if (!normalizedValue) {
    return "";
  }

  if (normalizedValue === "nu") {
    return "Nữ";
  }

  if (normalizedValue === "nam") {
    return "Nam";
  }

  if (normalizedValue === "khac") {
    return "Khác";
  }

  return normalizeString(value);
}

function buildDefaultConfig(env, overrides = {}) {
  const defaultPassword =
    normalizeString(overrides.defaultPassword) ||
    normalizeString(env.SETUP_DEFAULT_PASSWORD);

  return {
    defaultEmailDomain:
      normalizeString(overrides.defaultEmailDomain) ||
      normalizeString(env.SETUP_DEFAULT_EMAIL_DOMAIN) ||
      normalizeString(env.SUPABASE_AUTH_IDENTITY_DOMAIN),
    defaultPassword,
    defaultAdminPassword:
      normalizeString(overrides.defaultAdminPassword) ||
      normalizeString(env.SETUP_DEFAULT_ADMIN_PASSWORD) ||
      defaultPassword,
    keepPassword: Boolean(overrides.keepPassword),
    limit: Number.isFinite(Number(overrides.limit))
      ? Math.max(1, Number(overrides.limit))
      : Number.POSITIVE_INFINITY,
    delayMs: Number.isFinite(Number(overrides.delayMs))
      ? Math.max(0, Number(overrides.delayMs))
      : 200,
  };
}

function assertRequiredEnv(env, keys) {
  const missingKeys = keys.filter((key) => !normalizeString(env[key]));

  if (missingKeys.length > 0) {
    throw new Error(
      `Thieu bien moi truong: ${missingKeys.join(", ")}. Hay cap nhat .env truoc khi import.`,
    );
  }
}

function getCellText(cell) {
  if (!cell) {
    return "";
  }

  if (typeof cell.text === "string" && cell.text.trim()) {
    return cell.text.trim();
  }

  const { value } = cell;

  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value === "object") {
    if (Array.isArray(value.richText)) {
      return value.richText.map((item) => item?.text || "").join("").trim();
    }

    if (value.text) {
      return normalizeString(value.text);
    }

    if (value.result !== undefined && value.result !== null) {
      return normalizeString(String(value.result));
    }

    if (value.hyperlink) {
      return normalizeString(String(value.hyperlink));
    }
  }

  return normalizeString(String(value));
}

async function loadWorksheet(filePath, sheetName = "") {
  const resolvedPath = path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Khong tim thay file du lieu: ${resolvedPath}`);
  }

  const extension = path.extname(resolvedPath).toLowerCase();
  const workbook = new ExcelJS.Workbook();

  if (extension === ".xlsx") {
    await workbook.xlsx.readFile(resolvedPath);
  } else if (extension === ".csv") {
    await workbook.csv.readFile(resolvedPath);
  } else {
    throw new Error(
      "Tool hien chi ho tro .xlsx va .csv. Neu file cua ban la .xls, hay luu lai thanh .xlsx.",
    );
  }

  const worksheet = sheetName
    ? workbook.getWorksheet(sheetName)
    : workbook.worksheets[0];

  if (!worksheet) {
    throw new Error(
      sheetName
        ? `Khong tim thay worksheet '${sheetName}' trong file Excel.`
        : "Workbook khong co worksheet nao de doc.",
    );
  }

  return {
    extension,
    resolvedPath,
    worksheet,
  };
}

function extractRawRows(worksheet) {
  const headerRow = worksheet.getRow(1);
  const headerMap = new Map();

  for (let columnNumber = 1; columnNumber <= headerRow.cellCount; columnNumber += 1) {
    const normalizedHeader = normalizeHeader(
      getCellText(headerRow.getCell(columnNumber)),
    );

    if (normalizedHeader) {
      headerMap.set(columnNumber, normalizedHeader);
    }
  }

  if (headerMap.size === 0) {
    throw new Error(
      "Khong doc duoc dong tieu de. Hay dam bao dong dau tien cua file la ten cot.",
    );
  }

  const rawRows = [];

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const rawRow = {
      __rowNumber: rowNumber,
    };
    let hasValue = false;

    for (const [columnNumber, headerName] of headerMap.entries()) {
      const cellValue = getCellText(row.getCell(columnNumber));

      if (!cellValue) {
        continue;
      }

      rawRow[headerName] = cellValue;
      hasValue = true;
    }

    if (hasValue) {
      rawRows.push(rawRow);
    }
  }

  return rawRows;
}

function resolveEmail(loginId, explicitEmail, defaultEmailDomain) {
  const normalizedEmail = normalizeString(explicitEmail);

  if (normalizedEmail) {
    return normalizedEmail;
  }

  const normalizedLoginId = normalizeString(loginId);
  const normalizedDomain = normalizeString(defaultEmailDomain);

  if (!normalizedLoginId || !normalizedDomain) {
    return "";
  }

  return `${normalizedLoginId}@${normalizedDomain}`;
}

function resolveDefaultPassword(role, defaults) {
  return role === "admin"
    ? normalizeString(defaults.defaultAdminPassword) ||
        normalizeString(defaults.defaultPassword)
    : normalizeString(defaults.defaultPassword);
}

function getMissingPasswordHint(role) {
  return role === "admin"
    ? "SETUP_DEFAULT_ADMIN_PASSWORD hoac SETUP_DEFAULT_PASSWORD"
    : "SETUP_DEFAULT_PASSWORD";
}

function normalizeSpreadsheetRow(rawRow, defaults) {
  const studentId =
    getFieldValue(rawRow, "studentId") ||
    getFieldValue(rawRow, "loginId") ||
    getFieldValue(rawRow, "username");
  const loginId =
    getFieldValue(rawRow, "loginId") ||
    getFieldValue(rawRow, "studentId") ||
    getFieldValue(rawRow, "username");
  const name =
    getFieldValue(rawRow, "name") ||
    getFieldValue(rawRow, "displayName") ||
    loginId;
  const displayName = getFieldValue(rawRow, "displayName") || name;
  const role = normalizeRole(getFieldValue(rawRow, "role"));
  const gender = normalizeGender(getFieldValue(rawRow, "gender"));
  const course = getFieldValue(rawRow, "course");
  const email = resolveEmail(
    loginId,
    getFieldValue(rawRow, "email"),
    defaults.defaultEmailDomain,
  );
  const password =
    getFieldValue(rawRow, "password") || resolveDefaultPassword(role, defaults);

  return {
    rowNumber: rawRow.__rowNumber,
    studentId,
    loginId,
    username: getFieldValue(rawRow, "username") || loginId,
    studentName: name,
    displayName,
    gender,
    course,
    email,
    password,
    role,
    source: rawRow,
  };
}

function collectDuplicateValues(records, key) {
  const seen = new Map();
  const duplicates = new Map();

  records.forEach((record) => {
    const rawValue = normalizeString(record[key]);

    if (!rawValue) {
      return;
    }

    const lookupKey =
      key === "email" ? rawValue.toLowerCase() : rawValue.toLowerCase();
    const previousRow = seen.get(lookupKey);

    if (!previousRow) {
      seen.set(lookupKey, record.rowNumber);
      return;
    }

    const duplicateRows = duplicates.get(rawValue) || [previousRow];
    duplicateRows.push(record.rowNumber);
    duplicates.set(rawValue, duplicateRows);
  });

  return duplicates;
}

function validatePreparedRecords(records, defaults) {
  const issues = [];

  records.forEach((record) => {
    if (!record.loginId) {
      issues.push(`Dong ${record.rowNumber}: thieu login_id/MSSV.`);
    }

    if (!record.studentName) {
      issues.push(`Dong ${record.rowNumber}: thieu ho ten.`);
    }

    if (!record.email) {
      issues.push(
        `Dong ${record.rowNumber}: thieu email va cung khong co default email domain trong .env.`,
      );
    }

    if (!record.password && !defaults.keepPassword) {
      issues.push(
        `Dong ${record.rowNumber}: thieu password va cung khong co ${getMissingPasswordHint(record.role)}.`,
      );
    }
  });

  for (const [value, rows] of collectDuplicateValues(records, "loginId")) {
    issues.push(`Trung login_id '${value}' trong file tai cac dong: ${rows.join(", ")}.`);
  }

  for (const [value, rows] of collectDuplicateValues(records, "studentId")) {
    issues.push(`Trung student_id '${value}' trong file tai cac dong: ${rows.join(", ")}.`);
  }

  for (const [value, rows] of collectDuplicateValues(records, "email")) {
    issues.push(`Trung email '${value}' trong file tai cac dong: ${rows.join(", ")}.`);
  }

  return issues;
}

async function buildImportPlan(options = {}) {
  const env = options.env || readEnv();
  const defaults = buildDefaultConfig(env, options);
  const { resolvedPath, worksheet } = await loadWorksheet(
    options.filePath,
    options.sheetName,
  );
  const rawRows = extractRawRows(worksheet);
  const preparedRecords = rawRows
    .slice(0, defaults.limit)
    .map((row) => normalizeSpreadsheetRow(row, defaults));
  const issues = validatePreparedRecords(preparedRecords, defaults);

  return {
    defaults,
    filePath: resolvedPath,
    issues,
    rawRowCount: rawRows.length,
    records: preparedRecords,
    sheetName: worksheet.name,
  };
}

function createServiceHeaders(serviceRoleKey) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };
}

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

function extractErrorMessage(payload) {
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

function isAlreadyExistsError(payload) {
  const message = extractErrorMessage(payload).toLowerCase();
  return (
    message.includes("already") ||
    message.includes("exists") ||
    message.includes("duplicate")
  );
}

function buildUserMetadata(record) {
  return {
    display_name: record.displayName,
    student_name: record.studentName,
    student_id: record.studentId || record.loginId,
    student_course: record.course,
    student_gender: record.gender,
    role: record.role,
    login_id: record.loginId,
  };
}

async function findAuthUserByEmail(context, email) {
  let page = 1;
  const perPage = 200;

  while (true) {
    const result = await requestJson(
      `${context.supabaseUrl}/auth/v1/admin/users?page=${page}&per_page=${perPage}`,
      {
        headers: context.headers,
      },
    );

    if (!result.ok) {
      throw new Error(
        `Khong the lay danh sach auth users: ${extractErrorMessage(result.json)}`,
      );
    }

    const users = Array.isArray(result.json?.users) ? result.json.users : [];
    const existingUser = users.find((user) => {
      return normalizeString(user.email).toLowerCase() === email.toLowerCase();
    });

    if (existingUser) {
      return existingUser;
    }

    if (users.length < perPage) {
      return null;
    }

    page += 1;
  }
}

async function syncAuthUser(context, record) {
  const createPayload = {
    email: record.email,
    email_confirm: true,
    user_metadata: buildUserMetadata(record),
  };

  if (!context.defaults.keepPassword) {
    createPayload.password = record.password;
  }

  const createResult = await requestJson(
    `${context.supabaseUrl}/auth/v1/admin/users`,
    {
      method: "POST",
      headers: context.headers,
      body: JSON.stringify(createPayload),
    },
  );

  if (createResult.ok) {
    return {
      action: "created",
      userId: createResult.json?.id,
    };
  }

  if (!isAlreadyExistsError(createResult.json)) {
    throw new Error(
      `Khong the tao auth user ${record.email}: ${extractErrorMessage(createResult.json)}`,
    );
  }

  const existingUser = await findAuthUserByEmail(context, record.email);

  if (!existingUser?.id) {
    throw new Error(
      `Supabase bao tai khoan ${record.email} da ton tai nhung khong tim thay user trong auth.`,
    );
  }

  const updatePayload = {
    email: record.email,
    email_confirm: true,
    user_metadata: buildUserMetadata(record),
  };

  if (!context.defaults.keepPassword) {
    updatePayload.password = record.password;
  }

  const updateResult = await requestJson(
    `${context.supabaseUrl}/auth/v1/admin/users/${existingUser.id}`,
    {
      method: "PUT",
      headers: context.headers,
      body: JSON.stringify(updatePayload),
    },
  );

  if (!updateResult.ok) {
    throw new Error(
      `Khong the cap nhat auth user ${record.email}: ${extractErrorMessage(updateResult.json)}`,
    );
  }

  return {
    action: "updated",
    userId: existingUser.id,
  };
}

async function syncProfile(context, record, userId) {
  const profilePayload = {
    id: userId,
    email: record.email,
    login_id: record.loginId,
    student_id: record.studentId || record.loginId,
    student_name: record.studentName,
    student_course: record.course,
    student_gender: record.gender,
    display_name: record.displayName,
    username: record.username || record.loginId,
    role: record.role,
  };

  const profileResult = await requestJson(`${context.supabaseUrl}/rest/v1/profiles`, {
    method: "POST",
    headers: {
      ...context.headers,
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(profilePayload),
  });

  if (!profileResult.ok) {
    throw new Error(
      `Khong the upsert profile cho ${record.email}: ${extractErrorMessage(profileResult.json)}`,
    );
  }

  return {
    action: "upserted",
  };
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function importStudentAccounts(options = {}) {
  const env = options.env || readEnv();
  const plan = options.plan || (await buildImportPlan({ ...options, env }));

  if (plan.issues.length > 0) {
    throw new Error(
      `File import khong hop le:\n- ${plan.issues.join("\n- ")}`,
    );
  }

  assertRequiredEnv(env, ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);

  const context = {
    defaults: plan.defaults,
    headers: createServiceHeaders(env.SUPABASE_SERVICE_ROLE_KEY),
    supabaseUrl: env.SUPABASE_URL,
  };
  const summary = {
    authCreated: 0,
    authUpdated: 0,
    failed: 0,
    processed: 0,
    profilesUpserted: 0,
    total: plan.records.length,
  };
  const failures = [];

  for (const record of plan.records) {
    try {
      const authResult = await syncAuthUser(context, record);
      const userId = normalizeString(authResult.userId);

      if (!userId) {
        throw new Error(`Khong nhan duoc user id cho ${record.email}.`);
      }

      await syncProfile(context, record, userId);
      summary.processed += 1;
      summary.profilesUpserted += 1;

      if (authResult.action === "created") {
        summary.authCreated += 1;
      } else {
        summary.authUpdated += 1;
      }

      if (typeof options.onProgress === "function") {
        options.onProgress({
          authAction: authResult.action,
          index: summary.processed,
          record,
          total: summary.total,
        });
      }
    } catch (error) {
      summary.failed += 1;
      failures.push({
        email: record.email,
        error: error.message,
        rowNumber: record.rowNumber,
      });

      if (typeof options.onError === "function") {
        options.onError({
          error,
          record,
        });
      }
    }

    if (plan.defaults.delayMs > 0) {
      await sleep(plan.defaults.delayMs);
    }
  }

  return {
    failures,
    filePath: plan.filePath,
    records: plan.records,
    sheetName: plan.sheetName,
    summary,
  };
}

module.exports = {
  buildDefaultConfig,
  buildImportPlan,
  importStudentAccounts,
};
