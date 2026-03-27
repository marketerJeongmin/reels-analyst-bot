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
- 후킹, 저장, 댓글, 도달 계정 수, 건너뛰기 비율, 평균 시청 시간을 중심으로 본다.
- 무의미한 위로보다 바로 다음 액션을 준다.
- 출력은 한국어로 한다.

아래 형식으로만 답해줘.
1. 한 줄 총평
2. 잘된 점 3개
3. 아쉬운 점 3개
4. 다음 후킹 3개
5. 다음 주제 3개

데이터:
- 업로드 날짜: ${submission.uploadDate ?? ""}
- 주제: ${submission.topic ?? ""}
- 후킹: ${submission.hook ?? ""}
- 분류: ${submission.category ?? ""}
- 댓글: ${submission.comments ?? ""}
- 저장: ${submission.saves ?? ""}
- 조회수: ${submission.views ?? ""}
- 도달 계정 수: ${submission.reach ?? ""}
- 건너뛰기 비율: ${submission.skipRate ?? ""}
- 평균시청시간: ${submission.averageWatchTime ?? ""}
- 팔로우 증가 수: ${submission.follows ?? ""}
- 내 코멘트: ${submission.commentary ?? ""}
`.trim();

  const response = await client.responses.create({
    model,
    input: prompt
  });

  return response.output_text.trim();
}
