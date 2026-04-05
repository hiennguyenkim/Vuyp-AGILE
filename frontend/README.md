# Frontend

Frontend hien dang dung HTML, CSS va JavaScript thuan.

- `public/`: HTML tinh va entry point de serve truc tiep.
- `src/assets/`: anh va CSS dung chung.
- `src/pages/`: JS/CSS theo tung man hinh.
- `src/services/`: auth, Supabase, env va storage.
- `src/utils/`: helper dung chung.

Chay nhanh frontend:

```bash
cd frontend
npm run start
```

Lenh tren chi la wrapper goi runtime server cua backend de frontend co the truy cap:

- `frontend/public/` cho HTML
- `frontend/src/` cho JS/CSS hien tai
- `.env` o root repo qua endpoint runtime `/app-env.json`

Neu muon chay theo kieu deploy/runtime chinh:

```bash
cd backend
npm start
```
