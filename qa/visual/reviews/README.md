# Semantic review input

Each JSON file in this directory is the judgment of **one independent,
vision-capable reviewer role** over one immutable capture run/revision. It must
conform to `../review_contract.schema.json`, cite only images actually inspected,
and keep the captured camera/player metadata copied from `capture_manifest.json`.

Do not create a review from filenames, pixel statistics, source code, expected
layout, test output, or a prior visual score. When art/geometry changes, capture
a new run ID and create fresh reviews; never carry an approval forward.

Run `node tools/qa/validate_visual_reviews.mjs` to validate coverage/status. The
validator checks paperwork consistency only. It never analyzes imagery, assigns
scores, or creates approval.
