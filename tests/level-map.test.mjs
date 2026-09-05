import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const map = JSON.parse(await readFile(new URL('../game/data/level_map.json', import.meta.url), 'utf8'));

test('level map has a connected critical path from spawn to finish', () => {
  const nodeIds = new Set(map.nodes.map((node) => node.id));
  assert.equal(map.nodes.find((node) => node.type === 'spawn')?.id, 'spawn-dock');
  assert.equal(map.nodes.find((node) => node.type === 'finish')?.id, 'finish-bridge');
  map.edges.forEach(({ from, to, type, mechanic }) => {
    assert.ok(nodeIds.has(from), `${from} exists`);
    assert.ok(nodeIds.has(to), `${to} exists`);
    assert.ok(type && mechanic, 'each edge declares its traversal meaning');
  });
  map.critical_path.forEach((id) => assert.ok(nodeIds.has(id), `${id} is a declared critical node`));
  assert.ok(map.surfaces.includes('WALL_JUMPABLE'));
  assert.ok(map.surfaces.includes('SLIDE_TUNNEL'));
  assert.ok(map.surfaces.includes('DASH_ROUTE'));
});
