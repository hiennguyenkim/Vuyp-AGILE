function renderEmptyState(tbody) {
  tbody.innerHTML = `
    <tr>
      <td colspan="5" style="text-align:center; padding: 28px 20px;">
        Hiện chưa có sự kiện còn hiệu lực trong hệ thống.
        <a href="../admin/index.html" class="detail-btn" style="margin-left: 10px;">
          Tạo sự kiện
        </a>
      </td>
    </tr>
  `;
}

function renderEventTable() {
  const events = window.ClubStorage ? window.ClubStorage.getActiveEvents() : [];
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
    timeCell.textContent = window.ClubStorage.formatDateRange(
      event.start,
      event.end,
    );

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
