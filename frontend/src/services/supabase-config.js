import { getEnvJson, getEnvList, getEnvValue } from "./env.js";

const DEFAULT_SUPABASE_CONFIG = {
  url: getEnvValue("SUPABASE_URL"),
  anonKey: getEnvValue("SUPABASE_ANON_KEY"),
  tables: {
    events: getEnvValue("SUPABASE_TABLE_EVENTS", "events"),
    profiles: getEnvValue("SUPABASE_TABLE_PROFILES", "profiles"),
    registrations: getEnvValue(
      "SUPABASE_TABLE_REGISTRATIONS",
      "registrations",
    ),
    feedback: getEnvValue(
      "SUPABASE_TABLE_EVENT_FEEDBACK",
      "event_feedback",
    ),
  },
  auth: {
    identityDomain: getEnvValue("SUPABASE_AUTH_IDENTITY_DOMAIN"),
    demoAccounts: getEnvJson("SUPABASE_AUTH_DEMO_ACCOUNTS_JSON", []),
  },
  profile: {
    authUserIdColumn: getEnvValue("SUPABASE_PROFILE_AUTH_USER_ID_COLUMN", "id"),
    emailColumn: getEnvValue("SUPABASE_PROFILE_EMAIL_COLUMN", "email"),
    loginIdColumn: getEnvValue("SUPABASE_PROFILE_LOGIN_ID_COLUMN", "login_id"),
    roleColumn: getEnvValue("SUPABASE_PROFILE_ROLE_COLUMN", "role"),
    displayNameColumn: getEnvValue(
      "SUPABASE_PROFILE_DISPLAY_NAME_COLUMN",
      "display_name",
    ),
    studentIdColumn: getEnvValue(
      "SUPABASE_PROFILE_STUDENT_ID_COLUMN",
      "student_id",
    ),
    studentNameColumn: getEnvValue(
      "SUPABASE_PROFILE_STUDENT_NAME_COLUMN",
      "student_name",
    ),
    studentCourseColumn: getEnvValue(
      "SUPABASE_PROFILE_STUDENT_COURSE_COLUMN",
      "student_course",
    ),
    studentGenderColumn: getEnvValue(
      "SUPABASE_PROFILE_STUDENT_GENDER_COLUMN",
      "student_gender",
    ),
    extraLookupColumns: getEnvList(
      "SUPABASE_PROFILE_EXTRA_LOOKUP_COLUMNS",
      ["username"],
    ),
  },
  event: {
    idColumn: getEnvValue("SUPABASE_EVENT_ID_COLUMN", "id"),
    codeColumn: getEnvValue("SUPABASE_EVENT_CODE_COLUMN", "code"),
    nameColumn: getEnvValue("SUPABASE_EVENT_NAME_COLUMN", "name"),
    descriptionColumn: getEnvValue(
      "SUPABASE_EVENT_DESCRIPTION_COLUMN",
      "description",
    ),
    speakerColumn: getEnvValue("SUPABASE_EVENT_SPEAKER_COLUMN", "speaker"),
    startColumn: getEnvValue("SUPABASE_EVENT_START_COLUMN", "start"),
    endColumn: getEnvValue("SUPABASE_EVENT_END_COLUMN", "end"),
    locationColumn: getEnvValue("SUPABASE_EVENT_LOCATION_COLUMN", "location"),
    maxColumn: getEnvValue("SUPABASE_EVENT_MAX_COLUMN", "max"),
    registeredColumn: getEnvValue(
      "SUPABASE_EVENT_REGISTERED_COLUMN",
      "registered",
    ),
    createdAtColumn: getEnvValue(
      "SUPABASE_EVENT_CREATED_AT_COLUMN",
      "created_at",
    ),
    updatedAtColumn: getEnvValue(
      "SUPABASE_EVENT_UPDATED_AT_COLUMN",
      "updated_at",
    ),
  },
  registration: {
    idColumn: getEnvValue("SUPABASE_REGISTRATION_ID_COLUMN", "id"),
    eventIdColumn: getEnvValue(
      "SUPABASE_REGISTRATION_EVENT_ID_COLUMN",
      "event_id",
    ),
    studentIdColumn: getEnvValue(
      "SUPABASE_REGISTRATION_STUDENT_ID_COLUMN",
      "student_id",
    ),
    profileIdColumn: getEnvValue(
      "SUPABASE_REGISTRATION_PROFILE_ID_COLUMN",
      "profile_id",
    ),
    authUserIdColumn: getEnvValue(
      "SUPABASE_REGISTRATION_AUTH_USER_ID_COLUMN",
      "user_id",
    ),
    studentNameColumn: getEnvValue(
      "SUPABASE_REGISTRATION_STUDENT_NAME_COLUMN",
      "student_name",
    ),
    studentCourseColumn: getEnvValue(
      "SUPABASE_REGISTRATION_STUDENT_COURSE_COLUMN",
      "student_course",
    ),
    studentGenderColumn: getEnvValue(
      "SUPABASE_REGISTRATION_STUDENT_GENDER_COLUMN",
      "student_gender",
    ),
    statusColumn: getEnvValue("SUPABASE_REGISTRATION_STATUS_COLUMN", "status"),
    registeredAtColumn: getEnvValue(
      "SUPABASE_REGISTRATION_REGISTERED_AT_COLUMN",
      "registered_at",
    ),
  },
  feedback: {
    idColumn: getEnvValue("SUPABASE_FEEDBACK_ID_COLUMN", "id"),
    eventIdColumn: getEnvValue("SUPABASE_FEEDBACK_EVENT_ID_COLUMN", "event_id"),
    profileIdColumn: getEnvValue(
      "SUPABASE_FEEDBACK_PROFILE_ID_COLUMN",
      "profile_id",
    ),
    authUserIdColumn: getEnvValue(
      "SUPABASE_FEEDBACK_AUTH_USER_ID_COLUMN",
      "user_id",
    ),
    reviewerNameColumn: getEnvValue(
      "SUPABASE_FEEDBACK_REVIEWER_NAME_COLUMN",
      "reviewer_name",
    ),
    ratingColumn: getEnvValue("SUPABASE_FEEDBACK_RATING_COLUMN", "rating"),
    contentColumn: getEnvValue("SUPABASE_FEEDBACK_CONTENT_COLUMN", "content"),
    imageUrlColumn: getEnvValue(
      "SUPABASE_FEEDBACK_IMAGE_URL_COLUMN",
      "image_url",
    ),
    isHiddenColumn: getEnvValue(
      "SUPABASE_FEEDBACK_IS_HIDDEN_COLUMN",
      "is_hidden",
    ),
    hiddenAtColumn: getEnvValue(
      "SUPABASE_FEEDBACK_HIDDEN_AT_COLUMN",
      "hidden_at",
    ),
    hiddenByColumn: getEnvValue(
      "SUPABASE_FEEDBACK_HIDDEN_BY_COLUMN",
      "hidden_by",
    ),
    createdAtColumn: getEnvValue(
      "SUPABASE_FEEDBACK_CREATED_AT_COLUMN",
      "created_at",
    ),
    updatedAtColumn: getEnvValue(
      "SUPABASE_FEEDBACK_UPDATED_AT_COLUMN",
      "updated_at",
    ),
  },
};

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergeDeep(baseValue, overrideValue) {
  if (Array.isArray(baseValue)) {
    return Array.isArray(overrideValue) ? [...overrideValue] : [...baseValue];
  }

  if (isPlainObject(baseValue)) {
    const result = { ...baseValue };
    const source = isPlainObject(overrideValue) ? overrideValue : {};

    Object.keys(source).forEach((key) => {
      result[key] = mergeDeep(baseValue[key], source[key]);
    });

    return result;
  }

  return overrideValue === undefined ? baseValue : overrideValue;
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getRuntimeEnvHint() {
  const diagnostics =
    window.ClubEnvDiagnostics &&
    typeof window.ClubEnvDiagnostics === "object"
      ? window.ClubEnvDiagnostics
      : null;

  const origin = normalizeString(window.location?.origin);
  const loadedFrom = normalizeString(diagnostics?.loadedFrom);

  if (loadedFrom) {
    return "";
  }

  if (origin.includes(":5500") || origin.includes(":5501")) {
    return (
      " Phat hien ban dang mo bang Live Server/static server " +
      `(${origin}). Hay chay \`cd frontend && npm run start\` ` +
      "cho local, hoac `cd backend && npm start` cho runtime/deploy, roi mo http://localhost:3000/."
    );
  }

  return " Hay chay `cd frontend && npm run start` cho local, hoac `cd backend && npm start` cho runtime/deploy, roi mo http://localhost:3000/.";
}

const SUPABASE_SDK_TIMEOUT_MS = 8000;

const runtimeConfig = isPlainObject(window.__CLUB_SUPABASE_CONFIG__)
  ? window.__CLUB_SUPABASE_CONFIG__
  : {};

export const CLUB_SUPABASE_CONFIG = mergeDeep(
  DEFAULT_SUPABASE_CONFIG,
  runtimeConfig,
);

function isConfiguredValue(value) {
  return Boolean(normalizeString(value));
}

export function getSupabaseConfigError() {
  if (
    !isConfiguredValue(CLUB_SUPABASE_CONFIG.url) ||
    !isConfiguredValue(CLUB_SUPABASE_CONFIG.anonKey)
  ) {
    return (
      "Chua cau hinh Supabase. Hay cap nhat SUPABASE_URL va " +
      "SUPABASE_ANON_KEY trong .env." +
      getRuntimeEnvHint()
    );
  }

  return "";
}

async function loadSupabaseSdk() {
  if (window.supabase?.createClient) {
    return window.supabase;
  }

  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(
        new Error(
          "Het thoi gian tai SDK Supabase tu CDN. Vui long kiem tra mang hoac CDN.",
        ),
      );
    }, SUPABASE_SDK_TIMEOUT_MS);

    function clearLoaderTimeout() {
      window.clearTimeout(timeoutId);
    }

    const existingScript = document.querySelector(
      'script[data-supabase-sdk="true"]',
    );

    if (existingScript) {
      existingScript.addEventListener("load", function handleLoad() {
        clearLoaderTimeout();
        resolve(window.supabase);
      });
      existingScript.addEventListener("error", function handleError() {
        clearLoaderTimeout();
        reject(new Error("Khong the tai SDK Supabase tu CDN."));
      });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
    script.dataset.supabaseSdk = "true";
    script.onload = function onLoad() {
      clearLoaderTimeout();
      resolve(window.supabase);
    };
    script.onerror = function onError() {
      clearLoaderTimeout();
      reject(new Error("Khong the tai SDK Supabase tu CDN."));
    };
    document.head.appendChild(script);
  });
}

let createClient = null;
export let supabase = null;
let supabaseInitPromise = null;

async function initializeSupabaseClient() {
  if (supabase) {
    return supabase;
  }

  const configError = getSupabaseConfigError();
  if (configError) {
    return null;
  }

  if (supabaseInitPromise) {
    return supabaseInitPromise;
  }

  supabaseInitPromise = (async () => {
    try {
      const supabaseBrowserClient = await loadSupabaseSdk();
      createClient = supabaseBrowserClient?.createClient ?? null;

      if (!createClient) {
        throw new Error("SDK Supabase da tai xong nhung createClient khong san sang.");
      }

      supabase = createClient(
        CLUB_SUPABASE_CONFIG.url,
        CLUB_SUPABASE_CONFIG.anonKey,
        {
          auth: {
            autoRefreshToken: true,
            detectSessionInUrl: true,
            persistSession: true,
          },
        },
      );

      window.ClubSupabase = supabase;
      return supabase;
    } catch (error) {
      console.error("Khong the khoi tao Supabase client.", error);
      return null;
    } finally {
      if (!supabase) {
        supabaseInitPromise = null;
      }
    }
  })();

  return supabaseInitPromise;
}

export async function waitForSupabase() {
  return initializeSupabaseClient();
}

window.ClubSupabaseConfig = CLUB_SUPABASE_CONFIG;
window.ClubSupabase = supabase;
void initializeSupabaseClient();
