function computeSum(value, numbers) {
    let sum = 0;
    for (let num of numbers) {
      if (num > value) {
        sum += value-1;
      } else {
        sum -= 0.7;
      }
    }
    return sum;
  }
  
  function findOptimalValue(numbers) {
    let bestValue = 1;
    let maxSum = -Infinity;
    const maxNumber = Math.max(...numbers);
    const step = 0.01;
  
    for (let val = 1; val <= maxNumber * 5; val += step) {
      const currentSum = computeSum(val, numbers);
      if (currentSum > maxSum) {
        maxSum = currentSum;
        bestValue = val;
      }
    }
  
    return { bestValue, maxSum };
  }

  // Example usage:
  const numbers = [1.40,2.09,2.47,1.76,1.19,1.73,3.91,1.35,3.995,1.16,4.03,1.886,3.83,3.20,1.18,3.75,3.82,3.95,1.14];
  const result = findOptimalValue(numbers);
  console.log(`Optimal value: ${result.bestValue}, Maximum sum: ${result.maxSum}`);