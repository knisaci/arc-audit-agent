import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying with account:", deployer.address);

  const usdcAddress = process.env.USDC_ADDRESS!;
  const treasuryAddress = process.env.TREASURY_ADDRESS!;
  const auditFee = 1_000_000; // 1 USDC in 6 decimals

  console.log("USDC address:", usdcAddress);
  console.log("Treasury address:", treasuryAddress);
  console.log("Audit fee:", auditFee, "(1 USDC)");

  const AuditRegistry = await ethers.getContractFactory("AuditRegistry");
  const registry = await AuditRegistry.deploy(
    usdcAddress,
    treasuryAddress,
    auditFee
  );

  await registry.waitForDeployment();

  const address = await registry.getAddress();
  console.log("AuditRegistry deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
