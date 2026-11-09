import { Controller, Get, Header, Param, ParseUUIDPipe } from "@nestjs/common"
import { ApiTags } from "@nestjs/swagger"
import { PUBLIC_JOB_WHERE } from "../jobs/public-job"
import { PrismaService } from "../prisma/prisma.service"
import { careersWidgetScript, jobsSitemap } from "./public-site"

const uuid = new ParseUUIDPipe({ version: undefined })
const siteUrl = () => (process.env.FRONTEND_URL || "http://localhost:5174").replace(/\/+$/, "")

/** Unauthenticated, cacheable endpoints for search engines and company websites. */
@ApiTags("Public site")
@Controller("public")
export class PublicSiteController {
  constructor(private readonly prisma: PrismaService) {}

  /** Every open job's public page (for Google Search Console / robots.txt). */
  @Get("sitemap.xml")
  @Header("Content-Type", "application/xml; charset=utf-8")
  @Header("Cache-Control", "public, max-age=900")
  async sitemap() {
    const jobs = await this.prisma.job.findMany({
      where: PUBLIC_JOB_WHERE,
      select: { id: true, publishedAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 50_000,
    })
    return jobsSitemap(
      siteUrl(),
      jobs.map((j) => ({ id: j.id, updatedAt: j.publishedAt ?? j.createdAt }))
    )
  }

  /**
   * Careers widget: `<div id="hyrr-jobs"></div><script src=".../api/public/companies/<id>/jobs.js" async></script>`
   * renders the company's open jobs, each linking to its public Hyrr page.
   */
  @Get("companies/:id/jobs.js")
  @Header("Content-Type", "application/javascript; charset=utf-8")
  @Header("Cache-Control", "public, max-age=900")
  async widget(@Param("id", uuid) id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      select: { name: true, status: true },
    })
    const jobs =
      company && company.status !== "SUSPENDED"
        ? await this.prisma.job.findMany({
            where: { ...PUBLIC_JOB_WHERE, companyId: id },
            select: { id: true, title: true, location: true, remote: true, type: true },
            orderBy: { publishedAt: "desc" },
            take: 100,
          })
        : []
    return careersWidgetScript(siteUrl(), company?.name ?? "", jobs)
  }
}
