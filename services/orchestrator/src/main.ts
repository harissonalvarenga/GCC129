import express from "express";
import multer from "multer";

import { classifyIntent } from "./agent";
import { callVisionService, callRagService } from "./toolCaller";
import { streamAnswer } from "./synthesis";
import { getWeather, extractCity } from "./mcpClient";

const app = express();

// Base64 images arrive as JSON — raise the limit to handle phone photos.
app.use(express.json({ limit: "25mb" }));
const upload = multer();

// Helpers for newline-delimited JSON streaming (NDJSON).
function startNDJSON(res: express.Response) {
  res.setHeader("Content-Type", "application/x-ndjson");
  res.setHeader("Transfer-Encoding", "chunked");
  res.setHeader("Cache-Control", "no-cache");
}

function writeLine(res: express.Response, obj: object) {
  res.write(JSON.stringify(obj) + "\n");
}

// Chunks whose best rerank score is below this are not relevant to the query.
// In-corpus queries score ~0.99; out-of-corpus queries score near 0 or negative.
const RELEVANCE_THRESHOLD = 0.3;

function bestScore(chunks: { rerank_score?: number | null }[]): number {
  return chunks.reduce((m, c) => Math.max(m, c.rerank_score ?? 0), -Infinity);
}

async function* notFound(): AsyncGenerator<string> {
  yield "Não tenho informações suficientes sobre esse tema para orientar com segurança. Tente reformular sua pergunta ou consulte um agrônomo local.";
}

app.post(
  "/chat",
  upload.single("image"),
  async (req, res) => {
    try {
      const message = (req.body.message as string) || "";
      const imageBuffer: Buffer | null =
        req.file?.buffer ??
        (req.body.imageBase64
          ? Buffer.from(req.body.imageBase64 as string, "base64")
          : null);
      const hasImage = Boolean(imageBuffer);

      const intent = classifyIntent(message, hasImage);

      startNDJSON(res);

      switch (intent) {

        case "vision": {
          const visionDiagnosis = await callVisionService(imageBuffer!);
          const ragQuery = message ? `${message}. ${visionDiagnosis}` : visionDiagnosis;
          const chunks = await callRagService(ragQuery);
          const relevant = chunks.filter(c => (c.rerank_score ?? 0) >= RELEVANCE_THRESHOLD);

          writeLine(res, { type: "meta", intent, visionDiagnosis, sources: relevant });

          const tokens = relevant.length > 0
            ? streamAnswer({ question: message || "O que há com esta planta e como tratar?", chunks: relevant, visionDiagnosis })
            : notFound();
          for await (const token of tokens) writeLine(res, { type: "token", content: token });
          break;
        }

        case "weather": {
          const city = extractCity(message);
          const weather = await getWeather(city);
          const chunks = await callRagService(message);
          const relevant = chunks.filter(c => (c.rerank_score ?? 0) >= RELEVANCE_THRESHOLD);

          writeLine(res, { type: "meta", intent, weather, sources: relevant });

          const tokens = relevant.length > 0
            ? streamAnswer({ question: message, chunks: relevant, weather })
            : notFound();
          for await (const token of tokens) writeLine(res, { type: "token", content: token });
          break;
        }

        case "rag": {
          const chunks = await callRagService(message);
          const relevant = chunks.filter(c => (c.rerank_score ?? 0) >= RELEVANCE_THRESHOLD);

          writeLine(res, { type: "meta", intent, sources: relevant });

          const tokens = relevant.length > 0
            ? streamAnswer({ question: message, chunks: relevant })
            : notFound();
          for await (const token of tokens) writeLine(res, { type: "token", content: token });
          break;
        }
      }

      writeLine(res, { type: "done" });
      res.end();

    } catch (error) {
      console.error(error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Erro interno" });
      } else {
        writeLine(res, { type: "error", message: "Erro interno no servidor." });
        res.end();
      }
    }
  }
);

app.listen(8000, () => {
  console.log("Orchestrator running on port 8000");
});
