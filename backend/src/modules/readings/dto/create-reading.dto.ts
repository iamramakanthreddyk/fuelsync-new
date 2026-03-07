/**
 * Create Reading DTO
 * Request validation for creating a new nozzle reading
 * Supports Req #1: assignedEmployeeId for manager/owner entering on behalf
 */

export class CreateReadingDto {
  // Nozzle & Station
  nozzleId!: string;
  stationId!: string;

  // Reading data
  readingDate!: string; // YYYY-MM-DD
  readingValue!: number;
  previousReading?: number;
  litresSold?: number;
  fuelType!: string;

  // Req #1: Attribution
  // If set by manager/owner, this reading belongs to this employee
  // If null, reading belongs to the entering person
  assignedEmployeeId?: string | null;

  // Payment
  paymentMethod!: string;
  pricePerLitre!: number;
  totalAmount!: number;

  // Req #2: Optional payment sub-breakdown
  paymentSubBreakdown?: {
    cash?: number;
    upi?: Record<string, number>;
    card?: Record<string, number>;
    oil_company?: Record<string, number>;
    credit?: number;
  };

  notes?: string;
}

export class CreateReadingResponseDto {
  id!: string;
  nozzleId!: string;
  stationId!: string;
  readingDate!: string;
  readingValue!: number;
  litresSold!: number;
  fuelType!: string;
  pricePerLitre!: number;
  totalAmount!: number;
  paymentMethod!: string;

  // Req #1: Show employee attribution
  enteredBy!: string;
  assignedEmployeeId?: string | null;
  effectiveEmployee?: string; // computed: assignedEmployeeId || enteredBy
  wasEnteredOnBehalf?: boolean;

  // Req #2: Payment sub-breakdown
  paymentSubBreakdown?: Record<string, any>;

  createdAt!: string;
  updatedAt!: string;
}

export class ReadingFilterDto {
  stationId!: string;
  startDate?: string;
  endDate?: string;
  nozzleId?: string;
  employeeId?: string; // Filter by assignedEmployeeId OR enteredBy
  fuelType?: string;
  limit?: number;
  offset?: number;
}
