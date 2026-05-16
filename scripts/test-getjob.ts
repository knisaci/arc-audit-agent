import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const [deployer] = await ethers.getSigners();
  
  const abi = [
    {
      name: "getJob",
      type: "function",
      stateMutability: "view",
      inputs: [{ name: "jobId", type: "uint256" }],
      outputs: [
        {
          type: "tuple",
          components: [
            { name: "id", type: "uint256" },
            { name: "client", type: "address" },
            { name: "provider", type: "address" },
            { name: "evaluator", type: "address" },
            { name: "description", type: "string" },
            { name: "budget", type: "uint256" },
            { name: "expiredAt", type: "uint256" },
            { name: "status", type: "uint8" },
            { name: "hook", type: "address" }
          ]
        }
      ]
    }
  ];

  const commerce = new ethers.Contract(
    "0x0747EEf0706327138c69792bF28Cd525089e4583",
    abi,
    deployer
  );

  const result = await commerce.getJob(19077);
  console.log("Raw result:", result);
  console.log("ID:", result.id?.toString());
  console.log("Client:", result.client);
  console.log("Provider:", result.provider);
  console.log("Status:", result.status?.toString());
}

main().catch(console.error);
