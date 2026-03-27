import "dotenv/config";
import { ChannelType, Client, Events, GatewayIntentBits } from "discord.js";
import { analyzeSubmission } from "./openai-client.js";
import { formatMissingFields, parseSubmission } from "./parser.js";
import { appendSubmissionRow, ensureSheetHeader } from "./sheets.js";

const requiredEnvVars = [
  "DISCORD_TOKEN",
  "DISCORD_INPUT_CHANNEL_ID",
  "DISCORD_OUTPUT_CHANNEL_ID",
  "OPENAI_API_KEY",
  "GOOGLE_SHEET_ID",
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_PRIVATE_KEY"
];

for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once(Events.ClientReady, async (readyClient) => {
  await ensureSheetHeader();
  console.log(`Logged in as ${readyClient.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) {
    return;
  }

  console.log("Message received", {
    channelId: message.channelId,
    author: message.author.username,
    preview: message.content.slice(0, 80)
  });

  if (message.channelId !== process.env.DISCORD_INPUT_CHANNEL_ID) {
    console.log("Ignoring message from non-input channel", {
      expected: process.env.DISCORD_INPUT_CHANNEL_ID,
      actual: message.channelId
    });
    return;
  }

  try {
    const parsed = parseSubmission(message.content);

    if (!parsed.isValid) {
      await message.reply(
        [
          "입력 형식이 조금 부족해요.",
          `빠진 항목: ${formatMissingFields(parsed.missingFields)}`,
          "",
          "아래 형식으로 다시 보내주세요.",
          "주제:",
          "후킹:",
          "조회수:",
          "유지율:",
          "저장:",
          "공유:",
          "댓글:",
          "초반이탈:",
          "내느낌:"
        ].join("\n")
      );
      return;
    }

    console.log("Submission parsed successfully");

    await appendSubmissionRow({
      submission: parsed.data,
      discordUser: `${message.author.username}#${message.author.discriminator}`,
      messageId: message.id,
      submittedAt: new Date().toISOString()
    });

    console.log("Submission appended to Google Sheets");

    const analysis = await analyzeSubmission(parsed.data);
    console.log("OpenAI analysis complete");
    const outputChannel = await client.channels.fetch(process.env.DISCORD_OUTPUT_CHANNEL_ID);

    if (!outputChannel || outputChannel.type !== ChannelType.GuildText) {
      throw new Error("Output channel was not found or is not a text channel.");
    }

    const summary = [
      "새 릴스 분석이 도착했어요.",
      `주제: ${parsed.data.topic}`,
      `후킹: ${parsed.data.hook}`,
      "",
      analysis
    ].join("\n");

    await outputChannel.send(summary);
    await message.react("✅");
  } catch (error) {
    console.error(error);
    await message.reply("저장 또는 분석 중에 오류가 났어요. 설정 값을 한 번 확인해 주세요.");
  }
});

client.login(process.env.DISCORD_TOKEN);
