// AI assisted development
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { RiskLevel } from '@prisma/client';
import { RiskAssessment } from '../risks/risk-engine.service';

@Injectable()
export class SummaryService {
  private readonly logger = new Logger(SummaryService.name);

  constructor(private readonly config: ConfigService) {}

  async weeklyClientSummary(input: {
    projectName: string;
    progressPercent: number;
    risk: RiskAssessment;
    overdueCount: number;
    commitsLast7Days: number;
  }): Promise<string> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      try {
        return await this.openAiSummary(apiKey, input);
      } catch (e) {
        this.logger.warn(`OpenAI summary failed: ${(e as Error).message}`);
      }
    }
    return this.templateSummary(input);
  }

  private async openAiSummary(
    apiKey: string,
    input: {
      projectName: string;
      progressPercent: number;
      risk: RiskAssessment;
      overdueCount: number;
      commitsLast7Days: number;
    },
  ): Promise<string> {
    const riskLabel = input.risk.level.toLowerCase();
    const prompt = `You are writing a short weekly client update (3-4 sentences), friendly and non-technical.
Project: ${input.projectName}
Planner progress: ${input.progressPercent}%
Risk level: ${riskLabel} (score ${input.risk.score}/100)
Overdue tasks: ${input.overdueCount}
Git commits last 7 days: ${input.commitsLast7Days}
Key risk notes: ${input.risk.factors.map((f) => f.message).join('; ') || 'none'}
Summarize status, risk, and what the client should know.`;
    const res = await axios.post<{
      choices: { message: { content: string } }[];
    }>(
      'https://api.openai.com/v1/chat/completions',
      {
        model: this.config.get<string>('OPENAI_MODEL', 'gpt-4o-mini'),
        messages: [
          { role: 'system', content: 'Be concise and professional.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.4,
        max_tokens: 220,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30_000,
      },
    );
    const text = res.data.choices[0]?.message?.content?.trim();
    if (!text) {
      throw new Error('Empty OpenAI response');
    }
    return text;
  }

  private templateSummary(input: {
    projectName: string;
    progressPercent: number;
    risk: RiskAssessment;
    overdueCount: number;
    commitsLast7Days: number;
  }): string {
    const riskWord =
      input.risk.level === RiskLevel.HIGH
        ? 'high'
        : input.risk.level === RiskLevel.MEDIUM
          ? 'medium'
          : 'low';
    const top = input.risk.factors[0]?.message ?? 'No major blockers flagged.';
    return (
      `${input.projectName} is about ${input.progressPercent}% complete based on planner tasks. ` +
      `Overall risk is ${riskWord}: ${top} ` +
      `There ${input.overdueCount === 1 ? 'is' : 'are'} ${input.overdueCount} overdue task(s). ` +
      `In the last week we recorded ${input.commitsLast7Days} commit(s) in the linked repository.`
    );
  }
}
