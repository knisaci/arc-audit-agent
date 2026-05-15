import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

const IDENTITY_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e";
const REPUTATION_REGISTRY = "0x8004B663056A597Dffe9eCcC1965A193B7388713";
const METADATA_URI = "ipfs://bafkreie34ytrqkupmwkax4xol5t3h2kjtrr5tmzqbzukns2mjpn76r2x4q";

const IDENTITY_ABI = [
  "function register(string metadataURI) external",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  "function ownerOf(uint256 tokenId) external view returns (address)",
  "function tokenURI(uint256 tokenId) external view returns (string)",
];

const REPUTATION_ABI = [
  "function giveFeedback(uint256 agentId, int128 score, uint8 feedbackType, string tag, string metadataURI, string evidenceURI, string comment, bytes32 feedbackHash) external",
];

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Registering with wallet:", deployer.address);
  console.log("Metadata URI:", METADATA_URI);

  const identityRegistry = new ethers.Contract(
    IDENTITY_REGISTRY,
    IDENTITY_ABI,
    deployer
  );

  console.log("\nStep 1: Registering identity...");
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
    console.error("Could not find agent ID");
    process.exit(1);
  }

  console.log("\nAgent ID:", agentId.toString());
  console.log("Owner:", await identityRegistry.ownerOf(agentId));
  console.log("Metadata:", await identityRegistry.tokenURI(agentId));

  console.log("\nStep 2: Recording reputation...");
  const reputationRegistry = new ethers.Contract(
    REPUTATION_REGISTRY,
    REPUTATION_ABI,
    deployer
  );

  const tag = "audit_service_launched";
  const feedbackHash = ethers.keccak256(ethers.toUtf8Bytes(tag));

  const repTx = await reputationRegistry.giveFeedback(
    agentId, 95, 0, tag, METADATA_URI, "", 
    "ArcAuditAgent: 9 audits on Arc testnet",
    feedbackHash
  );
  console.log("Reputation TX:", repTx.hash);
  await repTx.wait(1);

  console.log("\n=== DONE ===");
  console.log("Agent ID:", agentId.toString());
  console.log("Registration TX:", tx.hash);
  console.log("Reputation TX:", repTx.hash);
  console.log("Explorer:", `https://testnet.arcscan.app/tx/${tx.hash}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
