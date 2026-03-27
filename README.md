# Reels Analysis Bot

디스코드 슬래시 명령으로 숏폼 성과를 입력하면:

1. 구글 스프레드시트에 새 행으로 저장하고
2. OpenAI로 성과를 분석한 뒤
3. 디스코드 채널에 짧고 실무적인 개별 리포트를 다시 보내는 봇이다.

이 봇은 크리에이터의 감각과 데이터의 이성 사이의 균형을 찾기 위해 설계되었다.

## 동작 흐름

- 입력 채널: `#릴스-입력`
- 결과 채널: `#릴스-분석`

입력 흐름:

```text
/reels-input
분류 선택: 카테고리 1 / 카테고리 2 / 카테고리 3
업로드 날짜 입력
주제 입력
후킹 입력
좋아요 / 댓글 / 공유 / 저장 입력
조회수 / 도달 계정 수 / 건너뛰기 비율 / 평균시청시간 / 팔로우 증가 수 입력
내 코멘트 입력
```

## 입력 항목

### 기본

- 업로드 날짜
- 주제
- 후킹
- 분류
- 내 코멘트

### 성과

- 조회수
- 도달 계정 수
- 좋아요
- 댓글
- 저장
- 공유
- 팔로우 증가 수

### 심화

- 건너뛰기 비율
- 평균 시청 시간

## 둥지 점수 체계

세 점수는 모두 `100점 만점 기준`으로 비교 가능하게 정규화된다.

### 🎯 후킹 점수

- 공식: `100 - 건너뛰기 비율`
- 의미: 첫 화면과 초반 3초가 시청자를 붙잡았는지 보는 점수

해석 기준:

- `80점 이상`: 도입부가 강하다
- `60점 미만`: 첫 화면, 자막, 비주얼을 더 자극적으로 바꿔볼 필요가 있다

### 💎 가치 점수

- raw 공식: `(저장 + 공유) / 조회수 * 100`
- 정규화 기준: `raw 2% = 100점`
- 의미: 콘텐츠가 얼마나 다시 보고 싶고, 남에게 보내고 싶게 느껴졌는지 보는 점수

해석 기준:

- `80점 이상`: 알짜배기 콘텐츠
- `25점 미만`: 정보 밀도나 실용 팁을 더 넣을 필요가 있다

### 👤 팬 전환 점수

- raw 공식: `팔로우 증가 수 / 도달 계정 수 * 1000`
- 정규화 기준: `raw 0.3 = 100점`
- 의미: 이 영상이 새로운 팬을 얼마나 잘 만들었는지 보는 점수

해석 기준:

- `80점 이상`: 브랜딩과 계정 매력이 잘 먹히는 상태
- `35점 미만`: 영상 마지막에 크리에이터만의 관점과 캐릭터를 더 드러낼 필요가 있다

## 리포트 형식

개별 영상 리포트는 길게 늘어놓지 않고 아래 흐름으로 짧게 나온다.

- 한 줄 총평
- 후킹 / 가치 / 팬 전환 점수
- Action: 바로 다음 영상에서 할 행동 1개
- Analysis: 숫자 해석 1개
- Memo: 내 코멘트와 연결한 피드백 1개

후킹 추천과 다음 주제 추천은 `매 영상마다 길게 주지 않고`, 나중에 주간 분석 기능으로 확장하는 방향을 기본 원칙으로 둔다.

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
- `DISCORD_REPORT_CHANNEL_ID`
- `DISCORD_MENTION_ID` (선택, 모든 결과 멘션용)
- `DISCORD_REPORT_MENTION_ID` (선택)
- `OPENAI_API_KEY`
- `GOOGLE_SHEET_ID`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`

`GOOGLE_PRIVATE_KEY`는 Railway에서 사용할 때 실제 줄바꿈 형태로 넣는 것이 가장 안전하다.

## 7. 설치와 실행

```bash
npm install
npm start
```

## 8. 결과 확인

- 입력 채널에서 `/reels-input`을 실행한다.
- 시트에 새 행이 추가되면 저장 성공이다.
- 결과 채널에 분석 메시지가 오면 전체 흐름이 성공이다.

## 9. 자주 막히는 부분

### 슬래시 명령이 안 보이는 경우

- 봇이 서버에 초대되어 있는지 본다.
- 봇이 재배포 후 정상 로그인했는지 본다.
- 입력 채널에서 `/reels-input`을 다시 검색해 본다.

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
- 주간 후킹 추천
- 인스타 캡션 초안 생성
- 다음 주제 추천 전용 명령어 추가
