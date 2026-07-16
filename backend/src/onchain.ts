import * as dotenv from "dotenv";
dotenv.config();

import { ethers } from "ethers";

// Network is controlled entirely by environment variables — no code changes needed to switch between
// testnet and mainnet. Update these three vars in backend/.env (or Railway) to switch:
//
//   ARC_RPC_URL              RPC endpoint   (testnet: https://rpc.testnet.arc.network
//                                            mainnet: https://rpc.arc.network)
//   AUDIT_REGISTRY_ADDRESS   Deployed contract address on the target network
//   USDC_ADDRESS             USDC token address on the target network

export const networkConfig = {
  rpcUrl: process.env.ARC_RPC_URL!,
  registryAddress: process.env.AUDIT_REGISTRY_ADDRESS!,
  usdcAddress: process.env.USDC_ADDRESS,
  isMainnet: process.env.ARC_RPC_URL === "https://rpc.arc.network",
};

console.log(
  `[onchain] network=${networkConfig.isMainnet ? "arc-mainnet" : "arc-testnet"}`,
  `registry=${networkConfig.registryAddress}`
);

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
  const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);

  const wallet = new ethers.Wallet(
    process.env.DEPLOYER_PRIVATE_KEY!,
    provider
  );

  const registry = new ethers.Contract(
    networkConfig.registryAddress,
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
