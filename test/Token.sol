pragma solidity ^0.4.11;

import 'zeppelin-solidity/contracts/token/StandardToken.sol';

contract Token is StandardToken {

  function setBalance(address to, uint256 amount) {
    balances[to] = amount;
  }
}
