pragma solidity ^0.4.11;

import 'zeppelin-solidity/contracts/math/SafeMath.sol';

contract ERC20Constant {
    function balanceOf( address who ) constant returns (uint value);
}
contract ERC20Stateful {
    function transfer( address to, uint value) returns (bool ok);
}
contract ERC20Events {
    event Transfer(address indexed from, address indexed to, uint value);
}
contract ERC20 is ERC20Constant, ERC20Stateful, ERC20Events {}

contract owned {
    address public owner;

    function owned() {
        owner = msg.sender;
    }

    modifier onlyOwner {
        require(msg.sender == owner);
        _;
    }

    function transferOwnership(address newOwner) onlyOwner {
        owner = newOwner;
    }
}

contract WhitelistSale is owned {

    uint256 ONE_DAY = 1 days;

    ERC20 public manaToken;

    // Amount of MANA received per ETH
    uint256 public manaPerEth;

    // Units of accounting for the MANA token
    uint256 public units = 1e18;

    uint256 public initialTimestamp;

    mapping(address => uint256)[6] public allowOnDay;

    mapping(uint8 => uint256) public limitPerDay;

    bool public activated;

    event LogActivated();
    event LogWithdrawal(uint256 _value);
    event LogBought(uint orderInMana);
    event LogUserAdded(address user);
    event LogUpdatedLimitPerDay(uint8 _day, uint256 amount);
    event LogUpdatedInitialTimestamp(uint256 _initialTimestamp);

    function WhitelistSale (
        ERC20 _manaToken,
        uint256 _manaPerEth,
        uint256 _initialTimestamp
    )
        owned()
    {
        manaToken    = _manaToken;
        manaPerEth    = _manaPerEth;
        initialTimestamp = _initialTimestamp;

        activated   = false;
    }

    // Start sale
    function activate() onlyOwner {
        if (! activated) {
            LogActivated();
        }
        activated = true;
    }

    // allow owner to remove trade token
    function withdrawMana(uint256 _value) onlyOwner returns (bool ok) {
        return manaToken.transfer(owner, _value);
        LogWithdrawal(_value);
    }

    // allow owner to remove arbitrary tokens
    // included just in case contract receives wrong token
    function withdrawToken(address _token, uint256 _value) onlyOwner returns (bool ok) {
        return ERC20(_token).transfer(owner,_value);
        LogWithdrawal(_value);
    }

    // allow owner to remove ETH
    function withdraw(uint256 _value) onlyOwner {
        require(this.balance >= _value);
        owner.transfer(_value);
        LogWithdrawal(_value);
    }

    function getDay() public returns (uint256) {
        return SafeMath.sub(block.timestamp, initialTimestamp) / ONE_DAY;
    }

    modifier onlyIfActive {
        require(activated);
        require(getDay() >= 0);
        require(getDay() < 6);
        _;
    }

    modifier onlyIfNotActivated {
        require(!activated);
        _;
    }

    function buy(address beneficiary) payable onlyIfActive {
        require(beneficiary != 0);

        uint orderInMana = msg.value * manaPerEth;
        uint day = getDay();
        uint256 allowedForSender = allowOnDay[day][msg.sender];

        if (msg.value > allowedForSender) revert();

        uint256 balanceInMana = manaToken.balanceOf(address(this));

        if (orderInMana > balanceInMana) revert();

        allowOnDay[day][msg.sender] = SafeMath.sub(allowedForSender, msg.value);
        manaToken.transfer(beneficiary, orderInMana);

        LogBought(orderInMana);
    }

    // Add a user to the whitelist
    function addUser(address user) onlyOwner {
        for (uint8 _day = 0; _day < 6; _day++) {
            allowOnDay[_day][user] = limitPerDay[_day];
        }
        LogUserAdded(user);
    }

    function setEthLimitPerDay(uint8 _day, uint256 amount) onlyOwner onlyIfNotActivated {
        require(_day < 6);
        limitPerDay[_day] = amount;
        LogUpdatedLimitPerDay(_day, amount);
    }

    function setInitialTimestamp(uint256 _time) onlyOwner onlyIfNotActivated {
        require(_time > block.timestamp);
        initialTimestamp = _time;
        LogUpdatedInitialTimestamp(_time);
    }

    function() payable {
        buy(msg.sender);
    }
}
