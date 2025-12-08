import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePumpsData } from "@/hooks/usePumpsData";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { getFuelBadgeClasses } from '@/lib/fuelColors';
import { Fuel, Gauge, ClipboardEdit } from "lucide-react";
import { EquipmentStatusEnum } from "@/core/enums";
import { useNavigate } from 'react-router-dom';

export default function EmployeePumpsView() {
  const navigate = useNavigate();
  const { data: pumps, isLoading } = usePumpsData();
  const { currentStation } = useRoleAccess();

  if (isLoading) {
    return (
      <div className="w-full flex flex-col gap-6 md:gap-8">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 lg:gap-6">
          <div className="space-y-1">
            <div className="h-8 md:h-10 lg:h-12 bg-muted animate-pulse rounded w-64"></div>
            <div className="h-4 md:h-5 bg-muted animate-pulse rounded w-96"></div>
          </div>
          <div className="h-10 bg-muted animate-pulse rounded w-full sm:w-40"></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-lg"></div>
          ))}
        </div>
        <div className="space-y-6">
          <div className="h-6 md:h-8 bg-muted animate-pulse rounded w-48"></div>
          <div className="grid gap-6 md:gap-8">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-48 bg-muted animate-pulse rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const activePumps = Array.isArray(pumps) ? pumps.filter(pump => pump.status === EquipmentStatusEnum.ACTIVE) : [];
  const totalNozzles = Array.isArray(pumps) ? pumps.reduce((total, pump) => total + (pump.nozzles?.length || 0), 0) : 0;
  const activeNozzles = Array.isArray(pumps) ? pumps.reduce((total, pump) =>
    total + (pump.nozzles?.filter(nozzle => nozzle.status === EquipmentStatusEnum.ACTIVE).length || 0), 0) : 0;

  return (
    <div className="w-full flex flex-col gap-6 md:gap-8">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 lg:gap-6">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tight">Pump Overview</h1>
          <p className="text-sm md:text-base lg:text-lg text-muted-foreground">
            View pump and nozzle information {currentStation ? `for ${currentStation.name}` : 'across all stations'}
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate('/data-entry')} className="w-full sm:w-auto shrink-0">
          <ClipboardEdit className="w-4 h-4 mr-2" />
          Enter Readings
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm md:text-base font-medium">Total Pumps</CardTitle>
            <Fuel className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl md:text-3xl font-bold">{Array.isArray(pumps) ? pumps.length : 0}</div>
            <p className="text-xs md:text-sm text-muted-foreground mt-1">
              {activePumps.length} active
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm md:text-base font-medium">Total Nozzles</CardTitle>
            <Gauge className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl md:text-3xl font-bold">{totalNozzles}</div>
            <p className="text-xs md:text-sm text-muted-foreground mt-1">
              {activeNozzles} active
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm md:text-base font-medium">Station</CardTitle>
            <Fuel className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg md:text-xl font-bold truncate">{currentStation?.name || 'N/A'}</div>
            <p className="text-xs md:text-sm text-muted-foreground mt-1">
              Current station
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow sm:col-span-2 lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm md:text-base font-medium">Quick Actions</CardTitle>
            <ClipboardEdit className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => navigate('/data-entry')}
              className="w-full text-sm md:text-base"
            >
              Enter Fuel Readings
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Pumps List */}
      <div className="space-y-6">
        <h2 className="text-xl md:text-2xl lg:text-3xl font-semibold">Pumps & Nozzles</h2>
        {Array.isArray(pumps) && pumps.length > 0 ? (
          <div className="grid gap-6 md:gap-8">
            {pumps.map((pump) => (
              <Card key={pump.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Fuel className="w-6 h-6 md:w-7 md:h-7 text-primary" />
                      <div>
                        <CardTitle className="text-lg md:text-xl lg:text-2xl">{pump.name}</CardTitle>
                        <CardDescription className="text-sm md:text-base">Pump ID: {pump.id}</CardDescription>
                      </div>
                      <Badge variant="outline" className={pump.status === EquipmentStatusEnum.ACTIVE ? 'bg-green-100 text-green-800 border-green-200' : 'bg-gray-100 text-gray-800 border-gray-200'}>
                        {pump.status === EquipmentStatusEnum.ACTIVE ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold text-base md:text-lg mb-3">Nozzles ({pump.nozzles?.length || 0})</h4>
                      {pump.nozzles && pump.nozzles.length > 0 ? (
                        <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                          {pump.nozzles.map((nozzle) => (
                            <div key={nozzle.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border hover:bg-muted/70 transition-colors">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <Gauge className="w-4 h-4 flex-shrink-0" />
                                  <span className="font-medium text-sm md:text-base truncate">Nozzle #{nozzle.nozzle_number}</span>
                                  <Badge className={`${getFuelBadgeClasses(nozzle.fuel_type)} text-xs`}>
                                    {nozzle.fuel_type}
                                  </Badge>
                                  <Badge variant="outline" className={`text-xs ${nozzle.status === EquipmentStatusEnum.ACTIVE ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                    {nozzle.status === EquipmentStatusEnum.ACTIVE ? 'Active' : 'Inactive'}
                                  </Badge>
                                </div>
                                {nozzle.lastReading ? (
                                  <div className="text-xs md:text-sm text-muted-foreground ml-6">
                                    Last: {nozzle.lastReading.toLocaleString()} L
                                  </div>
                                ) : (
                                  <div className="text-xs md:text-sm text-muted-foreground ml-6">
                                    Initial: {nozzle.initialReading?.toLocaleString() || 0} L
                                  </div>
                                )}
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => navigate('/data-entry')}
                                className="ml-3 flex-shrink-0 text-xs md:text-sm"
                              >
                                Enter Reading
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm md:text-base text-muted-foreground italic">No nozzles configured</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 md:py-16">
              <Fuel className="w-16 h-16 md:w-20 md:h-20 text-muted-foreground mb-4" />
              <h3 className="text-lg md:text-xl lg:text-2xl font-medium mb-2">No Pumps Found</h3>
              <p className="text-sm md:text-base text-muted-foreground text-center max-w-md">
                No pumps have been configured for this station yet.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}