import { spawn } from 'node:child_process';
import { cp, mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, '..');
const distDir = path.join(packageRoot, 'dist');
const srcDir = path.join(packageRoot, 'src');
const dataDir = path.join(srcDir, 'data');
const tscBin = path.resolve(packageRoot, '../../node_modules/typescript/bin/tsc');

async function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: packageRoot,
      stdio: 'inherit',
      shell: process.platform === 'win32'
    });
    child.on('exit', code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
      }
    });
    child.on('error', reject);
  });
}

async function copyDataFolder() {
  try {
    await stat(dataDir);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return;
    }
    throw error;
  }

  await mkdir(path.join(distDir, 'data'), { recursive: true });
  await cp(dataDir, path.join(distDir, 'data'), { recursive: true });
}

await rm(distDir, { recursive: true, force: true });
await run('node', [tscBin, '-p', 'tsconfig.build.json']);
await copyDataFolder();
