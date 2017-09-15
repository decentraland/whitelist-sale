const BigNumber = web3.BigNumber

const { advanceToTime, ether, should, EVMThrow } = require('./utils')

const WhitelistSale = artifacts.require('./WhitelistSale.sol')
const MANATokenMock = artifacts.require('./Token.sol')

contract('WhitelistSale', function (accounts) {
  const sender = accounts[1]
  const receiver = accounts[2]

  const ONE_DAY = 24 * 60 * 60
  const START_TIME_OFFSET = 10000
  const MANA_PER_TOKEN = 11954
  const TARGET_ETH = 2000 * 1e18
  const SOLD_AMOUNT = TARGET_ETH * MANA_PER_TOKEN

  const ethValue = [
    new BigNumber(3.3 * 1e18),
    new BigNumber(10 * 1e18),
    new BigNumber(30 * 1e18),
    new BigNumber(90 * 1e18),
    new BigNumber(450 * 1e18),
    new BigNumber(1500 * 1e18),
  ]

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
    sale = await WhitelistSale.new(token.address, startTime, receiver)
  })

  it('should add a user to the whitelist', async function () {
    await sale.addUser(sender)
    assert.equal(await sale.whitelisted.call(sender), true)
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

  it('a random user can\'t buy', async () => {
    await advanceToTime(startTime)
    await token.setBalance(sale.address, SOLD_AMOUNT)

    await sale.sendTransaction({ from: accounts[2], value: buyValue })
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

    await sale.sendTransaction({ from: sender, value: 3.3 * 1e18 })
        .should.not.be.rejectedWith(EVMThrow)
    await sale.sendTransaction({ from: sender, value: 1 })
        .should.be.rejectedWith(EVMThrow)

    await advanceToTime(startTime + ONE_DAY)
    await sale.sendTransaction({ from: sender, value: 10 * 1e18 })
        .should.not.be.rejectedWith(EVMThrow)
    await sale.sendTransaction({ from: sender, value: 1 })
        .should.be.rejectedWith(EVMThrow)

    await advanceToTime(startTime + ONE_DAY * 6)
    await sale.sendTransaction({ from: sender, value: 1 })
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

  it('receiver gets ethereum after sale', async () => {
    await sale.addUser(sender)
    await advanceToTime(startTime)
    await token.setBalance(sale.address, 41 * MANA_PER_TOKEN)

    const balanceBefore = await web3.eth.getBalance(receiver)
    await sale.sendTransaction({ from: sender, value: 41 })
    const balanceAfterWithdraw = await web3.eth.getBalance(receiver)

    assert.equal(balanceAfterWithdraw.minus(balanceBefore).toString(), 41)
  })
})
