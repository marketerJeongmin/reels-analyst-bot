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
  const filtered = rows.filter((row) => {
    const date = parseUploadDate(getUploadDateValue(row));
    return date && compareDate(date, weekStart) >= 0 && compareDate(date, current) <= 0;
  });

  return {
    reportKey: `${current.year}-W${getWeekKey(current)}`,
    title: "주간 릴스 리포트",
    periodLabel: `${formatDate(weekStart)} ~ ${formatDate(current)}`,
    content: renderPeriodicReport("weekly", filtered, weekStart, current)
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
  if (rows.length === 0) {
    return [
      `### ${kind === "weekly" ? "주간" : "월간"} 리포트`,
      "",
      `기간: ${formatDate(startDate)} ~ ${formatDate(endDate)}`,
      "",
      "이번 기간에는 집계할 릴스 데이터가 없어요."
    ].join("\n");
  }

  const scoredRows = rows.map((row) => {
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

  const bestRow = [...scoredRows].sort((a, b) => b.valueScore + b.fanScore - (a.valueScore + a.fanScore))[0];
  const weakRow = [...scoredRows].sort((a, b) => a.hookScore + a.valueScore + a.fanScore - (b.hookScore + b.valueScore + b.fanScore))[0];
  const repeatWatchRows = scoredRows.filter((row) => row.views > row.reach);
  const topCommentary = extractCommonKeywords(scoredRows.map((row) => row.commentary).filter(Boolean));

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
    `업로드 수: ${rows.length}개`,
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
    "**분류별 성과**",
    categoryLines || "- 분류 데이터 없음",
    "",
    "**가장 잘된 영상**",
    `- ${bestRow.topic}: 조회수 ${formatNumber(bestRow.views)}, 가치 ${formatOne(bestRow.valueScore)}점, 팬 전환 ${formatOne(bestRow.fanScore)}점`,
    "",
    "**가장 아쉬운 영상**",
    `- ${weakRow.topic}: 후킹 ${formatOne(weakRow.hookScore)}점, 가치 ${formatOne(weakRow.valueScore)}점, 팬 전환 ${formatOne(weakRow.fanScore)}점`,
    "",
    "**패턴 메모**",
    repeatWatchRows.length > 0
      ? `- 조회수 > 도달 계정 수 영상 ${repeatWatchRows.length}개: 반복 시청 가능성이 있는 레이아웃입니다.`
      : "- 반복 시청 패턴은 아직 뚜렷하지 않습니다.",
    topCommentary
      ? `- 코멘트 반복 키워드: ${topCommentary}`
      : "- 코멘트 반복 키워드는 아직 적습니다.",
    "",
    kind === "weekly" ? "**다음 주 액션**" : "**다음 달 전략**",
    ...actions.map((action) => `- ${action}`)
  ].join("\n");
}

function buildActions(rows, metricDiagnosis) {
  const infoRows = rows.filter((row) => row.category === "정보성");
  const storyRows = rows.filter((row) => row.category === "내 스토리");
  const avgInfoValue = average(infoRows.map((row) => row.valueScore));
  const avgStoryValue = average(storyRows.map((row) => row.valueScore));
  const avgHook = average(rows.map((row) => row.hookScore));

  const actions = [];

  if (avgInfoValue >= avgStoryValue && infoRows.length > 0) {
    actions.push("정보성 포맷 비중을 조금 더 높여 저장/공유 강점을 이어가세요.");
  }

  if (storyRows.length > 0 && avgStoryValue < avgInfoValue) {
    actions.push("내 스토리 영상은 순수 서사보다 정보 한 가지를 섞는 방식으로 보강해보세요.");
  }

  if (avgHook < 60) {
    actions.push("첫 3초 자막에 금액, 지역명, 결론 중 하나를 더 크게 배치해 후킹을 보강하세요.");
  } else {
    actions.push("현재 후킹 구조는 유지하고, 중반 정보 밀도를 더 높여 저장률을 키워보세요.");
  }

  if (metricDiagnosis.lowest === "views") {
    actions.push("조회수가 약하면 제목, 표지 문구, 초반 3초 진입 문장을 먼저 손보세요.");
  } else if (metricDiagnosis.lowest === "likes") {
    actions.push("좋아요가 약하면 공감 카피를 더 넣어 '이거 내 얘기다' 느낌을 강화해보세요.");
  } else if (metricDiagnosis.lowest === "comments") {
    actions.push("댓글이 약하면 끝 문장을 의견형 질문으로 바꿔 사람들이 자기 말을 남기게 설계해보세요.");
  } else if (metricDiagnosis.lowest === "shares") {
    actions.push("공유가 약하면 '이거 너 얘기 아님?' 하고 보내고 싶어지는 문장이나 비교 포인트를 추가하세요.");
  } else if (metricDiagnosis.lowest === "saves") {
    actions.push("저장이 약하면 체크리스트, 비교표, 순서 정리처럼 다시 볼 이유를 더 분명하게 만드세요.");
  }

  return actions.slice(0, 3);
}

function buildMetricDiagnosis(metrics) {
  const diagnosis = {
    views:
      metrics.averageViewRate < LOW_VIEW_RATE_BENCHMARK
        ? "관심 부족이나 초반 3초 진입 문제가 의심됩니다."
        : "관심 유입은 유지되고 있습니다.",
    likes:
      metrics.averageLikeRate < LOW_LIKE_RATE_BENCHMARK
        ? "공감 포인트나 감성 터치가 약할 가능성이 큽니다."
        : "공감 반응은 유지되고 있습니다.",
    comments:
      metrics.averageCommentRate < LOW_COMMENT_RATE_BENCHMARK
        ? "참여 유도나 대화 설계가 부족할 가능성이 큽니다."
        : "대화 참여는 열리고 있습니다.",
    shares:
      metrics.averageShareRate < LOW_SHARE_RATE_BENCHMARK
        ? "남에게 보내고 싶을 정도의 전파성이 약할 수 있습니다."
        : "전파성은 유지되고 있습니다.",
    saves:
      metrics.averageSaveRate < LOW_SAVE_RATE_BENCHMARK
        ? "다시 볼 필요를 느끼게 하는 정보 가치가 부족할 수 있습니다."
        : "다시 보고 싶은 가치가 유지되고 있습니다."
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
  const skipRate = normalizeSkipRate(row.skipRate);

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
