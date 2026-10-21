import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import {
  addDoc,
  collection,
  getFirestore,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { telegramNotificationConfig } from "./contact-notification-config.js";

const form = document.querySelector("#contact-form");
const status = document.querySelector("#form-status");
const submitButton = form.querySelector('button[type="submit"]');
const notificationContainer = document.createElement("div");
notificationContainer.id = "contact-turnstile";
notificationContainer.className = "hidden flex justify-center";
form.querySelector("#message").closest("div").insertAdjacentElement("afterend", notificationContainer);
const configReady = Object.values(firebaseConfig).every(
  (value) => typeof value === "string" && value.length > 0 && !value.startsWith("YOUR_"),
);
const notificationReady =
  typeof telegramNotificationConfig.workerUrl === "string" &&
  telegramNotificationConfig.workerUrl.startsWith("https://") &&
  typeof telegramNotificationConfig.turnstileSiteKey === "string" &&
  telegramNotificationConfig.turnstileSiteKey.length > 0 &&
  !telegramNotificationConfig.turnstileSiteKey.startsWith("YOUR_");

let turnstileWidgetId = null;
let turnstileToken = "";

function showStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle("text-red-600", isError);
  status.classList.toggle("dark:text-red-400", isError);
  status.classList.toggle("text-emerald-600", !isError);
  status.classList.toggle("dark:text-emerald-400", !isError);
}

let db = null;
if (configReady) {
  try {
    db = getFirestore(initializeApp(firebaseConfig));
  } catch (error) {
    console.error("Firebase 초기화 오류:", error);
  }
}

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector('script[data-turnstile-api="true"]');
    if (existingScript) {
      existingScript.addEventListener("load", resolve, { once: true });
      existingScript.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.dataset.turnstileApi = "true";
    script.onload = resolve;
    script.onerror = reject;
    document.head.append(script);
  });
}

if (notificationReady) {
  notificationContainer.classList.remove("hidden");
  loadTurnstile()
    .then(() => {
      turnstileWidgetId = window.turnstile.render(notificationContainer, {
        sitekey: telegramNotificationConfig.turnstileSiteKey,
        action: "contact",
        callback: (token) => {
          turnstileToken = token;
        },
        "expired-callback": () => {
          turnstileToken = "";
        },
        "error-callback": () => {
          turnstileToken = "";
        },
      });
    })
    .catch((error) => {
      console.error("Turnstile 초기화 오류:", error);
    });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!db) {
    showStatus("문의 폼 설정이 아직 완료되지 않았어요. 잠시 후 다시 시도해주세요.", true);
    return;
  }

  if (notificationReady && !turnstileToken) {
    showStatus("스팸 방지 확인을 완료한 뒤 다시 전송해주세요.", true);
    return;
  }

  const formData = new FormData(form);
  const inquiry = {
    name: String(formData.get("name")).trim(),
    email: String(formData.get("email")).trim(),
    message: String(formData.get("message")).trim(),
    createdAt: serverTimestamp(),
  };

  submitButton.disabled = true;
  showStatus("문의 내용을 전송하고 있어요.");

  try {
    const inquiryRef = await addDoc(collection(db, "inquiries"), inquiry);
    let notificationSent = !notificationReady;

    if (notificationReady) {
      try {
        const response = await fetch(
          `${telegramNotificationConfig.workerUrl.replace(/\/+$/, "")}/notify`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              inquiryId: inquiryRef.id,
              name: inquiry.name,
              email: inquiry.email,
              message: inquiry.message,
              turnstileToken,
            }),
          },
        );

        if (!response.ok) throw new Error(`알림 서버 응답 오류: ${response.status}`);
        notificationSent = true;
      } catch (error) {
        console.error("Telegram 알림 전송 오류:", error);
      }
    }

    form.reset();
    turnstileToken = "";
    if (turnstileWidgetId !== null && window.turnstile) {
      window.turnstile.reset(turnstileWidgetId);
    }

    if (notificationSent) {
      showStatus("문의가 전송됐어요. 연락 주셔서 감사합니다!");
    } else {
      showStatus("문의는 저장됐지만 알림 전달에 실패했어요. 다시 제출하면 문의가 중복 저장될 수 있어요.", true);
    }
  } catch (error) {
    console.error("문의 저장 오류:", error);
    showStatus("전송에 실패했어요. 잠시 후 다시 시도해주세요.", true);
  } finally {
    submitButton.disabled = false;
  }
});

