import { spawn } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const children = ['server', 'monopoly'].map((workspace) =>
  spawn(npm, ['run', 'dev', `--workspace=${workspace}`], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  }),
);
let closing = false;
function close(code = 0) {
  if (closing) return;
  closing = true;
  for (const child of children) child.kill('SIGTERM');
  process.exitCode = code;
}
children.forEach((child) => {
  child.on('error', (error) => {
    console.error(error);
    close(1);
  });
  child.on('exit', (code) => close(code ?? 1));
});
process.on('SIGINT', () => close());
process.on('SIGTERM', () => close());
