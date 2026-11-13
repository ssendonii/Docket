import "dotenv/config";
import express from "express";
import multer from "multer";
import mammoth from "mammoth";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import type { GenerateContentParameters, GenerateContentResponse } from "@google/genai";
import type {
  ActionPriority,
  AgendaSection,
  MeetingAgenda,
  SectionPurpose,
} from "./src/types.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === "production";

const PRIMARY_MODEL = "gemini-3.8-flash";
const FALLBACK_MODEL = "gemini-3.1-flash-lite";
const MODEL_TIMEOUT_MS = 18_000;

const app = express();
app.use(express.json({ limit: "15mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured on the server.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new TimeoutError(`${label} timed out after ${Math.round(ms / 1000)}s.`));
    }, ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

function getErrorDetails(err: unknown): { status?: number; text: string } {
  if (!err) return { text: "Unknown error" };
  if (typeof err === "string") return { text: err };

  const record = err as Record<string, unknown>;
  const status =
    typeof record.status === "number"
      ? record.status
      : typeof record.code === "number"
      ? record.code
      : typeof (record.error as Record<string, unknown> | undefined)?.code === "number"
      ? ((record.error as Record<string, unknown>).code as number)
      : undefined;

  const message =
    err instanceof Error
      ? err.message
      : typeof record.message === "string"
      ? record.message
      : JSON.stringify(err);

  return { status, text: message };
}

function shouldFailover(err: unknown): boolean {
  if (err instanceof TimeoutError) return true;
  const { status, text } = getErrorDetails(err);
  const upper = text.toUpperCase();

  if (status === 404 || status === 429 || status === 503 || status === 504) {
    return true;
  }
  if (
    upper.includes("503") ||
    upper.includes("429") ||
    upper.includes("404") ||
    upper.includes("UNAVAILABLE") ||
    upper.includes("RESOURCE_EXHAUSTED") ||
    upper.includes("NOT_FOUND") ||
    upper.includes("TIMED OUT") ||
    upper.includes("TIMEOUT") ||
    upper.includes("OVERLOADED")
  ) {
    return true;
  }
  return false;
}

function formatUpstreamError(err: unknown): { status: number; message: string } {
  if (err instanceof TimeoutError) {
    return {
      status: 504,
      message: "The document analysis timed out before completing. Please try a shorter document or retry.",
    };
  }

  const { status, text } = getErrorDetails(err);
  const upper = text.toUpperCase();

  if (text.includes("GEMINI_API_KEY is not configured")) {
    return {
      status: 500,
      message: "Server AI key is not configured. Check your Settings > Secrets panel.",
    };
  }
  if (status === 403 || upper.includes("PERMISSION_DENIED") || upper.includes("API_KEY_INVALID")) {
    return {
      status: 403,
      message: "The configured Gemini API key was rejected or lacks permission. Please verify it in Settings > Secrets.",
    };
  }
  if (status === 429 || upper.includes("RESOURCE_EXHAUSTED") || upper.includes("RATE")) {
    return {
      status: 429,
      message: "AI request quota is temporarily exhausted. Please wait a moment and try again.",
    };
  }
  if (status === 503 || upper.includes("UNAVAILABLE") || upper.includes("OVERLOADED")) {
    return {
      status: 503,
      message: "The AI service is temporarily experiencing high demand. Please retry shortly.",
    };
  }
  if (status === 404 || upper.includes("NOT_FOUND")) {
    return {
      status: 502,
      message: "The requested AI model could not be reached. Please try again in a moment.",
    };
  }
  if (status === 400 || upper.includes("INVALID_ARGUMENT")) {
    return {
      status: 400,
      message: "The uploaded document could not be processed. Try a smaller file or plain-text input.",
    };
  }

  return {
    status: status && status >= 400 && status < 600 ? status : 502,
    message: "Failed to generate the meeting agenda due to an upstream processing error. Please retry.",
  };
}

function stripMarkdownJsonFences(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json|JSON)?\s*\r?\n?/, "");
    cleaned = cleaned.replace(/\r?\n?```\s*$/, "");
  }
  return cleaned.trim();
}

async function generateWithRetryAndFallback(
  ai: GoogleGenAI,
  params: Omit<GenerateContentParameters, "model">
): Promise<GenerateContentResponse> {
  const models = [PRIMARY_MODEL, FALLBACK_MODEL];
  let lastError: unknown;

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          ...params,
          model,
        }),
        MODEL_TIMEOUT_MS,
        `Model ${model}`
      );
      return response;
    } catch (err: unknown) {
      lastError = err;
      const canFailover = i < models.length - 1 && shouldFailover(err);
      const { status, text } = getErrorDetails(err);
      console.warn(
        `[Docket AI] Model ${model} failed${status ? ` (${status})` : ""}: ${text.slice(0, 200)}${
          canFailover ? ` -> failing over to ${models[i + 1]}` : ""
        }`
      );
      if (!canFailover) {
        throw err;
      }
    }
  }

  throw lastError;
}

function isLikelyBinaryText(text: string): boolean {
  if (!text) return false;
  const sample = text.slice(0, 4000);
  let nonPrintable = 0;
  for (let i = 0; i < sample.length; i++) {
    const code = sample.charCodeAt(i);
    if (code === 0 || (code < 32 && code !== 9 && code !== 10 && code !== 13)) {
      nonPrintable++;
    }
  }
  return nonPrintable / sample.length > 0.05;
}

function normalizeDurations(sections: AgendaSection[], targetTotal: number): AgendaSection[] {
  if (sections.length === 0) return sections;
  const safeTarget = Math.max(sections.length, Math.round(targetTotal));
  const rawTotal = sections.reduce((sum, s) => sum + Math.max(1, Math.round(s.durationMinutes || 1)), 0);

  if (rawTotal === safeTarget) {
    return sections.map((s) => ({ ...s, durationMinutes: Math.max(1, Math.round(s.durationMinutes)) }));
  }

  const exact = sections.map((s) => (Math.max(1, s.durationMinutes || 1) / rawTotal) * safeTarget);
  const floored = exact.map((val) => Math.max(1, Math.floor(val)));
  let remainder = safeTarget - floored.reduce((a, b) => a + b, 0);

  if (remainder > 0) {
    const indices = exact
      .map((val, idx) => ({ idx, frac: val - Math.floor(val) }))
      .sort((a, b) => b.frac - a.frac);
    for (let i = 0; i < indices.length && remainder > 0; i++) {
      floored[indices[i].idx] += 1;
      remainder--;
    }
  } else if (remainder < 0) {
    const indices = floored
      .map((val, idx) => ({ idx, val }))
      .sort((a, b) => b.val - a.val);
    let safety = 0;
    while (remainder < 0 && safety < 500) {
      let reduced = false;
      for (const item of indices) {
        if (floored[item.idx] > 1 && remainder < 0) {
          floored[item.idx] -= 1;
          remainder++;
          reduced = true;
        }
      }
      if (!reduced) break;
      safety++;
    }
  }

  return sections.map((s, idx) => ({
    ...s,
    durationMinutes: floored[idx],
  }));
}

function sanitizePurpose(val: unknown): SectionPurpose {
  const valid: SectionPurpose[] = ["Align", "Decide", "Review", "Brainstorm", "Update"];
  if (typeof val === "string" && valid.includes(val as SectionPurpose)) {
    return val as SectionPurpose;
  }
  return "Review";
}

function sanitizePriority(val: unknown): ActionPriority {
  const valid: ActionPriority[] = ["High", "Medium", "Low"];
  if (typeof val === "string" && valid.includes(val as ActionPriority)) {
    return val as ActionPriority;
  }
  return "Medium";
}

function makeId(prefix: string, index: number): string {
  return `${prefix}_${Date.now().toString(36)}_${index}_${Math.random().toString(36).slice(2, 6)}`;
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/agenda/generate", upload.single("file"), async (req, res) => {
  try {
    const rawTextInput = typeof req.body?.rawText === "string" ? req.body.rawText.trim() : "";
    const meetingGoal = typeof req.body?.meetingGoal === "string" ? req.body.meetingGoal.trim() : "";
    const startTime = typeof req.body?.startTime === "string" && req.body.startTime.trim()
      ? req.body.startTime.trim()
      : "09:00";
    const parsedMinutes = Number(req.body?.totalMinutes);
    const totalMinutes = Number.isFinite(parsedMinutes)
      ? Math.min(480, Math.max(5, Math.round(parsedMinutes)))
      : 45;

    const uploadedFile = req.file;
    let fileName = typeof req.body?.fileName === "string" && req.body.fileName.trim()
      ? req.body.fileName.trim()
      : "Pasted Notes.txt";
    let fileTypeLabel = "Text";
    let extractedText = rawTextInput;
    let pdfPart: { inlineData: { mimeType: string; data: string } } | null = null;
    let sourceCharCount = rawTextInput.length;

    if (uploadedFile) {
      fileName = uploadedFile.originalname || "Uploaded Document";
      const ext = path.extname(fileName).toLowerCase();
      const mime = (uploadedFile.mimetype || "").toLowerCase();

      if (ext === ".doc") {
        res.status(400).json({
          error: "Legacy binary .doc files are not supported. Please save as .docx, .pdf, or plain text.",
        });
        return;
      }

      if (ext === ".docx" || mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        fileTypeLabel = "DOCX";
        const result = await mammoth.extractRawText({ buffer: uploadedFile.buffer });
        extractedText = (result.value || "").trim();
        sourceCharCount = extractedText.length;
        if (!extractedText) {
          res.status(400).json({
            error: "No readable text could be extracted from this .docx file.",
          });
          return;
        }
      } else if (ext === ".pdf" || mime === "application/pdf") {
        fileTypeLabel = "PDF";
        pdfPart = {
          inlineData: {
            mimeType: "application/pdf",
            data: uploadedFile.buffer.toString("base64"),
          },
        };
        sourceCharCount = uploadedFile.size;
      } else {
        const text = uploadedFile.buffer.toString("utf-8").trim();
        if (!text) {
          res.status(400).json({ error: "The uploaded file appears to be empty." });
          return;
        }
        if (isLikelyBinaryText(text)) {
          res.status(400).json({
            error: `Unsupported binary file (${ext || mime || "unknown"}). Upload .docx, .pdf, .md, .txt, .csv, or other plain-text files.`,
          });
          return;
        }
        fileTypeLabel = ext ? ext.replace(".", "").toUpperCase() : "TEXT";
        extractedText = text;
        sourceCharCount = text.length;
      }
    }

    if (!pdfPart && !extractedText) {
      res.status(400).json({
        error: "Please upload a document (.docx, .pdf, .md, .txt) or paste document text to generate an agenda.",
      });
      return;
    }

    const ai = getGeminiClient();

    const systemInstruction = [
      "You are an expert executive meeting facilitator and program manager.",
      "Analyze the provided document thoroughly and design an actionable, time-boxed meeting agenda.",
      `The total meeting duration MUST equal exactly ${totalMinutes} minutes across all agenda sections.`,
      "Allocate realistic minutes to each topic based on complexity, decision weight, and risk—never split blindly.",
      "Always include a crisp opening framing/context block if appropriate and a brief closing wrap-up/next-steps confirmation when total time is >= 20 minutes.",
      "For each section, write a substantive topic summary grounded strictly in the source document, concrete discussion points, the lead stakeholder, participating stakeholders, and specific action items with clear owners and priority.",
      "Identify all distinct people, roles, or teams mentioned or implied in the document in the top-level stakeholders roster.",
      "Do not invent unrelated facts; when a specific person's name is absent from the document, assign clear functional role titles (e.g., Engineering Lead, Legal Counsel, Product Owner).",
    ].join(" ");

    const userPrompt = [
      `Target Total Meeting Time: ${totalMinutes} minutes.`,
      meetingGoal ? `Facilitator Focus / Goal: ${meetingGoal}` : "",
      `Source Document Name: ${fileName}`,
      extractedText
        ? `\n--- SOURCE DOCUMENT CONTENT ---\n${extractedText.slice(0, 120000)}\n--- END SOURCE DOCUMENT ---`
        : "\nAnalyze the attached PDF document and craft the complete meeting agenda.",
    ]
      .filter(Boolean)
      .join("\n");

    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
    if (pdfPart) {
      parts.push(pdfPart);
    }
    parts.push({ text: userPrompt });

    const response = await generateWithRetryAndFallback(ai, {
      contents: { parts },
      config: {
        systemInstruction,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            meetingTitle: {
              type: Type.STRING,
              description: "Clear, executive meeting title derived from the document.",
            },
            meetingObjective: {
              type: Type.STRING,
              description: "1-2 sentence statement of what the meeting must achieve.",
            },
            documentSummary: {
              type: Type.STRING,
              description: "Concise 2-3 sentence synthesis of the uploaded document.",
            },
            stakeholders: {
              type: Type.ARRAY,
              description: "All key stakeholders, roles, or teams relevant to the meeting.",
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "Person name or functional role." },
                  role: { type: Type.STRING, description: "Title, department, or team." },
                  responsibility: { type: Type.STRING, description: "Primary focus or decision authority in this meeting." },
                },
                required: ["name", "role", "responsibility"],
              },
            },
            sections: {
              type: Type.ARRAY,
              description: "Ordered agenda sections whose durations sum exactly to the target total minutes.",
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: "Concise topic title." },
                  durationMinutes: { type: Type.INTEGER, description: "Allocated duration in whole minutes." },
                  purpose: {
                    type: Type.STRING,
                    description: "One of: Align, Decide, Review, Brainstorm, Update",
                  },
                  summary: {
                    type: Type.STRING,
                    description: "2-4 sentence summary of the topic context from the document.",
                  },
                  keyPoints: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "2-4 specific discussion points or questions to resolve.",
                  },
                  leadStakeholder: {
                    type: Type.STRING,
                    description: "Stakeholder leading or presenting this topic.",
                  },
                  participants: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Other stakeholders needed for this topic.",
                  },
                  actionItems: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        task: { type: Type.STRING, description: "Specific, concrete action item." },
                        owner: { type: Type.STRING, description: "Responsible person or role." },
                        priority: { type: Type.STRING, description: "One of: High, Medium, Low" },
                        dueContext: { type: Type.STRING, description: "Timing or milestone (e.g., Before launch, Within 48h)." },
                      },
                      required: ["task", "owner", "priority", "dueContext"],
                    },
                  },
                },
                required: [
                  "title",
                  "durationMinutes",
                  "purpose",
                  "summary",
                  "keyPoints",
                  "leadStakeholder",
                  "participants",
                  "actionItems",
                ],
              },
            },
          },
          required: [
            "meetingTitle",
            "meetingObjective",
            "documentSummary",
            "stakeholders",
            "sections",
          ],
        },
      },
    });

    const rawJson = stripMarkdownJsonFences(response.text ?? "{}");
    let parsed: {
      meetingTitle?: string;
      meetingObjective?: string;
      documentSummary?: string;
      stakeholders?: Array<{ name?: string; role?: string; responsibility?: string }>;
      sections?: Array<{
        title?: string;
        durationMinutes?: number;
        purpose?: string;
        summary?: string;
        keyPoints?: string[];
        leadStakeholder?: string;
        participants?: string[];
        actionItems?: Array<{
          task?: string;
          owner?: string;
          priority?: string;
          dueContext?: string;
        }>;
      }>;
    };

    try {
      parsed = JSON.parse(rawJson);
    } catch {
      res.status(502).json({
        error: "The AI response could not be parsed as structured agenda data. Please try again.",
      });
      return;
    }

    const rawSections: AgendaSection[] = (parsed.sections || []).map((sec, idx) => ({
      id: makeId("sec", idx),
      title: (sec.title || `Topic ${idx + 1}`).trim(),
      durationMinutes: Math.max(1, Math.round(Number(sec.durationMinutes) || 5)),
      purpose: sanitizePurpose(sec.purpose),
      summary: (sec.summary || "").trim(),
      keyPoints: Array.isArray(sec.keyPoints)
        ? sec.keyPoints.map((p) => String(p).trim()).filter(Boolean)
        : [],
      leadStakeholder: (sec.leadStakeholder || "Facilitator").trim(),
      participants: Array.isArray(sec.participants)
        ? sec.participants.map((p) => String(p).trim()).filter(Boolean)
        : [],
      actionItems: Array.isArray(sec.actionItems)
        ? sec.actionItems
            .map((item, aIdx) => ({
              id: makeId(`act_${idx}`, aIdx),
              task: (item.task || "").trim(),
              owner: (item.owner || "Unassigned").trim(),
              priority: sanitizePriority(item.priority),
              dueContext: (item.dueContext || "TBD").trim(),
              completed: false,
            }))
            .filter((a) => a.task.length > 0)
        : [],
    }));

    const normalizedSections = normalizeDurations(rawSections, totalMinutes);

    const agenda: MeetingAgenda = {
      id: makeId("agenda", 0),
      createdAt: new Date().toISOString(),
      sourceFileName: fileName,
      sourceFileType: fileTypeLabel,
      sourceCharCount,
      targetDurationMinutes: totalMinutes,
      startTime,
      meetingTitle: (parsed.meetingTitle || fileName.replace(/\.[^.]+$/, "")).trim(),
      meetingObjective: (parsed.meetingObjective || "").trim(),
      documentSummary: (parsed.documentSummary || "").trim(),
      stakeholders: (parsed.stakeholders || []).map((st, idx) => ({
        id: makeId("stk", idx),
        name: (st.name || "Stakeholder").trim(),
        role: (st.role || "Contributor").trim(),
        responsibility: (st.responsibility || "").trim(),
      })),
      sections: normalizedSections,
    };

    res.json({ agenda });
  } catch (err: unknown) {
    console.error("Agenda generation failed:", err);
    const formatted = formatUpstreamError(err);
    res.status(formatted.status).json({ error: formatted.message });
  }
});

// Handle multer file size or upload errors cleanly
app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({ error: "File exceeds the 20 MB upload limit." });
      return;
    }
    res.status(400).json({ error: err.message });
    return;
  }
  next(err);
});

async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, "dist");
    app.use(express.static(distDir));
    app.get("/{*path}", (_req, res) => {
      const indexFile = path.join(distDir, "index.html");
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send("Build output not found. Run npm run build first.");
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Docket server listening on http://localhost:${PORT}`);
  });
}

startServer();
