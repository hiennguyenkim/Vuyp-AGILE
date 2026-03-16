function getEvents() {
  return JSON.parse(localStorage.getItem("events")) || [];
}

function saveEvents(events) {
  localStorage.setItem("events", JSON.stringify(events));
}

let events = getEvents();

const form = document.getElementById("eventForm");
const list = document.getElementById("eventList");

form.addEventListener("submit", function (e) {
  e.preventDefault();

  document.getElementById("error").innerText = "";
  document.getElementById("success").innerText = "";

  let name = document.getElementById("name").value;
  let desc = document.getElementById("description").value;
  let speaker = document.getElementById("speaker").value;
  let start = document.getElementById("start").value;
  let end = document.getElementById("end").value;
  let location = document.getElementById("location").value;
  let max = document.getElementById("max").value;

  if (!name || !start || !end || !location || !max) {
    document.getElementById("error").innerText =
      "Vui lòng nhập đầy đủ thông tin!";
    return;
  }

  let index = document.getElementById("eventIndex").value;

  let event = {
    name,
    desc,
    speaker,
    start,
    end,
    location,
    max,
    registered: 0,
  };

  function showToast(message) {
    let toast = document.getElementById("toast");

    toast.innerText = message;
    toast.classList.add("show");

    setTimeout(() => {
      toast.classList.remove("show");
    }, 3000);
  }

  if (index === "") {
    events.push(event);
    showToast("Tạo sự kiện thành công");
  } else {
    event.registered = events[index].registered;
    events[index] = event;
    showToast("Cập nhật sự kiện thành công");
  }

  saveEvents(events);

  renderEvents();

  form.reset();
  document.getElementById("eventIndex").value = "";
});

function renderEvents() {
  list.innerHTML = "";

  events.forEach((e, i) => {
    list.innerHTML += `

<tr>

<td>${e.name}</td>

<td>${e.start}</td>

<td>${e.location}</td>

<td>

<button class="edit-btn" onclick="editEvent(${i})">✏️</button>
<button class="delete-btn" onclick="deleteEvent(${i})">🗑️</button>

</td>

</tr>

`;
  });
}

function editEvent(i) {
  let e = events[i];

  document.getElementById("name").value = e.name;
  document.getElementById("description").value = e.desc;
  document.getElementById("speaker").value = e.speaker;
  document.getElementById("start").value = e.start;
  document.getElementById("end").value = e.end;
  document.getElementById("location").value = e.location;
  document.getElementById("max").value = e.max;

  document.getElementById("eventIndex").value = i;
}

let deleteIndex = null;

function deleteEvent(i) {
  deleteIndex = i;
  document.getElementById("deleteModal").style.display = "flex";
}

renderEvents();

document.getElementById("confirmDelete").onclick = function () {
  if (deleteIndex !== null) {
    events.splice(deleteIndex, 1);
    saveEvents(events);
    renderEvents();
  }

  document.getElementById("deleteModal").style.display = "none";
  deleteIndex = null;
};

document.getElementById("cancelDelete").onclick = function () {
  document.getElementById("deleteModal").style.display = "none";
};
