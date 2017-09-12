const BigNumber = web3.BigNumber

const WhitelistSale = artifacts.require('./WhitelistSale.sol')

contract('WhitelistSale', function (accounts) {
  const sender = accounts[1]
  const baseLimitPerDayAmount = new BigNumber(42)

  let sale

  beforeEach(async function () {
    sale = await WhitelistSale.new()
  })

  it('should activate the whitelist', async function () {
    let activated = await sale.activated.call()
    assert.equal(activated, false)

    await sale.activate()

    activated = await sale.activated.call()
    assert.equal(activated, true)
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
