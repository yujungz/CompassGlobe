import type { ChatMessage } from '../../lib/ai.js'

export function buildFengshuiHomePrompt(
  descriptions: string[],
  imageBuffers: Buffer[],
  mimeTypes: string[],
  format: 'openai' | 'anthropic' = 'openai'
): ChatMessage[] {
  // 构建文字说明
  let descText = ''
  for (let i = 0; i < imageBuffers.length; i++) {
    const d = descriptions[i]
    descText += d ? `图片${i + 1}说明：${d}\n` : `图片${i + 1}（无额外说明）\n`
  }

  // 用户消息：文字 + 图片
  const userParts: any[] = [
    {
      type: 'text',
      text: `我上传了${imageBuffers.length}张室内照片，请根据这些照片进行居家风水分析。\n\n${descText}`,
    },
  ]

  // 添加每张图片
  for (let i = 0; i < imageBuffers.length; i++) {
    const b64 = imageBuffers[i].toString('base64')
    const mime = mimeTypes[i] || 'image/jpeg'

    if (format === 'openai') {
      // OpenAI 标准格式
      userParts.push({
        type: 'image_url',
        image_url: { url: `data:${mime};base64,${b64}` },
      })
    } else {
      // Anthropic 格式
      userParts.push({
        type: 'image',
        source: { type: 'base64', media_type: mime, data: b64 },
      })
    }
  }

  return [
    {
      role: 'system',
      content: `你是一位精通中国传统居家风水学的资深顾问，拥有30年从业经验。你擅长根据室内照片分析家居风水布局，识别问题并提供专业、可操作的优化建议。

分析维度包括但不限于：
1. 户型与朝向：房屋朝向、采光通风、空间布局是否合理
2. 门、窗、阳台：气流走向、纳气口位置
3. 客厅：财位、沙发/电视位置、装饰摆设
4. 卧室：床位朝向、镜子位置、电器摆放
5. 厨房与卫生间：水火配置、卫生情况
6. 色彩与装饰：整体色调、五行平衡
7. 不利因素：横梁压顶、尖角煞、穿堂风等

请用中文回复，语气温和专业。分析结构如下：

[总体评价]：对整体家居风水做一个概括性评价
[分区域分析]：针对每张图片显示的区域逐一分析
[问题指出]：明确指出存在的风水问题
[优化建议]：给出具体、可操作的改善建议
[综合评分]：给出 1-100 的居家风水综合评分`,
    },
    {
      role: 'user',
      content: userParts,
    },
  ]
}
