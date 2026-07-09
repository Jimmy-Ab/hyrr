import { Test, TestingModule } from '@nestjs/testing';
import { DocumentsService } from './documents.service';
import { PrismaService } from '../prisma/prisma.service';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

describe('DocumentsService', () => {
  let service: DocumentsService;
  let prismaMock: DeepMockProxy<PrismaClient>;

  beforeEach(async () => {
    prismaMock = mockDeep<PrismaClient>();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
  });

  it('should list documents for a user', async () => {
    prismaMock.document.findMany.mockResolvedValue([
      { id: 'doc-1', name: 'Resume.pdf', active: true },
    ] as any);

    const result = await service.getMyDocuments('user-1');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Resume.pdf');
  });

  it('should deactivate old resumes when creating a new active resume', async () => {
    prismaMock.document.updateMany.mockResolvedValue({ count: 1 } as any);
    prismaMock.document.create.mockResolvedValue({ id: 'doc-2', type: 'RESUME', active: true } as any);

    const result = await service.createDocument('user-1', {
      name: 'New_Resume.pdf',
      type: 'RESUME',
      size: '1.2 MB',
      url: 'http://s3.com/resume',
    });

    expect(prismaMock.document.updateMany).toHaveBeenCalled();
    expect(result.id).toBe('doc-2');
  });
});
