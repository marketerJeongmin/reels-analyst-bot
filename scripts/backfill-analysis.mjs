import "dotenv/config";
import { analyzeSubmission } from "../src/openai-client.js";
import {
  ensureSheetHeader,
  getSubmissionRows,
  updateSubmissionBackfillFields
} from "../src/sheets.js";

await ensureSheetHeader();
const rows = await getSubmissionRows();
const forceAll = process.argv.includes("--all");
const limitArg = process.argv.find((value) => value.startsWith("--limit="));
const limit = Number(limitArg?.split("=")[1] || 3) || 3;

const targets = forceAll
  ? rows
  : [...rows]
      .sort((a, b) => b._rowNumber - a._rowNumber)
      .slice(0, limit);

console.log(`Backfill target rows: ${targets.length}`);

for (let index = 0; index < targets.length; index += 1) {
  const row = targets[index];
  const submission = {
    uploadDate: normalizeUploadDate(row.upload_date || ""),
    topic: row.topic || "",
    hook: row.hook || "",
    category: row.category || "",
    likes: row.likes || "",
    comments: row.comments || "",
    shares: row.shares || "",
    saves: row.saves || "",
    views: row.views || "",
    reach: row.reach || "",
    skipRate: row.skip_rate || "",
    averageWatchTime: row.average_watch_time || "",
    follows: row.follows || "",
    commentary: row.commentary || ""
  };

  const historicalRows = rows.filter((candidate) => candidate._rowNumber !== row._rowNumber);
  const analysis = await analyzeSubmission(submission, historicalRows);

  await updateSubmissionBackfillFields(row._rowNumber, {
    uploadDate: submission.uploadDate,
    contentRole: analysis.contentRole,
    keyInsight: analysis.keyInsight,
    recommendedAction: analysis.recommendedAction,
    commentaryInterpretation: analysis.commentaryInterpretation,
    comparisonNote: analysis.comparisonNote
  });

  console.log(
    `Updated row ${row._rowNumber} (${index + 1}/${targets.length}): ${row.topic || "untitled"}`
  );
}

console.log("Backfill complete.");

function normalizeUploadDate(value) {
  const trimmed = String(value || "").trim();
  const rawDigits = trimmed.match(/\d+/g)?.join("") ?? "";

  if (rawDigits.length === 8) {
    return `${rawDigits.slice(0, 4)}-${rawDigits.slice(4, 6)}-${rawDigits.slice(6, 8)}`;
  }

  if (rawDigits.length === 6) {
    return `20${rawDigits.slice(0, 2)}-${rawDigits.slice(2, 4)}-${rawDigits.slice(4, 6)}`;
  }

  const parts = trimmed.match(/\d+/g);
  if (!parts || parts.length < 3) {
    return trimmed;
  }

  const [yearRaw, monthRaw, dayRaw] = parts;
  const year = yearRaw.padStart(4, "20").slice(-4);
  const month = monthRaw.padStart(2, "0");
  const day = dayRaw.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
