const fs = require("node:fs");
const path = require("node:path");

const dir = path.join(process.cwd(), "data", "briefs");
const files = fs.readdirSync(dir).filter((file) => file.endsWith(".json")).sort();
const requested = process.env.BRIEF_DATE ? `${process.env.BRIEF_DATE}.json` : files.at(-1);
const target = requested && files.includes(requested) ? requested : files.at(-1);

if (!target) {
  throw new Error("No brief file found for notification preview");
}

const brief = JSON.parse(fs.readFileSync(path.join(dir, target), "utf8"));
const preview = brief.items.slice(0, 3).map((item) => `${item.title} · ${item.source_domain}`).join("\n") || "今天没有足够强信号。";

fs.appendFileSync(process.env.GITHUB_ENV, `BRIEF_DATE=${brief.date}\n`);
fs.appendFileSync(process.env.GITHUB_ENV, `BRIEF_ONE_LINER<<YQN_EOF\n${brief.one_liner}\nYQN_EOF\n`);
fs.appendFileSync(process.env.GITHUB_ENV, `BRIEF_PREVIEW<<YQN_EOF\n${preview}\nYQN_EOF\n`);
