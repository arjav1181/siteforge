import { findBrowser, launchBrowser } from "../browser.js";
import { log } from "../log.js";

export const AUDIT_HELP = `siteforge audit — health-check a page the way visitors see it.

Usage:
  siteforge audit <url> [options]

Checks every viewport for horizontal overflow (with culprits), missing
<title>/meta description/lang, images without alt, console errors, and
assets over the weight budget.

Options:
  --widths <list>     Comma-separated viewport widths (default: 375,768,1440)
  --budget <kb>       Flag assets heavier than this (default: 500)
  --browser <path>    Chrome/Chromium binary (default: auto-detect)
  --fix               Auto-fix lang/alt/meta on a LOCAL html file (backs up .bak)

Exit code is 1 when horizontal overflow is found, 0 otherwise.
Warnings (meta/alt/console/weight) never fail the run.

Examples:
  siteforge audit http://localhost:3000
  siteforge audit https://my-site.vercel.app --widths 390,1280
`;

export interface AuditOptions {
  url: string;
  widths: number[];
  budgetKb: number;
  browser: string | null;
  fix: boolean;
}

/** Targeted, safe auto-fixes for local HTML files. Returns fixed HTML + log. */
export function fixHtml(html: string): { html: string; changes: string[] } {
  const changes: string[] = [];
  let out = html;
  if (/<html(?![^>]*\blang=)/i.test(out)) {
    out = out.replace(/<html/i, '<html lang="en"');
    changes.push('added lang="en" to <html>');
  }
  if (!/<meta[^>]*name=["']description["']/i.test(out) && /<head[^>]*>/i.test(out)) {
    out = out.replace(/<head[^>]*>/i, (m) => `${m}\n  <meta name="description" content="TODO: describe this page.">`);
    changes.push("added placeholder meta description");
  }
  out = out.replace(/<img(?![^>]*\balt=)[^>]*>/gi, (tag) => {
    const src = /src=["']([^"']+)["']/.exec(tag)?.[1] ?? "image";
    const alt = src.split("/").pop()?.replace(/\.[^.]*$/, "").replace(/[-_]+/g, " ") || "image";
    changes.push(`added alt="${alt}"`);
    return tag.replace(/<img/i, `<img alt="${alt}"`);
  });
  return { html: out, changes };
}

export function parseAuditArgs(argv: string[]): AuditOptions {
  const positional: string[] = [];
  const o: AuditOptions = { url: "", widths: [375, 768, 1440], budgetKb: 500, browser: null, fix: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`Missing value for ${a}`);
      return v;
    };
    switch (a) {
      case "--widths": {
        o.widths = next().split(",").map((s) => {
          const n = Number(s.trim());
          if (!Number.isFinite(n) || n <= 0) throw new Error("--widths must be positive widths");
          return Math.round(n);
        });
        break;
      }
      case "--budget": {
        const n = Number(next());
        if (!Number.isFinite(n) || n <= 0) throw new Error("--budget must be positive kilobytes");
        o.budgetKb = n;
        break;
      }
      case "--browser": o.browser = next(); break;
      case "--fix": o.fix = true; break;
      default:
        if (a.startsWith("-")) throw new Error(`Unknown option for audit: ${a}`);
        positional.push(a);
    }
  }
  if (positional.length === 0) throw new Error("Missing <url> argument.");
  if (positional.length > 1) throw new Error("Too many arguments for audit.");
  o.url = positional[0];
  return o;
}

interface OverflowCulprit {
  tag: string;
  cls: string;
  overPx: number;
}

interface ViewportReport {
  width: number;
  overflowPx: number;
  culprits: OverflowCulprit[];
}

export function findCulprits(
  entries: { tag: string; cls: string; right: number }[],
  viewportWidth: number,
): OverflowCulprit[] {
  return entries
    .filter((e) => e.right > viewportWidth + 1)
    .map((e) => ({ tag: e.tag, cls: e.cls, overPx: Math.round(e.right - viewportWidth) }))
    .sort((a, b) => b.overPx - a.overPx)
    .slice(0, 10);
}

export interface AuditResult {
  clean: boolean;
  errors: string[];
  warnings: string[];
}

export async function runAudit(o: AuditOptions): Promise<AuditResult> {
  let url = o.url;
  if (o.fix) {
    const { existsSync, readFileSync, writeFileSync, copyFileSync } = await import("node:fs");
    const file = url.startsWith("file://") ? url.slice("file://".length) : url;
    if (!existsSync(file) || !/\.html?$/i.test(file)) {
      throw new Error("--fix only works on a local .html file.");
    }
    const src = readFileSync(file, "utf8");
    const { html, changes } = fixHtml(src);
    if (changes.length === 0) {
      log.ok("Nothing to auto-fix.");
    } else {
      copyFileSync(file, file + ".bak");
      writeFileSync(file, html);
      for (const c of changes) log.ok(`fixed: ${c} (backup: ${file}.bak)`);
    }
    url = "file://" + file;
  }
  const exe = await findBrowser(o.browser ?? undefined);
  const browser = await launchBrowser(exe);
  const errors: string[] = [];
  const warnings: string[] = [];
  let clean = true;

  try {
    for (const width of o.widths) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      const consoleErrors: string[] = [];
      page.on("pageerror", (e) => consoleErrors.push(String(e).split("\n")[0]));
      page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 160)); });

      log.step(`Auditing @ ${width}px...`);
      try {
        await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      } catch {
        await page.goto(url, { waitUntil: "load", timeout: 30000 });
      }
      await page.waitForTimeout(1200);

      const data = await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll("body *")).map((el) => {
          const r = (el as HTMLElement).getBoundingClientRect();
          return {
            tag: el.tagName.toLowerCase(),
            cls: String((el as HTMLElement).className ?? "").slice(0, 60),
            right: r.right,
          };
        });
        const imgs = Array.from(document.querySelectorAll("img")).map((img) => ({
          alt: img.getAttribute("alt"),
          src: img.currentSrc || img.src,
        }));
        const resources = performance.getEntriesByType("resource").map((r) => ({
          name: (r as PerformanceResourceTiming).name,
          size: (r as PerformanceResourceTiming).transferSize ?? 0,
        }));
        return {
          title: document.title,
          desc: document.querySelector('meta[name="description"]')?.getAttribute("content") ?? "",
          lang: document.documentElement.lang,
          docOverflow: document.documentElement.scrollWidth - window.innerWidth,
          els, imgs, resources,
        };
      });

      const report: ViewportReport = {
        width,
        overflowPx: Math.max(0, Math.round(data.docOverflow)),
        culprits: findCulprits(data.els, width),
      };
      if (report.overflowPx > 0) {
        clean = false;
        errors.push(`[${width}px] horizontal overflow: +${report.overflowPx}px`);
        for (const c of report.culprits) {
          errors.push(`  <${c.tag}> +${c.overPx}px  ${c.cls}`);
        }
      } else {
        log.ok(`[${width}px] no horizontal overflow`);
      }

      if (width === o.widths[0]) {
        if (!data.title) warnings.push("missing <title>");
        if (!data.desc) warnings.push("missing meta description");
        if (!data.lang) warnings.push("missing <html lang>");
        const noAlt = data.imgs.filter((i) => !i.alt);
        if (noAlt.length) warnings.push(`${noAlt.length} image(s) without alt (e.g. ${noAlt[0].src.slice(0, 80)})`);
        for (const r of data.resources) {
          if (r.size > o.budgetKb * 1024) {
            warnings.push(`heavy asset ${(r.size / 1048576).toFixed(1)}MB: ${r.name.slice(0, 90)}`);
          }
        }
      }
      for (const ce of [...new Set(consoleErrors)].slice(0, 5)) warnings.push(`console: ${ce}`);
      await context.close();
    }
  } finally {
    await browser.close();
  }

  log.blank();
  for (const e of errors) log.err(e);
  for (const w of warnings) log.warn(w);
  if (clean && warnings.length === 0) log.ok("All clean.");
  else if (clean) log.ok("No overflow — warnings above are advisory.");
  return { clean, errors, warnings };
}
