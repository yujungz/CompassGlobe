import hexagramData from './hexagram-data.json' assert { type: 'json' }

interface HexagramEntry {
  number: number
  name: string
  symbol: string
  guaCi: string
  yaoCi: string[]
}

export interface HexagramResult {
  originalHexagram: number
  originalName: string
  originalSymbol: string
  originalGuaCi: string
  changedHexagram: number | null
  changedName: string | null
  changedSymbol: string | null
  changingLines: number[]
  yaoCi: string[]
}

// 三枚铜钱仿真
function tossCoins(): number {
  // 每枚铜钱：正面=3（阳），反面=2（阴）
  // 三枚之和：6=老阴, 7=少阳, 8=少阴, 9=老阳
  const coins = Array.from({ length: 3 }, () => (Math.random() < 0.5 ? 2 : 3))
  return coins.reduce((a, b) => a + b, 0)
}

// 根据六爻值计算卦象编号
function linesToHexagramNumber(lines: number[]): number {
  // 六爻从下到上（index 0=初爻, 5=上爻）
  // 老阳(9)和少阳(7)为阳爻，老阴(6)和少阴(8)为阴爻
  const binary = lines.map(v => (v === 7 || v === 9) ? 1 : 0)

  // 上卦（外卦）：高三位（index 3,4,5）
  const upper = binary[5] * 4 + binary[4] * 2 + binary[3] * 1
  // 下卦（内卦）：低三位（index 0,1,2）
  const lower = binary[2] * 4 + binary[1] * 2 + binary[0] * 1

  // 卦序查找
  const number = upper * 8 + lower + 1
  return number
}

// 获取卦象条目
function getHexagram(number: number): HexagramEntry | undefined {
  return (hexagramData as HexagramEntry[]).find(h => h.number === number)
}

// 生成完整卦象结果
export function generateHexagram(): HexagramResult {
  // 摇六爻
  const lines: number[] = []
  for (let i = 0; i < 6; i++) {
    lines.push(tossCoins())
  }

  // 变爻（老阴6、老阳9为变爻）
  const changingLines: number[] = []
  lines.forEach((v, i) => {
    if (v === 6 || v === 9) changingLines.push(i + 1) // 1-indexed
  })

  // 本卦
  const originalNum = linesToHexagramNumber(lines)
  const original = getHexagram(originalNum) || {
    number: originalNum,
    name: `卦${originalNum}`,
    symbol: '?',
    guaCi: '暂无卦辞',
    yaoCi: [],
  }

  // 变卦（如果有变爻）
  let changedHexagram: number | null = null
  let changedName: string | null = null
  let changedSymbol: string | null = null
  let yaoCi: string[] = []

  if (changingLines.length > 0) {
    // 翻转变爻：老阳(9)→阴(8)，老阴(6)→阳(7)
    const changedLines = lines.map(v => {
      if (v === 6) return 7
      if (v === 9) return 8
      return v
    })

    const changedNum = linesToHexagramNumber(changedLines)
    // 如果变卦和本卦相同说明无变
    if (changedNum !== originalNum) {
      changedHexagram = changedNum
      const changed = getHexagram(changedNum)
      changedName = changed?.name || null
      changedSymbol = changed?.symbol || null
    }

    // 获取变爻的爻辞
    yaoCi = changingLines.map(lineNum => {
      const idx = lineNum - 1
      return original.yaoCi[idx] || `第${lineNum}爻：无记载`
    })
  }

  return {
    originalHexagram: original.number,
    originalName: original.name,
    originalSymbol: original.symbol,
    originalGuaCi: original.guaCi,
    changedHexagram,
    changedName,
    changedSymbol,
    changingLines,
    yaoCi,
  }
}
