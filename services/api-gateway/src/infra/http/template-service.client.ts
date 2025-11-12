import { env } from "../../config/env";
import { NotFoundError, ServiceUnavailableError } from "../../core/errors";

export interface TemplateServiceTemplate {
  code: string;
  language: string;
  version: string;
 
}

export interface TemplateServiceClient {
  ensureTemplateExists(templateCode: string): Promise<void>;
}

export class HttpTemplateServiceClient implements TemplateServiceClient {
  async ensureTemplateExists(templateCode: string): Promise<void> {
    if (!env.TEMPLATE_SERVICE_BASE_URL) return; // optional validation

    const res = await fetch(
      `${env.TEMPLATE_SERVICE_BASE_URL}/api/v1/templates/${templateCode}`,
    );

    if (res.status === 404) {
      throw new NotFoundError("Template not found");
    }

    if (!res.ok) {
      throw new ServiceUnavailableError("Template service error");
    }
  }
}
