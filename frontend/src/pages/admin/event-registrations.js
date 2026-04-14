import "../../services/auth.js";
import "../../services/storage.js";

let currentUser = null;
let currentEventId = "";
let genderChart = null;

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
const genderChartCanvas = document.getElementById("genderChart");
const genderChartMeta = document.getElementById("genderChartMeta");
const genderChartEmpty = document.getElementById("genderChartEmpty");

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

function normalizeGenderValue(value) {
  const normalizedValue = normalizeString(value).toLowerCase();

  if (normalizedValue === "nam") {
    return "Nam";
  }

  if (normalizedValue === "nu" || normalizedValue === "nữ") {
    return "Nữ";
  }

  return "";
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
  genderChartMeta.innerText = "Biểu đồ chỉ tính những sinh viên đã check-in thành công.";
  genderChartEmpty.hidden = true;
  registrationList.innerHTML = `
    <tr>
      <td colspan="7">Đang tải dữ liệu đăng ký và điểm danh.</td>
    </tr>
  `;
}

function destroyGenderChart() {
  if (genderChart) {
    genderChart.destroy();
    genderChart = null;
  }
}

function renderEmptyState(message, description) {
  eventSummaryCard.hidden = true;
  setStats(0, 0);
  destroyGenderChart();
  genderChartEmpty.hidden = false;
  genderChartMeta.innerText = description;
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

function renderGenderChart(eventRegistrations) {
  destroyGenderChart();

  const checkedInRegistrations = eventRegistrations.filter((registration) => {
    return Boolean(registration.checkedInAt) || Boolean(registration.checkedIn);
  });
  const counts = checkedInRegistrations.reduce(
    (result, registration) => {
      const normalizedGender = normalizeGenderValue(registration.studentGender);

      if (normalizedGender === "Nam") {
        result.male += 1;
      } else if (normalizedGender === "Nữ") {
        result.female += 1;
      } else {
        result.unknown += 1;
      }

      return result;
    },
    { male: 0, female: 0, unknown: 0 },
  );
  const chartTotal = counts.male + counts.female;

  if (!window.Chart) {
    genderChartEmpty.hidden = false;
    genderChartMeta.innerText =
      "Không thể tải thư viện biểu đồ Chart.js lúc này. Vui lòng thử tải lại trang.";
    return;
  }

  if (chartTotal === 0) {
    genderChartEmpty.hidden = false;
    genderChartMeta.innerText =
      counts.unknown > 0
        ? `Có ${counts.unknown} lượt check-in chưa xác định giới tính Nam/Nữ nên chưa thể vẽ biểu đồ.`
        : "Chưa có sinh viên Nam/Nữ nào check-in thành công cho sự kiện này.";
    return;
  }

  genderChartEmpty.hidden = true;
  genderChartMeta.innerText =
    counts.unknown > 0
      ? `Biểu đồ đang tính ${chartTotal} lượt check-in Nam/Nữ. Có ${counts.unknown} lượt giới tính khác hoặc chưa rõ không được đưa vào biểu đồ.`
      : `Biểu đồ đang tính ${chartTotal} lượt check-in Nam/Nữ của sự kiện này.`;

  genderChart = new window.Chart(genderChartCanvas, {
    type: "pie",
    data: {
      labels: ["Nam", "Nữ"],
      datasets: [
        {
          data: [counts.male, counts.female],
          backgroundColor: ["#2563eb", "#ec4899"],
          borderColor: "#ffffff",
          borderWidth: 3,
          hoverOffset: 8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            usePointStyle: true,
            padding: 18,
          },
        },
        tooltip: {
          callbacks: {
            label(context) {
              const label = context.label || "";
              const value = Number(context.parsed) || 0;
              const percent = chartTotal > 0
                ? Math.round((value / chartTotal) * 100)
                : 0;
              return `${label}: ${value} người - ${percent}%`;
            },
          },
        },
      },
    },
  });
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
  renderGenderChart(eventRegistrations);
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
