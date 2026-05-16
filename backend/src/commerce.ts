import * as dotenv from "dotenv";
dotenv.config();

import { ethers } from "ethers";

const COMMERCE_ABI = [
  {
    name: "setBudget",
    type: "function",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "optParams", type: "bytes" }
    ],
    outputs: []
  },
  {
    name: "submit",
    type: "function",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "deliverable", type: "bytes32" },
      { name: "optParams", type: "bytes" }
    ],
    outputs: []
  },
  {
    name: "getJob",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "client", type: "address" },
          { name: "provider", type: "address" },
          { name: "evaluator", type: "address" },
          { name: "description", type: "string" },
          { name: "budget", type: "uint256" },
          { name: "expiredAt", type: "uint256" },
          { name: "status", type: "uint8" },
          { name: "hook", type: "address" }
        ]
      }
    ]
  }
];

const STATUS_NAMES = ["Open", "Funded", "Submitted", "Completed", "Rejected", "Expired"];
const JOB_BUDGET = 1_000_000n;

export async function getJobDetails(jobId: number): Promise<{
  id: number;
  client: string;
  provider: string;
  status: string;
  budget: string;
  description: string;
} | null> {
  try {
    const provider = new ethers.JsonRpcProvider(process.env.ARC_RPC_URL);
    const commerce = new ethers.Contract(
      process.env.AGENTIC_COMMERCE_ADDRESS!,
      COMMERCE_ABI,
      provider
    );

    const job = await commerce.getJob(jobId);

    // Access by index since plain ethers JsonRpcProvider returns Result array
    return {
      id: Number(job[0]),
      client: job[1],
      provider: job[2],
      status: STATUS_NAMES[Number(job[7])],
      budget: (Number(job[5]) / 1_000_000).toFixed(6),
      description: job[4],
    };
  } catch (err) {
    console.error("getJob error:", err);
    return null;
  }
}

export async function setBudgetForJob(jobId: number): Promise<string> {
  const provider = new ethers.JsonRpcProvider(process.env.ARC_RPC_URL);
  const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, provider);
  const commerce = new ethers.Contract(
    process.env.AGENTIC_COMMERCE_ADDRESS!,
    COMMERCE_ABI,
    wallet
  );
  const tx = await commerce.setBudget(jobId, JOB_BUDGET, "0x");
  await tx.wait(1);
  return tx.hash;
}

export async function submitDeliverable(
  jobId: number,
  reportHash: string
): Promise<string> {
  const provider = new ethers.JsonRpcProvider(process.env.ARC_RPC_URL);
  const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, provider);
  const commerce = new ethers.Contract(
    process.env.AGENTIC_COMMERCE_ADDRESS!,
    COMMERCE_ABI,
    wallet
  );
  const tx = await commerce.submit(jobId, reportHash, "0x");
  await tx.wait(1);
  return tx.hash;
}
