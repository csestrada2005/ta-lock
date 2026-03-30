import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, Users } from "lucide-react";
import { useTenant } from "@/contexts/TenantContext";

interface BatchSelectionProps {
  onBatchSelect: (batchId: string) => void;
}

const BATCHES = [
  {
    id: "2029",
    name: "2029 Batch",
    description: "Current cohort with foundational courses",
    icon: GraduationCap,
  },
  {
    id: "2028",
    name: "2028 Batch",
    description: "Advanced cohort with specialized courses",
    icon: Users,
  },
];

export const BatchSelection = ({ onBatchSelect }: BatchSelectionProps) => {
  return (
    <div className="w-full max-w-2xl">
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <TenantLogo className="h-16 w-auto" />
        </div>
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Welcome to Ask TETR
        </h1>
        <p className="text-muted-foreground text-lg">
          Select your batch to access your courses
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {BATCHES.map((batch) => {
          const Icon = batch.icon;
          return (
            <Card
              key={batch.id}
              className="cursor-pointer transition-all hover:border-primary hover:shadow-lg"
              onClick={() => onBatchSelect(batch.id)}
            >
              <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-3 p-3 rounded-full bg-primary/10">
                  <Icon className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-xl">{batch.name}</CardTitle>
                <CardDescription>{batch.description}</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button className="w-full" variant="outline">
                  Select {batch.name}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
