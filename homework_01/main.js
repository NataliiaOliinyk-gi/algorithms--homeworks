function calculateSum() {
    const num1 = parseInt(document.getElementById("num1").value);
    const num2 = parseInt(document.getElementById("num2").value);
    const num3 = parseInt(document.getElementById("num3").value);

    const sum = num1 + num2 + num3;

    document.getElementById("result").textContent = "Сумма: " + sum;
  }