const WhitelistSale = artifacts.require("./WhitelistSale.sol");

module.exports = function(deployer) {
  deployer.deploy(WhitelistSale);
};
