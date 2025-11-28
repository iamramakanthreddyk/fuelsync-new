
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ListChecks } from "lucide-react";
import React from "react";

interface ChecklistItem {
  key: string;
  label: string;
  completed: boolean;
  action?: () => void;
}

export function SetupChecklist({
  checklist,
}: {
  checklist: ChecklistItem[];
}) {
  const incomplete = checklist.filter((item) => !item.completed);

  if (incomplete.length === 0) return null;

  return (
    <Card className="border-yellow-400 border-2 bg-yellow-50 mb-4 animate-pulse hover:animate-none transition-all duration-500">
      <CardHeader className="flex items-center gap-3">
        <ListChecks className="h-8 w-8 text-yellow-800" />
        <div>
          <CardTitle className="text-lg text-yellow-900">Finish your Setup</CardTitle>
          <CardDescription>
            Please complete the following items to start using the app smoothly.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {checklist.map(item => (
            <li key={item.key} className="flex items-center gap-3">
              <span>
                {item.completed ? (
                  <span className="inline-block w-6 h-6 rounded-full bg-green-600 flex items-center justify-center text-white"><span className="sr-only">Done</span>✔️</span>
                ) : (
                  <span className="inline-block w-6 h-6 rounded-full bg-yellow-500/50 border border-yellow-900 flex items-center justify-center text-yellow-900">!</span>
                )}
              </span>
              <span className={item.completed ? "text-green-800 font-medium" : "text-yellow-900"}>
                {item.label}
              </span>
              {!item.completed && item.action &&
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto"
                  onClick={item.action}
                >
                  Fix
                </Button>
              }
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
