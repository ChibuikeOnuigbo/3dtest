#!/usr/bin/env node
/**
 * Lawful Sketchfab candidate intake.
 *
 * Credentials are read only from approved process environment, sent only in an HTTPS
 * Authorization request, and are never printed, persisted, placed in a URL, or committed.
 * This utility follows public model/collection links only. It has no TLS bypass, proxy,
 * mirror, scraping of gated content, or protected-download circumvention.
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const outputRoot = path.join(root, 'research/sketchfab/intake');
const reportPath = path.join(root, 'research/sketchfab/latest_intake.json');
const token = process.env.SKETCHFAB_API_TOKEN || process.env.SKETCHFAB_TOKEN || '';
const urls = (process.env.SKETCHFAB_CANDIDATE_URLS || '').split(/[\n,]/).map((value) => value.trim()).filter(Boolean);
const runId = `sketchfab-intake-${new Date().toISOString().replace(/[:.]/g, '-')}`;

function safePublicUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'sketchfab.com' || url.hostname.endsWith('.sketchfab.com'));
  } catch { return false; }
}

function extractUid(value) {
  // Sketchfab model IDs are UUID-like. URL parsing is only used for legitimately exposed
  // public links; a model page is never guessed from private/internal metadata.
  const match = value.match(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i);
  return match?.[0].toLowerCase() || null;
}

function publicHeaders() {
  return { Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'RivetRunAssetIntake/1.0 (licence-review only)' };
}

function apiHeaders() {
  // Token is intentionally materialized only for this in-memory request header.
  return { Accept: 'application/json', Authorization: `Token ${token}`, 'User-Agent': 'RivetRunAssetIntake/1.0 (licence-review only)' };
}

async function request(url, options, label) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal, redirect: 'follow' });
    return { ok: response.ok, status: response.status, url: response.url, text: await response.text(), label };
  } catch (error) {
    return { ok: false, status: null, url, label, error: error instanceof Error ? error.message : String(error) };
  } finally { clearTimeout(timer); }
}

function linkedModelUrls(html) {
  const values = new Set();
  for (const match of html.matchAll(/href=["']([^"']+)["']/gi)) {
    const href = match[1].replace(/&amp;/g, '&');
    const absolute = href.startsWith('http') ? href : `https://sketchfab.com${href.startsWith('/') ? '' : '/'}${href}`;
    if (safePublicUrl(absolute) && /\/3d-models\//.test(new URL(absolute).pathname) && extractUid(absolute)) values.add(absolute);
  }
  return [...values];
}

function candidateRecord(url, sourceKind, result = {}) {
  return {
    candidate_url: url,
    source_kind: sourceKind,
    model_uid: extractUid(url),
    page_status: result.status ?? null,
    final_page_url: result.url ?? null,
    api_status: null,
    creator: null,
    license: null,
    name: null,
    technical: { archive_downloaded: false, formats: [], textures_inspected: false, polygon_count: null, scale_review: 'NOT_STARTED' },
    decision: 'PENDING_METADATA_AND_VISUAL_REVIEW',
    reasons: [],
  };
}

const report = {
  schema: 'rivet-run-sketchfab-intake/v1',
  run_id: runId,
  security: {
    token_source_present: Boolean(token),
    token_value_logged: false,
    policy: 'Credential is never emitted, persisted, committed, embedded in URLs, or used with a TLS/proxy/download bypass.',
  },
  input_urls_count: urls.length,
  candidates: [],
  failures: [],
  result: 'NOT_STARTED',
};

if (!token) {
  report.result = 'BLOCKED_NO_APPROVED_SECRET_ENV';
  report.failures.push({ code: 'SKETCHFAB_API_TOKEN_OR_SKETCHFAB_TOKEN_NOT_PRESENT', message: 'No approved environment/secret-store credential is available. No public-page crawl or authenticated API/download request was attempted.' });
} else if (!urls.length) {
  report.result = 'BLOCKED_NO_CANDIDATE_URLS';
  report.failures.push({ code: 'SKETCHFAB_CANDIDATE_URLS_NOT_PRESENT', message: 'Credential availability alone does not authorize guessing or crawling unknown models. Supply public collection/model URLs through non-secret configuration.' });
} else {
  const publicUrls = urls.filter(safePublicUrl);
  const invalidUrls = urls.filter((value) => !safePublicUrl(value));
  invalidUrls.forEach((url) => report.failures.push({ code: 'INVALID_OR_NON_PUBLIC_URL', url }));
  for (const sourceUrl of publicUrls) {
    const page = await request(sourceUrl, { headers: publicHeaders() }, 'public-page');
    if (!page.ok) {
      report.failures.push({ code: 'PUBLIC_PAGE_FETCH_FAILED', url: sourceUrl, status: page.status, error: page.error || null });
      continue;
    }
    const isCollection = /\/collections?\//.test(new URL(page.url).pathname);
    const modelUrls = extractUid(page.url) ? [page.url] : (isCollection ? linkedModelUrls(page.text).slice(0, 48) : linkedModelUrls(page.text).slice(0, 1));
    if (!modelUrls.length) {
      report.failures.push({ code: 'NO_PUBLIC_MODEL_UID_OR_LINK_FOUND', url: sourceUrl, status: page.status });
      continue;
    }
    for (const modelUrl of modelUrls) {
      const record = candidateRecord(modelUrl, isCollection ? 'public-collection-link' : 'public-model-page', page);
      if (!record.model_uid) { report.failures.push({ code: 'MODEL_UID_UNRESOLVED', url: modelUrl }); continue; }
      const api = await request(`https://api.sketchfab.com/v3/models/${record.model_uid}`, { headers: apiHeaders() }, 'authorized-model-metadata');
      record.api_status = api.status;
      if (!api.ok) {
        record.decision = 'REJECTED_UNAVAILABLE_OR_UNAUTHORIZED_METADATA';
        record.reasons.push(`Authorized metadata endpoint returned ${api.status ?? 'network failure'}.`);
        report.candidates.push(record);
        continue;
      }
      try {
        const model = JSON.parse(api.text);
        record.name = model.name || null;
        record.creator = model.user ? { username: model.user.username || null, display_name: model.user.displayName || null, profile_url: model.user.profileUrl || null } : null;
        record.license = model.license ? { label: model.license.label || null, url: model.license.url || null, requirements: model.license.requirements || null } : null;
        record.technical.formats = Array.isArray(model.archives) ? model.archives.map((archive) => archive.format || null).filter(Boolean) : [];
        record.reasons.push('Metadata resolved; preview, licence terms, archive authority, materials, textures, polygon count, scale and visual/context inspection are still required before download or approval.');
      } catch {
        record.decision = 'REJECTED_INVALID_METADATA_RESPONSE';
        record.reasons.push('Authorized endpoint response was not valid model metadata JSON.');
      }
      report.candidates.push(record);
    }
  }
  report.result = report.candidates.length ? 'METADATA_INTAKE_COMPLETE_NO_ASSET_APPROVED' : 'NO_CANDIDATES_RESOLVED';
}

await fs.mkdir(outputRoot, { recursive: true });
await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
// A per-run checksum verifies the report without preserving any credential material.
await fs.writeFile(path.join(outputRoot, `${runId}.sha256`), `${crypto.createHash('sha256').update(JSON.stringify(report)).digest('hex')}  ../latest_intake.json\n`);
console.log(JSON.stringify({ result: report.result, candidate_count: report.candidates.length, failure_codes: report.failures.map((failure) => failure.code), report: path.relative(root, reportPath) }, null, 2));
