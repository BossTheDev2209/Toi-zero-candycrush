# TOIZero

TOIZero is a single-user local practice app for Thailand Olympiad in Informatics preparation. It lets you browse TOI Zero problems, read cached PDFs, write C or C++ in the browser, run code locally, and submit to the official TOI grader when your `settings.json` has a valid TOI session.

The visual system follows [info/DESIGN.md](info/DESIGN.md). The main implementation history lives in [docs/superpowers/plans/](docs/superpowers/plans/).

## What You Need

- Windows 10 or 11
- Bun 1.3 or newer
- `g++` and `gcc` on your PATH if you want local judging
- A TOI login cookie and XSRF token only if you want PDF sync, score sync, or official submission

## Install Bun

Open PowerShell and run:

```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

Close PowerShell, open it again, then check:

```powershell
bun --version
```

## Clone And Install

```powershell
git clone <your-repo-url> TOIZERO
cd TOIZERO
bun install
```

If the project is already on your machine:

```powershell
cd C:\Projects\TOIZERO
bun install
```

## Configure Settings

Create your local settings file:

```powershell
Copy-Item settings.example.json settings.json
```

Open `settings.json` in an editor. For basic local use, the defaults are enough. For TOI integration, fill these fields:

```json
{
  "toi": {
    "baseUrl": "https://toi-coding.informatics.buu.ac.th/00-pre-toi",
    "cookie": "",
    "xsrf": "",
    "extraHeaders": {}
  }
}
```

Do not commit `settings.json`. It is gitignored because it can contain your TOI session.

## Start The App

Use two PowerShell windows.

Window 1:

```powershell
bun run dev:server
```

Expected:

```text
TOIZero API listening on http://localhost:8787
```

Window 2:

```powershell
bun run dev:web
```

Open:

```text
http://localhost:5173
```

## Common Workflows

- **Browse problems:** open the path page at `http://localhost:5173`.
- **Sort/filter problems:** use the Sort and Filter pills under search. Sorting stays inside A1, A2, and A3.
- **Mark old solves:** hover a node and click `Mark old`. This tags problems solved in a previous year but does not remove them from qualification counts.
- **Open workspace:** click a node.
- **Download one PDF:** open a TOI problem and click `Download PDF`.
- **Download missing PDFs:** click `Sync PDFs` on the path page.
- **Sync scores:** open the qualification chip and click `Sync from TOI`.
- **Run code locally:** write C/C++, then click `Run samples` or `Run all`.
- **Submit to TOI:** click `Submit to TOI`. This sends a real submission to the official grader.

## Checks

Run server tests:

```powershell
bun --cwd server test
```

Build the frontend:

```powershell
bun --cwd web build
```

## Troubleshooting

- **`bun` not found:** close and reopen PowerShell after installing Bun.
- **Port already used:** stop the old `bun` process or change `apiPort` / `port` in `settings.json`.
- **PDF sync says cookie expired:** log in to TOI again and update `settings.json`.
- **Submit fails:** your TOI cookie or XSRF token is probably stale.
- **Compiler errors before your code runs:** check that `g++` and `gcc` are installed and on PATH.
- **No problems show up:** make sure the server is running on `http://localhost:8787`.

More detailed beginner setup is in [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md).
