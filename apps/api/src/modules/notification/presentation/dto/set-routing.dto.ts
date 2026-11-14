import { IsArray, IsString } from 'class-validator';

/**
 * Set a farm's channel routing for one event (RAKHAL-256). `channels` is the
 * enabled channel set (e.g. `["in_app","sms"]`); an empty array routes to the
 * in-app bell only. Unknown channel names are ignored by the service.
 */
export class SetRoutingDto {
  @IsArray()
  @IsString({ each: true })
  channels!: string[];
}
