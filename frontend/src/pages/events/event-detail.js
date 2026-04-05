import "../../services/auth.js";
import "../../services/storage.js";

const { escapeHtml } = window.AppUtils;

function getEventIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

async function findEventById(id) {
  if (!id) {
    return null;
  }

  return window.ClubStorage.getEventById(id);
}

async function isStudentRegisteredForEvent(eventId, studentId) {
  return window.ClubStorage.hasStudentRegistration(eventId, studentId);
}

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildAvailabilityText(event, status) {
  const max = normalizeNumber(event.max);
  const registered = normalizeNumber(event.registered);
  const remaining = Math.max(0, max - registered);

  if (!max) {
    return "Số lượng tham gia đang được cập nhật thêm bởi ban tổ chức.";
  }

  if (!status.canRegister) {
    return `${status.text}. Hiện đã có ${registered}/${max} lượt đăng ký được ghi nhận.`;
  }

  return remaining > 0
    ? `Hiện còn khoảng ${remaining} suất tham gia trước khi chương trình đạt giới hạn ${max} người.`
    : `Số lượng đăng ký hiện tại là ${registered}/${max}.`;
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

async function renderDetail() {
  const container = document.getElementById("detail-container");
  container.innerHTML = '<div class="detail-layout">Đang tải dữ liệu...</div>';

  try {
    await window.ClubAuth.ready();

    const eventId = getEventIdFromUrl();
    const event = await findEventById(eventId);

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
    const currentUser = window.ClubAuth.getCurrentUser();
    const hasRegistered =
      currentUser && currentUser.studentId
        ? await isStudentRegisteredForEvent(event.id, currentUser.studentId)
        : false;
    const authChip = currentUser
      ? `<span class="auth-chip auth-chip-logged">Đang đăng nhập: ${escapeHtml(
          currentUser.studentName || currentUser.displayName,
        )} - ${escapeHtml(currentUser.roleLabel)}</span>`
      : '<span class="auth-chip auth-chip-guest">Bạn đang xem ở chế độ khách</span>';
    const ctaTitle =
      currentUser && window.ClubAuth.isAdmin(currentUser)
        ? "Tài khoản hiện tại thuộc khu vực điều phối"
        : hasRegistered
          ? "Bạn đã có suất tham gia chương trình này"
          : currentUser
            ? "Sẵn sàng xác nhận đăng ký?"
            : "Đăng nhập để tiếp tục tham gia";
    const ctaDescription =
      currentUser && window.ClubAuth.isAdmin(currentUser)
        ? "Tài khoản admin phù hợp để quản lý chương trình, theo dõi danh sách người tham gia và hỗ trợ điểm danh."
        : hasRegistered
          ? "Hệ thống đã ghi nhận lượt đăng ký của tài khoản hiện tại. Bạn có thể mở phân hệ sinh viên để xem lại lịch sử và trạng thái check-in."
          : currentUser
            ? "Bạn đang đăng nhập bằng tài khoản sinh viên. Nhấn nút bên dưới để chuyển sang bước xác nhận đăng ký với hồ sơ hiện tại."
            : "Bạn có thể xem toàn bộ thông tin công khai trước khi đăng nhập. Khi nhấn đăng ký, hệ thống sẽ giữ lại đúng chương trình bạn đang quan tâm.";

    container.innerHTML = `
      <section class="detail-spotlight">
        <div class="detail-spotlight-copy">
          <div class="detail-status-row">
            <span class="status-badge status-${escapeHtml(status.tone)}">
              ${escapeHtml(status.text)}
            </span>
            ${authChip}
          </div>

          <p class="section-eyebrow">Sự kiện công khai dành cho sinh viên HCMUE</p>
          <h1>${escapeHtml(event.name)}</h1>
          <p class="detail-lead">
            ${escapeHtml(
              event.desc ||
                "Thông tin mô tả chi tiết đang được ban tổ chức cập nhật. Bạn vẫn có thể theo dõi lịch, địa điểm và trạng thái đăng ký của chương trình.",
            )}
          </p>

          <div class="detail-meta-grid">
            <article class="detail-metric-card">
              <span>Thời gian</span>
              <strong>${escapeHtml(
                window.ClubStorage.formatDateRange(event.start, event.end),
              )}</strong>
            </article>
            <article class="detail-metric-card">
              <span>Địa điểm</span>
              <strong>${escapeHtml(event.location || "Chưa cập nhật")}</strong>
            </article>
            <article class="detail-metric-card">
              <span>Trạng thái tham gia</span>
              <strong>${escapeHtml(buildAvailabilityText(event, status))}</strong>
            </article>
            <article class="detail-metric-card">
              <span>Đăng ký hiện tại</span>
              <strong>${escapeHtml(event.registered || 0)}/${escapeHtml(event.max || 0)} người</strong>
            </article>
          </div>
        </div>

        <aside class="detail-side-card">
          <span class="detail-code-label">Mã sự kiện</span>
          <strong class="event-code-strong">${escapeHtml(event.code)}</strong>

          <div class="detail-side-list">
            <div>
              <span>Diễn giả / phụ trách</span>
              <strong>${escapeHtml(event.speaker || "Đang cập nhật")}</strong>
            </div>
            <div>
              <span>Địa điểm tổ chức</span>
              <strong>${escapeHtml(event.location || "Chưa cập nhật")}</strong>
            </div>
            <div>
              <span>Hình thức tham gia</span>
              <strong>Đăng ký trực tuyến, check-in bằng QR cá nhân trong khu vực sinh viên.</strong>
            </div>
          </div>
        </aside>
      </section>

      <section class="detail-content-grid">
        <article class="detail-content-card">
          <p class="section-eyebrow">Nội dung chương trình</p>
          <h2>Tổng quan sự kiện</h2>
          <p class="detail-paragraph">
            ${escapeHtml(
              event.desc ||
                "Sự kiện được công bố trên cổng thông tin để sinh viên dễ dàng theo dõi, lựa chọn chương trình phù hợp và chuyển tiếp sang bước đăng ký khi cần.",
            )}
          </p>

          <div class="detail-feature-grid">
            <article class="detail-feature-card">
              <span>Thông tin học thuật</span>
              <strong>${escapeHtml(event.speaker || "Ban tổ chức sẽ cập nhật diễn giả")}</strong>
              <p>Phần nội dung trọng tâm được giới thiệu rõ ràng để người tham gia cân nhắc trước khi đăng ký.</p>
            </article>
            <article class="detail-feature-card">
              <span>Thời điểm phù hợp</span>
              <strong>${escapeHtml(
                window.ClubStorage.formatDateRange(event.start, event.end),
              )}</strong>
              <p>Thời gian được đồng bộ trực tiếp trên hệ thống để bạn chủ động sắp xếp lịch học và lịch cá nhân.</p>
            </article>
            <article class="detail-feature-card">
              <span>Trải nghiệm tham gia</span>
              <strong>Đăng ký, nhận QR và theo dõi lịch sử</strong>
              <p>Toàn bộ hành trình tham dự được gói lại trong một luồng thống nhất dành cho sinh viên.</p>
            </article>
          </div>
        </article>

        <aside class="detail-side-stack">
          <section class="cta-panel">
            <div class="cta-copy">
              <strong>${escapeHtml(ctaTitle)}</strong>
              <span>${escapeHtml(ctaDescription)}</span>
            </div>
            <div class="register-section">
              ${renderRegisterAction(event, status, currentUser, hasRegistered)}
            </div>
          </section>

          <section class="detail-support-card">
            <p class="section-eyebrow">Chuẩn bị trước khi tham gia</p>
            <h2>Những gì bạn nên làm trước giờ diễn ra</h2>
            <ol class="detail-steps">
              <li>
                <strong>Kiểm tra thời gian và địa điểm</strong>
                <span>Đảm bảo bạn nắm được khung giờ bắt đầu để có mặt đúng lúc và không bỏ lỡ nội dung chính.</span>
              </li>
              <li>
                <strong>Đăng nhập để giữ suất tham gia</strong>
                <span>Nếu chương trình còn mở, hãy dùng tài khoản sinh viên để xác nhận tham gia và lưu lại trên hồ sơ cá nhân.</span>
              </li>
              <li>
                <strong>Mở QR trong ngày diễn ra</strong>
                <span>Sau khi đăng ký, bạn có thể truy cập khu vực sinh viên để lấy QR check-in nhanh tại điểm tiếp đón.</span>
              </li>
            </ol>
          </section>
        </aside>
      </section>

      <div class="detail-backline">
        <a href="index.html" class="back-link">Quay lại danh sách sự kiện</a>
      </div>
    `;
  } catch (error) {
    container.innerHTML = `
      <div class="error-message">
        ${escapeHtml(error?.message || "Không thể tải chi tiết sự kiện lúc này.")}
      </div>
    `;
  }
}

window.addEventListener("focus", function handleFocus() {
  renderDetail().catch(console.error);
});

window.ClubAuth.subscribe(function handleAuthChange() {
  renderDetail().catch(console.error);
});

renderDetail().catch(console.error);
