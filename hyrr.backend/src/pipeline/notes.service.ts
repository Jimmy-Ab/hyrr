import { Injectable } from "@nestjs/common"
import { AccessService, Actor } from "../core/access/access.service"
import { ForbiddenAppException, NotFoundAppException } from "../core/exceptions/app-exception"
import { PrismaService } from "../prisma/prisma.service"

const MAX_NOTES = 200

/** R2: private recruiter notes on an application. Never visible to seekers. */
@Injectable()
export class NotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService
  ) {}

  private assertRecruiter(actor: Actor) {
    if (actor.role !== "RECRUITER" && actor.role !== "ADMIN")
      throw new ForbiddenAppException("Notes are only available to the hiring team")
  }

  private async withAuthors<
    T extends { id: string; body: string; authorId: string; createdAt: Date; updatedAt: Date },
  >(notes: T[], actor: Actor) {
    const ids = [...new Set(notes.map((n) => n.authorId))]
    const users = ids.length
      ? await this.prisma.user.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true, avatar: true },
        })
      : []
    const byId = new Map(users.map((u) => [u.id, u]))
    return notes.map((n) => ({
      id: n.id,
      body: n.body,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
      author: byId.get(n.authorId) ?? { id: n.authorId, name: "Former team member", avatar: null },
      mine: n.authorId === actor.userId,
    }))
  }

  async list(applicationId: string, actor: Actor) {
    this.assertRecruiter(actor)
    await this.access.applicationFor(actor, applicationId, "view")
    const notes = await this.prisma.applicationNote.findMany({
      where: { applicationId },
      orderBy: { createdAt: "desc" },
      take: MAX_NOTES,
    })
    return this.withAuthors(notes, actor)
  }

  async create(applicationId: string, actor: Actor, body: string) {
    this.assertRecruiter(actor)
    await this.access.applicationFor(actor, applicationId, "manage")
    const note = await this.prisma.applicationNote.create({
      data: { applicationId, authorId: actor.userId, body },
    })
    return (await this.withAuthors([note], actor))[0]
  }

  /** Author only; the author must still have access to the application. */
  private async ownNote(noteId: string, actor: Actor) {
    this.assertRecruiter(actor)
    const note = await this.prisma.applicationNote.findUnique({ where: { id: noteId } })
    if (!note) throw new NotFoundAppException("Note not found", "NOTE_NOT_FOUND")
    await this.access.applicationFor(actor, note.applicationId, "view")
    if (note.authorId !== actor.userId)
      throw new ForbiddenAppException("Only the author can change this note", "NOT_NOTE_AUTHOR")
    return note
  }

  async update(noteId: string, actor: Actor, body: string) {
    await this.ownNote(noteId, actor)
    const note = await this.prisma.applicationNote.update({ where: { id: noteId }, data: { body } })
    return (await this.withAuthors([note], actor))[0]
  }

  async remove(noteId: string, actor: Actor) {
    const note = await this.ownNote(noteId, actor)
    await this.prisma.applicationNote.delete({ where: { id: noteId } })
    return { id: noteId, applicationId: note.applicationId, deleted: true }
  }
}
