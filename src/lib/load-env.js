import { loadEnvFile } from 'node:process';

for (const path of ['.env.local', '.env']) {
  try {
    loadEnvFile(path);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}
