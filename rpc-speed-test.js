#!/usr/bin/env node

/**
 * RPC Speed Test Script
 * Tests and compares the speed of different BSC RPC endpoints
 */

import { createPublicClient, http } from 'viem';
import { bsc } from 'viem/chains';

// Test RPC endpoints (you can modify this list)
const RPC_ENDPOINTS = [
  // Binance official endpoints
  'https://bsc-dataseed1.binance.org',
  'https://bsc-dataseed2.binance.org',
  'https://bsc-dataseed3.binance.org',
  'https://bsc-dataseed4.binance.org',
  'https://bsc-dataseed.binance.org',
  
  // DeFiBit endpoints
  'https://bsc-dataseed1.defibit.io',
  'https://bsc-dataseed2.defibit.io',
  
  // Ninicoin endpoints
  'https://bsc-dataseed1.ninicoin.io',
  'https://bsc-dataseed2.ninicoin.io',
  
  // Other public endpoints
  'https://bsc.meowrpc.com',
  'https://bsc.publicnode.com',
  'https://bsc-rpc.publicnode.com',
  'https://bsc-mainnet.public.blastapi.io',
  
  // Chainstack (if you have access)
  'https://bsc-mainnet.core.chainstack.com/7727aa61bd5196fbf1467872aa973933',
  
  // Add your custom endpoints here
  // 'https://your-custom-rpc.com',
];

// Test configurations
const TEST_CONFIG = {
  requestsPerEndpoint: 5,        // Number of requests per endpoint
  timeoutMs: 10000,             // Timeout per request (10 seconds)
  concurrentTests: false,       // Set to true for concurrent testing (faster but less accurate)
  testMethods: [
    'getBlockNumber',
    'getBalance',
    'getTransactionCount',
    'getLogs'
  ]
};

class RPCSpeedTester {
  constructor() {
    this.results = [];
  }

  /**
   * Test a single RPC endpoint
   */
  async testEndpoint(url, testName = 'Speed Test') {
    console.log(`\n🔍 Testing: ${url}`);
    console.log('─'.repeat(80));
    
    const client = createPublicClient({
      chain: bsc,
      transport: http(url, {
        timeout: TEST_CONFIG.timeoutMs,
        retryCount: 1
      })
    });

    const endpointResults = {
      url,
      testName,
      requests: [],
      averageResponseTime: 0,
      successRate: 0,
      errors: []
    };

    // Test getBlockNumber (most common call)
    console.log(`   📊 Testing getBlockNumber (${TEST_CONFIG.requestsPerEndpoint} requests)...`);
    const blockNumberTests = await this.runTest(client, 'getBlockNumber', TEST_CONFIG.requestsPerEndpoint);
    endpointResults.requests.push(...blockNumberTests);

    // Test getBalance (common for trading)
    console.log(`   💰 Testing getBalance (${TEST_CONFIG.requestsPerEndpoint} requests)...`);
    const balanceTests = await this.runTest(client, 'getBalance', TEST_CONFIG.requestsPerEndpoint, {
      address: '0x8894E0a0c962CB723c1976a4421c95949bE2D4E3' // Binance hot wallet
    });
    endpointResults.requests.push(...balanceTests);

    // Test getTransactionCount (common for nonce checking)
    console.log(`   🔢 Testing getTransactionCount (${TEST_CONFIG.requestsPerEndpoint} requests)...`);
    const txCountTests = await this.runTest(client, 'getTransactionCount', TEST_CONFIG.requestsPerEndpoint, {
      address: '0x8894E0a0c962CB723c1976a4421c95949bE2D4E3'
    });
    endpointResults.requests.push(...txCountTests);

    // Test getLogs (used for event monitoring)
    console.log(`   📋 Testing getLogs (${TEST_CONFIG.requestsPerEndpoint} requests)...`);
    const logsTests = await this.runTest(client, 'getLogs', TEST_CONFIG.requestsPerEndpoint, {
      address: '0x5c952063c7fc8610ffdb798152d69f0b9550762b', // Four.meme factory
      fromBlock: 'latest',
      toBlock: 'latest'
    });
    endpointResults.requests.push(...logsTests);

    // Calculate statistics
    endpointResults.averageResponseTime = this.calculateAverage(endpointResults.requests.map(r => r.responseTime));
    endpointResults.successRate = (endpointResults.requests.filter(r => r.success).length / endpointResults.requests.length) * 100;
    endpointResults.errors = [...new Set(endpointResults.requests.filter(r => !r.success).map(r => r.error))];

    console.log(`   ✅ Average Response Time: ${endpointResults.averageResponseTime.toFixed(2)}ms`);
    console.log(`   📈 Success Rate: ${endpointResults.successRate.toFixed(1)}%`);
    
    if (endpointResults.errors.length > 0) {
      console.log(`   ❌ Errors: ${endpointResults.errors.join(', ')}`);
    }

    this.results.push(endpointResults);
    return endpointResults;
  }

  /**
   * Run a specific test method multiple times
   */
  async runTest(client, method, count, params = {}) {
    const results = [];
    
    for (let i = 0; i < count; i++) {
      const startTime = Date.now();
      let success = false;
      let error = null;
      
      try {
        await client[method](params);
        success = true;
      } catch (err) {
        error = err.message || 'Unknown error';
      }
      
      const responseTime = Date.now() - startTime;
      
      results.push({
        method,
        requestNumber: i + 1,
        responseTime,
        success,
        error
      });
      
      // Show progress
      process.stdout.write(`     ${i + 1}/${count} `);
      if (success) {
        process.stdout.write(`✅ ${responseTime}ms `);
      } else {
        process.stdout.write(`❌ ${responseTime}ms `);
      }
      
      // Small delay to avoid rate limiting
      await this.sleep(100);
    }
    
    console.log(''); // New line after progress
    return results;
  }

  /**
   * Calculate average from array of numbers
   */
  calculateAverage(numbers) {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Run tests on all endpoints
   */
  async runAllTests() {
    console.log('🚀 Starting RPC Speed Test');
    console.log('='.repeat(80));
    console.log(`📊 Testing ${RPC_ENDPOINTS.length} endpoints`);
    console.log(`🔄 ${TEST_CONFIG.requestsPerEndpoint} requests per method per endpoint`);
    console.log(`⏱️  Timeout: ${TEST_CONFIG.timeoutMs}ms per request`);
    console.log('='.repeat(80));

    const startTime = Date.now();

    for (const url of RPC_ENDPOINTS) {
      try {
        await this.testEndpoint(url);
      } catch (error) {
        console.log(`❌ Failed to test ${url}: ${error.message}`);
        this.results.push({
          url,
          testName: 'Failed Test',
          requests: [],
          averageResponseTime: Infinity,
          successRate: 0,
          errors: [error.message]
        });
      }
      
      // Delay between endpoints to avoid overwhelming
      await this.sleep(1000);
    }

    const totalTime = Date.now() - startTime;
    console.log(`\n⏱️  Total test time: ${(totalTime / 1000).toFixed(1)} seconds`);
  }

  /**
   * Generate and display results summary
   */
  displayResults() {
    console.log('\n📊 RESULTS SUMMARY');
    console.log('='.repeat(80));
    
    // Sort by average response time
    const sortedResults = this.results
      .filter(r => r.successRate > 0) // Only show successful endpoints
      .sort((a, b) => a.averageResponseTime - b.averageResponseTime);

    console.log('\n🏆 TOP 10 FASTEST ENDPOINTS:');
    console.log('─'.repeat(80));
    console.log('Rank | Response Time | Success Rate | Endpoint');
    console.log('─'.repeat(80));
    
    sortedResults.slice(0, 10).forEach((result, index) => {
      const rank = (index + 1).toString().padStart(2);
      const time = result.averageResponseTime.toFixed(2).padStart(8);
      const success = result.successRate.toFixed(1).padStart(8);
      const url = result.url.length > 50 ? result.url.substring(0, 47) + '...' : result.url;
      
      console.log(`${rank}    | ${time}ms     | ${success}%     | ${url}`);
    });

    console.log('\n📈 STATISTICS:');
    console.log('─'.repeat(80));
    const successfulEndpoints = this.results.filter(r => r.successRate > 0);
    const avgResponseTime = this.calculateAverage(successfulEndpoints.map(r => r.averageResponseTime));
    const avgSuccessRate = this.calculateAverage(successfulEndpoints.map(r => r.successRate));
    
    console.log(`Total Endpoints Tested: ${this.results.length}`);
    console.log(`Successful Endpoints: ${successfulEndpoints.length}`);
    console.log(`Average Response Time: ${avgResponseTime.toFixed(2)}ms`);
    console.log(`Average Success Rate: ${avgSuccessRate.toFixed(1)}%`);
    
    console.log('\n⚡ RECOMMENDATIONS:');
    console.log('─'.repeat(80));
    if (sortedResults.length > 0) {
      const fastest = sortedResults[0];
      console.log(`🥇 Fastest: ${fastest.url} (${fastest.averageResponseTime.toFixed(2)}ms)`);
      
      if (sortedResults.length > 1) {
        const second = sortedResults[1];
        console.log(`🥈 Second: ${second.url} (${second.averageResponseTime.toFixed(2)}ms)`);
      }
      
      if (sortedResults.length > 2) {
        const third = sortedResults[2];
        console.log(`🥉 Third: ${third.url} (${third.averageResponseTime.toFixed(2)}ms)`);
      }
    }

    console.log('\n💡 COPY TRADING OPTIMIZATION:');
    console.log('─'.repeat(80));
    console.log('For fastest copy trading, use the top 3 endpoints in your RPC fallback list.');
    console.log('Consider a private RPC provider for sub-100ms response times.');
    
    // Export results to JSON
    this.exportResults();
  }

  /**
   * Export results to JSON file
   */
  exportResults() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `rpc-speed-test-results-${timestamp}.json`;
    
    const exportData = {
      timestamp: new Date().toISOString(),
      testConfig: TEST_CONFIG,
      results: this.results.sort((a, b) => a.averageResponseTime - b.averageResponseTime)
    };
    
    try {
      const fs = await import('fs');
      fs.writeFileSync(filename, JSON.stringify(exportData, null, 2));
      console.log(`\n💾 Results exported to: ${filename}`);
    } catch (error) {
      console.log(`\n❌ Failed to export results: ${error.message}`);
    }
  }
}

// Main execution
async function main() {
  const tester = new RPCSpeedTester();
  
  try {
    await tester.runAllTests();
    tester.displayResults();
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Handle command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
RPC Speed Test Script

Usage: node rpc-speed-test.js [options]

Options:
  --help, -h          Show this help message
  --concurrent        Run concurrent tests (faster but less accurate)
  --requests N        Number of requests per endpoint (default: 5)
  --timeout N         Timeout in milliseconds (default: 10000)

Examples:
  node rpc-speed-test.js
  node rpc-speed-test.js --requests 10 --timeout 5000
  node rpc-speed-test.js --concurrent
`);
  process.exit(0);
}

// Parse command line arguments
if (process.argv.includes('--concurrent')) {
  TEST_CONFIG.concurrentTests = true;
}

const requestsIndex = process.argv.indexOf('--requests');
if (requestsIndex !== -1 && process.argv[requestsIndex + 1]) {
  TEST_CONFIG.requestsPerEndpoint = parseInt(process.argv[requestsIndex + 1]);
}

const timeoutIndex = process.argv.indexOf('--timeout');
if (timeoutIndex !== -1 && process.argv[timeoutIndex + 1]) {
  TEST_CONFIG.timeoutMs = parseInt(process.argv[timeoutIndex + 1]);
}

// Run the test
main().catch(console.error);




