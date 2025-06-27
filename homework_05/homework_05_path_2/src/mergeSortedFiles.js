import * as fs from "node:fs/promises";
import path from "node:path";

// Считывание одного файла и преобразование в массив чисел
const readFile = async (filename) =>{
    const pathFile = path.resolve("src", filename);
    const data = await fs.readFile(pathFile, "utf-8");
    return data.split(/\n/).map(Number);
}

// Функция слияния двух отсортированных массивов
function mergeTwoSortedArrays(array1, array2) {
    const mergedArray = [];
    let i = 0, j = 0;

    while (i < array1.length && j < array2.length) {
        if (array1[i] < array2[j]) {
            mergedArray.push(array1[i]);
            i++;
        } else {
            mergedArray.push(array2[j]);
            j++;
        }
    }

    // Добавляем остатки
    return mergedArray.concat(array1.slice(i)).concat(array2.slice(j));
}

// Объединение нескольких массивов с использованием рекурсии
function mergeSortedArraysRecursively(arrays) {
    if (arrays.length === 0) return [];
    if (arrays.length === 1) return arrays[0];

    const midIndex = Math.floor(arrays.length / 2);
    const leftArray = mergeSortedArraysRecursively(arrays.slice(0, midIndex));
    const rightArray = mergeSortedArraysRecursively(arrays.slice(midIndex));

    return mergeTwoSortedArrays(leftArray, rightArray);
};

// Главная функция, объединяющая данные из файлов и записывающая в результат
export const mergeSortedFiles = async (filenames, outputFilename = "merged.txt") => {
    const arrays = await Promise.all(filenames.map(readFile));
    const mergedArray = mergeSortedArraysRecursively(arrays);
    const outputPath = path.resolve("src", outputFilename);
    await fs.writeFile(outputPath, mergedArray.join("\n"), "utf-8");
};

