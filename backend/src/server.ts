import * as dotenv from "dotenv";
dotenv.config();

import path from "path";
import express from "express";
import { ethers } from "ethers";
import { auditContract } from "./audit";
import { checkRateLimit } from "./ratelimit";
import { insertAudit, getAuditById, getAuditCount } from "./db";
import { postAuditOnChain } from "./onchain";
import { verifyPayment } from "./payment";
import { getJobDetails, setBudgetForJob, submitDeliverable } from "./commerce";
import { fetchVerifiedSource } from "./sourcefetch";
import { checkUnverifiedContract } from "./unverifiedcheck";

const app = express();
app.use(express.static(path.join(__dirname, "../public")));
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 3000;

// Health check
app.get("/health", async (_req, res) => {
  const count = getAuditCount();
  res.json({
    status: "ok",
    network: "arc-testnet",
    contract: process.env.AUDIT_REGISTRY_ADDRESS,
    agenticCommerce: process.env.AGENTIC_COMMERCE_ADDRESS,
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

// Get job details
app.get("/job/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid job id" });
    return;
  }
  const job = await getJobDetails(id);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json(job);
});

// Submit audit via ERC-8183 job
app.post("/job", async (req, res) => {
  const { jobId, contractCode, contractName } = req.body;

  if (!jobId || !contractCode || !contractName) {
    res.status(400).json({
      error: "Missing required fields: jobId, contractCode, contractName",
    });
    return;
  }

  if (isNaN(parseInt(jobId))) {
    res.status(400).json({ error: "Invalid jobId" });
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

  // Verify job exists and is in Funded state
  const job = await getJobDetails(parseInt(jobId));
  if (!job) {
    res.status(404).json({ error: "Job not found on Arc" });
    return;
  }

  if (job.provider.toLowerCase() !== process.env.DEPLOYER_ADDRESS!.toLowerCase()) {
    res.status(400).json({
      error: "This job was not assigned to ArcAuditAgent",
      expectedProvider: process.env.DEPLOYER_ADDRESS,
      actualProvider: job.provider,
    });
    return;
  }

  if (job.status === "Open") {
    // Set budget if not yet set
    console.log(`Job ${jobId} is Open — setting budget...`);
    try {
      const budgetTx = await setBudgetForJob(parseInt(jobId));
      console.log("Budget set:", budgetTx);
    } catch (err) {
      console.error("Budget set failed:", err);
    }
  }

  if (job.status !== "Funded") {
    res.status(400).json({
      error: `Job must be in Funded state to audit. Current status: ${job.status}`,
      message: "Please fund the escrow first by calling fund() on the AgenticCommerce contract.",
      agenticCommerceAddress: process.env.AGENTIC_COMMERCE_ADDRESS,
    });
    return;
  }

  // Rate limit check
  const rateLimit = checkRateLimit(job.client);
  if (!rateLimit.allowed) {
    res.status(429).json({
      error: "Rate limit exceeded",
      retryAfterSeconds: rateLimit.retryAfterSeconds,
    });
    return;
  }

  try {
    // Run Claude audit
    const report = await auditContract(contractCode, contractName);

    // Generate hashes
    const contractHash = ethers.keccak256(ethers.toUtf8Bytes(contractCode));
    const reportJson = JSON.stringify(report);
    const reportHash = ethers.keccak256(ethers.toUtf8Bytes(reportJson));

    // Submit deliverable to ERC-8183
    let commerceTxHash: string | null = null;
    try {
      commerceTxHash = await submitDeliverable(parseInt(jobId), reportHash);
      console.log("Deliverable submitted to ERC-8183:", commerceTxHash);
    } catch (err) {
      console.error("ERC-8183 submit failed:", err);
    }

    // Also post to AuditRegistry
    let auditTxHash: string | null = null;
    let onChainAuditId: number | null = null;
    try {
      const onchain = await postAuditOnChain({
        contractHash,
        reportHash,
        score: report.score,
        callerAddress: job.client,
      });
      auditTxHash = onchain.txHash;
      onChainAuditId = onchain.auditId;
    } catch (err) {
      console.error("AuditRegistry post failed:", err);
    }

    // Save to SQLite
    const auditId = insertAudit({
      callerAddress: job.client,
      contractName,
      contractHash,
      score: report.score,
      reportJson,
      reportHash,
      txHash: auditTxHash,
    });

    res.json({
      auditId: onChainAuditId ?? auditId,
      jobId: parseInt(jobId),
      score: report.score,
      vulnerabilities: report.vulnerabilities,
      gasFindings: report.gasFindings,
      bestPracticeFindings: report.bestPracticeFindings,
      reportHash,
      contractHash,
      auditRegistryTxHash: auditTxHash,
      erc8183TxHash: commerceTxHash,
      message: "Deliverable submitted. Call complete() on AgenticCommerce to release payment.",
      agenticCommerceAddress: process.env.AGENTIC_COMMERCE_ADDRESS,
    });
  } catch (error) {
    console.error("Audit error:", error);
    res.status(500).json({ error: "Audit failed. Please try again." });
  }
});

// Original USDC allowance-based audit (kept for backwards compatibility)
app.post("/audit", async (req, res) => {
  const { contractCode, contractName, callerAddress } = req.body;

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

  const rateLimit = checkRateLimit(callerAddress);
  if (!rateLimit.allowed) {
    res.status(429).json({
      error: "Rate limit exceeded",
      retryAfterSeconds: rateLimit.retryAfterSeconds,
    });
    return;
  }

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
    const report = await auditContract(contractCode, contractName);
    const contractHash = ethers.keccak256(ethers.toUtf8Bytes(contractCode));
    const reportJson = JSON.stringify(report);
    const reportHash = ethers.keccak256(ethers.toUtf8Bytes(reportJson));

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

// Free source-fetch + audit (no payment, no on-chain posting)
app.post("/check", async (req, res) => {
  const { address } = req.body;

  if (!address || !ethers.isAddress(address)) {
    res.status(400).json({ error: "Invalid or missing address" });
    return;
  }

  const explorerBaseUrl =
    process.env.ARC_EXPLORER_URL || "https://testnet.arcscan.app";
  const fetched = await fetchVerifiedSource(address, explorerBaseUrl);

  if (!fetched.verified) {
    const unverifiedRateLimit = checkRateLimit(req.ip ?? "unknown", 30);
    if (!unverifiedRateLimit.allowed) {
      res.status(429).json({
        error: "Rate limit exceeded",
        retryAfterSeconds: unverifiedRateLimit.retryAfterSeconds,
      });
      return;
    }

    const rpcUrl =
      process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network";
    const unverified = await checkUnverifiedContract(
      address,
      explorerBaseUrl,
      rpcUrl
    );
    res.json({
      verified: false,
      message:
        "Contract is not verified. Source-level audit isn't possible — here's what we can tell you instead.",
      deploymentBlock: unverified.deploymentBlock,
      deploymentTimestamp: unverified.deploymentTimestamp,
      isLikelyProxy: unverified.isLikelyProxy,
      warning: unverified.isLikelyProxy
        ? "This contract is upgradeable (proxy pattern). The owner can change its logic after deployment."
        : null,
    });
    return;
  }

  const rateLimit = checkRateLimit(req.ip ?? "unknown", 20);
  if (!rateLimit.allowed) {
    res.status(429).json({
      error: "Rate limit exceeded",
      retryAfterSeconds: rateLimit.retryAfterSeconds,
    });
    return;
  }

  try {
    const report = await auditContract(
      fetched.sourceCode!,
      fetched.contractName ?? address
    );
    res.json({
      verified: true,
      contractName: fetched.contractName,
      score: report.score,
      vulnerabilities: report.vulnerabilities,
      gasFindings: report.gasFindings,
      bestPracticeFindings: report.bestPracticeFindings,
    });
  } catch (error) {
    console.error("Audit error:", error);
    res.status(500).json({ error: "Audit failed. Please try again." });
  }
});

app.listen(PORT, () => {
  console.log(`ArcAuditAgent backend running on port ${PORT}`);
  console.log(`Network: arc-testnet`);
  console.log(`AuditRegistry: ${process.env.AUDIT_REGISTRY_ADDRESS}`);
  console.log(`AgenticCommerce: ${process.env.AGENTIC_COMMERCE_ADDRESS}`);
});
