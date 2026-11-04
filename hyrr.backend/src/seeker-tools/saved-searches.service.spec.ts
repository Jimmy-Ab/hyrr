import { PrismaClient } from "@prisma/client"
import { mockDeep } from "jest-mock-extended"
import { MAX_SAVED_SEARCHES, SavedSearchesService } from "./saved-searches.service"

describe("SavedSearchesService", () => {
  let prisma: any
  let service: SavedSearchesService

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>()
    service = new SavedSearchesService(prisma)
  })

  it("lists the user's searches newest first", async () => {
    prisma.savedSearch.findMany.mockResolvedValue([])
    await service.list("u1")
    expect(prisma.savedSearch.findMany.mock.calls[0][0]).toMatchObject({
      where: { userId: "u1" },
      orderBy: { createdAt: "desc" },
    })
  })

  it("creates a search with cleaned filters", async () => {
    prisma.savedSearch.count.mockResolvedValue(0)
    prisma.savedSearch.create.mockResolvedValue({ id: "s1" })
    await service.create("u1", {
      name: "Remote React",
      query: "",
      filters: { remote: true, location: "", type: "FULL_TIME", tab: undefined },
    } as any)
    expect(prisma.savedSearch.create.mock.calls[0][0].data).toEqual({
      userId: "u1",
      name: "Remote React",
      query: null,
      filters: { remote: true, type: "FULL_TIME" },
    })
  })

  it(`rejects more than ${MAX_SAVED_SEARCHES} with 409 SAVED_SEARCH_LIMIT`, async () => {
    prisma.savedSearch.count.mockResolvedValue(MAX_SAVED_SEARCHES)
    await expect(service.create("u1", { name: "x", filters: {} } as any)).rejects.toMatchObject({
      status: 409,
      errorCode: "SAVED_SEARCH_LIMIT",
    })
  })

  it("updates and deletes only the owner's searches", async () => {
    prisma.savedSearch.findFirst.mockResolvedValue(null)
    await expect(service.update("u2", "s1", { name: "y" })).rejects.toMatchObject({
      status: 404,
      errorCode: "SAVED_SEARCH_NOT_FOUND",
    })
    await expect(service.remove("u2", "s1")).rejects.toMatchObject({ status: 404 })
    expect(prisma.savedSearch.delete).not.toHaveBeenCalled()

    prisma.savedSearch.findFirst.mockResolvedValue({ id: "s1" })
    prisma.savedSearch.update.mockResolvedValue({ id: "s1" })
    await service.update("u1", "s1", { name: "y", query: null })
    expect(prisma.savedSearch.update.mock.calls[0][0].data).toEqual({ name: "y", query: null })
    expect(await service.remove("u1", "s1")).toEqual({ success: true })
    expect(prisma.savedSearch.delete).toHaveBeenCalledWith({ where: { id: "s1" } })
  })
})
