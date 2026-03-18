let events = JSON.parse(localStorage.getItem("events")) || [];

let currentIndex = null;

function renderEvents() {
  let search = document.getElementById("search")?.value.toLowerCase() || "";

  let html = "";

  events.forEach((e, i) => {
    if (e.name.toLowerCase().includes(search)) {
      html += `
<tr>
<td>${i + 1}</td>
<td>${e.name}</td>
<td>EV${i + 1}</td>
<td>${e.start} - ${e.end}</td>
<td>${e.location}</td>
<td>${e.registered}/${e.max}</td>
<td>
<button class="action-btn" onclick="showDetail(${i})">
✏ Xem chi tiết
</button>
</td>
</tr>
`;
    }
  });

  document.getElementById("eventTable").innerHTML = html;
}

renderEvents();

function showDetail(i) {
  let e = events[i];

  currentIndex = i;

  document.getElementById("detailName").innerText = e.name;
  document.getElementById("detailDesc").innerText = e.desc;
  document.getElementById("detailSpeaker").innerText =
    e.speaker || "Chưa cập nhật";
  document.getElementById("detailTime").innerText = e.start + " - " + e.end;
  document.getElementById("detailLocation").innerText = e.location;
  document.getElementById("detailMax").innerText = e.registered + "/" + e.max;

  document.getElementById("detailModal").style.display = "flex";
}

function closeModal() {
  document.getElementById("detailModal").style.display = "none";
}

function openRegister() {
  document.getElementById("registerModal").style.display = "flex";
}

function closeRegister() {
  document.getElementById("registerModal").style.display = "none";
}

function registerEvent() {
  let name = document.getElementById("studentName").value.trim();
  let id = document.getElementById("studentId").value.trim();
  let course = document.getElementById("studentCourse").value.trim();
  let gender = document.getElementById("studentGender").value;

  let error = document.getElementById("error");

  error.innerText = "";

  if (!name || !id || !course || !gender) {
    error.innerText = "Vui lòng nhập đầy đủ thông tin bắt buộc";
    return;
  }

  let event = events[currentIndex];

  if (event.registered >= event.max) {
    showToast("Sự kiện đã đủ người", "#850E35");
    return;
  }

  event.registered++;

  events[currentIndex] = event;

  localStorage.setItem("events", JSON.stringify(events));

  let history = JSON.parse(localStorage.getItem("history")) || [];

  history.push({
    name: event.name,
    start: event.start,
    location: event.location,
  });

  localStorage.setItem("history", JSON.stringify(history));

  showToast("Đăng ký thành công", "#EE6983");

  closeRegister();
  closeModal();

  renderEvents();
  renderHistory();

  /* RESET FORM */
  document.getElementById("studentName").value = "";
  document.getElementById("studentId").value = "";
  document.getElementById("studentCourse").value = "";
  document.getElementById("studentGender").value = "";

  document.getElementById("error").innerText = "";
}

function renderHistory() {
  let history = JSON.parse(localStorage.getItem("history")) || [];

  let html = "";

  history.forEach((e) => {
    html += `
<tr>
<td>${e.name}</td>
<td>${e.start}</td>
<td>${e.location}</td>
</tr>
`;
  });

  document.getElementById("historyList").innerHTML = html;
}

renderHistory();

function showEvents() {
  document.getElementById("history").style.display = "none";
  document.getElementById("eventList").style.display = "block";

  let items = document.querySelectorAll(".menu-item");

  items.forEach((i) => i.classList.remove("active"));

  items[0].classList.add("active");
}

function showHistory() {
  document.getElementById("eventList").style.display = "none";
  document.getElementById("history").style.display = "block";

  let items = document.querySelectorAll(".menu-item");

  items.forEach((i) => i.classList.remove("active"));

  items[1].classList.add("active");
}

/* MENU 3 GẠCH */
document.getElementById("menuBtn").onclick = function () {
  document.getElementById("sidebar").classList.toggle("hide");
};

function toggleStudentMenu() {
  let menu = document.getElementById("studentMenu");
  let arrow = document.querySelector(".arrow");

  if (menu.style.display === "none" || menu.style.display === "") {
    menu.style.display = "block";
    arrow.innerHTML = "▲";
  } else {
    menu.style.display = "none";
    arrow.innerHTML = "▼";
  }
}

function showToast(message, color = "#850E35") {
  let toast = document.getElementById("toast");

  toast.innerText = message;

  toast.style.background = color;

  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2000);
}
