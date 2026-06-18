// GLM-5 大模型连接测试
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: 'fc446d345a86465a8d06c30a6daa0d47.Cv7O2Zzq3NfrjF8J',
  baseURL: 'https://open.bigmodel.cn/api/anthropic',
})

console.log('========================================')
console.log('GLM-5 大模型连接测试')
console.log('========================================\n')

async function testBasicChat() {
  console.log('测试 1: 基础文本对话...')
  try {
    const message = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: '你好，请用一句话介绍风水罗盘的作用。',
        },
      ],
    })
    console.log('✅ 基础对话测试成功')
    console.log('   响应:', message.content[0].text.substring(0, 100) + '...\n')
    return true
  } catch (error) {
    console.log('❌ 基础对话测试失败')
    console.log('   错误:', error.message, '\n')
    return false
  }
}

async function testFengShuiAnalysis() {
  console.log('测试 2: 风水分析场景...')
  try {
    const message = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `你是一位专业的风水分析师。请根据以下信息进行简要的风水分析：

位置信息：
- 经度: 116.397428
- 纬度: 39.90923
- 地址: 北京市天安门广场
- 海拔: 45米
- 当前时间: 2024年4月8日 下午3点

请从以下几个维度进行分析（各用1-2句话）：
1. 方位分析
2. 地形地势
3. 建议事项`,
        },
      ],
    })
    console.log('✅ 风水分析测试成功')
    console.log('   响应预览:', message.content[0].text.substring(0, 200) + '...\n')
    return true
  } catch (error) {
    console.log('❌ 风水分析测试失败')
    console.log('   错误:', error.message, '\n')
    return false
  }
}

async function testVisionAnalysis() {
  console.log('测试 3: 图片分析能力...')
  try {
    // 使用一个简单的测试图片（1x1 像素红色图片的 base64）
    const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

    const message = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: testImageBase64,
              },
            },
            {
              type: 'text',
              text: '这是一张测试图片，请简单描述它。',
            },
          ],
        },
      ],
    })
    console.log('✅ 图片分析测试成功')
    console.log('   响应:', message.content[0].text.substring(0, 100) + '...\n')
    return true
  } catch (error) {
    console.log('❌ 图片分析测试失败')
    console.log('   错误:', error.message, '\n')
    return false
  }
}

async function testStreamResponse() {
  console.log('测试 4: 流式响应...')
  try {
    const stream = client.messages.stream({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: '请用5个词描述"地球仪"。',
        },
      ],
    })

    let fullResponse = ''
    stream.on('text', (text) => {
      fullResponse += text
      process.stdout.write(text)
    })

    await stream.finalMessage()
    console.log('\n✅ 流式响应测试成功\n')
    return true
  } catch (error) {
    console.log('\n❌ 流式响应测试失败')
    console.log('   错误:', error.message, '\n')
    return false
  }
}

async function runAllTests() {
  const results = []

  results.push(await testBasicChat())
  results.push(await testFengShuiAnalysis())
  results.push(await testVisionAnalysis())
  results.push(await testStreamResponse())

  console.log('========================================')
  console.log('测试结果汇总')
  console.log('========================================')
  const passed = results.filter(r => r).length
  const total = results.length
  console.log(`通过: ${passed}/${total}`)

  if (passed === total) {
    console.log('\n🎉 所有测试通过！大模型连接正常。')
  } else {
    console.log('\n⚠️  部分测试失败，请检查配置。')
  }
}

runAllTests().catch(console.error)
