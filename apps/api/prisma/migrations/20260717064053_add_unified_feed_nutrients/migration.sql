-- AlterTable
ALTER TABLE "FeedIngredient" ADD COLUMN     "adfPct" DOUBLE PRECISION,
ADD COLUMN     "calciumPct" DOUBLE PRECISION,
ADD COLUMN     "phosphorusPct" DOUBLE PRECISION,
ADD COLUMN     "tdnPct" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "FeedIngredientOverride" ADD COLUMN     "customAdfPct" DOUBLE PRECISION,
ADD COLUMN     "customCalciumPct" DOUBLE PRECISION,
ADD COLUMN     "customPhosphorusPct" DOUBLE PRECISION,
ADD COLUMN     "customRdpPct" DOUBLE PRECISION,
ADD COLUMN     "customRupPct" DOUBLE PRECISION,
ADD COLUMN     "customStarchPct" DOUBLE PRECISION,
ADD COLUMN     "customTdnPct" DOUBLE PRECISION;
