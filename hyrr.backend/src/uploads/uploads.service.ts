import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class UploadsService {
  private readonly uploadDir = path.join(process.cwd(), 'uploads');

  constructor() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  getUploadPath(): string {
    return this.uploadDir;
  }

  formatFileUrl(filename: string): string {
    return `http://localhost:3000/uploads/${filename}`;
  }
}
