import { BadRequestException } from "@nestjs/common"
import { Test, TestingModule } from "@nestjs/testing"
import { PrismaClient } from "@prisma/client"
import { mockDeep } from "jest-mock-extended"
import { PrismaService } from "../prisma/prisma.service"
import { UploadsService } from "../uploads/uploads.service"
import { DocumentsService } from "./documents.service"

describe("DocumentsService", () => {
  let service: DocumentsService
  let prismaMock: any
  let uploadsMock: any

  beforeEach(async () => {
    prismaMock = mockDeep<PrismaClient>()
    prismaMock.$transaction.mockImplementation((fn: any) => fn(prismaMock))
    uploadsMock = {
      formatFileUrl: jest.fn((url) => url),
      getFilename: jest.fn((url) => url),
      assertOwnedUpload: jest.fn((url: string, userId: string) => {
        if (!url.startsWith(`${userId}_`)) throw new BadRequestException("not yours")
        return url
      }),
      deleteFile: jest.fn().mockResolvedValue(undefined),
    }
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: UploadsService, useValue: uploadsMock },
      ],
    }).compile()

    service = module.get<DocumentsService>(DocumentsService)
  })

  it("should list documents for a user", async () => {
    prismaMock.document.findMany.mockResolvedValue([
      { id: "doc-1", name: "Resume.pdf", active: true },
    ] as any)

    const result = await service.getMyDocuments("user-1")
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe("Resume.pdf")
  })

  it("should deactivate old resumes when creating a new active resume", async () => {
    prismaMock.document.updateMany.mockResolvedValue({ count: 1 } as any)
    prismaMock.document.create.mockResolvedValue({
      id: "doc-2",
      type: "RESUME",
      active: true,
    } as any)

    const result = await service.createDocument("user-1", {
      name: "New_Resume.pdf",
      type: "RESUME",
      size: "1.2 MB",
      url: "user-1_resume.pdf",
    } as any)

    expect(prismaMock.document.updateMany).toHaveBeenCalled()
    expect(result.id).toBe("doc-2")
  })

  it("rejects a URL that is not the caller's own upload", async () => {
    await expect(
      service.createDocument("user-1", {
        name: "Stolen.pdf",
        type: "RESUME",
        size: "1 MB",
        url: "user-2_secret.pdf",
      } as any)
    ).rejects.toThrow(BadRequestException)
    expect(prismaMock.document.create).not.toHaveBeenCalled()
  })

  it("deletes the stored file when the document is removed", async () => {
    prismaMock.document.findUnique.mockResolvedValue({
      id: "doc-1",
      userId: "user-1",
      url: "user-1_cv.pdf",
    } as any)
    prismaMock.document.delete.mockResolvedValue({ id: "doc-1" } as any)
    prismaMock.document.count.mockResolvedValue(0 as any)
    prismaMock.application.count.mockResolvedValue(0 as any)

    await service.deleteDocument("doc-1", "user-1")
    expect(uploadsMock.deleteFile).toHaveBeenCalledWith("user-1_cv.pdf")
  })
})
