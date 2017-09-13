const BigNumber = web3.BigNumber

const { advanceToTime, ether, should, EVMThrow } = require('./utils')

const WhitelistSale = artifacts.require('./WhitelistSale.sol')
const MANATokenMock = artifacts.require('./Token.sol')

contract('WhitelistSale', function (accounts) {
  const sender = accounts[1]

  const ONE_DAY = 24 * 60 * 60
  const START_TIME_OFFSET = 10000
  const MANA_PER_TOKEN = 12000
  const TARGET_ETH = 2000 * 1e18
  const SOLD_AMOUNT = TARGET_ETH * MANA_PER_TOKEN

  const baseLimitPerDayAmount = new BigNumber(42)

  const buyValue = new BigNumber(21)

  let token
  let sale
  let currentTime
  let startTime

  beforeEach(async function () {

    currentTime = (await web3.eth.getBlock('latest')).timestamp
    startTime = currentTime + START_TIME_OFFSET
    token = await MANATokenMock.new()
    sale = await WhitelistSale.new(token.address, MANA_PER_TOKEN, startTime)

    for (let day = 0; day < 6; day++) {
      await sale.setEthLimitPerDay(day, baseLimitPerDayAmount.plus(day))
    }
  })

  it('should throw if there is a buy while handbreak is on', async function () {
    await sale.addUser(sender)
    await advanceToTime(startTime)
    await token.setBalance(sale.address, SOLD_AMOUNT)

    await sale.activateHandbreak()

    await sale.sendTransaction({ from: sender, value: 42 * 1e18 })
        .should.be.rejectedWith(EVMThrow)
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
  it('should not allow buys before the time of start', async () => {
    await sale.addUser(sender)
    await token.setBalance(sale.address, SOLD_AMOUNT)

    await sale.sendTransaction({ from: sender, value: buyValue })
        .should.be.rejectedWith(EVMThrow)
  })

  it('should allow buys after the sale starts', async () => {
    await sale.addUser(sender)
    await advanceToTime(startTime)
    await token.setBalance(sale.address, SOLD_AMOUNT)

    await sale.sendTransaction({ from: sender, value: buyValue })
        .should.not.be.rejectedWith(EVMThrow)
    const balanceMana = await token.balanceOf(sender)
    assert.equal(balanceMana.toString(), buyValue.mul(MANA_PER_TOKEN).toString())
  })

  it('limit increases per day', async () => {
    await sale.addUser(sender)
    await advanceToTime(startTime)
    await token.setBalance(sale.address, SOLD_AMOUNT)

    await sale.sendTransaction({ from: sender, value: 42 })
        .should.not.be.rejectedWith(EVMThrow)
    await sale.sendTransaction({ from: sender, value: 43 })
        .should.be.rejectedWith(EVMThrow)

    await advanceToTime(startTime + ONE_DAY)
    await sale.sendTransaction({ from: sender, value: 43 })
        .should.not.be.rejectedWith(EVMThrow)
    await sale.sendTransaction({ from: sender, value: 44 })
        .should.be.rejectedWith(EVMThrow)

    await advanceToTime(startTime + ONE_DAY * 6)
    await sale.sendTransaction({ from: sender, value: 42 })
        .should.be.rejectedWith(EVMThrow)
  })

  it('fails to sell when maximum was reached', async () => {
    await sale.addUser(sender)
    await advanceToTime(startTime)
    await token.setBalance(sale.address, 41 * MANA_PER_TOKEN)

    await sale.sendTransaction({ from: sender, value: 41 })
        .should.not.be.rejectedWith(EVMThrow)
    await sale.sendTransaction({ from: sender, value: 1 })
        .should.be.rejectedWith(EVMThrow)
  })

  it('owner can get ethereum after sale', async () => {
    await sale.addUser(sender)
    await advanceToTime(startTime)
    await token.setBalance(sale.address, 41 * MANA_PER_TOKEN)

    await sale.sendTransaction({ from: sender, value: 41 })

    const balanceBefore = await web3.eth.getBalance(sale.address)
    var tx = await sale.withdraw(41)
    const balanceAfterWithdraw = await web3.eth.getBalance(sale.address)

    assert.equal(balanceBefore.minus(balanceAfterWithdraw).toString(), 41)
  })
})
