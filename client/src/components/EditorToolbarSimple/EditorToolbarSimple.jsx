// Упрощенный EditorToolbar без Material UI
// Для маркетинговых кампаний - упрощенная версия для Telegram
const EditorToolbarSimple = ({ editor, isTelegramMode = false }) => {
  if (!editor) return null

  // Упрощенная версия для Telegram - только базовое форматирование
  if (isTelegramMode) {
    return (
      <div className="editor-toolbar-simple">
        <button
          type="button"
          className={`editor-toolbar-simple__btn ${editor.isActive('bold') ? 'active' : ''}`}
          onMouseDown={(e) => {
            e.preventDefault()
            editor.chain().focus().toggleBold().run()
          }}
          title="Жирный текст (*текст*)"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          className={`editor-toolbar-simple__btn ${editor.isActive('italic') ? 'active' : ''}`}
          onMouseDown={(e) => {
            e.preventDefault()
            editor.chain().focus().toggleItalic().run()
          }}
          title="Курсив (_текст_)"
        >
          <em>I</em>
        </button>
      </div>
    )
  }

  // Полная версия для других случаев
  return (
    <div className="editor-toolbar-simple">
      <button
        type="button"
        className={`editor-toolbar-simple__btn ${
          editor.isActive('heading', { level: 1 }) ? 'active' : ''
        }`}
        onMouseDown={(e) => {
          e.preventDefault()
          editor.chain().focus().toggleHeading({ level: 1 }).run()
        }}
      >
        H1
      </button>
      <button
        type="button"
        className={`editor-toolbar-simple__btn ${
          editor.isActive('heading', { level: 2 }) ? 'active' : ''
        }`}
        onMouseDown={(e) => {
          e.preventDefault()
          editor.chain().focus().toggleHeading({ level: 2 }).run()
        }}
      >
        H2
      </button>
      <button
        type="button"
        className={`editor-toolbar-simple__btn ${editor.isActive('bold') ? 'active' : ''}`}
        onMouseDown={(e) => {
          e.preventDefault()
          editor.chain().focus().toggleBold().run()
        }}
      >
        <strong>B</strong>
      </button>
      <button
        type="button"
        className={`editor-toolbar-simple__btn ${editor.isActive('italic') ? 'active' : ''}`}
        onMouseDown={(e) => {
          e.preventDefault()
          editor.chain().focus().toggleItalic().run()
        }}
      >
        <em>I</em>
      </button>
      <button
        type="button"
        className={`editor-toolbar-simple__btn ${editor.isActive('bulletList') ? 'active' : ''}`}
        onMouseDown={(e) => {
          e.preventDefault()
          editor.chain().focus().toggleBulletList().run()
        }}
      >
        •
      </button>
      <button
        type="button"
        className={`editor-toolbar-simple__btn ${editor.isActive('orderedList') ? 'active' : ''}`}
        onMouseDown={(e) => {
          e.preventDefault()
          editor.chain().focus().toggleOrderedList().run()
        }}
      >
        1.
      </button>
    </div>
  )
}

export default EditorToolbarSimple
