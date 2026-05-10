import fs from "fs";
import { ingestText } from "./src/services/vectorStore.js";

async function run() {
  console.log("Loading FOODDESK_KNOWLEDGE.md");
  const content = fs.readFileSync("FOODDESK_KNOWLEDGE.md", "utf8");
  console.log("Ingesting...");
  const result = await ingestText(content, { source: "FOODDESK_KNOWLEDGE.md" });
  console.log(`Done! Chunks: ${result.chunks}`);
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
