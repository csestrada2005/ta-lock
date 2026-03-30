import { ShieldAlert } from "lucide-react";

const Unauthorized = () => (
  <div className="flex h-screen w-screen items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-4 p-8 text-center max-w-sm">
      <ShieldAlert className="h-12 w-12 text-destructive" />
      <h1 className="text-xl font-semibold text-foreground">Unauthorized Access</h1>
      <p className="text-sm text-muted-foreground">
        This application must be launched from your Learning Management System.
      </p>
    </div>
  </div>
);

export default Unauthorized;
