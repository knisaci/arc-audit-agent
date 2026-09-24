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
  deployerTxCount?: number;
  deployerFirstTxTimestamp?: number;
  explorerUnavailable: boolean;
}> {
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  let deploymentBlock: number | null = null;
  let deploymentTimestamp: number | null = null;
  let deployerAddress: string | undefined;
  let explorerUnavailable = false;

  try {
    const url = `${explorerBaseUrl}/api?module=contract&action=getcontractcreation&contractaddresses=${address}`;
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      const result0 = data?.result?.[0];
      const txHash: string | undefined = result0?.txHash;
      deployerAddress = result0?.from;
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
    } else {
      explorerUnavailable = true;
    }
  } catch {
    // leave deploymentBlock and deploymentTimestamp as null
    explorerUnavailable = true;
  }

  let isLikelyProxy = false;
  try {
    const slot = await provider.getStorage(address, EIP1967_IMPL_SLOT);
    isLikelyProxy = slot !== "0x" + "0".repeat(64);
  } catch {
    // default to false
  }

  let deployerTxCount: number | undefined;
  let deployerFirstTxTimestamp: number | undefined;

  if (deployerAddress) {
    try {
      const txlistUrl = `${explorerBaseUrl}/api?module=account&action=txlist&address=${deployerAddress}&sort=asc`;
      const txlistResponse = await fetch(txlistUrl);
      if (txlistResponse.ok) {
        const txlistData = await txlistResponse.json();
        const txList: Array<{ timeStamp: string }> = txlistData?.result;
        if (Array.isArray(txList)) {
          deployerTxCount = txList.length;
          if (txList.length > 0) {
            deployerFirstTxTimestamp = Number(txList[0].timeStamp);
          }
        }
      }
    } catch {
      // leave deployerTxCount and deployerFirstTxTimestamp as undefined
    }
  }

  return { deploymentBlock, deploymentTimestamp, isLikelyProxy, deployerTxCount, deployerFirstTxTimestamp, explorerUnavailable };
}
