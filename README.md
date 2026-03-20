# Quan ly CLB su kien

## Cau truc thu muc

```text
Vuyp-AGILE/
|-- index.html
|-- README.md
|-- assets/
|   |-- css/
|   |   |-- admin.css
|   |   |-- event-detail.css
|   |   |-- events.css
|   |   |-- home.css
|   |   `-- student.css
|   |-- images/
|   |   `-- hcmue.png
|   `-- js/
|       |-- admin.js
|       |-- event-detail.js
|       |-- events.js
|       |-- storage.js
|       `-- student.js
`-- pages/
    |-- admin/
    |   `-- index.html
    |-- events/
    |   |-- detail.html
    |   `-- index.html
    `-- student/
        `-- index.html
```

## Y nghia

- `index.html`: trang dieu huong vao cac phan he cua de tai.
- `pages/admin`: phan he quan tri CRUD su kien va theo doi dang ky.
- `pages/student`: phan he sinh vien dang ky su kien va xem lich su.
- `pages/events`: trang cong khai de xem danh sach va chi tiet su kien.
- `assets/css`: toan bo stylesheet dung chung cho du an.
- `assets/js`: logic giao dien va module `storage.js` dung chung du lieu.
- `assets/images`: hinh anh va tai nguyen media cua de tai.

## Ghi chu

- Toan bo du an hien dang dung `localStorage` lam tang luu tru.
- Cac trang su kien, sinh vien va admin da duoc doi sang duong dan moi va dung chung nguon du lieu.
