import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Deployer address:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  const formatted = ethers.formatUnits(balance, 18);
  
  console.log("Balance:", formatted, "USDC");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
