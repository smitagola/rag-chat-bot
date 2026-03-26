import fs from "fs";
import path from "path";
import pdf from "pdf-parse";
import mammoth from "mammoth";
import axios from "axios";
import * as cheerio from "cheerio";
import { logger } from "../utils/logger.js";

const SUPPORTED_EXTENSIONS = [".txt", ".pdf", ".docx"];

export async function loadFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    throw new Error(
      `Unsupported file type "${ext}". Allowed: ${SUPPORTED_EXTENSIONS.join(", ")}`
    );
  }

  logger.info("Loading file", { filePath, ext });

  if (ext === ".txt") {
    return fs.readFileSync(filePath, "utf-8");
  }

  if (ext === ".pdf") {
    const buffer = fs.readFileSync(filePath);
    const data = await pdf(buffer);
    if (!data.text?.trim()) throw new Error("PDF appears to be empty or image-only");
    return data.text;
  }

  if (ext === ".docx") {
    const buffer = fs.readFileSync(filePath);
    const result = await mammoth.extractRawText({ buffer });
    if (!result.value?.trim()) throw new Error("DOCX appears to be empty");
    return result.value;
  }
}

export async function loadUrl(url) {
  logger.info("Fetching URL", { url });

  const { data: html } = await axios.get(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "text/html,application/xhtml+xml",
    },
    timeout: 15_000,
  });

  const $ = cheerio.load(html);

  // Strip noise elements
  $(
    "script, style, nav, footer, header, noscript, iframe, " +
    "aside, .ads, .advertisement, .cookie-banner, .popup"
  ).remove();

  // Prefer semantic content containers
  const main =
    $("main").text() ||
    $("article").text() ||
    $("[role='main']").text() ||
    $(".content, #content, .post, .article").text() ||
    $("body").text();

  const cleaned = main.replace(/\s+/g, " ").trim();

  if (cleaned.length < 100) {
    throw new Error("Page content too short — may be behind a login or bot-protected");
  }

  logger.info("URL loaded", { url, chars: cleaned.length });
  return cleaned;
}