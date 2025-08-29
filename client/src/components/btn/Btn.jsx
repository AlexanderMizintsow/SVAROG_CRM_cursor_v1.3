import PropTypes from 'prop-types'
import './btn.scss'

const Btn = ({ text, onClick, color, size }) => {
  const buttonStyles = {
    backgroundColor: color || '#007bff', // Синий цвет по умолчанию
    color: 'white', // Белый текст
    border: 'none',
    borderRadius: '5px',
    padding: size === 'large' ? '15px 30px' : '10px 20px',
    cursor: 'pointer',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    transition: 'background-color 0.3s, box-shadow 0.3s',
    marginLeft: '10px', // Отступ между кнопками
  }

  return (
    <button className="custom-button" style={buttonStyles} onClick={onClick}>
      {text}
    </button>
  )
}

Btn.propTypes = {
  text: PropTypes.string.isRequired,
  onClick: PropTypes.func,
  color: PropTypes.string,
  size: PropTypes.oneOf(['small', 'large']),
}

export default Btn
