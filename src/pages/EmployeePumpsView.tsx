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
      <div className="container mx-auto p-6">
        <div className="text-center">Loading pumps...</div>
      </div>
    );
  }

  const activePumps = Array.isArray(pumps) ? pumps.filter(pump => pump.status === EquipmentStatusEnum.ACTIVE) : [];
  const totalNozzles = Array.isArray(pumps) ? pumps.reduce((total, pump) => total + (pump.nozzles?.length || 0), 0) : 0;
  const activeNozzles = Array.isArray(pumps) ? pumps.reduce((total, pump) =>
    total + (pump.nozzles?.filter(nozzle => nozzle.status === EquipmentStatusEnum.ACTIVE).length || 0), 0) : 0;

  return (
    <div className="container mx-auto p-2 md:p-4 lg:p-6 max-w-7xl flex flex-col gap-4 md:gap-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 md:gap-4">
        <div>
          <h1 className="text-xl md:text-2xl lg:text-3xl font-bold">Pump Overview</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            View pump and nozzle information {currentStation ? `for ${currentStation.name}` : 'across all stations'}
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate('/data-entry')} className="w-full sm:w-auto">
          <ClipboardEdit className="w-4 h-4 mr-2" />
          Enter Readings
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pumps</CardTitle>
            <Fuel className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Array.isArray(pumps) ? pumps.length : 0}</div>
            <p className="text-xs text-muted-foreground">
              {activePumps.length} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Nozzles</CardTitle>
            <Gauge className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalNozzles}</div>
            <p className="text-xs text-muted-foreground">
              {activeNozzles} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Station</CardTitle>
            <Fuel className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentStation?.name || 'N/A'}</div>
            <p className="text-xs text-muted-foreground">
              Current station
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pumps List */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Pumps & Nozzles</h2>
        {Array.isArray(pumps) && pumps.length > 0 ? (
          <div className="grid gap-4">
            {pumps.map((pump) => (
              <Card key={pump.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Fuel className="w-5 h-5" />
                      <CardTitle className="text-lg">{pump.name}</CardTitle>
                      <Badge variant="outline" className={pump.status === EquipmentStatusEnum.ACTIVE ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                        {pump.status === EquipmentStatusEnum.ACTIVE ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                  <CardDescription>
                    Pump ID: {pump.id}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-medium mb-2">Nozzles ({pump.nozzles?.length || 0})</h4>
                      {pump.nozzles && pump.nozzles.length > 0 ? (
                        <div className="grid gap-2">
                          {pump.nozzles.map((nozzle) => (
                            <div key={nozzle.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Gauge className="w-4 h-4" />
                                  <span className="font-medium">Nozzle #{nozzle.nozzle_number}</span>
                                  <Badge className={getFuelBadgeClasses(nozzle.fuel_type)}>
                                    {nozzle.fuel_type}
                                  </Badge>
                                  <Badge variant="outline" className={nozzle.status === EquipmentStatusEnum.ACTIVE ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                                    {nozzle.status === EquipmentStatusEnum.ACTIVE ? 'Active' : 'Inactive'}
                                  </Badge>
                                </div>
                                {nozzle.lastReading ? (
                                  <div className="text-xs text-muted-foreground ml-6">
                                    Last Reading: {nozzle.lastReading.toLocaleString()} L
                                  </div>
                                ) : (
                                  <div className="text-xs text-muted-foreground ml-6">
                                    Initial Reading: {nozzle.initialReading?.toLocaleString() || 0} L
                                  </div>
                                )}
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => navigate('/data-entry')}
                                className="ml-2"
                              >
                                Enter Reading
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No nozzles configured</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Fuel className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Pumps Found</h3>
              <p className="text-sm text-muted-foreground text-center">
                No pumps have been configured for this station yet.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}