import OpenAI from "openai";

const FAN_SCORE_BENCHMARK = 6.3;
const LOW_VIEW_RATE_BENCHMARK = 1.0;
const LOW_LIKE_RATE_BENCHMARK = 0.6;
const LOW_COMMENT_RATE_BENCHMARK = 0.08;
const LOW_SHARE_RATE_BENCHMARK = 0.25;
const LOW_SAVE_RATE_BENCHMARK = 0.4;

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function analyzeSubmission(submission, historicalRows = []) {
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const metrics = computeMetrics(submission);
  const comparisonContext = buildComparisonContext(submission, historicalRows);
  const commentaryContext = buildCommentaryContext(submission.commentary);

  const draft = await createDraftAnalysis({
    model,
    submission,
    metrics,
    comparisonContext,
    commentaryContext
  });

  const reviewed = await reviewDraftAnalysis({
    model,
    submission,
    metrics,
    draft,
    comparisonContext,
    commentaryContext
  });

  const result = normalizeAnalysis(reviewed, metrics);

  return {
    ...result,
    report: renderReport(result, metrics),
    metrics
  };
}

async function createDraftAnalysis({ model, submission, metrics, comparisonContext, commentaryContext }) {
  const prompt = `
너는 인스타그램 정보형 숏폼 콘텐츠 분석가야.
계정 주제는 "내 집 마련", "서울 집 사기", "부동산 현실 조언"이다.
이 봇은 디자이너의 감각과 데이터의 이성 사이의 균형을 찾기 위해 설계되었다.

해야 할 일:
- 아래 데이터를 보고 개별 릴스 분석 초안을 만든다.
- 후킹/가치/팬전환 3점수는 그대로 해석한다.
- 조회수/좋아요/댓글/공유/저장이 낮을 때의 의미를 참고해 원인을 해석한다.
- 영상의 역할을 하나로 분류한다. 역할 후보는 "조회수형", "팔로우 전환형", "저장형", "댓글형" 중 하나다.
- 역할은 단순 조회수보다 실제 반응이 강한 신호를 우선한다. 댓글이 강하면 댓글형, 팔로우가 강하면 팔로우 전환형, 저장/공유가 강하면 저장형, 나머지는 조회수형으로 본다.
- 내 코멘트를 단순 언급하지 말고, 코멘트가 지적한 문제와 숫자가 일치하는지까지 해석한다.
- 내 코멘트의 구체 표현을 최소 1개는 해석 근거로 사용하고, 맞는 부분과 어긋나는 부분이 있으면 같이 적는다.
- 유사 영상 대비 비교 메모가 가능하면 한 줄로 만든다. 같은 분류보다 같은 시리즈/같은 흐름을 우선 비교한다.
- 액션은 추상적으로 쓰지 말고, 바로 다음 영상에서 바꿀 첫 장면/첫 문장/자막/CTA 수준으로 구체적으로 쓴다.
- 출력은 짧고 실무적으로 유지한다. 각 항목은 1문장 또는 아주 짧은 2문장까지만 허용한다.

출력 형식:
반드시 JSON 객체만 출력한다. 마크다운 금지.
키는 아래와 정확히 같게 써라.
{
  "headline": string,
  "hookLabel": string,
  "valueLabel": string,
  "fanLabel": string,
  "contentRole": "조회수형" | "팔로우 전환형" | "저장형" | "댓글형",
  "keyInsight": string,
  "recommendedAction": string,
  "analysisLine": string,
  "memoLine": string,
  "commentaryInterpretation": string,
  "comparisonNote": string
}

지표 해석 기준:
- 조회수 낮음: 관심 부족, 표지/썸네일 문제, 초반 3초 문제 가능성
- 좋아요 낮음: 공감 부족, "내 얘기다" 느낌 부족, 감성 자극 부족 가능성
- 댓글 낮음: 소통 불능, 참여 유도 부족, 질문 설계 부족 가능성
- 공유 낮음: 자극/정보 부족, 남에게 보내기 애매한 콘텐츠일 가능성
- 저장 낮음: 다시 볼 필요 없음, 가치 부족, 휘발성 강한 콘텐츠일 가능성

액션 작성 기준:
- 조회수 낮음이면 제목, 첫 장면, 표지 문구, 첫 3초 자막 중 무엇을 바꿀지 구체적으로 적는다.
- 좋아요 낮음이면 공감 문장, 감정 번역, 자기 경험 한 줄을 추가하는 방향으로 적는다.
- 댓글 낮음이면 선택형 질문, 찬반형 질문, 댓글 보상형 CTA 중 무엇을 넣을지 적는다.
- 공유 낮음이면 비교, 경고, 공감, 전파성 있는 문장을 추가하는 방향으로 적는다.
- 저장 낮음이면 체크리스트, 비교표, 단계 정리, 숫자 정리 중 하나를 넣는 방향으로 적는다.

등급 기준:
- 후킹 80점 이상: 도입 강함
- 후킹 60점 미만: 초반 3초 보강 필요
- 가치 80점 이상: 알짜배기 콘텐츠
- 가치 25점 미만: 알맹이 부족
- 팬전환 80점 이상: 브랜딩 강함
- 팬전환 35점 미만: 계정 색이 약함

데이터:
- 업로드 날짜: ${submission.uploadDate ?? ""}
- 주제: ${submission.topic ?? ""}
- 후킹: ${submission.hook ?? ""}
- 분류: ${submission.category ?? ""}
- 좋아요: ${submission.likes ?? ""}
- 댓글: ${submission.comments ?? ""}
- 저장: ${submission.saves ?? ""}
- 공유: ${submission.shares ?? ""}
- 조회수: ${submission.views ?? ""}
- 도달 계정 수: ${submission.reach ?? ""}
- 건너뛰기 비율: ${submission.skipRate ?? ""}
- 평균시청시간: ${submission.averageWatchTime ?? ""}
- 팔로우 증가 수: ${submission.follows ?? ""}
- 내 코멘트: ${submission.commentary ?? ""}

미리 계산된 점수:
- 후킹 점수: ${formatScore(metrics.hookScore)}
- 가치 점수: ${formatScore(metrics.valueScore)}
- 팬 전환 점수: ${formatScore(metrics.fanScore)}

참고 raw 값:
- 가치 raw: ${formatScore(metrics.valueRaw)}%
- 팬 전환 raw: ${formatScore(metrics.fanRaw)} per 1000
- 조회수/도달 비율: ${formatScore(metrics.viewRate)}%
- 좋아요/도달 비율: ${formatScore(metrics.likeRate)}%
- 댓글/도달 비율: ${formatScore(metrics.commentRate)}%
- 공유/조회수 비율: ${formatScore(metrics.shareRate)}%
- 저장/조회수 비율: ${formatScore(metrics.saveRate)}%

저조 지표 참고 기준:
- 조회수/도달 비율 ${LOW_VIEW_RATE_BENCHMARK}% 미만이면 관심/초반 3초 이슈 가능성
- 좋아요/도달 비율 ${LOW_LIKE_RATE_BENCHMARK}% 미만이면 공감 부족 가능성
- 댓글/도달 비율 ${LOW_COMMENT_RATE_BENCHMARK}% 미만이면 참여 유도 부족 가능성
- 공유/조회수 비율 ${LOW_SHARE_RATE_BENCHMARK}% 미만이면 전파성 부족 가능성
- 저장/조회수 비율 ${LOW_SAVE_RATE_BENCHMARK}% 미만이면 정보 가치 부족 가능성

내 코멘트 핵심:
${commentaryContext}

유사 영상 비교 참고:
${comparisonContext}
`.trim();

  return parseAnalysisJson(await runTextResponse(model, prompt));
}

async function reviewDraftAnalysis({
  model,
  submission,
  metrics,
  draft,
  comparisonContext,
  commentaryContext
}) {
  const prompt = `
너는 숏폼 분석 리포트의 최종 검수자다.
아래 초안을 체크리스트에 따라 검토하고, 부족한 부분을 보강한 최종안을 JSON으로 다시 써라.

검수 체크리스트:
- 후킹/가치/팬전환 3점수 해석이 숫자와 어긋나지 않는가
- 영상 역할 분류가 현재 지표 조합과 맞는가
- 내 코멘트가 표면적으로만 언급되지 않고 해석에 실제 반영되었는가
- 내 코멘트가 지적한 문제와 숫자가 실제로 연결되어 있는가
- 유사 영상 비교 메모가 가능할 때 충분히 구체적인가
- 추천 액션이 "후킹 강화"처럼 뭉뚱그려지지 않고 장면/문장/구조/CTA 수준으로 구체적인가
- Action / Analysis / Memo / Context가 길어지거나 같은 말을 반복하지 않는가
- 맨날 같은 말처럼 들리지 않게 이 영상만의 역할과 차이를 한 줄이라도 말하는가

반드시 JSON 객체만 출력한다.
키는 그대로 유지:
headline, hookLabel, valueLabel, fanLabel, contentRole, keyInsight, recommendedAction, analysisLine, memoLine, commentaryInterpretation, comparisonNote

현재 영상 데이터:
- 주제: ${submission.topic ?? ""}
- 분류: ${submission.category ?? ""}
- 후킹: ${submission.hook ?? ""}
- 내 코멘트: ${submission.commentary ?? ""}

점수:
- 후킹: ${formatScore(metrics.hookScore)}
- 가치: ${formatScore(metrics.valueScore)}
- 팬전환: ${formatScore(metrics.fanScore)}

세부 비율:
- 조회수/도달: ${formatScore(metrics.viewRate)}%
- 좋아요/도달: ${formatScore(metrics.likeRate)}%
- 댓글/도달: ${formatScore(metrics.commentRate)}%
- 공유/조회수: ${formatScore(metrics.shareRate)}%
- 저장/조회수: ${formatScore(metrics.saveRate)}%

내 코멘트 핵심:
${commentaryContext}

유사 영상 비교 참고:
${comparisonContext}

초안:
${JSON.stringify(draft, null, 2)}
`.trim();

  return parseAnalysisJson(await runTextResponse(model, prompt), draft);
}

function normalizeAnalysis(analysis, metrics) {
  return {
    headline: analysis.headline || "숫자와 맥락을 같이 보면, 다음 액션이 보입니다.",
    hookLabel: analysis.hookLabel || defaultHookLabel(metrics.hookScore),
    valueLabel: analysis.valueLabel || defaultValueLabel(metrics.valueScore),
    fanLabel: analysis.fanLabel || defaultFanLabel(metrics.fanScore),
    contentRole: normalizeRole(analysis.contentRole, metrics),
    keyInsight: analysis.keyInsight || "이 영상이 계정에서 어떤 역할을 하는지 더 분명히 봐야 합니다.",
    recommendedAction:
      analysis.recommendedAction || "다음 영상에서는 첫 장면과 첫 문장을 더 구체적으로 바꿔보세요.",
    analysisLine: analysis.analysisLine || "세 점수와 세부 지표를 함께 보면 이 영상의 강약이 더 또렷해집니다.",
    memoLine: analysis.memoLine || "내 코멘트와 숫자를 함께 보면 다음 수정 포인트가 더 선명해집니다.",
    commentaryInterpretation:
      analysis.commentaryInterpretation || "내 코멘트 해석이 충분치 않아 다음에 더 구체적으로 확인해볼 필요가 있습니다.",
    comparisonNote: analysis.comparisonNote || "비교할 유사 영상 데이터가 아직 충분하지 않습니다."
  };
}

function renderReport(analysis, metrics) {
  return [
    "### 🐣 [Dungji] 릴스 성과 리포트",
    `**"${analysis.headline}"**`,
    "",
    `- 🎯 후킹: ${formatScore(metrics.hookScore)}점 (${analysis.hookLabel})`,
    `- 💎 가치: ${formatScore(metrics.valueScore)}점 (${analysis.valueLabel})`,
    `- 👤 팬 전환: ${formatScore(metrics.fanScore)}점 (${analysis.fanLabel})`,
    `- 🧭 영상 역할: ${analysis.contentRole}`,
    "",
    "---",
    "💡 둥지의 추천:",
    `1. Action: ${analysis.recommendedAction}`,
    `2. Analysis: ${analysis.analysisLine}`,
    `3. Memo: ${analysis.memoLine}`,
    `4. Context: ${analysis.comparisonNote}`
  ].join("\n");
}

async function runTextResponse(model, input) {
  const response = await client.responses.create({
    model,
    input
  });

  return response.output_text.trim();
}

function parseAnalysisJson(rawText, fallback = {}) {
  const direct = tryJsonParse(rawText);
  if (direct) {
    return direct;
  }

  const match = rawText.match(/\{[\s\S]*\}/);
  if (match) {
    const extracted = tryJsonParse(match[0]);
    if (extracted) {
      return extracted;
    }
  }

  return fallback;
}

function tryJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function buildComparisonContext(submission, historicalRows) {
  const sameSeriesKey = normalizeSeriesKey(submission.topic || submission.hook || "");
  const sortedHistoricalRows = [...historicalRows].sort((a, b) =>
    String(a.submitted_at || a.submittedAt || "").localeCompare(String(b.submitted_at || b.submittedAt || ""))
  );

  const sameSeriesRows = sameSeriesKey
    ? sortedHistoricalRows
        .filter((row) => normalizeSeriesKey(row.topic || row.hook || "") === sameSeriesKey)
        .slice(-3)
    : [];

  const sameCategoryRows = sortedHistoricalRows
    .filter((row) => (row.category || "") === (submission.category || ""))
    .slice(-3);

  const comparisonRows = sameSeriesRows.length > 0 ? sameSeriesRows : sameCategoryRows;

  if (comparisonRows.length === 0) {
    return "비교 가능한 이전 유사 영상이 아직 충분하지 않습니다.";
  }

  const lines = comparisonRows.map((row) => {
    const metrics = computeMetrics({
      likes: row.likes,
      comments: row.comments,
      shares: row.shares,
      saves: row.saves,
      views: row.views,
      reach: row.reach,
      skipRate: row.skip_rate || row.skipRate,
      follows: row.follows
    });

    const memo = shortenText(row.commentary || row.commentary_interpretation || "", 48);
    const role = row.content_role || row.contentRole || "미분류";
    return `- ${row.topic || "주제 없음"} | 역할 ${role} | 후킹 ${formatScore(metrics.hookScore)} | 가치 ${formatScore(metrics.valueScore)} | 팬전환 ${formatScore(metrics.fanScore)}${memo ? ` | 메모 ${memo}` : ""}`;
  });

  const heading = sameSeriesRows.length > 0 ? "같은 시리즈 비교:" : "같은 분류 최근 영상:";
  return [heading, ...lines].join("\n");
}

function buildCommentaryContext(commentary) {
  if (!commentary) {
    return "코멘트 없음";
  }

  return shortenText(`원문 코멘트: ${commentary}`, 120);
}

function computeMetrics(submission) {
  const skipRate = normalizeSkipRate(submission.skipRate);
  const views = toNumber(submission.views);
  const saves = toNumber(submission.saves);
  const shares = toNumber(submission.shares);
  const reach = toNumber(submission.reach);
  const follows = toNumber(submission.follows);
  const likes = toNumber(submission.likes);
  const comments = toNumber(submission.comments);

  const hookScore = clampScore(100 - skipRate);
  const valueRaw = safeDivide(saves + shares, views) * 100;
  const fanRaw = safeDivide(follows, reach) * 1000;

  return {
    views,
    reach,
    follows,
    likes,
    comments,
    saves,
    shares,
    hookScore,
    valueRaw,
    fanRaw,
    valueScore: normalizeToHundred(valueRaw, 2),
    fanScore: normalizeToHundred(fanRaw, FAN_SCORE_BENCHMARK),
    viewRate: safeDivide(views, reach) * 100,
    likeRate: safeDivide(likes, reach) * 100,
    commentRate: safeDivide(comments, reach) * 100,
    shareRate: safeDivide(shares, views) * 100,
    saveRate: safeDivide(saves, views) * 100
  };
}

function normalizeRole(role, metrics) {
  const inferredRole = inferRole(metrics);
  const allowedRoles = ["조회수형", "팔로우 전환형", "저장형", "댓글형"];

  if (!allowedRoles.includes(role)) {
    return inferredRole;
  }

  if (role === inferredRole) {
    return role;
  }

  if (role === "조회수형" && inferredRole !== "조회수형") {
    return inferredRole;
  }

  return role;
}

function normalizeSkipRate(value) {
  const raw = toNumber(value);
  return raw > 1 ? raw : raw * 100;
}

function normalizeSeriesKey(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }

  const match = text.match(/^(.*?)(?:\s*\(?\d+\s*(?:편|탄|부|화|회|번째)\)?)(?:\s*.*)?$/);
  if (!match?.[1]) {
    return "";
  }

  return match[1].replace(/[\s().,!?~\-_:|]/g, "");
}

function shortenText(value, maxLength) {
  const compact = String(value || "").replace(/\s+/g, " ").trim();

  if (!compact) {
    return "";
  }

  if (compact.length <= maxLength) {
    return compact;
  }

  const firstClause = compact.split(/[。.!?]/)[0].trim();
  const base = firstClause.length > 0 ? firstClause : compact;

  if (base.length <= maxLength) {
    return base;
  }

  return `${base.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function inferRole(metrics) {
  const roleScores = [
    {
      role: "댓글형",
      score: metrics.commentRate * 100 + Math.log1p(metrics.comments) * 12
    },
    {
      role: "팔로우 전환형",
      score: metrics.fanScore + Math.log1p(metrics.follows) * 4
    },
    {
      role: "저장형",
      score: metrics.valueScore + metrics.saveRate * 20 + metrics.shareRate * 10
    },
    {
      role: "조회수형",
      score: metrics.hookScore + Math.max(metrics.viewRate - 100, 0) * 0.15
    }
  ];

  roleScores.sort((a, b) => b.score - a.score);
  return roleScores[0]?.role || "조회수형";
}

function defaultHookLabel(score) {
  if (score >= 80) {
    return "도입부가 강해요";
  }
  if (score < 60) {
    return "초반 3초 보강이 필요해요";
  }
  return "관심은 끌었지만 더 세질 수 있어요";
}

function defaultValueLabel(score) {
  if (score >= 80) {
    return "알짜배기 콘텐츠예요";
  }
  if (score < 25) {
    return "다시 볼 이유를 더 만들어야 해요";
  }
  return "가치는 있지만 더 날카롭게 만들 수 있어요";
}

function defaultFanLabel(score) {
  if (score >= 80) {
    return "팬 전환이 매우 좋아요";
  }
  if (score < 35) {
    return "브랜딩을 더 전면에 세워야 해요";
  }
  return "브랜딩은 살아 있지만 더 키울 수 있어요";
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

function formatScore(value) {
  return value.toFixed(1);
}
