import {
  CLUB_SUPABASE_CONFIG,
  getSupabaseConfigError,
  supabase,
  waitForSupabase,
} from "./supabase-config.js";

const listeners = new Set();
const authState = {
  currentProfile: null,
  currentSession: null,
  currentUser: null,
  readyPromise: null,
};
let authSubscriptionInitialized = false;
let authRefreshPromise = null;
const AUTH_LOOKUP_TIMEOUT_MS = 8000;
const AUTH_REQUEST_TIMEOUT_MS = 15000;
const AUTH_SESSION_TIMEOUT_MS = 8000;

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRole(role) {
  return normalizeString(role).toLowerCase() === "admin" ? "admin" : "student";
}

function normalizeGender(value) {
  const normalizedValue = normalizeString(value);

  if (!normalizedValue) {
    return "";
  }

  if (normalizedValue === "Nu") {
    return "Nữ";
  }

  if (normalizedValue === "Khac") {
    return "Khác";
  }

  return normalizedValue;
}

function getRoleLabel(role) {
  return normalizeRole(role) === "admin" ? "Quản trị viên" : "Sinh viên";
}

function withTimeout(promise, timeoutMs, message) {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);

    Promise.resolve(promise).then(
      (value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
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

function getProfileLookupColumns() {
  return uniqueValues([
    CLUB_SUPABASE_CONFIG.profile.loginIdColumn,
    CLUB_SUPABASE_CONFIG.profile.studentIdColumn,
    ...CLUB_SUPABASE_CONFIG.profile.extraLookupColumns,
    CLUB_SUPABASE_CONFIG.profile.emailColumn,
  ]);
}

function toPublicUser(authUser, profile) {
  if (!authUser && !profile) {
    return null;
  }

  const metadata = authUser?.user_metadata ?? {};
  const role = normalizeRole(
    pickFirst(profile, [
      CLUB_SUPABASE_CONFIG.profile.roleColumn,
      "role",
    ]) || metadata.role,
  );
  const email = normalizeString(
    authUser?.email ||
      pickFirst(profile, [CLUB_SUPABASE_CONFIG.profile.emailColumn, "email"]),
  );
  const loginId = normalizeString(
    pickFirst(profile, [
      CLUB_SUPABASE_CONFIG.profile.loginIdColumn,
      CLUB_SUPABASE_CONFIG.profile.studentIdColumn,
      "login_id",
      "student_id",
      "username",
    ]) ||
      metadata.login_id ||
      (email ? email.split("@")[0] : ""),
  );
  const studentId = normalizeString(
    pickFirst(profile, [
      CLUB_SUPABASE_CONFIG.profile.studentIdColumn,
      "student_id",
    ]) || metadata.student_id || loginId,
  );
  const studentName = normalizeString(
    pickFirst(profile, [
      CLUB_SUPABASE_CONFIG.profile.studentNameColumn,
      "student_name",
      CLUB_SUPABASE_CONFIG.profile.displayNameColumn,
      "display_name",
      "full_name",
    ]) ||
      metadata.student_name ||
      metadata.full_name ||
      metadata.name ||
      loginId,
  );
  const displayName = normalizeString(
    pickFirst(profile, [
      CLUB_SUPABASE_CONFIG.profile.displayNameColumn,
      "display_name",
      "full_name",
    ]) || metadata.display_name || metadata.full_name || studentName,
  );

  if (role === "admin") {
    return {
      id: authUser?.id || normalizeString(pickFirst(profile, ["id"])),
      email,
      loginId,
      displayName: displayName || "Quản trị viên",
      role,
      roleLabel: getRoleLabel(role),
      studentCourse: "",
      studentGender: "",
      studentId: "",
      studentName: "",
    };
  }

  return {
    id: authUser?.id || normalizeString(pickFirst(profile, ["id"])),
    email,
    loginId: loginId || studentId,
    displayName: displayName || studentName,
    role,
    roleLabel: getRoleLabel(role),
    studentCourse: normalizeString(
      pickFirst(profile, [
        CLUB_SUPABASE_CONFIG.profile.studentCourseColumn,
        "student_course",
        "course",
      ]) || metadata.student_course,
    ),
    studentGender: normalizeGender(
      pickFirst(profile, [
        CLUB_SUPABASE_CONFIG.profile.studentGenderColumn,
        "student_gender",
        "gender",
      ]) || metadata.student_gender,
    ),
    studentId,
    studentName,
  };
}

function notifyListeners() {
  listeners.forEach((listener) => {
    try {
      listener(authState.currentUser);
    } catch (error) {
      console.error("Khong the dong bo listener auth.", error);
    }
  });
}

function buildUserSignature(user) {
  if (!user) {
    return "";
  }

  return JSON.stringify({
    displayName: normalizeString(user.displayName),
    email: normalizeString(user.email),
    id: normalizeString(user.id),
    loginId: normalizeString(user.loginId),
    role: normalizeString(user.role),
    studentCourse: normalizeString(user.studentCourse),
    studentGender: normalizeString(user.studentGender),
    studentId: normalizeString(user.studentId),
    studentName: normalizeString(user.studentName),
  });
}

function buildProfileSignature(profile) {
  if (!profile) {
    return "";
  }

  return JSON.stringify(profile);
}

function buildSessionSignature(session) {
  if (!session?.user) {
    return "";
  }

  return JSON.stringify({
    accessToken: normalizeString(session.access_token),
    refreshToken: normalizeString(session.refresh_token),
    userId: normalizeString(session.user.id),
  });
}

function commitAuthState({
  profile = null,
  session = null,
  user = null,
}) {
  const previousSignature = JSON.stringify({
    profile: buildProfileSignature(authState.currentProfile),
    session: buildSessionSignature(authState.currentSession),
    user: buildUserSignature(authState.currentUser),
  });
  const nextSignature = JSON.stringify({
    profile: buildProfileSignature(profile),
    session: buildSessionSignature(session),
    user: buildUserSignature(user),
  });

  authState.currentProfile = profile;
  authState.currentSession = session;
  authState.currentUser = user;

  if (previousSignature !== nextSignature) {
    notifyListeners();
  }
}

function clearAuthState() {
  commitAuthState({
    profile: null,
    session: null,
    user: null,
  });
}

function buildFallbackProfileForSession(session) {
  if (!session?.user || !authState.currentProfile) {
    return null;
  }

  const currentProfileId = normalizeString(authState.currentProfile.id);
  const sessionUserId = normalizeString(session.user.id);

  return currentProfileId && currentProfileId === sessionUserId
    ? authState.currentProfile
    : null;
}

async function queryProfileBy(column, value) {
  if (!supabase || !column || !value) {
    return null;
  }

  const { data, error } = await supabase
    .from(CLUB_SUPABASE_CONFIG.tables.profiles)
    .select("*")
    .eq(column, value)
    .limit(1)
    .maybeSingle();

  if (error) {
    return null;
  }

  return data ?? null;
}

async function fetchProfileByAuthUser(authUser) {
  if (!supabase || !authUser) {
    return null;
  }

  const authIdColumns = uniqueValues([
    CLUB_SUPABASE_CONFIG.profile.authUserIdColumn,
    "id",
    "user_id",
    "auth_user_id",
  ]);

  for (const column of authIdColumns) {
    const profile = await queryProfileBy(column, authUser.id);
    if (profile) {
      return profile;
    }
  }

  if (authUser.email) {
    return queryProfileBy(
      CLUB_SUPABASE_CONFIG.profile.emailColumn || "email",
      authUser.email,
    );
  }

  return null;
}

async function resolveLoginRecord(identity) {
  if (!identity) {
    return {
      email: "",
      profile: null,
    };
  }

  if (identity.includes("@")) {
    return {
      email: identity,
      profile: null,
    };
  }

  const identityDomain = normalizeString(
    CLUB_SUPABASE_CONFIG.auth.identityDomain,
  );
  const fallbackEmail = identityDomain ? `${identity}@${identityDomain}` : "";

  if (!supabase || !authState.currentSession?.user) {
    return {
      email: fallbackEmail,
      profile: null,
    };
  }

  for (const column of getProfileLookupColumns()) {
    const profile = await queryProfileBy(column, identity);
    if (profile) {
      const email = normalizeString(
        pickFirst(profile, [
          CLUB_SUPABASE_CONFIG.profile.emailColumn,
          "email",
        ]),
      );

      return {
        email,
        profile,
      };
    }
  }

  return {
    email: fallbackEmail,
    profile: null,
  };
}

function mapAuthError(error) {
  const message = normalizeString(error?.message).toLowerCase();

  if (!message) {
    return "Khong the xac thuc tai khoan luc nay.";
  }

  if (
    message.includes("invalid login credentials") ||
    message.includes("email not confirmed")
  ) {
    return "Tai khoan hoac mat khau chua chinh xac.";
  }

  if (message.includes("fetch")) {
    return "Khong the ket noi toi Supabase. Vui long kiem tra URL, key va mang.";
  }

  if (message.includes("qua lau") || message.includes("timed out")) {
    return error.message;
  }

  return error.message;
}

async function refreshCurrentUser(options = {}) {
  const {
    fallbackSession = null,
    preserveCurrentUserOnError = true,
    skipSessionLookup = false,
  } = options;

  if (authRefreshPromise && !fallbackSession?.user) {
    return authRefreshPromise;
  }

  const refreshPromise = (async () => {
    const client = await waitForSupabase();

    if (!client) {
      if (!authState.currentUser) {
        clearAuthState();
      }
      return authState.currentUser;
    }

    let session = fallbackSession;

    if (!session?.user && !skipSessionLookup) {
      try {
        const {
          data: { session: resolvedSession },
          error: sessionError,
        } = await withTimeout(
          client.auth.getSession(),
          AUTH_SESSION_TIMEOUT_MS,
          "Khong the tai trang thai phien dang nhap luc nay.",
        );

        if (sessionError) {
          throw sessionError;
        }

        session = resolvedSession ?? null;
      } catch (error) {
        console.warn("Khong the dong bo session hien tai.", error);

        if (authState.currentSession?.user && preserveCurrentUserOnError) {
          return authState.currentUser;
        }

        return null;
      }
    }

    if (!session?.user) {
      clearAuthState();
      return null;
    }

    const fallbackProfile = buildFallbackProfileForSession(session);
    commitAuthState({
      profile: fallbackProfile,
      session,
      user: toPublicUser(session.user, fallbackProfile),
    });

    let profile = fallbackProfile;

    try {
      profile =
        (await withTimeout(
          fetchProfileByAuthUser(session.user),
          AUTH_LOOKUP_TIMEOUT_MS,
          "Dang tai ho so nguoi dung qua lau.",
        )) ?? fallbackProfile;
    } catch (error) {
      console.warn("Khong the dong bo profile tu profiles.", error);
    }

    commitAuthState({
      profile,
      session,
      user: toPublicUser(session.user, profile),
    });

    return authState.currentUser;
  })().finally(() => {
    if (authRefreshPromise === refreshPromise) {
      authRefreshPromise = null;
    }
  });

  authRefreshPromise = refreshPromise;
  return authRefreshPromise;
}

function ensureAuthSubscription() {
  if (authSubscriptionInitialized) {
    return;
  }

  authSubscriptionInitialized = true;
  waitForSupabase()
    .then((client) => {
      if (!client) {
        return;
      }

      client.auth.onAuthStateChange(function handleAuthStateChange(_event, session) {
        if (!session?.user) {
          clearAuthState();
          return;
        }

        refreshCurrentUser({
          fallbackSession: session,
          preserveCurrentUserOnError: true,
          skipSessionLookup: true,
        }).catch((error) => {
          console.warn("Khong the dong bo auth state tu su kien Supabase.", error);
        });
      });
    })
    .catch((error) => {
      console.error("Khong the dang ky listener auth state.", error);
    });
}

async function ready() {
  ensureAuthSubscription();

  if (authState.currentSession?.user && authState.currentUser) {
    if (!authRefreshPromise) {
      refreshCurrentUser({
        fallbackSession: authState.currentSession,
        preserveCurrentUserOnError: true,
        skipSessionLookup: true,
      }).catch((error) => {
        console.warn("Khong the lam moi profile nen giu nguyen session hien tai.", error);
      });
    }

    return authState.currentUser;
  }

  if (authState.readyPromise) {
    return authState.readyPromise;
  }

  authState.readyPromise = refreshCurrentUser({
    preserveCurrentUserOnError: true,
  })
    .catch((error) => {
      console.warn("Khong the khoi tao session luc nay.", error);
      return authState.currentUser;
    })
    .finally(() => {
      authState.readyPromise = null;
    });

  return authState.readyPromise;
}

async function login(credentials) {
  const identity = normalizeString(
    credentials?.identity || credentials?.studentId || credentials?.loginId,
  );
  const password = normalizeString(credentials?.password);

  if (!identity || !password) {
    return {
      ok: false,
      message: "Vui long nhap day du tai khoan va mat khau.",
    };
  }

  const configError = getSupabaseConfigError();
  if (configError) {
    return {
      ok: false,
      message: configError,
    };
  }

  await waitForSupabase();

  if (!supabase) {
    return {
      ok: false,
      message: "Khong the khoi tao Supabase.",
    };
  }

  try {
    const resolvedLogin = await withTimeout(
      resolveLoginRecord(identity),
      AUTH_LOOKUP_TIMEOUT_MS,
      "Tra cuu tai khoan dang nhap qua lau. Vui long thu lai.",
    );

    if (!resolvedLogin.email) {
      return {
        ok: false,
        message:
          "Khong the anh xa MSSV/username sang email Supabase. Hay cap nhat bang profiles hoac SUPABASE_AUTH_IDENTITY_DOMAIN trong .env.",
      };
    }

    const { data, error } = await withTimeout(
      supabase.auth.signInWithPassword({
        email: resolvedLogin.email,
        password,
      }),
      AUTH_REQUEST_TIMEOUT_MS,
      "Yeu cau dang nhap toi Supabase qua lau. Vui long kiem tra mang va thu lai.",
    );

    if (error) {
      return {
        ok: false,
        message: mapAuthError(error),
      };
    }

    const initialProfile = resolvedLogin.profile || null;
    commitAuthState({
      profile: initialProfile,
      session: data.session ?? null,
      user: toPublicUser(data.user, initialProfile),
    });

    withTimeout(
      fetchProfileByAuthUser(data.user),
      AUTH_LOOKUP_TIMEOUT_MS,
      "Dang nhap thanh cong nhung tai ho so nguoi dung qua lau.",
    )
      .then((profile) => {
        if (!profile) {
          return;
        }

        commitAuthState({
          profile,
          session: data.session ?? authState.currentSession,
          user: toPublicUser(data.user, profile),
        });
      })
      .catch((error) => {
        console.warn("Khong the dong bo profile ngay sau dang nhap.", error);
      });

    return {
      ok: true,
      user: authState.currentUser,
    };
  } catch (error) {
    return {
      ok: false,
      message: mapAuthError(error),
    };
  }
}

async function logout() {
  await waitForSupabase();

  if (!supabase) {
    clearAuthState();
    return { ok: true };
  }

  const { error } = await supabase.auth.signOut();

  if (error) {
    return {
      ok: false,
      message: mapAuthError(error),
    };
  }

  clearAuthState();

  return { ok: true };
}

async function readAuthState() {
  await ready();

  return {
    currentUser: authState.currentUser,
    profile: authState.currentProfile,
    session: authState.currentSession,
  };
}

function getCurrentProfile() {
  return authState.currentProfile;
}

function getCurrentSession() {
  return authState.currentSession;
}

function getCurrentUser() {
  return authState.currentUser;
}

function getDemoAccounts(role) {
  const normalizedRole = normalizeString(role).toLowerCase();
  const demoAccounts = Array.isArray(CLUB_SUPABASE_CONFIG.auth.demoAccounts)
    ? CLUB_SUPABASE_CONFIG.auth.demoAccounts
    : [];

  return demoAccounts
    .filter((account) => {
      const accountRole = normalizeRole(account?.role);
      return !normalizedRole || accountRole === normalizedRole;
    })
    .map((account, index) => {
      const roleValue = normalizeRole(account?.role);
      return {
        id: normalizeString(account?.id) || `demo-${index + 1}`,
        role: roleValue,
        roleLabel: getRoleLabel(roleValue),
        loginId: normalizeString(account?.loginId || account?.studentId),
        displayName: normalizeString(account?.displayName),
        password: normalizeString(account?.password),
        studentId: normalizeString(account?.studentId),
        studentName: normalizeString(account?.studentName),
        studentCourse: normalizeString(account?.studentCourse),
        studentGender: normalizeGender(account?.studentGender),
        isDemo: true,
      };
    });
}

function isStudent(user) {
  return Boolean(user) && normalizeRole(user.role) === "student";
}

function isAdmin(user) {
  return Boolean(user) && normalizeRole(user.role) === "admin";
}

function subscribe(listener) {
  if (typeof listener !== "function") {
    return function noop() {};
  }

  listeners.add(listener);

  return function unsubscribe() {
    listeners.delete(listener);
  };
}

window.ClubAuth = {
  getCurrentProfile,
  getCurrentSession,
  getCurrentUser,
  getDemoAccounts,
  getDemoStudentAccounts: function getDemoStudentAccounts() {
    return getDemoAccounts("student");
  },
  getRoleLabel,
  isAdmin,
  isLoggedIn: function isLoggedIn() {
    return Boolean(getCurrentUser());
  },
  isStudent,
  login,
  loginStudent: login,
  logout,
  logoutStudent: logout,
  normalizeString,
  readAuthState,
  ready,
  subscribe,
};

ready().catch((error) => {
  console.error("Khong the khoi tao trang thai dang nhap.", error);
});
