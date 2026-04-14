import "../../services/auth.js";
import {
  getNextPageFromAction,
  paginateItems,
  renderPaginationControls,
} from "../../utils/pagination.js";

const { escapeHtml } = window.AppUtils;

let currentUser = null;
let students = [];
let studentSearchTerm = "";
let studentCourseFilter = "";
let studentGenderFilter = "";
let studentSortField = "studentId";
let studentSortDirection = "asc";
let deleteTargetIds = [];
let selectedStudentIds = new Set();
let studentFormBusy = false;
let deleteStudentBusy = false;
let studentPage = 1;

const adminName = document.getElementById("adminName");
const adminRole = document.getElementById("adminRole");
const backToAdminBtn = document.getElementById("backToAdminBtn");
const totalStudentsStat = document.getElementById("totalStudentsStat");
const filteredStudentsStat = document.getElementById("filteredStudentsStat");
const courseCountStat = document.getElementById("courseCountStat");
const studentSearchInput = document.getElementById("studentSearchInput");
const studentCourseFilterSelect = document.getElementById("studentCourseFilter");
const studentGenderFilterSelect = document.getElementById("studentGenderFilter");
const addStudentBtn = document.getElementById("addStudentBtn");
const selectAllStudents = document.getElementById("selectAllStudents");
const selectedStudentsCount = document.getElementById("selectedStudentsCount");
const bulkDeleteStudentsBtn = document.getElementById("bulkDeleteStudentsBtn");
const studentList = document.getElementById("studentList");
const studentSortButtons = [...document.querySelectorAll(".student-sort-button")];
const studentTableMeta = document.getElementById("studentTableMeta");
const studentTablePagination = document.getElementById("studentTablePagination");
const studentError = document.getElementById("studentError");
const studentSuccess = document.getElementById("studentSuccess");
const studentModal = document.getElementById("studentModal");
const studentModalTitle = document.getElementById("studentModalTitle");
const studentPasswordHint = document.getElementById("studentPasswordHint");
const studentForm = document.getElementById("studentForm");
const studentRecordId = document.getElementById("studentRecordId");
const studentNameInput = document.getElementById("studentNameInput");
const studentIdInput = document.getElementById("studentIdInput");
const studentLoginIdInput = document.getElementById("studentLoginIdInput");
const studentEmailInput = document.getElementById("studentEmailInput");
const studentCourseInput = document.getElementById("studentCourseInput");
const studentGenderInput = document.getElementById("studentGenderInput");
const studentPasswordInput = document.getElementById("studentPasswordInput");
const saveStudentBtn = document.getElementById("saveStudentBtn");
const cancelStudentBtn = document.getElementById("cancelStudentBtn");
const deleteStudentModal = document.getElementById("deleteStudentModal");
const deleteStudentMessage = document.getElementById("deleteStudentMessage");
const confirmDeleteStudent = document.getElementById("confirmDeleteStudent");
const cancelDeleteStudent = document.getElementById("cancelDeleteStudent");

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function resetMessages() {
  studentError.innerText = "";
  studentSuccess.innerText = "";
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.innerText = message;
  toast.classList.add("show");

  window.setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

async function ensureAdminAccess() {
  await window.ClubAuth.ready();
  currentUser = window.ClubAuth.getCurrentUser();

  if (!currentUser || !window.ClubAuth.isAdmin(currentUser)) {
    window.location.replace("../auth/login.html?next=admin");
    return false;
  }

  return true;
}

function renderAdminSession() {
  adminName.innerText = currentUser?.displayName || "Quản trị viên";
  adminRole.innerText = currentUser
    ? `${currentUser.roleLabel} - ${currentUser.loginId}`
    : "Đang xác thực tài khoản";
}

async function getAdminAccessToken() {
  if (!(await ensureAdminAccess())) {
    throw new Error("Khong the xac nhan phien admin hien tai.");
  }

  const authState = await window.ClubAuth.readAuthState();
  const accessToken =
    authState?.session?.access_token || window.ClubAuth.getCurrentSession()?.access_token;

  if (!accessToken) {
    throw new Error("Khong tim thay access token. Vui long dang nhap lai.");
  }

  return accessToken;
}

async function apiRequest(path, options = {}) {
  const accessToken = await getAdminAccessToken();
  const response = await fetch(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.message || "Khong the xu ly yeu cau sinh vien luc nay.");
  }

  return payload;
}

function getFilteredStudents() {
  const keyword = studentSearchTerm.trim().toLowerCase();

  return students.filter((student) => {
    const studentCourse = normalizeString(student.studentCourse);
    const studentGender = normalizeString(student.studentGender);
    const haystack = [
      student.studentId,
      student.studentName,
      student.loginId,
      student.email,
      studentCourse,
      studentGender,
    ]
      .join(" ")
      .toLowerCase();

    if (keyword && !haystack.includes(keyword)) {
      return false;
    }

    if (studentCourseFilter && studentCourse !== studentCourseFilter) {
      return false;
    }

    if (studentGenderFilter === "__empty__") {
      return !studentGender;
    }

    if (studentGenderFilter && studentGender !== studentGenderFilter) {
      return false;
    }

    return true;
  });
}

function getSortableStudentValue(student, field) {
  if (field === "createdAt") {
    return Date.parse(student.createdAt || "") || 0;
  }

  return normalizeString(student?.[field]).toLocaleLowerCase("vi");
}

function compareStudents(leftStudent, rightStudent) {
  const direction = studentSortDirection === "desc" ? -1 : 1;
  const leftValue = getSortableStudentValue(leftStudent, studentSortField);
  const rightValue = getSortableStudentValue(rightStudent, studentSortField);

  let compareResult = 0;

  if (studentSortField === "createdAt") {
    compareResult = Number(leftValue) - Number(rightValue);
  } else {
    compareResult = String(leftValue).localeCompare(String(rightValue), "vi", {
      numeric: true,
      sensitivity: "base",
    });
  }

  if (compareResult === 0) {
    compareResult = normalizeString(leftStudent.studentId || leftStudent.id).localeCompare(
      normalizeString(rightStudent.studentId || rightStudent.id),
      "vi",
      {
        numeric: true,
        sensitivity: "base",
      },
    );
  }

  return compareResult * direction;
}

function getVisibleStudents() {
  return [...getFilteredStudents()].sort(compareStudents);
}

function getPaginatedStudents() {
  return paginateItems(getVisibleStudents(), studentPage);
}

function sortLabelValues(values) {
  return [...values].sort((leftValue, rightValue) =>
    String(leftValue).localeCompare(String(rightValue), "vi", {
      numeric: true,
      sensitivity: "base",
    }),
  );
}

function populateCourseFilterOptions() {
  const currentValue = studentCourseFilterSelect.value;
  const courseOptions = sortLabelValues(
    [...new Set(
      students
        .map((student) => normalizeString(student.studentCourse))
        .filter(Boolean),
    )],
  );

  studentCourseFilterSelect.innerHTML = [
    '<option value="">Tất cả khóa</option>',
    ...courseOptions.map(
      (course) => `<option value="${escapeHtml(course)}">${escapeHtml(course)}</option>`,
    ),
  ].join("");

  if (courseOptions.includes(currentValue)) {
    studentCourseFilterSelect.value = currentValue;
    return;
  }

  studentCourseFilterSelect.value = "";
  studentCourseFilter = "";
}

function getActiveFilterSummary() {
  const parts = [];

  if (studentCourseFilter) {
    parts.push(`khóa ${studentCourseFilter}`);
  }

  if (studentGenderFilter === "__empty__") {
    parts.push("giới tính chưa cập nhật");
  } else if (studentGenderFilter) {
    parts.push(`giới tính ${studentGenderFilter}`);
  }

  if (studentSearchTerm.trim()) {
    parts.push(`từ khóa "${studentSearchTerm.trim()}"`);
  }

  return parts.join(", ");
}

function updateStats(filteredStudents) {
  totalStudentsStat.innerText = String(students.length);
  filteredStudentsStat.innerText = String(filteredStudents.length);

  const courseCount = new Set(
    students
      .map((student) => String(student.studentCourse || "").trim())
      .filter(Boolean),
  ).size;
  courseCountStat.innerText = String(courseCount);
}

function updateSelectionState(visibleStudents) {
  const visibleStudentIds = visibleStudents
    .map((student) => student.id)
    .filter(Boolean);
  const selectedVisibleCount = visibleStudentIds.filter((studentId) =>
    selectedStudentIds.has(studentId),
  ).length;
  const totalSelectedCount = selectedStudentIds.size;

  selectAllStudents.disabled = visibleStudentIds.length === 0 || deleteStudentBusy;
  selectAllStudents.checked =
    visibleStudentIds.length > 0 && selectedVisibleCount === visibleStudentIds.length;
  selectAllStudents.indeterminate =
    selectedVisibleCount > 0 && selectedVisibleCount < visibleStudentIds.length;

  bulkDeleteStudentsBtn.disabled = totalSelectedCount === 0 || deleteStudentBusy;
  bulkDeleteStudentsBtn.innerText = deleteStudentBusy
    ? "Đang xóa..."
    : totalSelectedCount > 0
      ? `Xóa ${totalSelectedCount} sinh viên đã chọn`
      : "Xóa đã chọn";

  if (totalSelectedCount === 0) {
    selectedStudentsCount.innerText = "Chưa chọn sinh viên nào.";
    return;
  }

  selectedStudentsCount.innerText =
    selectedVisibleCount === totalSelectedCount
      ? `Đã chọn ${totalSelectedCount} sinh viên trong danh sách hiện tại.`
      : `Đã chọn ${totalSelectedCount} sinh viên, trong đó ${selectedVisibleCount} sinh viên đang hiển thị.`;
}

function updateSortButtons() {
  studentSortButtons.forEach((button) => {
    const buttonField = normalizeString(button.dataset.sortField);
    const indicator = button.querySelector(".student-sort-indicator");
    const isActive = buttonField === studentSortField;

    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");

    if (!indicator) {
      return;
    }

    if (!isActive) {
      indicator.innerText = "↕";
      return;
    }

    indicator.innerText = studentSortDirection === "desc" ? "↓" : "↑";
  });
}

function renderStudents() {
  const filteredStudents = getVisibleStudents();
  const studentPagination = paginateItems(filteredStudents, studentPage);
  const visibleStudents = studentPagination.items;
  studentPage = studentPagination.currentPage;

  updateStats(filteredStudents);
  updateSelectionState(visibleStudents);
  updateSortButtons();

  if (filteredStudents.length === 0) {
    const filterSummary = getActiveFilterSummary();
    studentTableMeta.innerText = filterSummary
      ? `Khong tim thay sinh vien phu hop voi bo loc: ${filterSummary}.`
      : "He thong hien chua co tai khoan sinh vien nao.";
    renderPaginationControls(
      studentTablePagination,
      paginateItems([], studentPage),
      { itemLabel: "sinh viên" },
    );
    studentList.innerHTML = `
      <tr>
        <td colspan="8">${escapeHtml(studentTableMeta.innerText)}</td>
      </tr>
    `;
    return;
  }

  const filterSummary = getActiveFilterSummary();
  studentTableMeta.innerText = filterSummary
    ? `Dang hien thi ${filteredStudents.length}/${students.length} sinh vien theo bo loc: ${filterSummary}.`
    : `Dang hien thi toan bo ${students.length} sinh vien trong he thong.`;

  studentList.innerHTML = visibleStudents
    .map((student) => {
      const isSelected = selectedStudentIds.has(student.id);

      return `
        <tr>
          <td class="student-select-cell">
            <input
              type="checkbox"
              class="student-row-checkbox"
              data-student-id="${escapeHtml(student.id)}"
              aria-label="Chọn sinh viên ${escapeHtml(student.studentName || student.studentId || student.email || "")}"
              ${isSelected ? "checked" : ""}
              ${deleteStudentBusy ? "disabled" : ""}
            />
          </td>
          <td>${escapeHtml(student.studentId || "-")}</td>
          <td>${escapeHtml(student.studentName || "-")}</td>
          <td>${escapeHtml(student.loginId || "-")}</td>
          <td>${escapeHtml(student.email || "-")}</td>
          <td>${escapeHtml(student.studentCourse || "-")}</td>
          <td>${escapeHtml(student.studentGender || "-")}</td>
          <td>
            <button class="edit-btn" onclick="editStudent('${escapeHtml(student.id)}')">Sửa</button>
            <button class="delete-btn" onclick="deleteStudent('${escapeHtml(student.id)}')">Xóa</button>
          </td>
        </tr>
      `;
    })
    .join("");

  renderPaginationControls(studentTablePagination, studentPagination, {
    itemLabel: "sinh viên",
  });
}

async function loadStudents() {
  if (!(await ensureAdminAccess())) {
    return;
  }

  renderAdminSession();
  const payload = await apiRequest("/api/admin/students");
  students = Array.isArray(payload.students) ? payload.students : [];
  populateCourseFilterOptions();
  const availableStudentIds = new Set(
    students.map((student) => student.id).filter(Boolean),
  );
  selectedStudentIds = new Set(
    [...selectedStudentIds].filter((studentId) => availableStudentIds.has(studentId)),
  );
  renderStudents();
}

function resetStudentForm() {
  studentForm.reset();
  studentRecordId.value = "";
}

function openStudentModal(student = null) {
  resetMessages();

  if (student) {
    studentModalTitle.innerText = "Cập nhật sinh viên";
    studentPasswordHint.innerText =
      "Để trống nếu muốn giữ nguyên mật khẩu hiện tại. Chỉ nhập khi cần đặt lại mật khẩu.";
    studentRecordId.value = student.id || "";
    studentNameInput.value = student.studentName || "";
    studentIdInput.value = student.studentId || "";
    studentLoginIdInput.value = student.loginId || "";
    studentEmailInput.value = student.email || "";
    studentCourseInput.value = student.studentCourse || "";
    studentGenderInput.value = student.studentGender || "";
    studentPasswordInput.value = "";
    saveStudentBtn.innerText = "Lưu cập nhật";
  } else {
    studentModalTitle.innerText = "Tạo tài khoản sinh viên";
    studentPasswordHint.innerText =
      "Để trống nếu muốn dùng mật khẩu mặc định trong .env.";
    resetStudentForm();
    saveStudentBtn.innerText = "Tạo tài khoản";
  }

  studentModal.style.display = "flex";
}

function closeStudentModal() {
  if (studentFormBusy) {
    return;
  }

  studentModal.style.display = "none";
  resetStudentForm();
}

function getStudentById(studentId) {
  return students.find((student) => student.id === studentId) || null;
}

function setStudentBusyState(isBusy) {
  studentFormBusy = isBusy;
  saveStudentBtn.disabled = isBusy;
  cancelStudentBtn.disabled = isBusy;
  addStudentBtn.disabled = isBusy;
  saveStudentBtn.innerText = isBusy
    ? studentRecordId.value
      ? "Đang cập nhật..."
      : "Đang tạo tài khoản..."
    : studentRecordId.value
      ? "Lưu cập nhật"
      : "Tạo tài khoản";
}

function setDeleteBusyState(isBusy) {
  deleteStudentBusy = isBusy;
  confirmDeleteStudent.disabled = isBusy;
  cancelDeleteStudent.disabled = isBusy;
  confirmDeleteStudent.innerText = isBusy ? "Đang xóa..." : "Xác nhận";
  renderStudents();
}

function buildStudentPayload() {
  return {
    email: studentEmailInput.value.trim(),
    loginId: studentLoginIdInput.value.trim(),
    password: studentPasswordInput.value.trim(),
    studentCourse: studentCourseInput.value.trim(),
    studentGender: studentGenderInput.value.trim(),
    studentId: studentIdInput.value.trim(),
    studentName: studentNameInput.value.trim(),
  };
}

async function submitStudentForm(event) {
  event.preventDefault();
  resetMessages();
  setStudentBusyState(true);

  try {
    const payload = buildStudentPayload();
    const studentId = studentRecordId.value.trim();
    const response = await apiRequest(
      studentId ? `/api/admin/students/${encodeURIComponent(studentId)}` : "/api/admin/students",
      {
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
        },
        method: studentId ? "PUT" : "POST",
      },
    );

    studentSuccess.innerText = response.message || "Luu sinh vien thanh cong.";
    showToast(
      studentId
        ? "Cập nhật sinh viên thành công"
        : "Tạo tài khoản sinh viên thành công",
    );
    closeStudentModal();
    await loadStudents();
  } catch (error) {
    studentError.innerText = error.message;
  } finally {
    setStudentBusyState(false);
  }
}

function openDeleteStudentModal(studentIds) {
  deleteTargetIds = studentIds
    .map((studentId) => normalizeString(studentId))
    .filter(Boolean);

  if (deleteTargetIds.length === 0) {
    showToast("Hãy chọn ít nhất một sinh viên để xóa");
    return;
  }

  if (deleteTargetIds.length === 1) {
    const student = getStudentById(deleteTargetIds[0]);
    deleteStudentMessage.innerText = student
      ? `Bạn có chắc chắn muốn xóa sinh viên "${student.studentName}" (${student.studentId}) không?`
      : "Bạn có chắc chắn muốn xóa sinh viên này không?";
  } else {
    const previewStudents = deleteTargetIds
      .map((studentId) => getStudentById(studentId))
      .filter(Boolean)
      .slice(0, 3)
      .map((student) => student.studentName || student.studentId || student.email)
      .filter(Boolean);
    const remainingCount = deleteTargetIds.length - previewStudents.length;

    deleteStudentMessage.innerText = previewStudents.length > 0
      ? `Bạn có chắc chắn muốn xóa ${deleteTargetIds.length} sinh viên đã chọn không? Gồm ${previewStudents.join(", ")}${remainingCount > 0 ? ` và ${remainingCount} sinh viên khác.` : "."}`
      : `Bạn có chắc chắn muốn xóa ${deleteTargetIds.length} sinh viên đã chọn không?`;
  }

  deleteStudentModal.style.display = "flex";
}

async function confirmDeleteStudentAction() {
  if (deleteTargetIds.length === 0) {
    return;
  }

  resetMessages();
  setDeleteBusyState(true);
  const targetIds = [...deleteTargetIds];
  let deletedCount = 0;
  const failures = [];

  try {
    for (const studentId of targetIds) {
      try {
        await apiRequest(`/api/admin/students/${encodeURIComponent(studentId)}`, {
          method: "DELETE",
        });
        selectedStudentIds.delete(studentId);
        deletedCount += 1;
      } catch (error) {
        failures.push({
          message: error.message,
          student: getStudentById(studentId),
        });
      }
    }

    if (deletedCount > 0) {
      studentSuccess.innerText =
        targetIds.length === 1
          ? "Da xoa sinh vien thanh cong."
          : `Da xoa ${deletedCount}/${targetIds.length} sinh vien da chon.`;
      showToast(
        targetIds.length === 1
          ? "Xóa sinh viên thành công"
          : `Đã xóa ${deletedCount} sinh viên`,
      );
    }

    if (failures.length > 0) {
      const failedPreview = failures[0]?.student?.studentName || failures[0]?.student?.studentId;
      studentError.innerText = failedPreview
        ? `Khong the xoa mot so sinh vien. Loi dau tien voi ${failedPreview}: ${failures[0].message}`
        : failures[0].message;
    }

    deleteStudentModal.style.display = "none";
    deleteTargetIds = [];
    await loadStudents();
  } finally {
    setDeleteBusyState(false);
  }
}

function handleSelectAllStudents() {
  const visibleStudents = getPaginatedStudents().items;
  const shouldSelectAll = selectAllStudents.checked;

  visibleStudents.forEach((student) => {
    if (!student.id) {
      return;
    }

    if (shouldSelectAll) {
      selectedStudentIds.add(student.id);
      return;
    }

    selectedStudentIds.delete(student.id);
  });

  renderStudents();
}

function handleRowSelectionChange(event) {
  const target = event.target;

  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  if (!target.classList.contains("student-row-checkbox")) {
    return;
  }

  const studentId = normalizeString(target.dataset.studentId);

  if (!studentId) {
    return;
  }

  if (target.checked) {
    selectedStudentIds.add(studentId);
  } else {
    selectedStudentIds.delete(studentId);
  }

  updateSelectionState(getPaginatedStudents().items);
}

function handleSortButtonClick(event) {
  const targetButton = event.target.closest(".student-sort-button");

  if (!(targetButton instanceof HTMLButtonElement)) {
    return;
  }

  const nextSortField = normalizeString(targetButton.dataset.sortField) || "studentId";

  if (nextSortField === studentSortField) {
    studentSortDirection = studentSortDirection === "asc" ? "desc" : "asc";
  } else {
    studentSortField = nextSortField;
    studentSortDirection = "asc";
  }

  renderStudents();
}

function promptDeleteStudent(studentId) {
  openDeleteStudentModal([studentId]);
}

function promptBulkDeleteStudents() {
  if (selectedStudentIds.size === 0) {
    showToast("Hãy chọn ít nhất một sinh viên để xóa");
    return;
  }

  openDeleteStudentModal([...selectedStudentIds]);
}

function closeDeleteStudentModal() {
  if (deleteStudentBusy) {
    return;
  }

  deleteStudentModal.style.display = "none";
  deleteTargetIds = [];
}

function handleAsyncError(error) {
  console.error(error);
  studentError.innerText = error?.message || "Khong the dong bo du lieu sinh vien luc nay.";
}

backToAdminBtn.addEventListener("click", function onBackToAdminClick() {
  window.location.href = "index.html";
});

addStudentBtn.addEventListener("click", function onAddStudentClick() {
  openStudentModal();
});

studentSearchInput.addEventListener("input", function onSearchInput() {
  studentSearchTerm = studentSearchInput.value || "";
  studentPage = 1;
  renderStudents();
});

studentCourseFilterSelect.addEventListener("change", function onCourseFilterChange() {
  studentCourseFilter = normalizeString(studentCourseFilterSelect.value);
  studentPage = 1;
  renderStudents();
});

studentGenderFilterSelect.addEventListener("change", function onGenderFilterChange() {
  studentGenderFilter = normalizeString(studentGenderFilterSelect.value);
  studentPage = 1;
  renderStudents();
});

studentSortButtons.forEach((button) => {
  button.addEventListener("click", function onSortButtonClick(event) {
    handleSortButtonClick(event);
  });
});

studentTablePagination.addEventListener("click", function onStudentPaginationClick(event) {
  const targetButton = event.target.closest("[data-pagination-action]");

  if (!(targetButton instanceof HTMLButtonElement)) {
    return;
  }

  const action = normalizeString(targetButton.dataset.paginationAction);
  const totalPages = Number(studentTablePagination.dataset.totalPages) || 1;
  studentPage = getNextPageFromAction(action, studentPage, totalPages);
  renderStudents();
});

selectAllStudents.addEventListener("change", function onSelectAllChange() {
  handleSelectAllStudents();
});

bulkDeleteStudentsBtn.addEventListener("click", function onBulkDeleteClick() {
  promptBulkDeleteStudents();
});

studentList.addEventListener("change", function onStudentListChange(event) {
  handleRowSelectionChange(event);
});

studentForm.addEventListener("submit", function onStudentSubmit(event) {
  submitStudentForm(event).catch(handleAsyncError);
});

cancelStudentBtn.addEventListener("click", function onCancelStudentClick() {
  closeStudentModal();
});

confirmDeleteStudent.addEventListener("click", function onConfirmDeleteStudent() {
  confirmDeleteStudentAction().catch(handleAsyncError);
});

cancelDeleteStudent.addEventListener("click", function onCancelDeleteStudent() {
  closeDeleteStudentModal();
});

window.onclick = function onWindowClick(event) {
  if (event.target === studentModal) {
    closeStudentModal();
    return;
  }

  if (event.target === deleteStudentModal) {
    closeDeleteStudentModal();
  }
};

window.addEventListener("focus", function onFocus() {
  loadStudents().catch(handleAsyncError);
});

window.ClubAuth.subscribe(function onAuthChange() {
  loadStudents().catch(handleAsyncError);
});

window.editStudent = function editStudent(studentId) {
  const student = getStudentById(studentId);

  if (!student) {
    showToast("Không tìm thấy sinh viên cần chỉnh sửa");
    return;
  }

  openStudentModal(student);
};

window.deleteStudent = function deleteStudent(studentId) {
  promptDeleteStudent(studentId);
};

loadStudents().catch(handleAsyncError);
