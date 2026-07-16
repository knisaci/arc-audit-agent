import * as dotenv from "dotenv";
dotenv.config();

import { ethers } from "ethers";

const ABI = [
  "function getAuditCount() external view returns (uint256)",
  "function auditFee() external view returns (uint256)",
  "function treasury() external view returns (address)",
  "function owner() external view returns (address)",
];

async function main() {
  const rpcUrl = process.env.ARC_MAINNET_RPC_URL;
  const registryAddress = process.env.MAINNET_AUDIT_REGISTRY_ADDRESS;
  const explorer =
    process.env.ARC_MAINNET_EXPLORER || "https://arcscan.app";

  if (!rpcUrl) throw new Error("ARC_MAINNET_RPC_URL is not set");
  if (!registryAddress)
    throw new Error(
      "MAINNET_AUDIT_REGISTRY_ADDRESS is not set — run deploy-mainnet.ts first"
    );

  console.log("Connecting to Arc Mainnet:", rpcUrl);
  console.log("Contract:         ", registryAddress);
  console.log("");

  const provider = new ethers.JsonRpcProvider(rpcUrl);

  const network = await provider.getNetwork();
  console.log("Chain ID:         ", network.chainId.toString());
  if (network.chainId !== 5042n) {
    throw new Error(
      `Unexpected chain ID ${network.chainId} — expected 5042 (Arc Mainnet)`
    );
  }

  const registry = new ethers.Contract(registryAddress, ABI, provider);

  const [auditCount, auditFee, treasury, owner] = await Promise.all([
    registry.getAuditCount(),
    registry.auditFee(),
    registry.treasury(),
    registry.owner(),
  ]);

  console.log("Contract live on Arc Mainnet");
  console.log("  Audit count:", auditCount.toString());
  console.log(
    "  Audit fee:  ",
    auditFee.toString(),
    `(${Number(auditFee) / 1e6} USDC)`
  );
  console.log("  Treasury:   ", treasury);
  console.log("  Owner:      ", owner);
  console.log("  Explorer:   ", `${explorer}/address/${registryAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
