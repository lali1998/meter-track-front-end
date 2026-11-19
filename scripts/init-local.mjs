import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../.env', import.meta.url));
const api = fileURLToPath(new URL('../api/.env', import.meta.url));
if (existsSync(root) || existsSync(api)) throw new Error('Már létezik helyi .env fájl. Ellenőrizd a két konfigurációt.');
const db = 'DB_NAME=rezsiflow\nDB_USER=rezsiflow_app\nDB_PASSWORD=' + randomBytes(32).toString('hex') + '\n';
writeFileSync(root, db + 'DB_ROOT_PASSWORD=' + randomBytes(32).toString('hex') + '\n', { flag: 'wx', mode: 0o600 });
writeFileSync(api, db + 'DB_HOST=127.0.0.1\nDB_PORT=3307\nPORT=3000\nFRONTEND_ORIGIN=http://localhost:4200\n', { flag: 'wx', mode: 0o600 });

