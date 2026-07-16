# Arc Mainnet Deployment Checklist

**Chain ID:** 5042  
**RPC:** https://rpc.arc.network  
**Explorer:** https://arcscan.app

---

## Phase 1 — Pre-flight

- [ ] **Confirm Arc Mainnet USDC address** with Circle's official announcement or docs.  
      Set `MAINNET_USDC_ADDRESS=<address>` in `.env`.

- [ ] **Fund the deployer wallet** (`DEPLOYER_ADDRESS` in `.env`) with enough Arc native token to cover gas.  
      Check balance: `npx hardhat run scripts/check-balance.ts --network arc_mainnet`

- [ ] **Confirm treasury address** is correct for mainnet.  
      Currently set to `MAINNET_TREASURY_ADDRESS=0xd888Df928778B23b0CA6E00f478e83D52FD8d8A7` in `.env`.  
      Update if mainnet uses a different multisig or cold wallet.

- [ ] **Double-check deployer key** — `DEPLOYER_PRIVATE_KEY` in `.env`. Never commit the mainnet key.

---

## Phase 2 — Deploy the contract

```bash
npx hardhat run scripts/deploy-mainnet.ts --network arc_mainnet
```

The script will print the deployed contract address and a direct explorer link.

- [ ] Copy the deployed address and set it in both files:
  - `.env` → `MAINNET_AUDIT_REGISTRY_ADDRESS=<address>`
  - `backend/.env` → `AUDIT_REGISTRY_ADDRESS=<address>`

---

## Phase 3 — Verify contract is live

```bash
npx hardhat run scripts/verify-mainnet.ts
```

Confirms the RPC responds, chain ID is 5042, and `getAuditCount()` / `auditFee()` return sane values.

- [ ] Audit count reads `0` (fresh deployment)
- [ ] Audit fee reads `1000000` (1 USDC)
- [ ] Treasury matches the address from Phase 1

---

## Phase 4 — Update Railway (backend)

In Railway → ArcAuditAgent service → Variables, update:

| Variable | New value |
|---|---|
| `ARC_RPC_URL` | `https://rpc.arc.network` |
| `AUDIT_REGISTRY_ADDRESS` | `<mainnet contract address>` |
| `USDC_ADDRESS` | `<mainnet USDC address>` |

- [ ] Trigger a Railway redeploy after saving vars.
- [ ] Check Railway logs: should print `[onchain] network=arc-mainnet registry=0x...`

---

## Phase 5 — Smoke test

```bash
npx hardhat run scripts/smoke-test.ts --network arc_mainnet
```

Or hit the live backend endpoint:

```bash
curl -X POST https://<railway-url>/audit \
  -H "Content-Type: application/json" \
  -d '{"contractCode": "// SPDX-License-Identifier: MIT\npragma solidity ^0.8.0;\ncontract Foo {}"}'
```

- [ ] Response contains `txHash` pointing to arcscan.app
- [ ] `auditId` increments on the second call
- [ ] No errors in Railway logs

---

## Phase 6 — Update agent metadata

- [ ] Update `agent-metadata.json` — set `network` to `arc-mainnet` and update contract addresses.
- [ ] Re-register agent identity on mainnet (ERC-8004) if the mainnet registry differs from testnet.
- [ ] Record updated reputation on mainnet (ERC-8004) with first audit TX as proof.

---

## Rollback

If anything fails after the Railway redeploy, flip the env vars back:

| Variable | Testnet value |
|---|---|
| `ARC_RPC_URL` | `https://rpc.testnet.arc.network` |
| `AUDIT_REGISTRY_ADDRESS` | `0xC996c0143c4C88F0B0bC32d328D14c071A603CcB` |
| `USDC_ADDRESS` | `0x3600000000000000000000000000000000000000` |

The contract on testnet stays live — rollback is instant via env var update and redeploy.
