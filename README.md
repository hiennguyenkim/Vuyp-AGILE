# Quan ly CLB su kien

## Cau truc hien tai

```text
Vuyp-AGILE/
|-- backend/
|   |-- config/
|   |   `-- env-loader.cjs
|   |-- tools/
|   |   `-- student-import/
|   |       |-- cli.js
|   |       |-- index.js
|   |       `-- template.xlsx
|   |-- scripts/
|   |   `-- supabase/
|   |       `-- schema.sql
|   |-- package.json
|   `-- server.js
|-- frontend/
|   |-- public/
|   |   |-- index.html
|   |   `-- pages/
|   |       |-- admin/
|   |       |-- auth/
|   |       |-- events/
|   |       `-- student/
|   |-- src/
|   |   |-- assets/
|   |   |   |-- css/
|   |   |   `-- images/
|   |   |-- components/
|   |   |-- pages/
|   |   |   |-- admin/
|   |   |   |-- auth/
|   |   |   |-- events/
|   |   |   `-- student/
|   |   |-- services/
|   |   `-- utils/
|   |-- package.json
|   `-- README.md
|-- index.html
|-- README.md
`-- serve.json
```

## Ghi chu

- Frontend nam trong `frontend/`, backend nam trong `backend/`.
- HTML tinh nam trong `frontend/public/`, ma nguon frontend nam trong `frontend/src/`.
- Tai nguyen dung chung nam trong `frontend/src/assets/`, logic theo man hinh nam trong `frontend/src/pages/`.
- `frontend/src/components/` da duoc scaffold san de tach component tai su dung neu ban muon nang cap len SPA sau nay.
- `frontend/src/services/auth.js` va `frontend/src/services/storage.js` da chuyen sang mo hinh async voi Supabase.
- Gia tri thuc te cho URL, anon key va cac bien nhay cam chi nam trong `.env` (tham khao `.env.example`).
- `frontend/src/services/supabase-config.js` chi doc bien moi truong va ap dung mapping schema/runtime cho frontend.
- Frontend dung Supabase JS client nen chi can URL + anon key. Connection string PostgreSQL chi nen dung cho backend/script an toan, khong dung truc tiep trong trinh duyet.
- Backend hien tai tap trung vao runtime server, tool import Excel va tai lieu schema Supabase.
- Script Supabase con giu lai trong repo nam o `backend/scripts/supabase/`, hien tai chu yeu la `schema.sql` de tham chieu cau truc DB.
- Tool import sinh vien tu Excel nam trong `backend/tools/student-import/`.
- Runtime server de deploy nam trong `backend/server.js`; server nay cung serve frontend va endpoint `/app-env.json`.
- Neu chay local nhanh tu `frontend/`, lenh `npm run start` se goi cung runtime server nay.
- Neu schema SQL thuc te khac gia dinh mac dinh, hay chinh mapping trong `frontend/src/services/supabase-config.js`.

## Import sinh vien tu Excel

- Tool moi doc file `.xlsx` hoac `.csv` va sync vao Supabase Auth + bang `profiles`.
- Chay kiem tra truoc:
  `cd backend && npm run import:students -- --file ..\\du-lieu\\students.xlsx --dry-run`
- Chay import that:
  `cd backend && npm run import:students -- --file ..\\du-lieu\\students.xlsx`
- Co the chi dinh worksheet neu can:
  `cd backend && npm run import:students -- --file ..\\du-lieu\\students.xlsx --sheet Sheet1`
- File mau nam tai [backend/tools/student-import/template.xlsx](/d:/Vuyp-AGILE/backend/tools/student-import/template.xlsx).
- Cac cot duoc ho tro linh hoat theo alias, nhung de de dung nhat nen dung:
  `mssv`, `name`, `gender`, `course`, `email`, `password`, `login_id`, `role`
- Neu file khong co cot `email`, tool se tu tao email theo `SETUP_DEFAULT_EMAIL_DOMAIN` hoac `SUPABASE_AUTH_IDENTITY_DOMAIN` trong `.env`.
- Neu file khong co cot `password`, tool se dung `SETUP_DEFAULT_PASSWORD` trong `.env`.
- Neu dong import co `role=admin` va khong co cot `password`, tool uu tien `SETUP_DEFAULT_ADMIN_PASSWORD`; neu bien nay khong co thi moi fallback ve `SETUP_DEFAULT_PASSWORD`.

## Bao mat cau hinh

- Khong commit `.env` hoac file chua credentials that su. Repo da co `.gitignore` va hook trong `.githooks/` de chan commit/push nham.
- Dung `.env.example` de chia se cau hinh mau, sau do tao file `.env` rieng tren may cua ban.
- `frontend/src/services/app-config.js` chi con la file tuong thich cho runtime, khong duoc luu key/secret trong file nay.
- Neu clone repo sang may khac, chay `git config core.hooksPath .githooks` trong thu muc du an de bat lai git hook cua repo.
