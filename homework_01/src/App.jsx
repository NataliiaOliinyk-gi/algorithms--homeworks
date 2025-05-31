
import { useState } from 'react';
import './App.css'

function App() {

  const [num1, setNum1] = useState("");
  const [num2, setNum2] = useState("");
  const [num3, setNum3] = useState("");
  const [sum, setSum] = useState("");

  const handleChange = (event, setter) => {
    setter(event.target.value);
  };

  const calculateSum = () => {
    const total = Number(num1) + Number(num2) + Number(num3);
    setSum(total);
  };

  return (
    <>
      <h2>Введите три целых числа:</h2>

      <input
        type="number"
        id="num1"
        placeholder="Число 1"
        value={num1}
        onChange={(event) => handleChange(event, setNum1)} />
      <input
        type="number"
        id="num2"
        placeholder="Число 2"
        value={num2}
        onChange={(event) => handleChange(event, setNum2)} />
      <input
        type="number"
        id="num3"
        placeholder="Число 3"
        value={num3}
        onChange={(event) => handleChange(event, setNum3)} />

      <button onClick={calculateSum}>Посчитать сумму</button>

      <p>Сумма: {sum}</p>
    </>
  )
}

export default App