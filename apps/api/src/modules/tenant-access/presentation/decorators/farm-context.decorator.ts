import { SetMetadata } from '@nestjs/common';

export const FARM_PARAM_KEY = 'auth:farmParamKey';

export const FarmContext = (paramName = 'farmId') =>
  SetMetadata(FARM_PARAM_KEY, paramName);
