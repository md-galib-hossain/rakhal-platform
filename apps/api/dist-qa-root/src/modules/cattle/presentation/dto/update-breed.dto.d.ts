import { CreateBreedDto } from './create-breed.dto';
export declare class UpdateBreedDto implements Partial<CreateBreedDto> {
    name?: string;
    description?: string;
}
