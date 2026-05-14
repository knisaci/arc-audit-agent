import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  const usdcAddress = process.env.USDC_ADDRESS!;
  const registryAddress = process.env.AUDIT_REGISTRY_ADDRESS!;
  const amount = 10_000_000; // 10 USDC — enough for multiple audits

  const usdc = await ethers.getContractAt(
    ["function approve(address spender, uint256 amount) external returns (bool)"],
    usdcAddress
  );

  console.log("Approving USDC from:", deployer.address);
  console.log("Spender (registry):", registryAddress);
  console.log("Amount:", amount, "(10 USDC)");

  const tx = await usdc.approve(registryAddress, amount);
  await tx.wait();

  console.log("Approved! TxHash:", tx.hash);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
