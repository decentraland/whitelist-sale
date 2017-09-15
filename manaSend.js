require('babel-register')
require('babel-polyfill')

const fs = require('fs')
const abi = require('ethereumjs-abi')
const db = require(__dirname + '/db.js')
const MANAToken = artifacts.require(__dirname + '/MANAToken.sol')

/*
db.transfers:
  address:
  value:
  sent:
  txId:
*/

async function readFromFile() {
  const sends = fs.readFileSync('./addresses.csv').toString()
  let lines = sends.split('\n').filter(e => e.length > 1)
  lines = lines.map(line => {
    [ address, mana ] = line.split(',')
    return [ address, parseInt(mana, 10) ]
  })
  console.log(`Read ${lines.length} addresses with ${lines.reduce((e, n) => e + n[1], 0)} MANA target`)
  return lines
}

async function saveToDb(lines) {
  const transfers = db.collection('transfers')
  const promises = lines.map(async(line) => {
    const exists = await transfers.findOne({ address: { $eq: line[0]  } })
    if (!exists) {
      console.log(`Saving new: ${line[0]}`)
      return await transfers.save({ address: line[0], value: line[1] })
    }
  })
  return Promise.all(promises).then(console.log(`Values saved`))
}

async function readUnsent() {
  const transfers = db.collection('transfers')
  return transfers.find({ sent: { $eq: null } })
    .limit(200)
    .toArray()
}

const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS || '0x0F5D2fB29fb7d3CFeE444a200298f468908cC942'

let instance
const SENDER = web3.eth.accounts[0]

async function sendManaTo(candidate) {
  await db.collection('transfers').update(candidate, {
    address: candidate.address,
    value: candidate.value,
    sent: true
  })

  const balance = await instance.balanceOf(candidate.address)
  if (balance.toString() != 0) {
    console.log(`${candidate.address} already has ${balance.div(1e18).toString()} MANA`)
    return 0
  }

  const tx = await instance.transfer(candidate.address, candidate.value * 1e18, {
    sender: SENDER,
    gasPrice: Math.floor(web3.eth.gasPrice * 4 / 3),
    gasLimit: 120000
  })

  console.log(`Sent ${candidate.value} to ${candidate.address} - tx ${tx.tx}`)

  await db.collection('transfers').update(candidate, {
    address: candidate.address,
    value: candidate.value,
    sent: true,
    tx
  })

  return 1
}

async function sendMana(candidates) {
  let i = 0
  for (let candidate of candidates) {
    i += await sendManaTo(candidate)
  }
  return i
}

async function run() {
  await db.connect('whitelist').catch(console.log)

  const data = await readFromFile()
  await saveToDb(data)

  console.log('Looking up the token instance')
  instance = MANAToken.at(TOKEN_ADDRESS)
  console.log(`Sender: ${SENDER}, balance: ${await web3.eth.getBalance(SENDER)}, manaBalance: ${await instance.balanceOf(SENDER)}`)

  const txs = await readUnsent()
  console.log(`Got ${txs.length} entries, sending for the first 100`)
  const candidates = txs.filter((e, n) => n < 100)

  const count = await sendMana(candidates)
  console.log(`Sent to ${count} persons!`)
}

module.exports = function(callback) {
  run()
    .then(() =>
      callback()
    )
    .catch(error =>
      callback(error)
    )
}
