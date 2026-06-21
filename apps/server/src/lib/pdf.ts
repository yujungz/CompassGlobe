import PDFDocument from 'pdfkit'
import type { Response } from 'express'
import fs from 'fs'
import https from 'node:https'

// 中文字体 buffer
let fontBuffer: Buffer | null = null

async function loadChineseFont(): Promise<Buffer> {
  if (fontBuffer) return fontBuffer

  // 优先使用独立 OTF（PDFKit 不支持 TTC）
  const otfPaths = [
    '/tmp/NotoSansSC-Regular.otf',
    'C:/Windows/Fonts/msyh.ttc',
    'C:/Windows/Fonts/simsun.ttc',
    '/System/Library/Fonts/PingFang.ttc',
  ]

  for (const p of otfPaths) {
    try {
      if (fs.existsSync(p)) {
        fontBuffer = fs.readFileSync(p)
        console.log('PDF font loaded:', p, `(${(fontBuffer.length / 1024 / 1024).toFixed(1)}MB)`)
        return fontBuffer
      }
    } catch { /* continue */ }
  }

  // 如果没有 OTF，尝试从 GitHub 下载
  const otfUrl = 'https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Regular.otf'
  try {
    console.log('Downloading Chinese OTF font for PDF...')
    const downloadPromise = new Promise<Buffer>((resolve, reject) => {
      https.get(otfUrl, { headers: { 'User-Agent': 'Node.js' } }, (res: any) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          https.get(res.headers.location, (r2: any) => {
            const chunks: Buffer[] = []
            r2.on('data', (c: Buffer) => chunks.push(c))
            r2.on('end', () => resolve(Buffer.concat(chunks)))
            r2.on('error', reject)
          })
        } else {
          const chunks: Buffer[] = []
          res.on('data', (c: Buffer) => chunks.push(c))
          res.on('end', () => resolve(Buffer.concat(chunks)))
          res.on('error', reject)
        }
      }).on('error', reject)
    })
    fontBuffer = await downloadPromise
    if (fontBuffer.length > 10000) {
      fs.writeFileSync('/tmp/NotoSansSC-Regular.otf', fontBuffer)
      console.log('PDF font downloaded:', (fontBuffer.length / 1024 / 1024).toFixed(1), 'MB')
      return fontBuffer
    }
  } catch (e) { console.warn('Download failed, trying TTC fallback') }

  // 最终回退 TTC（可能失败）
  const ttcPath = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
  if (fs.existsSync(ttcPath)) {
    fontBuffer = fs.readFileSync(ttcPath)
    console.log('PDF font (TTC fallback):', ttcPath, `(${(fontBuffer.length / 1024 / 1024).toFixed(1)}MB)`)
    return fontBuffer
  }

  throw new Error('No Chinese font found')
}

async function registerCJKFont(doc: PDFKit.PDFDocument) {
  const buf = await loadChineseFont()
  doc.registerFont('CJK', buf)
  doc.font('CJK')
}

/**
 * 生成流年大运 PDF 并流式返回给客户端
 */
export async function generateFortunePDF(res: Response, data: {
  name: string
  gender: string
  birthInfo: string
  baZi: { yearPillar: string; monthPillar: string; dayPillar: string; timePillar: string }
  zodiac: string
  constellation: string
  predictYear: number
  result: string
  birthAddress?: string | null
  company?: string | null
  industry?: string | null
  profession?: string | null
  remark?: string | null
}) {
  const genderText = data.gender === 'male' ? '男' : data.gender === 'female' ? '女' : '其他'

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 50, bottom: 50, left: 60, right: 60 },
    info: { Title: `流年大运分析 - ${data.name}`, Author: '风水地球仪' },
  })

  await registerCJKFont(doc)

  const filename = encodeURIComponent(`流年大运_${data.name}_${data.predictYear}年.pdf`)
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${filename}`)
  doc.pipe(res)

  doc.fontSize(22).text('流年大运分析报告', { align: 'center' })
  doc.moveDown(1)
  doc.moveTo(60, doc.y).lineTo(535, doc.y).stroke()
  doc.moveDown(0.5)

  doc.fontSize(14).text('基本信息', { underline: true })
  doc.moveDown(0.3)
  doc.fontSize(11)
  doc.text(`姓名：${data.name}    性别：${genderText}`)
  doc.text(`出生信息：${data.birthInfo}`)
  doc.text(`生肖：${data.zodiac}    星座：${data.constellation}`)
  doc.text(`预测年份：${data.predictYear}年`)
  if (data.birthAddress) doc.text(`出生地址：${data.birthAddress}`)
  if (data.company) doc.text(`所在公司：${data.company}`)
  if (data.industry) doc.text(`所属行业：${data.industry}`)
  if (data.profession) doc.text(`职业：${data.profession}`)
  doc.moveDown(0.5)

  doc.fontSize(14).text('八字排盘', { underline: true })
  doc.moveDown(0.3)
  doc.fontSize(11)
  doc.text(`年柱：${data.baZi.yearPillar}    月柱：${data.baZi.monthPillar}`)
  doc.text(`日柱：${data.baZi.dayPillar}    时柱：${data.baZi.timePillar}`)
  doc.moveDown(0.5)

  if (data.remark) {
    doc.fontSize(14).text('备注信息', { underline: true })
    doc.moveDown(0.3)
    doc.fontSize(11).text(data.remark)
    doc.moveDown(0.5)
  }

  doc.fontSize(14).text('流年大运分析', { underline: true })
  doc.moveDown(0.3)
  doc.fontSize(11)
  const paragraphs = data.result.split('\n').filter(Boolean)
  for (const para of paragraphs) { doc.text(para.trim()); doc.moveDown(0.2) }

  doc.moveDown(1)
  doc.fontSize(9).text(`生成时间：${new Date().toLocaleString('zh-CN')}`, { align: 'right' })
  doc.text('由 风水地球仪 AI 系统自动生成', { align: 'right' })
  doc.end()
}

/**
 * 生成八卦问事 PDF 并流式返回给客户端
 */
export async function generateDivinationPDF(res: Response, data: {
  name: string
  gender: string
  question: string
  hexagram: {
    originalName: string
    originalSymbol: string
    originalGuaCi: string
    changedName?: string
    changedSymbol?: string
    changingLines: number[]
    yaoCi: string[]
  }
  result: string
}) {
  const genderText = data.gender === 'male' ? '男' : data.gender === 'female' ? '女' : '其他'
  const hex = data.hexagram

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 50, bottom: 50, left: 60, right: 60 },
    info: { Title: `八卦问事 - ${data.name}`, Author: '风水地球仪' },
  })

  await registerCJKFont(doc)

  const filename = encodeURIComponent(`八卦问事_${data.name}.pdf`)
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${filename}`)
  doc.pipe(res)

  doc.fontSize(22).text('八卦问事分析报告', { align: 'center' })
  doc.moveDown(1)
  doc.moveTo(60, doc.y).lineTo(535, doc.y).stroke()
  doc.moveDown(0.5)

  doc.fontSize(14).text('基本信息', { underline: true })
  doc.moveDown(0.3)
  doc.fontSize(11)
  doc.text(`姓名：${data.name}    性别：${genderText}`)
  doc.text(`所问之事：${data.question}`)
  doc.moveDown(0.5)

  doc.fontSize(14).text('卦象排盘', { underline: true })
  doc.moveDown(0.3)
  doc.fontSize(13)
  doc.text(`本卦：${hex.originalSymbol} ${hex.originalName}`)
  doc.moveDown(0.2)
  doc.fontSize(11)
  doc.text(`卦辞：${hex.originalGuaCi}`)
  doc.moveDown(0.2)

  if (hex.changingLines.length > 0) {
    doc.text(`变爻：第${hex.changingLines.map(l => `${l}爻`).join('、')}`)
    doc.moveDown(0.2)
    for (const yao of hex.yaoCi) { doc.text(`  ${yao}`) }
    doc.moveDown(0.2)
    if (hex.changedName) {
      doc.fontSize(13)
      doc.text(`变卦：${hex.changedSymbol || ''} ${hex.changedName}`)
      doc.moveDown(0.2)
      doc.fontSize(11)
    }
  } else {
    doc.text('（静卦，无变爻）')
  }
  doc.moveDown(0.5)

  doc.fontSize(14).text('AI 解卦分析', { underline: true })
  doc.moveDown(0.3)
  doc.fontSize(11)
  const paragraphs = data.result.split('\n').filter(Boolean)
  for (const para of paragraphs) { doc.text(para.trim()); doc.moveDown(0.2) }

  doc.moveDown(1)
  doc.fontSize(9).text(`生成时间：${new Date().toLocaleString('zh-CN')}`, { align: 'right' })
  doc.text('由 风水地球仪 AI 系统自动生成', { align: 'right' })
  doc.end()
}

/**
 * 生成居家风水 PDF
 */
export async function generateFengshuiHomePDF(res: Response, data: {
  descriptions: string[]
  result: string
  createdAt: string
}) {
  const doc = new PDFDocument({
    size: 'A4', margins: { top: 50, bottom: 50, left: 60, right: 60 },
    info: { Title: '居家风水分析报告', Author: '风水地球仪' },
  })
  const font = loadChineseFont()
  doc.registerFont('CJK', font)
  doc.font('CJK')

  const filename = encodeURIComponent('居家风水分析报告.pdf')
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${filename}`)
  doc.pipe(res)

  doc.fontSize(22).text('居家风水分析报告', { align: 'center' })
  doc.moveDown(1)
  doc.moveTo(60, doc.y).lineTo(535, doc.y).stroke()
  doc.moveDown(0.5)

  if (data.descriptions.length > 0) {
    doc.fontSize(14).text('图片说明', { underline: true })
    doc.moveDown(0.3)
    doc.fontSize(11)
    data.descriptions.forEach((d, i) => { doc.text(`图片${i + 1}：${d || '（无说明）'}`) })
    doc.moveDown(0.5)
  }

  doc.fontSize(14).text('风水分析', { underline: true })
  doc.moveDown(0.3)
  doc.fontSize(11)
  for (const p of data.result.split('\n').filter(Boolean)) { doc.text(p.trim()); doc.moveDown(0.2) }

  doc.moveDown(1)
  doc.fontSize(9).text(`分析时间：${new Date(data.createdAt).toLocaleString('zh-CN')}`, { align: 'right' })
  doc.text('由 风水地球仪 AI 系统自动生成', { align: 'right' })
  doc.end()
}
