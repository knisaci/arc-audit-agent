#!/bin/bash

URL="https://arc-audit-agent-production.up.railway.app/audit"
CALLER="0x3E5318AAb9Ed1902AB056cce42ACE2C95bb9D659"

echo "Running 10 demo audits against Railway..."

# Audit 1 - Reentrancy
echo "\n--- Audit 1: Reentrancy ---"
curl -s -X POST $URL \
  -H "Content-Type: application/json" \
  -d "{\"contractCode\": \"pragma solidity ^0.8.0;\ncontract Reentrancy {\n    mapping(address => uint256) public balances;\n    function deposit() public payable { balances[msg.sender] += msg.value; }\n    function withdraw() public {\n        uint256 amount = balances[msg.sender];\n        (bool success, ) = msg.sender.call{value: amount}(\"\");\n        require(success);\n        balances[msg.sender] = 0;\n    }\n}\", \"contractName\": \"Reentrancy\", \"callerAddress\": \"$CALLER\"}" | python3 -m json.tool | grep -E '"score"|"txHash"'

sleep 5

# Audit 2 - Integer Overflow
echo "\n--- Audit 2: IntegerOverflow ---"
curl -s -X POST $URL \
  -H "Content-Type: application/json" \
  -d "{\"contractCode\": \"pragma solidity ^0.7.0;\ncontract IntegerOverflow {\n    uint256 public count;\n    function increment(uint256 amount) public {\n        count += amount;\n    }\n    function decrement(uint256 amount) public {\n        count -= amount;\n    }\n}\", \"contractName\": \"IntegerOverflow\", \"callerAddress\": \"$CALLER\"}" | python3 -m json.tool | grep -E '"score"|"txHash"'

sleep 5

# Audit 3 - Unprotected selfdestruct
echo "\n--- Audit 3: Selfdestruct ---"
curl -s -X POST $URL \
  -H "Content-Type: application/json" \
  -d "{\"contractCode\": \"// SPDX-License-Identifier: MIT\npragma solidity ^0.8.0;\ncontract Selfdestruct {\n    address public owner;\n    constructor() { owner = msg.sender; }\n    function destroy() public {\n        selfdestruct(payable(owner));\n    }\n}\", \"contractName\": \"Selfdestruct\", \"callerAddress\": \"$CALLER\"}" | python3 -m json.tool | grep -E '"score"|"txHash"'

sleep 5

# Audit 4 - Tx.origin auth
echo "\n--- Audit 4: TxOrigin ---"
curl -s -X POST $URL \
  -H "Content-Type: application/json" \
  -d "{\"contractCode\": \"// SPDX-License-Identifier: MIT\npragma solidity ^0.8.0;\ncontract TxOrigin {\n    address public owner;\n    constructor() { owner = msg.sender; }\n    function transfer(address payable dest, uint amount) public {\n        require(tx.origin == owner);\n        dest.transfer(amount);\n    }\n}\", \"contractName\": \"TxOrigin\", \"callerAddress\": \"$CALLER\"}" | python3 -m json.tool | grep -E '"score"|"txHash"'

sleep 5

# Audit 5 - Clean ERC20
echo "\n--- Audit 5: SimpleToken ---"
curl -s -X POST $URL \
  -H "Content-Type: application/json" \
  -d "{\"contractCode\": \"// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\ncontract SimpleToken {\n    string public name = 'SimpleToken';\n    string public symbol = 'ST';\n    uint256 public totalSupply;\n    mapping(address => uint256) public balanceOf;\n    event Transfer(address indexed from, address indexed to, uint256 value);\n    constructor(uint256 _supply) {\n        totalSupply = _supply;\n        balanceOf[msg.sender] = _supply;\n    }\n    function transfer(address to, uint256 amount) public returns (bool) {\n        require(balanceOf[msg.sender] >= amount, 'Insufficient balance');\n        balanceOf[msg.sender] -= amount;\n        balanceOf[to] += amount;\n        emit Transfer(msg.sender, to, amount);\n        return true;\n    }\n}\", \"contractName\": \"SimpleToken\", \"callerAddress\": \"$CALLER\"}" | python3 -m json.tool | grep -E '"score"|"txHash"'

sleep 5

echo "\n\nFirst 5 audits complete. Check Railway health:"
curl -s https://arc-audit-agent-production.up.railway.app/health | python3 -m json.tool
