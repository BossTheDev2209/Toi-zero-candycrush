# TOIZero Getting Started

This guide assumes you are on Windows and have never run this project before.

## 1. Install Tools

Install Git from:

```text
https://git-scm.com/download/win
```

Install Bun in PowerShell:

```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

Restart PowerShell and verify:

```powershell
git --version
bun --version
```

For local judging, install a C/C++ compiler such as MSYS2 or MinGW and make sure these commands work:

```powershell
g++ --version
gcc --version
```

## 2. Get The Project

Clone the project:

```powershell
git clone <your-repo-url> TOIZERO
cd TOIZERO
```

If you already have the project:

```powershell
cd C:\Projects\TOIZERO
```

## 3. Install Packages

Run:

```powershell
bun install
```

This installs both the server and web dependencies.

## 4. Create Local Settings

Run:

```powershell
Copy-Item settings.example.json settings.json
```

Open `settings.json`.

For normal local use, you can leave TOI fields empty. For TOI PDF download, score sync, and official submit, fill:

```json
{
  "toi": {
    "baseUrl": "https://toi-coding.informatics.buu.ac.th/00-pre-toi",
    "cookie": "paste-your-cookie-here",
    "xsrf": "paste-your-xsrf-here",
    "extraHeaders": {}
  }
}
```

Never share or commit your real `cookie` or `xsrf`. The real `settings.json` is ignored by Git.

## 5. Start The Server

Open PowerShell window 1:

```powershell
cd C:\Projects\TOIZERO
bun run dev:server
```

Leave it open. The API should listen on:

```text
http://localhost:8787
```

## 6. Start The Web App

Open PowerShell window 2:

```powershell
cd C:\Projects\TOIZERO
bun run dev:web
```

Open the app:

```text
http://localhost:5173
```

## 7. Use The Problem Path

- Search by slug or title.
- Sort by slug, score, status, old solves, or unsolved first.
- Filter by all, unsolved, 80+, 100, or old.
- Hover a node and click `Mark old` if you solved it in a previous year.
- Click a node to open the coding workspace.

Marking a problem as old is only a visual and sorting marker. If the problem has `80+` points, it still counts toward qualification.

## 8. Read PDFs

On a problem workspace:

1. Click `Download PDF`.
2. Wait for the PDF to cache.
3. Use the `PDF` tab.

On the path page:

```text
Sync PDFs
```

downloads every missing PDF. If your TOI session expired, update `settings.json`.

## 9. Sync Scores

On the path page:

1. Open the qualification chip in the top-right.
2. Click `Sync from TOI`.
3. Wait for progress to finish.

The app scrapes the best score shown by TOI for each problem and stores it locally.

## 10. Write And Run Code

In the workspace:

1. Choose `C++` or `C`.
2. Write code.
3. Click `Save`.
4. Click `Run samples` or `Run all`.

Verdicts:

- `AC`: accepted
- `WA`: wrong answer
- `TLE`: time limit exceeded
- `RE`: runtime error
- `CE`: compile error

## 11. Submit To TOI

Click:

```text
Submit to TOI
```

This sends a real submission to the official TOI grader. Use it only when your code is ready.

## 12. Verify The Project

Run all server tests:

```powershell
bun --cwd server test
```

Build the web app:

```powershell
bun --cwd web build
```

## 13. Common Problems

### The browser says the API failed

Make sure the server terminal is still running:

```powershell
bun run dev:server
```

### PDF or score sync says the cookie expired

Your TOI login session expired. Log in to TOI again and refresh `cookie` / `xsrf` in `settings.json`.

### Local judge cannot compile

Check:

```powershell
g++ --version
gcc --version
```

If either command fails, install a compiler and restart PowerShell.

### The web port is busy

Close other Vite/Bun windows, or find the process using the port:

```powershell
netstat -ano | Select-String ":5173"
```

Then stop that process from Task Manager.

### The server port is busy

Check:

```powershell
netstat -ano | Select-String ":8787"
```

Stop the old process or change `apiPort` in `settings.json`.
