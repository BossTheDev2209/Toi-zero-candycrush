# TOIZero

Local TOI Zero practice app for browsing problems, running code, syncing TOI scores, and submitting to TOI.

## Quick Setup

Download or clone this repo, open PowerShell in the project folder, then run:

```powershell
powershell -ExecutionPolicy Bypass -File .\setup.ps1 -NoStart
```

That script checks Bun, installs packages, creates `settings.json` if needed, and checks for `gcc` / `g++`.

## Start The App

Open two PowerShell windows in the project folder.

Window 1:

```powershell
bun run dev:server
```

Window 2:

```powershell
bun run dev:web
```

Then open:

```text
http://localhost:5173
```

Enjoy.

## TOI Login

Open:

```text
http://localhost:5173/settings
```

Enter TOI username/password, then click **Save and re-login**. The app stores the local session in `settings.json`, which is gitignored.

## Common Fixes

| Problem | Fix |
| --- | --- |
| `bun` not found after setup installs it | Close PowerShell, open it again, then rerun setup. |
| `bun: command not found: vite` | Run `powershell -ExecutionPolicy Bypass -File .\setup.ps1 -NoStart` again. |
| TOI sync does nothing | Go to `/settings`, click **Save and re-login**, then try sync again. |
| Compiler errors before code runs | Install `gcc` and `g++`, then reopen PowerShell. |

Never commit or share `settings.json`; it can contain TOI credentials, cookies, and API keys.
