import fs from "fs";
import path from "path";
import { ingestText, clearIndex } from "./src/services/vectorStore.js";

const rootPaths = [
  "/home/smit-agola/Desktop/qserves/qserves-backend/src",
  "/home/smit-agola/Desktop/qserves/qserves-frontend/src"
];

const ALLOWED_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".md"];
const IGNORED_DIRS = ["node_modules", ".git", "dist", "build"];

async function walk(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (!IGNORED_DIRS.includes(file)) {
        await walk(filePath, fileList);
      }
    } else {
      const ext = path.extname(file).toLowerCase();
      if (ALLOWED_EXTENSIONS.includes(ext)) {
        fileList.push(filePath);
      }
    }
  }
  return fileList;
}

async function startIngestion() {
  try {
    console.log("Starting full project ingestion...");
    
    // Clear existing index to avoid duplicates and use new chunk size
    await clearIndex();

    for (const root of rootPaths) {
      console.log(`Scanning ${root}...`);
      const files = await walk(root);
      console.log(`Found ${files.length} files in ${root}`);

      for (const file of files) {
        try {
          const content = fs.readFileSync(file, "utf8");
          const relativePath = path.relative("/home/smit-agola/Desktop/qserves", file);
          
          process.stdout.write(`Ingesting ${relativePath}... `);
          const result = await ingestText(content, { source: relativePath });
          console.log(`Done (${result.chunks} chunks)`);
        } catch (err) {
          console.error(`\nFailed to ingest ${file}:`, err.message);
        }
      }
    }

    console.log("\nIngestion complete!");
    process.exit(0);
  } catch (err) {
    console.error("Batch ingestion failed:", err);
    process.exit(1);
  }
}

// Ensure running from project root to access src/ services
startIngestion();
