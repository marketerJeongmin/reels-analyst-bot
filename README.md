# Reels Analysis Bot

디스코드 채널에 성과를 입력하면:

1. 구글 스프레드시트에 새 행으로 저장하고
2. OpenAI로 성과를 분석한 뒤
3. 디스코드 채널에 결과를 다시 보내는 봇이다.

## 동작 흐름

- 입력 채널: `#릴스-입력`
- 결과 채널: `#릴스-분석`

입력 형식:

```text
주제: 서울에서 첫 집 살 때 가장 먼저 해야 할 것
후킹: 361일 안에 서울에 집 살 수 있을까요? Day 14
조회수: 12432
유지율: 38%
저장: 217
공유: 41
댓글: 18
초반이탈: 초반은 괜찮은데 중간부터 빠짐
내느낌: 설명이 조금 길었음
```

## 1. 준비물

- Discord 서버와 채널 2개
- Google Spreadsheet 1개
- OpenAI API Key 1개
- Discord Bot Token 1개

## 2. Discord 봇 만들기

1. [Discord Developer Portal](https://discord.com/developers/applications)에 들어간다.
2. `New Application`을 누른다.
3. 앱 이름을 정한다. 예: `Reels Analysis Bot`
4. 왼쪽 `Bot` 메뉴로 들어간다.
5. `Reset Token` 또는 `Add Bot`을 눌러 봇 토큰을 만든다.
6. 아래 설정을 켠다.
   - `MESSAGE CONTENT INTENT`
   - `SERVER MEMBERS INTENT`는 필요 없다.
7. 왼쪽 `OAuth2 > URL Generator`로 들어간다.
8. 아래 권한을 선택한다.
   - Scopes: `bot`
   - Bot Permissions: `View Channels`, `Send Messages`, `Read Message History`, `Add Reactions`
9. 생성된 URL로 봇을 서버에 초대한다.

## 3. 채널 ID 찾기

1. Discord 설정에서 `고급 > 개발자 모드`를 켠다.
2. 입력 채널을 우클릭하고 `ID 복사`
3. 결과 채널도 우클릭하고 `ID 복사`

## 4. Google Sheet 만들기

1. 새 Google Spreadsheet를 만든다.
2. 첫 번째 탭 이름을 `ReelsData`로 바꾼다.
3. URL에서 스프레드시트 ID를 복사한다.

예시:

```text
https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit#gid=0
```

## 5. Google Service Account 만들기

1. [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트를 만든다.
2. `APIs & Services > Library`에서 `Google Sheets API`를 활성화한다.
3. `IAM & Admin > Service Accounts`로 들어간다.
4. 서비스 계정을 만든다.
5. `Keys > Add Key > Create new key > JSON`으로 키를 만든다.
6. JSON 안의 `client_email`과 `private_key`를 복사한다.
7. 만든 스프레드시트를 열고 `공유`를 누른 뒤 서비스 계정 이메일을 편집자로 초대한다.

## 6. 환경 변수 넣기

1. `.env.example`을 복사해서 `.env` 파일을 만든다.
2. 값을 채운다.

```bash
cp .env.example .env
```

필수 값:

- `DISCORD_TOKEN`
- `DISCORD_INPUT_CHANNEL_ID`
- `DISCORD_OUTPUT_CHANNEL_ID`
- `OPENAI_API_KEY`
- `GOOGLE_SHEET_ID`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`

`GOOGLE_PRIVATE_KEY`는 JSON의 private_key를 그대로 넣되 줄바꿈을 `\n`으로 유지한다.

## 7. 설치와 실행

```bash
npm install
npm start
```

## 8. 결과 확인

- 입력 채널에 템플릿 형식대로 메시지를 보낸다.
- 시트에 새 행이 추가되면 저장 성공이다.
- 결과 채널에 분석 메시지가 오면 전체 흐름이 성공이다.

## 9. 자주 막히는 부분

### 메시지를 못 읽는 경우

- Discord Bot의 `MESSAGE CONTENT INTENT`가 켜져 있는지 본다.
- 입력 채널 ID가 맞는지 본다.
- 봇이 서버와 채널에 들어와 있는지 본다.

### 시트 저장이 안 되는 경우

- 시트 탭 이름이 `ReelsData`인지 본다.
- 서비스 계정 이메일이 시트에 공유되어 있는지 본다.
- `GOOGLE_PRIVATE_KEY`가 깨지지 않았는지 본다.

### OpenAI 분석이 안 되는 경우

- `OPENAI_API_KEY`가 맞는지 본다.
- 결제/사용 한도를 확인한다.

## 10. 나중에 붙일 수 있는 확장 기능

- `#릴스-입력`에 저장 성공 메시지 보내기
- 주간 요약 자동 생성
- 후킹 점수화
- 인스타 캡션 초안 생성
- 다음 주제 추천 전용 명령어 추가
