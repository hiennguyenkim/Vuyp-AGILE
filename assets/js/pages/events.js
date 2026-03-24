function renderEntryAction() {
  const entryStatus = document.getElementById("entryStatus");
  const entryActionLink = document.getElementById("entryActionLink");

  if (!window.ClubAuth) {
    return null;
  }

  const currentUser = window.ClubAuth.getCurrentUser();

  if (!currentUser) {
    entryStatus.innerText = "Đang xem công khai";
    entryActionLink.href = "../auth/login.html";
    entryActionLink.innerText = "Đăng nhập";
    return null;
  }

  if (window.ClubAuth.isAdmin(currentUser)) {
    entryStatus.innerText = `${currentUser.displayName} - ${currentUser.roleLabel}`;
    entryActionLink.href = "../admin/index.html";
    entryActionLink.innerText = "Trang quản trị";
    return currentUser;
  }

  entryStatus.innerText = `${currentUser.studentName} (${currentUser.studentId})`;
  entryActionLink.href = "../student/index.html";
  entryActionLink.innerText = "Trang cá nhân";
  return currentUser;
}

function renderEmptyState(tbody) {
  renderEntryAction();

  tbody.innerHTML = `
    <tr>
      <td colspan="5" class="empty-row">
        Hiện chưa có sự kiện sắp diễn ra trong hệ thống.
      </td>
    </tr>
  `;
}

function renderEventTable() {
  renderEntryAction();

  const events = window.ClubStorage ? window.ClubStorage.getUpcomingEvents() : [];
  const tbody = document.getElementById("event-list");
  tbody.innerHTML = "";

  if (events.length === 0) {
    renderEmptyState(tbody);
    return;
  }

  events.forEach((event) => {
    const row = document.createElement("tr");
    row.className = "event-row-link";
    row.tabIndex = 0;
    row.role = "link";
    row.onclick = function () {
      window.location.href = `detail.html?id=${encodeURIComponent(event.id)}`;
    };
    row.onkeydown = function (keyboardEvent) {
      if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
        keyboardEvent.preventDefault();
        window.location.href = `detail.html?id=${encodeURIComponent(event.id)}`;
      }
    };

    const codeCell = document.createElement("td");
    codeCell.innerHTML = `<span class="event-code">${event.code}</span>`;

    const nameCell = document.createElement("td");
    nameCell.textContent = event.name;

    const timeCell = document.createElement("td");
    timeCell.textContent = window.ClubStorage.formatDateRange(event.start, event.end);

    const locationCell = document.createElement("td");
    locationCell.textContent = event.location;

    const actionCell = document.createElement("td");
    const detailLink = document.createElement("a");
    detailLink.href = `detail.html?id=${event.id}`;
    detailLink.className = "detail-btn";
    detailLink.textContent = "Xem chi tiết";
    actionCell.appendChild(detailLink);

    row.appendChild(codeCell);
    row.appendChild(nameCell);
    row.appendChild(timeCell);
    row.appendChild(locationCell);
    row.appendChild(actionCell);

    tbody.appendChild(row);
  });
}

window.addEventListener("storage", renderEventTable);
window.addEventListener("load", renderEventTable);

