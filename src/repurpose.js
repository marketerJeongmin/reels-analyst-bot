import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

export async function buildRepurposedOutputs(script) {
  const cleanedScript = stripAttachmentLines(script).trim();

  const [capcutScript, instagramCaption, youtubeDescription] = await Promise.all([
    transformCapcut(cleanedScript),
    transformInstagram(cleanedScript),
    transformYoutube(cleanedScript)
  ]);

  return {
    capcutScript,
    instagramCaption,
    youtubeDescription
  };
}

async function transformCapcut(script) {
  const prompt = `
너는 한국어 숏폼 대본을 캡컷 TTS용으로 다듬는 편집 도우미다.

규칙:
- 원문 의미와 말투를 최대한 유지한다.
- 띄어쓰기만 자연스럽게 수정한다.
- 맞춤법/표현은 임의로 고치지 않는다.
- 숫자는 한글 읽기 형태로 바꾼다.
- 느낌표는 "!!", 물음표는 "??"로 살린다.
- 문장 끝마다 줄바꿈한다.
- 문장별로 한 줄씩 끊고, 여러 문장을 한 줄에 붙이지 않는다.
- 문단 전환이 있더라도 기본은 문장 단위 줄바꿈이다.
- 구역/번호와 수량은 문맥을 보고 자연스럽게 처리한다.
- 이미지 첨부 안내 문구나 markdown 이미지는 제거한다.
- 설명 없이 결과 대본만 출력한다.

원문:
${script}
`.trim();

  const response = await client.responses.create({
    model,
    input: prompt
  });

  return response.output_text.trim();
}

async function transformInstagram(script) {
  const prompt = `
너는 인스타그램 릴스 캡션 편집자다.

규칙:
- 원문 의미와 워딩을 최대한 유지하되, 대본을 그대로 길게 옮기지 말고 가독성 좋게 개조식으로 정리한다.
- 첫 줄은 원문 날짜 표현에 맞춰 "🏠 N일 안에 ..." 형태 제목으로 쓴다.
- 제목과 바로 이어지는 소개 문장 사이에는 "." 문단 구분을 넣지 않는다.
- 큰 문단 전환에만 "." 한 줄을 넣는다.
- 작은 항목 내부에는 "."를 남발하지 않는다.
- 이미 "📍" 같은 이모지 구조가 있으면 그 안에는 "."를 추가하지 않는다.
- 위쪽에서 구조용 이모지를 많이 썼다면 아래쪽은 담백하게 정리한다.
- 내용상 장점/단점이 뚜렷하면 "👍 장점", "👎 단점" 구조를 쓴다.
- 장단점이 아니라 특징 정리면 "📍"와 짧은 개조식으로 정리한다.
- 숫자는 유지한다. 숫자를 한글로 바꾸지 않는다.
- 과한 "!!!", "???" 표현은 인스타용으로 줄여 자연스럽게 정리한다.
- 마지막에는 아래 문구를 반드시 그대로 붙인다.

팔로우 하고 같이 내집마련해요🏠
@wheresmy_home
@wheresmy_home
.
.
#내집마련 #부린이 #부동산 #재개발 #몸테크

- 설명 없이 결과 캡션만 출력한다.

원문:
${script}
`.trim();

  const response = await client.responses.create({
    model,
    input: prompt
  });

  return response.output_text.trim();
}

async function transformYoutube(script) {
  const prompt = `
너는 유튜브 쇼츠 설명란 편집자다.

규칙:
- 원문 의미와 워딩을 최대한 유지하되, 대본 전체를 그대로 옮기지 말고 보기 좋게 개조식으로 정리한다.
- 첫 줄은 원문 날짜 표현에 맞춰 "🏠 N일 안에 ..." 형태 제목으로 쓴다.
- 인스타 캡션과 비슷한 구조로 정리하되, 팔로우 문구는 넣지 않는다.
- 숫자는 유지한다. 숫자를 한글로 바꾸지 않는다.
- 과한 "!!!", "???" 표현은 줄여 자연스럽게 정리한다.
- 마지막에는 아래 해시태그를 그대로 붙인다.

#내집마련 #부린이 #부동산 #재개발 #몸테크

- 설명 없이 결과만 출력한다.

원문:
${script}
`.trim();

  const response = await client.responses.create({
    model,
    input: prompt
  });

  return response.output_text.trim();
}

function stripAttachmentLines(text) {
  return text
    .split("\n")
    .filter((line) => !line.trim().startsWith("!["))
    .join("\n");
}
