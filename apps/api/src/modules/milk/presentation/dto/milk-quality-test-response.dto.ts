import { ApiProperty } from '@nestjs/swagger';
import { MilkQualityTestSource, type MilkQualityTest } from '@prisma/client';

/**
 * A milk quality test row, as returned by `POST /milk/quality-tests`, `GET /milk/quality-tests`
 * and `GET /milk/quality-tests/latest`. Documents the Prisma `MilkQualityTest` model
 * (`prisma/schemas/milk/milk.prisma`); `Date` fields are ISO-8601 strings on the wire.
 */
export class MilkQualityTestResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() farmId!: string;
  @ApiProperty() cattleId!: string;
  @ApiProperty() lactationId!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'Day the sample was taken (UTC midnight).',
  })
  sampleDate!: Date;

  @ApiProperty() fatPct!: number;
  @ApiProperty() proteinPct!: number;
  @ApiProperty({ type: Number, nullable: true }) lactosePct!: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Cells per mL. Elevated SCC is the primary mastitis/udder-health signal.',
  })
  somaticCellCount!: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'mg/dL. Milk Urea Nitrogen, a feed-protein-balance indicator.',
  })
  milkUreaNitrogen!: number | null;

  @ApiProperty({
    enum: MilkQualityTestSource,
    enumName: 'MilkQualityTestSource',
  })
  source!: MilkQualityTestSource;

  @ApiProperty({ type: String, nullable: true }) notes!: string | null;
  @ApiProperty() createdBy!: string;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: Date;
}

// Compile-time guard (RD-140): fails `nest build` if the Prisma model gains, loses or retypes a column
// without this documented shape following, so the OpenAPI file cannot silently drift.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
export type MilkQualityTestShapeGuard = Assert<
  Same<MilkQualityTest, MilkQualityTestResponseDto>
>;
