// Удаляет базу — при следующем запуске сервер создаст её заново с демо-данными.
import fs from 'node:fs';
import path from 'node:path';

const file = process.env.DB_PATH || path.resolve('data/palada.db');
for (const f of [file, file + '-wal', file + '-shm']) if (fs.existsSync(f)) fs.rmSync(f);
console.log('База удалена:', file, '— перезапустите сервер, демо-данные создадутся заново.');
