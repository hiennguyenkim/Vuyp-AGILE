import "../../services/auth.js";
import "../../services/storage.js";

let currentUser = null;
let currentEventId = "";
let feedbackEntries = [];
let deleteFeedbackId = "";
let pendingFeedbackActionId = "";

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
const feedbackCount = document.getElementById("feedbackCount");
const visibleCount = document.getElementById("visibleCount");
const hiddenCount = document.getElementById("hiddenCount");
const tableMeta = document.getElementById("tableMeta");
const pageError = document.getElementById("pageError");
const feedbackList = document.getElementById("feedbackList");
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
    ? `index.html?eventId=${encodeURIComponent(normalizedEventId)}`
    : "index.html";
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

function setStats(total, visible, hidden) {
  feedbackCount.innerText = String(total);
  visibleCount.innerText = String(visible);
  hiddenCount.innerText = String(hidden);
}

function renderLoadingState() {
  pageError.innerText = "";
  tableMeta.innerText = "Đang tải dữ liệu đánh giá từ hệ thống sự kiện.";
  feedbackList.innerHTML = `
    <tr>
      <td colspan="7">Đang tải dữ liệu đánh giá.</td>
    </tr>
  `;
}

function renderEmptyState(message, description) {
  eventSummaryCard.hidden = true;
  setStats(0, 0, 0);
  pageError.innerText = message;
  tableMeta.innerText = description;
  feedbackList.innerHTML = `
    <tr>
      <td colspan="7">${escapeHtml(description)}</td>
    </tr>
  `;
}

function renderEventSummary(event, eventFeedback) {
  const hiddenTotal = eventFeedback.filter((feedback) => feedback.isHidden).length;
  const visibleTotal = Math.max(0, eventFeedback.length - hiddenTotal);

  eventSummaryCard.hidden = false;
  summaryCode.innerText = event.code || "--";
  summaryName.innerText = event.name || "Chưa cập nhật tên sự kiện";
  summaryTime.innerText = window.ClubStorage.formatDateRange(event.start, event.end);
  summaryLocation.innerText = event.location || "Chưa cập nhật";
  summarySpeaker.innerText = event.speaker || "Chưa cập nhật";
  summaryCapacity.innerText = `${event.registered}/${event.max}`;
  tableMeta.innerText =
    eventFeedback.length === 0
      ? "Sự kiện này chưa có đánh giá nào từ sinh viên."
      : `Đang hiển thị ${eventFeedback.length} đánh giá của ${event.code}. Có ${visibleTotal} lượt đang công khai và ${hiddenTotal} lượt đang ẩn.`;
  setStats(eventFeedback.length, visibleTotal, hiddenTotal);
  document.title = `${event.code || "Sự kiện"} | Đánh giá`;
}

function renderFeedbackRows(eventFeedback) {
  if (eventFeedback.length === 0) {
    feedbackList.innerHTML = `
      <tr>
        <td colspan="7">Sự kiện này hiện chưa có đánh giá nào.</td>
      </tr>
    `;
    return;
  }

  feedbackList.innerHTML = eventFeedback
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
      "Hãy quay lại trang quản trị và mở danh sách đánh giá từ một sự kiện cụ thể.",
    );
    return;
  }

  const [event, allFeedback] = await Promise.all([
    window.ClubStorage.getEventById(currentEventId),
    window.ClubStorage.getFeedbackEntries({ eventId: currentEventId }),
  ]);

  if (!event) {
    renderEmptyState(
      "Không tìm thấy sự kiện cần xem.",
      "Sự kiện này có thể đã bị xóa hoặc mã sự kiện trong đường dẫn không còn hợp lệ.",
    );
    return;
  }

  feedbackEntries = window.ClubStorage.sortFeedbackEntries(allFeedback);

  pageError.innerText = "";
  renderEventSummary(event, feedbackEntries);
  renderFeedbackRows(feedbackEntries);
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

async function toggleFeedbackVisibility(feedbackId, nextHidden) {
  const normalizedFeedbackId = normalizeString(feedbackId);

  if (!normalizedFeedbackId) {
    showToast("Không tìm thấy đánh giá cần cập nhật.");
    return;
  }

  try {
    pendingFeedbackActionId = normalizedFeedbackId;
    await window.ClubStorage.setEventFeedbackVisibility(
      normalizedFeedbackId,
      Boolean(nextHidden),
    );
    await loadPage();
    showToast(Boolean(nextHidden) ? "Đã ẩn đánh giá." : "Đã cho hiển thị lại đánh giá.");
  } catch (error) {
    handleAsyncError(error);
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
    await window.ClubStorage.deleteEventFeedback(deleteFeedbackId);
    await loadPage();
    showToast("Đã xóa đánh giá.");
    closeDeleteFeedbackModal();
  } catch (error) {
    handleAsyncError(error);
  } finally {
    pendingFeedbackActionId = "";
    renderFeedbackRows(feedbackEntries);
  }
}

function handleAsyncError(error) {
  console.error(error);
  pageError.innerText = error?.message || "Không thể tải dữ liệu đánh giá lúc này.";
}

backToAdminBtn.addEventListener("click", function onBackToAdminClick() {
  window.location.href = buildAdminIndexUrl();
});

confirmDeleteFeedback.addEventListener("click", function onConfirmDeleteFeedback() {
  confirmDeleteFeedbackAction().catch(handleAsyncError);
});

cancelDeleteFeedback.addEventListener("click", function onCancelDeleteFeedback() {
  closeDeleteFeedbackModal();
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
  toggleFeedbackVisibility(feedbackId, nextHidden).catch(handleAsyncError);
};

window.deleteFeedback = function handleDeleteFeedback(feedbackId) {
  promptDeleteFeedback(feedbackId);
};

loadPage().catch(handleAsyncError);
