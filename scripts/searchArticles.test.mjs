import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSearchText, rankArticles } from '../src/utils/searchArticles.mjs';

const articles = [
  { id: 'azure', title: 'Azure SQL Database', description: 'Publishing DACPAC files',
    tags: ['azure', 'devops'], pubDate: '2026-01-01' },
  { id: 'mcp', title: 'RickAndMorty.mcp', description: 'An MCP server built in C#',
    tags: ['ai-tools', 'mcp'], pubDate: '2026-10-01' },
  { id: 'docker', title: 'React + Docker + GitHub Actions', description: 'Deploy React to Azure',
    tags: ['docker', 'github-actions'], pubDate: '2026-09-01' },
];

test('normalizes case, whitespace, hyphens and accents', () => {
  assert.equal(normalizeSearchText('  DévOps--Azure  '), 'devops azure');
  assert.equal(normalizeSearchText(null), '');
});

test('matches title, description and tags without distinguishing case', () => {
  assert.deepEqual(rankArticles(articles, 'DACPAC').map(p => p.id), ['azure']);
  assert.deepEqual(rankArticles(articles, 'MCP').map(p => p.id), ['mcp']);
  assert.deepEqual(rankArticles(articles, 'GITHUB ACTIONS').map(p => p.id), ['docker']);
});

test('uses AND matching across fields', () => {
  assert.deepEqual(rankArticles(articles, 'azure dacpac').map(p => p.id), ['azure']);
  assert.deepEqual(rankArticles(articles, 'azure mcp'), []);
});

test('ranks title matches before summary-only matches', () => {
  assert.deepEqual(rankArticles(articles, 'Azure').map(p => p.id), ['azure', 'docker']);
});

test('empty query returns all posts by newest first, without mutating input', () => {
  assert.deepEqual(rankArticles(articles, '').map(p => p.id), ['mcp', 'docker', 'azure']);
  assert.deepEqual(articles.map(p => p.id), ['azure', 'mcp', 'docker']);
});

test('handles missing article fields and empty datasets', () => {
  assert.deepEqual(rankArticles([], 'azure'), []);
  assert.equal(rankArticles([{ id: 'untagged', title: 'A note', pubDate: '2026-01-01' }], 'note').length, 1);
});
