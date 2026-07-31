import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { FaFolder, FaFileAlt, FaTimes } from 'react-icons/fa'
import { knowledgeBaseApi } from './knowledgeBaseApi'
import {
  buildKnowledgeHref,
  buildKnowledgeLinkLabel,
} from './knowledgeLinkUtils'
import './knowledgeBase.scss'

/**
 * Выбор документа/файла БЗ для вставки ссылки в описание задачи или проекта.
 */
const KnowledgeLinkPicker = ({ open, userId, onClose, onPick }) => {
  const [q, setQ] = useState('')
  const [qDebounced, setQDebounced] = useState('')
  const [loading, setLoading] = useState(false)
  const [documents, setDocuments] = useState([])
  const [expandedId, setExpandedId] = useState(null)
  const [expandedFiles, setExpandedFiles] = useState([])
  const [expandLoading, setExpandLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 280)
    return () => clearTimeout(t)
  }, [q])

  const load = useCallback(async () => {
    if (!open || !userId) return
    setLoading(true)
    setError('')
    try {
      const data = await knowledgeBaseApi.listDocuments(userId, {
        q: qDebounced || undefined,
      })
      setDocuments(data.documents || [])
    } catch (err) {
      setError(err.response?.data?.error || 'Не удалось загрузить базу знаний')
      setDocuments([])
    } finally {
      setLoading(false)
    }
  }, [open, userId, qDebounced])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!open) {
      setQ('')
      setExpandedId(null)
      setExpandedFiles([])
    }
  }, [open])

  const toggleFolder = async (doc) => {
    if (expandedId === doc.id) {
      setExpandedId(null)
      setExpandedFiles([])
      return
    }
    setExpandedId(doc.id)
    setExpandLoading(true)
    try {
      const full = await knowledgeBaseApi.getDocument(userId, doc.id)
      setExpandedFiles(Array.isArray(full?.files) ? full.files : [])
    } catch {
      setExpandedFiles([])
    } finally {
      setExpandLoading(false)
    }
  }

  const pick = (payload) => {
    if (typeof onPick === 'function') onPick(payload)
    if (typeof onClose === 'function') onClose()
  }

  const items = useMemo(() => documents, [documents])

  if (!open) return null

  return createPortal(
    <div className="kb-modal-overlay kb-modal-overlay--nested" role="presentation">
      <div className="kb-modal kb-modal--folder" role="dialog" aria-modal="true">
        <div className="kb-modal__header">
          <h2>Ссылка на базу знаний</h2>
          <button type="button" className="kb-btn kb-btn--ghost" onClick={onClose}>
            <FaTimes />
          </button>
        </div>
        <div style={{ padding: '0 16px 12px' }}>
          <input
            type="search"
            placeholder="Поиск по базе знаний…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '10px 12px',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              fontSize: 14,
            }}
          />
          <p style={{ margin: '8px 0 0', fontSize: 13, color: '#64748b' }}>
            Выберите документ или файл из папки — в описание вставится ссылка.
          </p>
        </div>
        <div className="kb-folder-files">
          {loading ? <p className="kb-folder-files__empty">Загрузка…</p> : null}
          {!loading && error ? (
            <p className="kb-folder-files__empty" style={{ color: '#b91c1c' }}>
              {error}
            </p>
          ) : null}
          {!loading && !error && !items.length ? (
            <p className="kb-folder-files__empty">Ничего не найдено</p>
          ) : null}
          {!loading && items.length ? (
            <ul>
              {items.map((doc) => {
                const isFolder =
                  Boolean(doc.isFolder) || Number(doc.filesCount) > 1
                return (
                  <li key={doc.id}>
                    <div className="kb-folder-files__main">
                      <strong>
                        {isFolder ? (
                          <FaFolder
                            className="kb-folder-icon"
                            style={{ marginRight: 8 }}
                          />
                        ) : (
                          <FaFileAlt style={{ marginRight: 8, opacity: 0.7 }} />
                        )}
                        {doc.title}
                      </strong>
                      <span>
                        {isFolder
                          ? `Папка · ${doc.filesCount || 0} файл.`
                          : doc.fileName || 'Документ'}
                      </span>
                    </div>
                    <div className="kb-folder-files__actions">
                      {isFolder ? (
                        <button
                          type="button"
                          className="kb-btn kb-btn--ghost"
                          onClick={() => toggleFolder(doc)}
                        >
                          {expandedId === doc.id ? 'Свернуть' : 'Файлы'}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="kb-btn kb-btn--primary"
                        onClick={() => {
                          const label = isFolder
                            ? `${doc.title} (папка)`
                            : buildKnowledgeLinkLabel({
                                title: doc.title,
                                fileName: doc.fileName,
                              })
                          pick({
                            documentId: doc.id,
                            fileId: null,
                            label,
                            href: buildKnowledgeHref({
                              documentId: doc.id,
                              label,
                            }),
                            isFolder,
                          })
                        }}
                      >
                        Выбрать
                      </button>
                    </div>
                    {expandedId === doc.id ? (
                      <div style={{ flexBasis: '100%', width: '100%', marginTop: 8 }}>
                        {expandLoading ? (
                          <span style={{ fontSize: 13, color: '#64748b' }}>
                            Загрузка файлов…
                          </span>
                        ) : (
                          <ul>
                            {(expandedFiles || []).map((file) => (
                              <li key={file.id || file.fileName}>
                                <div className="kb-folder-files__main">
                                  <strong>{file.fileName || 'Файл'}</strong>
                                </div>
                                <div className="kb-folder-files__actions">
                                  <button
                                    type="button"
                                    className="kb-btn kb-btn--primary"
                                    onClick={() => {
                                      const label = buildKnowledgeLinkLabel({
                                        title: doc.title,
                                        fileName: file.fileName,
                                      })
                                      pick({
                                        documentId: doc.id,
                                        fileId: file.id,
                                        label,
                                        href: buildKnowledgeHref({
                                          documentId: doc.id,
                                          fileId: file.id,
                                          label,
                                        }),
                                        isFolder: true,
                                      })
                                    }}
                                  >
                                    Выбрать
                                  </button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  )
}

export default KnowledgeLinkPicker
