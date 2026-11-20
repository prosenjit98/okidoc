import { Global, Injectable, Module } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync } from 'node:fs';
import { unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { bad } from '../../common/http';
import { config } from '../../config';

export const PUBLIC_DIR = () => path.resolve(config.storageDir, 'public');
const PRIVATE_DIR = () => path.resolve(config.storageDir, 'private');

const ALLOWED: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

export interface UploadedFile {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname?: string;
}

/**
 * Local-disk storage for development. Swap for an S3-compatible implementation (India region) in production;
 * the rest of the API only uses save / stream / remove / publicUrl.
 */
@Injectable()
export class StorageService {
  constructor() {
    for (const d of [PUBLIC_DIR(), PRIVATE_DIR()]) if (!existsSync(d)) mkdirSync(d, { recursive: true });
  }

  validate(file: UploadedFile | undefined, maxMb = 10, imagesOnly = false) {
    if (!file) throw bad('NO_FILE', 'Choose a file to upload');
    const ext = ALLOWED[file.mimetype];
    if (!ext || (imagesOnly && ext === 'pdf')) throw bad('BAD_FILE_TYPE', imagesOnly ? 'Upload a JPG, PNG or WebP image' : 'Upload a JPG, PNG, WebP image or a PDF');
    if (file.size > maxMb * 1024 * 1024) throw bad('FILE_TOO_LARGE', `File must be under ${maxMb} MB`);
    return ext;
  }

  async save(file: UploadedFile, folder: string, visibility: 'public' | 'private', opts: { maxMb?: number; imagesOnly?: boolean } = {}) {
    const ext = this.validate(file, opts.maxMb, opts.imagesOnly);
    const dir = path.join(visibility === 'public' ? PUBLIC_DIR() : PRIVATE_DIR(), folder);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const name = `${randomUUID()}.${ext}`;
    await writeFile(path.join(dir, name), file.buffer);
    return `${visibility}/${folder}/${name}`;
  }

  publicUrl(key: string) {
    return `${config.publicBaseUrl}/files/${key}`;
  }

  stream(key: string) {
    const full = path.resolve(config.storageDir, key);
    if (!full.startsWith(path.resolve(config.storageDir)) || !existsSync(full)) throw bad('NO_FILE', 'File not found');
    return createReadStream(full);
  }

  async remove(key: string) {
    const full = path.resolve(config.storageDir, key);
    if (full.startsWith(path.resolve(config.storageDir))) await unlink(full).catch(() => undefined);
  }
}

@Global()
@Module({ providers: [StorageService], exports: [StorageService] })
export class StorageModule {}
