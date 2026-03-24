const { escapeHtml } = window.AppUtils;

function getEventIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

function findEventById(id) {
  if (!window.ClubStorage || !id) {
    return null;
  }

  return window.ClubStorage.getEventById(id);
}

function getCurrentUser() {
  return window.ClubAuth ? window.ClubAuth.getCurrentUser() : null;
}

function isStudentRegisteredForEvent(eventId, studentId) {
  const normalizedEventId = window.ClubStorage.normalizeString(eventId);
  const normalizedStudentId = window.ClubStorage
    .normalizeString(studentId)
    .toLowerCase();

  if (!normalizedEventId || !normalizedStudentId) {
    return false;
  }

  return window.ClubStorage.readState().registrations.some((registration) => {
    return (
      window.ClubStorage.normalizeString(registration.eventId) === normalizedEventId &&
      window.ClubStorage.normalizeString(registration.studentId).toLowerCase() ===
        normalizedStudentId
    );
  });
}

function renderRegisterAction(event, status, currentUser, hasRegistered) {
  const loginIntentUrl = `../auth/login.html?next=student&eventId=${encodeURIComponent(
    event.id,
  )}&action=register`;

  if (hasRegistered) {
    return `
      <a class="register-btn register-btn-secondary" href="../student/index.html?view=history">
        Xem lịch sử đăng ký
      </a>
    `;
  }

  if (currentUser && window.ClubAuth.isAdmin(currentUser)) {
    return `
      <a class="register-btn register-btn-secondary" href="../admin/index.html">
        Vào trang quản trị
      </a>
    `;
  }

  if (!status.canRegister) {
    return `
      <span class="register-btn register-btn-disabled">
        ${escapeHtml(status.text)}
      </span>
    `;
  }

  return `
    <a
      class="register-btn"
      href="${
        currentUser
          ? `../student/index.html?eventId=${encodeURIComponent(event.id)}&action=register`
          : loginIntentUrl
      }"
    >
      ${currentUser ? "Đăng ký tham gia" : "Đăng nhập để đăng ký"}
    </a>
  `;
}

function renderDetail() {
  const container = document.getElementById("detail-container");
  const eventId = getEventIdFromUrl();
  const event = findEventById(eventId);

  if (!event) {
    container.innerHTML = `
      <div class="error-message">
        Không tìm thấy sự kiện.<br />
        <a href="index.html" class="back-link" style="margin-top:15px;">Quay lại danh sách</a>
      </div>
    `;
    return;
  }

  const status = window.ClubStorage.getEventStatus(event);
  const currentUser = getCurrentUser();
  const hasRegistered = currentUser
    ? isStudentRegisteredForEvent(event.id, currentUser.studentId)
    : false;
  const authChip = currentUser
    ? `<span class="auth-chip auth-chip-logged">Đang đăng nhập: ${escapeHtml(
        currentUser.studentName || currentUser.displayName,
      )} - ${escapeHtml(currentUser.roleLabel)}</span>`
    : '<span class="auth-chip auth-chip-guest">Bạn đang xem ở chế độ khách</span>';
  const ctaTitle = currentUser && window.ClubAuth.isAdmin(currentUser)
    ? "Tài khoản hiện tại thuộc quản trị viên"
    : hasRegistered
      ? "Bạn đã có suất tham gia sự kiện này"
      : currentUser
        ? "Sẵn sàng xác nhận đăng ký?"
        : "Đăng nhập để tiếp tục đăng ký";
  const ctaDescription = currentUser && window.ClubAuth.isAdmin(currentUser)
    ? "Tài khoản admin sẽ được dẫn tới trang quản trị. Chỉ tài khoản sinh viên mới có thể đăng ký tham gia sự kiện."
    : hasRegistered
      ? "Hệ thống đã ghi nhận lượt đăng ký của tài khoản hiện tại. Bạn có thể mở phân hệ sinh viên để xem lại lịch sử."
      : currentUser
        ? "Bạn đang đăng nhập bằng tài khoản sinh viên. Nhấn nút bên phải để mở form xác nhận đăng ký."
        : "Bạn vẫn có thể xem thông tin sự kiện trước khi đăng nhập. Khi bấm nút bên phải, hệ thống sẽ chuyển bạn tới trang đăng nhập rồi quay lại đúng luồng đăng ký.";

  container.innerHTML = `
    <table class="detail-table">
      <tr>
        <th>Mã sự kiện</th>
        <td><strong class="event-code-strong">${escapeHtml(event.code)}</strong></td>
      </tr>
      <tr>
        <th>Tên sự kiện</th>
        <td><strong class="event-name-strong">${escapeHtml(event.name)}</strong></td>
      </tr>
      <tr>
        <th>Mô tả</th>
        <td>${escapeHtml(event.desc || "Chưa cập nhật")}</td>
      </tr>
      <tr>
        <th>Diễn giả</th>
        <td><div class="speaker-highlight">${escapeHtml(event.speaker || "Chưa cập nhật")}</div></td>
      </tr>
      <tr>
        <th>Thời gian</th>
        <td>${escapeHtml(window.ClubStorage.formatDateRange(event.start, event.end))}</td>
      </tr>
      <tr>
        <th>Địa điểm</th>
        <td>${escapeHtml(event.location)}</td>
      </tr>
      <tr>
        <th>Số lượng</th>
        <td>${event.registered}/${event.max}</td>
      </tr>
      <tr>
        <th>Trạng thái</th>
        <td>${escapeHtml(status.text)}</td>
      </tr>
    </table>

    <section class="cta-panel">
      <div class="cta-copy">
        ${authChip}
        <strong>${escapeHtml(ctaTitle)}</strong>
        <span>${escapeHtml(ctaDescription)}</span>
      </div>
      <div class="register-section">
        ${renderRegisterAction(event, status, currentUser, hasRegistered)}
      </div>
    </section>

    <div class="detail-backline">
      <a href="index.html" class="back-link">Quay lại danh sách sự kiện</a>
    </div>
  `;
}

window.addEventListener("storage", renderDetail);
window.addEventListener("load", renderDetail);
