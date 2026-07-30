import { BadRequestException, Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { createHmac, timingSafeEqual } from 'crypto';
import { jwtSecret } from '../auth/jwt.config';

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
    const baseUrl = process.env.PUBLIC_API_URL || `http://localhost:${process.env.PORT || 3000}`;
    const extension = path.extname(filename).toLowerCase();
    if (['.jpg', '.jpeg', '.png'].includes(extension)) return `${baseUrl}/uploads/${encodeURIComponent(filename)}`;
    return `${baseUrl}/uploads/${encodeURIComponent(filename)}?token=${this.createAccessToken(filename)}`;
  }

  private signature(value: string) { return createHmac('sha256', process.env.UPLOAD_URL_SECRET || jwtSecret()).update(value).digest('base64url'); }
  createAccessToken(filename: string, expiresInMs = 15 * 60 * 1000) {
    const payload = `${filename}:${Date.now() + expiresInMs}`;
    return `${Buffer.from(payload).toString('base64url')}.${this.signature(payload)}`;
  }
  verifyAccessToken(filename: string, token?: string) {
    if (!token) return false;
    const [encoded, signature] = token.split('.');
    if (!encoded || !signature) return false;
    const payload = Buffer.from(encoded, 'base64url').toString();
    const [tokenFilename, expiry] = payload.split(':');
    const expected = this.signature(payload);
    if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
    return tokenFilename === filename && Number(expiry) > Date.now();
  }

  getFilename(value: string) {
    try { return path.basename(new URL(value).pathname); } catch { return path.basename(value); }
  }

  validateStoredFile(file: { path: string; mimetype: string; originalname: string }) {
    const data = fs.readFileSync(file.path);
    const extension = path.extname(file.originalname).toLowerCase();
    const isPng = data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const isJpeg = data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
    const isPdf = data.subarray(0, 5).toString() === '%PDF-';
    const isZip = data.length >= 4 && data.subarray(0, 2).toString() === 'PK';
    const isLegacyDoc = data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
    const valid = (extension === '.png' && isPng) ||
      ((extension === '.jpg' || extension === '.jpeg') && isJpeg) ||
      (extension === '.pdf' && isPdf) ||
      (extension === '.docx' && isZip) ||
      (extension === '.doc' && isLegacyDoc);
    if (!valid) {
      fs.unlinkSync(file.path);
      throw new BadRequestException('File content does not match its declared type');
    }
  }
}
