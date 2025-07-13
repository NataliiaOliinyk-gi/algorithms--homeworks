// 1. Переписать самостоятельно то, что написали во время занятия: заново написать быструю сортировку, опираясь на текстовое описание.
// * Выбираем опорный элемент из массива. Как правило, это средний элемент.
// * Делим массив на 2 подмассива. Элементы, которые меньше опорного, и элементы, которые больше опорного.
// * Рекурсивно применяем сортировку к обоим подмассивам.
// * В результате массивы будут делиться до тех пор, пока не останется один элемент, который потом отсортируется.

// Реалізація в конспекті, опорний елемент - останній елемент масиву

function partition(array, low, high) {
  // Выбираем опорным самый правый (последний) элемент массива
  let pivot = array[high];
  // Инициализируем индекс элемента, который меньше опорного
  let i = low - 1;
  // Проверяем все элементы и сравниваем их с опорным
  for (let j = low; j < high; j++) {
    if (array[j] <= pivot) {
      // Если текущий элемент меньше опорного, меняем его местами с элементом на позиции i
      i++;
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
  // Меняем местами опорный элемент и первый элемент, который больше опорного
  [array[i + 1], array[high]] = [array[high], array[i + 1]];
  return i + 1;
}

function quickSort(array, low, high) {
  if (low < high) {
    // Находим опорный элемент таким образом, что меньшие - слева, большие - справа
    let pi = partition(array, low, high);
    // Рекурсивно сортируем слева от опорного
    quickSort(array, low, pi - 1);
    // Рекурсивно сортируем справа от опорного
    quickSort(array, pi + 1, high);
  }
}

let arr = [7, -2, 4, 1, 6, 5, 0, -4, 2];
quickSort(arr, 0, arr.length - 1);
console.log("Отсортированный массив:", arr);

// Реалізація швидкого сортування, де за опорний елемент беремо середній елемент масиву

function quickSortMiddlePivot(array) {
  // Базовий випадок: якщо масив порожній або з 1 елементом — він вже відсортований
  if (array.length < 2) return array;

  // Вибираємо середній елемент як опорний
  const pivotIndex = Math.floor(array.length / 2);
  const pivot = array[pivotIndex];

  // Створюємо підмасиви: зліва менші елементи за опорний та справа більші 
  const arrayLeft = [];
  const arrayRight = [];

  for (let i = 0; i < array.length; i++) {
    if (i === pivotIndex) continue; // пропускаємо сам pivot
    if (array[i] < pivot) {
      arrayLeft.push(array[i]);
    } else {
      arrayRight.push(array[i]);
    }
  }

  // Рекурсивно сортуємо частини і об'єднуємо результат
  return [...quickSortMiddlePivot(arrayLeft), pivot, ...quickSortMiddlePivot(arrayRight)];
}

// Перевірка:
let arr1 = [7, -2, 4, 1, 6, 5, 0, -4, 2];
let sorted = quickSortMiddlePivot(arr1);
console.log("Відсортований масив:", sorted);


// 2. Реализовать Quicksort используя итерационный подход.

function quickSortIterative(arr) {
  const stack = [];

  // Додаємо початкову пару: початок і кінець усього масиву
  stack.push(0);
  stack.push(arr.length - 1);

  while (stack.length > 0) {
    const high = stack.pop();
    const low = stack.pop();

    const pi = partition(arr, low, high);

    // Якщо є елементи зліва від опорного, додаємо їх у стек
    if (pi - 1 > low) {
      stack.push(low);
      stack.push(pi - 1);
    }

    // Якщо є елементи справа від опорного, додаємо їх у стек
    if (pi + 1 < high) {
      stack.push(pi + 1);
      stack.push(high);
    }
  }
}

// Перевірка:
let arr2 = [7, -2, 4, 1, 6, 5, 0, -4, 2];
quickSortIterative(arr2);
console.log("Відсортований масив:", arr2);