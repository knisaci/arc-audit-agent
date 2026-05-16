import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

const AGENTIC_COMMERCE_ADDRESS = "0x0747EEf0706327138c69792bF28Cd525089e4583";
const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";
const JOB_BUDGET = 1_000_000n; // 1 USDC

const COMMERCE_ABI = [
  "function createJob(address provider, address evaluator, uint256 expiredAt, string description, address hook) external returns (uint256 jobId)",
  "function setBudget(uint256 jobId, uint256 amount, bytes optParams) external",
  "function fund(uint256 jobId, bytes optParams) external",
  "function submit(uint256 jobId, bytes32 deliverable, bytes optParams) external",
  "function complete(uint256 jobId, bytes32 reason, bytes optParams) external",
  "function getJob(uint256 jobId) external view returns (tuple(uint256 id, address client, address provider, address evaluator, string description, uint256 budget, uint256 expiredAt, uint8 status, address hook))",
  "event JobCreated(uint256 indexed jobId, address indexed client, address indexed provider, address evaluator, uint256 expiredAt, address hook)",
];

const USDC_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
];

const STATUS_NAMES = ["Open", "Funded", "Submitted", "Completed", "Rejected", "Expired"];

async function main() {
  const [deployer, treasury] = await ethers.getSigners();

  console.log("=================================");
  console.log("ERC-8183 Job Lifecycle Test");
  console.log("=================================");
  console.log("Client (deployer):", deployer.address);
  console.log("Provider (treasury):", treasury.address);

  const commerce = new ethers.Contract(AGENTIC_COMMERCE_ADDRESS, COMMERCE_ABI, deployer);
  const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, deployer);

  // Check balances
  const clientBalance = await usdc.balanceOf(deployer.address);
  const providerBalance = await usdc.balanceOf(treasury.address);
  console.log("\nClient USDC:", (Number(clientBalance) / 1_000_000).toFixed(6));
  console.log("Provider USDC:", (Number(providerBalance) / 1_000_000).toFixed(6));

  // Step 1: Create job
  console.log("\nStep 1: Creating job...");
  const block = await ethers.provider.getBlock("latest");
  const expiredAt = block!.timestamp + 3600;

  const createTx = await commerce.createJob(
    treasury.address,    // provider = treasury wallet
    deployer.address,    // evaluator = client (same for now)
    expiredAt,
    "Smart contract audit by ArcAuditAgent",
    "0x0000000000000000000000000000000000000000"
  );
  const createReceipt = await createTx.wait(1);
  console.log("Job created. TX:", createTx.hash);

  // Extract job ID from event
  let jobId: bigint | null = null;
  for (const log of createReceipt.logs) {
    try {
      const parsed = commerce.interface.parseLog(log);
      if (parsed && parsed.name === "JobCreated") {
        jobId = parsed.args.jobId;
        break;
      }
    } catch {}
  }

  if (jobId === null) {
    console.error("Could not find job ID");
    process.exit(1);
  }
  console.log("Job ID:", jobId.toString());

  // Step 2: Provider sets budget
  console.log("\nStep 2: Setting budget...");
  const commerceAsProvider = new ethers.Contract(AGENTIC_COMMERCE_ADDRESS, COMMERCE_ABI, treasury);
  const setBudgetTx = await commerceAsProvider.setBudget(jobId, JOB_BUDGET, "0x");
  await setBudgetTx.wait(1);
  console.log("Budget set. TX:", setBudgetTx.hash);

  // Step 3: Client approves and funds escrow
  console.log("\nStep 3: Approving USDC...");
  const approveTx = await usdc.approve(AGENTIC_COMMERCE_ADDRESS, JOB_BUDGET);
  await approveTx.wait(1);
  console.log("Approved. TX:", approveTx.hash);

  console.log("\nStep 4: Funding escrow...");
  const fundTx = await commerce.fund(jobId, "0x");
  await fundTx.wait(1);
  console.log("Escrow funded. TX:", fundTx.hash);

  // Check job status
  let job = await commerce.getJob(jobId);
  console.log("Job status:", STATUS_NAMES[Number(job.status)]);

  // Step 5: Provider submits deliverable (audit report hash)
  console.log("\nStep 5: Submitting deliverable...");
  const deliverableHash = ethers.keccak256(
    ethers.toUtf8Bytes("test-audit-report-hash")
  );
  const submitTx = await commerceAsProvider.submit(jobId, deliverableHash, "0x");
  await submitTx.wait(1);
  console.log("Deliverable submitted. TX:", submitTx.hash);

  job = await commerce.getJob(jobId);
  console.log("Job status:", STATUS_NAMES[Number(job.status)]);

  // Step 6: Client completes job
  console.log("\nStep 6: Completing job...");
  const reasonHash = ethers.keccak256(ethers.toUtf8Bytes("audit-approved"));
  const completeTx = await commerce.complete(jobId, reasonHash, "0x");
  await completeTx.wait(1);
  console.log("Job completed. TX:", completeTx.hash);

  // Final state
  job = await commerce.getJob(jobId);
  const finalClientBalance = await usdc.balanceOf(deployer.address);
  const finalProviderBalance = await usdc.balanceOf(treasury.address);

  console.log("\n=================================");
  console.log("Final State");
  console.log("=================================");
  console.log("Job ID:", jobId.toString());
  console.log("Status:", STATUS_NAMES[Number(job.status)]);
  console.log("Budget:", (Number(job.budget) / 1_000_000).toFixed(6), "USDC");
  console.log("Client USDC:", (Number(finalClientBalance) / 1_000_000).toFixed(6));
  console.log("Provider USDC:", (Number(finalProviderBalance) / 1_000_000).toFixed(6));
  console.log("\nExplorer:", `https://testnet.arcscan.app/tx/${completeTx.hash}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
