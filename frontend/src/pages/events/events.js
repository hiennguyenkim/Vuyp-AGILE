import "../../services/auth.js";
import "../../services/storage.js";

const { escapeHtml } = window.AppUtils;

const eventList = document.getElementById("event-list");
const totalEventsStat = document.getElementById("totalEventsStat");
const liveEventsStat = document.getElementById("liveEventsStat");
const nextEventStat = document.getElementById("nextEventStat");
const eventFeedMeta = document.getElementById("eventFeedMeta");
const portalSupportNote = document.getElementById("portalSupportNote");
const sidebarActionLink = document.getElementById("sidebarActionLink");
const heroPrimaryAction = document.getElementById("heroPrimaryAction");

function getToneRank(tone) {
  switch (tone) {
    case "live":
      return 0;
    case "open":
      return 1;
    case "full":
      return 2;
    default:
      return 3;
  }
}

function formatCompactMoment(value) {
  if (!value) {
    return "Đang cập nhật";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function updateEventMetrics(eventCards = []) {
  if (totalEventsStat) {
    totalEventsStat.innerText = String(eventCards.length);
  }

  if (liveEventsStat) {
    liveEventsStat.innerText = String(
      eventCards.filter((item) => item.status.tone === "live").length,
    );
  }

  if (nextEventStat) {
    nextEventStat.innerText = eventCards[0]?.event
      ? `${eventCards[0].event.code} • ${formatCompactMoment(eventCards[0].event.start)}`
      : "Chưa có lịch mới";
  }
}

function buildAvailabilitySummary(event, status) {
  const max = Number(event.max) || 0;
  const registered = Number(event.registered) || 0;
  const remaining = Math.max(0, max - registered);

  if (!max) {
    return "Số lượng tham gia đang được cập nhật.";
  }

  if (!status.canRegister) {
    return `${status.text}. Hiện có ${registered}/${max} lượt đăng ký.`;
  }

  return remaining > 0
    ? `Còn khoảng ${remaining} suất trước khi đạt giới hạn ${max} người.`
    : `Hệ thống đang ghi nhận ${registered}/${max} lượt đăng ký.`;
}

function renderEmptyState(message) {
  eventList.innerHTML = `
    <div class="empty-panel">
      ${escapeHtml(message)}
    </div>
  `;
}

function renderHeroPrimaryAction(currentUser) {
  if (!heroPrimaryAction) {
    return;
  }

  if (!currentUser) {
    heroPrimaryAction.href = "../auth/login.html";
    heroPrimaryAction.innerText = "Đăng nhập để đăng ký";
    return;
  }

  if (window.ClubAuth.isAdmin(currentUser)) {
    heroPrimaryAction.href = "../admin/index.html";
    heroPrimaryAction.innerText = "Vào trang quản trị";
    return;
  }

  heroPrimaryAction.href = "../student/index.html";
  heroPrimaryAction.innerText = "Vào trang cá nhân";
}

function renderGuestEntryAction() {
  const entryStatus = document.getElementById("entryStatus");
  const entryActionLink = document.getElementById("entryActionLink");

  if (entryStatus) {
    entryStatus.innerText = "Đang xem công khai";
  }

  if (entryActionLink) {
    entryActionLink.href = "../auth/login.html";
    entryActionLink.innerText = "Đăng nhập";
  }

  renderHeroPrimaryAction(null);
  renderEntryActionNote(null);
}

function renderEntryActionNote(currentUser) {
  if (!portalSupportNote || !sidebarActionLink) {
    return;
  }

  if (!currentUser) {
    portalSupportNote.innerText =
      "Đăng nhập để đăng ký tham gia, lưu lịch sử sự kiện và sử dụng QR cá nhân khi check-in.";
    sidebarActionLink.href = "../auth/login.html";
    sidebarActionLink.innerText = "Đăng nhập hệ thống";
    return;
  }

  if (window.ClubAuth.isAdmin(currentUser)) {
    portalSupportNote.innerText =
      "Tài khoản quản trị phù hợp để tạo sự kiện, theo dõi danh sách đăng ký và điều phối điểm danh.";
    sidebarActionLink.href = "../admin/index.html";
    sidebarActionLink.innerText = "Vào trang quản trị";
    return;
  }

  portalSupportNote.innerText =
    "Tài khoản sinh viên giúp bạn đăng ký, theo dõi sự kiện đã tham gia và mở QR cá nhân ngay trên hệ thống.";
  sidebarActionLink.href = "../student/index.html";
  sidebarActionLink.innerText = "Vào trang cá nhân";
}

function buildRegisterLink(event, status, currentUser) {
  if (!status.canRegister) {
    return "";
  }

  if (!currentUser) {
    return `../auth/login.html?next=student&eventId=${encodeURIComponent(
      event.id,
    )}&action=register`;
  }

  if (window.ClubAuth.isAdmin(currentUser)) {
    return "";
  }

  return `../student/index.html?eventId=${encodeURIComponent(
    event.id,
  )}&action=register`;
}

async function renderEntryAction() {
  const entryStatus = document.getElementById("entryStatus");
  const entryActionLink = document.getElementById("entryActionLink");

  await window.ClubAuth.ready();
  const currentUser = window.ClubAuth.getCurrentUser();

  if (!currentUser) {
    entryStatus.innerText = "Đang xem công khai";
    entryActionLink.href = "../auth/login.html";
    entryActionLink.innerText = "Đăng nhập";
    renderHeroPrimaryAction(null);
    renderEntryActionNote(null);
    return null;
  }

  if (window.ClubAuth.isAdmin(currentUser)) {
    entryStatus.innerText = `${currentUser.displayName} - ${currentUser.roleLabel}`;
    entryActionLink.href = "../admin/index.html";
    entryActionLink.innerText = "Trang quản trị";
    renderHeroPrimaryAction(currentUser);
    renderEntryActionNote(currentUser);
    return currentUser;
  }

  entryStatus.innerText = `${currentUser.studentName} (${currentUser.studentId})`;
  entryActionLink.href = "../student/index.html";
  entryActionLink.innerText = "Trang cá nhân";
  renderHeroPrimaryAction(currentUser);
  renderEntryActionNote(currentUser);
  return currentUser;
}

function buildEventCardsMarkup(eventCards, currentUser) {
  return eventCards
    .map(({ event, status }) => {
      const registerLink = buildRegisterLink(event, status, currentUser);
      const registerLabel = !registerLink
        ? ""
        : !currentUser
          ? "Đăng nhập để đăng ký"
          : "Đăng ký tham gia";

      return `
        <article class="event-card">
          <div class="event-card-head">
            <span class="event-card-code">${escapeHtml(event.code)}</span>
            <span class="status-badge status-${escapeHtml(status.tone)}">
              ${escapeHtml(status.text)}
            </span>
          </div>

          <div class="event-card-copy">
            <h3>${escapeHtml(event.name)}</h3>
            <p class="event-card-description">
              ${escapeHtml(
                event.desc ||
                  "Nội dung chương trình sẽ được cập nhật chi tiết trong trang sự kiện.",
              )}
            </p>
          </div>

          <div class="event-card-meta">
            <article class="event-card-meta-item">
              <span>Thời gian</span>
              <strong>${escapeHtml(
                window.ClubStorage.formatDateRange(event.start, event.end),
              )}</strong>
            </article>
            <article class="event-card-meta-item">
              <span>Địa điểm</span>
              <strong>${escapeHtml(event.location || "Chưa cập nhật")}</strong>
            </article>
            <article class="event-card-meta-item">
              <span>Diễn giả</span>
              <strong>${escapeHtml(event.speaker || "Đang cập nhật")}</strong>
            </article>
            <article class="event-card-meta-item">
              <span>Đăng ký</span>
              <strong>${escapeHtml(event.registered || 0)}/${escapeHtml(event.max || 0)} người</strong>
            </article>
          </div>

          <div class="event-card-footer">
            <span class="event-card-capacity">
              <strong>${escapeHtml(buildAvailabilitySummary(event, status))}</strong>
            </span>
            <div class="event-card-actions">
              ${registerLink
                ? `<a href="${registerLink}" class="info-card-link">${registerLabel}</a>`
                : ""}
              <a href="detail.html?id=${encodeURIComponent(event.id)}" class="detail-btn">
                Xem chi tiết
              </a>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderEventCardsMarkup(eventCards, currentUser = null) {
  if (eventCards.length === 0) {
    renderEmptyState(
      "Hiện chưa có sự kiện đang mở hoặc sắp diễn ra trong hệ thống.",
    );
    return;
  }

  eventList.innerHTML = buildEventCardsMarkup(eventCards, currentUser);
}

async function renderEventCards() {
  eventList.innerHTML = `
    <div class="empty-panel">
      Đang tải dữ liệu sự kiện...
    </div>
  `;

  renderGuestEntryAction();
  const currentUserPromise = renderEntryAction().catch((error) => {
    console.warn("Khong the dong bo trang thai dang nhap tren trang su kien.", error);
    renderGuestEntryAction();
    return null;
  });

  try {
    const eventCards = (await window.ClubStorage.getUpcomingEvents())
      .map((event) => ({
        event,
        status: window.ClubStorage.getEventStatus(event),
      }))
      .sort((firstItem, secondItem) => {
        const toneDiff =
          getToneRank(firstItem.status.tone) - getToneRank(secondItem.status.tone);

        if (toneDiff !== 0) {
          return toneDiff;
        }

        const firstTime = Date.parse(firstItem.event.start || "") || 0;
        const secondTime = Date.parse(secondItem.event.start || "") || 0;

        if (firstTime !== secondTime) {
          return firstTime - secondTime;
        }

        return String(firstItem.event.code || "").localeCompare(
          String(secondItem.event.code || ""),
        );
      });

    updateEventMetrics(eventCards);

    if (eventFeedMeta) {
      eventFeedMeta.innerText =
        eventCards.length === 0
          ? "Hiện chưa có sự kiện đang mở hoặc sắp diễn ra."
          : `${eventCards.length} sự kiện đang được hiển thị công khai trên cổng thông tin.`;
    }

    const currentUser = await currentUserPromise;
    renderEventCardsMarkup(eventCards, currentUser);
  } catch (error) {
    await currentUserPromise;
    updateEventMetrics();
    if (eventFeedMeta) {
      eventFeedMeta.innerText = "Không thể đồng bộ dữ liệu sự kiện ở thời điểm hiện tại.";
    }
    renderEmptyState(error?.message || "Không thể tải dữ liệu sự kiện lúc này.");
  }
}

window.addEventListener("focus", function handleFocus() {
  renderEventCards().catch(console.error);
});

window.ClubAuth.subscribe(function handleAuthChange() {
  renderEventCards().catch(console.error);
});

renderEventCards().catch(console.error);
