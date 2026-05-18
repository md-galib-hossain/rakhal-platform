import { IsString } from 'class-validator';

export class RevokeSessionDto {
  @IsString()
  sessionId!: string;
}
