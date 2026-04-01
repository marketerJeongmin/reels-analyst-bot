import "dotenv/config";
import { analyzeSubmission } from "../src/openai-client.js";
import {
  ensureSheetHeader,
  getSubmissionRows,
  updateSubmissionAnalysisFields
} from "../src/sheets.js";

await ensureSheetHeader();
const rows = await getSubmissionRows();
const forceAll = process.argv.includes("--all");

const targets = forceAll
  ? rows
  : rows.filter(
      (row) =>
        !String(row.content_role || "").trim() ||
        !String(row.key_insight || "").trim() ||
        !String(row.recommended_action || "").trim()
    );

console.log(`Backfill target rows: ${targets.length}`);

for (let index = 0; index < targets.length; index += 1) {
  const row = targets[index];
  const submission = {
    uploadDate: row.upload_date || "",
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

  await updateSubmissionAnalysisFields(row._rowNumber, {
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
