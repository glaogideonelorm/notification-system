import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { EmailTemplate, ApiResponse, UserData } from '../types';

// Updated interface to match actual template-service response
interface TemplateData {
  subject: string;
  body: string;
  title: string;
  variables: string[];
}

interface TemplateResponse {
  success: boolean;
  data: TemplateData;
  message: string;
  meta: null;
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
      const url = `${this.templateServiceUrl}/api/v1/templates/${templateCode}?language=${language}`;

      this.logger.log(
        `Fetching template ${templateCode} for language ${language}`,
      );

      const response = await firstValueFrom(
        this.httpService.get<TemplateResponse>(url),
      );

      const apiResponse = response.data;

      // Check if the request was successful
      if (!apiResponse.success) {
        throw new Error(
          `Template service returned error for code ${templateCode}`,
        );
      }

      const templateData = apiResponse.data;

      if (!templateData || !templateData.subject || !templateData.body) {
        throw new Error(`Template not found for code ${templateCode}`);
      }

      // Return the template with subject and body
      return {
        subject: templateData.subject,
        body: templateData.body,
      };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to fetch template: ${errMsg}`);
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
        const value = String(variables.meta?.[key]);

        const regex = new RegExp(`\\{\\{\\s*meta\\.${key}\\s*\\}\\}`, 'g');

        result = result.replace(regex, value);
      });
    }

    // Also handle legacy {{variable_name}} format for backward compatibility
    // This catches any remaining variables that might be in meta
    result = result.replace(
      /\{\{([^}]+)\}\}/g,
      (match: string, key: string) => {
        const trimmedKey = key.trim();

        // Check if it's a meta property
        if (trimmedKey && trimmedKey.startsWith('meta.')) {
          const metaKey = trimmedKey.substring(5);

          const value = String(variables.meta?.[metaKey]);

          return value || match;
        }

        // Return original if not found
        return match;
      },
    );

    return result;
  }
}
