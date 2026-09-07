#!/usr/bin/env node
/**
 * Validate semantic-review records without pretending to perform visual analysis.
 *
 * This command deliberately knows only the capture/review metadata contract. It
 * can reject stale or incomplete reviews, but it cannot see PNG pixels and can
 * never manufacture an art approval.
 */
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

const suppliedCapturePath = process.env.VISUAL_CAPTURE_MANIFEST;
const capturePath = suppliedCapturePath ? path.resolve(root, suppliedCapturePath) : path.join(visualRoot, 'capture_manifest.json');
if (!(await exists(capturePath))) {
  console.log(JSON.stringify({ status: 'BLOCKED_NO_CAPTURE_MANIFEST', capture_manifest: capturePath, message: 'No captured first-person frame manifest is available for semantic review.' }, null, 2));
  process.exit(0);
}
const capture = await json(capturePath);
const captureRunId = capture.capture_run_id || capture.run_id || null;
const capturedFrames = new Map((capture.frames || []).map((frame) => [frame.frame_id, frame]));
if (!captureRunId || !capturedFrames.size) {
  console.log(JSON.stringify({ status: 'BLOCKED_NO_CAPTURED_FRAMES', capture_manifest: capturePath, capture_run_id: captureRunId, message: 'A capture record needs a run ID and at least one player-height frame before review.' }, null, 2));
  process.exit(0);
}

const reviewDir = process.env.VISUAL_REVIEW_DIR ? path.resolve(root, process.env.VISUAL_REVIEW_DIR) : path.join(visualRoot, 'reviews');
const allReviewFiles = (await exists(reviewDir)) ? (await fs.readdir(reviewDir)).filter((file) => file.endsWith('.json')).sort() : [];
const matchingReviews = [];
let ignoredOtherRunRecords = 0;
for (const filename of allReviewFiles) {
  const review = await json(path.join(reviewDir, filename));
  if (review.capture_run_id === captureRunId) matchingReviews.push({ filename, review });
  else ignoredOtherRunRecords += 1;
}

const findings = [];
const representedRoles = new Set();
let candidateApproval = matchingReviews.length > 0;
for (const { filename, review } of matchingReviews) {
  const prefix = `${filename}:`;
  if (review.schema !== 'rivet-run-semantic-visual-review/v1') findings.push(`${prefix} invalid schema identifier`);
  if (!requiredRoles.includes(review.reviewer_role)) findings.push(`${prefix} invalid reviewer role`); else representedRoles.add(review.reviewer_role);
  if (!Array.isArray(review.frames) || !review.frames.length) findings.push(`${prefix} contains no reviewed frames`);
  for (const frame of review.frames || []) {
    const source = capturedFrames.get(frame.frame_id);
    if (!source) { findings.push(`${prefix}${frame.frame_id} was not captured in this run`); continue; }
    for (const key of ['region', 'player_state', 'seed']) if (frame[key] !== source[key]) findings.push(`${prefix}${frame.frame_id} ${key} does not match captured metadata`);
    for (const key of ['camera_position', 'camera_direction']) if (JSON.stringify(frame[key]) !== JSON.stringify(source[key])) findings.push(`${prefix}${frame.frame_id} ${key} does not match captured metadata`);
    for (const key of semanticFields) {
      const value = frame[key];
      if (value === undefined || (typeof value === 'string' && value.trim().length < 12) || (Array.isArray(value) && !value.length)) findings.push(`${prefix}${frame.frame_id} missing substantive ${key}`);
    }
    for (const score of scoreNames) if (typeof frame.scores?.[score] !== 'number' || frame.scores[score] < 0 || frame.scores[score] > 10) findings.push(`${prefix}${frame.frame_id} invalid ${score} score`);
    if (frame.approved && (frame.critic_status !== 'APPROVED' || frame.scores?.overall < 8.5 || scoreNames.some((score) => frame.scores?.[score] < 7.5))) findings.push(`${prefix}${frame.frame_id} approval violates the score/critic gate`);
    if (!frame.approved) candidateApproval = false;
  }
  if (review.approval?.status !== 'APPROVED') candidateApproval = false;
}
const missingRoles = requiredRoles.filter((role) => !representedRoles.has(role));
if (missingRoles.length) candidateApproval = false;
const status = findings.length ? 'INVALID_REVIEW_RECORDS' : (!matchingReviews.length ? 'CAPTURED_UNINSPECTED' : (candidateApproval ? 'REVIEW_GATE_CANDIDATE_ONLY' : 'REVIEWED_NOT_APPROVED'));
console.log(JSON.stringify({
  schema: 'rivet-run-visual-review-validation/v2', status, capture_run_id: captureRunId,
  capture_manifest: path.relative(root, capturePath), captured_frames: capturedFrames.size,
  review_records: matchingReviews.length, ignored_other_run_records: ignoredOtherRunRecords,
  represented_roles: [...representedRoles].sort(), missing_roles: missingRoles, findings,
  note: 'This validates metadata and review completeness only. It is not a vision system and cannot approve visual quality.'
}, null, 2));
