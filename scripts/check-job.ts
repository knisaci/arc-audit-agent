import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

const COMMERCE_ABI = [
  "function getJob(uint256 jobId) external view returns (tuple(uint256 id, address client, address provider, address evaluator, string description, uint256 budget, uint256 expiredAt, uint8 status, address hook))",
];

async function main() {
  const [deployer] = await ethers.getSigners();
  const commerce = new ethers.Contract(
    "0x0747EEf0706327138c69792bF28Cd525089e4583",
    COMMERCE_ABI,
    deployer
  );

  const job = await commerce.getJob(19077);
  console.log("Job ID:", job.id.toString());
  console.log("Client:", job.client);
  console.log("Provider:", job.provider);
  console.log("Evaluator:", job.evaluator);
  console.log("Status:", job.status.toString());
  console.log("Budget:", job.budget.toString());
  console.log("Description:", job.description);
}

main().catch(console.error);
