const form = document.querySelector("#fax-form");
const numberInput = document.querySelector("#fax-number");
const resultCard = document.querySelector("#result-card");
const refreshButton = document.querySelector("#refresh-button");
const modeNote = document.querySelector("#mode-note");
const year = document.querySelector("#year");

let currentTestId = window.localStorage.getItem("faxsignal_latest_test_id");
let pollTimer = null;

year.textContent = new Date().getFullYear();

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return entities[char];
  });
}

function formatDate(value) {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function statusLabel(status) {
  return String(status || "unknown").replaceAll("_", " ");
}

function statusIcon(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized.includes("delivered")) return "✅";
  if (normalized.includes("failed") || normalized.includes("error")) return "🩺";
  if (normalized.includes("dry")) return "🧪";
  if (normalized.includes("sending") || normalized.includes("queued")) return "📡";
  return "📋";
}

function renderResult(test) {
  const events = test.events
    .map(
      (event) => `
        <li>
          <span>${escapeHtml(event.type)}</span>
          <time datetime="${escapeHtml(event.at)}">${escapeHtml(formatDate(event.at))}</time>
          ${event.detail ? `<p>${escapeHtml(event.detail)}</p>` : ""}
        </li>
      `
    )
    .join("");

  const status = statusLabel(test.status);
  const statusClass = String(test.status || "unknown").replace(/[^a-z0-9_-]/gi, "-");
  resultCard.className = `result-card status-${statusClass}`;
  resultCard.innerHTML = `
    <div class="result-topline">
      <div>
        <p class="eyebrow">Current signal</p>
        <h3><span aria-hidden="true">${statusIcon(test.status)}</span> ${escapeHtml(status)}</h3>
      </div>
      <span class="status-pill">${test.dryRun ? "Dry run" : "Live"}</span>
    </div>
    <dl class="details-grid">
      <div><dt>To</dt><dd>${escapeHtml(test.to)}</dd></div>
      <div><dt>From</dt><dd>${escapeHtml(test.from)}</dd></div>
      <div><dt>Started</dt><dd>${escapeHtml(formatDate(test.createdAt))}</dd></div>
      <div><dt>Last checked</dt><dd>${escapeHtml(formatDate(test.updatedAt))}</dd></div>
    </dl>
    ${test.failureReason ? `<p class="failure-note">${escapeHtml(test.failureReason)}</p>` : ""}
    <h4>Signal timeline</h4>
    <ol class="timeline">${events}</ol>
  `;
}

function renderError(message) {
  resultCard.className = "result-card error";
  resultCard.innerHTML = `<p>${escapeHtml(message)}</p>`;
}

async function loadConfig() {
  const response = await fetch("/api/config");
  const config = await response.json();
  if (config.dryRun) {
    modeNote.hidden = false;
    modeNote.textContent = "Dry run mode is on because fax provider variables are not configured yet.";
  }
}

async function refreshResult() {
  if (!currentTestId) {
    renderError("Start a fax check first, then refresh will re-check that result.");
    return;
  }

  const previousLabel = refreshButton.textContent;
  refreshButton.disabled = true;
  refreshButton.textContent = "Checking...";

  try {
    const response = await fetch(`/api/fax-tests/${currentTestId}`);
    if (!response.ok) {
      window.localStorage.removeItem("faxsignal_latest_test_id");
      currentTestId = null;
      refreshButton.disabled = true;
      renderError("That fax check is no longer available. Start a new check to see a fresh status.");
      return;
    }
    const test = await response.json();
    renderResult(test);
  } catch (error) {
    renderError("Refresh could not reach the status service. Try again in a moment.");
  } finally {
    if (currentTestId) {
      refreshButton.disabled = false;
    }
    refreshButton.textContent = previousLabel;
  }
}

function startPolling() {
  window.clearInterval(pollTimer);
  pollTimer = window.setInterval(refreshResult, 6000);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = form.querySelector("button");
  button.disabled = true;
  button.textContent = "Sending...";
  renderError("Starting fax test...");

  try {
    const response = await fetch("/api/fax-tests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: numberInput.value })
    });
    const body = await response.json();

    if (!response.ok) {
      if (body.test) {
        currentTestId = body.test.id;
        window.localStorage.setItem("faxsignal_latest_test_id", currentTestId);
        refreshButton.disabled = false;
        renderResult(body.test);
      }
      throw new Error(body.error || "The fax test could not be started.");
    }

    currentTestId = body.id;
    window.localStorage.setItem("faxsignal_latest_test_id", currentTestId);
    refreshButton.disabled = false;
    renderResult(body);
    startPolling();
  } catch (error) {
    renderError(error.message);
  } finally {
    button.disabled = false;
    button.textContent = "Send Test";
  }
});

refreshButton.addEventListener("click", refreshResult);

loadConfig().catch(() => {
  modeNote.hidden = false;
  modeNote.textContent = "Configuration could not be loaded.";
});

if (currentTestId) {
  refreshButton.disabled = false;
  refreshResult();
}
