import type { Script } from './types';

const lines: string[] = [];
for (let i = 1; i <= 60; i++) {
  lines.push(`Sample line ${i}: the quick brown fox jumps over the lazy dog.`);
}

export const sampleScript: Script = { name: 'Sample Script', lines };
