import { readFileSync } from "node:fs";
import { basename } from "node:path";

function parseArgs(argv) {
  const positional = [];

  for (let index = 0; index < argv.length; index += 1) {
    positional.push(argv[index]);
  }

  return {
    mode: positional[0] ?? "gemini",
    filePath: positional[1],
    model: positional[2]
  };
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`missing ${name}`);
  }

  return value;
}

async function probeGemini({ filePath, model }) {
  const baseUrl = requireEnv("OPENAI_BASE_URL").replace(/\/+$/, "");
  const apiKey = requireEnv("OPENAI_API_KEY");
  const pdfBase64 = Buffer.from(readFileSync(filePath)).toString("base64");
  const response = await fetch(`${baseUrl}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: '请读取这份PDF，并只返回严格JSON：{"document_type":"","page_count_guess":""}。不要markdown。'
            },
            {
              inline_data: {
                mime_type: "application/pdf",
                data: pdfBase64
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json"
      }
    })
  });

  const raw = await response.text();
  console.log(JSON.stringify({
    mode: "gemini",
    model,
    file: basename(filePath),
    status: response.status,
    body: raw.trimStart().slice(0, 2000)
  }, null, 2));
}

async function probeResponses({ filePath, model }) {
  const baseUrl = requireEnv("OPENAI_BASE_URL").replace(/\/+$/, "");
  const apiKey = requireEnv("OPENAI_API_KEY");
  const pdfBase64 = Buffer.from(readFileSync(filePath)).toString("base64");
  const response = await fetch(`${baseUrl}/v1/responses`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: '请读取这份PDF，并只返回严格JSON：{"document_type":"","page_count_guess":""}。不要markdown。'
            },
            {
              type: "input_file",
              filename: basename(filePath),
              file_data: `data:application/pdf;base64,${pdfBase64}`
            }
          ]
        }
      ]
    })
  });

  const raw = await response.text();
  console.log(JSON.stringify({
    mode: "responses",
    model,
    file: basename(filePath),
    status: response.status,
    body: raw.trimStart().slice(0, 2000)
  }, null, 2));
}

async function main() {
  const { mode, filePath, model } = parseArgs(process.argv.slice(2));

  if (!filePath || !model) {
    throw new Error("usage: node scripts/lyapi-pdf-smoke.mjs <gemini|responses> <pdf-path> <model>");
  }

  if (mode === "gemini") {
    await probeGemini({ filePath, model });
    return;
  }

  if (mode === "responses") {
    await probeResponses({ filePath, model });
    return;
  }

  throw new Error(`unknown mode: ${mode}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
