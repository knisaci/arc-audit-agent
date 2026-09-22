// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract AuditRegistry is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public usdc;
    address public treasury;
    // NOTE: auditFee is informational only. Fee enforcement happens off-chain
    // in the backend (payment.ts) before submitAudit() is called. This is a
    // deliberate design choice for pricing flexibility — see project docs.
    // submitAudit() does not collect USDC on-chain.
    uint256 public auditFee;

    struct AuditRecord {
        address caller;
        bytes32 contractHash;
        bytes32 reportHash;
        uint8 score;
        uint256 timestamp;
        bool exists;
    }

    uint256 public auditCount;
    mapping(uint256 => AuditRecord) public audits;

    event AuditCompleted(
        uint256 indexed auditId,
        address indexed caller,
        bytes32 contractHash,
        bytes32 reportHash,
        uint8 score,
        uint256 timestamp
    );

    constructor(
        address _usdc,
        address _treasury,
        uint256 _auditFee
    ) Ownable(msg.sender) {
        usdc = IERC20(_usdc);
        treasury = _treasury;
        auditFee = _auditFee;
    }

    function submitAudit(
        bytes32 contractHash,
        bytes32 reportHash,
        uint8 score,
        address caller
    ) external onlyOwner returns (uint256) {
        uint256 auditId = auditCount;

        audits[auditId] = AuditRecord({
            caller: caller,
            contractHash: contractHash,
            reportHash: reportHash,
            score: score,
            timestamp: block.timestamp,
            exists: true
        });

        auditCount++;

        emit AuditCompleted(
            auditId,
            caller,
            contractHash,
            reportHash,
            score,
            block.timestamp
        );

        return auditId;
    }

    function getAudit(uint256 auditId)
        external
        view
        returns (AuditRecord memory)
    {
        require(audits[auditId].exists, "Audit not found");
        return audits[auditId];
    }

    function getAuditCount() external view returns (uint256) {
        return auditCount;
    }

    function withdrawFees() external onlyOwner {
        uint256 balance = usdc.balanceOf(address(this));
        require(balance > 0, "No fees to withdraw");
        usdc.safeTransfer(treasury, balance);
    }
}
