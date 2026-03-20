let events = [];
let historyEntries = [];
let currentEventId = null;
const registerForm = document.getElementById("registerForm");
const registerSummaryError = document.getElementById("error");
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

function getEventContextFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return {
    eventId: params.get("eventId"),
    action: params.get("action"),
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function loadState() {
  const state = ClubStorage.readState();
  events = ClubStorage.sortEvents(state.events);
  const seen = new Set();
  historyEntries = ClubStorage.sortRegistrations(
    [...state.registrations, ...state.legacyHistory].filter((entry) => {
      const uniqueKey = [
        entry.eventId,
        entry.eventName,
        entry.start,
        entry.location,
        entry.studentId,
        entry.registeredAt,
      ].join("|");

      if (seen.has(uniqueKey)) {
        return false;
      }

      seen.add(uniqueKey);
      return true;
    }),
  );
}

function renderEvents() {
  const upcomingEvents = ClubStorage.getUpcomingEvents();
  const search = document.getElementById("search")?.value.toLowerCase() || "";
  const filteredEvents = upcomingEvents.filter((event) => {
    return event.name.toLowerCase().includes(search);
  });

  const html = filteredEvents
    .map((event, index) => {
      const status = ClubStorage.getEventStatus(event);
      const actionLabel = status.canRegister ? "Xem chi tiết" : "Xem thông tin";

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
          <td>${escapeHtml(ClubStorage.formatDateRange(event.start, event.end))}</td>
          <td>${escapeHtml(event.location)}</td>
          <td>${event.registered}/${event.max}</td>
          <td>
            <span class="status-badge status-${status.tone}">
              ${escapeHtml(status.text)}
            </span>
          </td>
          <td>
            <a class="action-btn" href="../events/detail.html?id=${encodeURIComponent(
              event.id,
            )}">
              ${escapeHtml(actionLabel)}
            </a>
          </td>
        </tr>
      `;
    })
    .join("");

  document.getElementById("eventTable").innerHTML =
    html ||
    `
      <tr>
        <td colspan="8">Hiện chưa có sự kiện sắp diễn ra phù hợp.</td>
      </tr>
    `;
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

function showDetail(eventId) {
  loadState();
  const event = events.find((item) => item.id === eventId);

  if (!event) {
    showToast("Sự kiện không còn tồn tại", "#850E35");
    return;
  }

  currentEventId = eventId;
  const status = ClubStorage.getEventStatus(event);
  const registerButton = document.querySelector(".register-btn");

  document.getElementById("detailName").innerText = event.name;
  document.getElementById("detailCode").innerText = event.code;
  document.getElementById("detailDesc").innerText = event.desc || "Chưa cập nhật";
  document.getElementById("detailSpeaker").innerText =
    event.speaker || "Chưa cập nhật";
  document.getElementById("detailTime").innerText = ClubStorage.formatDateRange(
    event.start,
    event.end,
  );
  document.getElementById("detailLocation").innerText = event.location;
  document.getElementById("detailMax").innerText = `${event.registered}/${event.max}`;
  document.getElementById("detailStatus").innerText = status.text;
  registerButton.disabled = !status.canRegister;
  registerButton.innerText = status.canRegister
    ? "Đăng ký tham gia"
    : "Không thể đăng ký";

  document.getElementById("detailModal").style.display = "flex";
}

function closeModal() {
  document.getElementById("detailModal").style.display = "none";
}

function openRegister() {
  loadState();
  const event = events.find((item) => item.id === currentEventId);

  if (!event) {
    showToast("Sự kiện không còn tồn tại", "#850E35");
    closeModal();
    return;
  }

  const status = ClubStorage.getEventStatus(event);
  if (!status.canRegister) {
    showToast(status.text, "#850E35");
    return;
  }

  clearRegisterValidation();
  document.getElementById("registerModal").style.display = "flex";
}

function closeRegister() {
  document.getElementById("registerModal").style.display = "none";
  clearRegisterValidation();
}

function resetRegisterForm() {
  document.getElementById("studentName").value = "";
  document.getElementById("studentId").value = "";
  document.getElementById("studentCourse").value = "";
  document.getElementById("studentGender").value = "";
  clearRegisterValidation();
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

  Object.keys(registerRequiredFields).forEach((fieldId) => {
    if (!String(payload[fieldId] ?? "").trim()) {
      fieldErrors[fieldId] = "Vui lòng không bỏ trống thông tin này.";
    }
  });

  return {
    fieldErrors,
    message:
      Object.keys(fieldErrors).length > 0
        ? "Vui lòng điền đầy đủ thông tin bắt buộc trước khi đăng ký."
        : "",
  };
}

function syncRegisterFieldValidation(fieldId) {
  const value = document.getElementById(fieldId).value.trim();

  document.getElementById(fieldId).classList.remove("form-input-error");
  registerFieldErrors[fieldId].innerText = "";

  if (!value) {
    setRegisterFieldError(fieldId, "Vui lòng không bỏ trống thông tin này.");
  }

  const hasInlineErrors = Object.values(registerFieldErrors).some((element) => {
    return element.innerText.trim() !== "";
  });

  if (!hasInlineErrors) {
    registerSummaryError.innerText = "";
  }
}

function registerEvent() {
  loadState();
  clearRegisterValidation();

  const payload = {
    studentName: ClubStorage.normalizeString(
    document.getElementById("studentName").value,
    ),
    studentId: ClubStorage.normalizeString(
    document.getElementById("studentId").value,
    ),
    studentCourse: ClubStorage.normalizeString(
    document.getElementById("studentCourse").value,
    ),
    studentGender: ClubStorage.normalizeString(
    document.getElementById("studentGender").value,
    ),
  };
  const validationResult = validateRegisterPayload(payload);

  if (validationResult.message) {
    Object.entries(validationResult.fieldErrors).forEach(([fieldId, message]) => {
      setRegisterFieldError(fieldId, message);
    });
    registerSummaryError.innerText = validationResult.message;
    return;
  }

  const result = ClubStorage.registerStudent(currentEventId, {
    studentName: payload.studentName,
    studentId: payload.studentId,
    studentCourse: payload.studentCourse,
    studentGender: payload.studentGender,
  });

  if (!result.ok) {
    if (
      result.message.includes("MSSV này đã đăng ký") ||
      result.message.includes("MSSV")
    ) {
      setRegisterFieldError("studentId", result.message);
    }
    registerSummaryError.innerText = result.message;
    showToast(result.message, "#850E35", "#c0171f");
    return;
  }

  loadState();
  renderEvents();
  renderHistory();
  showDetail(currentEventId);
  closeRegister();
  showToast("Đăng ký sự kiện thành công!", "#1f8b4c", "#146c3a");
  resetRegisterForm();
}

function renderHistory() {
  loadState();

  const html = historyEntries
    .map((entry) => {
      return `
        <tr>
          <td>${escapeHtml(entry.eventCode || "-")}</td>
          <td>${escapeHtml(entry.eventName)}</td>
          <td>${escapeHtml(ClubStorage.formatDateRange(entry.start, entry.end))}</td>
          <td>${escapeHtml(entry.location || "-")}</td>
          <td>${escapeHtml(entry.studentName || "-")}</td>
          <td>${escapeHtml(entry.studentId || "-")}</td>
          <td>${escapeHtml(ClubStorage.formatDateTime(entry.registeredAt))}</td>
          <td>${escapeHtml(entry.status || "Đã đăng ký")}</td>
        </tr>
      `;
    })
    .join("");

  document.getElementById("historyList").innerHTML =
    html ||
    `
      <tr>
        <td colspan="8">Chưa có lịch sử đăng ký nào.</td>
      </tr>
    `;
}

function showEvents() {
  document.getElementById("history").style.display = "none";
  document.getElementById("eventList").style.display = "block";

  const items = document.querySelectorAll(".menu-item");
  items.forEach((item) => item.classList.remove("active"));
  items[0].classList.add("active");
}

function showHistory() {
  document.getElementById("eventList").style.display = "none";
  document.getElementById("history").style.display = "block";

  const items = document.querySelectorAll(".menu-item");
  items.forEach((item) => item.classList.remove("active"));
  items[1].classList.add("active");
}

function openRequestedEventFromUrl() {
  const { eventId, action } = getEventContextFromUrl();

  if (!eventId) {
    return;
  }

  loadState();
  const requestedEvent = events.find((event) => event.id === eventId);

  if (!requestedEvent) {
    showToast("Sự kiện được yêu cầu không còn tồn tại", "#850E35");
    return;
  }

  showEvents();
  showDetail(eventId);

  if (action === "register") {
    openRegister();
  }

  if (window.history.replaceState) {
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

document.getElementById("menuBtn").onclick = function () {
  document.getElementById("sidebar").classList.toggle("hide");
};

document.getElementById("search").addEventListener("input", renderEvents);

Object.keys(registerRequiredFields).forEach((fieldId) => {
  document.getElementById(fieldId).addEventListener("input", function () {
    syncRegisterFieldValidation(fieldId);
  });
  document.getElementById(fieldId).addEventListener("change", function () {
    syncRegisterFieldValidation(fieldId);
  });
});

registerForm.addEventListener("submit", function (event) {
  event.preventDefault();
  registerEvent();
});

function toggleStudentMenu() {
  const menu = document.getElementById("studentMenu");
  const arrow = document.querySelector(".arrow");

  if (menu.style.display === "none" || menu.style.display === "") {
    menu.style.display = "block";
    arrow.innerHTML = "▲";
  } else {
    menu.style.display = "none";
    arrow.innerHTML = "▼";
  }
}

window.onclick = function (event) {
  const detailModal = document.getElementById("detailModal");
  const registerModal = document.getElementById("registerModal");

  if (event.target === detailModal) {
    closeModal();
  }

  if (event.target === registerModal) {
    closeRegister();
  }
};

window.addEventListener("storage", function () {
  renderEvents();
  renderHistory();
});

function showToast(message, color = "#850E35", accentColor = "#cf3439") {
  const toast = document.getElementById("toast");
  toast.innerText = message;
  toast.style.background = color;
  toast.style.borderLeftColor = accentColor;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2000);
}

renderEvents();
renderHistory();
openRequestedEventFromUrl();
