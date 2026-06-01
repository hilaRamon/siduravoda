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

let browserPromise = null;
function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer
      .launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      })
      .catch((error) => {
        browserPromise = null;
        throw error;
      });
  }
  return browserPromise;
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

router.post("/core/html-to-pdf", async (req, res, next) => {
  const { html } = req.body || {};
  if (!html || typeof html !== "string") {
    return res.status(400).json({ message: "Missing html" });
  }

  let page;
  try {
    const browser = await getBrowser();
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

    await page.setContent(buildDocument(html), { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: "a4",
      printBackground: true,
      margin: { top: "8mm", bottom: "8mm", left: "8mm", right: "8mm" },
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", pdf.length);
    return res.send(Buffer.from(pdf));
  } catch (error) {
    return next(error);
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
  }
});

export default router;
