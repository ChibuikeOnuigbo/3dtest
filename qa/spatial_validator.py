#!/usr/bin/env python3
"""Validate Vector Run's declarative navigation graph and intentional support ledger.

This is a static data check. It deliberately does not claim rendered collision, physics,
screenshot, performance or player-playthrough evidence.
"""
from __future__ import annotations
import json
from collections import defaultdict, deque
from pathlib import Path

PLAN = Path('game/data/level_map.json')
OUT = Path('qa/spatial_report.json')
REQUIRED_SURFACES = {'WALKABLE', 'WALL_JUMPABLE', 'SLIDE_TUNNEL', 'DASH_ROUTE', 'NON_TRAVERSABLE'}


def main():
    plan = json.loads(PLAN.read_text())
    nodes = {node['id']: node for node in plan['nodes']}
    graph = defaultdict(set)
    findings = []
    for edge in plan['edges']:
        known = edge['from'] in nodes and edge['to'] in nodes
        findings.append({'id': f"edge:{edge['from']}->{edge['to']}", 'result': 'PASS' if known and edge.get('type') and edge.get('mechanic') else 'FAIL'})
        if known:
            graph[edge['from']].add(edge['to']); graph[edge['to']].add(edge['from'])
    spawn = plan['spawn']['id']
    finish = next((node['id'] for node in plan['nodes'] if node['type'] == 'finish'), None)
    visited, queue = {spawn}, deque([spawn])
    while queue:
        current = queue.popleft()
        for neighbour in graph[current]:
            if neighbour not in visited: visited.add(neighbour); queue.append(neighbour)
    findings.append({'id': 'critical-path-reachable', 'result': 'PASS' if finish in visited and set(plan['critical_path']).issubset(visited) else 'FAIL'})
    findings.append({'id': 'required-traversal-surface-vocabulary', 'result': 'PASS' if REQUIRED_SURFACES.issubset(set(plan['surfaces'])) else 'FAIL'})
    position_ok = all(len(node['position']) == 3 for node in plan['nodes'])
    findings.append({'id': 'all-navigation-nodes-have-3d-coordinates', 'result': 'PASS' if position_ok else 'FAIL'})
    report = {
        'schema': 'vector-run-spatial-report/v1',
        'scope': 'Navigation graph, route semantics and 3D coordinate declarations only. Runtime collision, wall normal detection, support contact, rendered intersections and playthrough remain UNVERIFIED.',
        'findings': findings,
        'overall': 'PASS_WITH_BROWSER_VALIDATION_REQUIRED' if not any(item['result'] == 'FAIL' for item in findings) else 'FAIL'
    }
    OUT.write_text(json.dumps(report, indent=2) + '\n')
    print(report['overall'])
    for finding in findings: print(f"{finding['result']:4} {finding['id']}")

if __name__ == '__main__': main()
