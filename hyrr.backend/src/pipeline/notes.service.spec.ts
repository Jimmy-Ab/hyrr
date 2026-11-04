import { ForbiddenException } from "@nestjs/common"
import { PrismaClient } from "@prisma/client"
import { mockDeep } from "jest-mock-extended"
import { NotesService } from "./notes.service"

describe("NotesService (R2)", () => {
  let prisma: any
  let access: any
  let service: NotesService
  const alice = { userId: "rec-a", role: "RECRUITER" }
  const bob = { userId: "rec-b", role: "RECRUITER" }
  const note = (authorId: string) => ({
    id: "n1",
    applicationId: "app-1",
    authorId,
    body: "Great call",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  })

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>()
    access = { applicationFor: jest.fn().mockResolvedValue({ id: "app-1" }) }
    service = new NotesService(prisma, access)
    prisma.user.findMany.mockResolvedValue([{ id: "rec-a", name: "Alice", avatar: null }])
  })

  it("lists newest first with author and `mine`", async () => {
    prisma.applicationNote.findMany.mockResolvedValue([note("rec-a"), { ...note("gone"), id: "n2" }])
    const result = await service.list("app-1", bob)
    expect(access.applicationFor).toHaveBeenCalledWith(bob, "app-1", "view")
    expect(prisma.applicationNote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { applicationId: "app-1" }, orderBy: { createdAt: "desc" } })
    )
    expect(result[0]).toEqual({
      id: "n1",
      body: "Great call",
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
      author: { id: "rec-a", name: "Alice", avatar: null },
      mine: false,
    })
    expect(result[1].author.name).toBe("Former team member")
    expect(Object.keys(result[0])).not.toContain("authorId")
  })

  it("seekers can never read notes (even of their own application)", async () => {
    await expect(service.list("app-1", { userId: "s", role: "SEEKER" })).rejects.toMatchObject({
      status: 403,
    })
    expect(access.applicationFor).not.toHaveBeenCalled()
    expect(prisma.applicationNote.findMany).not.toHaveBeenCalled()
  })

  it("creating requires manage access and records the author", async () => {
    prisma.applicationNote.create.mockResolvedValue(note("rec-a"))
    const result = await service.create("app-1", alice, "Great call")
    expect(access.applicationFor).toHaveBeenCalledWith(alice, "app-1", "manage")
    expect(prisma.applicationNote.create).toHaveBeenCalledWith({
      data: { applicationId: "app-1", authorId: "rec-a", body: "Great call" },
    })
    expect(result.mine).toBe(true)
  })

  it("a viewer without manage access cannot add notes", async () => {
    access.applicationFor.mockRejectedValue(new ForbiddenException())
    await expect(service.create("app-1", bob, "x")).rejects.toMatchObject({ status: 403 })
    expect(prisma.applicationNote.create).not.toHaveBeenCalled()
  })

  it("only the author can edit or delete (403 NOT_NOTE_AUTHOR)", async () => {
    prisma.applicationNote.findUnique.mockResolvedValue(note("rec-a"))
    await expect(service.update("n1", bob, "hijack")).rejects.toMatchObject({
      status: 403,
      errorCode: "NOT_NOTE_AUTHOR",
    })
    await expect(service.remove("n1", bob)).rejects.toMatchObject({ errorCode: "NOT_NOTE_AUTHOR" })
    expect(prisma.applicationNote.update).not.toHaveBeenCalled()
    expect(prisma.applicationNote.delete).not.toHaveBeenCalled()
  })

  it("the author edits and deletes their note", async () => {
    prisma.applicationNote.findUnique.mockResolvedValue(note("rec-a"))
    prisma.applicationNote.update.mockResolvedValue({ ...note("rec-a"), body: "Edited" })
    const updated = await service.update("n1", alice, "Edited")
    expect(updated.body).toBe("Edited")
    await expect(service.remove("n1", alice)).resolves.toEqual({
      id: "n1",
      applicationId: "app-1",
      deleted: true,
    })
  })

  it("404 NOTE_NOT_FOUND for an unknown note", async () => {
    prisma.applicationNote.findUnique.mockResolvedValue(null)
    await expect(service.update("nope", alice, "x")).rejects.toMatchObject({
      errorCode: "NOTE_NOT_FOUND",
    })
  })
})
