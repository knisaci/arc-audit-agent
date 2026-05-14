import * as dotenv from "dotenv";
dotenv.config();

import { ethers } from "ethers";

const AUDIT_REGISTRY_ABI = [
  "function submitAudit(bytes32 contractHash, bytes32 reportHash, uint8 score, address caller) external returns (uint256)",
  "function getAuditCount() external view returns (uint256)",
  "event AuditCompleted(uint256 indexed auditId, address indexed caller, bytes32 contractHash, bytes32 reportHash, uint8 score, uint256 timestamp)",
];

export async function postAuditOnChain(params: {
  contractHash: string;
  reportHash: string;
  score: number;
  callerAddress: string;
}): Promise<{ txHash: string; auditId: number }> {
  const provider = new ethers.JsonRpcProvider(process.env.ARC_RPC_URL);

  const wallet = new ethers.Wallet(
    process.env.DEPLOYER_PRIVATE_KEY!,
    provider
  );

  const registry = new ethers.Contract(
    process.env.AUDIT_REGISTRY_ADDRESS!,
    AUDIT_REGISTRY_ABI,
    wallet
  );

  const score = Math.min(255, Math.max(0, Math.round(params.score)));

  const tx = await registry.submitAudit(
    params.contractHash,
    params.reportHash,
    score,
    params.callerAddress
  );

  const receipt = await tx.wait(1);

  // Get auditId from event log
  let auditId = 0;
  for (const log of receipt.logs) {
    try {
      const parsed = registry.interface.parseLog(log);
      if (parsed && parsed.name === "AuditCompleted") {
        auditId = Number(parsed.args.auditId);
        break;
      }
    } catch {}
  }

  return { txHash: receipt.hash, auditId };
}
