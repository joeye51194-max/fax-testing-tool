require("dotenv").config();

const crypto = require("crypto");
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const PDFDocument = require("pdfkit");

const app = express();
const port = Number(process.env.PORT || 3000);

const siteUrl = (process.env.SITE_URL || `http://localhost:${port}`).replace(/\/$/, "");
const dryRun =
  String(process.env.DRY_RUN || "").toLowerCase() === "true" ||
  !process.env.TELNYX_API_KEY ||
  !process.env.TELNYX_FAX_CONNECTION_ID ||
  !process.env.TELNYX_FAX_FROM_NUMBER;

const rateLimitPerDay = Number(process.env.RATE_LIMIT_PER_DAY || 10);
const faxTests = new Map();

app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "script-src": ["'self'", "https://pagead2.googlesyndication.com"],
        "img-src": ["'self'", "data:", "https:"],
        "frame-src": ["https://googleads.g.doubleclick.net"],
        "connect-src": ["'self'"]
      }
    }
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));

const faxLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: rateLimitPerDay,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Daily test fax limit reached. Please try again tomorrow."
  }
});

function normalizePhoneNumber(value) {
  const trimmed = String(value || "").trim();
  if (!/^\+[1-9]\d{7,14}$/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

function createTimelineEvent(type, detail) {
  return {
    type,
    detail: detail || "",
    at: new Date().toISOString()
  };
}

function publicConfig() {
  return {
    dryRun,
    adsEnabled: String(process.env.ADS_ENABLED || "false").toLowerCase() === "true",
    adsenseClientId: process.env.ADSENSE_CLIENT_ID || "",
    adsenseSlotRect: process.env.ADSENSE_SLOT_RECT || ""
  };
}

function serializeTest(record) {
  return {
    id: record.id,
    faxId: record.faxId,
    to: record.to,
    from: record.from,
    status: record.status,
    dryRun: record.dryRun,
    failureReason: record.failureReason,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    events: record.events
  };
}

function upsertWebhookEvent(eventBody) {
  const data = eventBody.data || eventBody;
  const eventType = data.event_type || eventBody.event_type || "fax.event";
  const payload = data.payload || {};
  const faxId = payload.fax_id || data.id || payload.id;

  if (!faxId) {
    return null;
  }

  let record = [...faxTests.values()].find((item) => item.faxId === faxId);
  if (!record) {
    const id = crypto.randomUUID();
    record = {
      id,
      faxId,
      to: payload.to || "unknown",
      from: payload.from || "unknown",
      status: payload.status || eventType.replace("fax.", ""),
      dryRun: false,
      failureReason: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      events: []
    };
    faxTests.set(id, record);
  }

  record.status = payload.status || eventType.replace("fax.", "");
  record.failureReason = payload.failure_reason || record.failureReason || "";
  record.updatedAt = new Date().toISOString();
  record.events.push(createTimelineEvent(eventType, record.failureReason));
  return record;
}

async function sendProviderFax({ to, id }) {
  const response = await fetch("https://api.telnyx.com/v2/faxes", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.TELNYX_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      connection_id: process.env.TELNYX_FAX_CONNECTION_ID,
      from: process.env.TELNYX_FAX_FROM_NUMBER,
      to,
      media_url: `${siteUrl}/test-fax.pdf?test_id=${encodeURIComponent(id)}`,
      webhook_url: `${siteUrl}/webhooks/fax-provider`
    })
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body.errors?.[0]?.detail || body.errors?.[0]?.title || "Fax request failed.";
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return body.data || body;
}

app.get("/api/config", (req, res) => {
  res.json(publicConfig());
});

app.post("/api/fax-tests", faxLimiter, async (req, res) => {
  const to = normalizePhoneNumber(req.body.to);
  if (!to) {
    res.status(400).json({ error: "Enter the destination fax number in E.164 format, like +15551234567." });
    return;
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const record = {
    id,
    faxId: null,
    to,
    from: process.env.TELNYX_FAX_FROM_NUMBER || "not configured",
    status: dryRun ? "dry_run" : "queued",
    dryRun,
    failureReason: "",
    createdAt: now,
    updatedAt: now,
    events: [
      createTimelineEvent(
        dryRun ? "dry_run.created" : "fax.requested",
        dryRun ? "Provider variables are not configured, so no fax was sent." : "Fax request submitted."
      )
    ]
  };
  faxTests.set(id, record);

  if (dryRun) {
    res.status(202).json(serializeTest(record));
    return;
  }

  try {
    const fax = await sendProviderFax({ to, id });
    record.faxId = fax.id || null;
    record.status = fax.status || "queued";
    record.updatedAt = new Date().toISOString();
    record.events.push(createTimelineEvent("provider.accepted", "The transmission request was accepted for delivery."));
    res.status(202).json(serializeTest(record));
  } catch (error) {
    record.status = "failed";
    record.failureReason = "The fax request could not be accepted.";
    record.updatedAt = new Date().toISOString();
    record.events.push(createTimelineEvent("provider.error", error.message));
    res.status(error.status || 502).json({
      error: "The fax request could not be accepted. Check your server configuration and try again.",
      test: serializeTest(record)
    });
  }
});

app.get("/api/fax-tests/:id", (req, res) => {
  const record = faxTests.get(req.params.id);
  if (!record) {
    res.status(404).json({ error: "Fax test not found." });
    return;
  }

  res.json(serializeTest(record));
});

app.post("/webhooks/fax-provider", (req, res) => {
  upsertWebhookEvent(req.body);
  res.sendStatus(204);
});

app.get("/test-fax.pdf", (req, res) => {
  const doc = new PDFDocument({ size: "LETTER", margin: 72 });
  const testId = String(req.query.test_id || "manual-test");

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "inline; filename=\"fax-test-page.pdf\"");
  doc.pipe(res);

  doc.fontSize(24).text("Fax Test Page", { align: "center" });
  doc.moveDown();
  doc.fontSize(13).text("This is an automated fax delivery test.", { align: "center" });
  doc.moveDown(2);
  doc.fontSize(11).text(`Test ID: ${testId}`);
  doc.text(`Generated: ${new Date().toISOString()}`);
  doc.text("Purpose: confirm that the destination endpoint can receive a fax transmission.");
  doc.moveDown();
  doc.text("No reply is required. If this page was received, the destination fax endpoint accepted the test transmission.");
  doc.end();
});

app.get("/robots.txt", (req, res) => {
  res.type("text/plain").send(`User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`);
});

app.get("/sitemap.xml", (req, res) => {
  const pages = [
    "",
    "/about.html",
    "/contact.html",
    "/privacy.html",
    "/terms.html",
    "/resources.html",
    "/articles/how-to-test-a-fax-number.html",
    "/articles/what-fax-delivery-status-means.html",
    "/articles/fax-endpoint-readiness-checklist.html",
    "/articles/responsible-fax-testing.html"
  ];
  const urls = pages
    .map((page) => `<url><loc>${siteUrl}${page}</loc><changefreq>weekly</changefreq></url>`)
    .join("");
  res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
});

app.use((req, res) => {
  res.status(404).sendFile("404.html", { root: "public" });
});

app.listen(port, () => {
  console.log(`Fax testing tool running at http://localhost:${port}`);
  console.log(`Dry run mode: ${dryRun ? "on" : "off"}`);
});
