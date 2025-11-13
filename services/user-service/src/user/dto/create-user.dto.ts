import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UserPreferenceDto {
  @IsBoolean()
  email: boolean;

  @IsBoolean()
  push: boolean;
}

export class CreateUserDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  push_token?: string | null;

  @ValidateNested()
  @Type(() => UserPreferenceDto)
  preferences: UserPreferenceDto;

  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters' })
  password: string;
}
