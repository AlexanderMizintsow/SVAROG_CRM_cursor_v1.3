import { useState } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../../../../../config'
import useUserStore from '../../../../store/userStore'
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa'
import FinalSolutionModal from './FinalSolutionModal'
import './FinalSolutionsBlock.scss'

function formatDateTime(str) {
  if (!str) return ''
  const d = new Date(str)
  if (isNaN(d.getTime())) return str
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const FinalSolutionsBlock = ({
  solutions,
  globalTaskId,
  onRefresh,
  isReadOnly,
}) => {
  const { user } = useUserStore()
  const userId = user?.id
  const list = Array.isArray(solutions) ? solutions : []
  const [currentPage, setCurrentPage] = useState(1)
  const [modal, setModal] = useState({ open: false, mode: 'add', solution: null })

  const totalPages = Math.max(1, list.length)
  const currentIndex = Math.min(currentPage - 1, list.length - 1)
  const currentSolution = list[currentIndex] || null

  const isEdited = (s) => {
    if (!s?.updated_at || !s?.created_at) return false
    return new Date(s.updated_at).getTime() > new Date(s.created_at).getTime()
  }

  const canEdit = (s) => !isReadOnly && userId != null && String(s?.user_id) === String(userId)

  const handleDelete = async (solutionId) => {
    if (!window.confirm('Удалить это итоговое решение?')) return
    try {
      await axios.delete(
        `${API_BASE_URL}5000/api/global-tasks/${globalTaskId}/final-solutions/${solutionId}`,
        { data: { userId } }
      )
      onRefresh?.(globalTaskId)
      setCurrentPage((p) => Math.max(1, Math.min(p, totalPages - 1)))
    } catch (err) {
      console.error('Ошибка удаления итогового решения:', err)
      alert(err.response?.data?.error || 'Не удалось удалить')
    }
  }

  const handleSaved = () => {
    onRefresh?.(globalTaskId)
  }

  if (list.length === 0) return null

  return (
    <div className="final-solutions-block">
      <h3 className="final-solutions-block__title">Итоговые решения</h3>
      <div className="final-solutions-block__card">
        {currentSolution && (
          <>
            <div className="final-solutions-block__content">
              {currentSolution.content}
            </div>
            <div className="final-solutions-block__meta">
              <span className="final-solutions-block__author">
                {currentSolution.author_name || 'Участник'}
              </span>
              {isEdited(currentSolution) && (
                <span className="final-solutions-block__edited">
                  отредактировано {formatDateTime(currentSolution.updated_at)}
                </span>
              )}
            </div>
            {!isReadOnly && canEdit(currentSolution) && (
              <div className="final-solutions-block__actions">
                <button
                  type="button"
                  className="final-solutions-block__action-btn final-solutions-block__action-btn--edit"
                  onClick={() =>
                    setModal({
                      open: true,
                      mode: 'edit',
                      solution: currentSolution,
                    })
                  }
                >
                  Редактировать
                </button>
                <button
                  type="button"
                  className="final-solutions-block__action-btn final-solutions-block__action-btn--delete"
                  onClick={() => handleDelete(currentSolution.id)}
                >
                  Удалить
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {totalPages > 1 && (
        <div className="final-solutions-block__pagination">
          <button
            type="button"
            className="final-solutions-block__page-arrow"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
          >
            <FaChevronLeft />
          </button>
          <div className="final-solutions-block__page-numbers">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => (
              <button
                key={num}
                type="button"
                className={`final-solutions-block__page-num ${
                  currentPage === num ? 'final-solutions-block__page-num--active' : ''
                }`}
                onClick={() => setCurrentPage(num)}
              >
                {num}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="final-solutions-block__page-arrow"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
          >
            <FaChevronRight />
          </button>
        </div>
      )}

      {modal.open && (
        <FinalSolutionModal
          globalTaskId={globalTaskId}
          mode={modal.mode}
          initialContent={modal.solution?.content}
          solutionId={modal.solution?.id}
          onClose={() => setModal({ open: false, mode: 'add', solution: null })}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}

export default FinalSolutionsBlock
