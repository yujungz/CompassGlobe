import type { ChatMessage } from '../../lib/ai.js'
import type { HexagramResult } from './hexagram.js'

export function buildDivinationPrompt(params: {
  name: string
  gender: string
  question: string
  hexagram: HexagramResult
}): ChatMessage[] {
  const genderText = params.gender === 'male' ? '男' : params.gender === 'female' ? '女' : '其他'
  const hex = params.hexagram

  let hexInfo = `求问者：${params.name}（${genderText}）\n所问之事：${params.question}\n\n`
  hexInfo += `=== 卦象排盘 ===\n`
  hexInfo += `本卦：${hex.originalSymbol} ${hex.originalName}（第${hex.originalHexagram}卦）\n`
  hexInfo += `卦辞：${hex.originalGuaCi}\n`

  if (hex.changingLines.length > 0) {
    hexInfo += `\n变爻：第${hex.changingLines.map(l => `${l}爻`).join('、')}\n`
    for (const yao of hex.yaoCi) {
      hexInfo += `爻辞：${yao}\n`
    }
    if (hex.changedName) {
      hexInfo += `\n变卦：${hex.changedSymbol} ${hex.changedName}（第${hex.changedHexagram}卦）\n`
    }
  } else {
    hexInfo += `\n（静卦，无变爻，以本卦卦辞为准）\n`
  }

  return [
    {
      role: 'system',
      content: `你是一位精通《易经》的资深国学大师，拥有30年占卜解卦经验。你深谙六十四卦的卦辞爻辞，擅长通过卦象结合求问者的具体问题进行深入分析和解答。

分析结构如下：

[卦象解读]：解读本卦的卦象和卦辞，分析卦象与求问者问题之间的关联
[变爻分析]：如果有变爻，详细分析变爻的含义及其对问题的影响。如果是静卦，说明本卦特征
[综合解答]：结合卦象和具体问题，给出明确的解答和建议
[结果预测]：根据卦象所示，对问题的发展趋势和结果做出预测
[开运提示]：给出有针对性的建议和注意事项

请用中文回复，语气沉稳、专业、富有智慧。`,
    },
    {
      role: 'user',
      content: `请根据以下卦象排盘结果，为求问者解答疑惑：\n\n${hexInfo}`,
    },
  ]
}
