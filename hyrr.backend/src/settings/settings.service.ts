import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async getSettings(userId: string) {
    let setting = await this.prisma.userSetting.findUnique({
      where: { userId },
    });

    if (!setting) {
      setting = await this.prisma.userSetting.create({
        data: {
          userId,
          emailNotifications: true,
          smsNotifications: false,
          marketingEmails: false,
          applicationUpdates: true,
          interviewReminders: true,
          offerNotifications: true,
          messageNotifications: true,
          jobRecommendations: true,
          weeklyDigest: false,
          profilePublic: true,
          resumeVisible: true,
          showActivity: false,
          theme: 'light',
        },
      });
    }

    return setting;
  }

  async updateSettings(userId: string, data: any) {
    const { id, userId: _, updatedAt: __, user: ___, ...updateData } = data;

    return this.prisma.userSetting.upsert({
      where: { userId },
      update: updateData,
      create: {
        userId,
        ...updateData,
      },
    });
  }
}
