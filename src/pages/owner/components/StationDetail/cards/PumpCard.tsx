import { EquipmentStatusEnum } from '@/core/enums';
import { Pump } from '@/types/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit2, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

interface PumpCardProps {
  pump: Pump;
  onEdit: (pump: Pump) => void;
  onEditNozzle: (nozzle: any) => void;
  onAddNozzle: () => void;
}

export default function PumpCard({ pump, onEdit, onEditNozzle, onAddNozzle }: PumpCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isActive = pump.status === EquipmentStatusEnum.ACTIVE;
  const isMaintenance = pump.status === EquipmentStatusEnum.MAINTENANCE;
  const activeNozzles = pump.nozzles?.filter((n: any) => n.status === EquipmentStatusEnum.ACTIVE).length || 0;
  const totalNozzles = pump.nozzles?.length || 0;
  const fuelTypes = [...new Set(pump.nozzles?.map((n: any) => n.fuelType) || [])] as string[];

  return (
    <Card
      className={`relative overflow-hidden border transition-all duration-300 hover:shadow-md ${
        isActive ? 'border-green-200 bg-green-50/20' : isMaintenance ? 'border-orange-200 bg-orange-50/20' : 'border-gray-200 bg-gray-50/20'
      }`}
    >
      <div className={`absolute top-0 left-0 right-0 h-0.5 ${isActive ? 'bg-green-500' : isMaintenance ? 'bg-orange-500' : 'bg-gray-500'}`}></div>

      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-lg font-semibold truncate">Fuel Dispenser {pump.pumpNumber} - {pump.name}</h3>
              <Badge variant={isActive ? 'default' : isMaintenance ? 'secondary' : 'outline'}>
                {pump.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              {activeNozzles}/{totalNozzles} nozzles • {fuelTypes.join(', ')}
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(pump)}
            >
              <Edit2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {isExpanded && (
          <div className="mt-4 pt-4 border-t space-y-3">
            <div className="space-y-2">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-medium">Nozzles</h4>
                <Button size="sm" onClick={onAddNozzle}>
                  <Plus className="w-3 h-3 mr-1" />
                  Add
                </Button>
              </div>
              {pump.nozzles && pump.nozzles.length > 0 ? (
                <div className="space-y-2">
                  {pump.nozzles.map((nozzle: any) => (
                    <div key={nozzle.id} className="flex items-center justify-between p-2.5 bg-white rounded border">
                      <div className="flex-1 flex items-center gap-2">
                        <Badge variant="outline" className="text-xs py-0.5 font-semibold shrink-0">
                          Nozzle {nozzle.nozzleNumber}
                        </Badge>
                        <span className="text-sm text-muted-foreground">{nozzle.fuelType}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={nozzle.status === 'active' ? 'default' : 'outline'}>
                          {nozzle.status}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEditNozzle(nozzle)}
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No nozzles configured</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
