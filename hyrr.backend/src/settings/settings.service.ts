import { Injectable } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { SETTINGS_FIELDS, UpdateSettingsDto } from "./dtos/update-settings.dto"

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  /** Returns the user's settings (created with schema defaults on first access). */
  async getSettings(userId: string) {
    return this.prisma.userSetting.upsert({
      where: { userId },
      update: {},
      create: { userId },
    })
  }

  async updateSettings(userId: string, data: UpdateSettingsDto) {
    // Only copy known preference fields (the DTO is already whitelisted by the ValidationPipe).
    const updateData: Record<string, unknown> = {}
    for (const field of SETTINGS_FIELDS) {
      if (data[field] !== undefined) updateData[field] = data[field]
    }

    return this.prisma.userSetting.upsert({
      where: { userId },
      update: updateData,
      create: { userId, ...updateData },
    })
  }
}
