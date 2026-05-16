import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

const AGENTIC_COMMERCE_ADDRESS = "0x0747EEf0706327138c69792bF28Cd525089e4583";
const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";
const JOB_BUDGET = 1_000_000n; // 1 USDC

const COMMERCE_ABI = [
  "function createJob(address provider, address evaluator, uint256 expiredAt, string description, address hook) external returns (uint256 jobId)",
  "function fund(uint256 jobId, bytes optParams) external",
  "function getJob(uint256 jobId) external view returns (tuple(uint256 id, address client, address provider, address evaluator, string description, uint256 budget, uint256 expiredAt, uint8 status, address hook))",
  "event JobCreated(uint256 indexed jobId, address indexed client, address indexed provider, address evaluator, uint256 expiredAt, address hook)",
];

const USDC_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
];

const STATUS_NAMES = ["Open", "Funded", "Submitted", "Completed", "Rejected", "Expired"];

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Creating ERC-8183 job for ArcAuditAgent...");
  console.log("Client:", deployer.address);
  console.log("Provider (ArcAuditAgent):", process.env.DEPLOYER_ADDRESS);

  const commerce = new ethers.Contract(AGENTIC_COMMERCE_ADDRESS, COMMERCE_ABI, deployer);
  const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, deployer);

  const block = await ethers.provider.getBlock("latest");
  const expiredAt = block!.timestamp + 3600;

  // Step 1: Create job
  console.log("\nStep 1: Creating job...");
  const createTx = await commerce.createJob(
    process.env.DEPLOYER_ADDRESS!,
    deployer.address,
    expiredAt,
    "Smart contract audit by ArcAuditAgent",
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

  // Step 2: Approve USDC
  console.log("\nStep 2: Approving USDC...");
  const approveTx = await usdc.approve(AGENTIC_COMMERCE_ADDRESS, JOB_BUDGET);
  await approveTx.wait(1);
  console.log("Approved.");

  // Step 3: Fund escrow
  console.log("\nStep 3: Funding escrow...");
  const fundTx = await commerce.fund(jobId, "0x");
  await fundTx.wait(1);
  console.log("Escrow funded.");

  const job = await commerce.getJob(jobId);
  console.log("Job status:", STATUS_NAMES[Number(job.status)]);

  console.log("\n=================================");
  console.log("Job ready for audit!");
  console.log("Job ID:", jobId.toString());
  console.log("Status:", STATUS_NAMES[Number(job.status)]);
  console.log("\nNow call the API:");
  console.log(`curl -X POST http://localhost:3000/job \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  -d '{"jobId": ${jobId}, "contractCode": "YOUR_CONTRACT", "contractName": "Test"}'`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
