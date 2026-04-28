import "../../services/auth.js";
import "../../services/storage.js";
import {
  getNextPageFromAction,
  paginateItems,
  renderPaginationControls,
} from "../../utils/pagination.js";

let currentUser = null;
let currentEventId = "";
let genderChart = null;
let cohortChart = null;
let registrationEntries = [];
let feedbackEntries = [];
let deleteFeedbackId = "";
let pendingFeedbackActionId = "";
let registrationPage = 1;
let feedbackPage = 1;

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
const registrationTablePagination = document.getElementById("registrationTablePagination");
const genderChartCanvas = document.getElementById("genderChart");
const genderChartMeta = document.getElementById("genderChartMeta");
const genderChartEmpty = document.getElementById("genderChartEmpty");
const cohortChartCanvas = document.getElementById("cohortChart");
const cohortChartMeta = document.getElementById("cohortChartMeta");
const cohortChartEmpty = document.getElementById("cohortChartEmpty");
const feedbackCount = document.getElementById("feedbackCount");
const visibleCount = document.getElementById("visibleCount");
const hiddenCount = document.getElementById("hiddenCount");
const feedbackTableMeta = document.getElementById("feedbackTableMeta");
const feedbackError = document.getElementById("feedbackError");
const feedbackList = document.getElementById("feedbackList");
const feedbackTablePagination = document.getElementById("feedbackTablePagination");
const deleteFeedbackModal = document.getElementById("deleteFeedbackModal");
const deleteFeedbackMessage = document.getElementById("deleteFeedbackMessage");
const confirmDeleteFeedback = document.getElementById("confirmDeleteFeedback");
const cancelDeleteFeedback = document.getElementById("cancelDeleteFeedback");

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
    ? "index.html"
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

function setFeedbackStats(total, visible, hidden) {
  feedbackCount.innerText = String(total);
  visibleCount.innerText = String(visible);
  hiddenCount.innerText = String(hidden);
}

function renderLoadingState() {
  pageError.innerText = "";
  feedbackError.innerText = "";
  tableMeta.innerText = "Đang tải dữ liệu đăng ký từ hệ thống sự kiện.";
  genderChartMeta.innerText = "Biểu đồ chỉ tính những sinh viên đã check-in thành công.";
  genderChartEmpty.hidden = true;
  if (cohortChartMeta) {
    cohortChartMeta.innerText = "Biểu đồ chỉ tính những sinh viên đã check-in thành công.";
  }
  if (cohortChartEmpty) {
    cohortChartEmpty.hidden = true;
  }
  feedbackTableMeta.innerText = "Đang tải dữ liệu đánh giá từ hệ thống sự kiện.";
  setFeedbackStats(0, 0, 0);
  renderPaginationControls(
    registrationTablePagination,
    paginateItems([], registrationPage),
    { itemLabel: "lượt đăng ký" },
  );
  renderPaginationControls(
    feedbackTablePagination,
    paginateItems([], feedbackPage),
    { itemLabel: "đánh giá" },
  );
  registrationList.innerHTML = `
    <tr>
      <td colspan="7">Đang tải dữ liệu đăng ký và điểm danh.</td>
    </tr>
  `;
  feedbackList.innerHTML = `
    <tr>
      <td colspan="7">Đang tải dữ liệu đánh giá.</td>
    </tr>
  `;
}

function destroyGenderChart() {
  if (genderChart) {
    genderChart.destroy();
    genderChart = null;
  }
}

function destroyCohortChart() {
  if (cohortChart) {
    cohortChart.destroy();
    cohortChart = null;
  }
}

function renderEmptyState(message, description) {
  eventSummaryCard.hidden = true;
  setStats(0, 0);
  setFeedbackStats(0, 0, 0);
  destroyGenderChart();
  destroyCohortChart();
  genderChartEmpty.hidden = false;
  genderChartMeta.innerText = description;
  if (cohortChartEmpty) {
    cohortChartEmpty.hidden = false;
  }
  if (cohortChartMeta) {
    cohortChartMeta.innerText = description;
  }
  pageError.innerText = message;
  feedbackError.innerText = "";
  tableMeta.innerText = description;
  feedbackTableMeta.innerText = description;
  renderPaginationControls(
    registrationTablePagination,
    paginateItems([], registrationPage),
    { itemLabel: "lượt đăng ký" },
  );
  renderPaginationControls(
    feedbackTablePagination,
    paginateItems([], feedbackPage),
    { itemLabel: "đánh giá" },
  );
  registrationList.innerHTML = `
    <tr>
      <td colspan="7">${escapeHtml(description)}</td>
    </tr>
  `;
  feedbackList.innerHTML = `
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
  document.title = `${event.code || "Sự kiện"} | Chi tiết sự kiện`;
}

function renderFeedbackSummary(eventFeedback) {
  const hiddenTotal = eventFeedback.filter((feedback) => feedback.isHidden).length;
  const visibleTotal = Math.max(0, eventFeedback.length - hiddenTotal);

  feedbackTableMeta.innerText =
    eventFeedback.length === 0
      ? "Sự kiện này chưa có đánh giá nào từ sinh viên."
      : `Đang hiển thị ${eventFeedback.length} đánh giá. Có ${visibleTotal} lượt đang công khai và ${hiddenTotal} lượt đang ẩn.`;
  setFeedbackStats(eventFeedback.length, visibleTotal, hiddenTotal);
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

function renderCohortChart(eventRegistrations) {
  destroyCohortChart();

  const checkedInRegistrations = eventRegistrations.filter((registration) => {
    return Boolean(registration.checkedInAt) || Boolean(registration.checkedIn);
  });

  const counts = checkedInRegistrations.reduce((result, registration) => {
    const course = normalizeString(registration.studentCourse) || "Khác";
    result[course] = (result[course] || 0) + 1;
    return result;
  }, {});

  const labels = Object.keys(counts).sort((a, b) => {
    if (a === "Khác") return 1;
    if (b === "Khác") return -1;
    return a.localeCompare(b);
  });
  const data = labels.map(label => counts[label]);
  const chartTotal = data.reduce((sum, val) => sum + val, 0);

  if (!window.Chart) {
    if (cohortChartEmpty) cohortChartEmpty.hidden = false;
    if (cohortChartMeta) cohortChartMeta.innerText = "Không thể tải thư viện biểu đồ Chart.js lúc này. Vui lòng thử tải lại trang.";
    return;
  }

  if (chartTotal === 0) {
    if (cohortChartEmpty) cohortChartEmpty.hidden = false;
    if (cohortChartMeta) cohortChartMeta.innerText = "Chưa có sinh viên nào check-in thành công cho sự kiện này.";
    return;
  }

  if (cohortChartEmpty) cohortChartEmpty.hidden = true;
  if (cohortChartMeta) cohortChartMeta.innerText = `Biểu đồ đang tính ${chartTotal} lượt check-in của sự kiện này.`;

  if (cohortChartCanvas) {
    cohortChart = new window.Chart(cohortChartCanvas, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Số lượng sinh viên",
            data: data,
            backgroundColor: "#2563eb",
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              label(context) {
                const value = Number(context.parsed.y) || 0;
                return `Số lượng: ${value} sinh viên`;
              },
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1,
            },
          },
        },
      },
    });
  }
}

function renderRegistrationRows(eventRegistrations) {
  const registrationPagination = paginateItems(eventRegistrations, registrationPage);
  const visibleRegistrations = registrationPagination.items;
  registrationPage = registrationPagination.currentPage;

  if (eventRegistrations.length === 0) {
    renderPaginationControls(
      registrationTablePagination,
      paginateItems([], registrationPage),
      { itemLabel: "lượt đăng ký" },
    );
    registrationList.innerHTML = `
      <tr>
        <td colspan="7">Sự kiện này hiện chưa có dữ liệu đăng ký hoặc điểm danh.</td>
      </tr>
    `;
    return;
  }

  registrationList.innerHTML = visibleRegistrations
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

  renderPaginationControls(registrationTablePagination, registrationPagination, {
    itemLabel: "lượt đăng ký",
  });
}

function renderFeedbackRows(eventFeedback) {
  const feedbackPagination = paginateItems(eventFeedback, feedbackPage);
  const visibleFeedback = feedbackPagination.items;
  feedbackPage = feedbackPagination.currentPage;

  if (eventFeedback.length === 0) {
    renderPaginationControls(
      feedbackTablePagination,
      paginateItems([], feedbackPage),
      { itemLabel: "đánh giá" },
    );
    feedbackList.innerHTML = `
      <tr>
        <td colspan="7">Sự kiện này hiện chưa có đánh giá nào.</td>
      </tr>
    `;
    return;
  }

  feedbackList.innerHTML = visibleFeedback
    .map((feedback) => {
      const isHidden = Boolean(feedback.isHidden);
      const toggleLabel = isHidden ? "Hiện đánh giá" : "Ẩn đánh giá";
      const statusClass = isHidden
        ? "feedback-status feedback-status-hidden"
        : "feedback-status feedback-status-visible";
      const statusLabel = isHidden ? "Đang ẩn" : "Công khai";
      const hiddenNote = isHidden && feedback.hiddenAt
        ? `Ẩn lúc ${window.ClubStorage.formatDateTime(feedback.hiddenAt)}`
        : "";
      const actionDisabled = pendingFeedbackActionId === feedback.id ? "disabled" : "";
      const reviewerMeta = [feedback.studentId, feedback.studentCourse]
        .filter(Boolean)
        .join(" - ");

      return `
        <tr>
          <td>
            <div class="feedback-reviewer">
              <strong>${escapeHtml(feedback.reviewerName || "Sinh viên")}</strong>
              <span>${escapeHtml(reviewerMeta || "Chưa có MSSV/khóa")}</span>
            </div>
          </td>
          <td>
            <span class="feedback-rating">${escapeHtml(`${feedback.stars}/5 ★`)}</span>
          </td>
          <td>
            <div class="feedback-content">
              ${feedback.content
                ? escapeHtml(feedback.content)
                : '<span class="feedback-empty">Không có nội dung văn bản.</span>'}
            </div>
          </td>
          <td class="feedback-image-cell">
            ${feedback.image
              ? `
                <a href="${escapeHtml(feedback.image)}" target="_blank" rel="noreferrer" class="feedback-image-link">
                  <img src="${escapeHtml(feedback.image)}" alt="Ảnh đính kèm của đánh giá" class="feedback-thumb" />
                  <span>Xem ảnh</span>
                </a>
              `
              : '<span class="feedback-no-image">Không có ảnh</span>'}
          </td>
          <td>${escapeHtml(window.ClubStorage.formatDateTime(feedback.createdAt))}</td>
          <td>
            <span class="${statusClass}">${escapeHtml(statusLabel)}</span>
            ${hiddenNote ? `<div class="feedback-status-note">${escapeHtml(hiddenNote)}</div>` : ""}
          </td>
          <td>
            <div class="feedback-actions">
              <button
                type="button"
                class="secondary-btn"
                ${actionDisabled}
                onclick="toggleFeedbackVisibility('${escapeHtml(feedback.id)}', ${isHidden ? "false" : "true"})"
              >
                ${escapeHtml(toggleLabel)}
              </button>
              <button
                type="button"
                class="delete-btn"
                ${actionDisabled}
                onclick="deleteFeedback('${escapeHtml(feedback.id)}')"
              >
                Xóa đánh giá
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  renderPaginationControls(feedbackTablePagination, feedbackPagination, {
    itemLabel: "đánh giá",
  });
}

function closeDeleteFeedbackModal() {
  deleteFeedbackModal.style.display = "none";
  deleteFeedbackId = "";
  deleteFeedbackMessage.innerText = "Bạn có chắc chắn muốn xóa đánh giá này không?";
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.innerText = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

function handleFeedbackActionError(error) {
  console.error(error);
  feedbackError.innerText = error?.message || "Không thể cập nhật đánh giá lúc này.";
}

async function toggleFeedbackVisibility(feedbackId, nextHidden) {
  const normalizedFeedbackId = normalizeString(feedbackId);

  if (!normalizedFeedbackId) {
    showToast("Không tìm thấy đánh giá cần cập nhật.");
    return;
  }

  try {
    pendingFeedbackActionId = normalizedFeedbackId;
    feedbackError.innerText = "";
    await window.ClubStorage.setEventFeedbackVisibility(
      normalizedFeedbackId,
      Boolean(nextHidden),
    );
    await loadPage();
    showToast(Boolean(nextHidden) ? "Đã ẩn đánh giá." : "Đã cho hiển thị lại đánh giá.");
  } catch (error) {
    handleFeedbackActionError(error);
  } finally {
    pendingFeedbackActionId = "";
    renderFeedbackRows(feedbackEntries);
  }
}

function promptDeleteFeedback(feedbackId) {
  const targetFeedback = feedbackEntries.find((feedback) => feedback.id === feedbackId);
  deleteFeedbackId = normalizeString(feedbackId);
  deleteFeedbackMessage.innerText = targetFeedback
    ? `Bạn có chắc chắn muốn xóa đánh giá của "${targetFeedback.reviewerName}" không?`
    : "Bạn có chắc chắn muốn xóa đánh giá này không?";
  deleteFeedbackModal.style.display = "flex";
}

async function confirmDeleteFeedbackAction() {
  if (!deleteFeedbackId) {
    return;
  }

  try {
    pendingFeedbackActionId = deleteFeedbackId;
    feedbackError.innerText = "";
    await window.ClubStorage.deleteEventFeedback(deleteFeedbackId);
    await loadPage();
    showToast("Đã xóa đánh giá.");
    closeDeleteFeedbackModal();
  } catch (error) {
    handleFeedbackActionError(error);
  } finally {
    pendingFeedbackActionId = "";
    renderFeedbackRows(feedbackEntries);
  }
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

  const [event, allRegistrations, allFeedback] = await Promise.all([
    window.ClubStorage.getEventById(currentEventId),
    window.ClubStorage.getRegistrations({ eventId: currentEventId }),
    window.ClubStorage.getFeedbackEntries({ eventId: currentEventId }),
  ]);

  if (!event) {
    renderEmptyState(
      "Không tìm thấy sự kiện cần xem.",
      "Sự kiện này có thể đã bị xóa hoặc mã sự kiện trong đường dẫn không còn hợp lệ.",
    );
    return;
  }

  registrationEntries = window.ClubStorage.sortRegistrations(allRegistrations);
  feedbackEntries = window.ClubStorage.sortFeedbackEntries(allFeedback);

  pageError.innerText = "";
  feedbackError.innerText = "";
  renderEventSummary(event, registrationEntries);
  renderGenderChart(registrationEntries);
  renderCohortChart(registrationEntries);
  renderRegistrationRows(registrationEntries);
  renderFeedbackSummary(feedbackEntries);
  renderFeedbackRows(feedbackEntries);
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

confirmDeleteFeedback.addEventListener("click", function onConfirmDeleteFeedback() {
  confirmDeleteFeedbackAction().catch(handleFeedbackActionError);
});

cancelDeleteFeedback.addEventListener("click", function onCancelDeleteFeedback() {
  closeDeleteFeedbackModal();
});

registrationTablePagination.addEventListener("click", function onRegistrationPaginationClick(event) {
  const targetButton = event.target.closest("[data-pagination-action]");

  if (!(targetButton instanceof HTMLButtonElement)) {
    return;
  }

  const action = normalizeString(targetButton.dataset.paginationAction);
  const totalPages = Number(registrationTablePagination.dataset.totalPages) || 1;
  registrationPage = getNextPageFromAction(action, registrationPage, totalPages);
  renderRegistrationRows(registrationEntries);
});

feedbackTablePagination.addEventListener("click", function onFeedbackPaginationClick(event) {
  const targetButton = event.target.closest("[data-pagination-action]");

  if (!(targetButton instanceof HTMLButtonElement)) {
    return;
  }

  const action = normalizeString(targetButton.dataset.paginationAction);
  const totalPages = Number(feedbackTablePagination.dataset.totalPages) || 1;
  feedbackPage = getNextPageFromAction(action, feedbackPage, totalPages);
  renderFeedbackRows(feedbackEntries);
});

window.addEventListener("focus", function onFocus() {
  loadPage().catch(handleAsyncError);
});

window.addEventListener("click", function onWindowClick(event) {
  if (event.target === deleteFeedbackModal) {
    closeDeleteFeedbackModal();
  }
});

window.ClubAuth.subscribe(function onAuthChange() {
  loadPage().catch(handleAsyncError);
});

window.toggleFeedbackVisibility = function handleToggleFeedbackVisibility(feedbackId, nextHidden) {
  toggleFeedbackVisibility(feedbackId, nextHidden).catch(handleFeedbackActionError);
};

window.deleteFeedback = function handleDeleteFeedback(feedbackId) {
  promptDeleteFeedback(feedbackId);
};

loadPage().catch(handleAsyncError);
