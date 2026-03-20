function getEventIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function findEventById(id) {
  if (!window.ClubStorage || !id) {
    return null;
  }

  return window.ClubStorage.getEventById(id);
}

function renderDetail() {
  const container = document.getElementById("detail-container");
  const eventId = getEventIdFromUrl();
  const event = findEventById(eventId);

  if (!event) {
    container.innerHTML = `
      <div class="error-message">
        ❌ Không tìm thấy sự kiện.<br>
        <a href="index.html" class="back-link" style="margin-top:15px;">← Quay lại danh sách</a>
      </div>
    `;
    return;
  }

  const status = window.ClubStorage.getEventStatus(event);
  const registerAction = status.canRegister
    ? `
        <a
          class="register-btn"
          href="../student/index.html?eventId=${encodeURIComponent(event.id)}&action=register"
        >
          📝 Đăng ký tham gia
        </a>
      `
    : `
        <span class="register-btn register-btn-disabled">
          ${status.tone === "ended" ? "Sự kiện đã kết thúc" : "Tạm khóa đăng ký"}
        </span>
      `;
  const ctaDescription = status.canRegister
    ? "Nhấn đăng ký để chuyển ngay tới form điền thông tin tham gia."
    : "Sự kiện hiện không nhận thêm đăng ký mới. Bạn vẫn có thể xem lại toàn bộ thông tin bên trên.";

  container.innerHTML = `
    <table class="detail-table">
      <tr>
        <th>Mã sự kiện</th>
        <td><strong style="color:#003366;">${escapeHtml(event.code)}</strong></td>
      </tr>
      <tr>
        <th>Tên sự kiện</th>
        <td><strong style="color:#003366; font-size:20px;">${escapeHtml(event.name)}</strong></td>
      </tr>
      <tr>
        <th>Mô tả</th>
        <td>${escapeHtml(event.desc || "Chưa cập nhật")}</td>
      </tr>
      <tr>
        <th>Diễn giả</th>
        <td><div class="speaker-highlight">🎤 ${escapeHtml(event.speaker || "Chưa cập nhật")}</div></td>
      </tr>
      <tr>
        <th>Thời gian</th>
        <td>⏰ ${escapeHtml(
          window.ClubStorage.formatDateRange(event.start, event.end),
        )}</td>
      </tr>
      <tr>
        <th>Địa điểm</th>
        <td>📍 ${escapeHtml(event.location)}</td>
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
        <strong>Quan tâm sự kiện này?</strong>
        <span>${escapeHtml(ctaDescription)}</span>
      </div>
      <div class="register-section">
        ${registerAction}
      </div>
    </section>

    <div style="text-align: center;">
      <a href="index.html" class="back-link">← Quay lại danh sách sự kiện</a>
    </div>
  `;
}

window.addEventListener("storage", renderDetail);
window.addEventListener("load", renderDetail);
