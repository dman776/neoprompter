import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(html|css|ts)$/.test(name) && !name.endsWith('.test.ts') ? [full] : [];
  });
}

describe('offline operation', () => {
  it('app code and pages reference no remote resources', () => {
    const remote =
      /(?:src|href)=["']https?:\/\/|url\(["']?https?:\/\/|from ["']https?:\/\/|fetch\(["']https?:\/\/|<script[^>]+https?:\/\//;
    const offenders = sourceFiles('src').filter((f) => remote.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
