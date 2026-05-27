import { useState } from "react";
import { Link } from "react-router-dom";
import { EyebrowLabel } from "../components/EyebrowLabel";
import { DOC_SECTIONS } from "../lib/docsIndex";

type Step = {
  title: string;
  body: string;
  code?: string;
};

const quickStart: Step[] = [
  {
    title: "Install tools",
    body: "Install Git and Bun first. Restart PowerShell after installing so the commands are on PATH.",
    code: "git --version\nbun --version",
  },
  {
    title: "Clone and install",
    body: "Put the project anywhere you like. This example uses a simple C:\\Projects folder.",
    code: "cd C:\\Projects\ngit clone <your-repo-url> TOIZERO\ncd TOIZERO\nbun install",
  },
  {
    title: "Configure TOI login",
    body: "Create settings.json from the sample if needed, then paste your own TOI cookie and XSRF token. Never share those values.",
    code: "Copy-Item settings.example.json settings.json\nnotepad settings.json",
  },
  {
    title: "Start the app",
    body: "Use two PowerShell windows: one for the API, one for the web UI.",
    code: "bun --cwd server dev\nbun --cwd web dev",
  },
];

const workflows = [
  ["Sync PDFs", "Use Sync PDFs on the path page to cache all TOI statements locally. Open a problem to download one PDF at a time."],
  ["Sync scores", "Use Sync Scores after logging into TOI in settings.json. Scores of 80 or more count toward qualification."],
  ["Sort and filter", "Use the path toolbar to sort inside A1, A2, and A3. Filters dim nodes instead of removing them so the path shape stays stable."],
  ["Counts (นับ / ไม่นับ)", "Some TOI problems do not count toward your qualification milestone even if you score 80+. Hover a node to toggle counts manually. Uncounted nodes show a ไม่นับ badge and are excluded from the A1 and A2+A3 progress totals."],
  ["Counts auto-sync (manual cookie)", "Use POST /api/toi/sync-counts. Reads the TOI overview using the server cookie, parses the นับ column, and updates every problem in one shot. Requires fresh cookie in settings.json."],
  ["Counts auto-sync (browser tab)", "If your server cookie is expired but you are still logged in on TOI in chrome, open the TOI overview tab, open DevTools console, and paste the snippet from the troubleshooting section. It scrapes the table client-side and POSTs results to localhost. No cookie refresh needed."],
  ["Run code", "Open a problem, write C, C++, or Python, then run samples before running all local tests."],
  ["Download code", "Use Download in the workspace to save the current editor content as a .cpp, .c, or .py file named after the problem slug."],
  ["Submit to TOI", "Submit sends a real official TOI submission. After submit, open the TOI submissions page to confirm the verdict."],
];

const troubleshooting = [
  ["Submit does nothing on TOI", "Your cookie or XSRF token is probably expired, or TOI returned a login page. Refresh both values in settings.json and submit again."],
  ["PDF download fails", "Check that the TOI base URL in settings.json matches the problem source URL and that your cookie is fresh."],
  ["Web cannot reach API", "Make sure the server terminal is still running before starting or refreshing the web page."],
  ["Bun command not found", "Restart PowerShell after installing Bun. If it still fails, reinstall Bun and check your PATH."],
  ["Scores look old", "Run Sync Scores again. Toggling counts only affects qualification; it does not change the displayed score."],
  ["Counts auto-sync from browser console", "Open the TOI overview tab in chrome (you must be logged in). Open DevTools console (F12) and paste:\n\n(async()=>{const c={};for(const tr of document.querySelectorAll('table tr')){const t=tr.querySelectorAll('td');if(t.length<7)continue;const s=tr.querySelector('a[href*=\"/tasks/\"]')?.href?.match(/\\/tasks\\/([^\\/]+)/)?.[1];if(!s)continue;const v=t[6]?.innerText.trim();if(v==='นับ')c[s]=1;else if(v==='ไม่นับ')c[s]=0;}const r=await fetch('http://localhost:8787/api/toi/counts-bulk',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({counts:c})});console.log(await r.json());})();\n\nThis bypasses cookie expiry - it uses your live chrome session directly."],
];

function CodeBlock({ children }: { children: string }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    function legacyCopy() {
      const textarea = document.createElement("textarea");
      textarea.value = children;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const ok = document.execCommand("copy");
      textarea.remove();
      if (!ok) throw new Error("copy failed");
    }

    try {
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(children);
        } catch {
          legacyCopy();
        }
      } else {
        legacyCopy();
      }
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
    window.setTimeout(() => setCopyState("idle"), 1400);
  }

  return (
    <div className="relative mt-4">
      <button
        type="button"
        onClick={copy}
        className="motion-press absolute right-3 top-3 rounded-full border border-[var(--color-dust)] bg-[var(--color-lifted)] px-3 py-1 text-[11px] font-bold text-[var(--color-ink)]"
      >
        {copyState === "copied" ? "Copied" : copyState === "failed" ? "Failed" : "Copy"}
      </button>
      <pre className="overflow-x-auto rounded-[24px] border border-[var(--color-dust)] bg-[var(--color-bone)] p-5 pr-24 text-[13px] leading-6 text-[var(--color-ink)]">
        <code>{children}</code>
      </pre>
    </div>
  );
}

function NumberBadge({ value }: { value: number }) {
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--color-dust)] bg-[var(--color-lifted)] text-sm font-bold text-[var(--color-ink)]">
      {value}
    </span>
  );
}

export function DocsPage() {
  return (
    <main className="mx-auto max-w-[1180px] px-6 pt-32">
      <section className="mb-12">
        <EyebrowLabel>Docs</EyebrowLabel>
        <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="max-w-[760px] text-[52px] leading-[0.98] md:text-[64px]">Run TOIZero from zero.</h1>
            <p className="mt-5 max-w-[680px] text-lg text-[var(--color-slate)]">
              Beginner setup, daily workflow, and the exact places to check when TOI submit or sync feels silent.
            </p>
          </div>
          <Link
            to="/"
            className="motion-press inline-flex w-fit items-center rounded-full border-[1.5px] border-[var(--color-ink)] px-6 py-2 font-medium text-[var(--color-ink)]"
          >
            Back to path
          </Link>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        <aside className="h-fit rounded-[32px] border border-[var(--color-dust)] bg-[var(--color-lifted)] p-5 lg:sticky lg:top-28">
          <div className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--color-slate)]">On this page</div>
          <nav className="mt-4 grid gap-2 text-sm font-semibold text-[var(--color-ink)]">
            {DOC_SECTIONS.map((section) => (
              <a key={section.anchor} href={`#${section.anchor}`} className="rounded-full px-3 py-2 hover:bg-[var(--color-bone)]">{section.title}</a>
            ))}
          </nav>
        </aside>

        <div className="space-y-8">
          <section id="quick-start" className="rounded-[40px] border border-[var(--color-dust)] bg-[var(--color-lifted)] p-6 md:p-8">
            <div className="mb-6 flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-[var(--color-signal-light)]" />
              <h2 className="text-[32px] leading-9">Quick start</h2>
            </div>
            <div className="grid gap-5">
              {quickStart.map((step, index) => (
                <article key={step.title} className="rounded-[28px] border border-[var(--color-dust)] bg-[var(--color-canvas)] p-5">
                  <div className="flex gap-4">
                    <NumberBadge value={index + 1} />
                    <div>
                      <h3 className="text-[22px] leading-7">{step.title}</h3>
                      <p className="mt-2 text-[15px] text-[var(--color-slate)]">{step.body}</p>
                    </div>
                  </div>
                  {step.code && <CodeBlock>{step.code}</CodeBlock>}
                </article>
              ))}
            </div>
          </section>

          <section id="workflows" className="rounded-[40px] border border-[var(--color-dust)] bg-[var(--color-lifted)] p-6 md:p-8">
            <div className="mb-6 flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-[var(--color-signal-light)]" />
              <h2 className="text-[32px] leading-9">Workflows</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {workflows.map(([title, body]) => (
                <article key={title} className="rounded-[28px] border border-[var(--color-dust)] bg-[var(--color-canvas)] p-5">
                  <h3 className="text-[22px] leading-7">{title}</h3>
                  <p className="mt-2 text-[15px] text-[var(--color-slate)]">{body}</p>
                </article>
              ))}
            </div>
          </section>

          <section id="submit" className="rounded-[40px] border border-[var(--color-dust)] bg-[var(--color-lifted)] p-6 md:p-8">
            <div className="mb-6 flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-[var(--color-signal-light)]" />
              <h2 className="text-[32px] leading-9">TOI submit</h2>
            </div>
            <div className="grid gap-5">
              <p className="text-[16px] text-[var(--color-slate)]">
                TOIZero sends your current editor code to the official grader. It cannot guarantee a verdict until TOI accepts the session and records a submission.
              </p>
              <CodeBlock>{`1. Open a problem.
2. Run samples locally.
3. Click Submit to TOI.
4. Confirm the browser prompt.
5. Click Open TOI submissions and check the official verdict.`}</CodeBlock>
              <p className="rounded-[28px] border border-[var(--color-dust)] bg-[var(--color-canvas)] p-5 text-[15px] text-[var(--color-slate)]">
                If TOI returns a login page or XSRF rejection, TOIZero now shows an error. Refresh the cookie and XSRF fields in settings.json. Do not paste those values into chat or commit them.
              </p>
            </div>
          </section>

          <section id="troubleshooting" className="rounded-[40px] border border-[var(--color-dust)] bg-[var(--color-lifted)] p-6 md:p-8">
            <div className="mb-6 flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-[var(--color-signal-light)]" />
              <h2 className="text-[32px] leading-9">Troubleshooting</h2>
            </div>
            <div className="divide-y divide-[var(--color-dust)] rounded-[28px] border border-[var(--color-dust)] bg-[var(--color-canvas)]">
              {troubleshooting.map(([title, body]) => (
                <div key={title} className="p-5">
                  <h3 className="text-[20px] leading-7">{title}</h3>
                  <p className="mt-2 text-[15px] text-[var(--color-slate)]">{body}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
