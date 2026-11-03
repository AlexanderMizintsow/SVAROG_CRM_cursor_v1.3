const fs = require('fs')
const os = require('os')
const path = require('path')
const { pathToFileURL } = require('url')
const { spawnSync } = require('child_process')

const dir = __dirname
const yamlPath = path.join(dir, 'карта-развития.yaml')
const htmlPath = path.join(dir, 'карта-развития.html')
const treePath = path.join(dir, 'карта-развития-дерево.html')
const pdfPath = path.join(dir, 'карта-развития.pdf')

function parseScalar(raw) {
  const value = raw.trim()
  if (value === '[]') return []
  if (value.startsWith('"')) return JSON.parse(value)
  return value
}

function parseYaml(text) {
  const root = {}
  const stack = [{ indent: -1, value: root }]
  const lines = text.split(/\r?\n/)

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i]
    if (!raw.trim() || /^\s*#/.test(raw)) continue
    const indent = raw.match(/^ */)[0].length
    const line = raw.trim()
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop()
    const frame = stack[stack.length - 1]

    if (line.startsWith('- ')) {
      const rest = line.slice(2).trim()
      if (!Array.isArray(frame.value)) {
        throw new Error(`Строка ${i + 1}: элемент списка вне массива`)
      }
      if (rest.startsWith('"')) {
        frame.value.push(JSON.parse(rest))
        continue
      }
      const obj = {}
      frame.value.push(obj)
      const match = rest.match(/^([A-Za-z0-9_]+):\s*(.*)$/)
      if (!match) throw new Error(`Строка ${i + 1}: ${line}`)
      obj[match[1]] = match[2] ? parseScalar(match[2]) : ''
      stack.push({ indent, value: obj })
      continue
    }

    const match = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/)
    if (!match) throw new Error(`Строка ${i + 1}: ${line}`)
    const key = match[1]
    const rest = match[2]
    if (rest !== '') {
      frame.value[key] = parseScalar(rest)
      continue
    }
    let next = i + 1
    while (next < lines.length && (!lines[next].trim() || /^\s*#/.test(lines[next]))) next += 1
    const nextLine = lines[next] || ''
    const nextTrim = nextLine.trim()
    if (nextTrim.startsWith('- ')) {
      frame.value[key] = []
    } else {
      frame.value[key] = {}
    }
    stack.push({ indent, value: frame.value[key] })
  }
  return root
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function statusClass(status) {
  return `status-${String(status).replace(/\s+/g, '-')}`
}

function statusLabel(status) {
  if (status === 'готово') return 'Готово'
  if (status === 'план') return 'План'
  if (status === 'скрыто') return 'Скрыто в меню'
  if (status === 'не работает') return 'Не работает'
  return status
}

function walkItems(items, visit) {
  ;(items || []).forEach((item) => {
    visit(item)
    walkItems(item.children, visit)
  })
}

function countStatus(data) {
  const counts = { готово: 0, план: 0, скрыто: 0, 'не работает': 0 }
  data.platforms.forEach((platform) => {
    platform.groups.forEach((group) => {
      walkItems(group.items, (item) => {
        if (counts[item.status] != null) counts[item.status] += 1
      })
    })
  })
  return counts
}

function renderItem(item) {
  const mechanics = item.mechanics || []
  const children = item.children || []
  const mechanicHtml = mechanics.length
    ? `<ul>${mechanics.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`
    : ''
  const planHtml = item.plan
    ? `<p class="plan">${escapeHtml(item.plan)}</p>`
    : ''
  const childHtml = children.length
    ? `<div class="children">${children.map(renderItem).join('')}</div>`
    : ''
  return `<article class="item ${statusClass(item.status)}">
    <h3>${escapeHtml(item.name)} <span class="badge">${escapeHtml(statusLabel(item.status))}</span></h3>
    ${mechanicHtml}
    ${planHtml}
    ${childHtml}
  </article>`
}

function toHtml(data) {
  const counts = countStatus(data)
  const plans = []
  data.platforms.forEach((platform) => {
    platform.groups.forEach((group) => {
      walkItems(group.items, (item) => {
        if (item.status === 'план') {
          plans.push({ platform: platform.name, name: item.name, plan: item.plan || '' })
        }
      })
    })
  })
  const platforms = data.platforms
    .map((platform) => {
      const groups = platform.groups
        .map(
          (group) => `<section class="group">
            <h2>${escapeHtml(group.name)}</h2>
            ${group.items.map(renderItem).join('')}
          </section>`
        )
        .join('')
      return `<section class="platform">
        <h1>${escapeHtml(platform.name)}</h1>
        <p class="summary">${escapeHtml(platform.summary)}</p>
        ${groups}
      </section>`
    })
    .join('')
  const broken = []
  data.platforms.forEach((platform) => {
    platform.groups.forEach((group) => {
      walkItems(group.items, (item) => {
        if (item.status === 'не работает') {
          broken.push({ platform: platform.name, name: item.name, plan: item.plan || '' })
        }
      })
    })
  })
  const planRows = plans.length
    ? plans
        .map(
          (row) => `<tr><td>${escapeHtml(row.platform)}</td><td>${escapeHtml(row.name)}</td><td>${escapeHtml(row.plan)}</td></tr>`
        )
        .join('')
    : '<tr><td colspan="3">Пунктов плана нет</td></tr>'
  const brokenRows = broken.length
    ? broken
        .map(
          (row) => `<tr><td>${escapeHtml(row.platform)}</td><td>${escapeHtml(row.name)}</td><td>${escapeHtml(row.plan)}</td></tr>`
        )
        .join('')
    : '<tr><td colspan="3">Таких пунктов нет</td></tr>'

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(data.title)}</title>
  <style>
    @page { size: A4; margin: 14mm 12mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #1c1c1c; font: 11pt/1.4 "Segoe UI", sans-serif; }
    h1 { font-size: 18pt; margin: 0 0 6px; }
    h2 { font-size: 13pt; margin: 16px 0 8px; }
    h3 { font-size: 11.5pt; margin: 0 0 4px; }
    p { margin: 0 0 8px; }
    ul { margin: 0; padding-left: 18px; }
    li { margin: 0 0 2px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #ccc; padding: 6px 8px; vertical-align: top; text-align: left; }
    th { background: #f3f3f3; }
    .cover h1 { font-size: 22pt; }
    .meta { color: #444; }
    .counts { display: flex; gap: 12px; margin: 12px 0 4px; }
    .count { border: 1px solid #ccc; padding: 8px 10px; min-width: 120px; }
    .count b { display: block; font-size: 16pt; }
    .platform { break-before: page; }
    .group { margin-top: 8px; }
    .item { break-inside: avoid; margin: 0 0 8px; padding: 6px 0 6px 10px; border-left: 3px solid #c8c8c8; }
    .children { margin-top: 6px; }
    .children .item { border-left-color: #9a9a9a; }
    .badge { font-size: 9pt; font-weight: 650; letter-spacing: 0; }
    .status-готово { border-left-color: #1f7a45; }
    .status-готово .badge { color: #1f7a45; }
    .status-план { border-left-color: #9a5b00; }
    .status-план .badge { color: #9a5b00; }
    .status-скрыто { border-left-color: #666; }
    .status-скрыто .badge { color: #555; }
    .status-не-работает { border-left-color: #9b2c2c; }
    .status-не-работает .badge { color: #9b2c2c; }
    .plan { margin-top: 4px; }
  </style>
</head>
<body>
  <section class="cover">
    <h1>${escapeHtml(data.title)}</h1>
    <p class="meta">Дата среза: ${escapeHtml(data.updated)}</p>
    <p>${escapeHtml(data.note)}</p>
    <div class="counts">
      <div class="count"><b>${counts['готово']}</b>готово</div>
      <div class="count"><b>${counts['скрыто']}</b>скрыто в меню</div>
      <div class="count"><b>${counts['план']}</b>план, срок не задан</div>
      <div class="count"><b>${counts['не работает']}</b>не работает</div>
    </div>
    <h2>Сейчас не работает</h2>
    <table>
      <thead><tr><th>Ветка</th><th>Компонент</th><th>Пояснение</th></tr></thead>
      <tbody>${brokenRows}</tbody>
    </table>
    <h2>Что развивать дальше</h2>
    <table>
      <thead><tr><th>Ветка</th><th>Компонент</th><th>Содержание</th></tr></thead>
      <tbody>${planRows}</tbody>
    </table>
  </section>
  ${platforms}
</body>
</html>`
}

function mapSkillItem(item, id) {
  return {
    id,
    name: item.name,
    status: item.status || '',
    mechanics: item.mechanics || [],
    plan: item.plan || '',
    children: (item.children || []).map((child, index) => mapSkillItem(child, `${id}-${index}`)),
  }
}

function skillTreeData(data) {
  return {
    title: data.title,
    updated: data.updated,
    nodes: data.platforms.map((platform, platformIndex) => ({
      id: `p${platformIndex}`,
      name: platform.name,
      summary: platform.summary || '',
      status: '',
      mechanics: [],
      plan: '',
      children: platform.groups.map((group, groupIndex) => ({
        id: `p${platformIndex}-g${groupIndex}`,
        name: group.name,
        summary: '',
        status: '',
        mechanics: [],
        plan: '',
        children: group.items.map((item, itemIndex) =>
          mapSkillItem(item, `p${platformIndex}-g${groupIndex}-i${itemIndex}`)
        ),
      })),
    })),
  }
}

function toTreeHtml(data) {
  const payload = JSON.stringify(skillTreeData(data)).replace(/</g, '\\u003c')
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>Дерево развития СВАРОГ</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; color: #1c1c1c; background: #f6f3ee; font: 15px/1.4 "Segoe UI", sans-serif; }
    header { padding: 16px 20px 8px; }
    h1 { margin: 0 0 8px; font-size: 22px; }
    .legend { display: flex; flex-wrap: wrap; gap: 8px; margin: 0; padding: 0; list-style: none; }
    .legend li { display: flex; align-items: center; gap: 6px; }
    .swatch { width: 14px; height: 14px; border-radius: 4px; border: 2px solid #8d8d8d; }
    .swatch.done { background: #1b7a43; border-color: #1b7a43; }
    .swatch.progress { background: #e2a30b; border-color: #c48c08; }
    .swatch.plan { background: transparent; }
    .swatch.broken { background: #b42318; border-color: #b42318; }
    .swatch.hidden { background: #f7f7f7; border-style: dashed; }
    .layout { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(260px, 0.75fr); gap: 16px; padding: 8px 20px 24px; align-items: start; }
    .tree, .detail { background: #fffdf8; border: 1px solid #e4ddd2; border-radius: 12px; padding: 12px; }
    .branch { margin-left: 18px; padding-left: 14px; border-left: 2px solid #ddd4c8; }
    .row { display: flex; align-items: center; gap: 8px; margin: 4px 0; }
    .node { border: 2px solid #c8bfb0; background: #f4f1ea; color: #1c1c1c; border-radius: 10px; padding: 7px 10px; font: inherit; text-align: left; cursor: pointer; }
    .node.selected { outline: 3px solid #1d4e89; outline-offset: 1px; }
    .node.s-готово { background: #1b7a43; border-color: #1b7a43; color: #fff; }
    .node.s-план { background: transparent; border-color: #8d8d8d; color: #1c1c1c; }
    .node.s-в-процессе { background: #e2a30b; border-color: #c48c08; color: #1c1400; }
    .node.s-не-работает { background: #b42318; border-color: #b42318; color: #fff; }
    .node.s-скрыто { background: #f7f7f7; border-style: dashed; border-color: #888; color: #333; }
    .dots { display: flex; gap: 4px; }
    .dot { width: 8px; height: 8px; border-radius: 50%; border: 1px solid #8d8d8d; }
    .dot.done { background: #1b7a43; border-color: #1b7a43; }
    .dot.progress { background: #e2a30b; border-color: #c48c08; }
    .dot.plan { background: transparent; }
    .dot.broken { background: #b42318; border-color: #b42318; }
    .dot.hidden { background: #f7f7f7; }
    .detail h2 { margin: 0 0 6px; font-size: 18px; }
    .detail ul { margin: 8px 0 0; padding-left: 18px; }
    .muted { color: #555; }
    @media (max-width: 800px) {
      .layout { grid-template-columns: minmax(0, 1fr); }
    }
  </style>
</head>
<body>
  <header>
    <h1>Дерево развития</h1>
    <ul class="legend">
      <li><span class="swatch done"></span>Сделано</li>
      <li><span class="swatch progress"></span>В процессе</li>
      <li><span class="swatch plan"></span>В планах</li>
      <li><span class="swatch broken"></span>Не работает</li>
      <li><span class="swatch hidden"></span>Скрыто в меню</li>
    </ul>
  </header>
  <div class="layout">
    <div class="tree" id="tree"></div>
    <aside class="detail" id="detail" aria-live="polite"></aside>
  </div>
  <script id="tree-data" type="application/json">${payload}</script>
  <script>
    const data = JSON.parse(document.getElementById('tree-data').textContent)
    const treeEl = document.getElementById('tree')
    const detailEl = document.getElementById('detail')
    const expanded = new Set()
    let selectedId = data.nodes[0] ? data.nodes[0].id : ''

    function statusClass(status) {
      if (!status) return 's-branch'
      return 's-' + status.replace(/\\s+/g, '-')
    }

    function statusText(status) {
      if (status === 'готово') return 'Сделано'
      if (status === 'в процессе') return 'В процессе'
      if (status === 'план') return 'В планах'
      if (status === 'не работает') return 'Не работает'
      if (status === 'скрыто') return 'Скрыто в меню'
      return 'Раздел'
    }

    function tally(node) {
      const bag = { готово: 0, 'в процессе': 0, план: 0, 'не работает': 0, скрыто: 0 }
      function walk(item) {
        if (item.status && bag[item.status] != null) bag[item.status] += 1
        ;(item.children || []).forEach(walk)
      }
      ;(node.children || []).forEach(walk)
      return bag
    }

    function find(id, nodes) {
      for (let i = 0; i < nodes.length; i += 1) {
        if (nodes[i].id === id) return nodes[i]
        const nested = find(id, nodes[i].children || [])
        if (nested) return nested
      }
      return null
    }

    function dots(node) {
      const bag = tally(node)
      const wrap = document.createElement('span')
      wrap.className = 'dots'
      ;[
        ['готово', 'done'],
        ['в процессе', 'progress'],
        ['план', 'plan'],
        ['не работает', 'broken'],
        ['скрыто', 'hidden'],
      ].forEach(function (pair) {
        if (!bag[pair[0]]) return
        const mark = document.createElement('span')
        mark.className = 'dot ' + pair[1]
        mark.title = bag[pair[0]] + ' · ' + statusText(pair[0])
        wrap.appendChild(mark)
      })
      return wrap
    }

    function drawNode(node) {
      const block = document.createElement('div')
      const row = document.createElement('div')
      row.className = 'row'
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'node ' + statusClass(node.status)
      if (node.id === selectedId) button.className += ' selected'
      const hasKids = (node.children || []).length > 0
      button.textContent = (hasKids ? (expanded.has(node.id) ? '▾ ' : '▸ ') : '') + node.name
      button.setAttribute('aria-pressed', node.id === selectedId ? 'true' : 'false')
      button.addEventListener('click', function () {
        selectedId = node.id
        if (hasKids) {
          if (expanded.has(node.id)) expanded.delete(node.id)
          else expanded.add(node.id)
        }
        draw()
      })
      row.appendChild(button)
      if (hasKids && !node.status) row.appendChild(dots(node))
      block.appendChild(row)
      if (hasKids && expanded.has(node.id)) {
        const branch = document.createElement('div')
        branch.className = 'branch'
        node.children.forEach(function (child) {
          branch.appendChild(drawNode(child))
        })
        block.appendChild(branch)
      }
      return block
    }

    function drawDetail() {
      const node = find(selectedId, data.nodes)
      while (detailEl.firstChild) detailEl.removeChild(detailEl.firstChild)
      if (!node) return
      const title = document.createElement('h2')
      title.textContent = node.name
      const state = document.createElement('p')
      state.textContent = statusText(node.status)
      detailEl.appendChild(title)
      detailEl.appendChild(state)
      if (node.summary) {
        const summary = document.createElement('p')
        summary.className = 'muted'
        summary.textContent = node.summary
        detailEl.appendChild(summary)
      }
      if ((node.mechanics || []).length) {
        const list = document.createElement('ul')
        node.mechanics.forEach(function (line) {
          const item = document.createElement('li')
          item.textContent = line
          list.appendChild(item)
        })
        detailEl.appendChild(list)
      }
      if (node.plan) {
        const plan = document.createElement('p')
        plan.textContent = node.plan
        detailEl.appendChild(plan)
      }
      if (!node.status && (node.children || []).length) {
        const bag = tally(node)
        const line = document.createElement('p')
        line.className = 'muted'
        line.textContent = 'Сделано ' + bag['готово'] + ', в процессе ' + bag['в процессе'] + ', в планах ' + bag['план'] + ', не работает ' + bag['не работает'] + ', скрыто ' + bag['скрыто']
        detailEl.appendChild(line)
      }
    }

    function draw() {
      while (treeEl.firstChild) treeEl.removeChild(treeEl.firstChild)
      data.nodes.forEach(function (node) {
        treeEl.appendChild(drawNode(node))
      })
      drawDetail()
    }

    draw()
  </script>
</body>
</html>`
}

function countItems(data) {
  let n = 0
  data.platforms.forEach((platform) => {
    platform.groups.forEach((group) => {
      walkItems(group.items, () => {
        n += 1
      })
    })
  })
  return n
}

function printPdf() {
  const candidates = [
    path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env.ProgramFiles || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ]
  const browser = candidates.find((item) => item && fs.existsSync(item))
  if (!browser) {
    console.log('PDF не собран: не найден браузер Edge или Chrome. HTML можно открыть и сохранить как PDF.')
    return
  }
  const profile = path.join(os.tmpdir(), 'svarog-pdf-profile')
  const result = spawnSync(
    browser,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      `--user-data-dir=${profile}`,
      '--no-pdf-header-footer',
      `--print-to-pdf=${pdfPath}`,
      pathToFileURL(htmlPath).href,
    ],
    { stdio: 'ignore' }
  )
  if (result.status !== 0 || !fs.existsSync(pdfPath)) {
    console.log('PDF не собран. HTML можно открыть и сохранить как PDF.')
    return
  }
  console.log(pdfPath)
}

function main() {
  const data = parseYaml(fs.readFileSync(yamlPath, 'utf8'))
  fs.writeFileSync(htmlPath, toHtml(data), 'utf8')
  fs.writeFileSync(treePath, toTreeHtml(data), 'utf8')
  console.log(`Компонентов: ${countItems(data)}`)
  console.log(htmlPath)
  console.log(treePath)
  printPdf()
}

main()
