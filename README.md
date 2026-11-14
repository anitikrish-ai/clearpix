# CLEARPIX

Free, open-source, local-first image and text inspection/cleaning app. Web (Vite + React) and Windows desktop (Tauri), sharing one TypeScript processing engine in `src/engine`.

## Develop

```
npm install
npm run dev        # web app, http://localhost:1420
npm run tauri dev  # desktop shell (requires Rust + platform webview deps)
```

## Build

```
npm run build        # web build -> dist/
npm run tauri build  # desktop installer (run on the target OS)
```

Everything runs in the browser/webview — no uploads, no login, no tracking.
