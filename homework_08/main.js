// 1. Реализовать стек и его операции на основе массива. 
// empty  — проверка стека на наличие в нем элементов,
// push  — операция вставки нового элемента,
// pop  — операция удаления нового элемента.
// 2. Реализовать нижеперечисленные операции самостоятельно для структуры Стек:
// peek() – Возвращает элемент c вершины стека, но не удаляет его.
// search(element) -  Определяет, существует ли объект в стеке. Если элемент найден, возвращает позицию элемента с вершины стека. В противном случае он возвращает -1.

class Stack {
  #elements; // приватне поле

  constructor() {
    this.#elements = [];
  }

  // Перевіряємо, чи стек порожній
  isEmpty() {
    return this.#elements.length === 0;
  }

  // Додаємо елемент на вершину стека
  push(element) {
    this.#elements.push(element);
  }

  // Видаляємо та повертаємо елемент з вершини стека
  pop() {
    if (this.isEmpty()) {
      throw new Error("Stack is empty");
    }
    return this.#elements.pop();
  }

  // Повертаємо елемент з вершини стека, не видаляючи його
  peek() {
    if (this.isEmpty()) {
      throw new Error("Stack is empty");
    }
    return this.#elements[this.#elements.length - 1];
  }

  // Повертаємо позицію елемента від вершини (0 — це верх)
  search(element) {
    for (let i = this.#elements.length - 1, pos = 0; i >= 0; i--, pos++) {
      if (this.#elements[i] === element) {
        return pos;
      }
    }
    return -1;
  }
}

const stack = new Stack();

stack.push(1);
stack.push(2);
stack.push(3);

console.log("peek:", stack.peek()); // peek: 3
console.log("search '2':", stack.search("2")); // search '2': 1
console.log("search '5':", stack.search("5")); // search '5': -1

stack.pop();
console.log("peek after pop:", stack.peek()); // peek after pop: 2