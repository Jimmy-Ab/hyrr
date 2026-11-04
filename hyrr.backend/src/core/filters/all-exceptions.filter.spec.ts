import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common"
import { Prisma } from "@prisma/client"
import { AppException } from "../exceptions/app-exception"
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

  it.each([
    [new UnauthorizedException(), 401, "UNAUTHORIZED"],
    [new UnauthorizedException("A valid document link is required"), 401, "UNAUTHORIZED"],
    [new ForbiddenException(), 403, "FORBIDDEN"],
    [new NotFoundException("nope"), 404, "NOT_FOUND"],
    [new BadRequestException(["name must be a string"]), 400, "BAD_REQUEST"],
    [new HttpException("slow down", 429), 429, "TOO_MANY_REQUESTS"],
    [new HttpException("teapot", 418), 418, "HTTP_418"],
  ])("maps plain HttpException %# to a stable code", (err, status, errorCode) => {
    expect(normalizeException(err)).toMatchObject({ statusCode: status, errorCode })
  })

  it("keeps AppException codes", () => {
    expect(normalizeException(new AppException("x", 401, "TOKEN_EXPIRED"))).toMatchObject({
      statusCode: 401,
      errorCode: "TOKEN_EXPIRED",
    })
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
