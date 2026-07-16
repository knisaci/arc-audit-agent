import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  const usdcAddress = process.env.MAINNET_USDC_ADDRESS;
  const treasuryAddress =
    process.env.MAINNET_TREASURY_ADDRESS || process.env.TREASURY_ADDRESS;
  const auditFee = 1_000_000; // 1 USDC in 6 decimals
  const explorer =
    process.env.ARC_MAINNET_EXPLORER || "https://arcscan.app";

  if (!usdcAddress) {
    throw new Error(
      "MAINNET_USDC_ADDRESS is not set — confirm the Arc Mainnet USDC address with Circle before deploying"
    );
  }
  if (!treasuryAddress) {
    throw new Error(
      "MAINNET_TREASURY_ADDRESS (or TREASURY_ADDRESS) is not set"
    );
  }

  console.log("Network:          Arc Mainnet (Chain ID 5042)");
  console.log("Deploying with:   ", deployer.address);
  console.log("USDC address:     ", usdcAddress);
  console.log("Treasury address: ", treasuryAddress);
  console.log("Audit fee:        ", auditFee, "(1 USDC)");
  console.log("");

  const AuditRegistry = await ethers.getContractFactory("AuditRegistry");
  const registry = await AuditRegistry.deploy(
    usdcAddress,
    treasuryAddress,
    auditFee
  );

  await registry.waitForDeployment();

  const address = await registry.getAddress();

  console.log("AuditRegistry deployed to:", address);
  console.log("Explorer:         ", `${explorer}/address/${address}`);
  console.log("");
  console.log("Next steps:");
  console.log(`  1. Set MAINNET_AUDIT_REGISTRY_ADDRESS=${address} in .env and backend/.env`);
  console.log(`  2. Update Railway env vars: ARC_RPC_URL=${process.env.ARC_MAINNET_RPC_URL}`);
  console.log(`     and AUDIT_REGISTRY_ADDRESS=${address}`);
  console.log(
    "  3. npx hardhat run scripts/verify-mainnet.ts --network arc_mainnet"
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
