// AI assisted development
import {
  IsDateString,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  targetEndDate?: string;

  @IsOptional()
  @IsString()
  plannerPlanId?: string;

  @IsOptional()
  @IsString()
  githubOwner?: string;

  @IsOptional()
  @IsString()
  githubRepo?: string;
}
