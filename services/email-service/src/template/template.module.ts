import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TemplateService } from './template.service';

@Module({
  imports: [HttpModule],
  providers: [TemplateService],
  exports: [TemplateService],
})
export class TemplateModule {}
