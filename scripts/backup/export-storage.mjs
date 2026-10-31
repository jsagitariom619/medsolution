import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const key = process.env.SUPABASE_PUBLIC_KEY || '';
const bucket = 'medsolution-archivos';
const root = path.resolve(process.argv[2] || 'storage');
if (!/^https:\/\/[a-z0-9.-]+$/i.test(baseUrl) || !key) throw new Error('Storage API secrets are not configured.');

const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
async function request(url, init) {
  const response = await fetch(url, { ...init, headers: { ...headers, ...init?.headers } });
  if (!response.ok) throw new Error(`Storage API request failed with HTTP ${response.status}.`);
  return response;
}

const files = [];
const visit = async (prefix = '') => {
  let offset = 0;
  while (true) {
    const response = await request(`${baseUrl}/storage/v1/object/list/${encodeURIComponent(bucket)}`, {
      method: 'POST',
      body: JSON.stringify({ prefix, limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } }),
    });
    const items = await response.json();
    if (!Array.isArray(items)) throw new Error('Storage API returned an unexpected directory listing.');
    for (const item of items) {
      if (!item || typeof item.name !== 'string' || item.name.includes('/') || item.name.includes('\\') || item.name === '.' || item.name === '..') {
        throw new Error('Storage returned an invalid object key.');
      }
      const objectKey = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id == null && item.metadata == null) {
        await visit(objectKey);
        continue;
      }
      const encodedKey = objectKey.split('/').map(encodeURIComponent).join('/');
      const download = await request(`${baseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${encodedKey}`, { method: 'GET' });
      const bytes = Buffer.from(await download.arrayBuffer());
      const target = path.resolve(root, 'objects', ...objectKey.split('/'));
      if (!target.startsWith(`${path.resolve(root, 'objects')}${path.sep}`)) throw new Error('Storage object escaped the backup directory.');
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, bytes, { flag: 'wx', mode: 0o600 });
      files.push({ key: objectKey, size: bytes.length, contentType: item.metadata?.mimetype || null, updatedAt: item.updated_at || null });
    }
    offset += items.length;
    if (items.length < 1000) break;
  }
};

await visit();
await writeFile(path.join(root, 'storage-manifest.json'), `${JSON.stringify({ bucket, count: files.length, files }, null, 2)}\n`, { mode: 0o600 });
console.log(`Storage object export completed (${files.length} files).`);
