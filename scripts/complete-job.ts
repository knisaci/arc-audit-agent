import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

const COMMERCE_ABI = [
  "function complete(uint256 jobId, bytes32 reason, bytes optParams) external",
  "function getJob(uint256 jobId) external view returns (tuple(uint256 id, address client, address provider, address evaluator, string description, uint256 budget, uint256 expiredAt, uint8 status, address hook))",
];

const STATUS_NAMES = ["Open", "Funded", "Submitted", "Completed", "Rejected", "Expired"];

async function main() {
  const [deployer] = await ethers.getSigners();
  const jobId = 19141;

  const commerce = new ethers.Contract(
    "0x0747EEf0706327138c69792bF28Cd525089e4583",
    COMMERCE_ABI,
    deployer
  );

  const reasonHash = ethers.keccak256(ethers.toUtf8Bytes("audit-approved"));
  console.log("Completing job", jobId, "...");

  const tx = await commerce.complete(jobId, reasonHash, "0x");
  await tx.wait(1);
  console.log("TX:", tx.hash);

  const job = await commerce.getJob(jobId);
  console.log("Final status:", STATUS_NAMES[Number(job[7])]);
  console.log("Explorer:", `https://testnet.arcscan.app/tx/${tx.hash}`);
}

main().catch(console.error);
