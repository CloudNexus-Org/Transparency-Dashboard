// AI assisted development
import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { UserRole } from '@prisma/client';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.projects.listForUser(user.sub, user.role);
  }

  @Get(':id/dashboard')
  dashboard(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.projects.dashboard(user.sub, user.role, id);
  }

  @Get(':id/risk-history')
  riskHistory(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.projects.riskHistory(user.sub, user.role, id);
  }

  @Get(':id/export/pdf')
  async exportPdf(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const buf = await this.projects.exportPdf(user.sub, user.role, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="project-${id}.pdf"`,
    );
    return res.send(buf);
  }

  @Get(':id/export/csv')
  @Header('Content-Type', 'text/csv')
  async exportCsv(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const csv = await this.projects.exportCsv(user.sub, user.role, id);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="project-${id}.csv"`,
    );
    return res.send(csv);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateProjectDto) {
    return this.projects.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.projects.update(id, dto);
  }

  @Post(':id/members')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  assign(
    @Param('id') projectId: string,
    @Body('userId') userId: string,
  ) {
    return this.projects.assignMember(projectId, userId);
  }

  @Delete(':id/members/:userId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  removeMember(
    @Param('id') projectId: string,
    @Param('userId') userId: string,
  ) {
    return this.projects.removeMember(projectId, userId);
  }
}
