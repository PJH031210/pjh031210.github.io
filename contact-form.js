import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import {
  addDoc,
  collection,
  getFirestore,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const form = document.querySelector("#contact-form");
const status = document.querySelector("#form-status");
const submitButton = form.querySelector('button[type="submit"]');
const configReady = Object.values(firebaseConfig).every(
  (value) => typeof value === "string" && value.length > 0 && !value.startsWith("YOUR_"),
);

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

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!db) {
    showStatus("문의 폼 설정이 아직 완료되지 않았어요. 잠시 후 다시 시도해주세요.", true);
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
    await addDoc(collection(db, "inquiries"), inquiry);
    form.reset();
    showStatus("문의가 전송됐어요. 연락 주셔서 감사합니다!");
  } catch (error) {
    console.error("문의 저장 오류:", error);
    showStatus("전송에 실패했어요. 잠시 후 다시 시도해주세요.", true);
  } finally {
    submitButton.disabled = false;
  }
});
