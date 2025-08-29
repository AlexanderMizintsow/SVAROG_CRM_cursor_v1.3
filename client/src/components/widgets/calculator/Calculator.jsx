import { useState } from 'react'
import './calculator.scss' // Импортируйте SCSS файл

const Calculator = ({ isOpen, onClose }) => {
  const [mode, setMode] = useState('price')

  // Стейты для расчета цены
  const [discountPercentage, setDiscountPercentage] = useState(65)
  const [amount, setAmount] = useState('')
  const [result, setResult] = useState('')

  // Стейты для расчета веса
  const [weight, setWeight] = useState('')
  const [isKgToGrams, setIsKgToGrams] = useState(true)
  const [convertedWeight, setConvertedWeight] = useState('')

  // Функция для расчета оригинальной цены
  const calculateOriginalPrice = () => {
    const price = parseFloat(amount)
    if (!isNaN(price) && discountPercentage >= 0) {
      const original = price / (1 - discountPercentage / 100)
      setResult(original.toFixed(2))
    }
  }

  // Функция для расчета итоговой цены со скидкой
  const calculateDiscountedPrice = () => {
    const price = parseFloat(amount)
    if (!isNaN(price) && discountPercentage >= 0) {
      const discounted = price * (1 - discountPercentage / 100)
      setResult(discounted.toFixed(2))
    }
  }

  // Функция для конвертации веса
  const handleConvertWeight = () => {
    const weightValue = parseFloat(weight)
    if (!isNaN(weightValue)) {
      const converted = isKgToGrams ? weightValue * 1000 : weightValue / 1000
      setConvertedWeight(converted.toFixed(2))
    }
  }

  const toggleWeightConversion = () => {
    setIsKgToGrams(!isKgToGrams)
    setWeight('')
    setConvertedWeight('')
  }

  if (!isOpen) return null

  return (
    <div className="calculator-overlay">
      <div className="calculator-modal">
        <button onClick={onClose} className="calculator-close-button">
          X
        </button>

        <div>
          <h2 className="calculator-h2">
            Режим:{' '}
            {mode === 'price'
              ? 'Цена без скидки'
              : mode === 'discount'
              ? 'Цена со скидкой'
              : 'Конвертация веса'}
          </h2>
          <button
            className="calculator-button"
            onClick={() => setMode('price')}
          >
            Цена без скидки
          </button>
          <button
            className="calculator-button"
            onClick={() => setMode('discount')}
          >
            Цена со скидкой
          </button>
          <button
            className="calculator-button"
            onClick={() => setMode('weight')}
          >
            Конвертация веса
          </button>
        </div>

        {mode === 'price' && (
          <div>
            <label className="calculator-label" htmlFor="discountPercentage">
              Процент скидки:
            </label>
            <input
              type="number"
              id="discountPercentage"
              className="calculator-input"
              value={discountPercentage}
              onChange={(e) => setDiscountPercentage(e.target.value)}
            />

            <label className="calculator-label" htmlFor="amount">
              Итоговая сумма:
            </label>
            <input
              type="number"
              id="amount"
              className="calculator-input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />

            <button
              className="calculator-button"
              onClick={calculateOriginalPrice}
            >
              Рассчитать цену без скидки
            </button>
          </div>
        )}

        {mode === 'discount' && (
          <div>
            <label className="calculator-label" htmlFor="price">
              Цена:
            </label>
            <input
              type="number"
              id="price"
              className="calculator-input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />

            <label
              className="calculator-label"
              htmlFor="discountPercentageDiscount"
            >
              Процент скидки:
            </label>
            <input
              type="number"
              id="discountPercentageDiscount"
              className="calculator-input"
              value={discountPercentage}
              onChange={(e) => setDiscountPercentage(e.target.value)}
            />

            <button
              className="calculator-button"
              onClick={calculateDiscountedPrice}
            >
              Рассчитать итоговую цену со скидкой
            </button>
          </div>
        )}

        {mode === 'weight' && (
          <div>
            <label className="calculator-label" htmlFor="weightInput">
              {isKgToGrams ? 'Килограммы:' : 'Граммы:'}
            </label>
            <input
              type="number"
              id="weightInput"
              className="calculator-input"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
            <button className="calculator-button" onClick={handleConvertWeight}>
              Конвертировать
            </button>
            <button
              className="calculator-button"
              onClick={toggleWeightConversion}
            >
              {isKgToGrams
                ? 'Переключить на г -> кг'
                : 'Переключить на кг -> г'}
            </button>
          </div>
        )}

        <h3 className="calculator-h3">
          Результат:
          {mode === 'weight'
            ? `${convertedWeight} ${isKgToGrams ? 'г' : 'кг'}`
            : `${result} руб.`}
        </h3>
      </div>
    </div>
  )
}

export default Calculator
