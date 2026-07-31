import { Stack, Button } from '@mui/material'

const EditorToolbar = ({ editor, onKnowledgeLinkClick }) => {
  if (!editor) return null

  return (
    <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
      <Button
        size="small"
        variant={editor.isActive('heading', { level: 1 }) ? 'contained' : 'outlined'}
        onMouseDown={(e) => {
          e.preventDefault()
          editor.chain().focus().toggleHeading({ level: 1 }).run()
        }}
      >
        H1
      </Button>
      <Button
        size="small"
        variant={editor.isActive('heading', { level: 2 }) ? 'contained' : 'outlined'}
        onMouseDown={(e) => {
          e.preventDefault()
          editor.chain().focus().toggleHeading({ level: 2 }).run()
        }}
      >
        H2
      </Button>
      <Button
        size="small"
        variant={editor.isActive('bold') ? 'contained' : 'outlined'}
        onMouseDown={(e) => {
          e.preventDefault()
          editor.chain().focus().toggleBold().run()
        }}
      >
        B
      </Button>
      <Button
        size="small"
        variant={editor.isActive('italic') ? 'contained' : 'outlined'}
        onMouseDown={(e) => {
          e.preventDefault()
          editor.chain().focus().toggleItalic().run()
        }}
      >
        I
      </Button>
      <Button
        size="small"
        variant={editor.isActive('underline') ? 'contained' : 'outlined'}
        onMouseDown={(e) => {
          e.preventDefault()
          editor.chain().focus().toggleUnderline().run()
        }}
      >
        U
      </Button>
      <Button
        size="small"
        variant={editor.isActive('bulletList') ? 'contained' : 'outlined'}
        onMouseDown={(e) => {
          e.preventDefault()
          editor.chain().focus().toggleBulletList().run()
        }}
      >
        • List
      </Button>
      <Button
        size="small"
        variant={editor.isActive('orderedList') ? 'contained' : 'outlined'}
        onMouseDown={(e) => {
          e.preventDefault()
          editor.chain().focus().toggleOrderedList().run()
        }}
      >
        Number
      </Button>
      {typeof onKnowledgeLinkClick === 'function' ? (
        <Button
          size="small"
          variant="outlined"
          title="Ссылка на базу знаний"
          onMouseDown={(e) => {
            e.preventDefault()
            onKnowledgeLinkClick()
          }}
        >
          БЗ
        </Button>
      ) : null}
    </Stack>
  )
}

export default EditorToolbar
