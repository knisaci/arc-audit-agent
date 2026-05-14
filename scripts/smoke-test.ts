import { ethers } from "hardhat";

async function main() {
  const registryAddress = process.env.AUDIT_REGISTRY_ADDRESS!;

  const registry = await ethers.getContractAt(
    "AuditRegistry",
    registryAddress
  );

  const count = await registry.getAuditCount();
  const fee = await registry.auditFee();
  const treasury = await registry.treasury();

  console.log("Contract address:", registryAddress);
  console.log("Audit count:", count.toString());
  console.log("Audit fee:", fee.toString(), "(should be 1000000)");
  console.log("Treasury:", treasury);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
