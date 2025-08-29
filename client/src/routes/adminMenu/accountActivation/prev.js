import { useState, useEffect } from 'react'
import axios from 'axios'
import { CircularProgress } from '@mui/material'
import Toastify from 'toastify-js'
import EmployeeForm from './EmployeeForm'
import PhoneNumbersDialog from './PhoneNumbersDialog'
import Btn from '../../../components/btn/Btn' // Импортируем компонент Button
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material'
import './accountActivation.scss'

const columns = [
  { field: 'id', headerName: 'ID', width: 70 },
  { field: 'username', headerName: 'Username', width: 130 },
  { field: 'role_assigned', headerName: 'Активация', width: 130 },
  { field: 'email', headerName: 'Email', width: 190 },
  { field: 'first_name', headerName: 'Имя', width: 130 },
  { field: 'middle_name', headerName: 'Отчество', width: 130 },
  { field: 'last_name', headerName: 'Фамилия', width: 130 },
  { field: 'birth_date', headerName: 'Дата рождения', width: 130 },
  { field: 'gender', headerName: 'Пол', width: 90 },
  { field: 'role_id', headerName: 'Роль', width: 90 },
  { field: 'department_id', headerName: 'Отдел', width: 130 },
  { field: 'supervisor_id', headerName: 'Руководитель', width: 130 },
  { field: 'position_id', headerName: 'Должность', width: 130 },
  { field: 'email_token', headerName: 'Email Token', width: 130 },
]

function AccountActivation() {
  const [usersData, setUsersData] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [roles, setRoles] = useState([])
  const [departments, setDepartments] = useState([])
  const [positions, setPositions] = useState([])
  const [supervisors, setSupervisors] = useState([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [currentDelete, setCurrentDelete] = useState(null)
  const [refreshData, setRefreshData] = useState(false) // Состояние для триггера перезагрузки данных
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [phoneNumbersDialogOpen, setPhoneNumbersDialogOpen] = useState(false)
  useEffect(() => {
    const fetchUsersData = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/users')
        const usersDataWithFullName = response.data.map((user) => ({
          ...user,
          fullName: `${user.last_name} ${user.first_name} ${user.middle_name}`,
        }))
        setUsersData(usersDataWithFullName)

        // Загрузка списка руководителей
        const supervisorsResponse = await axios.get(
          'http://localhost:5000/api/users?role_id=2'
        )
        const supervisorsData = supervisorsResponse.data.map((supervisor) => ({
          ...supervisor,
          fullName: `${supervisor.last_name} ${supervisor.first_name} ${supervisor.middle_name}`,
        }))
        setSupervisors(supervisorsData)
      } catch (error) {
        console.error('Ошибка при получении данных пользователей:', error)
      } finally {
        setIsLoading(false)
      }
    }

    const fetchRoles = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/roles')
        setRoles(response.data)
      } catch (error) {
        console.error('Ошибка при получении данных ролей:', error)
      }
    }

    const fetchDepartments = async () => {
      try {
        const response = await axios.get(
          'http://localhost:5000/api/departments'
        )
        setDepartments(response.data)
      } catch (error) {
        console.error('Ошибка при получении данных отделов:', error)
      }
    }

    const fetchPositions = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/positions')
        setPositions(response.data)
      } catch (error) {
        console.error('Ошибка при получении данных должностей:', error)
      }
    }

    fetchUsersData()
    fetchRoles()
    fetchDepartments()
    fetchPositions()
  }, [refreshData])

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <CircularProgress
          className="progress"
          color="primary"
          size={50}
          variant="indeterminate"
        />
      </div>
    )
  }

  const handleViewPhones = (userId) => {
    setSelectedUserId(userId)
    setPhoneNumbersDialogOpen(true)
  }

  const handlePhoneNumbersDialogClose = () => {
    setPhoneNumbersDialogOpen(false)
    setSelectedUserId(null)
  }
  const handleInputChange = (e, userId, field) => {
    const { value, type, checked } = e.target
    setUsersData((prevData) =>
      prevData.map((user) =>
        user.id === userId
          ? { ...user, [field]: type === 'checkbox' ? checked : value }
          : user
      )
    )
  }

  const handleSave = (userId) => {
    const user = usersData.find((user) => user.id === userId)
    const { role_name, fullName, ...userWithoutRoleName } = user

    const token = localStorage.getItem('token')
    axios
      .put(`http://localhost:5000/api/users/${userId}`, userWithoutRoleName, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      .then(() => {
        Toastify({
          text: 'Данные пользователя обновлены',
          close: true,
          style: {
            background: 'linear-gradient(to right, #00b09b, #96c93d)',
          },
        }).showToast()
        setRefreshData(!refreshData)
      })
      .catch((error) => {
        console.error('Ошибка при обновлении данных пользователя:', error)
        Toastify({
          text: 'Ошибка обновления данных',
          close: true,
          style: {
            background: 'linear-gradient(to right, #ff7e79, #ff1e00)',
          },
        }).showToast()
      })
  }

  const handleDelete = (userId) => {
    const user = usersData.find((user) => user.id === userId)
    setCurrentDelete(user)
    setDialogOpen(true)
  }

  const handleDialogDelete = () => {
    const userId = currentDelete.id
    const token = localStorage.getItem('token')
    axios
      .delete(`http://localhost:5000/api/users/delete/${userId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      .then(() => {
        setUsersData((prevData) =>
          prevData.filter((user) => user.id !== userId)
        )
        Toastify({
          text: `Сотрудник ${currentDelete.fullName} удален`,
          close: true,
          style: {
            background: 'linear-gradient(to right, #00b09b, #96c93d)',
          },
        }).showToast()
        setDialogOpen(false) // Закрываем диалоговое окно после успешного удаления
      })
      .catch((error) => {
        console.error('Ошибка при удалении сотрудника:', error)
        Toastify({
          text: `Ошибка удаления сотрудника ${currentDelete.fullName}: ${error}`,
          close: true,
          style: {
            background: 'linear-gradient(to right, #ff7e79, #ff1e00)',
          },
        }).showToast()
        setDialogOpen(false) // Закрываем диалоговое окно при ошибке удаления
      })
  }
  const handleDialogClose = () => {
    setDialogOpen(false)
  }
  const checkRowForDash = (user) => {
    return (
      Object.values(user).some(
        (value) => value === null || value === '' || value === false
      ) || !user.role_assigned
    )
  }

  function formatDate(isoString) {
    if (!isoString) return '-'
    const date = new Date(isoString)
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const year = date.getFullYear()
    return `${day}.${month}.${year}`
  }

  return (
    <div className="AccountActivation">
      <EmployeeForm setRefreshData={setRefreshData} refreshData={refreshData} />
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.field} style={{ width: column.width }}>
                {column.headerName}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {usersData.map((user) => (
            <tr
              key={user.id}
              className={user.role_assigned ? 'onactivation' : 'notactivation'}
            >
              {columns.map((column) => {
                const isBirthDateColumn = column.field === 'birth_date'
                const displayValue =
                  isBirthDateColumn && user[column.field]
                    ? formatDate(user[column.field])
                    : user[column.field] !== null &&
                      user[column.field] !== undefined
                    ? user[column.field].toString()
                    : '-'

                return (
                  <td
                    key={column.field}
                    className={
                      checkRowForDash(user) ? 'notactivation' : 'onactivation'
                    }
                  >
                    {column.field === 'gender' ? (
                      <select
                        value={user.gender || ''} // Установите значение для выбора
                        onChange={(e) =>
                          handleInputChange(e, user.id, column.field)
                        }
                      >
                        <option value="">Выберите пол</option>
                        <option value="Муж">Муж.</option>
                        <option value="Жен">Жен.</option>
                      </select>
                    ) : column.field === 'role_assigned' ? (
                      <input
                        type="checkbox"
                        checked={!!user[column.field]}
                        onChange={(e) =>
                          handleInputChange(e, user.id, column.field)
                        }
                        data-field={column.field}
                        data-id={user.id}
                      />
                    ) : column.field === 'role_id' ? (
                      <select
                        value={user.role_id || ''}
                        onChange={(e) =>
                          handleInputChange(e, user.id, column.field)
                        }
                      >
                        {roles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                    ) : column.field === 'department_id' ? (
                      <select
                        value={user.department_id || ''}
                        onChange={(e) =>
                          handleInputChange(e, user.id, column.field)
                        }
                      >
                        {departments.map((dept) => (
                          <option key={dept.id} value={dept.id}>
                            {dept.name}
                          </option>
                        ))}
                      </select>
                    ) : column.field === 'position_id' ? (
                      <select
                        value={user.position_id || ''}
                        onChange={(e) =>
                          handleInputChange(e, user.id, column.field)
                        }
                      >
                        {positions.map((position) => (
                          <option key={position.id} value={position.id}>
                            {position.name}
                          </option>
                        ))}
                      </select>
                    ) : column.field === 'supervisor_id' ? (
                      <select
                        value={user.supervisor_id || ''}
                        onChange={(e) =>
                          handleInputChange(e, user.id, column.field)
                        }
                      >
                        <option value="">Выберите руководителя</option>
                        {supervisors.map((supervisor) => (
                          <option key={supervisor.id} value={supervisor.id}>
                            {supervisor.fullName}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={displayValue}
                        onChange={(e) =>
                          handleInputChange(e, user.id, column.field)
                        }
                        data-field={column.field}
                        data-id={user.id}
                      />
                    )}
                  </td>
                )
              })}

              <td className="flexbtn">
                <Btn
                  color={'royalblue'}
                  text="Телефоны"
                  onClick={() => handleViewPhones(user.id)}
                />
                <Btn text="Сохранить" onClick={() => handleSave(user.id)} />
                <Btn
                  text="Удалить"
                  onClick={() => handleDelete(user.id)}
                  color="#dc3545" // Красный цвет для кнопки удаления
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Dialog
        open={dialogOpen}
        onClose={handleDialogClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
          Подтверждение удаления
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            Вы уверены, что хотите удалить{' '}
            {currentDelete && currentDelete.fullName}?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Btn text="Отмена" onClick={handleDialogClose} />
          <Btn text="Удалить" onClick={handleDialogDelete} color="#dc3545" />
        </DialogActions>
      </Dialog>

      <PhoneNumbersDialog
        open={phoneNumbersDialogOpen}
        onClose={handlePhoneNumbersDialogClose}
        userId={selectedUserId}
      />
    </div>
  )
}

export default AccountActivation









/**  import { useState, useEffect } from 'react';
import axios from 'axios';
import Toastify from 'toastify-js';
import EmployeeForm from './EmployeeForm';
import ConfirmationDialog from '../../../components/confirmationDialog/ConfirmationDialog';
import PhoneNumbersDialog from './PhoneNumbersDialog';
import Btn from '../../../components/btn/Btn';
import { API_BASE_URL } from '../../../../config';
import './accountActivation.scss';
import SearchBar from '../../../components/searchBar/SearchBar';
 

function AccountActivation() {
  const [usersData, setUsersData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentDelete, setCurrentDelete] = useState(null);
  const [refreshData, setRefreshData] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [phoneNumbersDialogOpen, setPhoneNumbersDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}5000/api/users`);
        const usersDataWithFullName = response.data.map((user) => ({
          ...user,
          fullName: `${user.last_name} ${user.first_name} ${user.middle_name}`,
        }));
        setUsersData(usersDataWithFullName);

        const [
          rolesResponse,
          departmentsResponse,
          positionsResponse,
          supervisorsResponse,
        ] = await Promise.all([
          axios.get(`${API_BASE_URL}5000/api/roles`),
          axios.get(`${API_BASE_URL}5000/api/departments`),
          axios.get(`${API_BASE_URL}5000/api/positions`),
          axios.get(`${API_BASE_URL}5000/api/users?role_id=2`),
        ]);

        setRoles(rolesResponse.data);
        setDepartments(departmentsResponse.data);
        setPositions(positionsResponse.data);
        const supervisorsData = supervisorsResponse.data.map((supervisor) => ({
          ...supervisor,
          fullName: `${supervisor.last_name} ${supervisor.first_name} ${supervisor.middle_name}`,
        }));
        setSupervisors(supervisorsData);
      } catch (error) {
        console.error('Ошибка при получении данных:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [refreshData]);

  const filteredUsersData = usersData.filter((user) => {
    const searchLowerCase = searchTerm.toLowerCase();
    return (
      user.fullName.toLowerCase().includes(searchLowerCase) ||
      user.email.toLowerCase().includes(searchLowerCase) ||
      (user.role && user.role.name.toLowerCase().includes(searchLowerCase)) ||
      (user.department && user.department.name.toLowerCase().includes(searchLowerCase))
    );
  });

  if (isLoading) {
    return (
      <div className="loading-container">
        <p>Загрузка...</p>
      </div>
    );
  }

  const handleViewPhones = (userId) => {
    setSelectedUserId(userId);
    setPhoneNumbersDialogOpen(true);
  };

  const handlePhoneNumbersDialogClose = () => {
    setPhoneNumbersDialogOpen(false);
    setSelectedUserId(null);
  };

  const handleInputChange = (e, userId, field) => {
    const { value, type, checked } = e.target;
    setUsersData((prevData) =>
      prevData.map((user) =>
        user.id === userId
          ? { ...user, [field]: type === 'checkbox' ? checked : value }
          : user
      )
    );
  };

  const handleSave = (userId) => {
    const user = usersData.find((user) => user.id === userId);
    const { fullName, ...userWithoutFullName } = user;

    const token = localStorage.getItem('token');
    axios
      .put(`${API_BASE_URL}5000/api/users/${userId}`, userWithoutFullName, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      .then(() => {
        Toastify({
          text: 'Данные пользователя обновлены',
          close: true,
          style: {
            background: 'linear-gradient(to right, #00b09b, #96c93d)',
          },
        }).showToast();
        setRefreshData(!refreshData);
      })
      .catch((error) => {
        console.error('Ошибка при обновлении данных пользователя:', error);
        Toastify({
          text: 'Ошибка обновления данных',
          close: true,
          style: {
            background: 'linear-gradient(to right, #ff7e79, #ff1e00)',
          },
        }).showToast();
      });
  };

  const handleDelete = (userId) => {
    const user = usersData.find((user) => user.id === userId);
    setCurrentDelete(user);
    setDialogOpen(true);
  };

  const handleDialogDelete = () => {
    const userId = currentDelete.id;
    const token = localStorage.getItem('token');
    axios
      .delete(`${API_BASE_URL}5000/api/users/delete/${userId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      .then(() => {
        setUsersData((prevData) =>
          prevData.filter((user) => user.id !== userId)
        );
        Toastify({
          text: `Сотрудник ${currentDelete.fullName} удален`,
          close: true,
          style: {
            background: 'linear-gradient(to right, #00b09b, #96c93d)',
          },
        }).showToast();
        setDialogOpen(false);
      })
      .catch((error) => {
        console.error('Ошибка при удалении сотрудника:', error);
        Toastify({
          text: `Ошибка удаления сотрудника ${currentDelete.fullName}: ${error}`,
          close: true,
          style: {
            background: 'linear-gradient(to right, #ff7e79, #ff1e00)',
          },
        }).showToast();
        setDialogOpen(false);
      });
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
  };

  const formatDate = (isoString) => {
    if (!isoString) return '-'
    const date = new Date(isoString)
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const year = date.getFullYear()
    return `${day}.${month}.${year}`
  }

  return (
    <>
      <div className="searchAccount">
        <SearchBar
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          placeholder="Поиск ..."
        />
      </div>

      <div className="AccountActivation">
        <EmployeeForm setRefreshData={setRefreshData} refreshData={refreshData} />

        <div className="card-container">
          {filteredUsersData.map((user) => (
            <div key={user.id} className={`user-card`}>
              <div className="card-content">
                <h6>ID: {user.id}</h6>
                <p>Фамилия: {" "}
                  <input
                    type="text"
                    value={user.last_name || ''}
                    onChange={(e) => handleInputChange(e, user.id, 'last_name')}
                  />
                </p>
                <p>Имя: {" "}
                  <input
                    type="text"
                    value={user.first_name || ''}
                    onChange={(e) => handleInputChange(e, user.id, 'first_name')}
                  />
                </p>
                <p>Отчество: {" "}
                  <input
                    type="text"
                    value={user.middle_name || ''}
                    onChange={(e) => handleInputChange(e, user.id, 'middle_name')}
                  />
                </p>
                <p>Пол:
                  <select
                    value={user.gender || ''}
                    onChange={(e) => handleInputChange(e, user.id, 'gender')}
                  >
                    <option value="">Выберите пол</option>
                    <option value="Муж">Муж.</option>
                    <option value="Жен">Жен.</option>
                  </select>
                </p>
                <p>Email: {user.email || ''}</p>
                <p>Дата рождения: { formatDate(user.birth_date) || ''}
               
                  <div> <input
                    type="date" 
                    onChange={(e) => handleInputChange(e, user.id, 'birth_date')}
                  /></div>
                 
                </p>
                <p>Роль:
                  <select
                    value={user.role_id || ''}
                    onChange={(e) => handleInputChange(e, user.id, 'role_id')}
                  >
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </p>
                <p>Отдел:
                  <select
                    value={user.department_id || ''}
                    onChange={(e) => handleInputChange(e, user.id, 'department_id')}
                  >
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </p>
                <p>Должность:
                  <select
                    value={user.position_id || ''}
                    onChange={(e) => handleInputChange(e, user.id, 'position_id')}
                  >
                    {positions.map((position) => (
                      <option key={position.id} value={position.id}>
                        {position.name}
                      </option>
                    ))}
                  </select>
                </p>
                <p>Руководитель:
                  <select
                    value={user.supervisor_id || ''}
                    onChange={(e) => handleInputChange(e, user.id, 'supervisor_id')}
                  >
                    <option value="">Выберите руководителя</option>
                    {supervisors.map((supervisor) => (
                      <option key={supervisor.id} value={supervisor.id}>
                        {supervisor.fullName}
                      </option>
                    ))}
                  </select>
                </p>
                <p>
                  <span
                    className={`activation-indicator ${user.role_assigned ? 'active' : 'inactive'}`}
                  >
                  </span>
                  Активация: <span> </span>
                  <input
                    type="checkbox"
                    checked={!!user.role_assigned}
                    onChange={(e) => handleInputChange(e, user.id, 'role_assigned')}
                  />
                </p>
              </div>
              <div className="card-actions">
                <Btn color={'royalblue'} text="Телефоны" onClick={() => handleViewPhones(user.id)} />
                <Btn text="Сохранить" onClick={() => handleSave(user.id)} />
                <Btn text="Удалить" onClick={() => handleDelete(user.id)} color="#dc3545" />
              </div>
            </div>
          ))}
        </div>
        <ConfirmationDialog
          open={dialogOpen}
          onClose={handleDialogClose}
          onConfirm={handleDialogDelete}
          title="Подтверждение удаления"
          message={`Вы уверены, что хотите удалить ${
            currentDelete && currentDelete.fullName
          }?`}
          btn1="Отмена"
          btn2="Удалить"
        />
        <PhoneNumbersDialog
          open={phoneNumbersDialogOpen}
          onClose={handlePhoneNumbersDialogClose}
          userId={selectedUserId}
        />
      </div>
    </>
  );
}

export default AccountActivation;

