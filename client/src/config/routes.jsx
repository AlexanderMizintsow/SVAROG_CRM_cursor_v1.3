// src/routes/router.js
import { createBrowserRouter } from 'react-router-dom'
import Layout from '../routes/layout/Layout.jsx'
import NotFound from '../components/notFound/NotFound.jsx'
import AccountActivation from '../routes/adminMenu/accountActivation/AccountActivation.jsx'
import DataEntryComponent from '../routes/adminMenu/dataEntryComponent/DataEntryComponent.jsx'
import PermissionsManager from '../routes/adminMenu/permissionsManager/PermissionsManager.jsx'
import CompanyPassword from '../routes/adminMenu/companyPassword/companyPassword.jsx'
import Boards from '../routes/kanbanBoard/Boards/Boards.jsx'
import WorkGroup from '../routes/workGroup/WorkGroup.jsx'
import InboxMail from '../routes/mail/InboxMail.jsx'
import ComposeMail from '../routes/mail/ComposeMail.jsx'
import DealersData from '../routes/adminMenu/dealersData/DealersData.jsx'
import ProcessedCalls from '../routes/asterisk/processedCalls/ProcessedCalls.jsx'
import AcceptedCalls from '../routes/asterisk/acceptedCalls/AcceptedCalls.jsx'
import CallsSettingsUsers from '../routes/asterisk/callsSettingsUsers/CallsSettingsUsers.jsx'
import CompetitorForm from '../routes/CompetitorForm/CompetitorForm.jsx'
import HierarchyTreeEmployee from '../routes/references/hierarchy/HierarchyTreeEmployee.jsx'
import LeaveCalendar from '../routes/personnelDepartment/calendar/LeaveCalendar.jsx'
import DealerMap from '../routes/references/dealerMap/DealerMap.jsx'
import UpdatesApp from '../routes/updates/Changelog.jsx'
import MissedCall from '../routes/asterisk/missedCall/MissedCall.jsx'
import { Mail } from '@mui/icons-material'
import RatingStats from '../components/RatingStats/RatingStats.jsx'

const routes = (bgSeason, roleAdministrator, isConnectBD) => [
  {
    path: '/',
    element: <Layout isConnectBD={isConnectBD} />,
    errorElement: <NotFound />,
    children: [
      {
        path: 'add-employees',
        element: roleAdministrator ? <AccountActivation /> : <NotFound />,
      },
      {
        path: 'add-data',
        element: roleAdministrator ? <DataEntryComponent /> : <NotFound />,
      },
      {
        path: 'permissions-manager',
        element: roleAdministrator ? <PermissionsManager /> : <NotFound />,
      },
      { path: 'password-company', element: <CompanyPassword /> },

      {
        path: 'task-manager',
        element: (
          <div
            style={{
              overflowY: 'auto',
              height: '100%',
              backgroundImage: `url(${bgSeason})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <Boards />
          </div>
        ),
      },
      { path: 'work-groups', element: <WorkGroup /> },
      // Приложения
      /* {
        path: 'application-mail',
        element: <Mail />,
        children: [
          { index: true, path: 'inbox', element: <InboxMail /> },
          { path: 'send', element: <ComposeMail /> },
        ],
      },*/

      // Телефония звонки ***
      { path: 'add-dealers', element: <DealersData /> },

      {
        path: '/notifications-asterisk-missed-calls',
        element: <MissedCall />,
      },
      {
        path: '/notifications-asterisk-processed-calls',
        element: <ProcessedCalls />,
      },
      {
        path: '/notifications-asterisk-accepted-calls',
        element: <AcceptedCalls />,
      },
      {
        path: '/notifications-asterisk-calls-settings',
        element: <CallsSettingsUsers />,
      },
      { path: 'add-competitor', element: <CompetitorForm /> },

      { path: 'reports-dealer-ratings', element: <RatingStats /> },

      // ***
      // Отдел кадров
      {
        path: '/personnel-department-calendar',
        element: <LeaveCalendar />,
      },
      // СПРАВОЧНИКИ
      // Иеархия сотрудников
      {
        path: '/hierarchy-tree-employee',
        element: <HierarchyTreeEmployee />,
      },
      // карта дилеров
      {
        path: '/map-dealers',
        element: <DealerMap />,
      },

      //***
      {
        path: '/changelog',
        element: <UpdatesApp />,
      },
    ],
  },
]

export const createRouter = (bgSeason, roleAdministrator, isConnectBD) => {
  return createBrowserRouter(routes(bgSeason, roleAdministrator, isConnectBD))
}
