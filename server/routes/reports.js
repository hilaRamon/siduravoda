import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";
import { attachUser, requireAuth } from "../middleware/auth.js";

const router = express.Router();
router.use(attachUser);
router.use(requireAuth);

const fontsDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../assets/fonts",
);

// Unicode ranges so Chrome picks the right subset per glyph (Hebrew vs Latin/digits).
const SUBSET_RANGES = {
  hebrew: "U+0590-05FF, U+200C-2010, U+20AA, U+25CC, U+FB1D-FB4F",
  latin:
    "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212",
};
const WEIGHTS = [400, 500, 700, 800];

const LAUNCH_ARGS = ["--no-sandbox", "--disable-setuid-sandbox"];

/** Build @font-face declarations once, embedding the bundled woff2 as data URIs. */
function buildFontFaceCss() {
  const faces = [];
  for (const subset of Object.keys(SUBSET_RANGES)) {
    for (const weight of WEIGHTS) {
      const file = path.join(fontsDir, `heebo-${subset}-${weight}-normal.woff2`);
      if (!fs.existsSync(file)) continue;
      const base64 = fs.readFileSync(file).toString("base64");
      faces.push(
        `@font-face{font-family:'Heebo';font-style:normal;font-weight:${weight};font-display:swap;` +
          `src:url(data:font/woff2;base64,${base64}) format('woff2');` +
          `unicode-range:${SUBSET_RANGES[subset]};}`,
      );
    }
  }
  return faces.join("\n");
}

const FONT_FACE_CSS = buildFontFaceCss();

function isBrowserClosedError(error) {
  const message = error?.message || "";
  return (
    message.includes("Connection closed") ||
    message.includes("Target closed") ||
    message.includes("Protocol error") ||
    error?.name === "ConnectionClosedError" ||
    error?.name === "TargetCloseError"
  );
}

function buildDocument(bodyHtml) {
  return (
    "<!doctype html><html dir=\"rtl\" lang=\"he\"><head><meta charset=\"utf-8\">" +
    `<style>${FONT_FACE_CSS}` +
    "*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;}" +
    "html,body{margin:0;padding:0;background:#fff;font-family:'Heebo',Arial,sans-serif;}" +
    "</style></head><body>" +
    bodyHtml +
    "</body></html>"
  );
}

async function renderPdf(html) {
  let browser;
  let page;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: LAUNCH_ARGS,
    });
    page = await browser.newPage();

    // Sandbox the page: only allow inline/data resources, block any outbound network.
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      const url = request.url();
      if (url.startsWith("data:") || url.startsWith("about:")) {
        return request.continue();
      }
      return request.abort();
    });

    await page.setContent(buildDocument(html), { waitUntil: "load", timeout: 30_000 });
    return await page.pdf({
      format: "a4",
      printBackground: true,
      margin: { top: "8mm", bottom: "8mm", left: "8mm", right: "8mm" },
    });
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

async function renderPdfWithRetry(html, attempts = 2) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await renderPdf(html);
    } catch (error) {
      lastError = error;
      if (!isBrowserClosedError(error) || attempt === attempts - 1) {
        throw error;
      }
    }
  }
  throw lastError;
}

router.post("/core/html-to-pdf", async (req, res, next) => {
  const { html } = req.body || {};
  if (!html || typeof html !== "string") {
    return res.status(400).json({ message: "Missing html" });
  }

  try {
    const pdf = await renderPdfWithRetry(html);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", pdf.length);
    return res.send(Buffer.from(pdf));
  } catch (error) {
    console.error("html-to-pdf failed:", error);
    return next(error);
  }
});

export default router;
