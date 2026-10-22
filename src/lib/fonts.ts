import fs from 'node:fs';
import path from 'node:path';

// Tilda Sans подключается, только если шрифт скачан (npm run fonts, см. README):
// в разработке он лежит в public/fonts, в собранном сайте на хостинге — в dist/client/fonts
const FILE = 'TildaSans-Regular.woff2';
export const hasFont = ['public/fonts', 'dist/client/fonts'].some((dir) => fs.existsSync(path.resolve(process.cwd(), dir, FILE)));
