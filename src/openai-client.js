import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function analyzeSubmission(submission) {
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const skipRate = toNumber(submission.skipRate);
  const views = toNumber(submission.views);
  const saves = toNumber(submission.saves);
  const shares = toNumber(submission.shares);
  const reach = toNumber(submission.reach);
  const follows = toNumber(submission.follows);

  const hookScore = clampScore(100 - skipRate);
  const valueScore = clampScore(safeDivide(saves + shares, views) * 100);
  const fanScore = clampScore(safeDivide(follows, reach) * 1000);

  const prompt = `
너는 인스타그램 정보형 숏폼 콘텐츠 분석가야.
계정 주제는 "내 집 마련", "서울 집 사기", "부동산 현실 조언"이다.
이 봇은 디자이너의 감각과 데이터의 이성 사이의 균형을 찾기 위해 설계되었다.

답변 원칙:
- 짧고 실무적으로 쓴다.
- 후킹, 저장/공유 가치, 팬 전환, 둥지님 메모를 중심으로 본다.
- 무의미한 위로보다 바로 다음 액션을 준다.
- 출력은 한국어로 한다.
- 점수에 맞춰 냉정하지만 응원하는 톤으로 말한다.
- 개별 영상 리포트에서는 다음 후킹/다음 주제 목록을 길게 주지 않는다.
- 지금 당장 바꿀 한 가지를 가장 중요하게 제안한다.

아래 형식으로만 답해줘.
### 🐣 [Dungji] 릴스 성과 리포트
**"한 줄 총평"**

- 🎯 후킹: {점수}점 ({짧은 평가})
- 💎 가치: {점수}점 ({짧은 평가})
- 👤 팬 전환: {점수}점 ({짧은 평가})

---
💡 둥지의 추천:
1. Action: 바로 다음 영상에서 할 행동 1개
2. Analysis: 숫자 해석 1개
3. Memo: 내 코멘트와 연결한 피드백 1개

등급 기준:
- 후킹 점수 80점 이상: "완벽한 도입부! 지금의 자막 배치와 타이밍을 유지하세요."
- 후킹 점수 60점 미만: "문전박대 주의! 첫 화면의 비주얼이나 자막 문구를 더 자극적으로 바꿔보세요."
- 가치 점수 2점 이상: "알짜배기 콘텐츠! 사람들이 이 정보를 소중하게 여기고 있습니다."
- 가치 점수 0.5점 미만: "알맹이 부족. 시청자가 나중에 또 봐야지 할만한 팁을 한 가지 더 넣어보세요."
- 팬 전환 점수 0.3점 이상: "슈퍼 루키! 둥지님의 브랜딩이 시청자에게 먹히고 있습니다."
- 팬 전환 점수 0.1점 미만: "익명 크리에이터 주의. 영상 마지막에 둥지님만의 색깔을 더 드러내 보세요."

추가 해석 규칙:
- 조회수 > 도달 계정 수 이면 "반복 시청이 일어나는 정보성 레이아웃입니다. 이 형식을 템플릿화하세요!"를 적절히 반영한다.
- 평균 시청 시간이 아쉬운데 조회수가 낮다면, 편집 효율 관점에서 영상 길이를 몇 초 줄일지 구체적으로 제안한다.
- 내 코멘트에서 핵심 키워드를 뽑아 다음 액션에 반영한다.
- 후킹/주제 추천은 주간 분석에서 하는 게 더 적절하다는 관점을 유지한다.

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
- 후킹 점수: ${formatScore(hookScore)}
- 가치 점수: ${formatScore(valueScore)}
- 팬 전환 점수: ${formatScore(fanScore)}
`.trim();

  const response = await client.responses.create({
    model,
    input: prompt
  });

  return response.output_text.trim();
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

function formatScore(value) {
  return value.toFixed(1);
}
