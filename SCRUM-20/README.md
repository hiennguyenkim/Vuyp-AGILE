# Quan ly CLB su kien

## Cau truc thu muc moi

```text
Vuyp-AGILE/
|-- index.html
|-- QRCode.html
|-- README.md
|-- assets/
|   |-- css/
|   |   |-- core/
|   |   |   |-- base.css
|   |   |   |-- components.css
|   |   |   `-- theme.css
|   |   `-- pages/
|   |       |-- admin.css
|   |       |-- event-detail.css
|   |       |-- events.css
|   |       |-- login.css
|   |       |-- qr.css
|   |       `-- student.css
|   |-- images/
|   |   `-- hcmue.png
|   `-- js/
|       |-- core/
|       |   |-- auth.js
|       |   |-- storage.js
|       |   `-- utils.js
|       `-- pages/
|           |-- admin.js
|           |-- event-detail.js
|           |-- events.js
|           |-- login.js
|           |-- qr.js
|           `-- student.js
`-- pages/
    |-- admin/
    |   `-- index.html
    |-- auth/
    |   `-- login.html
    |-- events/
    |   |-- detail.html
    |   `-- index.html
    `-- student/
        |-- index.html
        `-- qr.html
```

## Nguyen tac to chuc

- `assets/css/core`: he theme chung, reset, token mau, component dung lai cho tat ca trang.
- `assets/css/pages`: phan style rieng theo tung man hinh.
- `assets/js/core`: auth, storage va helper dung chung.
- `assets/js/pages`: logic rieng cua tung trang.
- `pages/*`: chia ro theo khu vuc nguoi dung va chuc nang.
- `QRCode.html`: giu lai de redirect, tranh gay link cu.

## Ghi chu

- Toan bo du an van su dung `localStorage` lam tang luu tru.
- Theme da duoc dong bo lai theo cung he mau, button, card, bang va status badge.
- Cau truc moi uu tien de doc, de bao tri va de tiep tuc tach nho logic khi du an lon hon.
