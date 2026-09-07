import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const DEFAULT_ENDPOINT = 'http://rustfs:9000';
const DEFAULT_REGION = 'us-east-1';
const DEFAULT_BUCKET = 'webkelas-submissions';

function getStorageConfig() {
  const accessKeyId = process.env.RUSTFS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.RUSTFS_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) throw new Error('Konfigurasi credential RustFS belum lengkap.');
  return {
    endpoint: process.env.RUSTFS_ENDPOINT || DEFAULT_ENDPOINT,
    region: process.env.RUSTFS_REGION || DEFAULT_REGION,
    bucket: process.env.RUSTFS_BUCKET || DEFAULT_BUCKET,
    forcePathStyle: process.env.RUSTFS_FORCE_PATH_STYLE !== 'false',
    accessKeyId,
    secretAccessKey,
  };
}

function getStorageClient() {
  const config = getStorageConfig();
  return {
    config,
    client: new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: config.forcePathStyle,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    }),
  };
}

export const MAX_SUBMISSION_FILE_SIZE = 10 * 1024 * 1024;
export const MAX_ASSIGNMENT_FILE_SIZE = 10 * 1024 * 1024;

export type StorageErrorCode = 'STORAGE_FORBIDDEN' | 'STORAGE_NOT_FOUND' | 'STORAGE_UNAVAILABLE';

export function getStorageErrorCode(error: unknown): StorageErrorCode | null {
  const candidate = error as { name?: string; Code?: string; code?: string; message?: string; $metadata?: { httpStatusCode?: number } } | null;
  const status = candidate?.$metadata?.httpStatusCode;
  const code = candidate?.Code || candidate?.code || candidate?.name || '';
  const message = candidate?.message || '';
  if (status === 403 || /access key|access denied|forbidden/i.test(message) || /AccessDenied|InvalidAccessKeyId/i.test(code)) return 'STORAGE_FORBIDDEN';
  if (status === 404 || /NoSuchBucket|NotFound/i.test(code) || /bucket does not exist/i.test(message)) return 'STORAGE_NOT_FOUND';
  if ((status !== undefined && status >= 500) || /Konfigurasi credential RustFS|Timeout|NetworkingError|ECONNREFUSED|Unable to connect|fetch failed/i.test(`${code} ${message}`)) return 'STORAGE_UNAVAILABLE';
  return null;
}

export function storageErrorResponse(code: StorageErrorCode) {
  if (code === 'STORAGE_FORBIDDEN') return { error: 'Penyimpanan sekolah menolak akses. Hubungi administrator untuk memeriksa konfigurasi penyimpanan.', code, retryable: false };
  if (code === 'STORAGE_NOT_FOUND') return { error: 'Penyimpanan sekolah belum siap karena lokasi file tidak ditemukan. Hubungi administrator.', code, retryable: false };
  return { error: 'Penyimpanan sekolah sedang tidak tersedia. Silakan coba lagi beberapa saat.', code, retryable: true };
}

export const isRustFsReference = (value: string | null | undefined) => Boolean(value?.startsWith('rustfs://'));

export const toRustFsReference = (key: string) => `rustfs://${key}`;

function keyFromReference(reference: string) {
  if (!isRustFsReference(reference)) throw new Error('Referensi file RustFS tidak valid.');
  return reference.slice('rustfs://'.length);
}

export async function uploadPdf(key: string, file: File, originalName: string) {
  const { client, config } = getStorageClient();
  await client.send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: new Uint8Array(await file.arrayBuffer()),
    ContentType: 'application/pdf',
    ContentLength: file.size,
    ContentDisposition: `attachment; filename="${originalName.replace(/["\\\r\n]/g, '_')}"`,
  }));
  return toRustFsReference(key);
}

export async function readObject(reference: string) {
  const { client, config } = getStorageClient();
  const result = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: keyFromReference(reference) }));
  if (!result.Body) throw new Error('File tidak memiliki isi.');
  const body = await result.Body.transformToByteArray();
  return { body, contentType: result.ContentType || 'application/pdf' };
}

export async function deleteObject(reference: string) {
  if (!isRustFsReference(reference)) return;
  const { client, config } = getStorageClient();
  await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: keyFromReference(reference) }));
}
