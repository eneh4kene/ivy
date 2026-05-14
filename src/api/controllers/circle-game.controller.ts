import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth';
import circleGameService, { GAME_TEMPLATES, TemplateType } from '../../services/circle-game.service'
import gameSuggestionService from '../../services/game-suggestion.service';

export async function listTemplates(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const templates = Object.entries(GAME_TEMPLATES).map(([key, t]) => ({
      type: key,
      name: t.name,
      description: t.description,
      defaultRules: t.defaultRules,
      defaultInstruction: t.defaultInstruction,
    }));
    res.json({ success: true, data: templates });
  } catch (err) { next(err) }
}

export async function createGame(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { circleId } = req.params;
    const { name, description, templateType, rules, ivyInstruction, sprintId, suggestionId } = req.body;

    if (!name || !templateType || !ivyInstruction) {
      res.status(400).json({ success: false, error: 'name, templateType, and ivyInstruction are required' });
      return;
    }
    if (!Object.keys(GAME_TEMPLATES).includes(templateType)) {
      res.status(400).json({ success: false, error: `Unknown templateType: ${templateType}` });
      return;
    }

    const game = await circleGameService.createGame(circleId, {
      name,
      description,
      templateType: templateType as TemplateType,
      rules,
      ivyInstruction,
      sprintId,
    });

    // Track adoption of a suggestion
    if (suggestionId) gameSuggestionService.incrementUsage(suggestionId);

    res.status(201).json({ success: true, data: game });
  } catch (err) { next(err) }
}

export async function listGames(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const games = await circleGameService.listGamesForCircle(req.params.circleId);
    res.json({ success: true, data: games });
  } catch (err) { next(err) }
}

export async function getGame(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const game = await circleGameService.getGame(req.params.gameId);
    if (!game) { res.status(404).json({ success: false, error: 'Game not found' }); return; }
    res.json({ success: true, data: game });
  } catch (err) { next(err) }
}

export async function getActiveGame(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await circleGameService.getActiveGameForUser(req.user!.id);
    res.json({ success: true, data: result });
  } catch (err) { next(err) }
}

export async function pauseGame(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const game = await circleGameService.pauseGame(req.params.gameId);
    res.json({ success: true, data: game });
  } catch (err) { next(err) }
}

export async function endGame(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const game = await circleGameService.completeGame(req.params.gameId);
    res.json({ success: true, data: game });
  } catch (err) { next(err) }
}
