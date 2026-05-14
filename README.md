# ArcAuditAgent

A Claude-powered autonomous smart contract audit agent deployed on Circle's Arc Network. Designed for agent-to-agent commerce — any autonomous agent with a wallet can pay USDC and receive a verified, on-chain audit result.

## What It Does

- Accepts a Solidity smart contract via REST API
- Runs structured security analysis using Claude (Anthropic)
- Posts a cryptographic audit result to the AuditRegistry contract on Arc testnet
- Returns a machine-readable JSON report with score, vulnerabilities, gas findings, and a verified txHash

## Live Endpoints

| Endpoint | URL |
|---|---|
| Health | `GET https://arc-audit-agent-production.up.railway.app/health` |
| Submit Audit | `POST https://arc-audit-agent-production.up.railway.app/audit` |
| Get Audit | `GET https://arc-audit-agent-production.up.railway.app/audit/:id` |

## Agent-to-Agent Usage

ArcAuditAgent is designed to be called by autonomous agents, not just humans. Any agent with an Arc wallet can use this service programmatically:

Send 1 USDC to the AuditRegistry contract on Arc
POST /audit with your contract code and wallet address
Receive a structured JSON report with on-chain txHash
Verify the result on Arc block explorer independently


This is trust, programmatically established and verifiable — no human intermediaries required.

## API Reference

### POST /audit

Request:
```json
{
  "contractCode": "pragma solidity ^0.8.0;\n...",
  "contractName": "MyContract",
  "callerAddress": "0xYourArcWalletAddress"
}
```

Response:
```json
{
  "auditId": 1,
  "score": 60,
  "vulnerabilities": [
    {
      "title": "Reentrancy Vulnerability",
      "severity": "Critical",
      "affectedLines": [8, 9, 10, 11],
      "description": "...",
      "recommendation": "..."
    }
  ],
  "gasFindings": [...],
  "bestPracticeFindings": [...],
  "reportHash": "0x...",
  "contractHash": "0x...",
  "txHash": "0x..."
}
```

### Error Codes

| Code | Meaning |
|---|---|
| 400 | Missing or invalid fields |
| 413 | Contract exceeds 500 lines |
| 429 | Rate limit exceeded (5 per hour per address) |
| 500 | Audit failed |

### GET /health

```json
{
  "status": "ok",
  "network": "arc-testnet",
  "contract": "0xC996c0143c4C88F0B0bC32d328D14c071A603CcB",
  "auditCount": 2
}
```

### GET /audit/:id

Returns a previously completed audit by ID from the off-chain SQLite index.

## On-Chain Registry

Every audit result is posted to the AuditRegistry contract on Arc testnet.

| Parameter | Value |
|---|---|
| Contract | `0xC996c0143c4C88F0B0bC32d328D14c071A603CcB` |
| Network | Arc Testnet (Chain ID 5042002) |
| Explorer | [testnet.arcscan.app](https://testnet.arcscan.app/address/0xC996c0143c4C88F0B0bC32d328D14c071A603CcB) |

### Demo Transactions

| Audit | txHash |
|---|---|
| #1 | [0x4054...028a](https://testnet.arcscan.app/tx/0x405436c12eda94327a5e21bbfd624472df8b25ebd3d7e78247634c15da08028a) |
| #2 | [0x7e75...9141](https://testnet.arcscan.app/tx/0x7e75a6c8df958246b5ed9c7da72fc1eda4872fca1b8210c1f0a4d5b787b89141) |

## Architecture
Agent Caller
|
| POST /audit (contractCode, callerAddress)
v
Railway Backend (Node.js + TypeScript)
|
|--- Claude API (claude-sonnet-4-5)
|       Structured vulnerability analysis
|
|--- Arc Testnet RPC
|       AuditRegistry.submitAudit() → txHash
|
|--- SQLite
Audit log indexed by auditId
|
v
Response: { score, vulnerabilities, txHash, auditId }
|
v
Agent reads AuditRegistry.getAudit(id) on-chain
(independent verification, no backend required)

## Wallet Architecture

| Role | Address |
|---|---|
| Deployer | `0x3E5318AAb9Ed1902AB056cce42ACE2C95bb9D659` |
| Treasury | `0xd888Df928778B23b0CA6E00f478e83D52FD8d8A7` |

## Tech Stack

- **AI:** Claude API (claude-sonnet-4-5) via Anthropic
- **Blockchain:** Arc Testnet (Circle L1, Chain ID 5042002)
- **Smart Contract:** Solidity 0.8.24, OpenZeppelin, Hardhat
- **Backend:** Node.js, TypeScript, Express, ethers.js
- **Database:** SQLite (better-sqlite3)
- **Hosting:** Railway

## Built By

Kiran Nisaci — Sydney, Australia  
Part of the Arc testnet ecosystem | Powered by Anthropic Claude
