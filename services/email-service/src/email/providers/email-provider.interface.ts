import { EmailPayload } from '../../types';

export interface IEmailProvider {
  sendEmail(payload: EmailPayload): Promise<void>;
  verifyConnection(): Promise<boolean>;
}
