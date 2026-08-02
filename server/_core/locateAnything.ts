/**
 * NVIDIA LocateAnything-3B — Hugging Face Inference API Integration
 * =================================================================
 *
 * Vision-Language Model for visual grounding, object detection, and
 * point-based localization. Uses the Hugging Face Inference Providers API
 * (serverless, pay-per-use).
 *
 * Model: nvidia/LocateAnything-3B
 * Capabilities: Object Detection, Grounding, Feature Extraction, GUI Understanding
 * License: nvidia-license (non-commercial / research)
 *
 * @see https://huggingface.co/nvidia/LocateAnything-3B
 */

import { getSecret } from "./secretsManager";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BoundingBox = {
  /** Normalized x-coordinate of top-left corner (0-1000) */
  x1: number;
  /** Normalized y-coordinate of top-left corner (0-1000) */
  y1: number;
  /** Normalized x-coordinate of bottom-right corner (0-1000) */
  x2: number;
  /** Normalized y-coordinate of bottom-right corner (0-1000) */
  y2: number;
  /** Detected label / description */
  label: string;
  /** Confidence score (0-1) if available */
  confidence?: number;
};

export type LocateAnythingResult = {
  /** Raw model response text */
  rawResponse: string;
  /** Parsed bounding boxes (if detection/grounding task) */
  boxes: BoundingBox[];
  /** Model used */
  model: string;
  /** Processing time in ms */
  processingTimeMs: number;
};

export type LocateAnythingOptions = {
  /** The image URL or base64-encoded image */
  imageUrl: string;
  /** The text prompt describing what to locate/detect */
  prompt: string;
  /** Generation mode: fast (parallel), slow (autoregressive), hybrid */
  generationMode?: "fast" | "slow" | "hybrid";
  /** Max tokens for response */
  maxTokens?: number;
};

export type LocateAnythingTask =
  | "object_detection"
  | "grounding"
  | "gui_grounding"
  | "ocr_localization"
  | "pointing"
  | "dense_detection";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODEL_ID = "nvidia/LocateAnything-3B";
const HF_INFERENCE_API_URL = "https://router.huggingface.co/hf-inference/models/nvidia/LocateAnything-3B/v1/chat/completions";
const HF_INFERENCE_API_URL_FALLBACK = "https://api-inference.huggingface.co/models/nvidia/LocateAnything-3B";

// Prompt templates based on model documentation
const PROMPT_TEMPLATES: Record<LocateAnythingTask, string> = {
  object_detection: "Detect all objects in this image. Return bounding boxes with labels.",
  grounding: "Locate: {query}",
  gui_grounding: "Locate the UI element: {query}",
  ocr_localization: "Locate all text in this image with bounding boxes.",
  pointing: "Point to: {query}",
  dense_detection: "Detect all instances of every object category visible in this image.",
};

// ---------------------------------------------------------------------------
// Helper: Get HuggingFace API Key
// ---------------------------------------------------------------------------

async function getHuggingFaceApiKey(): Promise<string> {
  // 1. Try environment variable
  const envKey = process.env.HUGGINGFACE_API_KEY || process.env.HF_API_KEY;
  if (envKey) {
    return envKey;
  }

  // 2. Try database secret
  const dbKey = await getSecret("HUGGINGFACE_API_KEY");
  if (dbKey) {
    return dbKey;
  }

  throw new Error(
    "[LocateAnything] HUGGINGFACE_API_KEY not found. " +
    "Set it via environment variable (HUGGINGFACE_API_KEY or HF_API_KEY) " +
    "or store it in the secrets database."
  );
}

// ---------------------------------------------------------------------------
// Helper: Parse bounding boxes from model response
// ---------------------------------------------------------------------------

function parseBoundingBoxes(responseText: string): BoundingBox[] {
  const boxes: BoundingBox[] = [];

  // Pattern 1: <box>x1,y1,x2,y2</box><label>text</label>
  const boxLabelPattern = /<box>(\d+),(\d+),(\d+),(\d+)<\/box>\s*<label>(.*?)<\/label>/g;
  let match: RegExpExecArray | null;

  while ((match = boxLabelPattern.exec(responseText)) !== null) {
    boxes.push({
      x1: parseInt(match[1], 10),
      y1: parseInt(match[2], 10),
      x2: parseInt(match[3], 10),
      y2: parseInt(match[4], 10),
      label: match[5].trim(),
    });
  }

  if (boxes.length > 0) return boxes;

  // Pattern 2: [x1, y1, x2, y2] label format
  const bracketPattern = /\[(\d+),\s*(\d+),\s*(\d+),\s*(\d+)\]\s*(.+?)(?:\n|$)/g;
  while ((match = bracketPattern.exec(responseText)) !== null) {
    boxes.push({
      x1: parseInt(match[1], 10),
      y1: parseInt(match[2], 10),
      x2: parseInt(match[3], 10),
      y2: parseInt(match[4], 10),
      label: match[5].trim(),
    });
  }

  if (boxes.length > 0) return boxes;

  // Pattern 3: JSON array format
  try {
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item.box || item.bbox || item.bounding_box) {
            const box = item.box || item.bbox || item.bounding_box;
            boxes.push({
              x1: box[0] ?? box.x1 ?? 0,
              y1: box[1] ?? box.y1 ?? 0,
              x2: box[2] ?? box.x2 ?? 0,
              y2: box[3] ?? box.y2 ?? 0,
              label: item.label || item.name || item.category || "object",
              confidence: item.confidence ?? item.score,
            });
          }
        }
      }
    }
  } catch {
    // JSON parsing failed, that's okay
  }

  return boxes;
}

// ---------------------------------------------------------------------------
// Main API: Locate objects in an image
// ---------------------------------------------------------------------------

/**
 * Call NVIDIA LocateAnything-3B via Hugging Face Inference API.
 *
 * @example
 * ```ts
 * const result = await locateAnything({
 *   imageUrl: "https://example.com/chart.png",
 *   prompt: "Locate all trend lines and support/resistance levels",
 * });
 * console.log(result.boxes); // Array of detected bounding boxes
 * ```
 */
export async function locateAnything(
  options: LocateAnythingOptions
): Promise<LocateAnythingResult> {
  const startTime = Date.now();
  const apiKey = await getHuggingFaceApiKey();

  const {
    imageUrl,
    prompt,
    generationMode = "fast",
    maxTokens = 4096,
  } = options;

  // Build the chat completion request (OpenAI-compatible format)
  const messages = [
    {
      role: "user" as const,
      content: [
        {
          type: "image_url" as const,
          image_url: { url: imageUrl },
        },
        {
          type: "text" as const,
          text: prompt,
        },
      ],
    },
  ];

  const payload = {
    model: MODEL_ID,
    messages,
    max_tokens: maxTokens,
    generation_mode: generationMode,
  };

  // Try primary endpoint (router)
  let response = await fetch(HF_INFERENCE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  // Fallback to direct inference API if router fails
  if (!response.ok && response.status !== 429) {
    console.warn(
      `[LocateAnything] Primary endpoint failed (${response.status}), trying fallback...`
    );
    response = await fetch(HF_INFERENCE_API_URL_FALLBACK, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `[LocateAnything] API request failed: ${response.status} ${response.statusText} – ${errorText}`
    );
  }

  const data = await response.json();
  const processingTimeMs = Date.now() - startTime;

  // Extract the response text from chat completion format
  const rawResponse =
    data.choices?.[0]?.message?.content ??
    data.generated_text ??
    data[0]?.generated_text ??
    JSON.stringify(data);

  // Parse bounding boxes from the response
  const boxes = parseBoundingBoxes(rawResponse);

  return {
    rawResponse,
    boxes,
    model: MODEL_ID,
    processingTimeMs,
  };
}

// ---------------------------------------------------------------------------
// Convenience: Task-specific wrappers
// ---------------------------------------------------------------------------

/**
 * Detect all objects in an image (open-set detection).
 */
export async function detectObjects(
  imageUrl: string,
  customPrompt?: string
): Promise<LocateAnythingResult> {
  return locateAnything({
    imageUrl,
    prompt: customPrompt || PROMPT_TEMPLATES.object_detection,
  });
}

/**
 * Locate a specific object or element described in natural language.
 */
export async function groundObject(
  imageUrl: string,
  query: string
): Promise<LocateAnythingResult> {
  return locateAnything({
    imageUrl,
    prompt: PROMPT_TEMPLATES.grounding.replace("{query}", query),
  });
}

/**
 * Locate UI elements (buttons, inputs, etc.) in screenshots.
 */
export async function groundUIElement(
  imageUrl: string,
  elementDescription: string
): Promise<LocateAnythingResult> {
  return locateAnything({
    imageUrl,
    prompt: PROMPT_TEMPLATES.gui_grounding.replace("{query}", elementDescription),
  });
}

/**
 * Locate and extract text positions from an image (OCR localization).
 */
export async function localizeText(
  imageUrl: string
): Promise<LocateAnythingResult> {
  return locateAnything({
    imageUrl,
    prompt: PROMPT_TEMPLATES.ocr_localization,
  });
}

/**
 * Dense detection: find all instances of all object categories.
 */
export async function denseDetection(
  imageUrl: string
): Promise<LocateAnythingResult> {
  return locateAnything({
    imageUrl,
    prompt: PROMPT_TEMPLATES.dense_detection,
    generationMode: "slow", // Dense detection benefits from autoregressive mode
  });
}

/**
 * Analyze a financial chart image: detect trend lines, patterns, and key levels.
 */
export async function analyzeChartImage(
  imageUrl: string,
  analysisPrompt?: string
): Promise<LocateAnythingResult> {
  const defaultPrompt =
    "Analyze this financial chart. Locate and identify: " +
    "1) Trend lines (support/resistance) " +
    "2) Chart patterns (head and shoulders, triangles, channels) " +
    "3) Key price levels " +
    "4) Volume anomalies " +
    "5) Technical indicators visible. " +
    "Return bounding boxes for each detected element with descriptive labels.";

  return locateAnything({
    imageUrl,
    prompt: analysisPrompt || defaultPrompt,
    generationMode: "hybrid",
    maxTokens: 8192,
  });
}

/**
 * Analyze a document/PDF page: locate tables, figures, and key data.
 */
export async function analyzeDocument(
  imageUrl: string,
  focusArea?: string
): Promise<LocateAnythingResult> {
  const prompt = focusArea
    ? `Analyze this document page. Focus on: ${focusArea}. Locate all relevant data fields, tables, and figures with bounding boxes.`
    : "Analyze this document page. Locate all tables, figures, headers, and key data fields with bounding boxes and labels.";

  return locateAnything({
    imageUrl,
    prompt,
    generationMode: "hybrid",
  });
}
