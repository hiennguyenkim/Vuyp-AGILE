let events = [];
let registrations = [];
let deleteEventId = null;
let recentlySavedEventId = null;
let selectedDetailEventId = null;

const form = document.getElementById("eventForm");
const list = document.getElementById("eventList");
const registrationList = document.getElementById("registrationList");
const registrationFilter = document.getElementById("registrationFilter");
const deleteMessage = document.getElementById("deleteMessage");
const errorBox = document.getElementById("error");
const successBox = document.getElementById("success");
const detailSection = document.getElementById("eventDetailSection");
const startInput = document.getElementById("start");
const endInput = document.getElementById("end");
const maxInput = document.getElementById("max");
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
  registrations = ClubStorage.sortRegistrations(state.registrations);
}

function getCurrentEditingEvent() {
  const eventId = document.getElementById("eventId").value;
  return events.find((item) => item.id === eventId) || null;
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

function formatDateTimeLocalValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function getCurrentDateTimeLocalValue() {
  const now = new Date();
  now.setSeconds(0, 0);
  return formatDateTimeLocalValue(now);
}

function pickMinimumDateTime(baseValue, currentValue) {
  const currentTime = Date.parse(currentValue || "");
  const baseTime = Date.parse(baseValue || "");

  if (
    currentValue &&
    Number.isFinite(currentTime) &&
    Number.isFinite(baseTime) &&
    currentTime < baseTime
  ) {
    return currentValue;
  }

  return baseValue;
}

function collectFormPayload() {
  return {
    name: ClubStorage.normalizeString(document.getElementById("name").value),
    desc: ClubStorage.normalizeString(
      document.getElementById("description").value,
    ),
    speaker: ClubStorage.normalizeString(
      document.getElementById("speaker").value,
    ),
    start: startInput.value,
    end: endInput.value,
    location: ClubStorage.normalizeString(
      document.getElementById("location").value,
    ),
    max: maxInput.value,
  };
}

function syncDateInputConstraints() {
  const currentEvent = getCurrentEditingEvent();
  const nowValue = getCurrentDateTimeLocalValue();
  const startMin = pickMinimumDateTime(nowValue, currentEvent?.start);
  const endBaseValue = startInput.value || startMin;
  const endMin = pickMinimumDateTime(endBaseValue, currentEvent?.end);

  startInput.min = startMin;
  endInput.min = endMin;
  maxInput.min = "1";
  maxInput.step = "1";
}

function syncInlineValidation(fieldId) {
  loadState();
  syncDateInputConstraints();
  const currentEvent = getCurrentEditingEvent();
  const field = document.getElementById(fieldId);
  const value = field.value.trim();
  const payload = collectFormPayload();
  const validationResult = ClubStorage.validateEventPayload(payload, currentEvent);

  clearFieldError(fieldId);

  if (requiredFields[fieldId] && !value) {
    setFieldError(fieldId, "Vui lòng nhập thông tin này.");
    return;
  }

  if (fieldId === "max") {
    if (validationResult.fieldErrors.max) {
      setFieldError(fieldId, validationResult.fieldErrors.max);
      return;
    }
  }

  if (fieldId === "start" || fieldId === "end") {
    clearFieldError("start");
    clearFieldError("end");

    if (validationResult.fieldErrors.start) {
      setFieldError("start", validationResult.fieldErrors.start);
    }

    if (validationResult.fieldErrors.end) {
      setFieldError("end", validationResult.fieldErrors.end);
    }
  }
}

function resetForm() {
  form.reset();
  document.getElementById("eventId").value = "";
  document.getElementById("btnDeleteDetail").style.display = "none";
  clearFieldErrors();
  syncDateInputConstraints();
}

function hideDetailPanel() {
  selectedDetailEventId = null;
  detailSection.style.display = "none";
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
  document.getElementById("detailTime").innerText = ClubStorage.formatDateRange(
    event.start,
    event.end,
  );
  document.getElementById("detailLocation").innerText = event.location;
  document.getElementById("detailCapacity").innerText = `${event.registered}/${event.max}`;
}

function setEditingEvent(event) {
  document.getElementById("eventId").value = event.id;
  document.getElementById("name").value = event.name;
  document.getElementById("description").value = event.desc;
  document.getElementById("speaker").value = event.speaker;
  startInput.value = event.start;
  endInput.value = event.end;
  document.getElementById("location").value = event.location;
  maxInput.value = event.max;
  document.getElementById("btnDeleteDetail").style.display = "block";
  syncDateInputConstraints();
}

function updateSummary() {
  const openEvents = events.filter((event) => {
    return ClubStorage.getEventStatus(event).canRegister;
  }).length;

  document.getElementById("totalEvents").innerText = events.length;
  document.getElementById("openEvents").innerText = openEvents;
  document.getElementById("totalRegistrations").innerText = registrations.length;
}

function renderEvents() {
  updateSummary();

  if (events.length === 0) {
    hideDetailPanel();
    list.innerHTML = `
      <tr>
        <td colspan="7">Chưa có sự kiện nào. Hãy tạo sự kiện đầu tiên.</td>
      </tr>
    `;
    fillRegistrationFilter();
    renderRegistrations();
    return;
  }

  list.innerHTML = events
    .map((event) => {
      const status = ClubStorage.getEventStatus(event);
      const rowClass =
        recentlySavedEventId === event.id ? "row-just-saved" : "";
      return `
        <tr class="${rowClass}" data-event-id="${escapeHtml(event.id)}">
          <td>${escapeHtml(event.code)}</td>
          <td>${escapeHtml(event.name)}</td>
          <td>${escapeHtml(
            ClubStorage.formatDateRange(event.start, event.end),
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
            <button class="edit-btn" onclick="editEvent('${event.id}')">Sửa</button>
            <button class="delete-btn" onclick="deleteEvent('${event.id}')">Xóa sự kiện</button>
          </td>
        </tr>
      `;
    })
    .join("");

  fillRegistrationFilter();
  renderRegistrations();

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
  }
}

function fillRegistrationFilter() {
  const selectedValue = registrationFilter.value;
  const options = [
    `<option value="">Tất cả sự kiện</option>`,
    ...events.map((event) => {
      return `<option value="${escapeHtml(event.id)}">${escapeHtml(
        `${event.code} - ${event.name}`,
      )}</option>`;
    }),
  ];

  registrationFilter.innerHTML = options.join("");

  if (events.some((event) => event.id === selectedValue)) {
    registrationFilter.value = selectedValue;
  }
}

function renderRegistrations() {
  const selectedEventId = registrationFilter.value;
  const filteredRegistrations = selectedEventId
    ? registrations.filter((registration) => registration.eventId === selectedEventId)
    : registrations;

  if (filteredRegistrations.length === 0) {
    registrationList.innerHTML = `
      <tr>
        <td colspan="7">Chưa có dữ liệu đăng ký phù hợp với bộ lọc hiện tại.</td>
      </tr>
    `;
    return;
  }

  registrationList.innerHTML = filteredRegistrations
    .map((registration) => {
      return `
        <tr>
          <td>${escapeHtml(registration.eventCode || "-")}</td>
          <td>${escapeHtml(registration.eventName)}</td>
          <td>${escapeHtml(registration.studentName || "-")}</td>
          <td>${escapeHtml(registration.studentId || "-")}</td>
          <td>${escapeHtml(registration.studentCourse || "-")}</td>
          <td>${escapeHtml(registration.studentGender || "-")}</td>
          <td>${escapeHtml(ClubStorage.formatDateTime(registration.registeredAt))}</td>
        </tr>
      `;
    })
    .join("");
}

function validateEventPayload(payload, currentEvent) {
  return ClubStorage.validateEventPayload(payload, currentEvent);
}

form.addEventListener("submit", function (event) {
  event.preventDefault();
  resetMessages();
  clearFieldErrors();
  loadState();

  syncDateInputConstraints();
  const eventId = document.getElementById("eventId").value;
  const payload = collectFormPayload();
  const currentEvent = getCurrentEditingEvent();
  const validationResult = validateEventPayload(payload, currentEvent);

  if (validationResult.message) {
    Object.entries(validationResult.fieldErrors).forEach(([fieldId, message]) => {
      setFieldError(fieldId, message);
    });
    errorBox.innerText = validationResult.message;
    return;
  }

  try {
    if (eventId) {
      const result = ClubStorage.updateEvent(eventId, payload);
      recentlySavedEventId = result.event.id;
      showToast("Cập nhật thành công");
      successBox.innerText = "Cập nhật thành công.";
      renderDetailPanel(result.event.id);
      resetForm();
    } else {
      const result = ClubStorage.createEvent(payload);
      recentlySavedEventId = result.event.id;
      showToast("Tạo sự kiện thành công");
      resetForm();
      successBox.innerText = "Tạo sự kiện thành công.";
    }

    loadState();
    renderEvents();
  } catch (error) {
    Object.entries(error.fieldErrors || {}).forEach(([fieldId, message]) => {
      setFieldError(fieldId, message);
    });
    errorBox.innerText = error.message;
  }
});

function editEvent(eventId) {
  loadState();
  resetMessages();
  const event = events.find((item) => item.id === eventId);

  if (!event) {
    showToast("Không tìm thấy sự kiện cần chỉnh sửa");
    return;
  }

  setEditingEvent(event);
  registrationFilter.value = eventId;
  renderRegistrations();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function viewEventDetail(eventId) {
  loadState();
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

function confirmDelete() {
  if (!deleteEventId) {
    return;
  }

  try {
    ClubStorage.deleteEvent(deleteEventId);
    loadState();
    renderEvents();

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

document.getElementById("btnReset").addEventListener("click", function () {
  resetForm();
  resetMessages();
});

document
  .getElementById("btnEditFromDetail")
  .addEventListener("click", function () {
    if (selectedDetailEventId) {
      editEvent(selectedDetailEventId);
    }
  });

document
  .getElementById("btnDeleteFromPanel")
  .addEventListener("click", function () {
    if (selectedDetailEventId) {
      deleteEvent(selectedDetailEventId);
    }
  });

Object.keys(requiredFields).forEach((fieldId) => {
  const field = document.getElementById(fieldId);
  const syncValidation = function () {
    syncInlineValidation(fieldId);

    const hasInlineErrors = Object.values(fieldErrorElements).some((element) => {
      return element.innerText.trim() !== "";
    });

    if (!hasInlineErrors) {
      errorBox.innerText = "";
    }
  };

  field.addEventListener("input", syncValidation);
  field.addEventListener("change", syncValidation);
});

document.getElementById("confirmDelete").onclick = confirmDelete;

document.getElementById("cancelDelete").onclick = function () {
  document.getElementById("deleteModal").style.display = "none";
  deleteEventId = null;
  deleteMessage.innerText = "Bạn có chắc chắn muốn xóa sự kiện này không?";
};

registrationFilter.addEventListener("change", renderRegistrations);

window.onclick = function (event) {
  const modal = document.getElementById("deleteModal");
  if (event.target === modal) {
    modal.style.display = "none";
    deleteEventId = null;
    deleteMessage.innerText = "Bạn có chắc chắn muốn xóa sự kiện này không?";
  }
};

window.addEventListener("storage", function () {
  loadState();
  renderEvents();
  syncDateInputConstraints();
});

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.innerText = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

loadState();
renderEvents();
syncDateInputConstraints();
