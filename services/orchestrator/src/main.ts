import express from "express";
import multer from "multer";

import { classifyIntent } from "./agent";
import { callVisionService } from "./toolCaller";

const app = express();

const upload = multer();

app.post(
  "/chat",
  upload.single("image"),
  async (req, res) => {

    try {

      const message =
        (req.body.message as string) || "";

      const hasImage = Boolean(req.file);

      const intent = classifyIntent(
        message,
        hasImage
      );

      switch (intent) {

        case "vision": {

          const visionResult =
            await callVisionService(
              req.file!.buffer
            );

          return res.json({
            intent,
            answer:
              `Possíveis problemas detectados: ${visionResult.tags.join(", ")}`,
            details: visionResult
          });
        }

        case "weather": {

          return res.json({
            intent,
            answer:
              "Nesta etapa seria feita uma chamada ao MCP Weather."
          });
        }

        case "rag": {

          return res.json({
            intent,
            answer:
              "Nesta etapa seria feita uma consulta ao serviço RAG."
          });
        }
      }

    } catch (error) {

      console.error(error);

      return res.status(500).json({
        error: "Erro interno"
      });
    }
  }
);

app.listen(8002, () => {
  console.log(
    "Orchestrator running on port 8002"
  );
});