import { google } from "googleapis";

const SHEET_NAME = "ReelsData";
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
  "saves",
  "shares",
  "views",
  "reach",
  "skip_rate",
  "average_watch_time",
  "follows",
  "commentary"
];

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

  const currentValues =
    (
      await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${SHEET_NAME}!A1:Q1`
      })
    ).data.values ?? [];

  if (currentValues.length > 0) {
    return;
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_NAME}!A1:Q1`,
    valueInputOption: "RAW",
    requestBody: {
      values: [HEADER_ROW]
    }
  });
}

export async function appendSubmissionRow({ submission, discordUser, interactionId, submittedAt }) {
  const sheets = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${SHEET_NAME}!A:Q`,
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
          submission.saves ?? "",
          submission.shares ?? "",
          submission.views ?? "",
          submission.reach ?? "",
          submission.skipRate ?? "",
          submission.averageWatchTime ?? "",
          submission.follows ?? "",
          submission.commentary ?? ""
        ]
      ]
    }
  });
}
