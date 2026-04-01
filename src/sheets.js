import { google } from "googleapis";

const SHEET_NAME = "ReelsData";
const REPORT_LOG_SHEET = "ReportLog";
const HEADER_ROW = [
  "submitted_at",
  "discord_user",
  "discord_interaction_id",
  "upload_date",
  "topic",
  "hook",
  "category",
  "likes",
  "comments",
  "shares",
  "saves",
  "views",
  "reach",
  "skip_rate",
  "average_watch_time",
  "follows",
  "commentary",
  "content_role",
  "key_insight",
  "recommended_action",
  "commentary_interpretation",
  "comparison_note"
];
const REPORT_LOG_HEADER_ROW = ["report_type", "report_key", "sent_at"];

function getSheetsClient() {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: privateKey
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });

  return google.sheets({ version: "v4", auth });
}

export async function ensureSheetHeader() {
  const sheets = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const existingSheetNames = new Set(
    (spreadsheet.data.sheets ?? []).map((sheet) => sheet.properties?.title).filter(Boolean)
  );

  const missingSheets = [SHEET_NAME, REPORT_LOG_SHEET].filter((name) => !existingSheetNames.has(name));

  if (missingSheets.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: missingSheets.map((title) => ({
          addSheet: {
            properties: { title }
          }
        }))
      }
    });
  }

  const currentValues =
    (
      await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${SHEET_NAME}!A1:V1`
      })
    ).data.values ?? [];

  const currentHeader = currentValues[0] ?? [];
  const headerMatches =
    currentHeader.length === HEADER_ROW.length &&
    HEADER_ROW.every((column, index) => currentHeader[index] === column);

  if (!headerMatches) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SHEET_NAME}!A1:V1`,
      valueInputOption: "RAW",
      requestBody: {
        values: [HEADER_ROW]
      }
    });
  }

  const reportLogValues =
    (
      await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${REPORT_LOG_SHEET}!A1:C1`
      })
    ).data.values ?? [];

  if (reportLogValues.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${REPORT_LOG_SHEET}!A1:C1`,
      valueInputOption: "RAW",
      requestBody: {
        values: [REPORT_LOG_HEADER_ROW]
      }
    });
  }
}

export async function appendSubmissionRow({ submission, discordUser, interactionId, submittedAt }) {
  const sheets = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${SHEET_NAME}!A:V`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [
        [
          submittedAt,
          discordUser,
          interactionId,
          submission.uploadDate ?? "",
          submission.topic ?? "",
          submission.hook ?? "",
          submission.category ?? "",
          submission.likes ?? "",
          submission.comments ?? "",
          submission.shares ?? "",
          submission.saves ?? "",
          submission.views ?? "",
          submission.reach ?? "",
          submission.skipRate ?? "",
          submission.averageWatchTime ?? "",
          submission.follows ?? "",
          submission.commentary ?? "",
          submission.contentRole ?? "",
          submission.keyInsight ?? "",
          submission.recommendedAction ?? "",
          submission.commentaryInterpretation ?? "",
          submission.comparisonNote ?? ""
        ]
      ]
    }
  });
}

export async function getSubmissionRows() {
  const sheets = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const values =
    (
      await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${SHEET_NAME}!A:V`
      })
    ).data.values ?? [];

  const [header = [], ...rows] = values;

  return rows.map((row) =>
    Object.fromEntries(header.map((column, index) => [column, row[index] ?? ""]))
  );
}

export async function hasReportBeenSent(reportType, reportKey) {
  const sheets = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const values =
    (
      await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${REPORT_LOG_SHEET}!A:C`
      })
    ).data.values ?? [];

  return values.slice(1).some((row) => row[0] === reportType && row[1] === reportKey);
}

export async function markReportSent(reportType, reportKey, sentAt) {
  const sheets = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${REPORT_LOG_SHEET}!A:C`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [[reportType, reportKey, sentAt]]
    }
  });
}
