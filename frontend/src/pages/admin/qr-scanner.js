/**
 * qr-scanner.js  –  Admin QR Check-in cho sự kiện
 * Dùng jsQR để decode từ camera, kết nối Supabase để check-in
 */

import "../../services/auth.js";
import "../../services/storage.js";
import {
  CLUB_SUPABASE_CONFIG,
  getSupabaseConfigError,
  supabase,
  waitForSupabase,
} from "../../services/supabase-config.js";

// ── DOM refs ──────────────────────────────────────────────────
const backBtn           = document.getElementById("backBtn");
const adminBadge        = document.getElementById("adminBadge");
const eventSelect       = document.getElementById("eventSelect");
const eventInfo         = document.getElementById("eventInfo");
const eventInfoText     = document.getElementById("eventInfoText");
const startCameraBtn    = document.getElementById("startCameraBtn");
const stopCameraBtn     = document.getElementById("stopCameraBtn");
const switchCameraBtn   = document.getElementById("switchCameraBtn");
const qrVideo           = document.getElementById("qrVideo");
const qrCanvas          = document.getElementById("qrCanvas");
const cameraPlaceholder = document.getElementById("cameraPlaceholder");
const manualStudentId   = document.getElementById("manualStudentId");
const manualCheckInBtn  = document.getElementById("manualCheckInBtn");
const resultCard        = document.getElementById("resultCard");
const resultIcon        = document.getElementById("resultIcon");
const resultTitle       = document.getElementById("resultTitle");
const resultMessage     = document.getElementById("resultMessage");
const studentInfoCard   = document.getElementById("studentInfoCard");
const resultStudentName = document.getElementById("resultStudentName");
const resultStudentId   = document.getElementById("resultStudentId");
const resultCourse      = document.getElementById("resultCourse");
const resultGender      = document.getElementById("resultGender");
const resultEventName   = document.getElementById("resultEventName");
const resultStatus      = document.getElementById("resultStatus");
const confirmCheckInBtn = document.getElementById("confirmCheckInBtn");
const statTotal         = document.getElementById("statTotal");
const statChecked       = document.getElementById("statChecked");
const statPending       = document.getElementById("statPending");
const checkinLog        = document.getElementById("checkinLog");
const toast             = document.getElementById("toast");

// ── State ─────────────────────────────────────────────────────
let mediaStream     = null;
let scanInterval    = null;
let facingMode      = "environment";  // rear camera by default
let selectedEventId = "";
let lastScannedId   = "";
let scanCooldown    = false;          // prevent repeat scans
let pendingCheckIn  = null;           // { registration, studentId, name }
let events          = [];
const SCAN_INTERVAL_MS = 180;
const MAX_SCAN_DIMENSION = 960;
const CENTER_SCAN_RATIO = 0.7;

// ── Toast helper ──────────────────────────────────────────────
function showToast(message, type = "info") {
  toast.textContent = message;
  toast.className = `toast show toast-${type}`;
  setTimeout(() => { toast.className = "toast"; }, 3000);
}

const eventColumns = {
  id: CLUB_SUPABASE_CONFIG.event.idColumn,
  max: CLUB_SUPABASE_CONFIG.event.maxColumn,
  name: CLUB_SUPABASE_CONFIG.event.nameColumn,
  registered: CLUB_SUPABASE_CONFIG.event.registeredColumn,
  start: CLUB_SUPABASE_CONFIG.event.startColumn,
  location: CLUB_SUPABASE_CONFIG.event.locationColumn,
};

const registrationColumns = {
  checkedIn: "checked_in",
  checkedInAt: "checked_in_at",
  checkedInBy: "checked_in_by",
  eventId: CLUB_SUPABASE_CONFIG.registration.eventIdColumn,
  id: CLUB_SUPABASE_CONFIG.registration.idColumn,
  status: CLUB_SUPABASE_CONFIG.registration.statusColumn,
  studentCourse: CLUB_SUPABASE_CONFIG.registration.studentCourseColumn,
  studentGender: CLUB_SUPABASE_CONFIG.registration.studentGenderColumn,
  studentId: CLUB_SUPABASE_CONFIG.registration.studentIdColumn,
  studentName: CLUB_SUPABASE_CONFIG.registration.studentNameColumn,
};

async function ensureSupabaseClient() {
  const configError = getSupabaseConfigError();

  if (configError) {
    throw new Error(configError);
  }

  await waitForSupabase();

  if (!supabase) {
    throw new Error(configError || "Không thể khởi tạo Supabase.");
  }

  return supabase;
}

function readRegistrationValue(registration, columnName, fallback = "") {
  const value = registration?.[columnName];
  return value === undefined || value === null ? fallback : value;
}

function extractStudentId(rawValue) {
  const normalizedValue = String(rawValue ?? "").trim();

  if (!normalizedValue) {
    return "";
  }

  try {
    const parsedValue = JSON.parse(normalizedValue);
    return String(
      parsedValue.studentId ||
        parsedValue.student_id ||
        parsedValue.mssv ||
        parsedValue.code ||
        parsedValue.id ||
        normalizedValue,
    ).trim();
  } catch (_error) {
    return normalizedValue;
  }
}

// ── Load events into select ───────────────────────────────────
async function loadEvents() {
  try {
    events = await window.ClubStorage.getEvents();
  } catch (e) {
    events = [];
  }

  eventSelect.innerHTML = `<option value="">-- Chọn sự kiện --</option>` +
    events.map(ev => `<option value="${ev.id}">${ev.code} · ${ev.name}</option>`).join("");
}

function normalizeEvent(row) {
  return {
    id:   row[eventColumns.id],
    code: row.code || "",
    name: row[eventColumns.name] || "",
    start: row[eventColumns.start] || "",
    location: row[eventColumns.location] || "",
    max: row[eventColumns.max] || 0,
    registered: row[eventColumns.registered] || 0,
  };
}

eventSelect.addEventListener("change", async () => {
  selectedEventId = eventSelect.value;
  lastScannedId = "";
  pendingCheckIn = null;

  if (!selectedEventId) {
    eventInfo.hidden = true;
    resetResult();
    updateStats(0, 0);
    return;
  }

  const ev = events.find(e => e.id === selectedEventId);
  if (ev) {
    eventInfoText.textContent =
      `${ev.name} · ${window.ClubStorage.formatDateRange(ev.start, ev.end)} · ` +
      `${ev.location} · ${ev.registered}/${ev.max} đã đăng ký`;
    eventInfo.hidden = false;
  }

  await refreshStats();
  resetResult();
});

// ── Stats ─────────────────────────────────────────────────────
async function refreshStats() {
  if (!selectedEventId) { updateStats(0, 0); return; }

  try {
    const sb = await ensureSupabaseClient();
    const { data } = await sb
      .from(CLUB_SUPABASE_CONFIG.tables.registrations)
      .select(`${registrationColumns.id}, ${registrationColumns.checkedIn}`)
      .eq(registrationColumns.eventId, selectedEventId);

    const total   = (data || []).length;
    const checked = (data || []).filter(
      (registration) => Boolean(readRegistrationValue(registration, registrationColumns.checkedIn)),
    ).length;
    updateStats(total, checked);
  } catch (e) { /* ignore */ }
}

function updateStats(total, checked) {
  statTotal.textContent   = total;
  statChecked.textContent = checked;
  statPending.textContent = Math.max(0, total - checked);
}

function getScanContext() {
  return qrCanvas.getContext("2d", { willReadFrequently: true });
}

function decodeQrFrame(imageData, width, height) {
  if (typeof window.jsQR !== "function") {
    return null;
  }

  return window.jsQR(imageData.data, width, height, {
    inversionAttempts: "attemptBoth",
  });
}

function waitForVideoReady(videoElement) {
  if (videoElement.readyState >= 2 && videoElement.videoWidth) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    let resolved = false;

    const cleanup = () => {
      clearTimeout(timeoutId);
      videoElement.removeEventListener("loadedmetadata", handleReady);
      videoElement.removeEventListener("loadeddata", handleReady);
      videoElement.removeEventListener("canplay", handleReady);
      videoElement.removeEventListener("playing", handleReady);
      videoElement.removeEventListener("error", handleError);
    };

    const finalize = (callback) => {
      if (resolved) {
        return;
      }

      resolved = true;
      cleanup();
      callback();
    };

    const handleReady = () => {
      if (videoElement.readyState >= 2 && videoElement.videoWidth) {
        finalize(resolve);
      }
    };

    const handleError = () => {
      finalize(() => reject(new Error("Camera đã bật nhưng không nhận được khung hình để quét QR.")));
    };

    const timeoutId = window.setTimeout(() => {
      if (videoElement.readyState >= 2 && videoElement.videoWidth) {
        finalize(resolve);
        return;
      }

      finalize(() => reject(new Error("Camera khởi tạo quá chậm. Vui lòng thử bật lại camera.")));
    }, 5000);

    videoElement.addEventListener("loadedmetadata", handleReady);
    videoElement.addEventListener("loadeddata", handleReady);
    videoElement.addEventListener("canplay", handleReady);
    videoElement.addEventListener("playing", handleReady);
    videoElement.addEventListener("error", handleError);
  });
}

// ── Camera ────────────────────────────────────────────────────
async function startCamera() {
  if (mediaStream) stopCamera();

  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Trình duyệt hiện tại không hỗ trợ truy cập camera.");
    }

    if (typeof window.jsQR !== "function") {
      throw new Error("Không tải được thư viện quét QR. Vui lòng kiểm tra mạng rồi tải lại trang.");
    }

    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    qrVideo.srcObject = mediaStream;
    qrVideo.setAttribute("playsinline", "true");
    cameraPlaceholder.style.display = "none";
    startCameraBtn.disabled = true;
    stopCameraBtn.disabled  = false;
    switchCameraBtn.disabled = false;

    try {
      await qrVideo.play();
    } catch (_error) {
      // Một số trình duyệt chỉ cho phát sau khi metadata sẵn sàng.
    }

    await waitForVideoReady(qrVideo);

    if (qrVideo.paused) {
      await qrVideo.play();
    }

    beginScanning();
    setResult("idle", "🎯", "Camera đã sẵn sàng", "Đưa mã QR vào giữa khung để bắt đầu quét.");
  } catch (err) {
    setResult("error", "❌", "Không thể bật camera", err?.message || "Vui lòng thử lại.");
    showToast("Không thể bật camera hoặc quét QR: " + err.message, "error");
    stopCamera();
  }
}

function stopCamera() {
  if (scanInterval) { clearInterval(scanInterval); scanInterval = null; }
  if (mediaStream)  { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null; }
  qrVideo.pause();
  qrVideo.srcObject = null;
  cameraPlaceholder.style.display = "flex";
  startCameraBtn.disabled = false;
  stopCameraBtn.disabled  = true;
  switchCameraBtn.disabled = true;
}

function beginScanning() {
  if (scanInterval) clearInterval(scanInterval);
  scanInterval = setInterval(scanFrame, SCAN_INTERVAL_MS);
}

function scanFrame() {
  if (!qrVideo.videoWidth || qrVideo.readyState < 2) return;

  const { videoWidth: w, videoHeight: h } = qrVideo;
  const scale = Math.min(1, MAX_SCAN_DIMENSION / Math.max(w, h));
  const frameWidth = Math.max(1, Math.round(w * scale));
  const frameHeight = Math.max(1, Math.round(h * scale));
  qrCanvas.width  = frameWidth;
  qrCanvas.height = frameHeight;

  const ctx = getScanContext();
  if (!ctx) {
    return;
  }

  ctx.drawImage(qrVideo, 0, 0, frameWidth, frameHeight);
  const fullFrame = ctx.getImageData(0, 0, frameWidth, frameHeight);
  let code = decodeQrFrame(fullFrame, frameWidth, frameHeight);

  if (!code) {
    const cropSize = Math.floor(Math.min(frameWidth, frameHeight) * CENTER_SCAN_RATIO);
    const cropX = Math.max(0, Math.floor((frameWidth - cropSize) / 2));
    const cropY = Math.max(0, Math.floor((frameHeight - cropSize) / 2));

    if (cropSize > 0) {
      const centerFrame = ctx.getImageData(cropX, cropY, cropSize, cropSize);
      code = decodeQrFrame(centerFrame, cropSize, cropSize);
    }
  }

  if (code?.data) {
    const raw = code.data.trim();
    if (raw && !scanCooldown) {
      onQrDetected(raw);
    }
  }
}

// ── QR detected ───────────────────────────────────────────────
async function onQrDetected(rawData) {
  scanCooldown = true;
  setTimeout(() => { scanCooldown = false; }, 2500);

  const studentId = extractStudentId(rawData);
  if (!studentId || studentId === lastScannedId) return;
  lastScannedId = studentId;

  await processCheckIn(studentId);
}

// ── Manual check-in ───────────────────────────────────────────
manualCheckInBtn.addEventListener("click", async () => {
  const id = extractStudentId(manualStudentId.value);
  if (!id) { showToast("Vui lòng nhập MSSV.", "warn"); return; }
  await processCheckIn(id);
  manualStudentId.value = "";
});

manualStudentId.addEventListener("keydown", (e) => {
  if (e.key === "Enter") manualCheckInBtn.click();
});

// ── Core check-in logic ───────────────────────────────────────
async function processCheckIn(studentId) {
  if (!selectedEventId) {
    setResult("warn", "⚠️", "Chưa chọn sự kiện", "Hãy chọn sự kiện cần điểm danh trước khi quét.");
    return;
  }

  setResult("idle", "⏳", "Đang kiểm tra...", `MSSV: ${studentId}`);
  studentInfoCard.hidden = true;
  confirmCheckInBtn.hidden = true;

  try {
    const sb = await ensureSupabaseClient();

    // 1. Tìm registration
    const { data: regs, error: regErr } = await sb
      .from(CLUB_SUPABASE_CONFIG.tables.registrations)
      .select("*")
      .eq(registrationColumns.eventId, selectedEventId)
      .eq(registrationColumns.studentId, studentId)
      .limit(1);

    if (regErr) throw regErr;

    const eventObj = events.find(e => e.id === selectedEventId);
    const eventName = eventObj?.name || "Sự kiện";

    if (!regs || regs.length === 0) {
      // Sinh viên chưa đăng ký sự kiện này
      setResult("error", "❌", "Chưa đăng ký", `MSSV ${studentId} chưa đăng ký sự kiện "${eventName}".`);
      addLog("error", "❌", studentId, "Chưa đăng ký sự kiện");
      return;
    }

    const reg = regs[0];
    const studentName = readRegistrationValue(reg, registrationColumns.studentName, studentId);
    const checkedInAtValue = readRegistrationValue(reg, registrationColumns.checkedInAt);
    const checkedIn = Boolean(readRegistrationValue(reg, registrationColumns.checkedIn));

    // 2. Hiển thị thông tin sinh viên
    showStudentInfo(reg, eventName);

    if (checkedIn) {
      const checkedAt = checkedInAtValue
        ? new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(new Date(checkedInAtValue))
        : "";
      setResult("warn", "⚠️", "Đã điểm danh rồi", `${studentName} đã được điểm danh lúc ${checkedAt}.`);
      resultStatus.textContent = "Đã điểm danh";
      resultStatus.className = "status-badge status-checked";
      confirmCheckInBtn.hidden = true;
      addLog("already", "⚠️", studentName, `Đã điểm danh lúc ${checkedAt}`);
    } else {
      setResult("success", "✅", "Tìm thấy, xác nhận điểm danh?", `${studentName} · ${eventName}`);
      resultStatus.textContent = "Đã đăng ký, chưa điểm danh";
      resultStatus.className = "status-badge status-registered";
      pendingCheckIn = { reg, studentId, eventName };
      confirmCheckInBtn.disabled = false;
      confirmCheckInBtn.textContent = "✓ Xác nhận điểm danh";
      confirmCheckInBtn.hidden = false;
    }
  } catch (err) {
    setResult("error", "❌", "Lỗi hệ thống", err?.message || "Vui lòng thử lại.");
    console.error(err);
  }
}

// ── Confirm check-in ──────────────────────────────────────────
confirmCheckInBtn.addEventListener("click", async () => {
  if (!pendingCheckIn) return;

  const { reg, studentId, eventName } = pendingCheckIn;
  confirmCheckInBtn.disabled = true;
  confirmCheckInBtn.textContent = "Đang lưu...";

  try {
    const sb = await ensureSupabaseClient();
    const { error } = await sb
      .from(CLUB_SUPABASE_CONFIG.tables.registrations)
      .update({
        [registrationColumns.checkedIn]: true,
        [registrationColumns.checkedInAt]: new Date().toISOString(),
        [registrationColumns.checkedInBy]: window.ClubAuth.getCurrentUser()?.id || null,
        [registrationColumns.status]: "Đã điểm danh",
      })
      .eq(registrationColumns.id, reg[registrationColumns.id]);

    if (error) throw error;

    const name = readRegistrationValue(reg, registrationColumns.studentName, studentId);
    setResult("success", "🎉", "Điểm danh thành công!", `${name} đã được ghi nhận tham dự "${eventName}".`);
    resultStatus.textContent = "✓ Đã điểm danh";
    resultStatus.className = "status-badge status-checked";
    confirmCheckInBtn.disabled = false;
    confirmCheckInBtn.textContent = "✓ Xác nhận điểm danh";
    confirmCheckInBtn.hidden = true;
    pendingCheckIn = null;
    showToast(`✓ Đã điểm danh: ${name}`, "success");
    addLog("success", "✅", name, `Điểm danh lúc ${new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(new Date())}`);
    await refreshStats();
  } catch (err) {
    showToast("Lỗi khi ghi nhận: " + (err?.message || ""), "error");
    confirmCheckInBtn.disabled = false;
    confirmCheckInBtn.textContent = "✓ Xác nhận điểm danh";
  }
});

// ── UI helpers ────────────────────────────────────────────────
function resetResult() {
  setResult("idle", "🎯", "Chờ quét QR", "Hướng camera vào mã QR sinh viên hoặc nhập MSSV thủ công.");
  studentInfoCard.hidden = true;
  confirmCheckInBtn.hidden = true;
  confirmCheckInBtn.disabled = false;
  confirmCheckInBtn.textContent = "✓ Xác nhận điểm danh";
  pendingCheckIn = null;
}

function setResult(type, icon, title, message) {
  resultCard.className = `result-card result-${type}`;
  resultIcon.textContent    = icon;
  resultTitle.textContent   = title;
  resultMessage.textContent = message;
}

function showStudentInfo(reg, eventName) {
  resultStudentName.textContent =
    readRegistrationValue(reg, registrationColumns.studentName) ||
    readRegistrationValue(reg, registrationColumns.studentId) ||
    "--";
  resultStudentId.textContent =
    readRegistrationValue(reg, registrationColumns.studentId) || "--";
  resultCourse.textContent =
    readRegistrationValue(reg, registrationColumns.studentCourse) || "--";
  resultGender.textContent =
    readRegistrationValue(reg, registrationColumns.studentGender) || "--";
  resultEventName.textContent   = eventName;
  studentInfoCard.hidden = false;
}

let logCount = 0;
function addLog(type, icon, name, meta) {
  const empty = checkinLog.querySelector(".log-empty");
  if (empty) empty.remove();

  const now = new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date());
  const item = document.createElement("div");
  item.className = `log-item${type === "already" ? " log-already" : type === "error" ? " log-error" : ""}`;
  item.innerHTML = `
    <span class="log-icon">${icon}</span>
    <div class="log-text">
      <div class="log-name">${escapeHtml(name)}</div>
      <div class="log-meta">${escapeHtml(meta)}</div>
    </div>
    <span class="log-time">${now}</span>
  `;
  checkinLog.prepend(item);
  logCount++;
  // keep max 50 logs
  if (logCount > 50) {
    checkinLog.lastElementChild?.remove();
    logCount = 50;
  }
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Camera buttons ────────────────────────────────────────────
startCameraBtn.addEventListener("click", startCamera);
stopCameraBtn.addEventListener("click", stopCamera);
switchCameraBtn.addEventListener("click", async () => {
  facingMode = facingMode === "environment" ? "user" : "environment";
  if (mediaStream) await startCamera();
});
backBtn.addEventListener("click", () => {
  stopCamera();
  window.location.href = "index.html";
});

// ── Auth guard ────────────────────────────────────────────────
async function init() {
  await window.ClubAuth.ready();
  const user = window.ClubAuth.getCurrentUser();

  if (!user || !window.ClubAuth.isAdmin(user)) {
    alert("Chỉ quản trị viên mới có quyền truy cập trang này.");
    window.location.replace("../auth/login.html");
    return;
  }

  adminBadge.textContent = `👤 ${user.displayName || user.loginId}`;
  await ensureSupabaseClient();
  await loadEvents();
}

init().catch(console.error);
window.addEventListener("beforeunload", stopCamera);
