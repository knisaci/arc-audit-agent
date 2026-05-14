import * as dotenv from "dotenv";
dotenv.config();

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface Vulnerability {
  title: string;
  severity: "Critical" | "High" | "Medium" | "Low" | "Info";
  affectedLines: number[];
  description: string;
  recommendation: string;
}

export interface GasFinding {
  title: string;
  description: string;
  recommendation: string;
}

export interface BestPracticeFinding {
  title: string;
  description: string;
}

export interface AuditReport {
  score: number;
  vulnerabilities: Vulnerability[];
  gasFindings: GasFinding[];
  bestPracticeFindings: BestPracticeFinding[];
}

const SYSTEM_PROMPT = `You are an expert smart contract security auditor. 
Analyze the Solidity contract provided and return ONLY a JSON object.
No preamble. No markdown. No explanation outside the JSON.

The JSON must match this exact schema:
{
  "score": number,
  "vulnerabilities": [
    {
      "title": string,
      "severity": "Critical" | "High" | "Medium" | "Low" | "Info",
      "affectedLines": number[],
      "description": string,
      "recommendation": string
    }
  ],
  "gasFindings": [
    {
      "title": string,
      "description": string,
      "recommendation": string
    }
  ],
  "bestPracticeFindings": [
    {
      "title": string,
      "description": string
    }
  ]
}

Scoring rules - start at 100 and deduct:
- Critical finding: -25 points each
- High finding: -15 points each
- Medium finding: -8 points each
- Low finding: -3 points each
- Info finding: -1 point each
- Minimum score is 0`;

export async function auditContract(
  code: string,
  contractName: string
): Promise<AuditReport> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Audit this Solidity contract named "${contractName}":\n\n${code}`,
      },
    ],
  });

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => (block as { type: "text"; text: string }).text)
    .join("");

  const cleaned = text.replace(/```json|```/g, "").trim();

  const report = JSON.parse(cleaned) as AuditReport;
  return report;
}
