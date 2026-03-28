// AI assisted development
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { RiskLevel } from '@prisma/client';
import { SummaryService } from './summary.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('SummaryService', () => {
  let config: { get: jest.Mock };
  let service: SummaryService;

  beforeEach(() => {
    config = { get: jest.fn() };
    service = new SummaryService(config as unknown as ConfigService);
  });

  const baseRisk = {
    level: RiskLevel.LOW,
    score: 10,
    factors: [{ code: 'X', message: 'Note', weight: 1 }],
  };

  it('uses template when no API key', async () => {
    config.get.mockReturnValue(undefined);
    const text = await service.weeklyClientSummary({
      projectName: 'P',
      progressPercent: 50,
      risk: baseRisk,
      overdueCount: 2,
      commitsLast7Days: 3,
    });
    expect(text).toContain('P');
    expect(text).toContain('50%');
    expect(text).toContain('low');
    expect(text).toContain('are 2 overdue');
  });

  it('template uses singular overdue', async () => {
    config.get.mockReturnValue(undefined);
    const text = await service.weeklyClientSummary({
      projectName: 'P',
      progressPercent: 0,
      risk: { ...baseRisk, factors: [] },
      overdueCount: 1,
      commitsLast7Days: 0,
    });
    expect(text).toContain('is 1 overdue');
  });

  it('template risk wording for MEDIUM and HIGH', async () => {
    config.get.mockReturnValue(undefined);
    const med = await service.weeklyClientSummary({
      projectName: 'P',
      progressPercent: 0,
      risk: { level: RiskLevel.MEDIUM, score: 30, factors: baseRisk.factors },
      overdueCount: 0,
      commitsLast7Days: 0,
    });
    expect(med).toContain('medium');
    const high = await service.weeklyClientSummary({
      projectName: 'P',
      progressPercent: 0,
      risk: { level: RiskLevel.HIGH, score: 60, factors: baseRisk.factors },
      overdueCount: 0,
      commitsLast7Days: 0,
    });
    expect(high).toContain('high');
  });

  it('calls OpenAI when key present and returns text', async () => {
    config.get.mockImplementation((k: string) =>
      k === 'OPENAI_API_KEY' ? 'sk-test' : 'gpt-4o-mini',
    );
    mockedAxios.post.mockResolvedValue({
      data: { choices: [{ message: { content: ' AI summary ' } }] },
    } as never);
    const text = await service.weeklyClientSummary({
      projectName: 'P',
      progressPercent: 10,
      risk: baseRisk,
      overdueCount: 0,
      commitsLast7Days: 1,
    });
    expect(text).toBe('AI summary');
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.any(Object),
      expect.any(Object),
    );
  });

  it('falls back to template when OpenAI returns empty', async () => {
    config.get.mockImplementation((k: string) =>
      k === 'OPENAI_API_KEY' ? 'sk-test' : 'gpt-4o-mini',
    );
    mockedAxios.post.mockResolvedValue({
      data: { choices: [{ message: { content: '' } }] },
    } as never);
    const text = await service.weeklyClientSummary({
      projectName: 'Proj',
      progressPercent: 5,
      risk: baseRisk,
      overdueCount: 0,
      commitsLast7Days: 0,
    });
    expect(text).toContain('Proj');
  });

  it('falls back to template when OpenAI throws', async () => {
    config.get.mockImplementation((k: string) =>
      k === 'OPENAI_API_KEY' ? 'sk-test' : 'gpt-4o-mini',
    );
    mockedAxios.post.mockRejectedValue(new Error('network'));
    const text = await service.weeklyClientSummary({
      projectName: 'Proj',
      progressPercent: 5,
      risk: baseRisk,
      overdueCount: 0,
      commitsLast7Days: 0,
    });
    expect(text).toContain('Proj');
  });
});
