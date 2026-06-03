import express from "express";
import multer from "multer";

import { analyzeImage } from "./analyzer";

const app = express();

const upload = multer();

app.post(
  "/analyze",
  upload.single("image"),
  async (req, res) => {

    if (!req.file) {
      return res.status(400).json({
        error: "Imagem não enviada"
      });
    }

    const result = await analyzeImage(
      req.file.buffer
    );

    return res.json(result);
  }
);

app.listen(8004, () => {
  console.log(
    "Vision Service running on port 8004"
  );
});