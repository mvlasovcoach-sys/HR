
# SPA2099 HR — Self-host Inter Variable (kit)

This kit helps you download and self-host **Inter Variable** font files (roman & italic) and wire them into your project.

## What you will get
- `download-fonts.sh` — shell script (macOS/Linux, WSL)
- `download-fonts.ps1` — PowerShell script (Windows)
- `snippets/tokens.css.append.css` — `@font-face` & CSS tokens to paste
- `snippets/head-preload.html` — `<link rel="preload" ...>` snippet for HTML head

> Fonts are **not bundled** here. The scripts will fetch them from official Inter sources.

## 1) Download the font files

### macOS/Linux/WSL
```bash
chmod +x download-fonts.sh
./download-fonts.sh
```

### Windows (PowerShell)
Right-click `download-fonts.ps1` → Run with PowerShell (or):
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\download-fonts.ps1
```

This will create (or reuse) `HR/assets/fonts/` and download:
- `Inter-Variable.woff2` (roman)
- `Inter-Variable-Italic.woff2` (italic)
- `OFL.txt` (SIL Open Font License 1.1)

## 2) Wire it into your project

### 2.1 Add `@font-face` & tokens
Append the contents of `snippets/tokens.css.append.css` to your `HR/assets/css/tokens.css`
(or merge it appropriately).

### 2.2 Preload in HTML head
Insert the snippet from `snippets/head-preload.html` near the top of `<head>` in each page
(e.g., `HR/Corporate.html`), above your main CSS tokens include.

### 2.3 Remove Google Fonts includes
Remove any `<link rel="preconnect" href="https://fonts.googleapis.com">`,
`<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` and
`<link href="https://fonts.googleapis.com/...">` lines.

### 2.4 CSP
Ensure your CSP allows local fonts:
```
font-src 'self' data:;
```

## 3) Commit & push
```bash
git checkout -b feat/self-host-inter
git add HR/assets/fonts        HR/assets/css/tokens.css        HR/Corporate.html HR/Analytics.html HR/Summary.html
git commit -m "chore(fonts): self-host Inter Variable (.woff2) with preload + tokens"
git push -u origin feat/self-host-inter
```

## 4) Verify
- No requests to `fonts.googleapis.com` / `fonts.gstatic.com`
- `Inter-Variable.woff2` loaded from your repo (DevTools → Network)
- No CSP violations
- Visual parity preserved

---

### Sources
- Inter project: https://github.com/rsms/inter
- Official site: https://rsms.me/inter/
- License: SIL Open Font License 1.1
