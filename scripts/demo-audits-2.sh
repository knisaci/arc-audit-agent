#!/bin/bash

URL="https://arc-audit-agent-production.up.railway.app/audit"
CALLER="0x3E5318AAb9Ed1902AB056cce42ACE2C95bb9D659"

echo "Running audits 6-10..."

# Audit 6 - Unchecked call
echo "\n--- Audit 6: UncheckedCall ---"
curl -s -X POST $URL \
  -H "Content-Type: application/json" \
  -d "{\"contractCode\": \"// SPDX-License-Identifier: MIT\npragma solidity ^0.8.0;\ncontract UncheckedCall {\n    function sendEth(address payable recipient, uint256 amount) public {\n        recipient.call{value: amount}(\"\");\n    }\n    receive() external payable {}\n}\", \"contractName\": \"UncheckedCall\", \"callerAddress\": \"$CALLER\"}" | python3 -m json.tool | grep -E '"score"|"txHash"'

sleep 8

# Audit 7 - Access control missing
echo "\n--- Audit 7: NoAccessControl ---"
curl -s -X POST $URL \
  -H "Content-Type: application/json" \
  -d "{\"contractCode\": \"// SPDX-License-Identifier: MIT\npragma solidity ^0.8.0;\ncontract NoAccessControl {\n    uint256 public treasuryBalance;\n    function deposit() public payable {\n        treasuryBalance += msg.value;\n    }\n    function withdrawAll(address payable to) public {\n        to.transfer(treasuryBalance);\n        treasuryBalance = 0;\n    }\n}\", \"contractName\": \"NoAccessControl\", \"callerAddress\": \"$CALLER\"}" | python3 -m json.tool | grep -E '"score"|"txHash"'

sleep 8

# Audit 8 - Clean multisig
echo "\n--- Audit 8: SimpleMultisig ---"
curl -s -X POST $URL \
  -H "Content-Type: application/json" \
  -d "{\"contractCode\": \"// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\ncontract SimpleMultisig {\n    address[] public owners;\n    uint256 public required;\n    mapping(bytes32 => mapping(address => bool)) public approved;\n    mapping(bytes32 => uint256) public approvalCount;\n    event Approved(address indexed owner, bytes32 indexed txId);\n    event Executed(bytes32 indexed txId);\n    constructor(address[] memory _owners, uint256 _required) {\n        require(_owners.length >= _required, 'Invalid required');\n        owners = _owners;\n        required = _required;\n    }\n    function approve(bytes32 txId) public {\n        require(!approved[txId][msg.sender], 'Already approved');\n        approved[txId][msg.sender] = true;\n        approvalCount[txId]++;\n        emit Approved(msg.sender, txId);\n    }\n    function isApproved(bytes32 txId) public view returns (bool) {\n        return approvalCount[txId] >= required;\n    }\n}\", \"contractName\": \"SimpleMultisig\", \"callerAddress\": \"$CALLER\"}" | python3 -m json.tool | grep -E '"score"|"txHash"'

sleep 8

# Audit 9 - Timestamp dependence
echo "\n--- Audit 9: TimestampDependence ---"
curl -s -X POST $URL \
  -H "Content-Type: application/json" \
  -d "{\"contractCode\": \"// SPDX-License-Identifier: MIT\npragma solidity ^0.8.0;\ncontract TimestampDependence {\n    uint256 public lastWinner;\n    function play() public payable {\n        require(msg.value == 0.1 ether);\n        if (block.timestamp % 2 == 0) {\n            payable(msg.sender).transfer(address(this).balance);\n            lastWinner = block.timestamp;\n        }\n    }\n    receive() external payable {}\n}\", \"contractName\": \"TimestampDependence\", \"callerAddress\": \"$CALLER\"}" | python3 -m json.tool | grep -E '"score"|"txHash"'

sleep 8

# Audit 10 - Clean staking contract
echo "\n--- Audit 10: SimpleStaking ---"
curl -s -X POST $URL \
  -H "Content-Type: application/json" \
  -d "{\"contractCode\": \"// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\nimport '@openzeppelin/contracts/token/ERC20/IERC20.sol';\ncontract SimpleStaking {\n    IERC20 public stakingToken;\n    mapping(address => uint256) public stakedAmount;\n    mapping(address => uint256) public stakedAt;\n    event Staked(address indexed user, uint256 amount);\n    event Withdrawn(address indexed user, uint256 amount);\n    constructor(address _token) {\n        stakingToken = IERC20(_token);\n    }\n    function stake(uint256 amount) external {\n        require(amount > 0, 'Cannot stake 0');\n        stakingToken.transferFrom(msg.sender, address(this), amount);\n        stakedAmount[msg.sender] += amount;\n        stakedAt[msg.sender] = block.timestamp;\n        emit Staked(msg.sender, amount);\n    }\n    function withdraw() external {\n        uint256 amount = stakedAmount[msg.sender];\n        require(amount > 0, 'Nothing staked');\n        stakedAmount[msg.sender] = 0;\n        stakingToken.transfer(msg.sender, amount);\n        emit Withdrawn(msg.sender, amount);\n    }\n}\", \"contractName\": \"SimpleStaking\", \"callerAddress\": \"$CALLER\"}" | python3 -m json.tool | grep -E '"score"|"txHash"'

sleep 3

echo "\n\nAll 10 audits complete. Final health check:"
curl -s https://arc-audit-agent-production.up.railway.app/health | python3 -m json.tool
