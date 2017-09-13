pragma solidity ^0.4.11;


// https://github.com/nexusdev/erc20/blob/master/contracts/erc20.sol

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

// contract can sell tokens for ETH

contract WhitelistSale is owned {

    uint ONE_DAY = 1 days;

    ERC20 public manaToken;

    // Amount of MANA received per ETH
    uint256 public manaPerEth;

    // Units of accounting for the MANA token
    uint256 public units = 1e18;

    uint256 public initialTimestamp;

    mapping(address => uint256)[7] public allowOnDay;

    mapping(uint8 => uint256) public limitPerDay;

    bool public activated;

    event Activated();
    event UpdateEvent();

    function TokenTrader (
        ERC20 _manaToken,
        uint256 _manaPerEth,
        uint256 _initialTimestamp
    ) {
        manaToken    = _manaToken;
        manaPerEth    = _manaPerEth;
        initialTimestamp = _initialTimestamp;

        activated   = false;
    }

    // Start sale
    function activate() onlyOwner {
        activated = true;
        Activated();
    }

    // allow owner to remove trade token
    function withdrawMana(uint256 _value) onlyOwner returns (bool ok) {
        return manaToken.transfer(owner, _value);
        UpdateEvent();
    }

    // allow owner to remove arbitrary tokens
    // included just in case contract receives wrong token
    function withdrawToken(address _token, uint256 _value) onlyOwner returns (bool ok) {
        return ERC20(_token).transfer(owner,_value);
        UpdateEvent();
    }

    // allow owner to remove ETH
    function withdraw(uint256 _value) onlyOwner returns (bool ok)
    {
        if (this.balance >= _value) {
            return owner.send(_value);
        }
        UpdateEvent();
    }

    function getDay() public returns (uint256) {
        return (block.timestamp - initialTimestamp) / ONE_DAY;
    }

    modifier onlyIfActive {
        if (!activated) revert();
        if (getDay() < 1) revert();
        _;
    }

    modifier onlyIfNotActivated {
        if (activated) revert();
        _;
    }

    function buy() payable onlyIfActive {
        uint orderInMana = msg.value * manaPerEth;
        uint day = getDay();

        if (msg.value > allowOnDay[day][msg.sender]) revert();

        uint256 balanceInMana = manaToken.balanceOf(address(this));

        if (orderInMana > balanceInMana) revert();

        allowOnDay[day][msg.sender] -= msg.value;
        if (!manaToken.transfer(msg.sender, orderInMana)) revert();

        UpdateEvent();
    }

    // Add a user to the whitelist
    function addUser(address user) onlyOwner {
        for (uint8 _day = 1; _day < 7; _day++) {
            allowOnDay[_day][user] = limitPerDay[_day];
        }
        UpdateEvent();
    }

    function setEthLimitPerDay(uint8 _day, uint256 amount) onlyOwner onlyIfNotActivated {
        limitPerDay[_day] = amount;
        UpdateEvent();
    }

    function setInitialTimestamp(uint256 _initialTimestamp) onlyOwner onlyIfNotActivated {
        initialTimestamp = _initialTimestamp;
        UpdateEvent();
    }

    function getInitialTimestamp() returns (uint256 timestamp) {
        return initialTimestamp;
    }

    function() payable {
        buy();
    }
}
