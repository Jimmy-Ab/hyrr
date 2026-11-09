import { JwtService } from "@nestjs/jwt"
import { PrismaClient } from "@prisma/client"
import { mockDeep } from "jest-mock-extended"
import { jwtSecret } from "../auth/jwt.config"
import { RealtimeService } from "../core/realtime/realtime.service"
import { MessagesGateway } from "./messages.gateway"

/** Records room emits like a socket.io Server: server.to(rooms).emit(event, data). */
function fakeServer() {
  const sent: { rooms: string[]; event: string; data: any }[] = []
  return {
    sent,
    to(rooms: string | string[]) {
      const list = Array.isArray(rooms) ? rooms : [rooms]
      return { emit: (event: string, data: any) => sent.push({ rooms: list, event, data }) }
    },
  }
}

describe("MessagesGateway live sync", () => {
  const jwt = new JwtService({ secret: jwtSecret() })
  let prisma: any
  let access: { companyScope: jest.Mock }
  let gateway: MessagesGateway
  let server: ReturnType<typeof fakeServer>

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>()
    access = { companyScope: jest.fn().mockResolvedValue({ companyIds: ["co-1"] }) }
    const messages = { displayName: jest.fn().mockResolvedValue("Ada") }
    gateway = new MessagesGateway(jwt, messages as any, access as any, prisma)
    server = fakeServer()
    ;(gateway as any).server = server
  })

  const connect = async (role: string, twoFactorEnabled: boolean) => {
    prisma.user.findUnique.mockImplementation(async ({ select }: any) =>
      select?.twoFactorEnabled
        ? { role, twoFactorEnabled }
        : { status: "ACTIVE", tokenVersion: 0, role }
    )
    const token = jwt.sign({ sub: "u1", role, email: "a@b.c", tv: 0 })
    const joined: string[] = []
    const client: any = {
      handshake: { auth: { token }, headers: {} },
      join: (room: string) => joined.push(room),
      emit: jest.fn(),
      disconnect: jest.fn(),
      data: {},
    }
    await gateway.handleConnection(client)
    return { joined, client }
  }

  it("admins with 2FA join the admin room; without 2FA they don't", async () => {
    expect((await connect("ADMIN", true)).joined).toContain("admin")
    expect((await connect("ADMIN", false)).joined).not.toContain("admin")
  })

  it("recruiters and seekers never join the admin room", async () => {
    expect((await connect("RECRUITER", true)).joined).toEqual(
      expect.arrayContaining(["user_u1", "company_co-1"])
    )
    expect((await connect("RECRUITER", true)).joined).not.toContain("admin")
    expect((await connect("SEEKER", true)).joined).toEqual(["user_u1"])
  })

  it("status changes reach the seeker and the hiring team", () => {
    gateway.emitApplicationUpdate("seek-1", { applicationId: "a1", status: "IN_PROCESS" }, "co-1")
    expect(server.sent).toEqual([
      {
        rooms: ["user_seek-1", "company_co-1"],
        event: "application_status_updated",
        data: { applicationId: "a1", status: "IN_PROCESS" },
      },
    ])
  })

  it("candidate_applied goes to the company room and the job poster", () => {
    gateway.emitToCompany("co-1", "candidate_applied", { candidate: { id: "a1" } }, ["rec-9"])
    expect(server.sent[0]).toMatchObject({
      rooms: ["company_co-1", "user_rec-9"],
      event: "candidate_applied",
    })
  })

  it("admin metrics only go to the admin room (via RealtimeService too)", () => {
    const realtime = new RealtimeService()
    realtime.attach(server as any)
    realtime.adminMetric("signup", { role: "SEEKER" })
    gateway.emitAdminMetric("application")
    expect(server.sent.map((s) => s.rooms)).toEqual([["admin"], ["admin"]])
    expect(server.sent[0].data).toMatchObject({ kind: "signup", role: "SEEKER" })
  })
})
