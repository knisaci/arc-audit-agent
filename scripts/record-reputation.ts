import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

const REPUTATION_REGISTRY = "0x8004B663056A597Dffe9eCcC1965A193B7388713";
const VALIDATION_REGISTRY = "0x8004Cb1BF31DAf7788923b405b754f57acEB4272";
const AGENT_ID = 11831;

const REPUTATION_ABI = [
  "function giveFeedback(uint256 agentId, int128 score, uint8 feedbackType, string tag, string metadataURI, string evidenceURI, string comment, bytes32 feedbackHash) external",
];

const VALIDATION_ABI = [
  "function validationRequest(address validator, uint256 agentId, string requestURI, bytes32 requestHash) external",
  "function validationResponse(bytes32 requestHash, uint8 response, string responseURI, bytes32 responseHash, string tag) external",
  "function getValidationStatus(bytes32 requestHash) external view returns (address validatorAddress, uint256 agentId, uint8 response, bytes32 responseHash, string tag, uint256 lastUpdate)",
];

async function main() {
  const [deployer, treasury] = await ethers.getSigners();

  console.log("Owner (deployer):", deployer.address);
  console.log("Validator (treasury):", treasury.address);

  // Step 6: Record reputation using Treasury as validator
  console.log("\nStep 6: Recording reputation...");
  const reputationRegistry = new ethers.Contract(
    REPUTATION_REGISTRY,
    REPUTATION_ABI,
    treasury
  );

  const tag = "audit_service_verified";
  const feedbackHash = ethers.keccak256(ethers.toUtf8Bytes(tag));

  const repTx = await reputationRegistry.giveFeedback(
    AGENT_ID,
    95,
    0,
    tag,
    "ipfs://bafkreie34ytrqkupmwkax4xol5t3h2kjtrr5tmzqbzukns2mjpn76r2x4q",
    "",
    "ArcAuditAgent completed 9 audits on Arc testnet with verified on-chain results",
    feedbackHash
  );
  console.log("Reputation TX:", repTx.hash);
  await repTx.wait(1);
  console.log("Reputation recorded.");

  // Step 7: Request validation (owner requests, treasury validates)
  console.log("\nStep 7: Requesting validation...");
  const validationRegistry = new ethers.Contract(
    VALIDATION_REGISTRY,
    VALIDATION_ABI,
    deployer
  );

  const requestURI = "ipfs://bafkreie34ytrqkupmwkax4xol5t3h2kjtrr5tmzqbzukns2mjpn76r2x4q";
  const requestHash = ethers.keccak256(
    ethers.toUtf8Bytes(`validation_request_agent_${AGENT_ID}`)
  );

  const reqTx = await validationRegistry.validationRequest(
    treasury.address,
    AGENT_ID,
    requestURI,
    requestHash
  );
  console.log("Validation request TX:", reqTx.hash);
  await reqTx.wait(1);
  console.log("Validation requested.");

  // Treasury responds
  console.log("\nTreasury responding to validation...");
  const validationRegistryValidator = new ethers.Contract(
    VALIDATION_REGISTRY,
    VALIDATION_ABI,
    treasury
  );

  const resTx = await validationRegistryValidator.validationResponse(
    requestHash,
    100,
    "",
    "0x" + "0".repeat(64),
    "audit_service_kyc_verified"
  );
  console.log("Validation response TX:", resTx.hash);
  await resTx.wait(1);
  console.log("Validation complete.");

  // Check status
  const status = await validationRegistry.getValidationStatus(requestHash);
  console.log("\n=== DONE ===");
  console.log("Validator:", status[0]);
  console.log("Response:", status[2].toString(), "(100 = passed)");
  console.log("Tag:", status[4]);
  console.log("\nReputation TX:", repTx.hash);
  console.log("Validation TX:", resTx.hash);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
