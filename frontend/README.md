# Frontend (React + Tailwind)

Unified UI for Chat, Notes, and Files. Authentication and AES-GCM encryption are preserved from chatai-gcp. The frontend encryption key hash is stored in `localStorage.aes_key_hash` and can be managed from the Settings page.

## Routes
- `/` Portal — choose Chat, Notes, or Files.
- `/chat` — the chat experience.
- `/note` — notes (minimal editor: title + encrypted content).
- `/file` — files (list, upload from file or URL, rename, delete, download, toggle share).
- `/setting` — manage `localStorage.aes_key_hash` and sign out.

## Development
In the `frontend/` directory:

- `npm start` — start dev server at http://localhost:3000
- `npm test` — run tests once (or with watch mode)
- `npm run build` — production build to `build/`

The app expects the backend to be available and `REACT_APP_API_URL` configured if not same-origin.

## Encryption Key
- The app uses `localStorage.aes_key_hash` as the presence flag and key hash.
- Set or update it from the Settings page (`/setting`). The app prompts for a key when needed.

## Notes
- This project was bootstrapped with Create React App; scripts and tooling are unchanged.
