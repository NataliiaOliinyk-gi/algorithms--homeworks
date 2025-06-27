// Имея два отсортированных массива размера m и n соответственно, вам нужно найти элемент, который будет находиться на k-й позиции в конечном отсортированном массиве.
// Массив 1 - 100 112 256 349 770
// Массив 2 - 72 86 113 119 265 445 892
// к = 7
// Вывод : 256

// Окончательный отсортированный массив -
// 72, 86, 100, 112, 113, 119, 256, 265, 349, 445, 770, 892

// 7-й элемент этого массива равен 256.
// Есть два решения этой задачи. Вы можете начать с интуитивно-очевидного вариант, сравнивая элементы двух массивов и сливая элементы упорядоченно в третий. В результате к к-ом месте в третьем массиве будет искомый элемент.

function findKthElement(array1, array2, k, start1 = 0, start2 = 0) {

  // Если k = 1, возвращаем самый маленький из двух текущих элементов
  if (k === 1) {
    return Math.min(array1[start1], array2[start2]);
  }

  // Если первый массив исчерпан
  if (start1 >= array1.length) {
    return array2[start2 + k - 1];
  }

  // Если второй массив исчерпан
  if (start2 >= array1.length) {
    return array1[start1 + k - 1];
  }

  // Вычисляем новые позиции для сравнения
  let index1 = start1 + Math.min(Math.floor(k / 2), array1.length - start1) - 1;
  let index2 = start2 + Math.min(Math.floor(k / 2), array2.length - start2) - 1;

  let val1 = array1[index1];
  let val2 = array2[index2];

  // Удаляем часть одного из массивов
  if (val1 <= val2) {
    let newK = k - (index1 - start1 + 1);
    return findKthElement(array1, array2, newK, index1 + 1, start2);
  } else {
    let newK = k - (index2 - start2 + 1);
    return findKthElement(array1, array2, newK, start1, index2 + 1);
  }
}

// Проверка:
const array1 = [100, 112, 256, 349, 770];
const array2 = [72, 86, 113, 119, 265, 445, 892];
const k = 7;

console.log(findKthElement(array1, array2, k)); // 256