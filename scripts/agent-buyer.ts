import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

const REGISTRY_URL = "https://arc-audit-agent-production.up.railway.app";
const SCORE_THRESHOLD = 70;

const USDC_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
];

const COMMERCE_ABI = [
  "function createJob(address provider, address evaluator, uint256 expiredAt, string description, address hook) external returns (uint256 jobId)",
  "function fund(uint256 jobId, bytes optParams) external",
  "function complete(uint256 jobId, bytes32 reason, bytes optParams) external",
  "function getJob(uint256 jobId) external view returns (tuple(uint256 id, address client, address provider, address evaluator, string description, uint256 budget, uint256 expiredAt, uint8 status, address hook))",
  "event JobCreated(uint256 indexed jobId, address indexed client, address indexed provider, address evaluator, uint256 expiredAt, address hook)",
];

const AGENTIC_COMMERCE = "0x0747EEf0706327138c69792bF28Cd525089e4583";
const USDC = "0x3600000000000000000000000000000000000000";
const JOB_BUDGET = 1_000_000n;

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
  console.log("");

  const usdc = new ethers.Contract(USDC, USDC_ABI, agent);
  const commerce = new ethers.Contract(AGENTIC_COMMERCE, COMMERCE_ABI, agent);

  // Step 1: Create ERC-8183 job
  console.log("Step 1: Creating ERC-8183 job...");
  const block = await ethers.provider.getBlock("latest");
  const expiredAt = block!.timestamp + 3600;

  const createTx = await commerce.createJob(
    process.env.DEPLOYER_ADDRESS!,
    agent.address,
    expiredAt,
    "Autonomous smart contract audit",
    "0x0000000000000000000000000000000000000000"
  );
  const receipt = await createTx.wait(1);

  let jobId: bigint | null = null;
  for (const log of receipt.logs) {
    try {
      const parsed = commerce.interface.parseLog(log);
      if (parsed && parsed.name === "JobCreated") {
        jobId = parsed.args.jobId;
        break;
      }
    } catch {}
  }

  if (!jobId) {
    console.error("Could not find job ID");
    process.exit(1);
  }
  console.log("Job ID:", jobId.toString());

  // Step 2: Approve and fund escrow
  console.log("\nStep 2: Approving USDC and funding escrow...");
  const approveTx = await usdc.approve(AGENTIC_COMMERCE, JOB_BUDGET);
  await approveTx.wait(1);

  const fundTx = await commerce.fund(jobId, "0x");
  await fundTx.wait(1);
  console.log("Escrow funded.");

  // Step 3: Call audit API
  console.log("\nStep 3: Submitting contract for audit...");
  const response = await fetch(`${REGISTRY_URL}/job`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jobId: jobId.toString(),
      contractCode: TEST_CONTRACT,
      contractName: "AgentTest",
    }),
  });

  const result = await response.json() as {
    auditId: number;
    score: number;
    vulnerabilities: Array<{ title: string; severity: string }>;
    erc8183TxHash: string;
    auditRegistryTxHash: string;
    reportHash: string;
  };

  if (!response.ok) {
    console.error("Audit failed:", result);
    process.exit(1);
  }

  // Step 4: Evaluate result
  console.log("\nStep 4: Evaluating audit result...");
  console.log("Score:", result.score, "/ 100");
  console.log("ERC-8183 TX:", result.erc8183TxHash);
  console.log("AuditRegistry TX:", result.auditRegistryTxHash);
  console.log("Findings:");
  result.vulnerabilities.forEach(v => {
    console.log(" -", v.severity, ":", v.title);
  });

  // Step 5: Autonomous decision + complete job
  console.log("\nStep 5: Autonomous decision...");
  if (result.score >= SCORE_THRESHOLD) {
    console.log("✅ PASS — Score", result.score, "/ 100. Completing job and releasing payment...");
    const reasonHash = ethers.keccak256(ethers.toUtf8Bytes("audit-approved"));
    const completeTx = await commerce.complete(jobId, reasonHash, "0x");
    await completeTx.wait(1);
    console.log("Payment released. TX:", completeTx.hash);
  } else {
    console.log("❌ REJECT — Score", result.score, "/ 100. Below threshold of", SCORE_THRESHOLD);
    console.log("Job left in Submitted state. Payment NOT released.");
  }

  console.log("\nVerify ERC-8183 deliverable:");
  console.log(`https://testnet.arcscan.app/tx/${result.erc8183TxHash}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
