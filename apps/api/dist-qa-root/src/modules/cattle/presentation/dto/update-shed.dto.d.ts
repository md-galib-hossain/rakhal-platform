import { CreateShedDto } from './create-shed.dto';
export declare class UpdateShedDto implements Partial<CreateShedDto> {
    name?: string;
    code?: string;
    description?: string;
    capacity?: number;
}
