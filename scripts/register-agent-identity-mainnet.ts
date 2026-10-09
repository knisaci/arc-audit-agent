import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

const IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const METADATA_URI = "ipfs://bafkreiglvkfr7btn4tlkdaqh4ljlygg45dqpycbt73scr4xwnu5sqbjw4a";
const EXPECTED_CHAIN_ID = 5042n;
const EXPECTED_SIGNER = "0x1c18E04aba83a28aCC8F38C31FBDaeE9984Cef11";

const IDENTITY_ABI = [
  "function register(string metadataURI) external",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  "function ownerOf(uint256 tokenId) external view returns (address)",
  "function tokenURI(uint256 tokenId) external view returns (string)",
];

async function main() {
  const [deployer] = await ethers.getSigners();
  const provider = deployer.provider!;
  const network = await provider.getNetwork();

  console.log("Chain ID:", network.chainId.toString());
  console.log("Signer:", deployer.address);
  console.log("Registry:", IDENTITY_REGISTRY);
  console.log("Metadata URI:", METADATA_URI);

  if (network.chainId !== EXPECTED_CHAIN_ID) {
    throw new Error(`Wrong chain: expected ${EXPECTED_CHAIN_ID}, got ${network.chainId}`);
  }
  if (deployer.address.toLowerCase() !== EXPECTED_SIGNER.toLowerCase()) {
    throw new Error(`Wrong signer: expected ${EXPECTED_SIGNER}, got ${deployer.address}`);
  }

  const code = await provider.getCode(IDENTITY_REGISTRY);
  if (code === "0x") {
    throw new Error("No contract code at IdentityRegistry address");
  }

  const balance = await provider.getBalance(deployer.address);
  console.log("Signer native balance (USDC, 18 decimals):", ethers.formatUnits(balance, 18));

  const identityRegistry = new ethers.Contract(IDENTITY_REGISTRY, IDENTITY_ABI, deployer);

  const gas = await identityRegistry.register.estimateGas(METADATA_URI);
  console.log("Estimated gas units:", gas.toString());
  const feeData = await provider.getFeeData();
  console.log("Gas price (wei):", (feeData.gasPrice ?? 0n).toString());

  if (process.env.CONFIRM_MAINNET_REGISTER !== "yes") {
    console.log("\nDRY RUN ONLY. Nothing was sent. Set CONFIRM_MAINNET_REGISTER=yes to send the real transaction.");
    return;
  }

  console.log("\nSending REAL mainnet registration transaction...");
  const tx = await identityRegistry.register(METADATA_URI);
  console.log("TX sent:", tx.hash);
  const receipt = await tx.wait(1);
  console.log("Confirmed in block:", receipt.blockNumber);

  let agentId: bigint | null = null;
  for (const log of receipt.logs) {
    try {
      const parsed = identityRegistry.interface.parseLog(log);
      if (parsed && parsed.name === "Transfer") {
        agentId = parsed.args.tokenId;
        break;
      }
    } catch {}
  }
  if (agentId === null) {
    console.error("Could not find agent ID in logs. Registration TX:", tx.hash);
    process.exit(1);
  }

  console.log("\nAgent ID:", agentId.toString());
  console.log("Owner:", await identityRegistry.ownerOf(agentId));
  console.log("Metadata:", await identityRegistry.tokenURI(agentId));
  console.log("\n=== DONE ===");
  console.log("Registration TX:", tx.hash);
  console.log("Explorer:", `https://explorer.arc.io/tx/${tx.hash}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
