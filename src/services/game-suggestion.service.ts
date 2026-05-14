import prisma from '../utils/prisma';

export interface CreateSuggestionInput {
  title: string;
  description: string;
  templateType: string;
  ivyInstruction: string;
  tracks?: string[];
  tags?: string[];
  published?: boolean;
  createdByEmail?: string;
}

class GameSuggestionService {
  async create(data: CreateSuggestionInput) {
    return prisma.gameSuggestion.create({
      data: {
        title: data.title,
        description: data.description,
        templateType: data.templateType,
        ivyInstruction: data.ivyInstruction,
        tracks: JSON.stringify(data.tracks ?? []),
        tags: JSON.stringify(data.tags ?? []),
        published: data.published ?? false,
        createdByEmail: data.createdByEmail,
      },
    });
  }

  async update(id: string, data: Partial<CreateSuggestionInput>) {
    const updateData: Record<string, any> = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.templateType !== undefined) updateData.templateType = data.templateType;
    if (data.ivyInstruction !== undefined) updateData.ivyInstruction = data.ivyInstruction;
    if (data.tracks !== undefined) updateData.tracks = JSON.stringify(data.tracks);
    if (data.tags !== undefined) updateData.tags = JSON.stringify(data.tags);
    if (data.published !== undefined) updateData.published = data.published;

    return prisma.gameSuggestion.update({ where: { id }, data: updateData });
  }

  async delete(id: string) {
    return prisma.gameSuggestion.delete({ where: { id } });
  }

  async listAll() {
    const rows = await prisma.gameSuggestion.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map(this.parse);
  }

  // Public: only published, filtered by track + optional tag
  async listPublished(track?: string, tag?: string) {
    const all = await prisma.gameSuggestion.findMany({
      where: { published: true },
      orderBy: [{ usageCount: 'desc' }, { createdAt: 'desc' }],
    });

    return all
      .map(this.parse)
      .filter((s) => {
        const trackMatch = s.tracks.length === 0 || !track || s.tracks.includes(track);
        const tagMatch = !tag || s.tags.includes(tag);
        return trackMatch && tagMatch;
      });
  }

  async incrementUsage(id: string) {
    await prisma.gameSuggestion.update({
      where: { id },
      data: { usageCount: { increment: 1 } },
    }).catch(() => {}); // non-critical
  }

  private parse(row: any) {
    return {
      ...row,
      tracks: (() => { try { return JSON.parse(row.tracks); } catch { return []; } })(),
      tags: (() => { try { return JSON.parse(row.tags); } catch { return []; } })(),
    };
  }
}

export const gameSuggestionService = new GameSuggestionService();
export default gameSuggestionService;
