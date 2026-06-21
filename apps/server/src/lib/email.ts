import nodemailer from 'nodemailer'
import { getConfig } from './config.js'

// SMTP 配置从 DB 动态读取（优先 DB，回退 env）
const smtpHost = () => getConfig('thirdParty.SMTP_HOST', 'SMTP_HOST')
const smtpPort = async () => parseInt(await getConfig('thirdParty.SMTP_PORT', 'SMTP_PORT') || '465')
const smtpUser = () => getConfig('thirdParty.SMTP_USER', 'SMTP_USER')
const smtpPass = () => getConfig('thirdParty.SMTP_PASS', 'SMTP_PASS')
const smtpFrom = async () => {
  const user = await smtpUser()
  return process.env.SMTP_FROM || `"风水地球仪" <${user}>`
}

// 验证码缓存
const codeCache = new Map<string, { code: string; expiresAt: number }>()

// 动态创建邮件发送器
async function getTransporter() {
  const [host, port, user, pass] = await Promise.all([smtpHost(), smtpPort(), smtpUser(), smtpPass()])
  if (!user) return null
  return nodemailer.createTransport({ host, port, secure: true, auth: { user, pass } })
}

// 生成6位验证码
const generateCode = (): string => {
  return Math.random().toString().slice(2, 8)
}

// 发送邮箱验证码
export const sendEmailCode = async (email: string): Promise<void> => {
  const code = generateCode()
  const expiresAt = Date.now() + 5 * 60 * 1000 // 5分钟有效

  codeCache.set(email, { code, expiresAt })

  const transporter = await getTransporter()
  if (transporter) {
    await transporter.sendMail({
      from: await smtpFrom(),
      to: email,
      subject: '风水地球仪 - 验证码',
      html: `
        <div style="max-width: 480px; margin: 0 auto; padding: 32px; font-family: sans-serif;">
          <h2 style="color: #1a1a2e; text-align: center;">风水地球仪</h2>
          <p style="color: #333; font-size: 15px;">您正在进行身份验证，验证码为：</p>
          <div style="text-align: center; padding: 16px; margin: 16px 0; background: #f0f4ff; border-radius: 8px;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #4a90d9;">${code}</span>
          </div>
          <p style="color: #999; font-size: 13px;">验证码5分钟内有效，请勿泄露给他人。</p>
          <p style="color: #999; font-size: 13px;">如非本人操作，请忽略此邮件。</p>
        </div>
      `,
    })
  } else {
    // 无 SMTP 配置时，验证码输出到控制台
    console.log(`[Email] 验证码发送到 ${email}: ${code}`)
  }
}

// 验证邮箱验证码
export const verifyEmailCode = (email: string, inputCode: string): boolean => {
  const cached = codeCache.get(email)
  if (!cached) return false
  if (Date.now() > cached.expiresAt) {
    codeCache.delete(email)
    return false
  }
  if (cached.code !== inputCode) return false
  codeCache.delete(email)
  return true
}
