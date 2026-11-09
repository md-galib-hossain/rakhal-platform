import { MediaService } from '../../application/services/media.service';
export declare class MediaController {
    private readonly media;
    constructor(media: MediaService);
    url(farmId: string, id: string): Promise<import("../../application/services/media.service").MediaUrls>;
}
