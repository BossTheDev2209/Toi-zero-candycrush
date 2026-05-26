import { Link } from "react-router-dom";
import { EyebrowLabel } from "../components/EyebrowLabel";

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
  ["Previous-year marks", "Hover a node and mark previous-year when you solved it before. It is a visual note only; it does not change qualification counts."],
  ["Run code", "Open a problem, write C or C++, then run samples before running all local tests."],
  ["Submit to TOI", "Submit sends a real official TOI submission. After submit, open the TOI submissions page to confirm the verdict."],
];

const troubleshooting = [
  ["Submit does nothing on TOI", "Your cookie or XSRF token is probably expired, or TOI returned a login page. Refresh both values in settings.json and submit again."],
  ["PDF download fails", "Check that the TOI base URL in settings.json matches the problem source URL and that your cookie is fresh."],
  ["Web cannot reach API", "Make sure the server terminal is still running before starting or refreshing the web page."],
  ["Bun command not found", "Restart PowerShell after installing Bun. If it still fails, reinstall Bun and check your PATH."],
  ["Scores look old", "Run Sync Scores again. Previous-year marks are manual notes and do not replace TOI score sync."],
];

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="mt-4 overflow-x-auto rounded-[24px] border border-[var(--color-dust)] bg-[var(--color-bone)] p-5 text-[13px] leading-6 text-[var(--color-ink)]">
      <code>{children}</code>
    </pre>
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
            <a href="#quick-start" className="rounded-full px-3 py-2 hover:bg-[var(--color-bone)]">Quick start</a>
            <a href="#workflow" className="rounded-full px-3 py-2 hover:bg-[var(--color-bone)]">Using the web</a>
            <a href="#submit" className="rounded-full px-3 py-2 hover:bg-[var(--color-bone)]">TOI submit</a>
            <a href="#troubleshooting" className="rounded-full px-3 py-2 hover:bg-[var(--color-bone)]">Troubleshooting</a>
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

          <section id="workflow" className="rounded-[40px] border border-[var(--color-dust)] bg-[var(--color-lifted)] p-6 md:p-8">
            <div className="mb-6 flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-[var(--color-signal-light)]" />
              <h2 className="text-[32px] leading-9">Using the web</h2>
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
