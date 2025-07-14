// Постройте частотный словарь букв немецкого или английского алфавита. Частотный словарь букв - это структура данных или набор информации, который содержит информацию о том, какие буквы встречаются в тексте и с какой частотой.

function buildGermanLetterFrequency(text) {
  const result = {};
  const normalized = text.toLowerCase().replace(/[^a-zäöüß]/g, "");

  for (const char of normalized) {
    result[char] = (result[char] || 0) + 1;
  }

  return result;
}

// якщо використовувати динамічний масив
function buildFrequencyWithDynamicArray(text) {
  const resultArray = []; // динамічний масив пар [буква, частота]

  function findIndex(char) {
    for (let i = 0; i < resultArray.length; i++) {
      if (resultArray[i][0] === char) return i;
    }
    return -1;
  }

  const normalized = text.toLowerCase().replace(/[^a-zäöüß]/g, "");

  for (const char of normalized) {
    const idx = findIndex(char);
    if (idx === -1) {
      resultArray.push([char, 1]); // можлива операція розширення масиву — амортизований O(1)
    } else {
      resultArray[idx][1]++; // збільшуємо частоту
    }
  }

  return resultArray;
}