const { escapeHtml } = window.AppUtils;

const loginForm = document.getElementById("loginForm");
const loginIdentityInput = document.getElementById("loginIdentity");
const loginPasswordInput = document.getElementById("loginPassword");
const loginError = document.getElementById("loginError");
const loginAlert = document.getElementById("loginAlert");
const loginCardTitle = document.getElementById("loginCardTitle");
const loginCardDescription = document.getElementById("loginCardDescription");
const sessionPanel = document.getElementById("sessionPanel");
const sessionName = document.getElementById("sessionName");
const sessionRole = document.getElementById("sessionRole");
const continueBtn = document.getElementById("continueBtn");
const logoutBtn = document.getElementById("logoutBtn");
const demoAccountList = document.getElementById("demoAccountList");
const publicEventList = document.getElementById("publicEventList");

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

function renderDemoAccounts() {
  if (!demoAccountList || !window.ClubAuth) {
    return;
  }

  const demoAccounts = window.ClubAuth.getDemoAccounts();

  demoAccountList.innerHTML = demoAccounts
    .map((account) => {
      const identityLabel = account.role === "admin" ? "Tài khoản" : "MSSV";
      const displayName = account.studentName || account.displayName;

      return `
        <article class="demo-account">
          <span class="demo-role">${escapeHtml(account.roleLabel)}</span>
          <strong>${escapeHtml(displayName)}</strong>
          <span>${escapeHtml(identityLabel)}: ${escapeHtml(account.loginId)}</span>
          <span>Mật khẩu: ${escapeHtml(account.password)}</span>
        </article>
      `;
    })
    .join("");
}

function renderPublicEvents() {
  if (!publicEventList) {
    return;
  }

  if (!window.ClubStorage) {
    publicEventList.innerHTML = `
      <div class="public-event-empty">
        <span>Chưa thể tải dữ liệu sự kiện lúc này.</span>
        <span class="empty-state-note">Vui lòng thử lại khi hệ thống đồng bộ xong.</span>
      </div>
    `;
    return;
  }

  const eventCards = [...window.ClubStorage.readState().events]
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

  if (eventCards.length === 0) {
    publicEventList.innerHTML = `
      <div class="public-event-empty">
        <span>Hiện chưa có sự kiện nào trong hệ thống.</span>
        <span class="empty-state-note">
          Khi có dữ liệu mới, danh sách sẽ tự xuất hiện ngay tại trang này.
        </span>
      </div>
    `;
    return;
  }

  publicEventList.innerHTML = eventCards
    .map(({ event, status }) => {
      const schedule = window.ClubStorage.formatDateRange(event.start, event.end);
      const summary =
        event.desc ||
        (event.speaker ? `Diễn giả: ${event.speaker}` : "Thông tin đang được cập nhật.");

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
            <span>Thời gian: ${escapeHtml(schedule)}</span>
            <span>Địa điểm: ${escapeHtml(event.location || "Chưa cập nhật")}</span>
            <span>Số lượng: ${escapeHtml(event.registered || 0)}/${escapeHtml(event.max || 0)}</span>
          </div>
          <a href="${buildEventDetailUrl(event.id)}" class="info-card-link">
            Xem chi tiết sự kiện
          </a>
        </article>
      `;
    })
    .join("");
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
        title: "Đăng nhập để tiếp tục đăng ký sự kiện",
        description:
          "Danh sách sự kiện đang hiển thị ngay bên dưới. Sau khi xác thực, tài khoản sinh viên sẽ được đưa thẳng tới bước đăng ký cho sự kiện bạn vừa chọn.",
        alert: "Bạn đang đi từ nút đăng ký sự kiện. Hệ thống sẽ giữ lại thao tác này sau khi đăng nhập.",
      };
    }

    if (context.next === "admin") {
      return {
        title: "Đăng nhập để vào khu vực quản trị",
        description:
          "Danh sách sự kiện công khai vẫn hiển thị ngay trên trang, còn tài khoản quản trị sẽ được chuyển tới khu vực quản lý sau khi xác thực.",
        alert: "",
      };
    }

    if (context.next === "student") {
      return {
        title: "Đăng nhập để vào khu vực sinh viên",
        description:
          "Danh sách sự kiện công khai đang hiển thị trực tiếp. Sau khi đăng nhập, sinh viên sẽ được đưa tới trang cá nhân và khu vực đăng ký.",
        alert: "",
      };
    }

    return {
      title: "Truy cập theo vai trò tài khoản",
      description:
        "Danh sách sự kiện được hiển thị trực tiếp trên trang. Sinh viên sẽ được chuyển tới trang đăng ký, còn quản trị viên sẽ vào trang quản lý.",
      alert: "",
    };
  }

  if (window.ClubAuth.isAdmin(user) && context.action === "register") {
    return {
      title: "Tài khoản hiện tại là quản trị viên",
      description:
        "Quản trị viên sẽ được chuyển tới trang quản lý. Chỉ tài khoản sinh viên mới có thể đăng ký sự kiện.",
      alert:
        "Bạn đang đăng nhập bằng tài khoản admin nên hệ thống sẽ mở trang quản trị thay vì form đăng ký.",
    };
  }

  return {
    title: "Phiên đăng nhập đang hoạt động",
    description:
      "Bạn có thể tiếp tục vào đúng phân hệ theo vai trò tài khoản hoặc đăng xuất để đổi người dùng.",
    alert: "",
  };
}

function renderHome() {
  const context = getRouteContext();
  const currentUser = window.ClubAuth.getCurrentUser();
  const intent = describeIntent(currentUser, context);

  loginCardTitle.innerText = intent.title;
  loginCardDescription.innerText = intent.description;
  setAlert(intent.alert, intent.alert ? "warning" : "info");
  renderDemoAccounts();
  renderPublicEvents();

  if (!currentUser) {
    loginForm.hidden = false;
    sessionPanel.hidden = true;
    return;
  }

  loginForm.hidden = true;
  sessionPanel.hidden = false;
  sessionName.innerText = currentUser.studentName || currentUser.displayName;
  sessionRole.innerText = `${currentUser.roleLabel} - ${currentUser.loginId}`;
  continueBtn.innerText = window.ClubAuth.isAdmin(currentUser)
    ? "Vào trang quản trị"
    : "Vào khu vực sinh viên";

  if (
    (context.action === "register" && window.ClubAuth.isStudent(currentUser)) ||
    (context.next && context.next === currentUser.role)
  ) {
    window.location.replace(resolveDestination(currentUser, context));
  }
}

function handleLogin(event) {
  event.preventDefault();
  loginError.innerText = "";

  const result = window.ClubAuth.login({
    identity: loginIdentityInput.value,
    password: loginPasswordInput.value,
  });

  if (!result.ok) {
    loginError.innerText = result.message;
    return;
  }

  const context = getRouteContext();
  window.location.href = resolveDestination(result.user, context);
}

function handleContinue() {
  const currentUser = window.ClubAuth.getCurrentUser();

  if (!currentUser) {
    return;
  }

  window.location.href = resolveDestination(currentUser, getRouteContext());
}

function handleLogout() {
  window.ClubAuth.logout();
  loginForm.reset();
  renderHome();
}

loginForm.addEventListener("submit", handleLogin);
continueBtn.addEventListener("click", handleContinue);
logoutBtn.addEventListener("click", handleLogout);
window.addEventListener("storage", renderHome);

renderHome();
