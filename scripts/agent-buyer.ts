import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

const REGISTRY_URL = "https://arc-audit-agent-production.up.railway.app";
const SCORE_THRESHOLD = 70; // Agent rejects contracts scoring below this

const USDC_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
];

// A vulnerable contract to test with
const TEST_CONTRACT = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
contract AgentTest {
    mapping(address => uint256) public balances;
    function deposit() public payable {
        balances[msg.sender] += msg.value;
    }
    function withdraw() public {
        uint256 amount = balances[msg.sender];
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success);
        balances[msg.sender] = 0;
    }
}`;

async function main() {
  const [agent] = await ethers.getSigners();

  console.log("=================================");
  console.log("ArcAuditAgent — Autonomous Buyer");
  console.log("=================================");
  console.log("Agent wallet:", agent.address);
  console.log("Score threshold:", SCORE_THRESHOLD, "/ 100");
  console.log("Registry:", REGISTRY_URL);
  console.log("");

  // Step 1: Check and set USDC allowance
  console.log("Step 1: Checking USDC allowance...");
  const usdcAddress = process.env.USDC_ADDRESS!;
  const registryAddress = process.env.AUDIT_REGISTRY_ADDRESS!;

  const usdc = await ethers.getContractAt(USDC_ABI, usdcAddress);
  const allowance = await usdc.allowance(agent.address, registryAddress);
  const auditFee = BigInt(1_000_000); // 1 USDC

  if (allowance < auditFee) {
    console.log("Allowance insufficient. Approving 5 USDC...");
    const tx = await usdc.approve(registryAddress, BigInt(5_000_000));
    await tx.wait();
    console.log("Approved. TxHash:", tx.hash);
  } else {
    console.log("Allowance sufficient:", (Number(allowance) / 1_000_000).toFixed(2), "USDC");
  }

  // Step 2: Call the audit API
  console.log("\nStep 2: Submitting contract for audit...");
  const response = await fetch(`${REGISTRY_URL}/audit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contractCode: TEST_CONTRACT,
      contractName: "AgentTest",
      callerAddress: agent.address,
    }),
  });

  const result = await response.json() as {
    auditId: number;
    score: number;
    vulnerabilities: Array<{ title: string; severity: string }>;
    txHash: string;
  };

  if (!response.ok) {
    console.error("Audit failed:", result);
    process.exit(1);
  }

  // Step 3: Read and evaluate the result
  console.log("\nStep 3: Evaluating audit result...");
  console.log("Audit ID:", result.auditId);
  console.log("Score:", result.score, "/ 100");
  console.log("Arc TxHash:", result.txHash);
  console.log("Findings:");
  result.vulnerabilities.forEach(v => {
    console.log(" -", v.severity, ":", v.title);
  });

  // Step 4: Make autonomous pass/fail decision
  console.log("\nStep 4: Autonomous decision...");
  if (result.score >= SCORE_THRESHOLD) {
    console.log("✅ PASS — Contract scored", result.score, "/ 100. Safe to interact.");
  } else {
    console.log("❌ REJECT — Contract scored", result.score, "/ 100. Below threshold of", SCORE_THRESHOLD);
    console.log("Agent will not interact with this contract.");
  }

  console.log("\nVerify on-chain:");
  console.log(`https://testnet.arcscan.app/tx/${result.txHash}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
