import "dotenv/config";
import {
  ActionRowBuilder,
  ChannelType,
  Client,
  Events,
  GatewayIntentBits,
  ModalBuilder,
  REST,
  Routes,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle
} from "discord.js";
import { analyzeSubmission } from "./openai-client.js";
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

const INPUT_MODAL_PREFIX = "reels-input";
const CATEGORY_CHOICES = [
  { name: "내 스토리", value: "내 스토리" },
  { name: "정보성", value: "정보성" },
  { name: "임장", value: "임장" }
];

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once(Events.ClientReady, async (readyClient) => {
  await ensureSheetHeader();
  await registerSlashCommand(readyClient);
  console.log(`Logged in as ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    await handleSlashCommand(interaction);
    return;
  }

  if (interaction.isModalSubmit()) {
    await handleModalSubmit(interaction);
  }
});

async function registerSlashCommand(readyClient) {
  const inputChannel = await readyClient.channels.fetch(process.env.DISCORD_INPUT_CHANNEL_ID);

  if (!inputChannel?.guildId) {
    throw new Error("Input channel is missing a guildId.");
  }

  const command = new SlashCommandBuilder()
    .setName("reels-input")
    .setDescription("릴스 성과 입력 폼을 엽니다.")
    .addStringOption((option) =>
      option
        .setName("업로드날짜")
        .setDescription("예: 2026-03-27")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("분류")
        .setDescription("콘텐츠 분류를 고르세요.")
        .setRequired(true)
        .addChoices(...CATEGORY_CHOICES)
    );

  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
  await rest.put(Routes.applicationGuildCommands(readyClient.user.id, inputChannel.guildId), {
    body: [command.toJSON()]
  });
}

async function handleSlashCommand(interaction) {
  if (interaction.commandName !== "reels-input") {
    return;
  }

  if (interaction.channelId !== process.env.DISCORD_INPUT_CHANNEL_ID) {
    await interaction.reply({
      content: "이 명령은 `릴스-입력` 채널에서만 써주세요.",
      ephemeral: true
    });
    return;
  }

  const category = interaction.options.getString("분류", true);
  const uploadDate = interaction.options.getString("업로드날짜", true);
  const modal = new ModalBuilder()
    .setCustomId(`${INPUT_MODAL_PREFIX}:${encodeURIComponent(category)}:${encodeURIComponent(uploadDate)}`)
    .setTitle(`릴스 입력 - ${category}`);

  const fields = [
    new TextInputBuilder()
      .setCustomId("topic")
      .setLabel("주제")
      .setPlaceholder("예: 서울에서 첫 집 살 때 가장 먼저 해야 할 것")
      .setStyle(TextInputStyle.Short)
      .setRequired(true),
    new TextInputBuilder()
      .setCustomId("hook")
      .setLabel("후킹")
      .setPlaceholder("예: 361일 안에 서울에 집 살 수 있을까요? Day 14")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true),
    new TextInputBuilder()
      .setCustomId("metricsA")
      .setLabel("좋아요 / 댓글 / 공유 / 저장")
      .setPlaceholder("예: 좋아요 145 / 댓글 18 / 공유 41 / 저장 217")
      .setStyle(TextInputStyle.Short)
      .setRequired(true),
    new TextInputBuilder()
      .setCustomId("metricsB")
      .setLabel("조회수 / 도달 / 건너뛰기 / 평균시청 / 팔로우")
      .setPlaceholder("예: 조회수 12432 / 도달 9510 / 건너뛰기 32% / 평균시청 7.8초 / 팔로우 12")
      .setStyle(TextInputStyle.Short)
      .setRequired(true),
    new TextInputBuilder()
      .setCustomId("commentary")
      .setLabel("내 코멘트")
      .setPlaceholder("예: 초반 후킹은 좋았는데 중간 설명이 길었음")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
  ];

  modal.addComponents(
    fields.map((field) => new ActionRowBuilder().addComponents(field))
  );

  await interaction.showModal(modal);
}

async function handleModalSubmit(interaction) {
  if (!interaction.customId.startsWith(`${INPUT_MODAL_PREFIX}:`)) {
    return;
  }

  const [, encodedCategory, encodedUploadDate] = interaction.customId.split(":");
  const category = decodeURIComponent(encodedCategory ?? "");
  const uploadDate = decodeURIComponent(encodedUploadDate ?? "");

  try {
    const submission = {
      uploadDate: normalizeUploadDate(uploadDate),
      topic: interaction.fields.getTextInputValue("topic").trim(),
      hook: interaction.fields.getTextInputValue("hook").trim(),
      category,
      ...parseMetricGroupA(interaction.fields.getTextInputValue("metricsA")),
      ...parseMetricGroupB(interaction.fields.getTextInputValue("metricsB")),
      commentary: interaction.fields.getTextInputValue("commentary").trim()
    };

    await interaction.reply({
      content: "입력 저장 중이에요. 분석이 끝나면 `릴스-분석` 채널에 올릴게요.",
      ephemeral: true
    });

    await appendSubmissionRow({
      submission,
      discordUser: interaction.user.username,
      interactionId: interaction.id,
      submittedAt: new Date().toISOString()
    });

    const analysis = await analyzeSubmission(submission);
    const outputChannel = await client.channels.fetch(process.env.DISCORD_OUTPUT_CHANNEL_ID);

    if (!outputChannel || outputChannel.type !== ChannelType.GuildText) {
      throw new Error("Output channel was not found or is not a text channel.");
    }

    const summary = [
      "새 릴스 분석이 도착했어요.",
      `업로드 날짜: ${submission.uploadDate}`,
      `주제: ${submission.topic}`,
      `분류: ${submission.category}`,
      `후킹: ${submission.hook}`,
      "",
      analysis
    ].join("\n");

    await outputChannel.send(summary);
  } catch (error) {
    console.error(error);

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: "저장 또는 분석 중에 오류가 났어요. 설정이나 입력 형식을 한 번 확인해 주세요.",
        ephemeral: true
      });
      return;
    }

    await interaction.reply({
      content: "저장 또는 분석 중에 오류가 났어요. 설정이나 입력 형식을 한 번 확인해 주세요.",
      ephemeral: true
    });
  }
}

function parseMetricGroupA(rawValue) {
  const parts = rawValue.split("/").map((part) => part.trim());

  if (parts.length !== 4) {
    throw new Error("metricsA must include likes, comments, shares, and saves.");
  }

  return {
    likes: stripMetricLabel(parts[0]),
    comments: stripMetricLabel(parts[1]),
    shares: stripMetricLabel(parts[2]),
    saves: stripMetricLabel(parts[3])
  };
}

function parseMetricGroupB(rawValue) {
  const parts = rawValue.split("/").map((part) => part.trim());

  if (parts.length !== 5) {
    throw new Error("metricsB must include views, reach, skip rate, average watch time, and follows.");
  }

  return {
    views: stripMetricLabel(parts[0]),
    reach: stripMetricLabel(parts[1]),
    skipRate: stripMetricLabel(parts[2]),
    averageWatchTime: stripMetricLabel(parts[3]),
    follows: stripMetricLabel(parts[4])
  };
}

function stripMetricLabel(value) {
  const match = value.match(/^[^0-9\-]*([0-9][^]*)$/);
  return match ? match[1].trim() : value.trim();
}

function normalizeUploadDate(value) {
  const trimmed = value.trim();
  const digits = trimmed.match(/\d+/g);

  if (!digits || digits.length < 3) {
    return trimmed;
  }

  const [yearRaw, monthRaw, dayRaw] = digits;
  const year = yearRaw.padStart(4, "20").slice(-4);
  const month = monthRaw.padStart(2, "0");
  const day = dayRaw.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

client.login(process.env.DISCORD_TOKEN);
