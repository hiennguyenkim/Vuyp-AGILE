import "../../services/auth.js";
import "../../services/storage.js";

const { escapeHtml } = window.AppUtils;

const loginForm = document.getElementById("loginForm");
const loginIdentityInput = document.getElementById("loginIdentity");
const loginPasswordInput = document.getElementById("loginPassword");
const loginError = document.getElementById("loginError");
const loginAlert = document.getElementById("loginAlert");
const loginSubmitButton = loginForm?.querySelector('button[type="submit"]');
const loginCardTitle = document.getElementById("loginCardTitle");
const loginCardDescription = document.getElementById("loginCardDescription");
const sessionPanel = document.getElementById("sessionPanel");
const sessionName = document.getElementById("sessionName");
const sessionRole = document.getElementById("sessionRole");
const continueBtn = document.getElementById("continueBtn");
const logoutBtn = document.getElementById("logoutBtn");
const publicEventList = document.getElementById("publicEventList");
const liveEventCount = document.getElementById("liveEventCount");
const upcomingEventCount = document.getElementById("upcomingEventCount");
const nextEventValue = document.getElementById("nextEventValue");

function syncAuthenticatedLoginShell(user = window.ClubAuth?.getCurrentUser?.()) {
  const isAuthenticated = Boolean(user);

  document.body.classList.toggle("auth-session-active", isAuthenticated);

  if (!isAuthenticated) {
    return;
  }

  const destination = resolveDestination(user, getRouteContext());

  if (loginCardTitle) {
    loginCardTitle.innerText = "Phiên đăng nhập đang hoạt động";
  }

  if (loginCardDescription) {
    loginCardDescription.innerText =
      "Bạn đã đăng nhập thành công. Có thể tiếp tục tới đúng khu vực làm việc hoặc đăng xuất để đổi tài khoản.";
  }

  if (loginForm) {
    loginForm.hidden = true;
    loginForm.style.display = "none";
  }

  if (loginError) {
    loginError.innerText = "";
  }

  if (loginAlert) {
    loginAlert.hidden = false;
    loginAlert.innerText = "Phiên đăng nhập đã sẵn sàng.";
  }

  if (sessionPanel) {
    sessionPanel.hidden = false;
  }

  if (sessionName) {
    sessionName.innerText =
      user.displayName || user.studentName || user.loginId || "Người dùng";
  }

  if (sessionRole) {
    sessionRole.innerText =
      user.role === "admin"
        ? `${user.roleLabel} - ${user.loginId}`
        : `${user.roleLabel} - ${user.studentId || user.loginId}`;
  }

  if (continueBtn) {
    if ("href" in continueBtn) {
      continueBtn.href = destination;
    }

    continueBtn.onclick = function onContinueAuthenticatedSession() {
      window.location.href = destination;
    };
  }
}

function syncAuthenticatedLoginShellSoon() {
  Promise.resolve(window.ClubAuth?.ready?.())
    .catch(() => null)
    .then(() => {
      syncAuthenticatedLoginShell();
    });
}

syncAuthenticatedLoginShell();
syncAuthenticatedLoginShellSoon();
window.addEventListener("pageshow", syncAuthenticatedLoginShellSoon);
window.addEventListener("focus", syncAuthenticatedLoginShellSoon);
window.ClubAuth?.subscribe?.(() => {
  syncAuthenticatedLoginShell();
});

function setSubmittingState(isSubmitting) {
  if (!loginSubmitButton) {
    return;
  }

  loginSubmitButton.disabled = isSubmitting;
  loginSubmitButton.innerText = isSubmitting ? "Đang đăng nhập..." : "Đăng nhập";
}

function validateLoginInputs() {
  const identity = loginIdentityInput.value.trim();
  const password = loginPasswordInput.value.trim();

  if (!identity || !password) {
    loginError.innerText = "Vui lòng nhập đầy đủ tài khoản và mật khẩu.";

    if (!identity) {
      loginIdentityInput.focus();
    } else {
      loginPasswordInput.focus();
    }

    return null;
  }

  return {
    identity,
    password,
  };
}

function getRouteContext() {
  const params = new URLSearchParams(window.location.search);
  return {
    next: params.get("next"),
    eventId: params.get("eventId"),
    action: params.get("action"),
    view: params.get("view"),
  };
}

function buildStudentUrl(context) {
  const params = new URLSearchParams();

  if (context.eventId) {
    params.set("eventId", context.eventId);
  }

  if (context.action) {
    params.set("action", context.action);
  }

  if (context.view) {
    params.set("view", context.view);
  }

  const query = params.toString();
  return `../student/index.html${query ? `?${query}` : ""}`;
}

function buildAdminUrl() {
  return "../admin/index.html";
}

function buildEventDetailUrl(eventId) {
  return `../events/detail.html?id=${encodeURIComponent(eventId)}`;
}

function resolveDestination(user, context) {
  if (window.ClubAuth.isAdmin(user)) {
    return buildAdminUrl();
  }

  return buildStudentUrl(context);
}

function getToneRank(tone) {
  switch (tone) {
    case "live":
      return 0;
    case "open":
      return 1;
    case "full":
      return 2;
    default:
      return 3;
  }
}

function formatCompactMoment(value) {
  if (!value) {
    return "Đang cập nhật";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function updateEventSnapshot(eventCards = []) {
  if (upcomingEventCount) {
    upcomingEventCount.innerText = String(eventCards.length);
  }

  if (liveEventCount) {
    liveEventCount.innerText = String(
      eventCards.filter((item) => item.status.tone === "live").length,
    );
  }

  if (!nextEventValue) {
    return;
  }

  const nextEvent = eventCards[0]?.event;

  if (!nextEvent) {
    nextEventValue.innerText = "Chưa có lịch mới";
    return;
  }

  nextEventValue.innerText = `${nextEvent.code} • ${formatCompactMoment(nextEvent.start)}`;
}

async function renderPublicEvents() {
  if (!publicEventList) {
    return;
  }

  publicEventList.innerHTML = `
    <div class="public-event-empty">
      <span>Đang tải dữ liệu sự kiện...</span>
    </div>
  `;

  try {
    const eventCards = (await window.ClubStorage.getUpcomingEvents())
      .map((event) => ({
        event,
        status: window.ClubStorage.getEventStatus(event),
      }))
      .sort((firstItem, secondItem) => {
        const toneDiff =
          getToneRank(firstItem.status.tone) - getToneRank(secondItem.status.tone);

        if (toneDiff !== 0) {
          return toneDiff;
        }

        const firstTime = Date.parse(firstItem.event.start || "") || 0;
        const secondTime = Date.parse(secondItem.event.start || "") || 0;

        if (firstTime !== secondTime) {
          return firstTime - secondTime;
        }

        return String(firstItem.event.code || "").localeCompare(
          String(secondItem.event.code || ""),
        );
      });

    updateEventSnapshot(eventCards);

    if (eventCards.length === 0) {
      publicEventList.innerHTML = `
        <div class="public-event-empty">
          <span>Hiện chưa có sự kiện đang mở hoặc sắp diễn ra.</span>
          <span class="empty-state-note">
            Khi ban tổ chức cập nhật chương trình mới, lịch sự kiện sẽ xuất hiện ngay tại đây.
          </span>
        </div>
      `;
      return;
    }

    publicEventList.innerHTML = eventCards
      .slice(0, 4)
      .map(({ event, status }) => {
        const schedule = window.ClubStorage.formatDateRange(event.start, event.end);
        const summary =
          event.desc ||
          (event.speaker
            ? `Gặp gỡ cùng ${event.speaker}.`
            : "Thông tin chương trình sẽ được cập nhật thêm trong thời gian tới.");
        const actionLabel =
          status.canRegister ? "Xem chương trình" : "Xem thông tin";

        return `
          <article class="public-event-item">
            <div class="public-event-top">
              <span class="public-event-code">${escapeHtml(event.code)}</span>
              <span class="public-event-status public-event-status-${escapeHtml(status.tone)}">
                ${escapeHtml(status.text)}
              </span>
            </div>
            <strong class="public-event-name">${escapeHtml(event.name)}</strong>
            <span class="public-event-desc">${escapeHtml(summary)}</span>
            <div class="public-event-meta">
              <span><strong>Thời gian:</strong> ${escapeHtml(schedule)}</span>
              <span><strong>Địa điểm:</strong> ${escapeHtml(event.location || "Chưa cập nhật")}</span>
              <span><strong>Quy mô:</strong> ${escapeHtml(event.registered || 0)}/${escapeHtml(event.max || 0)} người đăng ký</span>
            </div>
            <div class="public-event-footer">
              <span><strong>Diễn giả:</strong> ${escapeHtml(event.speaker || "Đang cập nhật")}</span>
              <a href="${buildEventDetailUrl(event.id)}" class="info-card-link">
                ${actionLabel}
              </a>
            </div>
          </article>
        `;
      })
      .join("");
  } catch (error) {
    updateEventSnapshot();
    publicEventList.innerHTML = `
      <div class="public-event-empty">
        <span>Chưa thể tải dữ liệu sự kiện lúc này.</span>
        <span class="empty-state-note">${escapeHtml(
          error?.message || "Vui lòng thử lại khi hệ thống đồng bộ xong.",
        )}</span>
      </div>
    `;
  }
}

function setAlert(message, tone = "info") {
  if (!message) {
    loginAlert.hidden = true;
    loginAlert.innerText = "";
    loginAlert.className = "login-alert";
    return;
  }

  loginAlert.hidden = false;
  loginAlert.innerText = message;
  loginAlert.className =
    tone === "warning" ? "login-alert login-alert-warning" : "login-alert";
}

function describeIntent(user, context) {
  if (!user) {
    if (context.action === "register" && context.eventId) {
      return {
        title: "Đăng nhập để hoàn tất đăng ký sự kiện",
        description:
          "Bạn đang xem một chương trình cụ thể. Sau khi xác thực, hệ thống sẽ đưa bạn quay lại đúng luồng đăng ký hiện tại để tiếp tục xác nhận tham gia.",
        alert: "Ngữ cảnh đăng ký sự kiện đang được giữ lại để bạn không phải tìm lại chương trình từ đầu.",
      };
    }

    if (context.next === "admin") {
      return {
        title: "Đăng nhập để điều phối chương trình",
        description:
          "Tài khoản quản trị sẽ được chuyển tới khu vực tạo sự kiện, theo dõi danh sách đăng ký và hỗ trợ điểm danh bằng QR.",
        alert: "",
      };
    }

    if (context.next === "student") {
      return {
        title: "Đăng nhập để quản lý hành trình tham gia",
        description:
          "Sinh viên có thể xem các sự kiện đã đăng ký, mở QR cá nhân và theo dõi trạng thái tham gia ngay sau khi đăng nhập.",
        alert: "",
      };
    }

    return {
      title: "Đăng nhập để tham gia trọn vẹn trải nghiệm sự kiện",
      description:
        "Bạn có thể xem lịch sự kiện công khai ngay trên trang. Khi muốn đăng ký, nhận QR hoặc quản lý dữ liệu, hệ thống sẽ điều hướng bạn vào đúng phân hệ theo vai trò tài khoản.",
      alert: "",
    };
  }

  if (window.ClubAuth.isAdmin(user) && context.action === "register") {
    return {
      title: "Tài khoản hiện tại là quản trị viên",
      description:
        "Quản trị viên sẽ được đưa tới khu vực điều phối chương trình. Chỉ tài khoản sinh viên mới có thể xác nhận suất tham gia sự kiện.",
      alert:
        "Bạn đang đăng nhập bằng tài khoản admin nên hệ thống sẽ ưu tiên mở trang quản trị thay vì bước đăng ký.",
    };
  }

  return {
    title: "Phiên đăng nhập đang hoạt động",
    description:
      "Bạn có thể tiếp tục tới đúng khu vực theo vai trò hiện tại hoặc đăng xuất để chuyển sang tài khoản khác.",
    alert: "",
  };
}

async function renderHome() {
  await window.ClubAuth.ready();

  const context = getRouteContext();
  const currentUser = window.ClubAuth.getCurrentUser();
  const intent = describeIntent(currentUser, context);

  loginCardTitle.innerText = intent.title;
  loginCardDescription.innerText = intent.description;
  setAlert(intent.alert, intent.alert ? "warning" : "info");

  if (!currentUser) {
    loginForm.hidden = false;
    sessionPanel.hidden = true;
    await renderPublicEvents();
    return;
  }

  loginForm.hidden = true;
  sessionPanel.hidden = false;
  sessionName.innerText = currentUser.studentName || currentUser.displayName;
  sessionRole.innerText = `${currentUser.roleLabel} - ${currentUser.loginId}`;
  continueBtn.innerText = window.ClubAuth.isAdmin(currentUser)
    ? "Vào trang quản trị"
    : "Vào khu vực sinh viên";
  await renderPublicEvents();

  if (
    (context.action === "register" && window.ClubAuth.isStudent(currentUser)) ||
    (context.next && context.next === currentUser.role)
  ) {
    window.location.replace(resolveDestination(currentUser, context));
  }
}

async function handleLogin(event) {
  event.preventDefault();
  loginError.innerText = "";
  setSubmittingState(true);

  try {
    const credentials = validateLoginInputs();
    if (!credentials) {
      return;
    }

    if (!window.ClubAuth?.login) {
      loginError.innerText =
        "Hệ thống đăng nhập chưa sẵn sàng. Vui lòng tải lại trang.";
      return;
    }

    const result = await window.ClubAuth.login(credentials);

    if (!result.ok) {
      loginError.innerText = result.message;
      return;
    }

    const context = getRouteContext();
    window.location.href = resolveDestination(result.user, context);
  } finally {
    setSubmittingState(false);
  }
}

function handleContinue() {
  const currentUser = window.ClubAuth.getCurrentUser();

  if (!currentUser) {
    return;
  }

  window.location.href = resolveDestination(currentUser, getRouteContext());
}

async function handleLogout() {
  await window.ClubAuth.logout();
  loginForm.reset();
  await renderHome();
}

function handleUnexpectedError(error) {
  console.error(error);
  loginError.innerText =
    error?.message || "Đã xảy ra lỗi khi xử lý đăng nhập. Vui lòng thử lại.";
}

loginForm.addEventListener("submit", function onSubmit(event) {
  handleLogin(event).catch(handleUnexpectedError);
});
continueBtn.addEventListener("click", handleContinue);
logoutBtn.addEventListener("click", function onLogoutClick() {
  handleLogout().catch(handleUnexpectedError);
});

window.addEventListener("focus", function onFocus() {
  renderHome().catch(handleUnexpectedError);
});

window.ClubAuth.subscribe(function onAuthChange() {
  renderHome().catch(handleUnexpectedError);
});

renderHome().catch(handleUnexpectedError);
