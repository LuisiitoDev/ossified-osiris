import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const article = (filename) =>
  readFileSync(new URL(`../src/content/blog/${filename}`, import.meta.url), 'utf8');

const fencedBlockContaining = (markdown, language, marker) => {
  const blocks = [...markdown.matchAll(new RegExp(`\\`\\`\\`${language}\\n([\\s\\S]*?)\\n\\`\\`\\``, 'g'))];
  const block = blocks.map((entry) => entry[1]).find((code) => code.includes(marker));
  assert.ok(block, `Missing ${language} example containing: ${marker}`);
  return block;
};

test('Azure AD B2C tutorial explains end of sale and links to supported CIAM option', () => {
  const post = article('AzureB2C.md');
  assert.match(post, /May 1, 2025/);
  assert.match(post, /Microsoft Entra External ID/);
  assert.match(post, /updatedDate:/);
});

test('DACPAC CD cannot deploy artifact from PR workflow runs', () => {
  const post = article('sql-database-devops.md');
  const cd = fencedBlockContaining(post, 'yaml', 'name: Database CD - Deploy');
  for (const guard of [
    "github.event.workflow_run.conclusion == 'success'",
    "github.event.workflow_run.event == 'push'",
    "github.event.workflow_run.head_branch == 'master'",
    "github.event.workflow_run.head_repository.full_name == github.repository",
    'environment: Production',
  ]) {
    assert.ok(cd.includes(guard), `Missing trusted-deployment guard: ${guard}`);
  }
  assert.match(post, /\[Author\] VARCHAR\(500\) NOT NULL\n\)/);
});

test('React CI runs on trusted pushes; release job checks event and repository', () => {
  const post = article('github-actions-docker-container-apps.md');
  const ci = fencedBlockContaining(post, 'yaml', 'name: CI');
  assert.match(ci, /push:\n\s+branches: \[main\]/);

  const publish = fencedBlockContaining(post, 'yaml', 'name: Publish Image');
  for (const guard of [
    "github.event.workflow_run.event == 'push'",
    "github.event.workflow_run.head_branch == 'main'",
    "github.event.workflow_run.head_repository.full_name == github.repository",
  ]) assert.ok(publish.includes(guard), `Missing release guard ${guard}`);
});

test('Docker HTTP port and container healthcheck use nginx port 8080', () => {
  const docker = fencedBlockContaining(article('github-actions-docker-container-apps.md'), 'dockerfile', 'FROM node:22-alpine');
  assert.match(docker, /EXPOSE 8080/);
  assert.match(docker, /http:\/\/localhost:8080\/health/);
});
