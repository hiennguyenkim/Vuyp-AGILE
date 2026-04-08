import {
  CLUB_SUPABASE_CONFIG,
  getSupabaseConfigError,
  supabase,
  waitForSupabase,
} from "./supabase-config.js";
import "./auth.js";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function pickFirst(row, columns) {
  if (!row || typeof row !== "object") {
    return "";
  }

  for (const column of uniqueValues(columns)) {
    if (row[column] !== undefined && row[column] !== null) {
      return row[column];
    }
  }

  return "";
}

function buildEventCode(codeNumber) {
  return `EV${String(codeNumber).padStart(3, "0")}`;
}

function parseEventCodeNumber(code) {
  const match = /^EV(\d+)$/i.exec(normalizeString(code));
  return match ? Number(match[1]) : 0;
}

function sortEvents(events) {
  return [...events].sort((firstEvent, secondEvent) => {
    const firstTime = Date.parse(firstEvent.start || "") || 0;
    const secondTime = Date.parse(secondEvent.start || "") || 0;

    if (firstTime !== secondTime) {
      return firstTime - secondTime;
    }

    return String(firstEvent.code || "").localeCompare(
      String(secondEvent.code || ""),
    );
  });
}

function sortRegistrations(registrations) {
  return [...registrations].sort((firstRegistration, secondRegistration) => {
    const firstTime = Date.parse(firstRegistration.registeredAt || "") || 0;
    const secondTime = Date.parse(secondRegistration.registeredAt || "") || 0;
    return secondTime - firstTime;
  });
}

function sortFeedbackEntries(entries) {
  return [...entries].sort((firstEntry, secondEntry) => {
    const firstTime = Date.parse(firstEntry.createdAt || "") || 0;
    const secondTime = Date.parse(secondEntry.createdAt || "") || 0;
    return secondTime - firstTime;
  });
}

function formatDateTime(value) {
  if (!value) {
    return "Chưa cập nhật";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return String(value).replace("T", " ");
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function formatDateRange(start, end) {
  if (!start && !end) {
    return "Chưa cập nhật";
  }

  if (!end) {
    return formatDateTime(start);
  }

  return `${formatDateTime(start)} - ${formatDateTime(end)}`;
}

function toDatabaseDateTime(value) {
  const normalizedValue = normalizeString(value);

  if (!normalizedValue) {
    return "";
  }

  const parsed = new Date(normalizedValue);

  if (Number.isNaN(parsed.getTime())) {
    return normalizedValue;
  }

  return parsed.toISOString();
}

function toDateTimeLocalValue(value) {
  const normalizedValue = normalizeString(value);

  if (!normalizedValue) {
    return "";
  }

  const parsed = new Date(normalizedValue);

  if (Number.isNaN(parsed.getTime())) {
    return normalizedValue.slice(0, 16);
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  const hours = String(parsed.getHours()).padStart(2, "0");
  const minutes = String(parsed.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function getEventStatus(event) {
  const now = Date.now();
  const endTime = Date.parse(event?.end || "");
  const startTime = Date.parse(event?.start || "");
  const isFull = normalizeNumber(event?.registered) >= normalizeNumber(event?.max);

  if (Number.isFinite(endTime) && endTime < now) {
    return {
      text: "Đã kết thúc",
      tone: "ended",
      canRegister: false,
    };
  }

  if (isFull) {
    return {
      text: "Đã đầy",
      tone: "full",
      canRegister: false,
    };
  }

  if (Number.isFinite(startTime) && startTime <= now) {
    return {
      text: "Đang diễn ra",
      tone: "live",
      canRegister: true,
    };
  }

  return {
    text: "Sự kiện sắp diễn ra",
    tone: "open",
    canRegister: true,
  };
}

function isUpcomingEvent(event) {
  const endTime = Date.parse(event?.end || "");

  if (Number.isFinite(endTime)) {
    return endTime >= Date.now();
  }

  const startTime = Date.parse(event?.start || "");

  if (!Number.isFinite(startTime)) {
    return true;
  }

  return startTime >= Date.now();
}

async function ensureSupabase() {
  const configError = getSupabaseConfigError();

  if (configError) {
    throw new Error(configError);
  }

  await waitForSupabase();

  if (!supabase) {
    throw new Error(configError || "Khong the khoi tao Supabase.");
  }
}

function mapSupabaseError(error, fallbackMessage) {
  const message = normalizeString(error?.message);
  const normalizedMessage = message.toLowerCase();

  if (!message) {
    return fallbackMessage;
  }

  if (normalizedMessage.includes("row-level security")) {
    return (
      "Thao tac bi tu choi boi chinh sach quyen truy cap Supabase. " +
      "Hay kiem tra RLS, dang nhap hien tai, va dieu kien nghiep vu cua thao tac nay."
    );
  }

  if (
    normalizedMessage.includes("relation") &&
    normalizedMessage.includes("event_feedback")
  ) {
    return "Bang event_feedback chua duoc tao tren Supabase. Hay ap dung schema SQL moi nhat.";
  }

  if (normalizedMessage.includes("fetch")) {
    return "Khong the ket noi toi Supabase. Vui long kiem tra mang va cau hinh.";
  }

  return message;
}

async function selectAll(tableName) {
  await ensureSupabase();
  const { data, error } = await supabase.from(tableName).select("*");

  if (error) {
    throw new Error(mapSupabaseError(error, "Khong the tai du lieu tu Supabase."));
  }

  return data ?? [];
}

async function fetchEventRowsFromApi() {
  const response = await fetch("/api/events", {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Khong the tai danh sach su kien cong khai.");
  }

  const payload = await response.json();

  if (!payload?.ok || !Array.isArray(payload.events)) {
    throw new Error(
      normalizeString(payload?.message) || "Khong the tai danh sach su kien cong khai.",
    );
  }

  return payload.events;
}

async function fetchEventRowsFromSupabaseRest() {
  const url = normalizeString(CLUB_SUPABASE_CONFIG.url);
  const anonKey = normalizeString(CLUB_SUPABASE_CONFIG.anonKey);
  const tableName = normalizeString(CLUB_SUPABASE_CONFIG.tables.events || "events");
  const startColumn = normalizeString(
    CLUB_SUPABASE_CONFIG.event.startColumn || "start",
  );

  if (!url || !anonKey || !tableName) {
    throw new Error(
      getSupabaseConfigError() || "Chua cau hinh du de tai su kien cong khai.",
    );
  }

  const requestUrl = new URL(`/rest/v1/${tableName}`, url);
  requestUrl.searchParams.set("select", "*");
  requestUrl.searchParams.set("order", `${startColumn}.asc`);

  const response = await fetch(String(requestUrl), {
    cache: "no-store",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Khong the tai su kien cong khai tu Supabase REST.");
  }

  const payload = await response.json();

  if (!Array.isArray(payload)) {
    throw new Error("Du lieu su kien cong khai tu Supabase REST khong hop le.");
  }

  return payload;
}

async function selectMaybeSingle(tableName, column, value) {
  await ensureSupabase();
  const { data, error } = await supabase
    .from(tableName)
    .select("*")
    .eq(column, value)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(mapSupabaseError(error, "Khong the tai du lieu can thiet."));
  }

  return data ?? null;
}

function getEventColumns() {
  return {
    code: uniqueValues([CLUB_SUPABASE_CONFIG.event.codeColumn, "code"]),
    createdAt: uniqueValues([
      CLUB_SUPABASE_CONFIG.event.createdAtColumn,
      "created_at",
      "createdAt",
    ]),
    description: uniqueValues([
      CLUB_SUPABASE_CONFIG.event.descriptionColumn,
      "description",
      "desc",
    ]),
    end: uniqueValues([CLUB_SUPABASE_CONFIG.event.endColumn, "end", "end_at"]),
    id: uniqueValues([CLUB_SUPABASE_CONFIG.event.idColumn, "id"]),
    location: uniqueValues([
      CLUB_SUPABASE_CONFIG.event.locationColumn,
      "location",
    ]),
    max: uniqueValues([CLUB_SUPABASE_CONFIG.event.maxColumn, "max", "capacity"]),
    name: uniqueValues([CLUB_SUPABASE_CONFIG.event.nameColumn, "name"]),
    registered: uniqueValues([
      CLUB_SUPABASE_CONFIG.event.registeredColumn,
      "registered",
    ]),
    speaker: uniqueValues([CLUB_SUPABASE_CONFIG.event.speakerColumn, "speaker"]),
    start: uniqueValues([
      CLUB_SUPABASE_CONFIG.event.startColumn,
      "start",
      "start_at",
    ]),
    updatedAt: uniqueValues([
      CLUB_SUPABASE_CONFIG.event.updatedAtColumn,
      "updated_at",
      "updatedAt",
    ]),
  };
}

function getRegistrationColumns() {
  return {
    checkedIn: uniqueValues(["checked_in", "checkedIn"]),
    checkedInAt: uniqueValues(["checked_in_at", "checkedInAt"]),
    checkedInBy: uniqueValues(["checked_in_by", "checkedInBy"]),
    authUserId: uniqueValues([
      CLUB_SUPABASE_CONFIG.registration.authUserIdColumn,
      "user_id",
      "auth_user_id",
    ]),
    eventId: uniqueValues([
      CLUB_SUPABASE_CONFIG.registration.eventIdColumn,
      "event_id",
      "eventId",
    ]),
    id: uniqueValues([CLUB_SUPABASE_CONFIG.registration.idColumn, "id"]),
    profileId: uniqueValues([
      CLUB_SUPABASE_CONFIG.registration.profileIdColumn,
      "profile_id",
    ]),
    registeredAt: uniqueValues([
      CLUB_SUPABASE_CONFIG.registration.registeredAtColumn,
      "registered_at",
      "created_at",
      "registeredAt",
    ]),
    status: uniqueValues([
      CLUB_SUPABASE_CONFIG.registration.statusColumn,
      "status",
    ]),
    studentCourse: uniqueValues([
      CLUB_SUPABASE_CONFIG.registration.studentCourseColumn,
      "student_course",
      "studentCourse",
    ]),
    studentGender: uniqueValues([
      CLUB_SUPABASE_CONFIG.registration.studentGenderColumn,
      "student_gender",
      "studentGender",
    ]),
    studentId: uniqueValues([
      CLUB_SUPABASE_CONFIG.registration.studentIdColumn,
      "student_id",
      "studentId",
    ]),
    studentName: uniqueValues([
      CLUB_SUPABASE_CONFIG.registration.studentNameColumn,
      "student_name",
      "studentName",
    ]),
  };
}

function getProfileColumns() {
  return {
    authUserId: uniqueValues([
      CLUB_SUPABASE_CONFIG.profile.authUserIdColumn,
      "id",
      "user_id",
      "auth_user_id",
    ]),
    displayName: uniqueValues([
      CLUB_SUPABASE_CONFIG.profile.displayNameColumn,
      "display_name",
      "full_name",
    ]),
    role: uniqueValues([CLUB_SUPABASE_CONFIG.profile.roleColumn, "role"]),
    studentCourse: uniqueValues([
      CLUB_SUPABASE_CONFIG.profile.studentCourseColumn,
      "student_course",
      "course",
    ]),
    studentGender: uniqueValues([
      CLUB_SUPABASE_CONFIG.profile.studentGenderColumn,
      "student_gender",
      "gender",
    ]),
    studentId: uniqueValues([
      CLUB_SUPABASE_CONFIG.profile.studentIdColumn,
      "student_id",
      "studentId",
    ]),
    studentName: uniqueValues([
      CLUB_SUPABASE_CONFIG.profile.studentNameColumn,
      "student_name",
      "full_name",
    ]),
  };
}

function getFeedbackColumns() {
  return {
    authUserId: uniqueValues([
      CLUB_SUPABASE_CONFIG.feedback.authUserIdColumn,
      "user_id",
      "auth_user_id",
    ]),
    content: uniqueValues([
      CLUB_SUPABASE_CONFIG.feedback.contentColumn,
      "content",
      "comment",
    ]),
    createdAt: uniqueValues([
      CLUB_SUPABASE_CONFIG.feedback.createdAtColumn,
      "created_at",
      "createdAt",
    ]),
    eventId: uniqueValues([
      CLUB_SUPABASE_CONFIG.feedback.eventIdColumn,
      "event_id",
      "eventId",
    ]),
    id: uniqueValues([CLUB_SUPABASE_CONFIG.feedback.idColumn, "id"]),
    imageUrl: uniqueValues([
      CLUB_SUPABASE_CONFIG.feedback.imageUrlColumn,
      "image_url",
      "image",
    ]),
    profileId: uniqueValues([
      CLUB_SUPABASE_CONFIG.feedback.profileIdColumn,
      "profile_id",
    ]),
    rating: uniqueValues([
      CLUB_SUPABASE_CONFIG.feedback.ratingColumn,
      "rating",
      "stars",
    ]),
    reviewerName: uniqueValues([
      CLUB_SUPABASE_CONFIG.feedback.reviewerNameColumn,
      "reviewer_name",
      "student_name",
      "name",
    ]),
    updatedAt: uniqueValues([
      CLUB_SUPABASE_CONFIG.feedback.updatedAtColumn,
      "updated_at",
      "updatedAt",
    ]),
  };
}

function normalizeProfileRow(row) {
  const profileColumns = getProfileColumns();

  return {
    authUserId: normalizeString(pickFirst(row, profileColumns.authUserId)),
    displayName: normalizeString(pickFirst(row, profileColumns.displayName)),
    role: normalizeString(pickFirst(row, profileColumns.role)),
    studentCourse: normalizeString(pickFirst(row, profileColumns.studentCourse)),
    studentGender: normalizeString(pickFirst(row, profileColumns.studentGender)),
    studentId: normalizeString(pickFirst(row, profileColumns.studentId)),
    studentName: normalizeString(pickFirst(row, profileColumns.studentName)),
  };
}

function buildProfileMaps(rows) {
  const mapByAuthUserId = new Map();
  const mapByStudentId = new Map();

  rows.forEach((row) => {
    const profile = normalizeProfileRow(row);

    if (profile.authUserId) {
      mapByAuthUserId.set(profile.authUserId, profile);
    }

    if (profile.studentId) {
      mapByStudentId.set(profile.studentId, profile);
    }
  });

  return {
    mapByAuthUserId,
    mapByStudentId,
  };
}

function normalizeEventRow(row, registrationCount = 0) {
  const eventColumns = getEventColumns();
  const max = Math.max(1, normalizeNumber(pickFirst(row, eventColumns.max), 1));
  const registered = Math.max(
    normalizeNumber(pickFirst(row, eventColumns.registered), 0),
    registrationCount,
  );

  return {
    id: normalizeString(pickFirst(row, eventColumns.id)),
    code: normalizeString(pickFirst(row, eventColumns.code)),
    name: normalizeString(pickFirst(row, eventColumns.name)),
    desc: normalizeString(pickFirst(row, eventColumns.description)),
    speaker: normalizeString(pickFirst(row, eventColumns.speaker)),
    start: normalizeString(pickFirst(row, eventColumns.start)),
    end: normalizeString(pickFirst(row, eventColumns.end)),
    location: normalizeString(pickFirst(row, eventColumns.location)),
    max,
    registered,
    createdAt: normalizeString(pickFirst(row, eventColumns.createdAt)),
    updatedAt: normalizeString(pickFirst(row, eventColumns.updatedAt)),
  };
}

function normalizeRegistrationRow(row, eventMap, profileMaps) {
  const registrationColumns = getRegistrationColumns();
  const eventId = normalizeString(pickFirst(row, registrationColumns.eventId));
  const studentId = normalizeString(pickFirst(row, registrationColumns.studentId));
  const authUserId = normalizeString(pickFirst(row, registrationColumns.authUserId));
  const checkedIn = Boolean(pickFirst(row, registrationColumns.checkedIn));
  const event = eventMap.get(eventId) || null;
  const profile =
    profileMaps.mapByStudentId.get(studentId) ||
    profileMaps.mapByAuthUserId.get(authUserId) ||
    null;

  return {
    id: normalizeString(pickFirst(row, registrationColumns.id)),
    eventId,
    eventCode: normalizeString(row.event_code) || event?.code || "",
    eventName: normalizeString(row.event_name) || event?.name || "",
    start: normalizeString(row.start) || event?.start || "",
    end: normalizeString(row.end) || event?.end || "",
    location: normalizeString(row.location) || event?.location || "",
    studentName:
      normalizeString(pickFirst(row, registrationColumns.studentName)) ||
      profile?.studentName ||
      profile?.displayName ||
      "",
    studentId: studentId || profile?.studentId || "",
    studentCourse:
      normalizeString(pickFirst(row, registrationColumns.studentCourse)) ||
      profile?.studentCourse ||
      "",
    studentGender:
      normalizeString(pickFirst(row, registrationColumns.studentGender)) ||
      profile?.studentGender ||
      "",
    registeredAt: normalizeString(
      pickFirst(row, registrationColumns.registeredAt),
    ),
    checkedIn,
    checkedInAt: normalizeString(
      pickFirst(row, registrationColumns.checkedInAt),
    ),
    status:
      normalizeString(pickFirst(row, registrationColumns.status)) ||
      (checkedIn ? "Đã điểm danh" : "Đã đăng ký"),
  };
}

function normalizeFeedbackRow(row) {
  const feedbackColumns = getFeedbackColumns();

  return {
    id: normalizeString(pickFirst(row, feedbackColumns.id)),
    eventId: normalizeString(pickFirst(row, feedbackColumns.eventId)),
    profileId: normalizeString(pickFirst(row, feedbackColumns.profileId)),
    authUserId: normalizeString(pickFirst(row, feedbackColumns.authUserId)),
    reviewerName:
      normalizeString(pickFirst(row, feedbackColumns.reviewerName)) || "Sinh viên",
    stars: Math.min(
      5,
      Math.max(1, normalizeNumber(pickFirst(row, feedbackColumns.rating), 1)),
    ),
    content: normalizeString(pickFirst(row, feedbackColumns.content)),
    image: normalizeString(pickFirst(row, feedbackColumns.imageUrl)),
    createdAt: normalizeString(pickFirst(row, feedbackColumns.createdAt)),
    updatedAt: normalizeString(pickFirst(row, feedbackColumns.updatedAt)),
  };
}

async function fetchEventRows() {
  try {
    return await fetchEventRowsFromApi();
  } catch (apiError) {
    try {
      return await fetchEventRowsFromSupabaseRest();
    } catch (restError) {
      return selectAll(CLUB_SUPABASE_CONFIG.tables.events);
    }
  }
}

async function fetchProfileRows() {
  try {
    return await selectAll(CLUB_SUPABASE_CONFIG.tables.profiles);
  } catch (error) {
    return [];
  }
}

async function fetchRegistrationRows(filters = {}) {
  await ensureSupabase();
  let query = supabase
    .from(CLUB_SUPABASE_CONFIG.tables.registrations)
    .select("*");

  if (filters.eventId) {
    query = query.eq(CLUB_SUPABASE_CONFIG.registration.eventIdColumn, filters.eventId);
  }

  if (filters.studentId && CLUB_SUPABASE_CONFIG.registration.studentIdColumn) {
    query = query.eq(CLUB_SUPABASE_CONFIG.registration.studentIdColumn, filters.studentId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(
      mapSupabaseError(error, "Khong the tai danh sach dang ky tu Supabase."),
    );
  }

  return data ?? [];
}

async function fetchFeedbackRows(filters = {}) {
  await ensureSupabase();
  let query = supabase
    .from(CLUB_SUPABASE_CONFIG.tables.feedback)
    .select("*");
  const createdAtColumn =
    CLUB_SUPABASE_CONFIG.feedback.createdAtColumn || "created_at";
  const normalizedEventId = normalizeString(filters.eventId);
  const normalizedUserId = normalizeString(filters.userId);
  const normalizedEventIds = uniqueValues(
    Array.isArray(filters.eventIds)
      ? filters.eventIds.map((value) => normalizeString(value)).filter(Boolean)
      : [],
  );

  if (normalizedEventId) {
    query = query.eq(CLUB_SUPABASE_CONFIG.feedback.eventIdColumn, normalizedEventId);
  }

  if (normalizedEventIds.length > 0) {
    query = query.in(CLUB_SUPABASE_CONFIG.feedback.eventIdColumn, normalizedEventIds);
  }

  if (normalizedUserId) {
    query = query.eq(CLUB_SUPABASE_CONFIG.feedback.authUserIdColumn, normalizedUserId);
  }

  const { data, error } = await query.order(createdAtColumn, { ascending: false });

  if (error) {
    throw new Error(
      mapSupabaseError(error, "Khong the tai danh sach danh gia tu Supabase."),
    );
  }

  return data ?? [];
}

async function fetchNormalizedEvents() {
  const eventRows = await fetchEventRows();
  return sortEvents(eventRows.map((row) => normalizeEventRow(row)));
}

async function fetchNormalizedRegistrations(filters = {}) {
  const [eventRows, registrationRows, profileRows] = await Promise.all([
    fetchEventRows(),
    fetchRegistrationRows(filters),
    fetchProfileRows(),
  ]);
  const eventCounts = registrationRows.reduce((result, row) => {
    const eventId = normalizeString(
      pickFirst(row, getRegistrationColumns().eventId),
    );

    if (!eventId) {
      return result;
    }

    result.set(eventId, (result.get(eventId) ?? 0) + 1);
    return result;
  }, new Map());
  const events = sortEvents(
    eventRows.map((row) =>
      normalizeEventRow(
        row,
        eventCounts.get(normalizeString(pickFirst(row, getEventColumns().id))) ?? 0,
      ),
    ),
  );
  const eventMap = new Map(events.map((event) => [event.id, event]));
  const profileMaps = buildProfileMaps(profileRows);

  return sortRegistrations(
    registrationRows.map((row) =>
      normalizeRegistrationRow(row, eventMap, profileMaps),
    ),
  );
}

async function fetchNormalizedFeedback(filters = {}) {
  const feedbackRows = await fetchFeedbackRows(filters);
  return sortFeedbackEntries(feedbackRows.map((row) => normalizeFeedbackRow(row)));
}

async function readState() {
  const [events, registrations] = await Promise.all([
    fetchNormalizedEvents(),
    fetchNormalizedRegistrations(),
  ]);

  return {
    events,
    registrations,
    legacyHistory: [],
  };
}

async function getEventById(eventId) {
  const normalizedEventId = normalizeString(eventId);
  if (!normalizedEventId) {
    return null;
  }

  const row = await selectMaybeSingle(
    CLUB_SUPABASE_CONFIG.tables.events,
    CLUB_SUPABASE_CONFIG.event.idColumn,
    normalizedEventId,
  );

  if (!row) {
    return null;
  }

  let registrationCount = normalizeNumber(
    pickFirst(row, getEventColumns().registered),
    0,
  );

  try {
    const registrations = await fetchRegistrationRows({ eventId: normalizedEventId });
    registrationCount = Math.max(registrationCount, registrations.length);
  } catch (error) {
    registrationCount = normalizeNumber(
      pickFirst(row, getEventColumns().registered),
      0,
    );
  }

  return normalizeEventRow(row, registrationCount);
}

async function getUpcomingEvents() {
  const events = await fetchNormalizedEvents();
  return sortEvents(events.filter(isUpcomingEvent));
}

async function getEvents() {
  return fetchNormalizedEvents();
}

async function getRegistrations(filters = {}) {
  return fetchNormalizedRegistrations(filters);
}

async function hasStudentRegistration(eventId, studentId) {
  const normalizedEventId = normalizeString(eventId);
  const normalizedStudentId = normalizeString(studentId);

  if (!normalizedEventId || !normalizedStudentId) {
    return false;
  }

  try {
    const rows = await fetchRegistrationRows({
      eventId: normalizedEventId,
      studentId: normalizedStudentId,
    });
    return rows.length > 0;
  } catch (error) {
    const registrations = await fetchNormalizedRegistrations();
    return registrations.some((registration) => {
      return (
        normalizeString(registration.eventId) === normalizedEventId &&
        normalizeString(registration.studentId) === normalizedStudentId
      );
    });
  }
}

async function getHistoryEntries(studentId) {
  const normalizedStudentId = normalizeString(studentId);
  const registrations = await fetchNormalizedRegistrations();
  const seen = new Set();

  return registrations.filter((entry) => {
    const matchesStudent =
      !normalizedStudentId || normalizeString(entry.studentId) === normalizedStudentId;

    if (!matchesStudent) {
      return false;
    }

    const uniqueKey = [
      entry.eventId,
      entry.eventName,
      entry.location,
      entry.studentId,
      entry.registeredAt,
    ].join("|");

    if (seen.has(uniqueKey)) {
      return false;
    }

    seen.add(uniqueKey);
    return true;
  });
}

async function getFeedbackEntries(filters = {}) {
  return fetchNormalizedFeedback(filters);
}

async function getNextEventCode() {
  const events = await fetchNormalizedEvents();
  const nextCodeNumber =
    events.reduce((maxCode, event) => {
      return Math.max(maxCode, parseEventCodeNumber(event.code));
    }, 0) + 1;

  return buildEventCode(nextCodeNumber);
}

function buildEventWritePayload(payload, options = {}) {
  const now = new Date().toISOString();
  const writePayload = {
    [CLUB_SUPABASE_CONFIG.event.nameColumn]: normalizeString(payload?.name),
    [CLUB_SUPABASE_CONFIG.event.descriptionColumn]: normalizeString(payload?.desc),
    [CLUB_SUPABASE_CONFIG.event.speakerColumn]: normalizeString(payload?.speaker),
    [CLUB_SUPABASE_CONFIG.event.startColumn]: toDatabaseDateTime(payload?.start),
    [CLUB_SUPABASE_CONFIG.event.endColumn]: toDatabaseDateTime(payload?.end),
    [CLUB_SUPABASE_CONFIG.event.locationColumn]: normalizeString(payload?.location),
    [CLUB_SUPABASE_CONFIG.event.maxColumn]: Math.max(
      1,
      normalizeNumber(payload?.max, 1),
    ),
  };

  if (options.includeCode) {
    writePayload[CLUB_SUPABASE_CONFIG.event.codeColumn] = options.code;
  }

  if (CLUB_SUPABASE_CONFIG.event.registeredColumn) {
    writePayload[CLUB_SUPABASE_CONFIG.event.registeredColumn] =
      options.registered ?? 0;
  }

  if (CLUB_SUPABASE_CONFIG.event.createdAtColumn && options.includeCreatedAt) {
    writePayload[CLUB_SUPABASE_CONFIG.event.createdAtColumn] = now;
  }

  if (CLUB_SUPABASE_CONFIG.event.updatedAtColumn) {
    writePayload[CLUB_SUPABASE_CONFIG.event.updatedAtColumn] = now;
  }

  return writePayload;
}

function buildFeedbackWritePayload(eventId, payload, authState) {
  const session = authState.session || window.ClubAuth.getCurrentSession?.();
  const profile = authState.profile || window.ClubAuth.getCurrentProfile?.();
  const reviewerName =
    normalizeString(payload?.reviewerName) ||
    normalizeString(profile?.studentName) ||
    normalizeString(profile?.displayName) ||
    "Sinh viên";
  const rating = Math.min(5, Math.max(1, normalizeNumber(payload?.rating, 1)));
  const writePayload = {
    [CLUB_SUPABASE_CONFIG.feedback.eventIdColumn]: normalizeString(eventId),
    [CLUB_SUPABASE_CONFIG.feedback.authUserIdColumn]:
      normalizeString(session?.user?.id),
    [CLUB_SUPABASE_CONFIG.feedback.reviewerNameColumn]: reviewerName,
    [CLUB_SUPABASE_CONFIG.feedback.ratingColumn]: rating,
    [CLUB_SUPABASE_CONFIG.feedback.contentColumn]: normalizeString(payload?.content),
    [CLUB_SUPABASE_CONFIG.feedback.imageUrlColumn]: normalizeString(payload?.image),
  };

  if (CLUB_SUPABASE_CONFIG.feedback.profileIdColumn && profile?.id) {
    writePayload[CLUB_SUPABASE_CONFIG.feedback.profileIdColumn] = profile.id;
  }

  return writePayload;
}

async function createEvent(payload) {
  await ensureSupabase();
  const code = await getNextEventCode();
  const insertPayload = buildEventWritePayload(payload, {
    code,
    includeCode: true,
    includeCreatedAt: true,
    registered: 0,
  });
  const { data, error } = await supabase
    .from(CLUB_SUPABASE_CONFIG.tables.events)
    .insert(insertPayload)
    .select("*")
    .single();

  if (error) {
    throw new Error(mapSupabaseError(error, "Khong the tao su kien."));
  }

  const event = normalizeEventRow(data);

  return {
    event,
  };
}

async function updateEvent(eventId, payload) {
  await ensureSupabase();
  const currentEvent = await getEventById(eventId);

  if (!currentEvent) {
    throw new Error("Không tìm thấy sự kiện cần cập nhật.");
  }

  const updatePayload = buildEventWritePayload(payload, {
    registered: currentEvent.registered,
  });
  const { data, error } = await supabase
    .from(CLUB_SUPABASE_CONFIG.tables.events)
    .update(updatePayload)
    .eq(CLUB_SUPABASE_CONFIG.event.idColumn, eventId)
    .select("*")
    .single();

  if (error) {
    throw new Error(mapSupabaseError(error, "Khong the cap nhat su kien."));
  }

  return {
    event: normalizeEventRow(data, currentEvent.registered),
  };
}

async function deleteEvent(eventId) {
  await ensureSupabase();
  const event = await getEventById(eventId);

  if (!event) {
    throw new Error("Không tìm thấy sự kiện cần xóa.");
  }

  const { error: registrationError } = await supabase
    .from(CLUB_SUPABASE_CONFIG.tables.registrations)
    .delete()
    .eq(CLUB_SUPABASE_CONFIG.registration.eventIdColumn, eventId);

  if (registrationError) {
    throw new Error(
      mapSupabaseError(
        registrationError,
        "Khong the xoa danh sach dang ky cua su kien.",
      ),
    );
  }

  const { error } = await supabase
    .from(CLUB_SUPABASE_CONFIG.tables.events)
    .delete()
    .eq(CLUB_SUPABASE_CONFIG.event.idColumn, eventId);

  if (error) {
    throw new Error(mapSupabaseError(error, "Khong the xoa su kien."));
  }

  return {
    event,
  };
}

function buildRegistrationWritePayload(event, student, authState) {
  const payload = {
    [CLUB_SUPABASE_CONFIG.registration.eventIdColumn]: event.id,
  };
  const profile = authState.profile || window.ClubAuth.getCurrentProfile?.();
  const session = authState.session || window.ClubAuth.getCurrentSession?.();

  if (CLUB_SUPABASE_CONFIG.registration.studentIdColumn) {
    payload[CLUB_SUPABASE_CONFIG.registration.studentIdColumn] =
      normalizeString(student.studentId);
  }

  if (CLUB_SUPABASE_CONFIG.registration.studentNameColumn) {
    payload[CLUB_SUPABASE_CONFIG.registration.studentNameColumn] =
      normalizeString(student.studentName);
  }

  if (CLUB_SUPABASE_CONFIG.registration.studentCourseColumn) {
    payload[CLUB_SUPABASE_CONFIG.registration.studentCourseColumn] =
      normalizeString(student.studentCourse);
  }

  if (CLUB_SUPABASE_CONFIG.registration.studentGenderColumn) {
    payload[CLUB_SUPABASE_CONFIG.registration.studentGenderColumn] =
      normalizeString(student.studentGender);
  }

  if (CLUB_SUPABASE_CONFIG.registration.statusColumn) {
    payload[CLUB_SUPABASE_CONFIG.registration.statusColumn] = "Đã đăng ký";
  }

  if (CLUB_SUPABASE_CONFIG.registration.registeredAtColumn) {
    payload[CLUB_SUPABASE_CONFIG.registration.registeredAtColumn] =
      new Date().toISOString();
  }

  if (
    CLUB_SUPABASE_CONFIG.registration.profileIdColumn &&
    profile?.id
  ) {
    payload[CLUB_SUPABASE_CONFIG.registration.profileIdColumn] = profile.id;
  }

  if (
    CLUB_SUPABASE_CONFIG.registration.authUserIdColumn &&
    session?.user?.id
  ) {
    payload[CLUB_SUPABASE_CONFIG.registration.authUserIdColumn] = session.user.id;
  }

  return payload;
}

async function registerStudent(eventId, studentOrStudentId) {
  const event = await getEventById(eventId);

  if (!event) {
    return {
      ok: false,
      message: "Sự kiện không còn tồn tại.",
    };
  }

  const status = getEventStatus(event);

  if (!status.canRegister) {
    return {
      ok: false,
      message:
        status.tone === "full"
          ? "Sự kiện đã đủ số lượng đăng ký."
          : "Sự kiện đã kết thúc, không thể đăng ký.",
    };
  }

  await window.ClubAuth.ready();
  const authState = await window.ClubAuth.readAuthState();
  const fallbackStudent = window.ClubAuth.getCurrentUser() || {};
  const student =
    typeof studentOrStudentId === "string"
      ? {
          studentId: studentOrStudentId,
          studentName: fallbackStudent.studentName,
          studentCourse: fallbackStudent.studentCourse,
          studentGender: fallbackStudent.studentGender,
        }
      : {
          studentId:
            normalizeString(studentOrStudentId?.studentId) ||
            fallbackStudent.studentId,
          studentName:
            normalizeString(studentOrStudentId?.studentName) ||
            fallbackStudent.studentName,
          studentCourse:
            normalizeString(studentOrStudentId?.studentCourse) ||
            fallbackStudent.studentCourse,
          studentGender:
            normalizeString(studentOrStudentId?.studentGender) ||
            fallbackStudent.studentGender,
        };

  if (await hasStudentRegistration(eventId, student.studentId)) {
    return {
      ok: false,
      message:
        "MSSV này đã đăng ký tham gia sự kiện. Vui lòng không đăng ký lại!",
    };
  }

  await ensureSupabase();
  const { data, error } = await supabase
    .from(CLUB_SUPABASE_CONFIG.tables.registrations)
    .insert(buildRegistrationWritePayload(event, student, authState))
    .select("*")
    .single();

  if (error) {
    return {
      ok: false,
      message: mapSupabaseError(error, "Khong the dang ky su kien."),
    };
  }

  const registrations = await fetchNormalizedRegistrations().catch(() => []);
  const updatedEvent = await getEventById(eventId);
  const registration = registrations.find((entry) => {
    return normalizeString(entry.id) === normalizeString(data?.id);
  });

  return {
    ok: true,
    event: updatedEvent || event,
    registration:
      registration ||
      normalizeRegistrationRow(
        data,
        new Map([[event.id, updatedEvent || event]]),
        buildProfileMaps([]),
      ),
  };
}

async function saveEventFeedback(eventId, payload = {}) {
  const normalizedEventId = normalizeString(eventId);

  if (!normalizedEventId) {
    throw new Error("Chua chon su kien de gui danh gia.");
  }

  await window.ClubAuth.ready();
  const authState = await window.ClubAuth.readAuthState();
  const authUserId = normalizeString(authState.session?.user?.id);

  if (!authUserId) {
    throw new Error("Ban can dang nhap lai de gui danh gia.");
  }

  const rating = normalizeNumber(payload?.rating, 0);

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error("So sao danh gia khong hop le.");
  }

  await ensureSupabase();

  const conflictColumns = [
    CLUB_SUPABASE_CONFIG.feedback.eventIdColumn,
    CLUB_SUPABASE_CONFIG.feedback.authUserIdColumn,
  ].join(",");
  const { data, error } = await supabase
    .from(CLUB_SUPABASE_CONFIG.tables.feedback)
    .upsert(buildFeedbackWritePayload(normalizedEventId, payload, authState), {
      onConflict: conflictColumns,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(mapSupabaseError(error, "Khong the gui danh gia su kien."));
  }

  return normalizeFeedbackRow(data);
}

window.ClubStorage = {
  createEvent,
  deleteEvent,
  formatDateRange,
  formatDateTime,
  getEventById,
  getEvents,
  getFeedbackEntries,
  getEventStatus,
  getHistoryEntries,
  getRegistrations,
  getUpcomingEvents,
  hasStudentRegistration,
  isUpcomingEvent,
  normalizeString,
  readState,
  registerStudent,
  saveEventFeedback,
  sortEvents,
  sortFeedbackEntries,
  sortRegistrations,
  toDatabaseDateTime,
  toDateTimeLocalValue,
  updateEvent,
};
