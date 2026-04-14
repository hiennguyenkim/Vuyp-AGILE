const { readEnv, requireEnv } = require("../../config/env-loader.cjs");

const TEST_EVENT = {
  code: "TEST-EVENT-ATTENDANCE-2026",
  name: "Su kien test noi bo - Day du luong tham gia",
  description:
    "Su kien test noi bo de kiem thu luong dang ky, check-in, thong ke gioi tinh va danh gia sau su kien. Khong dung cho van hanh thuc te.",
  speaker: "Ban dieu phoi he thong HCMUE",
  location: "Phong hoi thao A - Co so 280 An Duong Vuong",
  start: "2026-04-05T08:00:00+07:00",
  end: "2026-04-05T11:30:00+07:00",
  max: 40,
};

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function buildRestUrl(baseUrl, tableName, params = {}) {
  const url = new URL(`/rest/v1/${tableName}`, baseUrl);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  return url;
}

function buildHeaders(apiKey, extraHeaders = {}) {
  return {
    apikey: apiKey,
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    ...extraHeaders,
  };
}

async function requestJson(url, options = {}, fallbackMessage = "Khong the xu ly yeu cau toi Supabase.") {
  const response = await fetch(String(url), options);
  const rawText = await response.text();

  let payload = null;

  try {
    payload = rawText ? JSON.parse(rawText) : null;
  } catch (error) {
    payload = rawText;
  }

  if (!response.ok) {
    const detail =
      normalizeString(payload?.message) ||
      normalizeString(payload?.error_description) ||
      normalizeString(payload?.hint) ||
      normalizeString(rawText);
    throw new Error(detail || fallbackMessage);
  }

  return payload;
}

function compareByStudentId(leftProfile, rightProfile) {
  return normalizeString(leftProfile.student_id).localeCompare(
    normalizeString(rightProfile.student_id),
    "vi",
    {
      numeric: true,
      sensitivity: "base",
    },
  );
}

function normalizeStudentGender(value) {
  const normalizedValue = normalizeString(value).toLowerCase();

  if (normalizedValue === "nam") {
    return "Nam";
  }

  if (normalizedValue === "nu" || normalizedValue === "nữ") {
    return "Nữ";
  }

  if (normalizedValue === "khac" || normalizedValue === "khác") {
    return "Khác";
  }

  return "";
}

function buildDisplayStudentName(profile) {
  return (
    normalizeString(profile.student_name) ||
    normalizeString(profile.display_name) ||
    normalizeString(profile.email) ||
    normalizeString(profile.student_id) ||
    "Sinh vien test"
  );
}

async function fetchProfiles(env, role) {
  const url = buildRestUrl(env.SUPABASE_URL, "profiles", {
    select: "id,role,email,display_name,student_id,student_name,student_course,student_gender,created_at",
    role: `eq.${role}`,
    order: "student_id.asc.nullslast,created_at.asc.nullslast",
  });

  const payload = await requestJson(
    url,
    {
      method: "GET",
      headers: buildHeaders(env.SUPABASE_SERVICE_ROLE_KEY),
    },
    "Khong the tai danh sach profiles tu Supabase.",
  );

  return Array.isArray(payload) ? payload : [];
}

async function upsertTestEvent(env) {
  const url = buildRestUrl(env.SUPABASE_URL, "events", {
    on_conflict: "code",
    select: "*",
  });
  const payload = [
    {
      code: TEST_EVENT.code,
      name: TEST_EVENT.name,
      description: TEST_EVENT.description,
      speaker: TEST_EVENT.speaker,
      start: TEST_EVENT.start,
      end: TEST_EVENT.end,
      location: TEST_EVENT.location,
      max: TEST_EVENT.max,
      registered: 0,
    },
  ];

  const response = await requestJson(
    url,
    {
      method: "POST",
      headers: buildHeaders(env.SUPABASE_SERVICE_ROLE_KEY, {
        Prefer: "resolution=merge-duplicates,return=representation",
      }),
      body: JSON.stringify(payload),
    },
    "Khong the tao hoac cap nhat su kien test.",
  );

  return Array.isArray(response) ? response[0] : response;
}

async function deleteRowsByEventId(env, tableName, eventId) {
  const url = buildRestUrl(env.SUPABASE_URL, tableName, {
    event_id: `eq.${eventId}`,
  });

  await requestJson(
    url,
    {
      method: "DELETE",
      headers: buildHeaders(env.SUPABASE_SERVICE_ROLE_KEY, {
        Prefer: "return=minimal",
      }),
    },
    `Khong the xoa du lieu cu cua ${tableName}.`,
  );
}

function buildRegistrationRows(students, eventId, adminUserId) {
  const registrationTimeBase = new Date("2026-04-02T08:00:00+07:00").getTime();
  const checkInTimeBase = new Date("2026-04-05T07:35:00+07:00").getTime();

  return students.map((profile, index) => {
    const order = index + 1;
    const checkedIn = order === 1 || order === 2 || order === 4;

    return {
      event_id: eventId,
      student_id: normalizeString(profile.student_id),
      profile_id: profile.id,
      user_id: profile.id,
      student_name: buildDisplayStudentName(profile),
      student_course: normalizeString(profile.student_course),
      student_gender: normalizeStudentGender(profile.student_gender),
      status: checkedIn ? "Đã điểm danh" : "Đã đăng ký",
      registered_at: new Date(registrationTimeBase + index * 17 * 60 * 1000).toISOString(),
      checked_in: checkedIn,
      checked_in_at: checkedIn
        ? new Date(checkInTimeBase + index * 4 * 60 * 1000).toISOString()
        : null,
      checked_in_by: checkedIn ? adminUserId : null,
    };
  });
}

function buildFeedbackRows(students, eventId) {
  const feedbackStudents = students.filter((_, index) => index === 0 || index === 3);
  const feedbackTimeBase = new Date("2026-04-05T12:30:00+07:00").getTime();

  return feedbackStudents.map((profile, index) => {
    return {
      event_id: eventId,
      profile_id: profile.id,
      user_id: profile.id,
      reviewer_name: buildDisplayStudentName(profile),
      rating: index === 0 ? 5 : 4,
      content:
        index === 0
          ? "Noi dung su kien ro rang, phan check-in va dieu phoi hoat dong dien ra on dinh."
          : "Khong gian thoai mai, thong tin huu ich va phan hoi sau su kien duoc ghi nhan nhanh.",
      image_url: "",
      is_hidden: false,
      hidden_at: null,
      hidden_by: null,
      created_at: new Date(feedbackTimeBase + index * 35 * 60 * 1000).toISOString(),
      updated_at: new Date(feedbackTimeBase + index * 35 * 60 * 1000).toISOString(),
    };
  });
}

async function insertRows(env, tableName, rows, fallbackMessage) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }

  const url = buildRestUrl(env.SUPABASE_URL, tableName, {
    select: "*",
  });

  const payload = await requestJson(
    url,
    {
      method: "POST",
      headers: buildHeaders(env.SUPABASE_SERVICE_ROLE_KEY, {
        Prefer: "return=representation",
      }),
      body: JSON.stringify(rows),
    },
    fallbackMessage,
  );

  return Array.isArray(payload) ? payload : [];
}

async function patchEventRegisteredCount(env, eventId, registeredCount) {
  const url = buildRestUrl(env.SUPABASE_URL, "events", {
    id: `eq.${eventId}`,
    select: "*",
  });

  const payload = await requestJson(
    url,
    {
      method: "PATCH",
      headers: buildHeaders(env.SUPABASE_SERVICE_ROLE_KEY, {
        Prefer: "return=representation",
      }),
      body: JSON.stringify({
        registered: registeredCount,
        updated_at: new Date().toISOString(),
      }),
    },
    "Khong the dong bo so luong dang ky cho su kien test.",
  );

  return Array.isArray(payload) ? payload[0] : payload;
}

async function main() {
  const env = readEnv();
  requireEnv(env, ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);

  const [studentProfiles, adminProfiles] = await Promise.all([
    fetchProfiles(env, "student"),
    fetchProfiles(env, "admin"),
  ]);

  const selectedStudents = studentProfiles
    .filter((profile) => normalizeString(profile.student_id))
    .sort(compareByStudentId)
    .slice(0, 5);

  if (selectedStudents.length < 3) {
    throw new Error(
      "Can it nhat 3 tai khoan sinh vien da co student_id trong bang profiles de tao du lieu test.",
    );
  }

  const adminUserId = normalizeString(adminProfiles[0]?.id) || null;
  const event = await upsertTestEvent(env);

  if (!normalizeString(event?.id)) {
    throw new Error("Supabase khong tra ve id su kien test sau khi upsert.");
  }

  await deleteRowsByEventId(env, "event_feedback", event.id);
  await deleteRowsByEventId(env, "registrations", event.id);

  const registrationRows = buildRegistrationRows(selectedStudents, event.id, adminUserId);
  const feedbackRows = buildFeedbackRows(selectedStudents, event.id);

  const insertedRegistrations = await insertRows(
    env,
    "registrations",
    registrationRows,
    "Khong the chen danh sach dang ky/check-in test.",
  );
  const insertedFeedback = await insertRows(
    env,
    "event_feedback",
    feedbackRows,
    "Khong the chen danh gia test.",
  );

  await patchEventRegisteredCount(env, event.id, insertedRegistrations.length);

  const checkedInCount = insertedRegistrations.filter((item) => Boolean(item.checked_in)).length;
  const noFeedbackCount = insertedRegistrations.length - insertedFeedback.length;

  console.log("Da tao hoac lam moi su kien test thanh cong.");
  console.log(`- Code: ${TEST_EVENT.code}`);
  console.log(`- Ten: ${TEST_EVENT.name}`);
  console.log(`- Event ID: ${event.id}`);
  console.log(`- So sinh vien tham gia: ${insertedRegistrations.length}`);
  console.log(`- Da check-in: ${checkedInCount}`);
  console.log(`- Chua check-in: ${insertedRegistrations.length - checkedInCount}`);
  console.log(`- Da danh gia: ${insertedFeedback.length}`);
  console.log(`- Chua danh gia: ${noFeedbackCount}`);
  console.log("- Sinh vien duoc gan vao su kien test:");

  insertedRegistrations.forEach((registration, index) => {
    const feedbackMark = insertedFeedback.some((feedback) => feedback.user_id === registration.user_id)
      ? "co danh gia"
      : "chua danh gia";
    const checkInMark = registration.checked_in ? "da check-in" : "chua check-in";
    console.log(
      `  ${index + 1}. ${registration.student_id} - ${registration.student_name} (${checkInMark}, ${feedbackMark})`,
    );
  });
}

main().catch((error) => {
  console.error("Khong the seed su kien test.", error?.message || error);
  process.exit(1);
});
