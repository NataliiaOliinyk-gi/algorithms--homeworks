// 1. Переписать самостоятельно то, что написали во время занятия: заново написать сортировку слиянием, опираясь на текстовое описание.

// Объясните себе, в чем суть метода сортировки слиянием
// Разделите решение на несколько подзадач: как делится массив, где используется рекурсия, как происходит слияние двух массивов в третий, отсортированный. Можете воспользоваться ручкой и листиком, выписать на листке пример не отсортированного массива и экспериментировать с ним, выполняя шаги и рисуя состояние левого и правого массивов, как было на уроке. 
// Попробуйте написать свой код на Python.
// Когда ваш код заработает, запустите его несколько раз на массивах с разными значениями: пустыми, с одинаковыми данными, отсортированными в обратном порядке, с четным и нечетным количеством элементов и так далее. Убедитесь, что все работает. 


const mergeSort = (currentArray) => {
  if (currentArray.length === 1 || currentArray.length === 0) {
    return currentArray;
  }
  let arrayLeft = mergeSort(currentArray.slice(0, Math.floor(currentArray.length / 2)));
  let arrayRight = mergeSort(currentArray.slice(Math.floor(currentArray.length / 2)));
  let n = 0, m = 0, k = 0;
  let tempArray = new Array(currentArray.length);
  while (n < arrayLeft.length && m < arrayRight.length) {
    if (arrayLeft[n] <= arrayRight[m]) {
      tempArray[k] = arrayLeft[n];
      n++;
    } else {
      tempArray[k] = arrayRight[m];
      m++;
    }
    k++;
  };

  while (n < arrayLeft.length) {
    tempArray[k] = arrayLeft[n];
    n++;
    k++;
  };

  while (m < arrayRight.length) {
    tempArray[k] = arrayRight[m];
    m++;
    k++;
  };

  for (let i = 0; i < currentArray.length; i++) {
    currentArray[i] = tempArray[i];
  };

  return currentArray;
};

// Проверка:
const array1 = mergeSort([]);
console.log(array1);  // []

const array2 = mergeSort([20, 20, 20, 20]);
console.log(array2);  // [20, 20, 20, 20]

const array3 = mergeSort([68, 54, 21, 14, 1]);
console.log(array3);  // [1, 14, 21, 54, 68]

const array4 = mergeSort([55, 20, 11, 4, 88]);
console.log(array4);  // [4, 11, 20, 55, 88]

const array5 = mergeSort([55, 20, 11, 4, 88, 121, 1, -8]);
console.log(array5);  // [-8, 1, 4, 11, 20, 55, 88, 121]

