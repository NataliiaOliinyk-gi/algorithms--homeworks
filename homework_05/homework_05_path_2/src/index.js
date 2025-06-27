import { mergeSortedFiles } from "./mergeSortedFiles.js";

const filesToMerge = ["number1.txt", "number2.txt", "number3.txt", "number4.txt"];

const start = async () => {
    try {
        await mergeSortedFiles(filesToMerge);
        console.log("Файлы успешно объединены! Результат сохранен в 'merged.txt'");
    } catch (err) {
        console.error("Произошла ошибка при слиянии файлов:", err.message);
    }
};

start();