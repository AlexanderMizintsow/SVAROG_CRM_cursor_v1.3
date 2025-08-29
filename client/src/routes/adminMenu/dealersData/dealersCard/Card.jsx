import { useEffect, useState, useRef } from 'react'
import { RxWidth } from 'react-icons/rx'
import DealerInfo from './DealerInfo'
import Representatives from './Representatives'
import Contacts from './Contacts'
import blurImage1 from '../../../../assets/img/radug1.jpg'
import blurImage2 from '../../../../assets/img/radug2.jpg'
import blurImage3 from '../../../../assets/img/radug3.jpg'
import blurImage4 from '../../../../assets/img/radug4.jpg'
import blurImage5 from '../../../../assets/img/radug5.jpg'
import avatarImage from '../../../../assets/img/dealers.jpg'
import './card.scss'

const Card = ({ company, toggleCardWidth, setIsDelete }) => {
  const [activeSection, setActiveSection] = useState('#dealer')
  const [randomBlurImage, setRandomBlurImage] = useState(blurImage1)
  const cardRef = useRef(null)

  useEffect(() => {
    const images = [blurImage1, blurImage2, blurImage3, blurImage4, blurImage5]
    const randomImage = images[Math.floor(Math.random() * images.length)]
    setRandomBlurImage(randomImage)
  }, [])

  const handleButtonClick = (section) => {
    setActiveSection(section)
  }

  const handleToggleClick = () => {
    toggleCardWidth()
    requestAnimationFrame(() => {
      if (cardRef.current) {
        cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    })
  }

  return (
    <div ref={cardRef}>
      {' '}
      {/* Привязываем ref к карточке */}
      <div
        className={` card ${activeSection !== '#dealer' ? 'is-active' : ''}  `}
        data-state={activeSection}
      >
        <div className="card-header">
          <div
            className="card-cover"
            style={{
              backgroundImage: `url(${randomBlurImage})`,
            }}
          ></div>

          <RxWidth
            onClick={handleToggleClick}
            className="toggle-card icon-pointer"
          />
          <img className="card-avatar" src={avatarImage} alt="avatar" />
          <h1 className="card-fullname">{company.company_name}</h1>
          <h2 className="card-jobtitle">{company.industry_name}</h2>
        </div>

        <div className="card-main">
          {activeSection === '#dealer' && (
            <DealerInfo company={company} setIsDelete={setIsDelete} />
          )}
          {activeSection === '#representatives' && (
            <Representatives companyId={company.company_id} />
          )}
          {activeSection === '#contacts' && (
            <Contacts companyId={company.company_id} />
          )}
          <div className="card-buttons">
            <button
              onClick={() => handleButtonClick('#dealer')}
              className={activeSection === '#dealer' ? 'is-active' : ''}
            >
              Дилер
            </button>
            <button
              onClick={() => handleButtonClick('#representatives')}
              className={
                activeSection === '#representatives' ? 'is-active' : ''
              }
            >
              Представители
            </button>
            <button
              onClick={() => handleButtonClick('#contacts')}
              className={activeSection === '#contacts' ? 'is-active' : ''}
            >
              Общая информация
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Card
