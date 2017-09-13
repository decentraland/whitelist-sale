const BigNumber = web3.BigNumber

const { advanceToTime, ether, should, EVMThrow } = require('./utils')

const WhitelistSale = artifacts.require('./WhitelistSale.sol')
const MANATokenMock = artifacts.require('./Token.sol')

contract('WhitelistSale', function (accounts) {
  const sender = accounts[1]
  const baseLimitPerDayAmount = new BigNumber(42)

  const START = 10000

  const MANA_PER_TOKEN = 12000

  const TARGET_ETH = 2000

  const SOLD_AMOUNT = TARGET_ETH * MANA_PER_TOKEN

  const buyValue = new BigNumber(21)

  let token
  let sale
  let currentTime
  let startTime

  beforeEach(async function () {

    currentTime = (await web3.eth.getBlock('latest')).timestamp
    startTime = currentTime + START
    token = await MANATokenMock.new()
    sale = await WhitelistSale.new(token.address, MANA_PER_TOKEN, startTime)

    for (let day = 0; day < 6; day++) {
      await sale.setEthLimitPerDay(day, baseLimitPerDayAmount.plus(day))
    }
  })

  it('should activate the whitelist', async function () {
    let activated = await sale.activated.call()
    assert.equal(activated, false)

    await sale.activate()

    activated = await sale.activated.call()
    assert.equal(activated, true)
  })

  it('should throw if there is a buy without activation', async function () {
    const value = new BigNumber(42)

    try {
      await sale.buy({ from: sender, value })
    } catch(error) {
      assert.equal(error.message, EVMThrow)
    }
  })

  it('should set the ETH limit for a particular day', async function () {
    const dayNum = 3

    await sale.setEthLimitPerDay(dayNum, baseLimitPerDayAmount)

    const limitPerDay = await sale.limitPerDay.call(dayNum)
    assert.equal(limitPerDay.toString(), baseLimitPerDayAmount.toString())
  })

  it('should add a user to the whitelist', async function () {
    await sale.addUser(sender)

    for (let day = 0; day < 6; day++) {
      let allowOnDay = await sale.allowOnDay.call(day, sender)
      assert.equal(allowOnDay.toString(), baseLimitPerDayAmount.plus(day))
    }
  })

  it('should set the initial timestamp', async function() {
    const newTimestamp = 42

    let initialTimestamp = await sale.initialTimestamp.call()
    assert.equal(initialTimestamp.toString(), startTime)

    await sale.setInitialTimestamp(currentTime + newTimestamp)

    initialTimestamp = await sale.initialTimestamp.call()
    assert.equal(initialTimestamp.toString(), currentTime + newTimestamp)
  })

  /**
   * Users buying
   */
  it('should not allow buys before activation', async () => {
    await sale.buy({ from: sender, value: buyValue })
        .should.be.rejectedWith(EVMThrow)
  })

  it('should allow buys after activation', async () => {
    await sale.addUser(sender)
    await sale.activate()
    await advanceToTime(startTime)
    await token.setBalance(sale.address, SOLD_AMOUNT)

    await sale.buy({ from: sender, value: buyValue })
        .should.not.be.rejectedWith(EVMThrow)
    const balanceMana = await token.balanceOf(sender)
    assert.equal(balanceMana.toString(), buyValue.mul(MANA_PER_TOKEN).toString())
  })
})
