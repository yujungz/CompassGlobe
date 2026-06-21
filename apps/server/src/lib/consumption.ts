import prisma from './prisma.js'
import { AppError } from '../middlewares/error.js'

/**
 * 原子递减咨询次数，余额不足时回滚并抛出错误
 * @returns 递减后的剩余次数
 */
export async function consumeConsult(userId: string): Promise<number> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { consultCount: { decrement: 1 } },
  })

  if (user.consultCount < 0) {
    // 回滚
    await prisma.user.update({
      where: { id: userId },
      data: { consultCount: { increment: 1 } },
    })
    throw new AppError('咨询次数不足，请联系管理员充值', 402)
  }

  return user.consultCount
}

/**
 * 原子递减创作次数，余额不足时回滚并抛出错误
 * @returns 递减后的剩余次数
 */
export async function consumeImage(userId: string): Promise<number> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { imageCount: { decrement: 1 } },
  })

  if (user.imageCount < 0) {
    await prisma.user.update({
      where: { id: userId },
      data: { imageCount: { increment: 1 } },
    })
    throw new AppError('创作次数不足，请联系管理员充值', 402)
  }

  return user.imageCount
}

/**
 * 获取用户剩余次数
 */
export async function getConsumption(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { imageCount: true, consultCount: true },
  })
  return {
    imageCount: user?.imageCount ?? 0,
    consultCount: user?.consultCount ?? 0,
  }
}
