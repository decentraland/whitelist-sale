var abi = require('ethereumjs-abi')

var parameterTypes = ["address", "uint256", "address"]
var params = ['0x0F5D2fB29fb7d3CFeE444a200298f468908cC942', 1505480400, '0xFE95E04A628087FCdD5f278E61F148B47471Af4A']

console.log(abi.rawEncode(parameterTypes, params).toString('hex'))
