(function () {
  const STORAGE_KEYS = {
    accounts: "appAccounts",
    session: "appSession",
    legacyAccounts: "studentAccounts",
    legacySession: "studentSession",
  };

  const DEFAULT_ACCOUNTS = [
    {
      id: "student-21110001",
      role: "student",
      loginId: "21110001",
      studentId: "21110001",
      studentName: "Nguyễn Minh Châu",
      studentCourse: "K47",
      studentGender: "Nữ",
      password: "hcmue123",
      isDemo: true,
    },
    {
      id: "student-21110002",
      role: "student",
      loginId: "21110002",
      studentId: "21110002",
      studentName: "Trần Quốc Bảo",
      studentCourse: "K46",
      studentGender: "Nam",
      password: "hcmue123",
      isDemo: true,
    },
    {
      id: "student-21110003",
      role: "student",
      loginId: "21110003",
      studentId: "21110003",
      studentName: "Lê Hoài Nam",
      studentCourse: "K48",
      studentGender: "Nam",
      password: "hcmue123",
      isDemo: true,
    },
    {
      id: "admin-clb",
      role: "admin",
      loginId: "admin.hcmue",
      displayName: "Quản trị viên CLB",
      password: "admin123",
      isDemo: true,
    },
  ];

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function removeKey(key) {
    localStorage.removeItem(key);
  }

  function normalizeString(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function normalizeRole(role) {
    return normalizeString(role).toLowerCase() === "admin" ? "admin" : "student";
  }

  function normalizeGender(value) {
    const normalizedValue = normalizeString(value);

    if (normalizedValue === "Nu") {
      return "Nữ";
    }

    if (normalizedValue === "Khac") {
      return "Khác";
    }

    return normalizedValue || "Khác";
  }

  function getRoleLabel(role) {
    return normalizeRole(role) === "admin" ? "Quản trị viên" : "Sinh viên";
  }

  function toPublicAccount(account) {
    if (!account) {
      return null;
    }

    return {
      id: account.id,
      role: account.role,
      roleLabel: getRoleLabel(account.role),
      loginId: account.loginId,
      displayName: account.displayName,
      studentId: account.studentId || "",
      studentName: account.studentName || "",
      studentCourse: account.studentCourse || "",
      studentGender: account.studentGender || "",
      isDemo: Boolean(account.isDemo),
    };
  }

  function normalizeStudentAccount(account, index) {
    const studentId = normalizeString(account?.studentId || account?.loginId);
    const password = normalizeString(account?.password);

    if (!studentId || !password) {
      return null;
    }

    const studentName =
      normalizeString(account?.studentName || account?.displayName) ||
      `Sinh viên ${studentId}`;

    return {
      id: normalizeString(account?.id) || `student-${index + 1}`,
      role: "student",
      loginId: normalizeString(account?.loginId) || studentId,
      displayName: studentName,
      studentId,
      studentName,
      studentCourse:
        normalizeString(account?.studentCourse) || "Chưa cập nhật",
      studentGender: normalizeGender(account?.studentGender),
      password,
      isDemo: account?.isDemo !== false,
    };
  }

  function normalizeAdminAccount(account, index) {
    const loginId = normalizeString(account?.loginId || account?.username);
    const password = normalizeString(account?.password);

    if (!loginId || !password) {
      return null;
    }

    return {
      id: normalizeString(account?.id) || `admin-${index + 1}`,
      role: "admin",
      loginId,
      displayName:
        normalizeString(account?.displayName || account?.adminName) ||
        "Quản trị viên",
      studentId: "",
      studentName: "",
      studentCourse: "",
      studentGender: "",
      password,
      isDemo: account?.isDemo !== false,
    };
  }

  function getAccountIdentityKey(account) {
    return normalizeString(
      account?.loginId || account?.studentId || account?.username,
    ).toLowerCase();
  }

  function mergeAccountsWithDefaults(rawAccounts) {
    const storedAccounts = Array.isArray(rawAccounts) ? rawAccounts : [];

    if (storedAccounts.length === 0) {
      return DEFAULT_ACCOUNTS;
    }

    const existingIdentityKeys = new Set(
      storedAccounts.map(getAccountIdentityKey).filter(Boolean),
    );
    const missingDefaults = DEFAULT_ACCOUNTS.filter((account) => {
      const identityKey = getAccountIdentityKey(account);
      return identityKey && !existingIdentityKeys.has(identityKey);
    });

    return [...storedAccounts, ...missingDefaults];
  }

  function normalizeAccounts(rawAccounts) {
    const source = mergeAccountsWithDefaults(rawAccounts);
    const seenLoginIds = new Set();

    return source
      .map((account, index) => {
        const normalizedRole = normalizeRole(account?.role);
        const normalizedAccount =
          normalizedRole === "admin"
            ? normalizeAdminAccount(account, index)
            : normalizeStudentAccount(account, index);

        if (!normalizedAccount) {
          return null;
        }

        const uniqueLoginId = normalizedAccount.loginId.toLowerCase();
        if (seenLoginIds.has(uniqueLoginId)) {
          return null;
        }

        seenLoginIds.add(uniqueLoginId);
        return normalizedAccount;
      })
      .filter(Boolean);
  }

  function readStoredAccounts() {
    const modernAccounts = readJson(STORAGE_KEYS.accounts, []);

    if (Array.isArray(modernAccounts) && modernAccounts.length > 0) {
      return modernAccounts;
    }

    const legacyAccounts = readJson(STORAGE_KEYS.legacyAccounts, []);
    return Array.isArray(legacyAccounts) ? legacyAccounts : [];
  }

  function normalizeSession(rawSession, accounts) {
    const source =
      rawSession && typeof rawSession === "object" ? rawSession : null;

    if (!source) {
      return null;
    }

    const sessionAccountId = normalizeString(source.accountId);
    const sessionIdentity = normalizeString(
      source.loginId || source.studentId || source.identity,
    ).toLowerCase();
    const matchedAccount =
      accounts.find((account) => account.id === sessionAccountId) ||
      accounts.find((account) => account.loginId.toLowerCase() === sessionIdentity) ||
      accounts.find(
        (account) =>
          account.studentId &&
          account.studentId.toLowerCase() === sessionIdentity,
      );

    if (!matchedAccount) {
      return null;
    }

    return {
      accountId: matchedAccount.id,
      loggedInAt:
        normalizeString(source.loggedInAt) || new Date().toISOString(),
    };
  }

  function readAuthState() {
    const rawAccounts = readStoredAccounts();
    const accounts = normalizeAccounts(rawAccounts);
    const rawSession =
      readJson(STORAGE_KEYS.session, null) ??
      readJson(STORAGE_KEYS.legacySession, null);
    const session = normalizeSession(rawSession, accounts);

    if (JSON.stringify(rawAccounts) !== JSON.stringify(accounts)) {
      writeJson(STORAGE_KEYS.accounts, accounts);
    }

    removeKey(STORAGE_KEYS.legacyAccounts);

    if (!session) {
      removeKey(STORAGE_KEYS.session);
      removeKey(STORAGE_KEYS.legacySession);
    } else if (JSON.stringify(rawSession) !== JSON.stringify(session)) {
      writeJson(STORAGE_KEYS.session, session);
      removeKey(STORAGE_KEYS.legacySession);
    }

    const currentAccount = session
      ? accounts.find((account) => account.id === session.accountId) || null
      : null;

    return {
      accounts,
      session,
      currentUser: toPublicAccount(currentAccount),
    };
  }

  function login(credentials) {
    const authState = readAuthState();
    const identity = normalizeString(
      credentials?.identity || credentials?.studentId || credentials?.loginId,
    ).toLowerCase();
    const password = normalizeString(credentials?.password);

    if (!identity || !password) {
      return {
        ok: false,
        message: "Vui lòng nhập đầy đủ tài khoản và mật khẩu.",
      };
    }

    const matchedAccount = authState.accounts.find((account) => {
      return (
        account.loginId.toLowerCase() === identity ||
        (account.studentId && account.studentId.toLowerCase() === identity)
      );
    });

    if (!matchedAccount || matchedAccount.password !== password) {
      return {
        ok: false,
        message: "Tài khoản hoặc mật khẩu chưa chính xác.",
      };
    }

    writeJson(STORAGE_KEYS.session, {
      accountId: matchedAccount.id,
      loggedInAt: new Date().toISOString(),
    });

    return {
      ok: true,
      user: toPublicAccount(matchedAccount),
    };
  }

  function logout() {
    removeKey(STORAGE_KEYS.session);
    removeKey(STORAGE_KEYS.legacySession);
    return { ok: true };
  }

  function getCurrentUser() {
    return readAuthState().currentUser;
  }

  function getDemoAccounts(role) {
    const normalizedRole = normalizeString(role).toLowerCase();

    return readAuthState().accounts
      .filter((account) => {
        return (
          account.isDemo &&
          (!normalizedRole || account.role === normalizedRole)
        );
      })
      .map((account) => ({
        ...toPublicAccount(account),
        password: account.password,
      }));
  }

  function isStudent(user) {
    return Boolean(user) && normalizeRole(user.role) === "student";
  }

  function isAdmin(user) {
    return Boolean(user) && normalizeRole(user.role) === "admin";
  }

  window.ClubAuth = {
    getCurrentUser,
    getDemoAccounts,
    getDemoStudentAccounts: function () {
      return getDemoAccounts("student");
    },
    getRoleLabel,
    isAdmin,
    isLoggedIn: function () {
      return Boolean(getCurrentUser());
    },
    isStudent,
    login,
    loginStudent: login,
    logout,
    logoutStudent: logout,
    normalizeString,
    readAuthState,
  };
})();
