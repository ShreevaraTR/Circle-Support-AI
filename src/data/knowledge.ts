import type { KnowledgeBase } from '../engine/types';
import raw from './knowledge.json';

/**
 * Public Circle Help Center index, built at build time by scripts/build-kb.mjs.
 * Bundled into the app — no network access is needed at runtime.
 */
export const KNOWLEDGE_BASE = raw as KnowledgeBase;
