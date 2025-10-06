#!/usr/bin/env node

/**
 * Simple RPC Speed Test
 * Easy to customize with your own RPC URLs
 */

import { createPublicClient, http } from 'viem';
import { bsc } from 'viem/chains';

// 🔧 CUSTOMIZE YOUR RPC URLs HERE
const CUSTOM_RPC_URLS = [
  // Add your RPC URLs here
  'https://bsc-mainnet.public.blastapi.io',
  'https://go.getblock.io/143bad395797494787f59f3647669e5d',
  'https://muddy-serene-fog.bsc.quiknode.pro/9cf0f2833b90790c97339c587a75e927fa0361ef',
  'https://bsc-dataseed1.binance.org',
  'https://bsc-dataseed2.binance.org',
  'https://bsc.meowrpc.com',
  'https://bsc.publicnode.com',
  'https://bsc-rpc.publicnode.com',
 

  // 'https://your-private-rpc.com',
  // 'https://your-chainstack-endpoint.com',
];

// Test settings
const TEST_SETTINGS = {
  requestsPerEndpoint: 3,    // Number of test requests
  timeoutMs: 8000,          // 8 second timeout
};

class SimpleRPCTester {
  constructor() {
    this.results = [];
  }

  async testRPC(url) {
    console.log(`\n🔍 Testing: ${url}`);
    
    const client = createPublicClient({
      chain: bsc,
      transport: http(url, {
        timeout: TEST_SETTINGS.timeoutMs,
        retryCount: 1
      })
    });

    const responseTimes = [];
    let successCount = 0;
    const errors = [];

    // Test getBlockNumber (most important for copy trading)
    for (let i = 0; i < TEST_SETTINGS.requestsPerEndpoint; i++) {
      const startTime = Date.now();
      
      try {
        const blockNumber = await client.getBlockNumber();
        const responseTime = Date.now() - startTime;
        
        responseTimes.push(responseTime);
        successCount++;
        
        process.stdout.write(`   ✅ ${responseTime}ms `);
      } catch (error) {
        const responseTime = Date.now() - startTime;
        errors.push(error.message);
        process.stdout.write(`   ❌ ${responseTime}ms `);
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    const averageTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
      : Infinity;
    
    const successRate = (successCount / TEST_SETTINGS.requestsPerEndpoint) * 100;

    console.log('');
    console.log(`   📊 Average: ${averageTime.toFixed(2)}ms | Success: ${successRate.toFixed(1)}%`);
    
    if (errors.length > 0) {
      console.log(`   ❌ Errors: ${[...new Set(errors)].join(', ')}`);
    }

    this.results.push({
      url,
      averageTime,
      successRate,
      errors: [...new Set(errors)]
    });

    return { averageTime, successRate };
  }

  async runAllTests() {
    console.log('🚀 Simple RPC Speed Test');
    console.log('='.repeat(60));
    console.log(`📊 Testing ${CUSTOM_RPC_URLS.length} endpoints`);
    console.log(`🔄 ${TEST_SETTINGS.requestsPerEndpoint} requests per endpoint`);
    console.log('='.repeat(60));

    for (const url of CUSTOM_RPC_URLS) {
      await this.testRPC(url);
      
      // Delay between endpoints
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    this.showResults();
  }

  showResults() {
    console.log('\n📊 RESULTS');
    console.log('='.repeat(60));
    
    // Sort by speed (fastest first)
    const sorted = this.results
      .filter(r => r.successRate > 0)
      .sort((a, b) => a.averageTime - b.averageTime);

    console.log('\n🏆 RANKING (Fastest to Slowest):');
    console.log('─'.repeat(60));
    
    sorted.forEach((result, index) => {
      const rank = index + 1;
      const time = result.averageTime.toFixed(2);
      const success = result.successRate.toFixed(1);
      const url = result.url.length > 45 ? result.url.substring(0, 42) + '...' : result.url;
      
      console.log(`${rank}. ${time}ms (${success}%) - ${url}`);
    });

    console.log('\n💡 RECOMMENDATIONS:');
    console.log('─'.repeat(60));
    
    if (sorted.length > 0) {
      const fastest = sorted[0];
      console.log(`🥇 Use this for fastest trading: ${fastest.url}`);
      console.log(`   Response time: ${fastest.averageTime.toFixed(2)}ms`);
      
      if (sorted.length > 1) {
        const second = sorted[1];
        console.log(`🥈 Backup option: ${second.url}`);
        console.log(`   Response time: ${second.averageTime.toFixed(2)}ms`);
      }
    }

    // Show failed endpoints
    const failed = this.results.filter(r => r.successRate === 0);
    if (failed.length > 0) {
      console.log('\n❌ FAILED ENDPOINTS:');
      console.log('─'.repeat(60));
      failed.forEach(result => {
        console.log(`   ${result.url} - ${result.errors.join(', ')}`);
      });
    }

    console.log('\n🔧 TO UPDATE YOUR RPC CONFIG:');
    console.log('─'.repeat(60));
    console.log('Edit: safe-four-meme-trader/src/services/rpc.ts');
    console.log('Replace the BSC_RPC_ENDPOINTS array with your fastest endpoints');
  }
}

// Run the test
async function main() {
  const tester = new SimpleRPCTester();
  await tester.runAllTests();
}

main().catch(console.error);




