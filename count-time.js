const { ethers } = require("ethers");

const rpcUrls = [
  'https://bsc-dataseed1.binance.org',
  'https://bsc-dataseed2.binance.org',
  'https://bsc-dataseed3.binance.org',
  'https://bsc-dataseed4.binance.org',
  'https://bsc-dataseed.binance.org',
  
  'https://bsc-dataseed1.defibit.io',
  'https://bsc-dataseed2.defibit.io',
  'https://lb.drpc.live/bsc/AqI3Ie1juUWKoPU70_eGdMDb-J5BomIR8IEIwg8TMB_n',
  'https://bsc-dataseed1.ninicoin.io',
  'https://bsc-dataseed2.ninicoin.io',
  'https://bnb-mainnet.g.alchemy.com/v2/pcd64O6ye9sMw0BCMRmFVE9QEMfTNFmo',
  'https://bsc.meowrpc.com',
  'https://bsc.publicnode.com',
  'https://bsc-rpc.publicnode.com',
  'https://bsc-mainnet.public.blastapi.io',
  'https://bsc-mainnet.rpcfast.com?api_key=9aC7rb178eGD3tx949iD4kVSinSo5ZaptebOBkqGvt6UIUp50dlXSAlDttR6ei2E',
  'https://bsc-mainnet.core.chainstack.com/7727aa61bd5196fbf1467872aa973933',
];

async function testRpcLatency(url) {
  try {
    const provider = new ethers.JsonRpcProvider(url);
    const start = Date.now();
    await provider.getBlockNumber();
    const end = Date.now();
    return { url, latency: end - start };
  } catch (error) {
    return { url, latency: null, error: error.message };
  }
}

async function main() {
  const results = [];
  for (const url of rpcUrls) {
    const result = await testRpcLatency(url);
    results.push(result);
    if (result.latency !== null) {
      console.log(`RPC: ${url} - Latency: ${result.latency} ms`);
    } else {
      console.log(`RPC: ${url} - Error: ${result.error}`);
    }
  }
  
  // Optionally, sort by latency ascending and display summary
  results
    .filter(r => r.latency !== null)
    .sort((a, b) => a.latency - b.latency)
    .forEach(r => console.log(`Fastest RPC: ${r.url} with ${r.latency} ms`));
}

main();