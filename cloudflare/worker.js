const ALLOWED_ORIGIN = "https://pjh031210.github.io";
const ALLOWED_HOSTNAME = "pjh031210.github.io";
const TELEGRAM_TEXT_CHUNK_SIZE = 3500;

function corsHeaders(origin) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    Vary: "Origin",
  });

  if (origin === ALLOWED_ORIGIN) {
    headers.set("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
    headers.set("Access-Control-Max-Age", "86400");
  }

  return headers;
}

function jsonResponse(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(origin),
  });
}

function splitText(text, maxLength) {
  const characters = Array.from(text);
  const chunks = [];

  for (let index = 0; index < characters.length; index += maxLength) {
    chunks.push(characters.slice(index, index + maxLength).join(""));
  }

  return chunks;
}

async function verifyTurnstile(token, secret) {
  const formData = new URLSearchParams({ secret, response: token });
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formData,
  });

  if (!response.ok) return false;

  const result = await response.json();
  return (
    result.success === true &&
    result.hostname === ALLOWED_HOSTNAME &&
    result.action === "contact"
  );
}

async function sendTelegramMessages(inquiry, env) {
  const header = [
    "📩 새 홈페이지 문의",
    `문서 ID: ${inquiry.inquiryId}`,
    `이름: ${inquiry.name}`,
    `이메일: ${inquiry.email}`,
    "메시지:",
  ].join("\n");

  const messageChunks = splitText(inquiry.message, TELEGRAM_TEXT_CHUNK_SIZE);
  const apiUrl = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;

  for (let index = 0; index < messageChunks.length; index += 1) {
    const prefix = index === 0
      ? `${header}\n`
      : `📩 문의 메시지 이어짐 (${index + 1}/${messageChunks.length})\n`;
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text: `${prefix}${messageChunks[index]}`,
      }),
    });

    if (!response.ok) return false;
    const result = await response.json();
    if (result.ok !== true) return false;
  }

  return true;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    if (origin !== ALLOWED_ORIGIN) {
      return jsonResponse({ error: "Origin not allowed" }, 403, origin);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/notify") {
      return jsonResponse({ error: "Not found" }, 404, origin);
    }

    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 20000) {
      return jsonResponse({ error: "Request too large" }, 413, origin);
    }

    let inquiry;
    try {
      inquiry = JSON.parse(rawBody);
    } catch {
      return jsonResponse({ error: "Invalid request" }, 400, origin);
    }

    const name = typeof inquiry.name === "string" ? inquiry.name.trim() : "";
    const email = typeof inquiry.email === "string" ? inquiry.email.trim() : "";
    const message = typeof inquiry.message === "string" ? inquiry.message.trim() : "";
    const inquiryId = typeof inquiry.inquiryId === "string" ? inquiry.inquiryId.trim() : "";
    const token = typeof inquiry.turnstileToken === "string" ? inquiry.turnstileToken : "";

    if (
      name.length < 1 || name.length > 80 ||
      email.length < 3 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      message.length < 1 || message.length > 5000 ||
      inquiryId.length < 1 || inquiryId.length > 128 ||
      token.length < 1 || token.length > 2048
    ) {
      return jsonResponse({ error: "Invalid request" }, 400, origin);
    }

    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID || !env.TURNSTILE_SECRET_KEY) {
      return jsonResponse({ error: "Notification service is not configured" }, 503, origin);
    }

    try {
      const validToken = await verifyTurnstile(token, env.TURNSTILE_SECRET_KEY);
      if (!validToken) return jsonResponse({ error: "Verification failed" }, 400, origin);

      const sent = await sendTelegramMessages({ inquiryId, name, email, message }, env);
      if (!sent) return jsonResponse({ error: "Notification failed" }, 502, origin);

      return jsonResponse({ ok: true }, 200, origin);
    } catch {
      console.error("Telegram notification failed");
      return jsonResponse({ error: "Notification failed" }, 502, origin);
    }
  },
};

