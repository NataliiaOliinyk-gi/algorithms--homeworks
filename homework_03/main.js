// 1. Реализуйте с помощью рекурсии и итерационно следующие функции число Фиббоначи.
// 2. Ознакомьтесь с задачей Ханойская башня и изучите ее решение (сыграйте в игру для лучшего понимания ХАНОЙСКАЯ БАШНЯ).

// Итеративная функция

function fibonacciIterative(n) {
  if (n <= 0) return 0;
  if (n === 1) return 1;

  let prevNumder = 0;
  let currentNumber = 1;

  for (let i = 2; i <= n; i++) {
    const nextNumber = prevNumder + currentNumber;
    prevNumder = currentNumber;
    currentNumber = nextNumber;
  }
  return currentNumber;
};


// Рекурсивная функция

function fibonacciRecursive(n) {
  if (n <= 0) return 0;
  if (n === 1) return 1;
  return fibonacciRecursive(n - 1) + fibonacciRecursive(n - 2);
};


console.log(fibonacciIterative(12)); 
console.log(fibonacciRecursive(12)); 