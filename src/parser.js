const FIELD_LABELS = {
  topic: ["주제", "topic"],
  hook: ["후킹", "hook"],
  views: ["조회수", "views"],
  retention: ["유지율", "평균시청", "평균 시청", "retention"],
  saves: ["저장", "saves"],
  shares: ["공유", "shares"],
  comments: ["댓글", "comments"],
  earlyDropoff: ["초반이탈", "초반 이탈", "earlydropoff"],
  note: ["내느낌", "내 느낌", "느낌", "note"]
};

const REQUIRED_FIELDS = ["topic", "hook", "views", "retention", "saves", "shares"];

function normalizeKey(rawKey) {
  const compact = rawKey.trim().toLowerCase().replace(/\s+/g, "");

  for (const [field, aliases] of Object.entries(FIELD_LABELS)) {
    if (aliases.some((alias) => compact === alias.toLowerCase().replace(/\s+/g, ""))) {
      return field;
    }
  }

  return null;
}

export function parseSubmission(content) {
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const data = {};

  for (const line of lines) {
    const separatorIndex = line.indexOf(":");

    if (separatorIndex === -1) {
      continue;
    }

    const key = normalizeKey(line.slice(0, separatorIndex));
    const value = line.slice(separatorIndex + 1).trim();

    if (key && value) {
      data[key] = value;
    }
  }

  const missingFields = REQUIRED_FIELDS.filter((field) => !data[field]);

  return {
    isValid: missingFields.length === 0,
    missingFields,
    data
  };
}

export function formatMissingFields(missingFields) {
  const labels = {
    topic: "주제",
    hook: "후킹",
    views: "조회수",
    retention: "유지율/평균시청",
    saves: "저장",
    shares: "공유"
  };

  return missingFields.map((field) => labels[field] ?? field).join(", ");
}
