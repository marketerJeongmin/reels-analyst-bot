const TIMEZONE = process.env.REPORT_TIMEZONE || "Asia/Seoul";
const FAN_SCORE_BENCHMARK = 6.3;
const LOW_VIEW_RATE_BENCHMARK = 1.0;
const LOW_LIKE_RATE_BENCHMARK = 0.6;
const LOW_COMMENT_RATE_BENCHMARK = 0.08;
const LOW_SHARE_RATE_BENCHMARK = 0.25;
const LOW_SAVE_RATE_BENCHMARK = 0.4;

export async function buildWeeklyReport(rows, now = new Date()) {
  const current = getZonedParts(now);
  const weekStart = startOfWeek(current);
  let filtered = rows.filter((row) => {
    const date = parseUploadDate(getUploadDateValue(row));
    return date && compareDate(date, weekStart) >= 0 && compareDate(date, current) <= 0;
  });
  let periodStart = weekStart;

  if (filtered.length === 0) {
    periodStart = shiftDate(current, -6);
    filtered = rows.filter((row) => {
      const date = parseUploadDate(getUploadDateValue(row));
      return date && compareDate(date, periodStart) >= 0 && compareDate(date, current) <= 0;
    });
  }

  return {
    reportKey: `${current.year}-W${getWeekKey(current)}`,
    title: "주간 릴스 리포트",
    periodLabel: `${formatDate(periodStart)} ~ ${formatDate(current)}`,
    content: renderPeriodicReport("weekly", filtered, periodStart, current)
  };
}

export async function buildMonthlyReport(rows, now = new Date()) {
  const current = getZonedParts(now);
  const monthStart = { year: current.year, month: current.month, day: 1 };
  const filtered = rows.filter((row) => {
    const date = parseUploadDate(getUploadDateValue(row));
    return date && compareDate(date, monthStart) >= 0 && compareDate(date, current) <= 0;
  });

  return {
    reportKey: `${current.year}-${String(current.month).padStart(2, "0")}`,
    title: "월간 릴스 리포트",
    periodLabel: `${current.year}-${String(current.month).padStart(2, "0")}`,
    content: renderPeriodicReport("monthly", filtered, monthStart, current)
  };
}

export function shouldSendWeeklyReport(now = new Date()) {
  const current = getZonedParts(now);
  return current.weekday === "Fri" && current.hour === 19 && current.minute < 5;
}

export function shouldSendMonthlyReport(now = new Date()) {
  const current = getZonedParts(now);
  return isLastDayOfMonth(current) && current.hour === 19 && current.minute < 5;
}

function renderPeriodicReport(kind, rows, startDate, endDate) {
  const consolidatedRows = consolidateRows(rows);

  if (consolidatedRows.length === 0) {
    return [
      `### ${kind === "weekly" ? "주간" : "월간"} 리포트`,
      "",
      `기간: ${formatDate(startDate)} ~ ${formatDate(endDate)}`,
      "",
      "이번 기간에는 집계할 릴스 데이터가 없어요."
    ].join("\n");
  }

  const scoredRows = consolidatedRows.map((row) => {
    const metrics = computeScores(row);
    return { ...row, ...metrics };
  });

  const averageViews = average(scoredRows.map((row) => row.views));
  const averageHook = average(scoredRows.map((row) => row.hookScore));
  const averageValue = average(scoredRows.map((row) => row.valueScore));
  const averageFan = average(scoredRows.map((row) => row.fanScore));
  const averageLikeRate = average(scoredRows.map((row) => row.likeRate));
  const averageCommentRate = average(scoredRows.map((row) => row.commentRate));
  const averageShareRate = average(scoredRows.map((row) => row.shareRate));
  const averageSaveRate = average(scoredRows.map((row) => row.saveRate));
  const averageViewRate = average(scoredRows.map((row) => row.viewRate));

  const byCategory = groupBy(scoredRows, "category");
  const categoryLines = Object.entries(byCategory)
    .map(([category, categoryRows]) => {
      const avgViews = average(categoryRows.map((row) => row.views));
      const avgHook = average(categoryRows.map((row) => row.hookScore));
      const avgValue = average(categoryRows.map((row) => row.valueScore));
      const avgFan = average(categoryRows.map((row) => row.fanScore));
      return `- ${category}: 평균 조회수 ${formatNumber(avgViews)}, 후킹 ${formatOne(avgHook)}점, 가치 ${formatOne(avgValue)}점, 팬 전환 ${formatOne(avgFan)}점`;
    })
    .join("\n");

  const bestRow = [...scoredRows].sort((a, b) => {
    const scoreA = a.valueScore + a.fanScore + a.hookScore * 0.25;
    const scoreB = b.valueScore + b.fanScore + b.hookScore * 0.25;
    return scoreB - scoreA;
  })[0];
  const weakCandidates = [...scoredRows].sort((a, b) => {
    const scoreA = a.hookScore + a.valueScore + a.fanScore;
    const scoreB = b.hookScore + b.valueScore + b.fanScore;
    return scoreA - scoreB;
  });
  const weakRow =
    scoredRows.length > 1 ? weakCandidates.find((row) => row.topic !== bestRow.topic) ?? weakCandidates[0] : null;
  const repeatWatchRows = scoredRows.filter((row) => row.views > row.reach);
  const topCommentary = extractCommonKeywords(scoredRows.map((row) => row.commentary).filter(Boolean));
  const roleSummary = summarizeRoles(scoredRows);
  const topInsights = summarizeText(scoredRows.map((row) => row.key_insight || row.keyInsight), 1, 55);
  const repeatedActions = summarizeText(
    scoredRows.map((row) => row.recommended_action || row.recommendedAction),
    1,
    55
  );
  const commentaryPatterns = summarizeText(
    scoredRows.map((row) => row.commentary_interpretation || row.commentaryInterpretation),
    1,
    55
  );
  const updateTrendSummary = summarizeText(scoredRows.map((row) => row.update_trend), 1, 65);

  const metricDiagnosis = buildMetricDiagnosis({
    averageViewRate,
    averageLikeRate,
    averageCommentRate,
    averageShareRate,
    averageSaveRate
  });
  const actions = buildActions(scoredRows, metricDiagnosis);

  return [
    `### ${kind === "weekly" ? "주간" : "월간"} 릴스 리포트`,
    "",
    `기간: ${formatDate(startDate)} ~ ${formatDate(endDate)}`,
    `업로드 수: ${consolidatedRows.length}개`,
    `평균 조회수: ${formatNumber(averageViews)}`,
    `평균 후킹 점수: ${formatOne(averageHook)}점`,
    `평균 가치 점수: ${formatOne(averageValue)}점`,
    `평균 팬 전환 점수: ${formatOne(averageFan)}점`,
    "",
    "**지표별 진단**",
    `- 조회수: ${metricDiagnosis.views}`,
    `- 좋아요: ${metricDiagnosis.likes}`,
    `- 댓글: ${metricDiagnosis.comments}`,
    `- 공유: ${metricDiagnosis.shares}`,
    `- 저장: ${metricDiagnosis.saves}`,
    "",
    "**영상 역할 패턴**",
    roleSummary,
    "",
    "**분류별 성과**",
    categoryLines || "- 분류 데이터 없음",
    "",
    "**가장 잘된 영상**",
    `- ${bestRow.topic}: 조회수 ${formatNumber(bestRow.views)}, 가치 ${formatOne(bestRow.valueScore)}점, 팬 전환 ${formatOne(bestRow.fanScore)}점`,
    "",
    "**가장 아쉬운 영상**",
    weakRow
      ? `- ${weakRow.topic}: 후킹 ${formatOne(weakRow.hookScore)}점, 가치 ${formatOne(weakRow.valueScore)}점, 팬 전환 ${formatOne(weakRow.fanScore)}점`
      : "- 이번 기간에는 1개 영상만 있어 비교형 워스트 선정은 생략합니다.",
    "",
    "**패턴 메모**",
    repeatWatchRows.length > 0
      ? `- 조회수 > 도달 계정 수 영상 ${repeatWatchRows.length}개: 반복 시청 가능성이 있는 레이아웃입니다.`
      : "- 반복 시청 패턴은 아직 뚜렷하지 않습니다.",
    topCommentary
      ? `- 코멘트 반복 키워드: ${topCommentary}`
      : "- 코멘트 반복 키워드는 아직 적습니다.",
    updateTrendSummary
      ? `- 업데이트 추이 메모: ${updateTrendSummary}`
      : "- 업데이트 추이 메모는 아직 적습니다.",
    topInsights
      ? `- 반복 인사이트: ${topInsights}`
      : "- 반복 인사이트 데이터는 아직 적습니다.",
    commentaryPatterns
      ? `- 코멘트 해석 패턴: ${commentaryPatterns}`
      : "- 코멘트 해석 패턴은 아직 적습니다.",
    "",
    kind === "weekly" ? "**다음 주 액션**" : "**다음 달 전략**",
    ...actions.map((action) => `- ${action}`),
    repeatedActions ? `- 반복 추천 액션: ${repeatedActions}` : ""
  ]
    .filter(Boolean)
    .join("\n");
}

function consolidateRows(rows) {
  const groups = new Map();

  for (const row of rows) {
    const key = buildRowKey(row);
    const existing = groups.get(key) ?? [];
    existing.push(row);
    groups.set(key, existing);
  }

  return [...groups.values()].map((group) => mergeRowGroup(group));
}

function buildRowKey(row) {
  const parsedDate = parseUploadDate(row.upload_date || row.uploadDate || "");
  const uploadDate = parsedDate ? formatDate(parsedDate) : row.upload_date || row.uploadDate || "";
  const category = row.category || "";
  const normalizedHook = normalizeContentKey(row.hook || "");
  const normalizedTopic = normalizeContentKey(row.topic || "");

  return [
    uploadDate,
    category,
    normalizedHook || normalizedTopic
  ].join("::");
}

function mergeRowGroup(group) {
  const sorted = [...group].sort((a, b) =>
    String(a.submitted_at || a.submittedAt || "").localeCompare(String(b.submitted_at || b.submittedAt || ""))
  );
  const latest = sorted[sorted.length - 1] ?? {};

  return {
    ...latest,
    commentary: joinUnique(sorted.map((row) => row.commentary)),
    key_insight: joinUnique(sorted.map((row) => row.key_insight || row.keyInsight)),
    recommended_action: joinUnique(sorted.map((row) => row.recommended_action || row.recommendedAction)),
    commentary_interpretation: joinUnique(
      sorted.map((row) => row.commentary_interpretation || row.commentaryInterpretation)
    ),
    comparison_note: joinUnique(sorted.map((row) => row.comparison_note || row.comparisonNote)),
    update_count: String(sorted.length),
    update_trend: buildUpdateTrend(sorted)
  };
}

function joinUnique(values) {
  const unique = [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
  return unique.join(" / ");
}

function buildUpdateTrend(rows) {
  if (rows.length <= 1) {
    return "";
  }

  const first = rows[0];
  const last = rows[rows.length - 1];
  const likeDiff = toNumber(last.likes) - toNumber(first.likes);
  const commentDiff = toNumber(last.comments) - toNumber(first.comments);
  const shareDiff = toNumber(last.shares) - toNumber(first.shares);
  const saveDiff = toNumber(last.saves) - toNumber(first.saves);
  const followDiff = toNumber(last.follows) - toNumber(first.follows);

  const changes = [
    likeDiff > 0 ? `좋아요 +${likeDiff}` : "",
    commentDiff > 0 ? `댓글 +${commentDiff}` : "",
    shareDiff > 0 ? `공유 +${shareDiff}` : "",
    saveDiff > 0 ? `저장 +${saveDiff}` : "",
    followDiff > 0 ? `팔로우 +${followDiff}` : ""
  ].filter(Boolean);

  if (changes.length === 0) {
    return "";
  }

  return `업데이트 추이: ${changes.join(", ")}`;
}

function buildActions(rows, metricDiagnosis) {
  const infoRows = rows.filter((row) => row.category === "정보성");
  const storyRows = rows.filter((row) => row.category === "내 스토리");
  const avgInfoValue = average(infoRows.map((row) => row.valueScore));
  const avgStoryValue = average(storyRows.map((row) => row.valueScore));
  const avgHook = average(rows.map((row) => row.hookScore));

  const actions = [];

  if (avgInfoValue >= avgStoryValue && infoRows.length > 0) {
    actions.push("정보성은 '기준 1개 + 사례 1개'로 쪼개 저장 이유를 더 분명하게 만드세요.");
  }

  if (storyRows.length > 0 && avgStoryValue < avgInfoValue) {
    actions.push("스토리형은 경험 한 줄 뒤에 숫자나 기준 한 줄을 붙여 감정과 정보를 같이 잡으세요.");
  }

  if (avgHook < 60) {
    actions.push("첫 2초에 질문보다 지역명·숫자·결론을 먼저 보여주고, 첫 자막과 표지를 같은 문장으로 맞추세요.");
  } else {
    actions.push("후킹은 유지하고, 중간 장면에 비교표나 근거 컷을 넣어 이탈을 더 줄이세요.");
  }

  const lowestActionMap = {
    views:
      "조회수가 약하면 제목·표지·첫 자막을 한 문장으로 묶고, 첫 장면에 결론이나 지역명을 먼저 보여주세요.",
    likes:
      "좋아요가 약하면 본문 앞에 '저도 처음엔 헷갈렸어요' 같은 공감 한 줄과 개인 경험 한 줄을 더하세요.",
    comments:
      "댓글이 약하면 마지막 질문을 선택형이나 찬반형으로 바꾸고, 댓글 보상 문구를 같이 넣어보세요.",
    shares:
      "공유가 약하면 비교/경고/전후 차이 같은 문장을 넣어 '이거 너 얘기 아님?' 감을 만들어보세요.",
    saves: "저장이 약하면 체크리스트나 3단계 정리처럼 다시 볼 이유가 남는 구조로 바꿔보세요."
  };

  if (lowestActionMap[metricDiagnosis.lowest]) {
    actions.push(lowestActionMap[metricDiagnosis.lowest]);
  }

  return actions.slice(0, 3);
}

function buildMetricDiagnosis(metrics) {
  const diagnosis = {
    views:
      metrics.averageViewRate < LOW_VIEW_RATE_BENCHMARK
        ? "초반 관심/진입이 약합니다."
        : "초반 관심은 유지됩니다.",
    likes:
      metrics.averageLikeRate < LOW_LIKE_RATE_BENCHMARK
        ? "공감 포인트가 약합니다."
        : "공감 반응은 유지됩니다.",
    comments:
      metrics.averageCommentRate < LOW_COMMENT_RATE_BENCHMARK
        ? "참여 설계가 약합니다."
        : "대화 참여는 열리고 있습니다.",
    shares:
      metrics.averageShareRate < LOW_SHARE_RATE_BENCHMARK
        ? "전파성이 약합니다."
        : "전파성은 유지되고 있습니다.",
    saves:
      metrics.averageSaveRate < LOW_SAVE_RATE_BENCHMARK
        ? "재방문 가치가 약합니다."
        : "재방문 가치는 유지됩니다."
  };

  const candidates = [
    {
      key: "views",
      ratio: metrics.averageViewRate / LOW_VIEW_RATE_BENCHMARK
    },
    {
      key: "likes",
      ratio: metrics.averageLikeRate / LOW_LIKE_RATE_BENCHMARK
    },
    {
      key: "comments",
      ratio: metrics.averageCommentRate / LOW_COMMENT_RATE_BENCHMARK
    },
    {
      key: "shares",
      ratio: metrics.averageShareRate / LOW_SHARE_RATE_BENCHMARK
    },
    {
      key: "saves",
      ratio: metrics.averageSaveRate / LOW_SAVE_RATE_BENCHMARK
    }
  ];

  candidates.sort((a, b) => a.ratio - b.ratio);
  diagnosis.lowest = candidates[0]?.key ?? "views";
  return diagnosis;
}

function computeScores(row) {
  const views = toNumber(row.views);
  const reach = toNumber(row.reach);
  const saves = toNumber(row.saves);
  const shares = toNumber(row.shares);
  const follows = toNumber(row.follows);
  const likes = toNumber(row.likes);
  const comments = toNumber(row.comments);
  const skipRate = normalizeSkipRate(row.skip_rate || row.skipRate);

  const hookScore = clampScore(100 - skipRate);
  const valueRaw = safeDivide(saves + shares, views) * 100;
  const fanRaw = safeDivide(follows, reach) * 1000;

  return {
    views,
    reach,
    hookScore,
    likeRate: safeDivide(likes, reach) * 100,
    commentRate: safeDivide(comments, reach) * 100,
    shareRate: safeDivide(shares, views) * 100,
    saveRate: safeDivide(saves, views) * 100,
    viewRate: safeDivide(views, reach) * 100,
    valueScore: normalizeToHundred(valueRaw, 2),
    fanScore: normalizeToHundred(fanRaw, FAN_SCORE_BENCHMARK)
  };
}

function getUploadDateValue(row) {
  return row.upload_date || row.uploadDate || row.submitted_at || row.submittedAt || "";
}

function normalizeSkipRate(value) {
  const raw = toNumber(value);
  return raw > 1 ? raw : raw * 100;
}

function toNumber(value) {
  if (!value) {
    return 0;
  }

  const normalized = String(value).replace(/,/g, "").replace(/[^0-9.]/g, "");
  return Number(normalized) || 0;
}

function safeDivide(numerator, denominator) {
  if (!denominator) {
    return 0;
  }

  return numerator / denominator;
}

function clampScore(value) {
  return Math.max(0, Math.min(100, value));
}

function normalizeToHundred(rawValue, benchmark) {
  if (!benchmark) {
    return 0;
  }

  return clampScore((rawValue / benchmark) * 100);
}

function average(values) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function groupBy(rows, key) {
  return rows.reduce((groups, row) => {
    const groupKey = row[key] || "미분류";
    groups[groupKey] ??= [];
    groups[groupKey].push(row);
    return groups;
  }, {});
}

function parseUploadDate(value) {
  if (!value) {
    return null;
  }

  const digits = String(value).match(/\d+/g)?.join("") ?? "";

  if (digits.length === 8) {
    return {
      year: Number(digits.slice(0, 4)),
      month: Number(digits.slice(4, 6)),
      day: Number(digits.slice(6, 8))
    };
  }

  if (digits.length === 6) {
    return {
      year: 2000 + Number(digits.slice(0, 2)),
      month: Number(digits.slice(2, 4)),
      day: Number(digits.slice(4, 6))
    };
  }

  return null;
}

function compareDate(a, b) {
  const left = `${a.year}${String(a.month).padStart(2, "0")}${String(a.day).padStart(2, "0")}`;
  const right = `${b.year}${String(b.month).padStart(2, "0")}${String(b.day).padStart(2, "0")}`;
  return left.localeCompare(right);
}

function getZonedParts(date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value])
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    weekday: parts.weekday,
    hour: Number(parts.hour),
    minute: Number(parts.minute)
  };
}

function startOfWeek(date) {
  const dayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(date.weekday);
  const offset = dayIndex === 0 ? -6 : 1 - dayIndex;
  return shiftDate(date, offset);
}

function shiftDate(date, offsetDays) {
  const utc = new Date(Date.UTC(date.year, date.month - 1, date.day));
  utc.setUTCDate(utc.getUTCDate() + offsetDays);
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate()
  };
}

function isLastDayOfMonth(date) {
  const next = shiftDate(date, 1);
  return next.month !== date.month;
}

function getWeekKey(date) {
  const weekStart = startOfWeek(date);
  return `${String(weekStart.month).padStart(2, "0")}${String(weekStart.day).padStart(2, "0")}`;
}

function formatDate(date) {
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

function formatOne(value) {
  return value.toFixed(1);
}

function formatNumber(value) {
  return Math.round(value).toLocaleString("ko-KR");
}

function extractCommonKeywords(comments) {
  const words = comments
    .flatMap((comment) => comment.split(/[\s,./!?]+/))
    .map((word) => word.trim())
    .filter((word) => word.length >= 2);

  const counts = new Map();
  for (const word of words) {
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([word]) => word)
    .join(", ");
}

function summarizeRoles(rows) {
  const counts = rows.reduce((map, row) => {
    const role = row.content_role || row.contentRole || "미분류";
    map.set(role, (map.get(role) ?? 0) + 1);
    return map;
  }, new Map());

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([role, count]) => `- ${role}: ${count}개`)
    .join("\n");
}

function summarizeText(values, limit = 1, maxLength = 90) {
  const cleaned = values
    .map((value) => normalizeSummaryText(value))
    .filter(Boolean);

  if (cleaned.length === 0) {
    return "";
  }

  const counts = new Map();
  for (const value of cleaned) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value]) => shortenSummaryText(value, maxLength))
    .join(" / ");
}

function normalizeSummaryText(value) {
  return String(value || "")
    .replace(/^[-•\d①②③④⑤⑥⑦⑧⑨⑩.\)\s]+/, "")
    .replace(/^(Action|Analysis|Memo|Context)\s*:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function shortenSummaryText(value, maxLength) {
  const compact = String(value || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!compact) {
    return "";
  }

  const firstClause = compact.split(/(?<!\d)[.!?,](?!\d)|[。]/)[0].trim();
  const base = firstClause || compact;

  if (base.length <= maxLength) {
    return base;
  }

  return `${base.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function normalizeContentKey(value) {
  return String(value || "")
    .replace(/\s+/g, "")
    .replace(/[(){}\[\].,!?~\-_:|'"`]/g, "")
    .replace(/의/g, "")
    .trim();
}
