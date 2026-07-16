import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: "0.8.24",
  networks: {
    arc_testnet: {
      url: process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network",
      chainId: 5042002,
      accounts: [
        process.env.DEPLOYER_PRIVATE_KEY,
        process.env.TREASURY_PRIVATE_KEY,
      ].filter(Boolean) as string[],
    },
    arc_mainnet: {
      url: process.env.ARC_MAINNET_RPC_URL || "https://rpc.arc.network",
      chainId: 5042,
      accounts: [
        process.env.DEPLOYER_PRIVATE_KEY,
        process.env.TREASURY_PRIVATE_KEY,
      ].filter(Boolean) as string[],
    },
  },
};

export default config;
