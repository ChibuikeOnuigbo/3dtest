#!/usr/bin/env node
/** Validate semantic-review records without pretending to perform visual analysis. */
import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const visualRoot = path.join(root, 'qa/visual');
const requiredRoles = [
  'AAA_INDIE_ART_DIRECTOR', 'LEVEL_DESIGNER', 'ENVIRONMENT_ARTIST', 'TECHNICAL_ARTIST',
  'PARKOUR_DESIGNER', 'FIRST_PERSON_MOVEMENT_DESIGNER', 'PLAYER_FUN_TESTER',
  'PERFORMANCE_REVIEWER', 'HOSTILE_QUALITY_CRITIC',
];
const scoreNames = ['composition', 'place_believability', 'materials', 'route_readability', 'depth_scenery', 'transition', 'first_person_experience', 'identity', 'overall'];
const semanticFields = ['what_is_visible', 'what_looks_bad', 'placeholder_signals', 'repetition', 'unconvincing_elements', 'dead_zone_assessment', 'missing', 'replace', 'move', 'add', 'remove'];

async function exists(file) { try { await fs.access(file); return true; } catch { return false; } }
async function json(file) { return JSON.parse(await fs.readFile(file, 'utf8')); }

const capturePath = process.env.VISUAL_CAPTURE_MANIFEST || path.join(visualRoot, 'capture_manifest.json');
if (!(await exists(capturePath))) {
  console.log(JSON.stringify({ status: 'BLOCKED_NO_CAPTURE_MANIFEST', capture_manifest: capturePath, message: 'No captured first-person frame manifest is available for semantic review.' }, null, 2));
  process.exit(0);
}
const capture = await json(capturePath);
const capturedFrames = new Map((capture.frames || []).map((frame) => [frame.frame_id, frame]));
if (!capturedFrames.size) {
  console.log(JSON.stringify({ status: 'BLOCKED_NO_CAPTURED_FRAMES', capture_run_id: capture.capture_run_id, message: 'A manifest without frames is not reviewable.' }, null, 2));
  process.exit(0);
}
const reviewDir = path.join(visualRoot, 'reviews');
const reviewFiles = (await exists(reviewDir)) ? (await fs.readdir(reviewDir)).filter((file) => file.endsWith('.json')).sort() : [];
const findings = [];
const representedRoles = new Set();
let candidateApproval = true;
for (const filename of reviewFiles) {
  const review = await json(path.join(reviewDir, filename));
  const prefix = `${filename}:`;
  if (review.schema !== 'rivet-run-semantic-visual-review/v1') findings.push(`${prefix} invalid schema identifier`);
  if (review.capture_run_id !== capture.capture_run_id) findings.push(`${prefix} refers to a different capture run`);
  if (!requiredRoles.includes(review.reviewer_role)) findings.push(`${prefix} invalid reviewer role`); else representedRoles.add(review.reviewer_role);
  if (!Array.isArray(review.frames) || !review.frames.length) findings.push(`${prefix} contains no reviewed frames`);
  for (const frame of review.frames || []) {
    const source = capturedFrames.get(frame.frame_id);
    if (!source) { findings.push(`${prefix}${frame.frame_id} was not captured in this run`); continue; }
    for (const key of ['region', 'player_state', 'seed']) if (frame[key] !== source[key]) findings.push(`${prefix}${frame.frame_id} ${key} does not match captured metadata`);
    for (const key of ['camera_position', 'camera_direction']) if (JSON.stringify(frame[key]) !== JSON.stringify(source[key])) findings.push(`${prefix}${frame.frame_id} ${key} does not match captured metadata`);
    for (const key of semanticFields) if (frame[key] === undefined || (typeof frame[key] === 'string' && frame[key].trim().length < 12)) findings.push(`${prefix}${frame.frame_id} missing substantive ${key}`);
    for (const score of scoreNames) if (typeof frame.scores?.[score] !== 'number' || frame.scores[score] < 0 || frame.scores[score] > 10) findings.push(`${prefix}${frame.frame_id} invalid ${score} score`);
    if (frame.approved && (frame.critic_status !== 'APPROVED' || frame.scores?.overall < 8.5 || scoreNames.some((score) => frame.scores?.[score] < 7.5))) findings.push(`${prefix}${frame.frame_id} approval violates the score/critic gate`);
    if (!frame.approved) candidateApproval = false;
  }
  if (review.approval?.status !== 'APPROVED') candidateApproval = false;
}
const missingRoles = requiredRoles.filter((role) => !representedRoles.has(role));
if (missingRoles.length) candidateApproval = false;
const status = findings.length ? 'INVALID_REVIEW_RECORDS' : (!reviewFiles.length ? 'CAPTURED_UNINSPECTED' : (candidateApproval ? 'REVIEW_GATE_CANDIDATE_ONLY' : 'REVIEWED_NOT_APPROVED'));
console.log(JSON.stringify({
  schema: 'rivet-run-visual-review-validation/v1', status, capture_run_id: capture.capture_run_id,
  captured_frames: capturedFrames.size, review_records: reviewFiles.length,
  represented_roles: [...representedRoles].sort(), missing_roles: missingRoles, findings,
  note: 'This validates metadata and review completeness only. It is not a vision system and cannot approve visual quality.'
}, null, 2));
