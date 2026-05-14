import * as dotenv from "dotenv";
dotenv.config();

import express from "express";
import { ethers } from "ethers";
import { auditContract } from "./audit";
import { checkRateLimit } from "./ratelimit";
import { insertAudit, getAuditById, getAuditCount } from "./db";
import { postAuditOnChain } from "./onchain";
import { verifyPayment } from "./payment";

const app = express();
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 3000;

// Health check
app.get("/health", async (_req, res) => {
  const count = getAuditCount();
  res.json({
    status: "ok",
    network: "arc-testnet",
    contract: process.env.AUDIT_REGISTRY_ADDRESS,
    auditCount: count,
  });
});

// Get audit by id
app.get("/audit/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid audit id" });
    return;
  }
  const audit = getAuditById(id);
  if (!audit) {
    res.status(404).json({ error: "Audit not found" });
    return;
  }
  res.json(audit);
});

// Submit audit
app.post("/audit", async (req, res) => {
  const { contractCode, contractName, callerAddress } = req.body;

  // Validate input
  if (!contractCode || !contractName || !callerAddress) {
    res.status(400).json({
      error: "Missing required fields: contractCode, contractName, callerAddress",
    });
    return;
  }

  if (!ethers.isAddress(callerAddress)) {
    res.status(400).json({ error: "Invalid callerAddress" });
    return;
  }

  const lines = contractCode.split("\n").length;
  if (lines > 500) {
    res.status(413).json({
      error: "Contract too large",
      message: `Maximum 500 lines allowed. Your contract has ${lines} lines.`,
    });
    return;
  }

  // Rate limit check
  const rateLimit = checkRateLimit(callerAddress);
  if (!rateLimit.allowed) {
    res.status(429).json({
      error: "Rate limit exceeded",
      retryAfterSeconds: rateLimit.retryAfterSeconds,
    });
    return;
  }

  // Payment verification
  const payment = await verifyPayment(callerAddress);
  if (!payment.verified) {
    res.status(402).json({
      error: "Payment required",
      message: payment.reason,
      registryAddress: process.env.AUDIT_REGISTRY_ADDRESS,
      requiredAmount: "1 USDC",
    });
    return;
  }

  try {
    // Run Claude audit
    const report = await auditContract(contractCode, contractName);

    // Generate hashes
    const contractHash = ethers.keccak256(
      ethers.toUtf8Bytes(contractCode)
    );
    const reportJson = JSON.stringify(report);
    const reportHash = ethers.keccak256(
      ethers.toUtf8Bytes(reportJson)
    );

    // Post on-chain
    let txHash: string | null = null;
    let onChainAuditId: number | null = null;

    try {
      const onchain = await postAuditOnChain({
        contractHash,
        reportHash,
        score: report.score,
        callerAddress,
      });
      txHash = onchain.txHash;
      onChainAuditId = onchain.auditId;
    } catch (err) {
      console.error("On-chain posting failed:", err);
    }

    // Save to SQLite
    const auditId = insertAudit({
      callerAddress,
      contractName,
      contractHash,
      score: report.score,
      reportJson,
      reportHash,
      txHash,
    });

    res.json({
      auditId: onChainAuditId ?? auditId,
      score: report.score,
      vulnerabilities: report.vulnerabilities,
      gasFindings: report.gasFindings,
      bestPracticeFindings: report.bestPracticeFindings,
      reportHash,
      contractHash,
      txHash,
    });
  } catch (error) {
    console.error("Audit error:", error);
    res.status(500).json({ error: "Audit failed. Please try again." });
  }
});

app.listen(PORT, () => {
  console.log(`ArcAuditAgent backend running on port ${PORT}`);
  console.log(`Network: arc-testnet`);
  console.log(`Contract: ${process.env.AUDIT_REGISTRY_ADDRESS}`);
});
