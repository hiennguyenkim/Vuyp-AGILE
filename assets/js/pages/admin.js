let events = [];
let registrations = [];
let deleteEventId = null;
let recentlySavedEventId = null;
let selectedDetailEventId = null;
let currentUser = null;

const form = document.getElementById("eventForm");
const list = document.getElementById("eventList");
const registrationList = document.getElementById("checkinList");
const registrationFilter = document.getElementById("registrationFilter");
const deleteMessage = document.getElementById("deleteMessage");
const errorBox = document.getElementById("error");
const successBox = document.getElementById("success");
const detailSection = document.getElementById("eventDetailSection");
const adminName = document.getElementById("adminName");
const adminRole = document.getElementById("adminRole");
const homeBtn = document.getElementById("homeBtn");
const logoutBtn = document.getElementById("logoutBtn");
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

function ensureAdminAccess() {
  if (!window.ClubAuth) {
    window.location.replace("../auth/login.html?next=admin");
    return false;
  }

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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function loadState() {
  if (!ensureAdminAccess()) {
    return false;
  }

  const state = ClubStorage.readState();
  events = ClubStorage.sortEvents(state.events);
  registrations =
    ClubStorage.sortRegistrations(
      state.registrations
    );

  // mặc định checkin
  registrations.forEach(r => {

    if (!r.checkinStatus) {

      r.checkinStatus = "Chưa checkin";

    }

  });
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
  if (!loadState()) {
    return;
  }
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
  document.getElementById("start").value = event.start;
  document.getElementById("end").value = event.end;
  document.getElementById("location").value = event.location;
  document.getElementById("max").value = event.max;
  document.getElementById("btnDeleteDetail").style.display = "block";
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
        <td colspan="8">Chưa có dữ liệu đăng ký phù hợp với bộ lọc hiện tại.</td>
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

<td class="${registration.checkinStatus === "Đã checkin"
          ? "status-checked"
          : "status-notchecked"
        }">
${registration.checkinStatus || "Chưa checkin"}
</td>

<td>
${escapeHtml(
          ClubStorage.formatDateTime(
            registration.registeredAt
          )
        )}
</td>
        </tr>
      `;
    })
    .join("");
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

form.addEventListener("submit", function (event) {
  event.preventDefault();
  resetMessages();
  clearFieldErrors();
  if (!loadState()) {
    return;
  }

  const eventId = document.getElementById("eventId").value;
  const payload = {
    name: ClubStorage.normalizeString(document.getElementById("name").value),
    desc: ClubStorage.normalizeString(
      document.getElementById("description").value,
    ),
    speaker: ClubStorage.normalizeString(
      document.getElementById("speaker").value,
    ),
    start: document.getElementById("start").value,
    end: document.getElementById("end").value,
    location: ClubStorage.normalizeString(
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

  if (!loadState()) {
    return;
  }
  renderAdminSession();
  renderEvents();
});

function editEvent(eventId) {
  if (!loadState()) {
    return;
  }
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
  if (!loadState()) {
    return;
  }
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
    if (!loadState()) {
      return;
    }
    renderAdminSession();
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

homeBtn.addEventListener("click", function () {
  window.location.href = "../events/index.html";
});

logoutBtn.addEventListener("click", function () {
  window.ClubAuth.logout();
  window.location.href = "../events/index.html";
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
  document.getElementById(fieldId).addEventListener("input", function () {
    syncInlineValidation(fieldId);

    const hasInlineErrors = Object.values(fieldErrorElements).some((element) => {
      return element.innerText.trim() !== "";
    });

    if (!hasInlineErrors) {
      errorBox.innerText = "";
    }
  });
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
  if (!loadState()) {
    return;
  }
  renderAdminSession();
  renderEvents();
});

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.innerText = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

if (loadState()) {
  renderAdminSession();
  renderEvents();
}


function scanQR() {

  let mssv =
    document
      .getElementById("scanInput")
      .value
      .trim();

  if (!mssv) {

    alert("Nhập MSSV!");

    return;

  }

  handleCheckin(mssv);

  document.getElementById("scanInput").value = "";

}


function handleCheckin(studentId) {

  if (!loadState()) return;

  let student =
    registrations.find(
      s => s.studentId === studentId
    );

  if (!student) {

    alert("Không tìm thấy sinh viên");

    return;

  }

  // LẦN 1
  if (student.checkinStatus !== "Đã checkin") {

    student.checkinStatus = "Đã checkin";

    student.checkinTime =
      new Date().toISOString();

    ClubStorage.writeState({
      events,
      registrations
    });

    renderRegistrations();

    showToast("Check-in thành công");

  }

  // LẦN 2
  else {

    showBigAlert();

  }

}


function showBigAlert() {

  let alertBox =
    document.getElementById("bigAlert");

  alertBox.style.display = "block";

  setTimeout(() => {

    alertBox.style.display = "none";

  }, 3000);

}

