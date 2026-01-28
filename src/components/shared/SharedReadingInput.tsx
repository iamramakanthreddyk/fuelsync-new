import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Fuel } from 'lucide-react';
import { toNumber } from '@/utils/number';
import type { Nozzle } from '@/core/models/pump.model';
import type { ReadingEntry } from '@/types/finance';

interface ReadingData {
  nozzleId: string;
  openingReading: string;
  closingReading: string;
}

interface SharedReadingInputProps {
  pumps: any[] | null;
  readings: ReadingData[] | Record<string, ReadingEntry>;
  fuelPrices: any[];
  onReadingChange: (nozzleId: string, field: string, value: string) => void;
  selectedPumpIndex: number;
  onPumpChange: (index: number) => void;
  mode: 'mobile' | 'desktop';
}

export function SharedReadingInput({
  pumps,
  readings,
  fuelPrices,
  onReadingChange,
  selectedPumpIndex,
  onPumpChange,
  mode
}: SharedReadingInputProps) {
  const isMobile = mode === 'mobile';
  const hasMultiplePumps = pumps && pumps.length > 1;

  // Helper function to get reading for a nozzle (works with both formats)
  const getReadingForNozzle = (nozzleId: string) => {
    if (Array.isArray(readings)) {
      // ReadingData[] format (opening/closing readings)
      return readings.find(r => r.nozzleId === nozzleId);
    } else {
      // Record<string, ReadingEntry> format (single reading)
      return readings[nozzleId];
    }
  };

  // Helper function to determine if we're using opening/closing format
  const isOpeningClosingFormat = Array.isArray(readings);

  const getPrice = (fuelType: string): number => {
    if (!Array.isArray(fuelPrices) || !fuelType) return 0;
    const priceData = fuelPrices.find(p => p.fuelType.toUpperCase() === fuelType.toUpperCase());
    return priceData ? toNumber(String(priceData.price)) : 0;
  };

  const hasPriceForFuelType = (fuelType: string): boolean => {
    if (!Array.isArray(fuelPrices) || fuelPrices.length === 0 || !fuelType) return false;
    return fuelPrices.some(p => p.fuelType.toUpperCase() === fuelType.toUpperCase());
  };

  if (isMobile) {
    // Mobile mode: Show one pump at a time with navigation
    const selectedPump = pumps?.[selectedPumpIndex];

    if (!selectedPump) {
      return (
        <Card className="border-dashed">
          <CardContent className="p-6 text-center">
            <Fuel className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No pump selected</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Fuel className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Pump {selectedPump.pumpNumber}
                </h3>
                <p className="text-sm text-gray-600">
                  {selectedPump.nozzles?.length || 0} nozzles
                </p>
              </div>
            </div>

            {/* Pump Navigation */}
            {hasMultiplePumps && (
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPumpChange(Math.max(0, selectedPumpIndex - 1))}
                  disabled={selectedPumpIndex === 0}
                >
                  ←
                </Button>
                <span className="text-sm text-gray-600 min-w-[60px] text-center">
                  {selectedPumpIndex + 1} / {pumps.length}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPumpChange(Math.min(pumps.length - 1, selectedPumpIndex + 1))}
                  disabled={selectedPumpIndex === pumps.length - 1}
                >
                  →
                </Button>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {selectedPump.nozzles && selectedPump.nozzles.length > 0 ? (
            selectedPump.nozzles.map((nozzle: Nozzle) => {
              const reading = getReadingForNozzle(nozzle.id);
              const fuelType = nozzle.fuelType;
              const price = getPrice(fuelType);
              const hasPrice = hasPriceForFuelType(fuelType);

              return (
                <div key={nozzle.id} className="space-y-3 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <span className="font-medium text-gray-900">
                        Nozzle {nozzle.nozzleNumber}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {fuelType}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900">
                        ₹{price.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-600">per litre</div>
                    </div>
                  </div>

                  {isOpeningClosingFormat ? (
                    // Opening/Closing format
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs font-medium text-gray-700">
                            Opening Reading
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={(reading as ReadingData)?.openingReading || ''}
                            onChange={(e) => onReadingChange(nozzle.id, 'openingReading', e.target.value)}
                            placeholder="0.00"
                            className="text-sm h-9"
                            disabled={!hasPrice}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs font-medium text-gray-700">
                            Closing Reading
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={(reading as ReadingData)?.closingReading || ''}
                            onChange={(e) => onReadingChange(nozzle.id, 'closingReading', e.target.value)}
                            placeholder="0.00"
                            className="text-sm h-9"
                            disabled={!hasPrice}
                          />
                        </div>
                      </div>

                      {(reading as ReadingData)?.openingReading && (reading as ReadingData)?.closingReading && (
                        <div className="bg-blue-50 p-3 rounded-md">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-blue-900">
                              Fuel Sold: {(toNumber((reading as ReadingData).closingReading) - toNumber((reading as ReadingData).openingReading)).toFixed(2)} L
                            </span>
                            <span className="text-sm font-medium text-blue-900">
                              ₹{((toNumber((reading as ReadingData).closingReading) - toNumber((reading as ReadingData).openingReading)) * price).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    // Single reading format
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs font-medium text-gray-700">
                          Current Reading
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={(reading as ReadingEntry)?.readingValue || ''}
                          onChange={(e) => onReadingChange(nozzle.id, 'readingValue', e.target.value)}
                          placeholder="0.00"
                          className="text-sm h-9"
                          disabled={!hasPrice}
                        />
                      </div>

                      {(reading as ReadingEntry)?.readingValue && (
                        <div className="bg-blue-50 p-3 rounded-md">
                          <div className="text-sm font-medium text-blue-900">
                            Reading: {(reading as ReadingEntry).readingValue} L
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {!hasPrice && (
                    <div className="bg-yellow-50 p-2 rounded-md">
                      <p className="text-xs text-yellow-800">
                        ⚠️ Price not set for {fuelType}
                      </p>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-8">
              <Fuel className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No nozzles configured</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Desktop mode: Show all pumps in a grid
  return (
    <div className="space-y-6">
      {pumps && pumps.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pumps.map((pump) => (
            <Card key={pump.id} className="shadow-md">
              <CardHeader className="pb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Fuel className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Pump {pump.pumpNumber}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {pump.nozzles?.length || 0} nozzles
                    </p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {pump.nozzles && pump.nozzles.length > 0 ? (
                  pump.nozzles.map((nozzle: Nozzle) => {
                    const reading = getReadingForNozzle(nozzle.id);
                    const fuelType = nozzle.fuelType;

                    // Skip nozzles without fuel type
                    if (!fuelType) return null;

                    const price = getPrice(fuelType);
                    const hasPrice = hasPriceForFuelType(fuelType);

                    return (
                      <div key={nozzle.id} className="space-y-3 p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                            <span className="font-medium text-gray-900">
                              Nozzle {nozzle.nozzleNumber}
                            </span>
                            <Badge variant="secondary" className="text-xs">
                              {fuelType}
                            </Badge>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium text-gray-900">
                              ₹{price.toFixed(2)}
                            </div>
                            <div className="text-xs text-gray-600">per litre</div>
                          </div>
                        </div>

                        {isOpeningClosingFormat ? (
                          // Opening/Closing format
                          <>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label className="text-xs font-medium text-gray-700">
                                  Opening Reading
                                </Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={(reading as ReadingData)?.openingReading || ''}
                                  onChange={(e) => onReadingChange(nozzle.id, 'openingReading', e.target.value)}
                                  placeholder="0.00"
                                  className="text-sm h-9"
                                  disabled={!hasPrice}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs font-medium text-gray-700">
                                  Closing Reading
                                </Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={(reading as ReadingData)?.closingReading || ''}
                                  onChange={(e) => onReadingChange(nozzle.id, 'closingReading', e.target.value)}
                                  placeholder="0.00"
                                  className="text-sm h-9"
                                  disabled={!hasPrice}
                                />
                              </div>
                            </div>

                            {(reading as ReadingData)?.openingReading && (reading as ReadingData)?.closingReading && (
                              <div className="bg-blue-50 p-3 rounded-md">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm font-medium text-blue-900">
                                    Fuel Sold: {(toNumber((reading as ReadingData).closingReading) - toNumber((reading as ReadingData).openingReading)).toFixed(2)} L
                                  </span>
                                  <span className="text-sm font-medium text-blue-900">
                                    ₹{((toNumber((reading as ReadingData).closingReading) - toNumber((reading as ReadingData).openingReading)) * price).toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          // Single reading format
                          <>
                            <div className="space-y-1">
                              <Label className="text-xs font-medium text-gray-700">
                                Current Reading
                              </Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={(reading as ReadingEntry)?.readingValue || ''}
                                onChange={(e) => onReadingChange(nozzle.id, 'readingValue', e.target.value)}
                                placeholder="0.00"
                                className="text-sm h-9"
                                disabled={!hasPrice}
                              />
                            </div>

                            {(reading as ReadingEntry)?.readingValue && (
                              <div className="bg-blue-50 p-3 rounded-md">
                                <div className="text-sm font-medium text-blue-900">
                                  Reading: {(reading as ReadingEntry).readingValue} L
                                </div>
                              </div>
                            )}
                          </>
                        )}

                        {!hasPrice && (
                          <div className="bg-yellow-50 p-2 rounded-md">
                            <p className="text-xs text-yellow-800">
                              ⚠️ Price not set for {fuelType}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8">
                    <Fuel className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No nozzles configured</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="p-6 text-center">
            <Fuel className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No pumps available</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}