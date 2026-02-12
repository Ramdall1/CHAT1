import fs from 'fs-extra';
import path from 'path';

const LOGS_DIR = path.join(process.cwd(), 'logs');

function ensureLogsDir() {
  try {
    fs.ensureDirSync(LOGS_DIR);
  } catch {}
}

function pad(n) {
  return String(n).padStart(2, '0');
}
function dateStamp(d = new Date()) {
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  return `${y}-${m}-${dd}`;
}

export function log(event, message = '', extra = null) {
  ensureLogsDir();
  const file = path.join(LOGS_DIR, `${dateStamp()}.log`);
  const line = `[${new Date().toISOString()}] ${event} :: ${message}${extra ? ' :: ' + JSON.stringify(extra) : ''}`;
  try {
    fs.appendFileSync(file, line + '\n');
  } catch (e) {
    // Fallback to console if file append fails
    console.log(line);
  }
}

export function getLogsPath() {
  ensureLogsDir();
  return LOGS_DIR;
}
