import * as dotenv from "dotenv";
dotenv.config();

import { ethers } from "ethers";

const USDC_ABI = [
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
];

const AUDIT_FEE = 1_000_000; // 1 USDC in 6 decimals

export async function verifyPayment(
  callerAddress: string
): Promise<{ verified: boolean; reason?: string }> {
  try {
    const provider = new ethers.JsonRpcProvider(process.env.ARC_RPC_URL);
    const usdcContract = new ethers.Contract(
      process.env.USDC_ADDRESS!,
      USDC_ABI,
      provider
    );

    const registryAddress = process.env.AUDIT_REGISTRY_ADDRESS!;

    // Check USDC balance
    const balance = await usdcContract.balanceOf(callerAddress);
    console.log(`Balance check: ${callerAddress} has ${balance.toString()} USDC units`);

    if (balance < BigInt(AUDIT_FEE)) {
      return {
        verified: false,
        reason: `Insufficient USDC balance. You need at least 1 USDC. Current balance: ${(Number(balance) / 1_000_000).toFixed(6)} USDC.`,
      };
    }

    // Check USDC allowance
    const allowance = await usdcContract.allowance(
      callerAddress,
      registryAddress
    );
    console.log(`Allowance check: ${callerAddress} has approved ${allowance.toString()} USDC units for registry`);

    if (allowance < BigInt(AUDIT_FEE)) {
      return {
        verified: false,
        reason: `Insufficient USDC allowance. Please approve at least 1 USDC for the registry contract at ${registryAddress}. Current allowance: ${(Number(allowance) / 1_000_000).toFixed(6)} USDC.`,
      };
    }

    return { verified: true };
  } catch (err) {
    console.error("Payment check error:", err);
    return {
      verified: false,
      reason: "Payment verification failed. Please try again.",
    };
  }
}
