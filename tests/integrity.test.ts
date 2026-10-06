import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { KNOWLEDGE_BASE } from '../src/data/knowledge';
import { PROBLEMS } from '../src/engine/rules/playbooks';
import { resolveDoc } from '../src/engine/rules/retrieve';

const root = process.cwd();
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const srcFiles = walk(path.join(root, 'src')).filter((f) => /\.(ts|tsx|css)$/.test(f));

describe('knowledge base integrity', () => {
  it('contains only public help.circle.so article URLs, without duplicates', () => {
    const urls = KNOWLEDGE_BASE.articles.map((a) => a.url);
    expect(urls.length).toBeGreaterThan(200);
    expect(new Set(urls).size).toBe(urls.length);
    for (const u of urls) expect(u).toMatch(/^https:\/\/help\.circle\.so\/(p|c)\/[a-z0-9-/]+$/);
  });

  it('every playbook doc reference resolves to an indexed article', () => {
    const missing: string[] = [];
    for (const p of PROBLEMS) {
      for (const frag of [...p.docs, ...p.steps.flatMap((s) => (s.doc ? [s.doc] : []))]) {
        if (!resolveDoc(KNOWLEDGE_BASE, frag)) missing.push(`${p.id}: ${frag}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('records where the index came from', () => {
    expect(KNOWLEDGE_BASE.source).toMatch(/public/i);
    expect(KNOWLEDGE_BASE.retrievedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('free, offline, credential-free', () => {
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });

  it('has no paid AI / LLM SDK dependencies', () => {
    const paid = /openai|anthropic|@google\/generative|@google\/genai|cohere|mistral|langchain|replicate|together-ai|groq/i;
    expect(deps.filter((d) => paid.test(d))).toEqual([]);
  });

  it('makes no network calls at runtime', () => {
    for (const f of srcFiles) {
      const code = readFileSync(f, 'utf8');
      expect([f, /\bfetch\(|XMLHttpRequest|axios|WebSocket|navigator\.sendBeacon/.test(code)]).toEqual([f, false]);
    }
  });

  it('contains no credentials, tokens or Circle login details', () => {
    const secret = /(api[_-]?key|secret|password)\s*[:=]\s*['"][^'"]{8,}|sk-[A-Za-z0-9]{20,}|BSA[A-Za-z0-9]{20,}|Bearer\s+[A-Za-z0-9._-]{20,}/i;
    for (const f of [...srcFiles, path.join(root, 'scripts/build-kb.mjs'), path.join(root, 'src/data/knowledge.json')]) {
      expect([f, secret.test(readFileSync(f, 'utf8'))]).toEqual([f, false]);
    }
  });
});
