import prisma from '../utils/prisma';

class ImpactStoryService {
  async getStoriesForUser(userId: string) {
    return prisma.impactStory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createStory(userId: string, data: {
    textNote: string;
    photoUrl?: string;
    audioUrl?: string;
    videoUrl?: string;
    charityName: string;
    totalDonated: number;
    season?: number;
  }) {
    return prisma.impactStory.create({
      data: { userId, ...data, totalDonated: data.totalDonated },
    });
  }
}

export default new ImpactStoryService();
