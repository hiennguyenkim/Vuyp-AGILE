import "../../services/auth.js";
import "../../services/storage.js";

let currentUser = null;
let currentEventId = "";

const backToAdminBtn = document.getElementById("backToAdminBtn");
const adminName = document.getElementById("adminName");
const adminRole = document.getElementById("adminRole");
const eventSummaryCard = document.getElementById("eventSummaryCard");
const summaryCode = document.getElementById("summaryCode");
const summaryName = document.getElementById("summaryName");
const summaryTime = document.getElementById("summaryTime");
const summaryLocation = document.getElementById("summaryLocation");
const summarySpeaker = document.getElementById("summarySpeaker");
const summaryCapacity = document.getElementById("summaryCapacity");
const registrationCount = document.getElementById("registrationCount");
const checkedInCount = document.getElementById("checkedInCount");
const pendingCount = document.getElementById("pendingCount");
const tableMeta = document.getElementById("tableMeta");
const pageError = document.getElementById("pageError");
const registrationList = document.getElementById("registrationList");

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getEventIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return normalizeString(params.get("eventId"));
}

function buildAdminIndexUrl(eventId = currentEventId) {
  const normalizedEventId = normalizeString(eventId);
  return normalizedEventId
    ? `index.html?eventId=${encodeURIComponent(normalizedEventId)}`
    : "index.html";
}

function getCheckedInTotal(records) {
  return records.filter((registration) => {
    return Boolean(registration.checkedInAt) || Boolean(registration.checkedIn);
  }).length;
}

function renderAdminSession() {
  adminName.innerText = currentUser?.displayName || "Quản trị viên";
  adminRole.innerText = currentUser
    ? `${currentUser.roleLabel} - ${currentUser.loginId}`
    : "Đang xác thực tài khoản";
}

async function ensureAdminAccess() {
  await window.ClubAuth.ready();
  currentUser = window.ClubAuth.getCurrentUser();

  if (!currentUser || !window.ClubAuth.isAdmin(currentUser)) {
    window.location.replace("../auth/login.html?next=admin");
    return false;
  }

  return true;
}

function setStats(total, checked) {
  registrationCount.innerText = String(total);
  checkedInCount.innerText = String(checked);
  pendingCount.innerText = String(Math.max(0, total - checked));
}

function renderLoadingState() {
  pageError.innerText = "";
  tableMeta.innerText = "Đang tải dữ liệu đăng ký từ hệ thống sự kiện.";
  registrationList.innerHTML = `
    <tr>
      <td colspan="7">Đang tải dữ liệu đăng ký và điểm danh.</td>
    </tr>
  `;
}

function renderEmptyState(message, description) {
  eventSummaryCard.hidden = true;
  setStats(0, 0);
  pageError.innerText = message;
  tableMeta.innerText = description;
  registrationList.innerHTML = `
    <tr>
      <td colspan="7">${escapeHtml(description)}</td>
    </tr>
  `;
}

function renderEventSummary(event, eventRegistrations) {
  const checkedTotal = getCheckedInTotal(eventRegistrations);

  eventSummaryCard.hidden = false;
  summaryCode.innerText = event.code || "--";
  summaryName.innerText = event.name || "Chưa cập nhật tên sự kiện";
  summaryTime.innerText = window.ClubStorage.formatDateRange(event.start, event.end);
  summaryLocation.innerText = event.location || "Chưa cập nhật";
  summarySpeaker.innerText = event.speaker || "Chưa cập nhật";
  summaryCapacity.innerText = `${event.registered}/${event.max}`;
  tableMeta.innerText =
    eventRegistrations.length === 0
      ? "Sự kiện này chưa có sinh viên đăng ký."
      : `Đang hiển thị ${eventRegistrations.length} lượt đăng ký của ${event.code}.`;
  setStats(eventRegistrations.length, checkedTotal);
  document.title = `${event.code || "Sự kiện"} | Danh sách đăng ký`;
}

function renderRegistrationRows(eventRegistrations) {
  if (eventRegistrations.length === 0) {
    registrationList.innerHTML = `
      <tr>
        <td colspan="7">Sự kiện này hiện chưa có dữ liệu đăng ký hoặc điểm danh.</td>
      </tr>
    `;
    return;
  }

  registrationList.innerHTML = eventRegistrations
    .map((registration) => {
      const isCheckedIn =
        Boolean(registration.checkedInAt) || Boolean(registration.checkedIn);
      const statusLabel = isCheckedIn ? "Đã điểm danh" : "Đã đăng ký";
      const statusClass = isCheckedIn
        ? "status-pill status-pill-checked"
        : "status-pill status-pill-pending";

      return `
        <tr>
          <td>${escapeHtml(registration.studentName || "-")}</td>
          <td>${escapeHtml(registration.studentId || "-")}</td>
          <td>${escapeHtml(registration.studentCourse || "-")}</td>
          <td>${escapeHtml(registration.studentGender || "-")}</td>
          <td>${escapeHtml(window.ClubStorage.formatDateTime(registration.registeredAt))}</td>
          <td><span class="${statusClass}">${escapeHtml(statusLabel)}</span></td>
          <td>${escapeHtml(
            registration.checkedInAt
              ? window.ClubStorage.formatDateTime(registration.checkedInAt)
              : "-",
          )}</td>
        </tr>
      `;
    })
    .join("");
}

async function loadPage() {
  renderLoadingState();

  if (!(await ensureAdminAccess())) {
    return;
  }

  renderAdminSession();
  currentEventId = getEventIdFromUrl();

  if (!currentEventId) {
    renderEmptyState(
      "Chưa có sự kiện được chọn.",
      "Hãy quay lại trang quản trị và mở danh sách từ phần chi tiết của một sự kiện cụ thể.",
    );
    return;
  }

  const [event, allRegistrations] = await Promise.all([
    window.ClubStorage.getEventById(currentEventId),
    window.ClubStorage.getRegistrations({ eventId: currentEventId }),
  ]);

  if (!event) {
    renderEmptyState(
      "Không tìm thấy sự kiện cần xem.",
      "Sự kiện này có thể đã bị xóa hoặc mã sự kiện trong đường dẫn không còn hợp lệ.",
    );
    return;
  }

  const eventRegistrations = window.ClubStorage.sortRegistrations(allRegistrations);

  pageError.innerText = "";
  renderEventSummary(event, eventRegistrations);
  renderRegistrationRows(eventRegistrations);
}

function handleAsyncError(error) {
  console.error(error);
  renderEmptyState(
    error?.message || "Không thể tải dữ liệu đăng ký lúc này.",
    "Vui lòng thử tải lại trang sau ít phút hoặc kiểm tra kết nối tới Supabase.",
  );
}

backToAdminBtn.addEventListener("click", function onBackToAdminClick() {
  window.location.href = buildAdminIndexUrl();
});

window.addEventListener("focus", function onFocus() {
  loadPage().catch(handleAsyncError);
});

window.ClubAuth.subscribe(function onAuthChange() {
  loadPage().catch(handleAsyncError);
});

loadPage().catch(handleAsyncError);
