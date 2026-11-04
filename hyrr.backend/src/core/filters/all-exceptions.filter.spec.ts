import { Prisma } from "@prisma/client"
import { AllExceptionsFilter, normalizeException } from "./all-exceptions.filter"

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError("boom", { code, clientVersion: "6" })

describe("AllExceptionsFilter", () => {
  it.each([
    ["P2002", 409, "CONFLICT"],
    ["P2025", 404, "NOT_FOUND"],
    ["P2003", 400, "BAD_REQUEST"],
  ])("maps Prisma %s", (code, status, errorCode) => {
    expect(normalizeException(prismaError(code))).toMatchObject({ statusCode: status, errorCode })
  })

  it("never calls .status() on a websocket client", () => {
    const client = { emit: jest.fn(), status: jest.fn() }
    const host: any = { getType: () => "ws", switchToWs: () => ({ getClient: () => client }) }
    new AllExceptionsFilter().catch(new Error("x"), host)
    expect(client.status).not.toHaveBeenCalled()
    expect(client.emit).toHaveBeenCalledWith(
      "exception",
      expect.objectContaining({ statusCode: 500 })
    )
  })
})
