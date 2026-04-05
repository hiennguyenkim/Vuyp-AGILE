const QRCodeLibrary = window.QRCode;
let qrcode = null;

const mssvInput = document.getElementById("mssvInput");
const qrContainer = document.getElementById("qrContainer");
const qrMeta = document.getElementById("qrMeta");
const query = new URLSearchParams(window.location.search);
const isReadonly = query.get("readonly") === "1";
const inputGroup = document.querySelector(".input-group");
const actionButton = document.getElementById("generateQrButton");

function renderMeta(meta, mssv) {
  const rows = [];
  const code = meta.code || mssv;
  const name = meta.name || meta.studentName;

  if (code) {
    rows.push(`<div><strong>Mã:</strong> ${code}</div>`);
  }

  if (name) {
    rows.push(`<div><strong>Tên:</strong> ${name}</div>`);
  }

  rows.push(`<div><strong>MSSV:</strong> ${mssv}</div>`);

  if (rows.length === 0) {
    qrMeta.style.display = "none";
    qrMeta.innerHTML = "";
    return;
  }

  qrMeta.style.display = "block";
  qrMeta.innerHTML = rows.join("");
}

function showInlineError(message) {
  const oldAlert = document.querySelector(".error-message");
  if (oldAlert) {
    oldAlert.remove();
  }

  const errorMsg = document.createElement("div");
  errorMsg.className = "error-message";
  errorMsg.innerText = message;
  mssvInput.parentNode.insertBefore(errorMsg, mssvInput.nextSibling);

  window.setTimeout(() => {
    errorMsg.remove();
  }, 2000);
}

function getQrInstance() {
  if (qrcode) {
    return qrcode;
  }

  if (!QRCodeLibrary) {
    return null;
  }

  qrcode = new QRCodeLibrary(document.getElementById("qrcode"), {
    width: 200,
    height: 200,
    colorDark: "#114f96",
    colorLight: "#ffffff",
    correctLevel: QRCodeLibrary.CorrectLevel.H,
  });

  return qrcode;
}

function showQrRenderError() {
  qrContainer.classList.remove("has-qr");
  qrMeta.style.display = "block";
  qrMeta.innerHTML =
    "<div><strong>Lỗi:</strong> Không thể tải thư viện QR. Vui lòng tải lại trang hoặc kiểm tra kết nối mạng.</div>";
}

function generateQR(meta = {}) {
  const mssv = mssvInput.value.trim();

  if (!mssv) {
    mssvInput.style.borderColor = "#c32039";
    showInlineError("Vui lòng nhập MSSV.");
    window.setTimeout(() => {
      mssvInput.style.borderColor = "";
    }, 500);
    return;
  }

  const existingError = document.querySelector(".error-message");
  if (existingError) {
    existingError.remove();
  }

  const qrInstance = getQrInstance();
  if (!qrInstance) {
    showQrRenderError();
    return;
  }

  qrInstance.clear();
  // Giữ payload thật ngắn để tránh overflow với qrcodejs và tăng độ ổn định khi quét.
  qrInstance.makeCode(mssv);

  renderMeta(meta, mssv);
  qrContainer.classList.add("has-qr");
  mssvInput.select();
}

function readQueryMeta() {
  return {
    code: query.get("code"),
    name: query.get("name") || query.get("studentName"),
  };
}

mssvInput.addEventListener("keypress", function (event) {
  if (event.key === "Enter") {
    event.preventDefault();
    generateQR(readQueryMeta());
  }
});

actionButton.addEventListener("click", function () {
  generateQR(readQueryMeta());
});

const initialMssv = query.get("mssv");
if (initialMssv) {
  mssvInput.value = initialMssv;
  generateQR(readQueryMeta());
}

if (isReadonly && initialMssv) {
  inputGroup.style.display = "none";
  actionButton.style.display = "none";
}
