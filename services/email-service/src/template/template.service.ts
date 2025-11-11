import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { EmailTemplate, ApiResponse, UserData } from '../types';

interface TemplateResponse {
  id: string;
  name: string;
  templates: {
    [language: string]: {
      subject: string;
      body: string;
    };
  };
}

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);
  private readonly templateServiceUrl: string;

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    this.templateServiceUrl = this.configService.get<string>(
      'TEMPLATE_SERVICE_URL',
      'http://localhost:3004',
    );
  }

  async getTemplate(
    templateCode: string,
    language: string,
  ): Promise<EmailTemplate> {
    try {
      const url = `${this.templateServiceUrl}/api/templates/${templateCode}?language=${language}`;

      this.logger.log(
        `Fetching template ${templateCode} for language ${language}`,
      );

      const response = await firstValueFrom(
        this.httpService.get<ApiResponse<TemplateResponse>>(url),
      );

      const templateData = response.data.data;
      const template =
        templateData?.templates[language] || templateData?.templates['en'];

      if (!template) {
        throw new Error(`Template not found for code ${templateCode}`);
      }

      return template;
    } catch (error) {
      this.logger.error(`Failed to fetch template: ${error.message}`);
      throw error;
    }
  }

  substituteVariables(template: string, variables: UserData): string {
    let result = template;

    // Replace {{name}} or {{ name }}
    result = result.replace(/\{\{\s*name\s*\}\}/g, variables.name || '');

    // Replace {{link}} or {{ link }}
    result = result.replace(/\{\{\s*link\s*\}\}/g, variables.link || '');

    // Handle meta properties like {{meta.order_id}} or {{ meta.order_id }}
    if (variables.meta) {
      Object.keys(variables.meta).forEach((key) => {
        const regex = new RegExp(`\\{\\{\\s*meta\\.${key}\\s*\\}\\}`, 'g');
        result = result.replace(regex, String(variables.meta[key]));
      });
    }

    // Also handle legacy {{variable_name}} format for backward compatibility
    // This catches any remaining variables that might be in meta
    result = result.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const trimmedKey = key.trim();

      // Check if it's a meta property
      if (trimmedKey.startsWith('meta.')) {
        const metaKey = trimmedKey.substring(5);
        return variables.meta?.[metaKey] || match;
      }

      // Return original if not found
      return match;
    });

    return result;
  }
}
