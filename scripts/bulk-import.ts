import { readFileSync } from "node:fs";

const path = process.argv[2] ?? "C:/Users/khunb/Downloads/toi-titles.json";
const raw = JSON.parse(readFileSync(path, "utf8")) as { slug: string; title: string }[];

const items = raw.map(({ slug, title }) => ({
  slug,
  title,
  statementMd: `See TOI: https://toi-coding.informatics.buu.ac.th/00-pre-toi/tasks/${slug}/statements/TH`,
  category: slug.split("-")[0]!,
  sourceUrl: `https://toi-coding.informatics.buu.ac.th/00-pre-toi/tasks/${slug}/description`,
}));

const res = await fetch("http://localhost:8787/api/problems/bulk", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(items),
});
console.log(res.status, await res.text());
