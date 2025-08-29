import Menu from "./Menu";
import useUserStore from "../../store/userStore";
import useCallNotifications from "../../hooks/useCallNotifications";
import CallStatusIndicator from "../CallStatusIndicator/CallStatusIndicator";
import { MdWork } from "react-icons/md";
import { FaKey, FaUserFriends } from "react-icons/fa";
import { FaRegMessage } from "react-icons/fa6";
import { SiMaildotru } from "react-icons/si";
import { CiDatabase } from "react-icons/ci";
import { DiAsterisk } from "react-icons/di";
import { MdPhoneMissed } from "react-icons/md";
import { GrTest } from "react-icons/gr";
import { SlCallIn } from "react-icons/sl";
import { BsTelephonePlus } from "react-icons/bs";
import { FiSettings } from "react-icons/fi";
import { GiPalmTree } from "react-icons/gi";
import { FaTasks } from "react-icons/fa";
import { GiTeamIdea, GiSwordwoman } from "react-icons/gi";
import { VscTypeHierarchySub } from "react-icons/vsc";
import { HiOutlineChatBubbleLeftRight } from "react-icons/hi2";
import { PiMapPinAreaLight } from "react-icons/pi";
import { PiTelegramLogoLight } from "react-icons/pi";
import { IoStarSharp } from "react-icons/io5";
import { PiLockKeyOpenFill } from "react-icons/pi";
import { TbApps } from "react-icons/tb";

const NavBar = () => {
  const { user } = useUserStore();
  const { isConnected, currentCall } = useCallNotifications();
  const roleAdministrator = user?.role_name === "Администратор" ? true : false;
  const roleConfirm =
    user &&
    ["Администратор", "Директор", "Руководитель отдела"].includes(
      user?.role_name
    );

  const mainPortal = [
    {
      name: "Менеджер задач",
      icon: FaTasks,
      link: "/task-manager",
    },
  ];
  const mainManager = [
    {
      name: "Менеджер задач",
      icon: FaTasks,
      link: "/task-manager",
    },
    {
      name: "Рабочие группы",
      icon: GiTeamIdea,
      link: "/work-groups",
    },
  ];

  const adminMenuItems = [
    {
      name: "Сотрудники",
      icon: MdWork,
      subMenuItems: [
        {
          name: "Активация аккаунтов",
          icon: FaKey,
          link: "/add-employees",
        },

        {
          name: "Установка данных",
          icon: CiDatabase,
          link: "/add-data",
        },

        {
          name: "Управление правами доступа",
          icon: PiLockKeyOpenFill,
          link: "/permissions-manager",
        },
      ],
    },
  ];

  const applicationMenuItems = [
    {
      name: "Приложения",
      icon: TbApps,
      subMenuItems: [
        {
          name: "Почта (mail.ru)",
          icon: SiMaildotru,
          link: "/application-mail",
        },
        {
          name: "Чат",
          icon: HiOutlineChatBubbleLeftRight,
          link: "/messenger",
        },
      ],
    },
  ];

  const Notifications = [
    {
      name: "Дилеры",
      icon: FaUserFriends,
      link: "/add-dealers",
    },
    {
      name: "Управление доступом дилеров",
      icon: PiTelegramLogoLight,
      link: "/password-company",
    },
    {
      name: "Телефония (asterisk)",
      icon: DiAsterisk,
      subMenuItems: [
        {
          name: "Пропущенные звонки",
          icon: MdPhoneMissed,
          link: "/notifications-asterisk-missed-calls",
        },
        {
          name: "Обработанные звонки",
          icon: BsTelephonePlus,
          link: "/notifications-asterisk-processed-calls",
        },
        {
          name: "Принятые звонки",
          icon: SlCallIn,
          link: "/notifications-asterisk-accepted-calls",
        },
        {
          name: "Настройки",
          icon: FiSettings,
          link: "/notifications-asterisk-calls-settings",
        },
      ],
    },
    {
      name: "Конкуренты",
      icon: GiSwordwoman,
      link: "/add-competitor",
    },
    {
      name: "Сервисные рейтинги",
      icon: IoStarSharp,
      link: "/reports-dealer-ratings",
    },
  ];

  const personnelDepartment = [
    {
      name: "Статусы сотрудников",
      icon: GiPalmTree,
      link: "/personnel-department-calendar",
    },
  ];

  const references = [
    {
      name: "Иерархия сотрудников",
      icon: VscTypeHierarchySub,
      link: "/hierarchy-tree-employee",
    },
    /* {
      name: 'Карта',
      icon: PiMapPinAreaLight,
      link: '/map-dealers',
    },*/
  ];

  return (
    <nav>
      <Menu title="МЕНЮ" menuItems={mainManager} />

      {roleAdministrator && (
        <Menu title="Администратор" menuItems={adminMenuItems} />
      )}
      {/*<Menu title="Связь" menuItems={applicationMenuItems} />*/}
      <Menu title="CRM" menuItems={Notifications} />
      {roleConfirm && (
        <Menu
          title="Администрирование персонала"
          menuItems={personnelDepartment}
        />
      )}
      <Menu title="Справочники" menuItems={references} />

      {/* Индикатор статуса звонков */}
      <div
        style={{
          position: "fixed",
          bottom: "20px",
          right: "20px",
          zIndex: 1000,
        }}
      >
        <CallStatusIndicator
          isConnected={isConnected}
          currentCall={currentCall}
        />
      </div>
    </nav>
  );
};

export default NavBar;
