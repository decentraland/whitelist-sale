const BigNumber = web3.BigNumber

const WhitelistSale = artifacts.require('./WhitelistSale.sol')
const MANATokenMock = artifacts.require('./Token.sol')

contract('WhitelistSale', function (accounts) {
  const sender = accounts[1]
  const baseLimitPerDayAmount = new BigNumber(42)

  const THROW_MESSAGE = 'VM Exception while processing transaction: invalid opcode'
  const MANA_PER_TOKEN = 12000
  const INITIAL = 1000

  let token
  let sale

  beforeEach(async function () {
    token = await MANATokenMock.new()
    sale = await WhitelistSale.new(token, MANA_PER_TOKEN, INITIAL)
  })

  it('allows test token to be set for any user', async () => {
    await token.setBalance(sender, 2000)
    const balance = await token.balanceOf(sender)
    assert.equal(balance, 2000)
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
      assert.equal(error.message, THROW_MESSAGE)
    }
  })

  it('should set the ETH limit for a particular day', async function () {
    let dayNum = 1
    let limitPerDay

    for (let day = 1; day < 7; day++) {
      limitPerDay = await sale.limitPerDay.call(day)
      assert.equal(limitPerDay, 0)
    }

    await sale.setEthLimitPerDay(dayNum, baseLimitPerDayAmount)

    limitPerDay = await sale.limitPerDay.call(dayNum)
    assert.equal(limitPerDay.toString(), baseLimitPerDayAmount.toString())
  })

  it('should add a user to the whitelist', async function () {
    for (let day = 1; day < 7; day++) {
      await sale.setEthLimitPerDay(day, baseLimitPerDayAmount.plus(day))
    }

    await sale.addUser(sender)

    for (let day = 1; day < 7; day++) {
      let allowOnDay = await sale.allowOnDay.call(day, sender)
      assert.equal(allowOnDay.toString(), baseLimitPerDayAmount.plus(day))
    }
  })

  it('should set the initial timestamp', async function() {
    const newTimestamp = 42

    let initialTimestamp = await sale.initialTimestamp.call()
    assert.equal(initialTimestamp, 0)

    await sale.setInitialTimestamp(newTimestamp)

    initialTimestamp = await sale.initialTimestamp.call()
    assert.equal(initialTimestamp, newTimestamp)
  })
})
