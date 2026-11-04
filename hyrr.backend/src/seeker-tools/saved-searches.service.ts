import { HttpStatus, Injectable } from "@nestjs/common"
import { Prisma } from "@prisma/client"
import { AppException, NotFoundAppException } from "../core/exceptions/app-exception"
import { PrismaService } from "../prisma/prisma.service"
import { CreateSavedSearchDto, UpdateSavedSearchDto } from "./dtos/saved-search.dto"

export const MAX_SAVED_SEARCHES = 20

/** Keeps only the known filter keys with defined values (stored as JSON). */
function cleanFilters(filters: Record<string, any> | undefined): Prisma.InputJsonObject {
  const out: Record<string, any> = {}
  for (const key of ["location", "type", "remote", "categoryId", "tab"]) {
    const value = filters?.[key]
    if (value !== undefined && value !== null && value !== "") out[key] = value
  }
  return out
}

@Injectable()
export class SavedSearchesService {
  constructor(private prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.savedSearch.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: MAX_SAVED_SEARCHES * 2,
    })
  }

  async create(userId: string, dto: CreateSavedSearchDto) {
    const count = await this.prisma.savedSearch.count({ where: { userId } })
    if (count >= MAX_SAVED_SEARCHES)
      throw new AppException(
        `You can keep up to ${MAX_SAVED_SEARCHES} saved searches`,
        HttpStatus.CONFLICT,
        "SAVED_SEARCH_LIMIT"
      )
    return this.prisma.savedSearch.create({
      data: {
        userId,
        name: dto.name,
        query: dto.query || null,
        filters: cleanFilters(dto.filters),
      },
    })
  }

  async update(userId: string, id: string, dto: UpdateSavedSearchDto) {
    await this.owned(userId, id)
    const data: Prisma.SavedSearchUpdateInput = {}
    if (dto.name !== undefined) data.name = dto.name
    if (dto.query !== undefined) data.query = dto.query || null
    if (dto.filters !== undefined) data.filters = cleanFilters(dto.filters)
    return this.prisma.savedSearch.update({ where: { id }, data })
  }

  async remove(userId: string, id: string) {
    await this.owned(userId, id)
    await this.prisma.savedSearch.delete({ where: { id } })
    return { success: true }
  }

  private async owned(userId: string, id: string) {
    const row = await this.prisma.savedSearch.findFirst({
      where: { id, userId },
      select: { id: true },
    })
    if (!row) throw new NotFoundAppException("Saved search not found", "SAVED_SEARCH_NOT_FOUND")
    return row
  }
}
