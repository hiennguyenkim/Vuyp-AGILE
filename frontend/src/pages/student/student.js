import "../../services/auth.js";
import "../../services/storage.js";

let events = [];
let historyEntries = [];
let currentEventId = null;
let currentUser = null;

const registerForm = document.getElementById("registerForm");
const registerSummaryError = document.getElementById("error");
const authGreeting = document.getElementById("authGreeting");
const authSubline = document.getElementById("authSubline");
const authCardTitle = document.getElementById("authCardTitle");
const authCardDescription = document.getElementById("authCardDescription");
const pendingRegisterNotice = document.getElementById("pendingRegisterNotice");
const homeShortcutBtn = document.getElementById("homeShortcutBtn");
const logoutBtn = document.getElementById("logoutBtn");
const studentQrFrame = document.getElementById("studentQrFrame");
const registerTargetEvent = document.getElementById("registerTargetEvent");
const registerAuthNote = document.getElementById("registerAuthNote");
const registerRequiredFields = {
  studentName: "Họ tên",
  studentId: "MSSV",
  studentCourse: "Khóa",
  studentGender: "Giới tính",
};
const registerFieldErrors = {
  studentName: document.getElementById("studentNameError"),
  studentId: document.getElementById("studentIdError"),
  studentCourse: document.getElementById("studentCourseError"),
  studentGender: document.getElementById("studentGenderError"),
};

const fbData = {};
let currentFbEventId = null;

function initFbData() {
  events.forEach((event) => {
    if (!fbData[event.id]) {
      fbData[event.id] = {
        name: event.name,
        location: event.location,
        date: window.ClubStorage.formatDateRange(event.start, event.end),
        reviews: [],
      };
    }
  });

  const sel = document.getElementById("fbEventSelect");
  if (!sel) return;

  const previousValue = sel.value;

  sel.innerHTML = '<option value="">-- Chọn sự kiện --</option>';
  events.forEach((event) => {
    const opt = document.createElement("option");
    opt.value = event.id;
    opt.textContent = `${event.name} | ${window.ClubStorage.formatDateRange(event.start, event.end)}`;
    sel.appendChild(opt);
  });

  if (previousValue && fbData[previousValue]) {
    sel.value = previousValue;
  }
}

// ============================================================
// URL / AUTH HELPERS
// ============================================================
function getPageContextFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return {
    eventId: params.get("eventId"),
    action: params.get("action"),
    view: params.get("view"),
  };
}

function clearPageContextFromUrl() {
  if (window.location.search && window.history.replaceState) {
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

function buildHomeRedirectUrl() {
  const context = getPageContextFromUrl();
  const params = new URLSearchParams();
  params.set("next", "student");
  if (context.eventId) params.set("eventId", context.eventId);
  if (context.action)  params.set("action",  context.action);
  if (context.view)    params.set("view",     context.view);
  return `../auth/login.html?${params.toString()}`;
}

async function ensureStudentAccess() {
  await window.ClubAuth.ready();
  currentUser = window.ClubAuth.getCurrentUser();

  if (!currentUser || !window.ClubAuth.isStudent(currentUser)) {
    window.location.replace(buildHomeRedirectUrl());
    return false;
  }

  return true;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isCurrentUserRegisteredForEvent(eventId) {
  return historyEntries.some((entry) => entry.eventId === eventId);
}

function getStudentQrUrl() {
  const params = new URLSearchParams();
  params.set("code", currentUser.studentId);
  params.set("name", currentUser.studentName);
  params.set("mssv", currentUser.studentId);
  params.set("readonly", "1");

  return `qr.html?${params.toString()}`;
}

async function loadState() {
  if (!(await ensureStudentAccess())) return false;
  const [loadedEvents, loadedHistory] = await Promise.all([
    window.ClubStorage.getUpcomingEvents(),
    window.ClubStorage.getHistoryEntries(currentUser.studentId),
  ]);
  events = window.ClubStorage.sortEvents(loadedEvents);
  historyEntries = window.ClubStorage.sortRegistrations(loadedHistory);
  return true;
}

function getEventById(eventId) {
  return events.find((event) => event.id === eventId) || null;
}

function upsertEvent(event) {
  if (!event) return;
  const index = events.findIndex((item) => item.id === event.id);
  if (index === -1) {
    events = window.ClubStorage.sortEvents([...events, event]);
    return;
  }

  const updatedEvents = [...events];
  updatedEvents[index] = event;
  events = window.ClubStorage.sortEvents(updatedEvents);
}

function renderAuthPanel() {
  authGreeting.innerText = `${currentUser.studentName} (${currentUser.studentId})`;
  authSubline.innerText = "Bạn đang đăng nhập bằng tài khoản sinh viên.";
  authCardTitle.innerText = `Xin chào, ${currentUser.studentName}`;
  authCardDescription.innerText =
    "Mọi thao tác đăng ký sự kiện và tạo QR check-in sẽ lấy trực tiếp từ hồ sơ sinh viên hiện tại.";
  document.getElementById("accountName").innerText = currentUser.studentName;
  document.getElementById("accountStudentId").innerText = currentUser.studentId;
  document.getElementById("accountCourse").innerText = currentUser.studentCourse;
  document.getElementById("accountGender").innerText = currentUser.studentGender;
  document.getElementById("accountNote").innerText =
    "QR sinh viên bên dưới được tạo trực tiếp từ MSSV của tài khoản hiện tại để phục vụ check-in.";

  const { eventId, action } = getPageContextFromUrl();
  const requestedEvent = eventId ? getEventById(eventId) : null;

  pendingRegisterNotice.hidden = !(requestedEvent && action === "register");
  pendingRegisterNotice.innerText =
    requestedEvent && action === "register"
      ? `Sự kiện đang chờ đăng ký: ${requestedEvent.code} - ${requestedEvent.name}`
      : "";
}

function renderStudentQr() {
  const newSrc = getStudentQrUrl();
  if (studentQrFrame.src !== newSrc) {
    studentQrFrame.src = newSrc;
  }
}

function syncRegisterFormWithSession() {
  document.getElementById("studentName").value = currentUser.studentName;
  document.getElementById("studentId").value = currentUser.studentId;
  document.getElementById("studentCourse").value = currentUser.studentCourse;
  document.getElementById("studentGender").value = currentUser.studentGender;
  document.getElementById("studentName").readOnly = true;
  document.getElementById("studentId").readOnly = true;
  document.getElementById("studentCourse").readOnly = true;
  document.getElementById("studentGender").disabled = true;
  registerAuthNote.hidden = false;
}

function renderEvents() {
  const search = document.getElementById("search")?.value.toLowerCase() || "";
  const filteredEvents = events.filter((event) =>
    [event.name, event.code, event.location, event.speaker]
      .join(" ")
      .toLowerCase()
      .includes(search),
  );

  const html = filteredEvents
    .map((event, index) => {
      const status = window.ClubStorage.getEventStatus(event);
      const actionLabel = isCurrentUserRegisteredForEvent(event.id)
        ? "Đã đăng ký"
        : status.canRegister
          ? "Xem chi tiết"
          : "Xem thông tin";

      return `
        <tr
          class="event-row-link"
          onclick="openEventDetail('${event.id}')"
          onkeydown="handleEventRowKeydown(event, '${event.id}')"
          tabindex="0"
          role="link"
        >
          <td>${index + 1}</td>
          <td>${escapeHtml(event.name)}</td>
          <td>${escapeHtml(event.code)}</td>
          <td>${escapeHtml(window.ClubStorage.formatDateRange(event.start, event.end))}</td>
          <td>${escapeHtml(event.location)}</td>
          <td>${event.registered}/${event.max}</td>
          <td>
            <span class="status-badge status-${status.tone}">
              ${escapeHtml(status.text)}
            </span>
          </td>
          <td>
            <a class="action-btn" href="../events/detail.html?id=${encodeURIComponent(event.id)}">
              ${escapeHtml(actionLabel)}
            </a>
          </td>
        </tr>
      `;
    })
    .join("");

  document.getElementById("eventTable").innerHTML =
    html ||
    `<tr><td colspan="8">Hiện chưa có sự kiện đang mở hoặc sắp diễn ra phù hợp.</td></tr>`;
}

function openEventDetail(eventId) {
  window.location.href = `../events/detail.html?id=${encodeURIComponent(eventId)}`;
}

function handleEventRowKeydown(event, eventId) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    openEventDetail(eventId);
  }
}

async function showDetail(eventId) {
  if (!(await ensureStudentAccess())) return;

  const event = await window.ClubStorage.getEventById(eventId);

  if (!event) {
    showToast("Sự kiện không còn tồn tại", "#850E35");
    return;
  }

  upsertEvent(event);
  currentEventId = eventId;
  const status = window.ClubStorage.getEventStatus(event);
  const hasRegistered = await window.ClubStorage.hasStudentRegistration(
    eventId,
    currentUser.studentId,
  );
  const registerButton = document.querySelector(".register-btn");

  document.getElementById("detailName").innerText = event.name;
  document.getElementById("detailCode").innerText = event.code;
  document.getElementById("detailDesc").innerText = event.desc || "Chưa cập nhật";
  document.getElementById("detailSpeaker").innerText = event.speaker || "Chưa cập nhật";
  document.getElementById("detailTime").innerText = window.ClubStorage.formatDateRange(event.start, event.end);
  document.getElementById("detailLocation").innerText = event.location;
  document.getElementById("detailMax").innerText = `${event.registered}/${event.max}`;
  document.getElementById("detailStatus").innerText = status.text;

  if (hasRegistered) {
    registerButton.disabled = true;
    registerButton.innerText = "Bạn đã đăng ký sự kiện này";
  } else if (status.canRegister) {
    registerButton.disabled = false;
    registerButton.innerText = "Đăng ký tham gia";
  } else {
    registerButton.disabled = true;
    registerButton.innerText = "Không thể đăng ký";
  }

  document.getElementById("detailModal").style.display = "flex";
}

function closeModal() {
  document.getElementById("detailModal").style.display = "none";
}

function clearRegisterValidation() {
  registerSummaryError.innerText = "";
  Object.keys(registerRequiredFields).forEach((fieldId) => {
    document.getElementById(fieldId).classList.remove("form-input-error");
    registerFieldErrors[fieldId].innerText = "";
  });
}

function setRegisterFieldError(fieldId, message) {
  document.getElementById(fieldId).classList.add("form-input-error");
  registerFieldErrors[fieldId].innerText = message;
}

function validateRegisterPayload(payload) {
  const fieldErrors = {};
  const missingFields = [];

  Object.keys(registerRequiredFields).forEach((fieldId) => {
    if (!String(payload[fieldId] ?? "").trim()) {
      fieldErrors[fieldId] = "Thông tin này đang thiếu trong hồ sơ tài khoản.";
      missingFields.push(registerRequiredFields[fieldId]);
    }
  });

  return {
    fieldErrors,
    message:
      missingFields.length > 0
        ? `Hồ sơ sinh viên hiện còn thiếu: ${missingFields.join(", ")}. Vui lòng cập nhật dữ liệu trong bảng profiles trước khi đăng ký.`
        : "",
  };
}

function resetRegisterForm() {
  syncRegisterFormWithSession();
  registerTargetEvent.innerText = "";
  clearRegisterValidation();
}

function closeRegister() {
  document.getElementById("registerModal").style.display = "none";
  resetRegisterForm();
}

function syncRegisterFieldValidation(fieldId) {
  const value = document.getElementById(fieldId).value.trim();

  document.getElementById(fieldId).classList.remove("form-input-error");
  registerFieldErrors[fieldId].innerText = "";

  if (!value) {
    setRegisterFieldError(fieldId, "Thông tin này đang thiếu trong hồ sơ tài khoản.");
  }
  const hasInlineErrors = Object.values(registerFieldErrors).some(
    (element) => element.innerText.trim() !== "",
  );
  if (!hasInlineErrors) registerSummaryError.innerText = "";
}

async function openRegister() {
  if (!(await ensureStudentAccess())) return;

  const event = await window.ClubStorage.getEventById(currentEventId);

  if (!event) {
    showToast("Sự kiện không còn tồn tại", "#850E35");
    closeModal();
    return;
  }

  upsertEvent(event);
  const status = window.ClubStorage.getEventStatus(event);

  if (!status.canRegister) {
    showToast(status.text, "#850E35");
    return;
  }

  if (await window.ClubStorage.hasStudentRegistration(event.id, currentUser.studentId)) {
    showToast("Bạn đã đăng ký sự kiện này rồi.", "#1c5da9", "#154a8a");
    closeModal();
    return;
  }

  clearRegisterValidation();
  syncRegisterFormWithSession();
  registerTargetEvent.innerText = `${event.code} - ${event.name}`;
  document.getElementById("registerModal").style.display = "flex";
}

async function registerEvent() {
  if (!(await ensureStudentAccess())) return;

  clearRegisterValidation();

  const payload = {
    studentName: window.ClubStorage.normalizeString(currentUser.studentName),
    studentId: window.ClubStorage.normalizeString(currentUser.studentId),
    studentCourse: window.ClubStorage.normalizeString(currentUser.studentCourse),
    studentGender: window.ClubStorage.normalizeString(currentUser.studentGender),
  };
  const validationResult = validateRegisterPayload(payload);

  if (validationResult.message) {
    Object.entries(validationResult.fieldErrors).forEach(([fieldId, message]) => {
      setRegisterFieldError(fieldId, message);
    });
    registerSummaryError.innerText = validationResult.message;
    return;
  }

  const result = await window.ClubStorage.registerStudent(currentEventId, payload);

  if (!result.ok) {
    if (result.message.includes("MSSV này đã đăng ký") || result.message.includes("MSSV")) {
      setRegisterFieldError("studentId", result.message);
    }
    registerSummaryError.innerText = result.message;
    showToast(result.message, "#850E35", "#c0171f");
    return;
  }

  await refreshPage();
  closeModal();
  closeRegister();
  showToast("Đăng ký thành công. QR check-in cá nhân nằm ở Trang cá nhân.", "#1f8b4c", "#146c3a");
}

function renderHistory() {
  const html = historyEntries
    .map(
      (entry) => `
        <tr>
          <td>${escapeHtml(entry.eventCode || "-")}</td>
          <td>${escapeHtml(entry.eventName)}</td>
          <td>${escapeHtml(window.ClubStorage.formatDateRange(entry.start, entry.end))}</td>
          <td>${escapeHtml(entry.location || "-")}</td>
          <td>${escapeHtml(entry.studentName || "-")}</td>
          <td>${escapeHtml(entry.studentId || "-")}</td>
          <td>${escapeHtml(window.ClubStorage.formatDateTime(entry.registeredAt))}</td>
          <td>${escapeHtml(entry.status || "Đã đăng ký")}</td>
        </tr>
      `,
    )
    .join("");

  document.getElementById("historyList").innerHTML =
    html ||
    `<tr><td colspan="8">Chưa có lịch sử đăng ký nào cho tài khoản này.</td></tr>`;
}
const SECTIONS = {
  eventList: "menuEvents",
  profile:   "menuProfile",
  history:   "menuHistory",
  feedback:  "menuFeedback",
};

function showSection(sectionId) {
  Object.keys(SECTIONS).forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });

  const target = document.getElementById(sectionId);
  if (target) target.style.display = "block";

  Object.values(SECTIONS).forEach((menuId) => {
    const el = document.getElementById(menuId);
    if (el) el.classList.remove("active");
  });
  const activeMenu = document.getElementById(SECTIONS[sectionId]);
  if (activeMenu) activeMenu.classList.add("active");
}

function showEvents()   { showSection("eventList"); }
function showProfile()  { showSection("profile");   }
function showHistory()  { showSection("history");   }
function showFeedback() { showSection("feedback");  }

function toggleStudentMenu() {
  const menu = document.getElementById("studentMenu");
  const arrow = document.querySelector(".arrow");
  if (menu.style.display === "none") {
    menu.style.display = "block";
    arrow.innerHTML = "▲";
  } else {
    menu.style.display = "none";
    arrow.innerHTML = "▼";
  }
}

function fbStarsText(n) {
  return "★".repeat(n) + "☆".repeat(5 - n);
}

function fbCalcAvg(reviews) {
  if (!reviews.length) return 0;
  return (reviews.reduce((s, r) => s + r.stars, 0) / reviews.length).toFixed(1);
}

function fbTodayStr() {
  const now = new Date();
  return `${now.getDate().toString().padStart(2, "0")}/${(now.getMonth() + 1)
    .toString()
    .padStart(2, "0")}/${now.getFullYear()}`;
}

function onFbEventChange() {
  setTimeout(() => {
    const id = document.getElementById("fbEventSelect").value;
    currentFbEventId = id || null;

    const summary  = document.getElementById("fbRatingSummary");
    const topBar   = document.getElementById("fbTopBar");
    const heroName = document.getElementById("fbEventName");
    const heroMeta = document.getElementById("fbEventMeta");

    if (!id || !fbData[id]) {
      heroName.textContent = "Chọn sự kiện để xem đánh giá";
      heroMeta.textContent = "📍 —   📅 —";
      summary.style.display = "none";
      topBar.style.display  = "none";
      document.getElementById("fbReviewList").innerHTML =
        '<div class="no-reviews">Vui lòng chọn một sự kiện để xem đánh giá.</div>';
      return;
    }

    const ev = fbData[id];
    heroName.textContent = ev.name;
    heroMeta.textContent = `📍 ${ev.location}   📅 ${ev.date}`;
    summary.style.display = "";
    topBar.style.display  = "";

    renderFbReviews(id);
  }, 0);
}

function renderFbReviews(id) {
  const ev      = fbData[id];
  const reviews = ev.reviews;

  const avg = fbCalcAvg(reviews);
  document.getElementById("fbAvgScore").textContent    = avg;
  document.getElementById("fbAvgStars").textContent    = fbStarsText(Math.round(avg));
  document.getElementById("fbReviewCount").textContent = `${reviews.length} đánh giá`;

  const counts = [0, 0, 0, 0, 0];
  reviews.forEach((r) => counts[r.stars - 1]++);
  const barsEl = document.getElementById("fbRatingBars");
  barsEl.innerHTML = "";
  for (let i = 5; i >= 1; i--) {
    const pct = reviews.length ? Math.round((counts[i - 1] / reviews.length) * 100) : 0;
    barsEl.innerHTML += `
      <div class="rating-bar-row">
        <span class="bar-label">${i}★</span>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
        <span>${counts[i - 1]}</span>
      </div>`;
  }

  const listEl = document.getElementById("fbReviewList");
  if (!reviews.length) {
    listEl.innerHTML = '<div class="no-reviews">Chưa có đánh giá nào. Hãy là người đầu tiên!</div>';
    return;
  }

  listEl.innerHTML = reviews
    .slice()
    .reverse()
    .map(
      (r) => `
      <div class="review-card">
        <div class="review-card-header">
          <div class="review-card-meta">
            <div class="reviewer-avatar">${escapeHtml(r.name.charAt(0))}</div>
            <div>
              <div class="reviewer-name">${escapeHtml(r.name)}</div>
              <div class="reviewer-date">${escapeHtml(r.date)}</div>
            </div>
          </div>
          <div class="review-stars">${fbStarsText(r.stars)}</div>
        </div>
        <p class="review-content">${
          r.content
            ? escapeHtml(r.content)
            : '<em style="color:#bbb">Không có nội dung</em>'
        }</p>
        ${r.image ? `<img src="${r.image}" class="review-image" alt="ảnh đính kèm" />` : ""}
      </div>
    `,
    )
    .join("");
}

function openFbModal() {
  if (!currentFbEventId) {
    showToast("Vui lòng chọn sự kiện trước!", "#850E35");
    return;
  }
  const ev = fbData[currentFbEventId];
  document.getElementById("fbModalEventName").textContent = `Sự kiện: ${ev.name}`;
  document.getElementById("fbContent").value = "";
  document.getElementById("fbFileName").textContent = "Chưa chọn ảnh";
  document.getElementById("fbFileInput").value = "";
  document.getElementById("fbStarError").style.display = "none";
  document.querySelectorAll('[name="fbRating"]').forEach((r) => (r.checked = false));
  document.getElementById("feedbackModal").classList.add("open");
}

function closeFbModal() {
  document.getElementById("feedbackModal").classList.remove("open");
}

function onFbFileChange() {
  const file = document.getElementById("fbFileInput").files[0];
  document.getElementById("fbFileName").textContent = file ? file.name : "Chưa chọn ảnh";
}

function submitFbReview() {
  const radios = document.querySelectorAll('[name="fbRating"]');
  let selected = null;
  radios.forEach((r) => { if (r.checked) selected = parseInt(r.value); });

  if (!selected) {
    document.getElementById("fbStarError").style.display = "";
    return;
  }
  document.getElementById("fbStarError").style.display = "none";

  const content      = document.getElementById("fbContent").value.trim();
  const file         = document.getElementById("fbFileInput").files[0];
  const reviewerName = currentUser ? currentUser.studentName : "Sinh viên";

  const addReview = (imgSrc) => {
    fbData[currentFbEventId].reviews.push({
      name:    reviewerName,
      stars:   selected,
      content: content,
      date:    fbTodayStr(),
      image:   imgSrc || null,
    });
    renderFbReviews(currentFbEventId);
    closeFbModal();
    showToast("Cảm ơn bạn đã gửi đánh giá! 🎉", "#1f8b4c", "#146c3a");
  };

  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => addReview(e.target.result);
    reader.readAsDataURL(file);
  } else {
    addReview(null);
  }
}

async function handleLogout() {
  await window.ClubAuth.logout();
  window.location.href = "../events/index.html";
}

async function openRequestedContextFromUrl() {
  const { eventId, action, view } = getPageContextFromUrl();

  if (view === "profile")  showProfile();
  if (view === "history")  showHistory();
  if (view === "feedback") showFeedback();

  if (!eventId) { clearPageContextFromUrl(); return; }

  const requestedEvent = await window.ClubStorage.getEventById(eventId);

  if (!requestedEvent) {
    showToast("Sự kiện được yêu cầu không còn tồn tại", "#850E35");
    clearPageContextFromUrl();
    return;
  }

  upsertEvent(requestedEvent);
  currentEventId = eventId;

  if (action === "register") {
    await openRegister();
    clearPageContextFromUrl();
    return;
  }

  await showDetail(eventId);
  clearPageContextFromUrl();
}

async function refreshPage() {
  if (!(await loadState())) return false;
  renderAuthPanel();
  renderStudentQr();
  syncRegisterFormWithSession();
  renderEvents();
  renderHistory();
  initFbData();
  return true;
}

function showToast(message, color = "#850E35", accentColor = "#cf3439") {
  const toast = document.getElementById("toast");
  toast.innerText = message;
  toast.style.background = color;
  toast.style.borderLeftColor = accentColor;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2200);
}

function handleAsyncError(error) {
  console.error(error);
  showToast(error?.message || "Không thể đồng bộ dữ liệu sinh viên lúc này.", "#850E35", "#c0171f");
}

let lastRefreshTime = 0;
const REFRESH_COOLDOWN_MS = 60_000; // 1 minute minimum between background refreshes

function onTabVisible() {
  if (document.visibilityState !== "visible") return;
  const now = Date.now();
  if (now - lastRefreshTime < REFRESH_COOLDOWN_MS) return;
  lastRefreshTime = now;
  refreshPage().catch(handleAsyncError);
}

document.getElementById("menuBtn").onclick = () => {
  document.getElementById("sidebar").classList.toggle("hide");
};

document.getElementById("search").addEventListener("input", renderEvents);
homeShortcutBtn.addEventListener("click", () => { window.location.href = "../events/index.html"; });
logoutBtn.addEventListener("click", () => handleLogout().catch(handleAsyncError));

Object.keys(registerRequiredFields).forEach((fieldId) => {
  document.getElementById(fieldId).addEventListener("input",  () => syncRegisterFieldValidation(fieldId));
  document.getElementById(fieldId).addEventListener("change", () => syncRegisterFieldValidation(fieldId));
});

registerForm.addEventListener("submit", (e) => {
  e.preventDefault();
  registerEvent().catch(handleAsyncError);
});

document.getElementById("feedbackModal").addEventListener("click", function (e) {
  if (e.target === this) closeFbModal();
});

window.onclick = function (event) {
  if (event.target === document.getElementById("detailModal"))   closeModal();
  if (event.target === document.getElementById("registerModal")) closeRegister();
};

document.addEventListener("visibilitychange", onTabVisible);

window.ClubAuth.subscribe(() => refreshPage().catch(handleAsyncError));

window.showSection           = showSection;
window.showEvents            = showEvents;
window.showProfile           = showProfile;
window.showHistory           = showHistory;
window.showFeedback          = showFeedback;
window.toggleStudentMenu     = toggleStudentMenu;
window.closeModal            = closeModal;
window.closeRegister         = closeRegister;
window.handleEventRowKeydown = handleEventRowKeydown;
window.openEventDetail       = openEventDetail;
window.openRegister          = openRegister;
window.renderEvents          = renderEvents;
window.onFbEventChange       = onFbEventChange;
window.openFbModal           = openFbModal;
window.closeFbModal          = closeFbModal;
window.onFbFileChange        = onFbFileChange;
window.submitFbReview        = submitFbReview;

lastRefreshTime = Date.now(); // mark boot time so tab-switch right after load doesn't double-refresh
refreshPage()
  .then((isReady) => { if (isReady) return openRequestedContextFromUrl(); return null; })
  .catch(handleAsyncError);
