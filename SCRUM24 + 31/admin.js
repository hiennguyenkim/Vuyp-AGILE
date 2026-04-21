let events = [];
let registrations = [];
let deleteEventId = null;
let recentlySavedEventId = null;
let selectedDetailEventId = null;
let currentUser = null;
let cameraStream = null;

const form = document.getElementById("eventForm");
const list = document.getElementById("eventList");
const registrationList = document.getElementById("registrationList");
const registrationFilter = document.getElementById("registrationFilter");
const deleteMessage = document.getElementById("deleteMessage");
const errorBox = document.getElementById("error");
const successBox = document.getElementById("success");
const detailSection = document.getElementById("eventDetailSection");
const adminName = document.getElementById("adminName");
const adminRole = document.getElementById("adminRole");
const homeBtn = document.getElementById("homeBtn");
const logoutBtn = document.getElementById("logoutBtn");
const manualStudentIdInput = document.getElementById("manualStudentId");
const btnManualCheckin = document.getElementById("btnManualCheckin");
const checkinMessage = document.getElementById("checkinMessage");
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
  registrations = ClubStorage.sortRegistrations(state.registrations);
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
  document.getElementById("detailCapacity").innerText =
    `${event.registered}/${event.max}`;
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
  document.getElementById("totalRegistrations").innerText =
    registrations.length;
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
    ? registrations.filter(
        (registration) => registration.eventId === selectedEventId,
      )
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
    Object.entries(validationResult.fieldErrors).forEach(
      ([fieldId, message]) => {
        setFieldError(fieldId, message);
      },
    );
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

    const hasInlineErrors = Object.values(fieldErrorElements).some(
      (element) => {
        return element.innerText.trim() !== "";
      },
    );

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
  const deleteModal = document.getElementById("deleteModal");
  const cameraModal = document.getElementById("cameraModal");
  if (event.target === deleteModal) {
    deleteModal.style.display = "none";
    deleteEventId = null;
    deleteMessage.innerText = "Bạn có chắc chắn muốn xóa sự kiện này không?";
  }
  if (event.target === cameraModal) {
    closeCameraModal();
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

document.addEventListener("DOMContentLoaded", () => {
  const btnOpenCamera = document.getElementById("btn-open-camera");
  const btnCloseCamera = document.getElementById("btn-close-camera");
  const videoElement = document.getElementById("camera-preview");

  let cameraStream = null;

  btnOpenCamera.addEventListener("click", async () => {
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
        },
      });

      videoElement.srcObject = cameraStream;

      videoElement.style.display = "block";
      btnOpenCamera.style.display = "none";
      btnCloseCamera.style.display = "inline-block";
    } catch (error) {
      console.error("Lỗi khi truy cập camera:", error);
      alert(
        "Không thể mở camera. Vui lòng kiểm tra quyền truy cập của trình duyệt!",
      );
    }
  });

  btnCloseCamera.addEventListener("click", () => {
    if (cameraStream) {
      const tracks = cameraStream.getTracks();
      tracks.forEach((track) => track.stop());
    }
    videoElement.srcObject = null;
    videoElement.style.display = "none";
    btnCloseCamera.style.display = "none";
    btnOpenCamera.style.display = "inline-block";
  });
});

/* ============================================================
   LƯU CHECK-IN VÀ ĐỒNG BỘ VỚI HỆ THỐNG REGISTRATIONS
============================================================ */
function saveCheckIn(mssv) {
  // Lấy sự kiện đang quét
  const eventId = localStorage.getItem("currentEventId");
  if (!eventId) {
    console.warn("Không tìm thấy eventId để ghi check-in.");
    return;
  }

  // Đọc dữ liệu hệ thống
  const state = ClubStorage.readState();

  const event = state.events.find((e) => e.id === eventId);
  if (!event) {
    console.warn("Không tìm thấy sự kiện.");
    return;
  }

  // Xem có đăng ký trước chưa
  const existed = state.registrations.find((r) => {
    return r.eventId === eventId && r.studentId === mssv;
  });

  if (existed) {
    existed.checkedIn = true;
    existed.checkedInAt = new Date().toISOString();
  } else {
    // Tạo bản ghi check-in mới
    state.registrations.push({
      id: crypto.randomUUID(),
      eventId: eventId,
      eventName: event.name,
      eventCode: event.code,
      studentId: mssv,
      studentName: "",
      studentGender: "",
      studentCourse: "",
      registeredAt: new Date().toISOString(),
      checkedIn: true,
      checkedInAt: new Date().toISOString(),
    });

    // Tăng số người đã check in (nếu bạn muốn)
    event.registered = Number(event.registered || 0) + 1;
  }

  ClubStorage.writeState(state);
  console.log("✔ CHECK-IN THÀNH CÔNG:", mssv);

  loadState();
  renderRegistrations();
}

async function startCamera() {
  const videoElement = document.getElementById("camera-preview");
  const errorBox = document.getElementById("camera-error");
  errorBox.style.display = "none";

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
    });
    videoElement.srcObject = cameraStream;
  } catch (error) {
    console.error("Lỗi khi truy cập camera:", error);
    errorBox.innerText =
      "Không thể mở camera. Vui lòng kiểm tra quyền truy cập của trình duyệt!";
    errorBox.style.display = "block";
  }
}

function stopCamera() {
  const videoElement = document.getElementById("camera-preview");
  if (cameraStream) {
    const tracks = cameraStream.getTracks();
    tracks.forEach((track) => track.stop());
    cameraStream = null;
  }
  if (videoElement) {
    videoElement.srcObject = null;
  }
}

function openCameraModal() {
  document.getElementById("cameraModal").style.display = "flex";
  startCamera();
}

const html5Qr = new Html5Qrcode("camera-preview");

html5Qr.start(
  { facingMode: "environment" },
  { fps: 10, qrbox: 250 },
  (decodedText) => {
    console.log("Đã quét:", decodedText);
    const mssv = decodedText.trim();

    if (mssv.length >= 7) {
      saveCheckIn(mssv);
      showToast("✔ Check-in thành công");
    } else {
      showToast("❌ QR không hợp lệ");
    }
  },
  (error) => {},
);

function closeCameraModal() {
  document.getElementById("cameraModal").style.display = "none";
  stopCamera();
}

function handleManualCheckin() {
  if (!loadState()) return;

  const studentId = manualStudentIdInput.value.trim();
  checkinMessage.innerText = "";

  if (!studentId) {
    checkinMessage.innerText = "Vui lòng nhập MSSV.";
    checkinMessage.style.color = "red";
    return;
  }

  const selectedEventId = registrationFilter.value;

  const registration = registrations.find((r) => {
    return (
      r.studentId === studentId &&
      (!selectedEventId || r.eventId === selectedEventId)
    );
  });

  if (!registration) {
    checkinMessage.innerText = "❌ MSSV không tồn tại hoặc chưa đăng ký.";
    checkinMessage.style.color = "red";
    return;
  }

  if (registration.checkedIn) {
    checkinMessage.innerText = "⚠️ Sinh viên đã check-in trước đó.";
    checkinMessage.style.color = "orange";
    return;
  }

  registration.checkedIn = true;
  registration.checkedInAt = new Date().toISOString();

  ClubStorage.saveState({
    events,
    registrations,
  });

  checkinMessage.innerText = `✅ Check-in thành công: ${registration.studentName}`;
  checkinMessage.style.color = "green";

  renderRegistrations();
}

function loadFeedback(eventId) {
  const feedbacks = JSON.parse(localStorage.getItem("feedbacks")) || [];

  const eventFeedback = feedbacks
    .filter((f) => String(f.eventId) === String(eventId))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const tbody = document.getElementById("feedbackList");

  tbody.innerHTML = "";

  if (eventFeedback.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3">Chưa có đánh giá</td></tr>`;
    return;
  }

  eventFeedback.forEach((f) => {
    const row = `
      <tr>
        <td>${"⭐".repeat(f.rating)}</td>
        <td>${f.comment || ""}</td>
        <td>${new Date(f.createdAt).toLocaleString()}</td>
      </tr>
    `;

    tbody.innerHTML += row;
  });
}

document.getElementById("btnViewFeedback").onclick = () => {
  if (!selectedDetailEvent) return;

  loadFeedback(selectedDetailEvent.id);

  document.getElementById("feedbackSection").style.display = "block";
};

function submitFeedback(eventId, rating, comment) {
  let feedbacks = JSON.parse(localStorage.getItem("feedbacks")) || [];

  feedbacks.push({
    eventId,
    rating,
    comment,
    createdAt: new Date().toISOString(),
  });

  localStorage.setItem("feedbacks", JSON.stringify(feedbacks));
}

if (btnManualCheckin) {
  btnManualCheckin.addEventListener("click", handleManualCheckin);
}
