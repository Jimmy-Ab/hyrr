/** Sitemap XML and the careers widget script. Pure; unit-tested. */

const xml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

export function jobsSitemap(site: string, jobs: { id: string; updatedAt: Date }[]) {
  const urls = jobs
    .map(
      (j) =>
        `  <url><loc>${xml(`${site}/jobs/${j.id}`)}</loc><lastmod>${j.updatedAt.toISOString().slice(0, 10)}</lastmod></url>`
    )
    .join("\n")
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

const TYPE: Record<string, string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  CONTRACT: "Contract",
  REMOTE: "Remote",
}

/**
 * Self-contained widget. Data is embedded as JSON (escaped for a script context) and rendered with
 * textContent, so job text can never inject markup into the host page.
 */
export function careersWidgetScript(
  site: string,
  company: string,
  jobs: { id: string; title: string; location: string | null; remote: boolean; type: string }[]
) {
  const data = JSON.stringify({
    site,
    company,
    jobs: jobs.map((j) => ({
      title: j.title,
      meta: [j.remote ? "Remote" : j.location, TYPE[j.type] ?? j.type].filter(Boolean).join(" · "),
      url: `${site}/jobs/${j.id}`,
    })),
  }).replace(/</g, "\\u003c")
  return `(function () {
  var d = ${data};
  var host = document.getElementById("hyrr-jobs");
  if (!host) return;
  host.innerHTML = "";
  var list = document.createElement("ul");
  list.style.cssText = "list-style:none;margin:0;padding:0;font-family:inherit";
  if (!d.jobs.length) {
    var empty = document.createElement("li");
    empty.textContent = "No open positions right now.";
    list.appendChild(empty);
  }
  d.jobs.forEach(function (j) {
    var li = document.createElement("li");
    li.style.cssText = "padding:12px 0;border-bottom:1px solid rgba(127,127,127,.25)";
    var a = document.createElement("a");
    a.href = j.url; a.target = "_blank"; a.rel = "noopener";
    a.textContent = j.title;
    a.style.cssText = "font-weight:600;text-decoration:none;color:inherit";
    var meta = document.createElement("div");
    meta.textContent = j.meta;
    meta.style.cssText = "font-size:.85em;opacity:.7;margin-top:2px";
    li.appendChild(a); li.appendChild(meta); list.appendChild(li);
  });
  var credit = document.createElement("div");
  credit.style.cssText = "font-size:.75em;opacity:.6;margin-top:8px";
  var c = document.createElement("a");
  c.href = d.site; c.target = "_blank"; c.rel = "noopener"; c.textContent = "Jobs powered by Hyrr";
  c.style.color = "inherit";
  credit.appendChild(c);
  host.appendChild(list); host.appendChild(credit);
})();
`
}
