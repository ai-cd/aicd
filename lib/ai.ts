import { z } from "zod";

type RepoSignal = {
  files: string[];
  readme?: string;
};

const AnalysisSchema = z.object({
  runtime: z.string(),
  baseImage: z.string(),
  installCmd: z.string(),
  startCmd: z.string(),
  ports: z.array(z.number()),
  needsDatabase: z.boolean(),
  needsIngress: z.boolean(),
  envVars: z.array(z.string())
});

export type AnalysisResult = z.infer<typeof AnalysisSchema>;

const defaultResult: AnalysisResult = {
  runtime: "node",
  baseImage: "node:20-alpine",
  installCmd: "npm install",
  startCmd: "npm run start",
  ports: [3000],
  needsDatabase: false,
  needsIngress: true,
  envVars: []
};

function heuristicAnalyze(signal: RepoSignal): AnalysisResult {
  const fileSet = new Set(signal.files.map((file) => file.toLowerCase()));

  if (fileSet.has("go.mod")) {
    return {
      runtime: "go",
      baseImage: "golang:1.22-alpine",
      installCmd: "go mod download",
      startCmd: "go run ./",
      ports: [8080],
      needsDatabase: fileSet.has("migrations") || fileSet.has("sql"),
      needsIngress: true,
      envVars: []
    };
  }

  if (fileSet.has("requirements.txt") || fileSet.has("pyproject.toml")) {
    return {
      runtime: "python",
      baseImage: "python:3.12-slim",
      installCmd: "pip install -r requirements.txt",
      startCmd: "python app.py",
      ports: [8000],
      needsDatabase: fileSet.has("migrations") || fileSet.has("sql"),
      needsIngress: true,
      envVars: []
    };
  }

  if (fileSet.has("package.json")) {
    return {
      runtime: "node",
      baseImage: "node:20-alpine",
      installCmd: "npm install",
      startCmd: "npm run start",
      ports: [3000],
      needsDatabase: fileSet.has("prisma") || fileSet.has("drizzle"),
      needsIngress: true,
      envVars: []
    };
  }

  return defaultResult;
}

export async function analyzeRepository(signal: RepoSignal) {
  const apiBase = process.env.MODEL_API;
  const apiKey = process.env.MODEL_KEY;
  const model = process.env.MODEL_NAME;

  if (!apiBase || !apiKey || !model) {
    return { result: heuristicAnalyze(signal), raw: null };
  }

  try {
    const response = await fetch(`${apiBase}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You analyze repo files to infer runtime, base image, install/start commands, ports, db and ingress needs. Reply with strict JSON matching schema: {runtime, baseImage, installCmd, startCmd, ports, needsDatabase, needsIngress, envVars}."
          },
          {
            role: "user",
            content: JSON.stringify(signal)
          }
        ]
      })
    });

    if (!response.ok) {
      return { result: heuristicAnalyze(signal), raw: null };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    const parsed = AnalysisSchema.safeParse(JSON.parse(content));

    if (!parsed.success) {
      return { result: heuristicAnalyze(signal), raw: content };
    }

    return { result: parsed.data, raw: content };
  } catch (error) {
    return { result: heuristicAnalyze(signal), raw: null };
  }
}
