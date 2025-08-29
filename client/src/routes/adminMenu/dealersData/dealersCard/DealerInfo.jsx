import { FiPhone, FiMail } from 'react-icons/fi'
import { PiTrademark } from 'react-icons/pi'
import { CiBarcode } from 'react-icons/ci'
import { IoPeopleOutline } from 'react-icons/io5'
import {
  MdOutlineSettingsApplications,
  MdOutlineWarehouse,
  MdOutlineAddBusiness,
} from 'react-icons/md'
import { IoDocumentTextOutline } from 'react-icons/io5'
import { GoSingleSelect } from 'react-icons/go'
import { BsCalendar2Date } from 'react-icons/bs'
import { AiOutlineNotification } from 'react-icons/ai'
import { CiDeliveryTruck } from 'react-icons/ci'
import { PiTelegramLogoLight, PiIdentificationCardThin } from 'react-icons/pi'
import { MdManageAccounts } from 'react-icons/md'
import { LuForklift } from 'react-icons/lu'
import { RiContractLine } from 'react-icons/ri'
import { SiLichess } from 'react-icons/si'
import { IoManOutline } from 'react-icons/io5'
import EditCompanyDetailsInfo from './EditCompanyDetailsInfo'
import EditCompanyGeneralInfo from './EditCompanyGeneralInfo '
import { useState } from 'react'
import EditCompanyManagerInfo from './EditCompanyManagerInfo'
import EditCompanyCompetitorsInfo from './EditCompanyCompetitorsInfo'
import { CiEdit } from 'react-icons/ci'
import { TbUserEdit } from 'react-icons/tb'
import { MdOutlineEditCalendar } from 'react-icons/md'
import { GiSwordwoman } from 'react-icons/gi'
import EditCompanyManageAccounts from './EditCompanyManageAccounts'
import useUserStore from '../../../../store/userStore'

// Статусы с цветами
const STATUS_STYLES = {
  'Покупатели в работе': '#00e676', // Зеленый
  Уснувшие: '#ffeb3b', // Желтый
  Отвал: '#ff1744', // Красный
  Холдинг: '#ff9800', // Оранжевый
  Потенциальные: '#2196f3', // Синий
}

const DealerInfo = ({ company, setIsDelete }) => {
  const { user } = useUserStore((state) => state)
  const [isModalOpenGeneral, setIsModalOpenGeneral] = useState(false)
  const [isModalOpenManager, setIsModalOpenManager] = useState(false)
  const [isModalOpenDetails, setIsModalOpenDetails] = useState(false)
  const [isModalOpenCompetitors, setIsModalOpenCompetitors] = useState(false)
  const [isModalOpenManageAccounts, setIsModalOpenManageAccounts] =
    useState(false)

  const statusStyle = STATUS_STYLES[company.company_status] || '#ccc'

  const roleConfirm =
    user && ['Администратор', 'Директор'].includes(user?.role_name)

  return (
    <div className="card-section is-active" id="dealer">
      <div className="card-content">
        <div className="card-subtitle"></div>
        <div className="cardContent">
          <div className="buttons">
            <span
              onClick={() => {
                setIsModalOpenGeneral(true)
                setIsModalOpenManager(false)
                setIsModalOpenDetails(false)
                setIsModalOpenCompetitors(false)
              }}
            >
              <CiEdit
                style={{ marginRight: '7px' }}
                className="icon-pointer"
                title="Редактирование блока наименований"
              />
            </span>
            <span
              onClick={() => {
                setIsModalOpenManager(true)
                setIsModalOpenGeneral(false)
                setIsModalOpenDetails(false)
                setIsModalOpenManageAccounts(false)
                setIsModalOpenCompetitors(false)
              }}
            >
              <TbUserEdit
                style={{ marginRight: '7px' }}
                className="icon-pointer"
                title="Редактирование блока сотрудников"
              />
            </span>
            <span
              onClick={() => {
                setIsModalOpenManager(false)
                setIsModalOpenGeneral(false)
                setIsModalOpenDetails(true)
                setIsModalOpenManageAccounts(false)
                setIsModalOpenCompetitors(false)
              }}
            >
              <MdOutlineEditCalendar
                style={{ marginRight: '7px' }}
                className="icon-pointer"
                title="Редактирование блока контактной информации"
              />
            </span>
            <span
              onClick={() => {
                setIsModalOpenManager(false)
                setIsModalOpenGeneral(false)
                setIsModalOpenDetails(false)
                setIsModalOpenManageAccounts(false)
                setIsModalOpenCompetitors(true)
              }}
            >
              <GiSwordwoman
                style={{ marginRight: '7px' }}
                className="icon-pointer"
                title="Редактирование блока конкурнетов"
              />
            </span>
            <span
              onClick={() => {
                setIsModalOpenManager(false)
                setIsModalOpenGeneral(false)
                setIsModalOpenDetails(false)
                setIsModalOpenCompetitors(false)
                setIsModalOpenManageAccounts(true)
              }}
            >
              {' '}
              {roleConfirm && (
                <MdManageAccounts
                  style={{ marginRight: '7px' }}
                  className="icon-pointer"
                  title="Управление карточкой"
                />
              )}
            </span>
            {isModalOpenGeneral && (
              <EditCompanyGeneralInfo
                companyId={company.company_id}
                onClose={() => setIsModalOpenGeneral(false)}
                companyData={company} // Передаем данные компании
              />
            )}
            {isModalOpenManager && (
              <EditCompanyManagerInfo
                companyId={company.company_id}
                onClose={() => {
                  setIsModalOpenManager(false)
                }}
                companyData={company} // Передаем данные компании
              />
            )}
            {isModalOpenDetails && (
              <EditCompanyDetailsInfo
                companyId={company.company_id}
                onClose={() => {
                  setIsModalOpenDetails(false)
                }}
                companyData={company} // Передаем данные компании
              />
            )}
            {isModalOpenCompetitors && (
              <EditCompanyCompetitorsInfo
                companyId={company.company_id}
                onClose={() => {
                  setIsModalOpenCompetitors(false)
                }}
                companyData={company} // Передаем данные компании
              />
            )}
            {isModalOpenManageAccounts && (
              <EditCompanyManageAccounts
                company={company}
                onClose={() => {
                  setIsModalOpenManageAccounts(false)
                }}
                setIsDelete={setIsDelete}
              />
            )}
          </div>
          <div className="title">{company.company_name}</div>
          <div className="location">
            {company.industry_name} | {company.region}
          </div>
          <div className="address">{company.address || 'Адрес не указан'}</div>
          <div
            className="status"
            style={{ backgroundColor: statusStyle, color: 'black' }}
          >
            Статус: {company.company_status}
          </div>
          <div className="link">
            <div className="contactInfo">
              <FiMail />
              <a href={`mailto:${company.email}`}>{company.email}</a>
            </div>
          </div>
          <div className="contactInfo">
            <FiPhone /> {company.phone_number}
          </div>
          <div className="moreInfo">
            <div className="infoItem">
              <CiBarcode /> Код продавца:{' '}
              <span className="card-section-companies-info">
                {company.seller_code}
              </span>
            </div>
            <div className="infoItem">
              <PiIdentificationCardThin /> ИНН:{' '}
              <span className="card-section-companies-info">{company.inn}</span>
            </div>
            <div className="infoItem">
              <PiTrademark /> Торговый бренд:{' '}
              <span className="card-section-companies-info">
                {company.trade_brand}
              </span>
            </div>
            <div className="infoItem">
              <IoManOutline /> Региональный менеджер:{' '}
              <span className="card-section-companies-info">
                {company.regional_manager_name}
              </span>
            </div>
            <div className="infoItem">
              <IoManOutline /> МПП:{' '}
              <span className="card-section-companies-info">
                {company.mpp_name}
              </span>
            </div>
            <div className="infoItem">
              <IoManOutline /> МПР:{' '}
              <span className="card-section-companies-info">
                {company.mpr_name}
              </span>
            </div>
            <div className="infoItem">
              <IoPeopleOutline /> Замещающий МПР:{' '}
              <span className="card-section-companies-info">
                {company.replacing_mpr_name}
              </span>
            </div>
            <div className="infoItem">
              <IoPeopleOutline /> Замещающий МПП:{' '}
              <span className="card-section-companies-info">
                {company.replacing_mpp_name}
              </span>
            </div>
            <div className="infoItem">
              <MdOutlineSettingsApplications /> Наличие АВ:{' '}
              <span className="card-section-companies-info">
                {company.has_availability ? 'Да' : 'Нет'}
              </span>
            </div>
            <div className="infoItem">
              <MdOutlineWarehouse /> Наличие склада:{' '}
              <span className="card-section-companies-info">
                {company.has_warehouse ? 'Да' : 'Нет'}
              </span>
            </div>
            <div className="infoItem">
              <IoDocumentTextOutline /> Отдел передачи документов:{' '}
              <span className="card-section-companies-info">
                {company.document_transfer_department}
              </span>
            </div>
            <div className="infoItem">
              <GoSingleSelect /> Самостоятельный клиент:{' '}
              <span className="card-section-companies-info">
                {company.is_self_service ? 'Да' : 'Нет'}
              </span>
            </div>
            <div className="infoItem">
              <BsCalendar2Date /> Значимые даты:{' '}
              <span className="card-section-companies-info">
                {company.important_dates || 'Нет значимых дат'}
              </span>
            </div>
            <div className="infoItem">
              <AiOutlineNotification /> Методы оповещения:{' '}
              <span className="card-section-companies-info">
                {company.notification_methods || 'Нет методов'}
              </span>
            </div>
            <div className="infoItem">
              <CiDeliveryTruck /> Условия доставки:{' '}
              <span className="card-section-companies-info">
                {company.delivery_terms || 'Нет условий'}
              </span>
            </div>
            <div className="infoItem">
              <PiTelegramLogoLight /> Социальные сети:{' '}
              <span className="card-section-companies-info">
                {company.social_networks || 'Нет социальных сетей'}
              </span>
            </div>
            <div className="infoItem">
              <LuForklift /> Подъем на этаж платно:{' '}
              <span className="card-section-companies-info">
                {company.floor_rising_status}
              </span>
            </div>
            <div className="infoItem">
              <MdOutlineAddBusiness /> Сопутствующая деятельность:{' '}
              <span className="card-section-companies-info">
                {company.activity_name || 'Нет сопутствующей деятельности'}
              </span>
            </div>
            <div className="infoItem">
              <RiContractLine /> Договор:{' '}
              <span className="card-section-companies-info">
                {company.contract_name || 'Нет договора'}
              </span>
            </div>
            <div className="infoItem">
              <SiLichess /> Конкуренты:{' '}
              <span className="card-section-companies-info">
                {company.competitors || 'Нет информации о конкурентах'}
              </span>
            </div>

            {/*  <div className="infoItem">
              Есть представительство:{' '}
              <span className="card-section-companies-info">
                {company.has_representation ? 'Да' : 'Нет'}
              </span>
            </div>*/}
          </div>
        </div>
      </div>
    </div>
  )
}

export default DealerInfo
//1
