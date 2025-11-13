import {
  IsBoolean,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UserPreferenceDto {
  @IsBoolean()
  email: boolean;

  @IsBoolean()
  push: boolean;
}

export class UpdatePrefsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => UserPreferenceDto)
  preferences?: UserPreferenceDto;

  @IsOptional()
  @IsString()
  push_token?: string | null;
}
