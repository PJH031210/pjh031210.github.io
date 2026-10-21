# 텔레그램 문의 알림 설정

이 저장소의 문의 폼은 Firestore `inquiries` 컬렉션에 문의를 저장합니다. 이 Cloudflare Worker는 저장 성공 후 Turnstile 토큰을 검증하고 Telegram 봇으로 알림을 보냅니다. Firebase Cloud Functions를 쓰지 않으므로 Firebase Spark 플랜을 유지할 수 있습니다.

## 필요한 계정과 값

- Cloudflare 무료 계정
- Telegram 봇 토큰과 내 Telegram 채팅 ID
- Cloudflare Turnstile 사이트 키와 비밀 키

봇 토큰과 Turnstile 비밀 키는 이 저장소, 웹 코드, 채팅에 올리지 마세요. Cloudflare Worker의 **Settings → Variables and Secrets → Secrets**에 아래 이름으로 저장해야 합니다.

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `TURNSTILE_SECRET_KEY`

## 1. Telegram 봇 준비

1. Telegram에서 `@BotFather`를 열고 `/newbot` 명령으로 봇을 만듭니다.
2. 봇과의 개인 대화를 열고 `/start`를 보냅니다.
3. BotFather가 알려 준 토큰은 복사해 안전하게 보관합니다. 토큰을 여기에 붙여넣지 마세요.
4. `@userinfobot` 등 Telegram의 사용자 ID 확인 봇으로 본인의 숫자형 채팅 ID를 확인합니다.

## 2. 무료 Turnstile 위젯 만들기

1. Cloudflare 대시보드의 **Turnstile**에서 위젯을 추가합니다.
2. 호스트 이름으로 `pjh031210.github.io`를 등록합니다.
3. 사이트 키와 비밀 키를 받습니다. 사이트 키는 공개 웹 설정에 쓰고, 비밀 키는 Worker Secret으로만 저장합니다.

Turnstile은 무료 플랜을 제공하며 사이트 키만 브라우저에 공개합니다. Worker는 실제 알림을 보내기 전에 Turnstile 토큰을 서버 쪽에서 검증합니다.

## 3. Worker 배포

저장소 루트에서 Node.js/npm이 설치된 터미널로 실행합니다.

```powershell
npx wrangler login
npx wrangler deploy --config cloudflare/wrangler.toml
npx wrangler secret put TELEGRAM_BOT_TOKEN --config cloudflare/wrangler.toml
npx wrangler secret put TELEGRAM_CHAT_ID --config cloudflare/wrangler.toml
npx wrangler secret put TURNSTILE_SECRET_KEY --config cloudflare/wrangler.toml
```

각 `secret put` 명령은 터미널에서 값을 입력받습니다. 값을 명령줄 인수로 붙이거나 GitHub에 저장하지 마세요. 배포가 끝나면 Worker URL은 보통 `https://pjh-telegram-contact-alert.<Cloudflare 계정 하위 도메인>.workers.dev` 형식입니다.

명령 대신 Cloudflare 대시보드에서 Worker를 만들 경우 `cloudflare/worker.js` 내용을 Worker 편집기에 붙여 넣어 배포할 수 있습니다. 그 다음 Worker 설정에서 위 세 Secret을 추가해야 합니다.

## 4. 공개 웹 설정값 연결

`contact-notification-config.js`의 `workerUrl`과 `turnstileSiteKey`에 각각 배포된 Worker 기본 URL과 Turnstile 사이트 키를 입력합니다. 이 두 값은 공개되어도 되는 값입니다. 변경한 파일을 GitHub에 반영하면 웹 폼이 Turnstile 확인을 표시하고, 문의 저장이 성공한 뒤 Worker를 호출합니다.

현재 허용 Origin은 `https://pjh031210.github.io`로 제한되어 있습니다. 사이트 주소를 바꾸면 `cloudflare/worker.js`의 `ALLOWED_ORIGIN`과 `ALLOWED_HOSTNAME`도 함께 바꿔야 합니다.

