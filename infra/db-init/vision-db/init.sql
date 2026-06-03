CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS vision_logs (
    id SERIAL PRIMARY KEY,
    image_reference VARCHAR(255),
    analysis_tags JSONB,
    visual_embedding VECTOR(512) -- Adjust size based on your multimodal model
);