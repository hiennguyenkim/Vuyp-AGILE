import "../../services/auth.js";
import "../../services/storage.js";

let events = [];
let feedbackEntries = [];
let registrations = [];
let deleteEventId = null;
let recentlySavedEventId = null;
let selectedDetailEventId = null;
let currentUser = null;
let importActionInFlight = "";

const form = document.getElementById("eventForm");
const list = document.getElementById("eventList");
const deleteMessage = document.getElementById("deleteMessage");
const errorBox = document.getElementById("error");
const successBox = document.getElementById("success");
const detailSection = document.getElementById("eventDetailSection");
const adminName = document.getElementById("adminName");
const adminRole = document.getElementById("adminRole");
const btnViewRegistrations = document.getElementById("btnViewRegistrations");
const btnViewFeedback = document.getElementById("btnViewFeedback");
const btnOpenRegistrationsPage = document.getElementById("btnOpenRegistrationsPage");
const btnOpenFeedbackPage = document.getElementById("btnOpenFeedbackPage");
const detailRegistrationTitle = document.getElementById("detailRegistrationTitle");
const detailRegistrationSummary = document.getElementById("detailRegistrationSummary");
const detailFeedbackTitle = document.getElementById("detailFeedbackTitle");
const detailFeedbackSummary = document.getElementById("detailFeedbackSummary");
const importStudentsBtn = document.getElementById("importStudentsBtn");
const homeBtn = document.getElementById("homeBtn");
const logoutBtn = document.getElementById("logoutBtn");
const importModal = document.getElementById("importModal");
const importForm = document.getElementById("studentImportForm");
const importFileInput = document.getElementById("importFile");
const importKeepPasswordInput = document.getElementById("importKeepPassword");
const importReport = document.getElementById("importReport");
const validateImportStudentsBtn = document.getElementById("validateImportStudents");
const confirmImportStudentsBtn = document.getElementById("confirmImportStudents");
const cancelImportStudentsBtn = document.getElementById("cancelImportStudents");
const requiredFields = {
  name: "Tên sự kiện",
  start: "Thời gian bắt đầu",
  end: "Thời gian kết thúc",
  location: "Địa điểm",
  max: "Số lượng người tham gia tối đa",
};
const fieldErrorElements = {
  name: document.getElementById("nameError"),
  start: document.getElementById("startError"),
  end: document.getElementById("endError"),
  location: document.getElementById("locationError"),
  max: document.getElementById("maxError"),
};
const DEFAULT_DETAIL_REGISTRATION_TITLE =
  "Mở danh sách đăng ký và điểm danh riêng cho sự kiện này";
const DEFAULT_DETAIL_REGISTRATION_SUMMARY =
  "Chọn một sự kiện để xem danh sách đăng ký và trạng thái điểm danh theo từng chương trình.";
const DEFAULT_DETAIL_FEEDBACK_TITLE =
  "Mở danh sách đánh giá riêng cho sự kiện này";
const DEFAULT_DETAIL_FEEDBACK_SUMMARY =
  "Chọn một sự kiện để xem đánh giá của sinh viên, ẩn phản hồi không phù hợp hoặc xóa nội dung khi cần.";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
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

function renderAdminSession() {
  adminName.innerText = currentUser.displayName || "Quản trị viên";
  adminRole.innerText = `${currentUser.roleLabel} - ${currentUser.loginId}`;
}

function getRequestedEventIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return normalizeString(params.get("eventId"));
}

function setSelectedEventInUrl(eventId = "") {
  const nextUrl = new URL(window.location.href);

  if (normalizeString(eventId)) {
    nextUrl.searchParams.set("eventId", normalizeString(eventId));
  } else {
    nextUrl.searchParams.delete("eventId");
  }

  window.history.replaceState({}, "", `${nextUrl.pathname}${nextUrl.search}`);
}

function buildEventRegistrationsUrl(eventId) {
  const normalizedEventId = normalizeString(eventId);
  return normalizedEventId
    ? `event-registrations.html?eventId=${encodeURIComponent(normalizedEventId)}`
    : "event-registrations.html";
}

function buildEventFeedbackUrl(eventId) {
  const normalizedEventId = normalizeString(eventId);
  return normalizedEventId
    ? `event-feedback.html?eventId=${encodeURIComponent(normalizedEventId)}`
    : "event-feedback.html";
}

function openEventRegistrations(eventId = selectedDetailEventId) {
  const normalizedEventId = normalizeString(eventId);

  if (!normalizedEventId) {
    showToast("Hãy chọn một sự kiện trước khi mở danh sách.");
    return;
  }

  window.location.href = buildEventRegistrationsUrl(normalizedEventId);
}

function openEventFeedbackPage(eventId = selectedDetailEventId) {
  const normalizedEventId = normalizeString(eventId);

  if (!normalizedEventId) {
    showToast("Hãy chọn một sự kiện trước khi mở đánh giá.");
    return;
  }

  window.location.href = buildEventFeedbackUrl(normalizedEventId);
}

function openImportModal() {
  resetMessages();
  importModal.style.display = "flex";
}

function closeImportModal(options = {}) {
  if (importActionInFlight) {
    return;
  }

  importModal.style.display = "none";

  if (!options.keepFormValues) {
    importForm.reset();
    clearImportReport();
  }
}

function clearImportReport() {
  importReport.hidden = true;
  importReport.className = "import-report";
  importReport.innerHTML = "";
}

function setImportBusyState(action = "") {
  importActionInFlight = action;
  const isBusy = Boolean(action);

  validateImportStudentsBtn.disabled = isBusy;
  confirmImportStudentsBtn.disabled = isBusy;
  cancelImportStudentsBtn.disabled = isBusy;
  importStudentsBtn.disabled = isBusy;

  validateImportStudentsBtn.innerText =
    action === "dry-run" ? "Đang kiểm tra..." : "Kiểm tra file";
  confirmImportStudentsBtn.innerText =
    action === "import" ? "Đang import..." : "Import ngay";
}

function formatImportMetric(label, value) {
  return `
    <article class="import-report-metric">
      <strong>${escapeHtml(String(value ?? "-"))}</strong>
      <span>${escapeHtml(label)}</span>
    </article>
  `;
}

function renderImportReport(payload) {
  const summary = payload.summary || {};
  const issues = Array.isArray(payload.issues) ? payload.issues : [];
  const failures = Array.isArray(payload.failures) ? payload.failures : [];
  const preview = Array.isArray(payload.preview) ? payload.preview : [];
  const tone = payload.ok ? "success" : payload.dryRun ? "warning" : "error";
  const heading = payload.dryRun
    ? payload.ok
      ? "File hop le, san sang de import"
      : "File can duoc dieu chinh truoc khi import"
    : payload.ok
      ? "Import hoan tat thanh cong"
      : "Import hoan tat nhung van con ban ghi loi";
  const description = payload.dryRun
    ? `File ${payload.fileName || "du lieu"} da duoc doc xong. Ban co the xem preview ben duoi truoc khi import that.`
    : `Yeu cau import da duoc xu ly boi ${payload.actor?.displayName || "quan tri vien"}.`;
  const metrics = payload.dryRun
    ? [
        formatImportMetric("So dong du lieu doc duoc", summary.rawRowCount ?? 0),
        formatImportMetric("So ban ghi hop le", summary.recordCount ?? 0),
        formatImportMetric("Worksheet", summary.sheetName || "-"),
      ]
    : [
        formatImportMetric("Tong ban ghi", summary.total ?? 0),
        formatImportMetric("Thanh cong", summary.processed ?? 0),
        formatImportMetric("Auth tao moi", summary.authCreated ?? 0),
        formatImportMetric("Auth cap nhat", summary.authUpdated ?? 0),
        formatImportMetric("Profile upsert", summary.profilesUpserted ?? 0),
        formatImportMetric("That bai", summary.failed ?? 0),
      ];
  const previewSection =
    preview.length === 0
      ? ""
      : `
        <section class="import-report-section">
          <strong>Preview toi da 10 dong dau</strong>
          <ul class="import-report-list">
            ${preview
              .map((record) => {
                return `<li>Dong ${escapeHtml(record.rowNumber)}: ${escapeHtml(
                  `${record.loginId} | ${record.studentName} | ${record.email} | ${record.role}`,
                )}</li>`;
              })
              .join("")}
          </ul>
        </section>
      `;
  const issuesSection =
    issues.length === 0
      ? ""
      : `
        <section class="import-report-section">
          <strong>Van de can xu ly</strong>
          <ul class="import-report-list">
            ${issues.map((issue) => `<li>${escapeHtml(issue)}</li>`).join("")}
          </ul>
        </section>
      `;
  const failuresSection =
    failures.length === 0
      ? ""
      : `
        <section class="import-report-section">
          <strong>Ban ghi loi</strong>
          <ul class="import-report-list">
            ${failures
              .map((failure) => {
                return `<li>Dong ${escapeHtml(failure.rowNumber)} | ${escapeHtml(
                  failure.email || "-",
                )}: ${escapeHtml(failure.error)}</li>`;
              })
              .join("")}
          </ul>
        </section>
      `;

  importReport.hidden = false;
  importReport.className = `import-report import-report-${tone}`;
  importReport.innerHTML = `
    <div class="import-report-head">
      <strong>${escapeHtml(heading)}</strong>
      <span>${escapeHtml(description)}</span>
    </div>

    <div class="import-report-metrics">
      ${metrics.join("")}
    </div>

    ${issuesSection}
    ${failuresSection}
    ${previewSection}
  `;
}

async function getAdminAccessToken() {
  if (!(await ensureAdminAccess())) {
    throw new Error("Khong the xac nhan phien admin hien tai.");
  }

  const authState = await window.ClubAuth.readAuthState();
  const accessToken =
    authState?.session?.access_token || window.ClubAuth.getCurrentSession()?.access_token;

  if (!accessToken) {
    throw new Error("Khong tim thay access token. Vui long dang nhap lai.");
  }

  return accessToken;
}

async function submitStudentImport(options = {}) {
  const file = importFileInput.files?.[0];

  if (!file) {
    throw new Error("Vui lòng chọn file .xlsx hoặc .csv trước khi tiếp tục.");
  }

  const accessToken = await getAdminAccessToken();
  const formData = new FormData();
  formData.set("file", file);
  formData.set("dryRun", String(Boolean(options.dryRun)));
  formData.set("keepPassword", String(importKeepPasswordInput.checked));

  const response = await fetch("/api/admin/import/students", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      payload?.message || "Khong the import danh sach sinh vien luc nay.",
    );
  }

  renderImportReport(payload);

  if (options.dryRun) {
    if (payload.ok) {
      successBox.innerText = `Kiem tra file thanh cong. Co ${payload.summary?.recordCount || 0} ban ghi san sang de import.`;
      showToast("Kiểm tra file thành công");
    } else {
      errorBox.innerText =
        "File import đang có dữ liệu chưa hợp lệ. Hãy xem chi tiết trong hộp kết quả.";
    }
    return;
  }

  if (payload.ok) {
    successBox.innerText = `Import thanh cong ${payload.summary?.processed || 0}/${payload.summary?.total || 0} tai khoan sinh vien.`;
    showToast("Import sinh viên thành công");
  } else {
    errorBox.innerText =
      `Import hoan tat voi ${payload.summary?.failed || 0} ban ghi loi. Xem chi tiet trong hop ket qua.`;
  }
}

async function loadState() {
  if (!(await ensureAdminAccess())) {
    return false;
  }

  const [state, allFeedbackEntries] = await Promise.all([
    window.ClubStorage.readState(),
    window.ClubStorage.getFeedbackEntries().catch(() => []),
  ]);
  events = window.ClubStorage.sortEvents(state.events);
  registrations = window.ClubStorage.sortRegistrations(state.registrations);
  feedbackEntries = window.ClubStorage.sortFeedbackEntries(allFeedbackEntries);
  return true;
}

function resetMessages() {
  errorBox.innerText = "";
  successBox.innerText = "";
}

function clearFieldErrors() {
  Object.keys(requiredFields).forEach((fieldId) => {
    clearFieldError(fieldId);
  });
}

function clearFieldError(fieldId) {
  document.getElementById(fieldId)?.classList.remove("form-input-error");
  if (fieldErrorElements[fieldId]) {
    fieldErrorElements[fieldId].innerText = "";
  }
}

function setFieldError(fieldId, message) {
  document.getElementById(fieldId)?.classList.add("form-input-error");
  if (fieldErrorElements[fieldId]) {
    fieldErrorElements[fieldId].innerText = message;
  }
}

function syncInlineValidation(fieldId) {
  const eventId = document.getElementById("eventId").value;
  const currentEvent = events.find((item) => item.id === eventId);
  const field = document.getElementById(fieldId);
  const value = field.value.trim();

  clearFieldError(fieldId);

  if (requiredFields[fieldId] && !value) {
    setFieldError(fieldId, "Vui lòng nhập thông tin này.");
    return;
  }

  if (fieldId === "max") {
    if (Number(value) <= 0) {
      setFieldError(fieldId, "Số lượng người tham gia tối đa phải lớn hơn 0.");
      return;
    }

    if (currentEvent && Number(value) < currentEvent.registered) {
      setFieldError(
        fieldId,
        `Số lượng tối đa không được nhỏ hơn số sinh viên đã đăng ký (${currentEvent.registered}).`,
      );
      return;
    }
  }

  if (fieldId === "start" || fieldId === "end") {
    const startValue = document.getElementById("start").value;
    const endValue = document.getElementById("end").value;
    clearFieldError("end");

    if (!endValue) {
      return;
    }

    if (!startValue) {
      setFieldError("start", "Vui lòng nhập thông tin này.");
      return;
    }

    if (Date.parse(endValue) <= Date.parse(startValue)) {
      setFieldError("end", "Thời gian kết thúc phải sau thời gian bắt đầu.");
    }
  }
}

function resetForm() {
  form.reset();
  document.getElementById("eventId").value = "";
  document.getElementById("btnDeleteDetail").style.display = "none";
  clearFieldErrors();
}

function hideDetailPanel() {
  selectedDetailEventId = null;
  detailSection.style.display = "none";
  btnViewRegistrations.disabled = true;
  btnViewFeedback.disabled = true;
  btnOpenRegistrationsPage.disabled = true;
  btnOpenFeedbackPage.disabled = true;
  detailRegistrationTitle.innerText = DEFAULT_DETAIL_REGISTRATION_TITLE;
  detailRegistrationSummary.innerText = DEFAULT_DETAIL_REGISTRATION_SUMMARY;
  detailFeedbackTitle.innerText = DEFAULT_DETAIL_FEEDBACK_TITLE;
  detailFeedbackSummary.innerText = DEFAULT_DETAIL_FEEDBACK_SUMMARY;
  setSelectedEventInUrl("");
}

function renderDetailPanel(eventId) {
  const event = events.find((item) => item.id === eventId);

  if (!event) {
    hideDetailPanel();
    return;
  }

  selectedDetailEventId = event.id;
  detailSection.style.display = "block";
  document.getElementById("detailCode").innerText = event.code;
  document.getElementById("detailName").innerText = event.name;
  document.getElementById("detailDescription").innerText =
    event.desc || "Chưa cập nhật";
  document.getElementById("detailSpeaker").innerText =
    event.speaker || "Chưa cập nhật";
  document.getElementById("detailTime").innerText = window.ClubStorage.formatDateRange(
    event.start,
    event.end,
  );
  document.getElementById("detailLocation").innerText = event.location;
  document.getElementById("detailCapacity").innerText = `${event.registered}/${event.max}`;

  const eventRegistrations = registrations.filter(
    (registration) => registration.eventId === event.id,
  );
  const checkedInCount = eventRegistrations.filter((registration) => {
    return Boolean(registration.checkedInAt) || Boolean(registration.checkedIn);
  }).length;
  const eventFeedback = feedbackEntries.filter((feedback) => feedback.eventId === event.id);
  const hiddenFeedbackCount = eventFeedback.filter((feedback) => feedback.isHidden).length;

  btnViewRegistrations.disabled = false;
  btnViewFeedback.disabled = false;
  btnOpenRegistrationsPage.disabled = false;
  btnOpenFeedbackPage.disabled = false;
  detailRegistrationTitle.innerText = `Danh sách sinh viên của ${event.code}`;
  detailRegistrationSummary.innerText = `${eventRegistrations.length} lượt đăng ký, ${checkedInCount} lượt đã điểm danh. Mở trang riêng để xem đầy đủ danh sách sinh viên và trạng thái check-in của sự kiện này.`;
  detailFeedbackTitle.innerText = `Đánh giá của ${event.code}`;
  detailFeedbackSummary.innerText =
    eventFeedback.length === 0
      ? "Sự kiện này chưa có đánh giá nào từ sinh viên."
      : `${eventFeedback.length} đánh giá, ${hiddenFeedbackCount} lượt đang bị ẩn. Mở trang riêng để rà soát nội dung và điều chỉnh trạng thái hiển thị.`;
  setSelectedEventInUrl(event.id);
}

function setEditingEvent(event) {
  document.getElementById("eventId").value = event.id;
  document.getElementById("name").value = event.name;
  document.getElementById("description").value = event.desc;
  document.getElementById("speaker").value = event.speaker;
  document.getElementById("start").value =
    window.ClubStorage.toDateTimeLocalValue(event.start);
  document.getElementById("end").value =
    window.ClubStorage.toDateTimeLocalValue(event.end);
  document.getElementById("location").value = event.location;
  document.getElementById("max").value = event.max;
  document.getElementById("btnDeleteDetail").style.display = "block";
}

function updateSummary() {
  const openEvents = events.filter((event) => {
    return window.ClubStorage.getEventStatus(event).canRegister;
  }).length;

  document.getElementById("totalEvents").innerText = events.length;
  document.getElementById("openEvents").innerText = openEvents;
  document.getElementById("totalRegistrations").innerText = registrations.length;
}

function renderEventsView() {
  updateSummary();

  if (events.length === 0) {
    hideDetailPanel();
    list.innerHTML = `
      <tr>
        <td colspan="7">Chưa có sự kiện nào. Hãy tạo sự kiện đầu tiên.</td>
      </tr>
    `;
    return;
  }

  list.innerHTML = events
    .map((event) => {
      const status = window.ClubStorage.getEventStatus(event);
      const rowClass = recentlySavedEventId === event.id ? "row-just-saved" : "";
      return `
        <tr class="${rowClass}" data-event-id="${escapeHtml(event.id)}">
          <td>${escapeHtml(event.code)}</td>
          <td>${escapeHtml(event.name)}</td>
          <td>${escapeHtml(
            window.ClubStorage.formatDateRange(event.start, event.end),
          )}</td>
          <td>${escapeHtml(event.location)}</td>
          <td>${event.registered}/${event.max}</td>
          <td>
            <span class="status-badge status-${status.tone}">
              ${escapeHtml(status.text)}
            </span>
          </td>
          <td>
            <button class="secondary-btn action-inline" onclick="viewEventDetail('${event.id}')">Chi tiết</button>
            <button class="secondary-btn action-inline" onclick="openEventFeedbackPage('${event.id}')">Đánh giá</button>
            <button class="edit-btn" onclick="editEvent('${event.id}')">Sửa</button>
            <button class="delete-btn" onclick="deleteEvent('${event.id}')">Xóa sự kiện</button>
          </td>
        </tr>
      `;
    })
    .join("");

  if (recentlySavedEventId) {
    const activeRow = list.querySelector(
      `[data-event-id="${recentlySavedEventId}"]`,
    );

    activeRow?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => {
      recentlySavedEventId = null;
    }, 2400);
  }

  if (selectedDetailEventId) {
    renderDetailPanel(selectedDetailEventId);
  } else {
    hideDetailPanel();
  }
}

async function refreshPage(options = {}) {
  const keepMessages = Boolean(options.keepMessages);

  if (!keepMessages) {
    resetMessages();
  }

  if (!(await loadState())) {
    return false;
  }

  const requestedEventId = getRequestedEventIdFromUrl();
  if (requestedEventId) {
    selectedDetailEventId = requestedEventId;
  }

  renderAdminSession();
  renderEventsView();
  return true;
}

function validateEventPayload(payload, currentEvent) {
  const fieldErrors = {};

  Object.keys(requiredFields).forEach((fieldId) => {
    if (!String(payload[fieldId] ?? "").trim()) {
      fieldErrors[fieldId] = "Vui lòng nhập thông tin này.";
    }
  });

  if (Object.keys(fieldErrors).length > 0) {
    return {
      fieldErrors,
      message: "Vui lòng điền đầy đủ các trường bắt buộc.",
    };
  }

  if (Number(payload.max) <= 0) {
    return {
      fieldErrors: {
        max: "Số lượng người tham gia tối đa phải lớn hơn 0.",
      },
      message: "Vui lòng kiểm tra lại thông tin số lượng tham gia.",
    };
  }

  if (Date.parse(payload.end) <= Date.parse(payload.start)) {
    return {
      fieldErrors: {
        end: "Thời gian kết thúc phải sau thời gian bắt đầu.",
      },
      message: "Vui lòng kiểm tra lại mốc thời gian sự kiện.",
    };
  }

  if (currentEvent && Number(payload.max) < currentEvent.registered) {
    return {
      fieldErrors: {
        max: `Số lượng tối đa không được nhỏ hơn số sinh viên đã đăng ký (${currentEvent.registered}).`,
      },
      message: "Vui lòng kiểm tra lại số lượng người tham gia tối đa.",
    };
  }

  return {
    fieldErrors: {},
    message: "",
  };
}

async function handleFormSubmit(event) {
  event.preventDefault();
  resetMessages();
  clearFieldErrors();

  if (!(await loadState())) {
    return;
  }

  const eventId = document.getElementById("eventId").value;
  const payload = {
    name: window.ClubStorage.normalizeString(document.getElementById("name").value),
    desc: window.ClubStorage.normalizeString(
      document.getElementById("description").value,
    ),
    speaker: window.ClubStorage.normalizeString(
      document.getElementById("speaker").value,
    ),
    start: document.getElementById("start").value,
    end: document.getElementById("end").value,
    location: window.ClubStorage.normalizeString(
      document.getElementById("location").value,
    ),
    max: document.getElementById("max").value,
  };
  const currentEvent = events.find((item) => item.id === eventId);
  const validationResult = validateEventPayload(payload, currentEvent);

  if (validationResult.message) {
    Object.entries(validationResult.fieldErrors).forEach(([fieldId, message]) => {
      setFieldError(fieldId, message);
    });
    errorBox.innerText = validationResult.message;
    return;
  }

  if (eventId) {
    const result = await window.ClubStorage.updateEvent(eventId, payload);
    recentlySavedEventId = result.event.id;
    showToast("Cập nhật thành công");
    successBox.innerText = "Cập nhật thành công.";
    resetForm();
    await refreshPage({ keepMessages: true });
    renderDetailPanel(result.event.id);
    return;
  }

  const result = await window.ClubStorage.createEvent(payload);
  recentlySavedEventId = result.event.id;
  showToast("Tạo sự kiện thành công");
  resetForm();
  successBox.innerText = "Tạo sự kiện thành công.";
  await refreshPage({ keepMessages: true });
  renderDetailPanel(result.event.id);
}

function editEvent(eventId) {
  resetMessages();
  const event = events.find((item) => item.id === eventId);

  if (!event) {
    showToast("Không tìm thấy sự kiện cần chỉnh sửa");
    return;
  }

  setEditingEvent(event);
  renderDetailPanel(eventId);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function viewEventDetail(eventId) {
  resetMessages();
  renderDetailPanel(eventId);
  detailSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function deleteEvent(eventId) {
  const event = events.find((item) => item.id === eventId);
  deleteEventId = eventId;
  deleteMessage.innerText = event
    ? `Bạn có chắc chắn muốn xóa sự kiện "${event.name}" không?`
    : "Bạn có chắc chắn muốn xóa sự kiện này không?";
  document.getElementById("deleteModal").style.display = "flex";
}

function deleteFromDetail() {
  const eventId = document.getElementById("eventId").value;
  if (eventId) {
    deleteEvent(eventId);
  }
}

async function confirmDelete() {
  if (!deleteEventId) {
    return;
  }

  try {
    await window.ClubStorage.deleteEvent(deleteEventId);
    await refreshPage({ keepMessages: true });

    if (document.getElementById("eventId").value === deleteEventId) {
      resetForm();
    }

    if (selectedDetailEventId === deleteEventId) {
      hideDetailPanel();
    }

    showToast("Xóa sự kiện thành công");
  } catch (error) {
    errorBox.innerText = error.message;
  } finally {
    document.getElementById("deleteModal").style.display = "none";
    deleteEventId = null;
    deleteMessage.innerText = "Bạn có chắc chắn muốn xóa sự kiện này không?";
  }
}

async function handleLogout() {
  await window.ClubAuth.logout();
  window.location.href = "../events/index.html";
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.innerText = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

function handleAsyncError(error) {
  console.error(error);
  errorBox.innerText = error?.message || "Không thể đồng bộ dữ liệu lúc này.";
}

form.addEventListener("submit", function onSubmit(event) {
  handleFormSubmit(event).catch(handleAsyncError);
});

document.getElementById("btnReset").addEventListener("click", function onReset() {
  resetForm();
  resetMessages();
});

homeBtn.addEventListener("click", function onHomeClick() {
  window.location.href = "../events/index.html";
});

importStudentsBtn.addEventListener("click", function onImportStudentsClick() {
  resetMessages();
  openImportModal();
});

importForm.addEventListener("submit", function onImportSubmit(event) {
  event.preventDefault();
  resetMessages();
  setImportBusyState("import");

  submitStudentImport({ dryRun: false })
    .catch((error) => {
      handleAsyncError(error);
    })
    .finally(() => {
      setImportBusyState("");
    });
});

validateImportStudentsBtn.addEventListener("click", function onValidateImport() {
  resetMessages();
  setImportBusyState("dry-run");

  submitStudentImport({ dryRun: true })
    .catch((error) => {
      handleAsyncError(error);
    })
    .finally(() => {
      setImportBusyState("");
    });
});

cancelImportStudentsBtn.addEventListener("click", function onCancelImport() {
  closeImportModal();
});

importFileInput.addEventListener("change", clearImportReport);
importKeepPasswordInput.addEventListener("change", clearImportReport);

logoutBtn.addEventListener("click", function onLogoutClick() {
  handleLogout().catch(handleAsyncError);
});

document
  .getElementById("btnEditFromDetail")
  .addEventListener("click", function onEditFromDetail() {
    if (selectedDetailEventId) {
      editEvent(selectedDetailEventId);
    }
  });

document
  .getElementById("btnDeleteFromPanel")
  .addEventListener("click", function onDeleteFromPanel() {
    if (selectedDetailEventId) {
      deleteEvent(selectedDetailEventId);
    }
  });

btnViewRegistrations.addEventListener("click", function onViewRegistrations() {
  openEventRegistrations();
});

btnViewFeedback.addEventListener("click", function onViewFeedback() {
  openEventFeedbackPage();
});

btnOpenRegistrationsPage.addEventListener("click", function onOpenRegistrationsPage() {
  openEventRegistrations();
});

btnOpenFeedbackPage.addEventListener("click", function onOpenFeedbackPage() {
  openEventFeedbackPage();
});

Object.keys(requiredFields).forEach((fieldId) => {
  document.getElementById(fieldId).addEventListener("input", function onInput() {
    syncInlineValidation(fieldId);

    const hasInlineErrors = Object.values(fieldErrorElements).some((element) => {
      return element.innerText.trim() !== "";
    });

    if (!hasInlineErrors) {
      errorBox.innerText = "";
    }
  });
});

document.getElementById("confirmDelete").onclick = function onConfirmDelete() {
  confirmDelete().catch(handleAsyncError);
};

document.getElementById("cancelDelete").onclick = function onCancelDelete() {
  document.getElementById("deleteModal").style.display = "none";
  deleteEventId = null;
  deleteMessage.innerText = "Bạn có chắc chắn muốn xóa sự kiện này không?";
};

window.onclick = function onWindowClick(event) {
  const deleteModal = document.getElementById("deleteModal");
  if (event.target === deleteModal) {
    deleteModal.style.display = "none";
    deleteEventId = null;
    deleteMessage.innerText = "Bạn có chắc chắn muốn xóa sự kiện này không?";
    return;
  }

  if (event.target === importModal) {
    closeImportModal();
  }
};

window.addEventListener("focus", function onFocus() {
  refreshPage({ keepMessages: true }).catch(handleAsyncError);
});

window.ClubAuth.subscribe(function onAuthChange() {
  refreshPage({ keepMessages: true }).catch(handleAsyncError);
});

window.deleteEvent = deleteEvent;
window.deleteFromDetail = deleteFromDetail;
window.editEvent = editEvent;
window.openEventFeedbackPage = openEventFeedbackPage;
window.viewEventDetail = viewEventDetail;

refreshPage().catch(handleAsyncError);
