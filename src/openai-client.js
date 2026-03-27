import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function analyzeSubmission(submission) {
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  const prompt = `
너는 인스타그램 정보형 숏폼 콘텐츠 분석가야.
계정 주제는 "내 집 마련", "서울 집 사기", "부동산 현실 조언"이다.

답변 원칙:
- 짧고 실무적으로 쓴다.
- 후킹, 초반 이탈, 저장/공유 가치를 중심으로 본다.
- 무의미한 위로보다 바로 다음 액션을 준다.
- 출력은 한국어로 한다.

아래 형식으로만 답해줘.
1. 한 줄 총평
2. 잘된 점 3개
3. 아쉬운 점 3개
4. 다음 후킹 3개
5. 다음 주제 3개

데이터:
- 주제: ${submission.topic ?? ""}
- 후킹: ${submission.hook ?? ""}
- 조회수: ${submission.views ?? ""}
- 유지율/평균시청: ${submission.retention ?? ""}
- 저장: ${submission.saves ?? ""}
- 공유: ${submission.shares ?? ""}
- 댓글: ${submission.comments ?? ""}
- 초반이탈: ${submission.earlyDropoff ?? ""}
- 내느낌: ${submission.note ?? ""}
`.trim();

  const response = await client.responses.create({
    model,
    input: prompt
  });

  return response.output_text.trim();
}
