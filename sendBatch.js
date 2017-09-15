require('babel-register')
require('babel-polyfill')

const abi = require('ethereumjs-abi')
const db = require(__dirname + '/db.js')
const WhitelistSale = artifacts.require(__dirname + '/WhitelistSale.sol')


/*
  db.users:
    _id        : String(hashed email)
    address    : String(ETH address)
    whitelisted: Boolean(already on the contract?) or undefined
    addrBatch  : Array[address batch] or undefined
    txId       : ObjectId(transactionId) or undefined
    timestamp  : Date(time of whitelisting) or undefined
    alreadySent: Boolean(only in weird cases when the address was already in the contract but whitelisted was false) or undefined
*/

/*
  db.transactions:
    _id : ObjectId
    data: JSON(arbitrary transaction data)
    timestamp: Date(time of whitelisting)
*/


const BATCH_SIZE = getEnv(process.env.BATCH_SIZE, 100)
const FROM_ADDRESS = getEnv(process.env.FROM_ADDRESS, '0x11d072f4fa63b4fe002731db50c1f17c931dd670')
const CONTRACT_ADDRESS = getEnv(process.env.SALE_ADDRESS, '0x3c337FA1bf8725f59F73dB6Db719C792c5e8ae74')
const TOKEN_ADDRESS = getEnv(process.env.TOKEN_ADDRESS, '0x0f5d2fb29fb7d3cfee444a200298f468908cc942')

const fs = require('fs')
let instance = null // set on run


async function run() {
  await db.connect('whitelist')

  console.log('Setting contract instance')
  instance = await WhitelistSale.at(CONTRACT_ADDRESS)

  const data = fs.readFileSync('dump').toString()
  var re = /(0x[0-9a-f]+)[^0-9a-f]/gi

  const addressesRaw = []

  do {
    m = re.exec(data)
    if (m) {
      addressesRaw.push(m[1])
    }
  } while(m);

  console.log(`Found ${addressesRaw.length} addresses in dump`)

  const addresses = []
  for (var i of addressesRaw) {
    if (!(await instance.whitelisted.call(i))) {
      console.log('new address not whitelisted')
      addresses.push(i)
    }
  }

  console.log(`Found ${addresses.length} new addresses. Sending...`)
  const result = await sendManyUsers(addresses)
  console.log(result)
  return
}

async function sendManyUsers(addresses) {
  // This should be working but we're met with
  //      `Error: Invalid number of arguments to Solidity function`
  // We're using the `addUser` approach below for testing purposes
  //
  const params = abi.simpleEncode('addManyUsers(address[])', addresses)
  return await web3.eth.sendTransaction({
    to: CONTRACT_ADDRESS,
    from: FROM_ADDRESS,
    value: 0,
    data: '0x' + params.toString('hex'),
    gasPrice: web3.eth.gasPrice,
    gas: 4* 1e6,
  })
  // return await instance.addManyUsers(addresses, { from: FROM_ADDRESS })

  // return await Promise.all(
  //   addresses.map(address => instance.addUser(address))
  // )
}

function getEnv(name, defaultValue) {
  if (! process.env[name]) {
    console.log(`WARNING: No environment variable ${name} is set, defaulting to ${defaultValue}`)
    return defaultValue
  }

  return process.env[name]
}
const sleep = function(ms) {
  console.log(`Sleeping for ${Math.floor(ms/1000)} seconds`)
  return new Promise(resolve => setTimeout(resolve, ms))
}

// For it to work with truffle exec ( http://truffleframework.com/docs/getting_started/scripts )
module.exports = function(callback) {
  run()
    .then(() =>
      callback()
    )
    .catch(console.log)
    .catch(error =>
      callback(error)
    )
}
