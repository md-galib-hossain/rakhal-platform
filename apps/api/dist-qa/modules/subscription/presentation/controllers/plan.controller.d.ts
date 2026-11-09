import { PlanCatalogueService } from '../../application/services/plan-catalogue.service';
export declare class PlanController {
    private readonly planCatalogue;
    constructor(planCatalogue: PlanCatalogueService);
    list(): Promise<import("../../application/services/plan-catalogue.service").PublicPlan[]>;
}
