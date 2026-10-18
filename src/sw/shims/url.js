export const fileURLToPath = (u) => decodeURIComponent(new URL(String(u)).pathname);
export const pathToFileURL = (p) => new URL(`file://${p}`);
const _URL = globalThis.URL;
export { _URL as URL };
export default { fileURLToPath, pathToFileURL, URL: _URL };
