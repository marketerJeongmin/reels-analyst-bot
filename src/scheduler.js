import { buildMonthlyReport, buildWeeklyReport, shouldSendMonthlyReport, shouldSendWeeklyReport } from "./reports.js";

export function startReportScheduler({
  client,
  getRows,
  hasSent,
  markSent,
  outputChannelId,
  mentionId
}) {
  let isRunning = false;

  const run = async () => {
    if (isRunning) {
      return;
    }

    isRunning = true;

    try {
      const now = new Date();
      const rows = await getRows();
      const outputChannel = await client.channels.fetch(outputChannelId);

      if (!outputChannel) {
        throw new Error("Output channel not found for scheduler.");
      }

      if (shouldSendWeeklyReport(now)) {
        const weekly = await buildWeeklyReport(rows, now);
        const alreadySent = await hasSent("weekly", weekly.reportKey);

        if (!alreadySent) {
          await outputChannel.send(prefixMention(mentionId, weekly.content));
          await markSent("weekly", weekly.reportKey, now.toISOString());
        }
      }

      if (shouldSendMonthlyReport(now)) {
        const monthly = await buildMonthlyReport(rows, now);
        const alreadySent = await hasSent("monthly", monthly.reportKey);

        if (!alreadySent) {
          await outputChannel.send(prefixMention(mentionId, monthly.content));
          await markSent("monthly", monthly.reportKey, now.toISOString());
        }
      }
    } catch (error) {
      console.error("Report scheduler error", error);
    } finally {
      isRunning = false;
    }
  };

  run();
  return setInterval(run, 60 * 1000);
}

function prefixMention(mentionId, content) {
  if (!mentionId) {
    return content;
  }

  return `<@${mentionId}>\n${content}`;
}
