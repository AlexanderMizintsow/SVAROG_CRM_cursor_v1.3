const fs = require('fs')
const path = require('path')

const APK_FILE_NAME = 'poz-staff.apk'
const META_FILE_NAME = 'poz-staff.meta.json'
const ADMIN_ROLE_NAME = 'Администратор'

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

const getPaths = (uploadsRoot) => {
  const dir = path.join(uploadsRoot, 'mobile-app')
  ensureDir(dir)
  return {
    dir,
    apkPath: path.join(dir, APK_FILE_NAME),
    metaPath: path.join(dir, META_FILE_NAME),
  }
}

const readMeta = (metaPath) => {
  try {
    if (!fs.existsSync(metaPath)) return null
    return JSON.parse(fs.readFileSync(metaPath, 'utf8'))
  } catch {
    return null
  }
}

const writeMeta = (metaPath, meta) => {
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8')
}

const isAdminUser = async (dbPool, userId) => {
  const id = Number(userId)
  if (!Number.isFinite(id) || id <= 0) return false
  const result = await dbPool.query(
    `SELECT r.name AS role_name
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.id = $1`,
    [id]
  )
  return result.rows[0]?.role_name === ADMIN_ROLE_NAME
}

const looksLikeApk = (filePath, originalName = '', mimeType = '') => {
  const name = String(originalName || '').toLowerCase()
  if (!name.endsWith('.apk')) return false

  const mime = String(mimeType || '').toLowerCase()
  const mimeOk =
    !mime ||
    mime.includes('android.package') ||
    mime === 'application/octet-stream' ||
    mime === 'application/zip' ||
    mime === 'application/java-archive'

  if (!mimeOk) return false

  try {
    const fd = fs.openSync(filePath, 'r')
    const buf = Buffer.alloc(4)
    fs.readSync(fd, buf, 0, 4, 0)
    fs.closeSync(fd)
    // APK — ZIP-архив
    return buf[0] === 0x50 && buf[1] === 0x4b
  } catch {
    return false
  }
}

/** GET /api/mobile-app/android — есть ли файл для скачивания */
const getAndroidApkStatus = (dbPool, uploadsRoot) => async (req, res) => {
  try {
    const { apkPath, metaPath } = getPaths(uploadsRoot)
    const exists = fs.existsSync(apkPath)
    if (!exists) {
      return res.json({ available: false })
    }
    const stat = fs.statSync(apkPath)
    const meta = readMeta(metaPath) || {}
    return res.json({
      available: true,
      fileName: meta.originalName || APK_FILE_NAME,
      size: stat.size,
      uploadedAt: meta.uploadedAt || stat.mtime.toISOString(),
      uploadedByName: meta.uploadedByName || null,
    })
  } catch (err) {
    console.error('[mobile-app][android][status]', err)
    return res.status(500).json({ error: 'Не удалось проверить наличие APK' })
  }
}

/** GET /api/mobile-app/android/download */
const downloadAndroidApk = (dbPool, uploadsRoot) => async (req, res) => {
  try {
    const { apkPath, metaPath } = getPaths(uploadsRoot)
    if (!fs.existsSync(apkPath)) {
      return res.status(404).json({ error: 'APK ещё не загружен администратором' })
    }
    const meta = readMeta(metaPath) || {}
    const downloadName = meta.originalName || APK_FILE_NAME
    res.setHeader('Content-Type', 'application/vnd.android.package-archive')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`
    )
    return res.sendFile(path.resolve(apkPath))
  } catch (err) {
    console.error('[mobile-app][android][download]', err)
    return res.status(500).json({ error: 'Ошибка скачивания APK' })
  }
}

/** DELETE /api/mobile-app/android — только Администратор, query/body: userId */
const deleteAndroidApk = (dbPool, uploadsRoot) => async (req, res) => {
  try {
    const userIdRaw = req.query?.userId ?? req.body?.userId
    const userId = userIdRaw != null ? Number(userIdRaw) : null
    if (!(await isAdminUser(dbPool, userId))) {
      return res.status(403).json({ error: 'Удаление доступно только администратору' })
    }

    const { apkPath, metaPath } = getPaths(uploadsRoot)
    const existed = fs.existsSync(apkPath) || fs.existsSync(metaPath)
    if (!existed) {
      return res.json({ ok: true, available: false, message: 'Файл уже отсутствует' })
    }

    if (fs.existsSync(apkPath)) fs.unlinkSync(apkPath)
    if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath)

    return res.json({ ok: true, available: false })
  } catch (err) {
    console.error('[mobile-app][android][delete]', err)
    return res.status(500).json({ error: 'Не удалось удалить APK' })
  }
}

/** POST /api/mobile-app/android/upload — только Администратор, multipart field: file */
const uploadAndroidApk = (dbPool, uploadsRoot) => async (req, res) => {
  const { apkPath, metaPath, dir } = getPaths(uploadsRoot)
  const tmpPath = req.file?.path

  try {
    const userId = req.body?.userId != null ? Number(req.body.userId) : null
    if (!(await isAdminUser(dbPool, userId))) {
      if (tmpPath && fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath)
      return res.status(403).json({ error: 'Загрузка доступна только администратору' })
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Выберите файл .apk' })
    }

    const originalName = req.file.originalname || APK_FILE_NAME
    if (!looksLikeApk(tmpPath, originalName, req.file.mimetype)) {
      if (tmpPath && fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath)
      return res.status(400).json({
        error: 'Разрешены только файлы формата APK (Android-приложение)',
      })
    }

    // Атомарная замена: tmp → основной файл
    const finalTmp = path.join(dir, `${APK_FILE_NAME}.uploading`)
    if (tmpPath !== finalTmp) {
      fs.renameSync(tmpPath, finalTmp)
    }
    if (fs.existsSync(apkPath)) fs.unlinkSync(apkPath)
    fs.renameSync(finalTmp, apkPath)

    const userRow = await dbPool.query(
      `SELECT TRIM(CONCAT(last_name, ' ', first_name, ' ', COALESCE(middle_name, ''))) AS fio
       FROM users WHERE id = $1`,
      [userId]
    )

    const stat = fs.statSync(apkPath)
    const meta = {
      originalName: originalName.endsWith('.apk') ? originalName : `${originalName}.apk`,
      uploadedAt: new Date().toISOString(),
      uploadedBy: userId,
      uploadedByName: userRow.rows[0]?.fio || null,
      size: stat.size,
      mimeType: req.file.mimetype || null,
    }
    writeMeta(metaPath, meta)

    return res.json({
      ok: true,
      available: true,
      fileName: meta.originalName,
      size: meta.size,
      uploadedAt: meta.uploadedAt,
      uploadedByName: meta.uploadedByName,
    })
  } catch (err) {
    console.error('[mobile-app][android][upload]', err)
    try {
      if (tmpPath && fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath)
    } catch (_) {}
    return res.status(500).json({ error: 'Не удалось сохранить APK' })
  }
}

module.exports = {
  getAndroidApkStatus,
  downloadAndroidApk,
  uploadAndroidApk,
  deleteAndroidApk,
  APK_FILE_NAME,
}
