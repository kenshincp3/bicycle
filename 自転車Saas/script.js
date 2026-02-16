const STORAGE_KEYS = {
  sessionUser: "safety_manual_mock_session_user",
  registeredUser: "safety_manual_mock_registered_user",
  history: "safety_manual_mock_history_v1",
};

const DEMO_USER = {
  email: "demo@safetymanual.ai",
  password: "safety1234",
};

const RESPONSE_STATE_IDS = {
  initial: "stateInitial",
  loading: "stateLoading",
  success: "stateSuccess",
  noEvidence: "stateNoEvidence",
};

const appState = {
  user: null,
  registeredUser: null,
  history: [],
  currentRoute: "question",
  currentResult: null,
  modalItemId: null,
  activeResponseState: "initial",
};

const els = {
  publicApp: document.getElementById("publicApp"),
  privateApp: document.getElementById("privateApp"),
  publicScreens: Array.from(document.querySelectorAll(".public-screen")),
  privateScreens: Array.from(document.querySelectorAll(".private-screen")),
  publicNavButtons: Array.from(document.querySelectorAll("[data-public-nav]")),
  routeButtons: Array.from(document.querySelectorAll("[data-route]")),

  signupForm: document.getElementById("signupForm"),
  signupEmail: document.getElementById("signupEmail"),
  signupPassword: document.getElementById("signupPassword"),
  signupPasswordConfirm: document.getElementById("signupPasswordConfirm"),
  signupEmailError: document.getElementById("signupEmailError"),
  signupPasswordError: document.getElementById("signupPasswordError"),
  signupConfirmError: document.getElementById("signupConfirmError"),

  loginForm: document.getElementById("loginForm"),
  loginEmail: document.getElementById("loginEmail"),
  loginPassword: document.getElementById("loginPassword"),
  loginError: document.getElementById("loginError"),
  forgotPasswordBtn: document.getElementById("forgotPasswordBtn"),

  userMenuToggle: document.getElementById("userMenuToggle"),
  userMenuPanel: document.getElementById("userMenuPanel"),
  accountBtn: document.getElementById("accountBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
  userInitial: document.getElementById("userInitial"),
  userEmailLabel: document.getElementById("userEmailLabel"),

  questionForm: document.getElementById("questionForm"),
  questionInput: document.getElementById("questionInput"),
  questionError: document.getElementById("questionError"),
  sampleChips: Array.from(document.querySelectorAll(".sample-chip")),
  citationToggle: document.getElementById("citationToggle"),
  mockState: document.getElementById("mockState"),
  askBtn: document.getElementById("askBtn"),
  clearBtn: document.getElementById("clearBtn"),

  responseStates: Object.fromEntries(
    Object.entries(RESPONSE_STATE_IDS).map(([key, id]) => [key, document.getElementById(id)])
  ),

  answerConclusion: document.getElementById("answerConclusion"),
  answerSteps: document.getElementById("answerSteps"),
  dangerList: document.getElementById("dangerList"),
  citationBlock: document.getElementById("citationBlock"),
  citationCards: document.getElementById("citationCards"),
  saveAnswerBtn: document.getElementById("saveAnswerBtn"),

  noEvidenceText: document.querySelector(".no-evidence-text"),
  candidateList: document.getElementById("candidateList"),
  saveNoEvidenceBtn: document.getElementById("saveNoEvidenceBtn"),

  historySearch: document.getElementById("historySearch"),
  historyList: document.getElementById("historyList"),
  historyEmpty: document.getElementById("historyEmpty"),

  historyModal: document.getElementById("historyModal"),
  closeModalBtn: document.getElementById("closeModalBtn"),
  retryBtn: document.getElementById("retryBtn"),
  modalDate: document.getElementById("modalDate"),
  modalStatus: document.getElementById("modalStatus"),
  modalQuestion: document.getElementById("modalQuestion"),
  modalAnswer: document.getElementById("modalAnswer"),
  modalCitationSection: document.getElementById("modalCitationSection"),
  modalCitations: document.getElementById("modalCitations"),

  errorToast: document.getElementById("errorToast"),
  infoToast: document.getElementById("infoToast"),
};

const toastTimers = new Map();
let requestTimer = null;

init();

function init() {
  hydrateStateFromStorage();
  wireEvents();

  if (appState.user) {
    enterPrivateApp(appState.user, false);
  } else {
    showPublicScreen("lp");
  }

  setResponseState("initial");
  renderHistoryList();
}

function wireEvents() {
  els.publicNavButtons.forEach((btn) => {
    btn.addEventListener("click", () => showPublicScreen(btn.dataset.publicNav));
  });

  els.signupForm.addEventListener("submit", onSignupSubmit);
  els.loginForm.addEventListener("submit", onLoginSubmit);
  els.forgotPasswordBtn.addEventListener("click", () => {
    showInfoToast("PoCではパスワード再設定は未実装です。");
  });

  [els.signupEmail, els.signupPassword, els.signupPasswordConfirm].forEach((input) => {
    input.addEventListener("input", clearSignupErrors);
  });

  [els.loginEmail, els.loginPassword].forEach((input) => {
    input.addEventListener("input", () => {
      els.loginError.textContent = "";
    });
  });

  els.routeButtons.forEach((btn) => {
    btn.addEventListener("click", () => navigatePrivate(btn.dataset.route));
  });

  els.userMenuToggle.addEventListener("click", toggleUserMenu);
  els.accountBtn.addEventListener("click", () => {
    closeUserMenu();
    showInfoToast("PoCではアカウント設定は未実装です。");
  });

  els.logoutBtn.addEventListener("click", () => {
    closeUserMenu();
    logout();
  });

  document.addEventListener("click", (event) => {
    const target = event.target;

    if (!els.userMenuPanel.hidden) {
      const clickedInsideMenu =
        els.userMenuPanel.contains(target) || els.userMenuToggle.contains(target);

      if (!clickedInsideMenu) {
        closeUserMenu();
      }
    }

    if (target.closest("[data-close-modal='true']")) {
      closeHistoryModal();
    }
  });

  els.questionForm.addEventListener("submit", (event) => {
    event.preventDefault();
    submitQuestion({ questionText: els.questionInput.value.trim() });
  });

  els.clearBtn.addEventListener("click", () => {
    els.questionInput.value = "";
    els.questionError.textContent = "";
    els.questionInput.focus();
  });

  els.sampleChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      els.questionInput.value = chip.textContent.trim();
      els.questionError.textContent = "";
      els.questionInput.focus();
    });
  });

  els.citationToggle.addEventListener("change", updateCitationVisibility);

  els.saveAnswerBtn.addEventListener("click", saveCurrentResult);
  els.saveNoEvidenceBtn.addEventListener("click", saveCurrentResult);

  els.historySearch.addEventListener("input", () => {
    renderHistoryList(els.historySearch.value.trim());
  });

  els.historyList.addEventListener("click", (event) => {
    const button = event.target.closest(".history-item");
    if (!button) {
      return;
    }

    openHistoryModal(button.dataset.id);
  });

  els.closeModalBtn.addEventListener("click", closeHistoryModal);

  els.retryBtn.addEventListener("click", () => {
    if (!appState.modalItemId) {
      return;
    }

    const item = appState.history.find((entry) => entry.id === appState.modalItemId);
    if (!item) {
      return;
    }

    closeHistoryModal();
    navigatePrivate("question", false);
    els.questionInput.value = item.question;
    submitQuestion({ questionText: item.question, silentIfEmpty: true });
  });
}

function hydrateStateFromStorage() {
  try {
    const persistedUser = readStorage(STORAGE_KEYS.sessionUser);
    const registeredUser = readStorage(STORAGE_KEYS.registeredUser);
    const history = readStorage(STORAGE_KEYS.history);

    if (persistedUser?.email) {
      appState.user = persistedUser;
    }

    if (registeredUser?.email && registeredUser?.password) {
      appState.registeredUser = registeredUser;
    }

    if (Array.isArray(history) && history.length > 0) {
      appState.history = history;
    } else {
      appState.history = makeSeedHistory();
      writeStorage(STORAGE_KEYS.history, appState.history);
    }
  } catch (error) {
    appState.history = makeSeedHistory();
  }
}

function readStorage(key) {
  const raw = window.localStorage.getItem(key);
  return raw ? JSON.parse(raw) : null;
}

function writeStorage(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function showPublicScreen(screenName) {
  els.publicScreens.forEach((screen) => {
    const active = screen.dataset.screen === screenName;
    screen.classList.toggle("is-active", active);
  });
}

function onSignupSubmit(event) {
  event.preventDefault();
  clearSignupErrors();

  const email = els.signupEmail.value.trim();
  const password = els.signupPassword.value;
  const confirmPassword = els.signupPasswordConfirm.value;

  let hasError = false;

  if (!isValidEmail(email)) {
    hasError = true;
    els.signupEmailError.textContent = "メールアドレスの形式を確認してください";
  }

  if (password.length < 8) {
    hasError = true;
    els.signupPasswordError.textContent = "8文字以上で入力してください";
  }

  if (password !== confirmPassword) {
    hasError = true;
    els.signupConfirmError.textContent = "パスワードが一致しません";
  }

  if (hasError) {
    return;
  }

  const registeredUser = { email, password };
  appState.registeredUser = registeredUser;
  writeStorage(STORAGE_KEYS.registeredUser, registeredUser);

  els.signupForm.reset();
  enterPrivateApp({ email }, true);
}

function clearSignupErrors() {
  els.signupEmailError.textContent = "";
  els.signupPasswordError.textContent = "";
  els.signupConfirmError.textContent = "";
}

function onLoginSubmit(event) {
  event.preventDefault();

  const email = els.loginEmail.value.trim();
  const password = els.loginPassword.value;

  const matchDemo = email === DEMO_USER.email && password === DEMO_USER.password;
  const matchRegistered =
    appState.registeredUser &&
    email === appState.registeredUser.email &&
    password === appState.registeredUser.password;

  if (!matchDemo && !matchRegistered) {
    els.loginError.textContent = "メールアドレスまたはパスワードが正しくありません";
    return;
  }

  els.loginError.textContent = "";
  els.loginForm.reset();
  enterPrivateApp({ email }, true);
}

function enterPrivateApp(user, notify) {
  appState.user = { email: user.email };
  writeStorage(STORAGE_KEYS.sessionUser, appState.user);

  els.publicApp.style.display = "none";
  els.privateApp.classList.remove("is-hidden");

  applyUserToHeader();
  navigatePrivate("question", false);

  if (notify) {
    showInfoToast("ログインしました。質問ページに移動します。");
  }
}

function logout() {
  appState.user = null;
  writeStorage(STORAGE_KEYS.sessionUser, null);

  els.privateApp.classList.add("is-hidden");
  els.publicApp.style.display = "block";
  showPublicScreen("login");
  showInfoToast("ログアウトしました。");
}

function applyUserToHeader() {
  const email = appState.user?.email || "user@example.com";
  els.userEmailLabel.textContent = email;
  els.userInitial.textContent = email.charAt(0).toUpperCase() || "U";
}

function navigatePrivate(route, autosave = true) {
  if (autosave && route === "history") {
    saveCurrentResult({
      auto: true,
      message: "最新の回答を履歴に保存しました。",
    });
  }

  appState.currentRoute = route;

  els.routeButtons.forEach((button) => {
    const active = button.dataset.route === route;
    button.classList.toggle("is-active", active);
  });

  els.privateScreens.forEach((screen) => {
    const active = screen.dataset.routeScreen === route;
    screen.classList.toggle("is-active", active);
  });

  if (route === "history") {
    renderHistoryList(els.historySearch.value.trim());
  }
}

function toggleUserMenu() {
  const isOpen = !els.userMenuPanel.hidden;
  els.userMenuPanel.hidden = isOpen;
  els.userMenuToggle.setAttribute("aria-expanded", String(!isOpen));
}

function closeUserMenu() {
  els.userMenuPanel.hidden = true;
  els.userMenuToggle.setAttribute("aria-expanded", "false");
}

function submitQuestion({ questionText, silentIfEmpty = false }) {
  const question = questionText.trim();

  if (!question) {
    if (!silentIfEmpty) {
      els.questionError.textContent = "質問を入力してください";
    }
    return;
  }

  els.questionError.textContent = "";

  const previousState = appState.activeResponseState;
  const selectedMode = els.mockState.value;

  setResponseState("loading");
  setQuestionFormPending(true);

  clearTimeout(requestTimer);
  requestTimer = window.setTimeout(() => {
    const outcome = resolveOutcome(selectedMode, question);

    if (outcome === "error") {
      setResponseState(previousState === "loading" ? "initial" : previousState);
      setQuestionFormPending(false);
      showErrorToast("現在AIが混み合っています。時間をおいて再度お試しください。");
      return;
    }

    if (outcome === "no_evidence") {
      appState.currentResult = buildNoEvidenceResult(question);
      renderNoEvidence(appState.currentResult);
      setResponseState("noEvidence");
    } else {
      appState.currentResult = buildSuccessResult(question);
      renderSuccess(appState.currentResult);
      setResponseState("success");
    }

    updateSaveButtons();
    setQuestionFormPending(false);
  }, 1150);
}

function setQuestionFormPending(isPending) {
  els.askBtn.disabled = isPending;
  els.clearBtn.disabled = isPending;
  els.askBtn.textContent = isPending ? "送信中…" : "質問する";
}

function resolveOutcome(mode, question) {
  if (mode !== "auto") {
    return mode;
  }

  const text = question.toLowerCase();

  if (/天気|売上|人事|休暇|採用|給与|価格|雑談/.test(text)) {
    return "no_evidence";
  }

  if (/混雑|error|エラー|遅い|timeout|落ちる/.test(text)) {
    return "error";
  }

  return "success";
}

function setResponseState(nextState) {
  appState.activeResponseState = nextState;

  Object.entries(els.responseStates).forEach(([stateKey, node]) => {
    node.classList.toggle("is-active", stateKey === nextState);
  });
}

function buildSuccessResult(question) {
  const focus = detectFocus(question);

  return {
    id: makeId("qa"),
    createdDate: new Date().toISOString(),
    status: "success",
    question,
    answer: {
      conclusion: `${focus}では、根拠が確認できる手順のみで点検を進め、異常の切り分け前に引き渡ししないことが必須です。`,
      steps: [
        "症状を再現し、作業前チェックシートに現象を記録する",
        "整備マニュアルの該当章で規定値・確認順を照合する",
        "制動・締結・変速の順に安全系を優先して点検する",
        "規定値が不明な項目は作業を中断し、責任者に確認する",
        "完了後に再点検とダブルチェックを実施してから引き渡す",
      ],
      dangerList: [
        "根拠が不明な締結を“感覚”で行わない",
        "制動系の確認なしで引き渡さない",
        "異常原因を未特定のまま部品交換で済ませない",
      ],
    },
    citations: [
      {
        title: `${focus} / 点検フロー 第2章`,
        excerpt:
          "異常が発生した場合は、現象再現・規定値照合・安全系統の優先確認を行い、未確認項目が残る場合は作業を中断する。",
        source: "参照元：安全整備標準マニュアル v3.2",
      },
      {
        title: "ブレーキ調整手順 / 引き渡し判定",
        excerpt:
          "制動確認が完了していない車体を引き渡してはならない。最終判定はチェックシート記録と責任者承認をもって行う。",
        source: "参照元：危険工程ハンドブック 第4版",
      },
      {
        title: "締結トルク不明時のエスカレーション",
        excerpt:
          "規定トルク値が不明な場合、仮締め運用は不可。該当資料を確認し、責任者判断を得るまで作業を停止する。",
        source: "参照元：整備QAナレッジ集 2025",
      },
    ],
    saved: false,
  };
}

function buildNoEvidenceResult(question) {
  return {
    id: makeId("qa"),
    createdDate: new Date().toISOString(),
    status: "no_evidence",
    question,
    answer: {
      text: "提供ナレッジ内に十分な根拠が見つかりませんでした。責任者に確認してください。",
      candidates: [
        "異常時エスカレーション基準 / 安全判断フロー",
        "制動系 点検チェックシート / 必須確認項目",
        "締結トルク管理 / 規定値未確認時の対応",
      ],
    },
    citations: [],
    saved: false,
  };
}

function detectFocus(question) {
  if (question.includes("ブレーキ")) {
    return "ブレーキ系統";
  }

  if (question.includes("締結") || question.includes("トルク")) {
    return "締結トルク管理";
  }

  if (question.includes("変速")) {
    return "変速機構";
  }

  return "危険工程";
}

function renderSuccess(result) {
  els.answerConclusion.textContent = result.answer.conclusion;

  els.answerSteps.innerHTML = result.answer.steps
    .map((step) => `<li>${escapeHtml(step)}</li>`)
    .join("");

  els.dangerList.innerHTML = result.answer.dangerList
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");

  els.citationCards.innerHTML = result.citations
    .map(
      (citation) => `
        <article class="citation-card">
          <h5>${escapeHtml(citation.title)}</h5>
          <p>${escapeHtml(citation.excerpt)}</p>
          <p class="citation-src">${escapeHtml(citation.source)}</p>
        </article>
      `
    )
    .join("");

  updateCitationVisibility();
}

function renderNoEvidence(result) {
  els.noEvidenceText.textContent = result.answer.text;
  els.candidateList.innerHTML = result.answer.candidates
    .map((candidate) => `<li>${escapeHtml(candidate)}</li>`)
    .join("");
}

function updateCitationVisibility() {
  const shouldShow = els.citationToggle.checked;
  els.citationBlock.style.display = shouldShow ? "block" : "none";
}

function saveCurrentResult(options = {}) {
  const { auto = false, message } = options;

  if (!appState.currentResult) {
    return;
  }

  if (appState.currentResult.saved) {
    if (!auto) {
      showInfoToast("この回答はすでに履歴に保存されています。");
    }
    return;
  }

  const entry = {
    id: appState.currentResult.id,
    createdDate: appState.currentResult.createdDate,
    status: appState.currentResult.status,
    question: appState.currentResult.question,
    answer: appState.currentResult.answer,
    citations: appState.currentResult.citations,
    userEmail: appState.user?.email ?? "",
  };

  appState.history.unshift(entry);
  appState.currentResult.saved = true;

  writeStorage(STORAGE_KEYS.history, appState.history);
  updateSaveButtons();
  renderHistoryList(els.historySearch.value.trim());

  if (auto) {
    if (message) {
      showInfoToast(message);
    }
  } else {
    showInfoToast(message || "履歴に保存しました。");
  }
}

function updateSaveButtons() {
  const isSaved = Boolean(appState.currentResult?.saved);
  const label = isSaved ? "保存済み" : "この回答を履歴に保存";

  [els.saveAnswerBtn, els.saveNoEvidenceBtn].forEach((button) => {
    button.textContent = label;
    button.classList.toggle("is-saved", isSaved);
  });
}

function renderHistoryList(keyword = "") {
  const query = keyword.toLowerCase();
  const items = appState.history.filter((entry) => {
    if (!query) {
      return true;
    }

    const haystack = `${entry.question} ${entry.status}`.toLowerCase();
    return haystack.includes(query);
  });

  els.historyList.innerHTML = "";

  if (items.length === 0) {
    els.historyEmpty.hidden = false;
    return;
  }

  els.historyEmpty.hidden = true;

  const fragment = document.createDocumentFragment();

  items.forEach((entry) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "history-item";
    button.dataset.id = entry.id;

    const statusLabel = entry.status === "success" ? "成功" : "根拠不足";
    const statusClass = entry.status === "success" ? "status-success" : "status-warning";
    const preview = entry.question.split("\n")[0];

    button.innerHTML = `
      <div class="history-row">
        <span class="history-date">${formatDate(entry.createdDate)}</span>
        <span class="status-badge ${statusClass}">${statusLabel}</span>
      </div>
      <p class="history-question">${escapeHtml(preview)}</p>
    `;

    fragment.appendChild(button);
  });

  els.historyList.appendChild(fragment);
}

function openHistoryModal(id) {
  const item = appState.history.find((entry) => entry.id === id);
  if (!item) {
    return;
  }

  appState.modalItemId = item.id;

  els.modalDate.textContent = formatDate(item.createdDate);
  els.modalStatus.textContent = item.status === "success" ? "成功" : "根拠不足";
  els.modalQuestion.textContent = item.question;

  if (item.status === "success") {
    els.modalAnswer.innerHTML = `
      <div class="modal-answer">
        <p><strong>結論：</strong>${escapeHtml(item.answer.conclusion)}</p>
        <p><strong>手順：</strong></p>
        <ol>${item.answer.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>
        <p><strong>やってはいけない：</strong></p>
        <ul>${item.answer.dangerList.map((danger) => `<li>${escapeHtml(danger)}</li>`).join("")}</ul>
      </div>
    `;

    if (Array.isArray(item.citations) && item.citations.length > 0) {
      els.modalCitationSection.hidden = false;
      els.modalCitations.innerHTML = item.citations
        .map(
          (citation) => `
            <div class="modal-citation">
              <p><strong>${escapeHtml(citation.title)}</strong></p>
              <p>${escapeHtml(citation.excerpt)}</p>
              <p class="citation-src">${escapeHtml(citation.source)}</p>
            </div>
          `
        )
        .join("");
    } else {
      els.modalCitationSection.hidden = true;
      els.modalCitations.innerHTML = "";
    }
  } else {
    els.modalAnswer.innerHTML = `
      <div class="modal-answer">
        <p>${escapeHtml(item.answer.text)}</p>
        <p><strong>候補見出し：</strong></p>
        <ul>${item.answer.candidates.map((candidate) => `<li>${escapeHtml(candidate)}</li>`).join("")}</ul>
      </div>
    `;

    els.modalCitationSection.hidden = true;
    els.modalCitations.innerHTML = "";
  }

  els.historyModal.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeHistoryModal() {
  appState.modalItemId = null;
  els.historyModal.hidden = true;
  document.body.style.overflow = "";
}

function showErrorToast(message) {
  showToast(els.errorToast, message);
}

function showInfoToast(message) {
  showToast(els.infoToast, message);
}

function showToast(element, message) {
  element.textContent = message;
  element.classList.add("is-visible");

  const existingTimer = toastTimers.get(element);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const timerId = window.setTimeout(() => {
    element.classList.remove("is-visible");
    toastTimers.delete(element);
  }, 2600);

  toastTimers.set(element, timerId);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function formatDate(value) {
  const date = new Date(value);

  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function makeSeedHistory() {
  const now = Date.now();

  return [
    {
      id: makeId("seed"),
      createdDate: new Date(now - 1000 * 60 * 40).toISOString(),
      status: "success",
      question: "ブレーキの効きが弱い。作業でやってはいけないことは？",
      answer: {
        conclusion:
          "ブレーキ系統では、制動確認前の引き渡しを避け、規定値確認が取れる作業のみを進める必要があります。",
        steps: [
          "現象を再現して作業前の状態を記録する",
          "パッド・ワイヤ・ローターの摩耗基準を照合する",
          "調整後に制動距離を再測定する",
          "安全系のダブルチェックを行う",
          "責任者確認後に引き渡す",
        ],
        dangerList: [
          "感覚だけでワイヤ張力を決めない",
          "試走なしで引き渡さない",
          "異音の原因未確認で作業完了にしない",
        ],
      },
      citations: [
        {
          title: "ブレーキ調整手順 / 章2",
          excerpt: "制動確認が未完了の車体を引き渡してはならない。",
          source: "参照元：安全整備標準マニュアル v3.2",
        },
      ],
      userEmail: "demo@safetymanual.ai",
    },
    {
      id: makeId("seed"),
      createdDate: new Date(now - 1000 * 60 * 95).toISOString(),
      status: "no_evidence",
      question: "新しい素材フレームの独自加工を試してよい？",
      answer: {
        text: "提供ナレッジ内に十分な根拠が見つかりませんでした。責任者に確認してください。",
        candidates: [
          "材料別加工制限 / 危険工程ガイド",
          "新規工法の承認フロー",
          "安全確認未完了時の作業停止基準",
        ],
      },
      citations: [],
      userEmail: "demo@safetymanual.ai",
    },
  ];
}

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
