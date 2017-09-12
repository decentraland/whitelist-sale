const BigNumber = web3.BigNumber

const WhitelistSale = artifacts.require('./WhitelistSale.sol')

contract('WhitelistSale', function (accounts) {
  const rate = new BigNumber(1000)

  let sale

  beforeEach(async function () {
    sale = await WhitelistSale.deployed()
  })

  it('should activate the whitelist', async function () {
    let activated = await sale.activated.call()
    assert.equal(activated, false)

    await sale.activate()

    activated = await sale.activated.call()
    assert.equal(activated, true)
  })
})
