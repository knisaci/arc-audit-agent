import { ethers } from "ethers";

const EIP1967_IMPL_SLOT =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bb";

export async function checkUnverifiedContract(
  address: string,
  explorerBaseUrl: string,
  rpcUrl: string
): Promise<{
  deploymentBlock: number | null;
  deploymentTimestamp: number | null;
  isLikelyProxy: boolean;
}> {
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  let deploymentBlock: number | null = null;
  let deploymentTimestamp: number | null = null;

  try {
    const url = `${explorerBaseUrl}/api?module=contract&action=getcontractcreation&contractaddresses=${address}`;
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      const txHash: string | undefined = data?.result?.[0]?.txHash;
      if (txHash) {
        const tx = await provider.getTransaction(txHash);
        if (tx?.blockNumber != null) {
          deploymentBlock = tx.blockNumber;
          const block = await provider.getBlock(tx.blockNumber);
          if (block) {
            deploymentTimestamp = block.timestamp;
          }
        }
      }
    }
  } catch {
    // leave deploymentBlock and deploymentTimestamp as null
  }

  let isLikelyProxy = false;
  try {
    const slot = await provider.getStorage(address, EIP1967_IMPL_SLOT);
    isLikelyProxy = slot !== "0x" + "0".repeat(64);
  } catch {
    // default to false
  }

  return { deploymentBlock, deploymentTimestamp, isLikelyProxy };
}
