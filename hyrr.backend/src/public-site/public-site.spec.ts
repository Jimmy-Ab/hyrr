import { careersWidgetScript, jobsSitemap } from "./public-site"

describe("public site", () => {
  it("sitemap lists job pages with lastmod", () => {
    const xml = jobsSitemap("https://jobs.hyrr.app", [
      { id: "j1", updatedAt: new Date("2026-11-10T08:00:00Z") },
    ])
    expect(xml).toContain("<loc>https://jobs.hyrr.app/jobs/j1</loc><lastmod>2026-11-10</lastmod>")
    expect(xml.startsWith('<?xml version="1.0"')).toBe(true)
  })

  it("widget embeds data safely and links to public pages", () => {
    const js = careersWidgetScript("https://jobs.hyrr.app", "Acme", [
      {
        id: "j1",
        title: "</script><img src=x onerror=alert(1)>",
        location: "Berlin",
        remote: false,
        type: "FULL_TIME",
      },
    ])
    expect(js).not.toContain("</script>")
    expect(js).toContain("\\u003c/script>")
    expect(js).toContain("https://jobs.hyrr.app/jobs/j1")
    expect(js).toContain("textContent")
    // It runs: renders into #hyrr-jobs without throwing.
    const host = {
      innerHTML: "x",
      children: [] as any[],
      appendChild(c: any) {
        this.children.push(c)
      },
    }
    const el = () => ({
      style: {} as any,
      children: [] as any[],
      appendChild(c: any) {
        this.children.push(c)
      },
    })
    const doc = { getElementById: () => host, createElement: el }
    new Function("document", js)(doc)
    expect(host.children).toHaveLength(2)
    expect(host.children[0].children[0].children[0].textContent).toContain("</script>")
  })
})
